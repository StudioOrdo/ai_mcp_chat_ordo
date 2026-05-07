import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminPageAccessMock,
  loadAdminSystemWorkspaceMock,
  adminSystemWorkspaceMock,
} = vi.hoisted(() => ({
  requireAdminPageAccessMock: vi.fn(),
  loadAdminSystemWorkspaceMock: vi.fn(),
  adminSystemWorkspaceMock: vi.fn(() => <div data-testid="admin-system-workspace" />),
}));

vi.mock("@/lib/journal/admin-journal", () => ({
  requireAdminPageAccess: requireAdminPageAccessMock,
}));

vi.mock("@/lib/admin/system/load-admin-system-workspace", () => ({
  loadAdminSystemWorkspace: loadAdminSystemWorkspaceMock,
}));

vi.mock("@/components/admin/system/AdminSystemWorkspace", () => ({
  AdminSystemWorkspace: adminSystemWorkspaceMock,
}));

import AdminSystemPage from "./page";

describe("/admin/system page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPageAccessMock.mockResolvedValue({
      id: "usr_admin",
      email: "admin@example.com",
      name: "Admin",
      roles: ["ADMIN"],
    });
    loadAdminSystemWorkspaceMock.mockResolvedValue({
      brief: { title: "System Brief" },
    });
  });

  it("requires admin access and renders the System workspace read model", async () => {
    render(await AdminSystemPage({ searchParams: Promise.resolve({ section: "backups" }) }));

    expect(requireAdminPageAccessMock).toHaveBeenCalled();
    expect(loadAdminSystemWorkspaceMock).toHaveBeenCalledWith(
      {
        id: "usr_admin",
        email: "admin@example.com",
        name: "Admin",
        roles: ["ADMIN"],
      },
      { section: "backups" },
    );
    expect(adminSystemWorkspaceMock).toHaveBeenCalledWith(
      { workspace: { brief: { title: "System Brief" } } },
      undefined,
    );
    expect(screen.getByTestId("admin-system-workspace")).toBeInTheDocument();
  });

  it("does not load System diagnostics when admin access fails", async () => {
    requireAdminPageAccessMock.mockRejectedValue(new Error("notFound"));

    await expect(AdminSystemPage()).rejects.toThrow("notFound");
    expect(loadAdminSystemWorkspaceMock).not.toHaveBeenCalled();
  });
});
