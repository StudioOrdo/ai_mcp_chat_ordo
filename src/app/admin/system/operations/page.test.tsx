import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminPageAccessMock, loadAdminSystemOperationsMock } = vi.hoisted(() => ({
  requireAdminPageAccessMock: vi.fn(),
  loadAdminSystemOperationsMock: vi.fn(),
}));

vi.mock("@/lib/journal/admin-journal", () => ({
  requireAdminPageAccess: requireAdminPageAccessMock,
}));

vi.mock("@/lib/operations/operation-workspace-loader", () => ({
  loadAdminSystemOperations: loadAdminSystemOperationsMock,
}));

import AdminSystemOperationsPage from "./page";

describe("AdminSystemOperationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPageAccessMock.mockResolvedValue({ id: "usr_admin", email: "a@example.com", name: "Admin", roles: ["ADMIN"] });
    loadAdminSystemOperationsMock.mockResolvedValue({
      cards: [],
      totalCount: 0,
      filters: {},
      health: {
        totalActiveOperations: 0,
        activeByStatus: {},
        activeByKind: {},
        failedCount: 0,
        blockedCount: 0,
        oldestActiveOperationAgeMs: null,
        pendingDestructiveActions: 0,
      },
    });
  });

  it("requires admin access and renders system operation health", async () => {
    render(await AdminSystemOperationsPage());

    expect(screen.getByText("System Operations")).toBeInTheDocument();
    expect(screen.getByText("No system operations have been recorded yet.")).toBeInTheDocument();
    expect(requireAdminPageAccessMock).toHaveBeenCalled();
  });
});
