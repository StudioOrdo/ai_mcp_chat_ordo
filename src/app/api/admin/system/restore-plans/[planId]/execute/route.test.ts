import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminPageAccessMock,
  dispatchAdminRestorePlanOperationActionMock,
  getBackupDashboardAfterReconciliationMock,
} = vi.hoisted(() => ({
  requireAdminPageAccessMock: vi.fn(),
  dispatchAdminRestorePlanOperationActionMock: vi.fn(),
  getBackupDashboardAfterReconciliationMock: vi.fn(),
}));

vi.mock("@/lib/journal/admin-journal", () => ({
  requireAdminPageAccess: requireAdminPageAccessMock,
}));

vi.mock("@/lib/appliance/backup/backup-restore-admin-operations", () => ({
  dispatchAdminRestorePlanOperationAction: dispatchAdminRestorePlanOperationActionMock,
  getBackupDashboardAfterReconciliation: getBackupDashboardAfterReconciliationMock,
}));

import { POST } from "./route";

describe("/api/admin/system/restore-plans/[planId]/execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPageAccessMock.mockResolvedValue({ id: "usr_admin" });
    dispatchAdminRestorePlanOperationActionMock.mockResolvedValue({ status: "running", command: { id: "cmd_restore" } });
    getBackupDashboardAfterReconciliationMock.mockResolvedValue({});
  });

  it("executes through the operation action dispatch facade", async () => {
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ planId: "restore_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(dispatchAdminRestorePlanOperationActionMock).toHaveBeenCalledWith({
      planId: "restore_1",
      actionType: "restore.execute",
      actor: { userId: "usr_admin", role: "ADMIN" },
    });
    expect(body.result.status).toBe("running");
  });

  it("does not enqueue when executor is unavailable", async () => {
    dispatchAdminRestorePlanOperationActionMock.mockRejectedValueOnce(new Error("Backup executor is disabled."));

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ planId: "restore_1" }),
    });

    expect(response.status).toBe(409);
  });
});
