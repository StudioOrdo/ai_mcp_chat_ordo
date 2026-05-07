import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminPageAccessMock,
  getDashboardMock,
} = vi.hoisted(() => ({
  requireAdminPageAccessMock: vi.fn(),
  getDashboardMock: vi.fn(),
}));

vi.mock("@/lib/journal/admin-journal", () => ({
  requireAdminPageAccess: requireAdminPageAccessMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getBackupSelfService: () => ({
    getDashboard: getDashboardMock,
  }),
}));

vi.mock("./BackupSelfServiceManager", () => ({
  BackupSelfServiceManager: ({ dashboard }: { dashboard: { executor: { summary: string } } }) => (
    <div>{dashboard.executor.summary}</div>
  ),
}));

import AdminSystemBackupsPage from "./page";

describe("/admin/system/backups page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPageAccessMock.mockResolvedValue({ id: "usr_admin" });
    getDashboardMock.mockResolvedValue({
      executor: { summary: "Backup executor is configured and idle." },
    });
  });

  it("requires admin access and renders backup dashboard state", async () => {
    render(await AdminSystemBackupsPage());

    expect(requireAdminPageAccessMock).toHaveBeenCalled();
    expect(screen.getByText("Backup executor is configured and idle.")).toBeInTheDocument();
  });
});
