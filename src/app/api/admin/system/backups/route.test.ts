import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminPageAccessMock,
  getBackupDashboardAfterReconciliationMock,
  createAdminBackupOperationMock,
} = vi.hoisted(() => ({
  requireAdminPageAccessMock: vi.fn(),
  getBackupDashboardAfterReconciliationMock: vi.fn(),
  createAdminBackupOperationMock: vi.fn(),
}));

vi.mock("@/lib/journal/admin-journal", () => ({
  requireAdminPageAccess: requireAdminPageAccessMock,
}));

vi.mock("@/lib/appliance/backup/backup-restore-admin-operations", () => ({
  getBackupDashboardAfterReconciliation: getBackupDashboardAfterReconciliationMock,
  createAdminBackupOperation: createAdminBackupOperationMock,
}));

import { GET, POST } from "./route";

describe("/api/admin/system/backups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPageAccessMock.mockResolvedValue({ id: "usr_admin" });
    getBackupDashboardAfterReconciliationMock.mockResolvedValue({ executor: { canEnqueueExecution: true } });
    createAdminBackupOperationMock.mockResolvedValue({ status: "queued", command: { id: "cmd_1" } });
  });

  it("requires admin access before reading backup dashboard", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(requireAdminPageAccessMock).toHaveBeenCalled();
    expect(getBackupDashboardAfterReconciliationMock).toHaveBeenCalled();
  });

  it("creates a manual backup through the operation facade", async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createAdminBackupOperationMock).toHaveBeenCalledWith({ userId: "usr_admin", role: "ADMIN" });
    expect(body.result.status).toBe("queued");
  });

  it("returns conflict when executor is unavailable", async () => {
    createAdminBackupOperationMock.mockRejectedValueOnce(new Error("Backup executor binary is unavailable."));

    const response = await POST();

    expect(response.status).toBe(409);
  });
});
