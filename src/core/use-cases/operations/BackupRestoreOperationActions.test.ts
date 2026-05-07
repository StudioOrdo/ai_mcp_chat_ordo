import { describe, expect, it } from "vitest";

import {
  backupRestoreStepId,
  backupRestoreStepKindForAction,
  createBackupCreateAction,
  createRestoreConfirmAction,
  createRestoreExecuteAction,
  createRestorePrepareAction,
  createRestoreSafetyBackupAction,
  restoreExecuteConfirmationText,
} from "@/core/use-cases/operations/BackupRestoreOperationActions";

function idFactory(prefix: string): string {
  return `${prefix}_1`;
}

describe("BackupRestoreOperationActions", () => {
  it("maps action types to durable step kinds explicitly", () => {
    expect(backupRestoreStepKindForAction("restore.create_safety_backup")).toBe("restore.safety_backup");
    expect(backupRestoreStepKindForAction("restore.execute")).toBe("restore.execute");
    expect(backupRestoreStepId("op_1", "restore.safety_backup")).toBe("op_1:restore.safety_backup");
  });

  it("creates an enabled backup create action when no gate blocks it", () => {
    expect(createBackupCreateAction({
      operationId: "op_backup",
      operationRevision: 1,
      idFactory,
    })).toMatchObject({
      actionType: "backup.create",
      label: "Create backup",
      enabled: true,
      disabledReason: null,
      confirmPolicy: "single_click",
      payloadSchemaKey: "backup.create",
      payload: {},
    });
  });

  it("creates a blocked backup action with a clear disabled reason", () => {
    expect(createBackupCreateAction({
      operationId: "op_backup",
      operationRevision: 1,
      idFactory,
      disabledReason: "Backup executor is unavailable.",
    })).toMatchObject({
      enabled: false,
      disabledReason: "Backup executor is unavailable.",
    });
  });

  it("creates restore prepare as a single-click plan creation action", () => {
    expect(createRestorePrepareAction({
      operationId: "op_restore",
      operationRevision: 1,
      idFactory,
      snapshotId: "backup_1",
    })).toMatchObject({
      actionType: "restore.prepare",
      confirmPolicy: "single_click",
      payload: { snapshotId: "backup_1" },
      confirmationText: null,
    });
  });

  it("creates phrase-gated restore actions after a plan exists", () => {
    const confirm = createRestoreConfirmAction({
      operationId: "op_restore",
      operationRevision: 2,
      idFactory,
      restorePlanId: "restore_1234567890abcdef",
      confirmationText: "RESTORE restore_1234567890abcdef",
    });
    const execute = createRestoreExecuteAction({
      operationId: "op_restore",
      operationRevision: 5,
      idFactory,
      restorePlanId: "restore_1234567890abcdef",
    });

    expect(confirm).toMatchObject({
      actionType: "restore.confirm",
      confirmPolicy: "phrase",
      payloadSchemaKey: "restore.confirm",
      confirmationText: "RESTORE restore_1234567890abcdef",
    });
    expect(execute).toMatchObject({
      actionType: "restore.execute",
      confirmPolicy: "phrase",
      payloadSchemaKey: "restore.execute",
      confirmationText: "EXECUTE restore_12345678",
    });
    expect(restoreExecuteConfirmationText("restore_1234567890abcdef")).toBe("EXECUTE restore_12345678");
  });

  it("keeps safety backup as a separate user action from the safety step kind", () => {
    expect(createRestoreSafetyBackupAction({
      operationId: "op_restore",
      operationRevision: 4,
      idFactory,
      restorePlanId: "restore_1",
    })).toMatchObject({
      actionType: "restore.create_safety_backup",
      payload: { restorePlanId: "restore_1" },
    });
  });
});
