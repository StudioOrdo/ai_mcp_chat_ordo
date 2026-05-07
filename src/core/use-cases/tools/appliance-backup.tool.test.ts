import { describe, expect, it, vi } from "vitest";

import {
  executeApplianceBackupAction,
  parseApplianceBackupInput,
} from "./appliance-backup.tool";

describe("appliance backup tools", () => {
  it("requires ADMIN context", async () => {
    await expect(executeApplianceBackupAction("list_appliance_backups", {}, {
      role: "AUTHENTICATED",
      userId: "usr_1",
    })).rejects.toThrow(/admin-only/i);
  });

  it("does not execute backup mutations through legacy tool actions", async () => {
    const service = {
      createManualBackup: vi.fn(),
    };

    await expect(executeApplianceBackupAction("create_appliance_backup", {}, {
      role: "ADMIN",
      userId: "usr_admin",
    }, service as never)).rejects.toThrow(/operation-backed/);

    expect(service.createManualBackup).not.toHaveBeenCalled();
  });

  it("does not prepare restores through legacy tool actions", async () => {
    const service = {
      createRestorePlan: vi.fn(),
    };

    await expect(executeApplianceBackupAction("prepare_appliance_restore", {
      snapshot_id: "backup_eb0d5a66",
    }, {
      role: "ADMIN",
      userId: "usr_admin",
    }, service as never)).rejects.toThrow(/operation-backed/);

    expect(service.createRestorePlan).not.toHaveBeenCalled();
  });

  it("treats restore ids passed to prepare as restore-plan status lookups", async () => {
    const service = {
      getDashboard: vi.fn(async () => ({
        executor: { warnings: [] },
        recentBackups: [],
        recentRestorePlans: [{
          id: "restore_4bb1532c-edfe-4884-a85e-c59a1f8ef314",
          status: "confirmation_required",
          confirmationPhrase: "RESTORE restore_4bb1532c",
          validationWarnings: [],
        }],
      })),
      createRestorePlan: vi.fn(),
    };

    const result = await executeApplianceBackupAction("prepare_appliance_restore", {
      snapshot_id: "restore_4bb1532c",
    }, {
      role: "ADMIN",
      userId: "usr_admin",
    }, service as never);

    expect(service.createRestorePlan).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "confirmation_required",
      restorePlan: {
        id: "restore_4bb1532c-edfe-4884-a85e-c59a1f8ef314",
      },
      actions: [],
    });
  });

  it("parses restore confirmation inputs", () => {
    expect(parseApplianceBackupInput({
      restore_plan_id: "restore_1",
      confirmation_phrase: "RESTORE restore_1",
    })).toEqual({
      restore_plan_id: "restore_1",
      confirmation_phrase: "RESTORE restore_1",
    });
  });
});
