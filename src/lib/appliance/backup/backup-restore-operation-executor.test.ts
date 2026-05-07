import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";

import { OperationDataMapper } from "@/adapters/OperationDataMapper";
import { ensureSchema } from "@/lib/db/schema";
import {
  createBackupCreateAction,
  createRestoreExecuteAction,
} from "@/core/use-cases/operations/BackupRestoreOperationActions";
import { OperationActionDispatchService } from "@/core/use-cases/operations/OperationActionDispatch";
import { BackupRestoreOperationExecutor } from "@/lib/appliance/backup/backup-restore-operation-executor";
import type { BackupSelfService } from "@/lib/appliance/backup/backup-self-service";
import type { SystemCommand } from "@/lib/appliance/backup/types";

const NOW = "2026-05-03T12:00:00.000Z";

function systemCommand(id: string, payload: Record<string, unknown>): SystemCommand {
  return {
    id,
    target: "rust_daemon",
    command: "backup.create",
    status: "pending",
    payload,
    resultPayload: null,
    errorMessage: null,
    requestedByUserId: "usr_admin",
    requestedByRole: "ADMIN",
    requestedFrom: "operation_kernel",
    leaseOwner: null,
    leaseExpiresAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("BackupRestoreOperationExecutor", () => {
  let db: Database.Database;
  let repository: OperationDataMapper;

  beforeEach(() => {
    db = new Database(":memory:");
    ensureSchema(db);
    repository = new OperationDataMapper(db);
  });

  afterEach(() => {
    db.close();
  });

  it("queues backup.create through the operation action dispatch path", async () => {
    const createManualBackup = vi.fn(async (...args: unknown[]) => {
      const operation = args[1] as Record<string, unknown>;
      return {
      status: "queued" as const,
      summary: "Backup has been queued.",
      nextAction: "Refresh backup status.",
      snapshot: {
        id: "backup_1",
        kind: "manual",
        status: "pending",
        archivePath: null,
        archiveHash: null,
        archiveSizeBytes: null,
        manifestSchemaVersion: null,
        appVersion: null,
        createdByUserId: "usr_admin",
        createdAt: NOW,
        validatedAt: null,
        failureMessage: null,
      },
      command: systemCommand("syscmd_1", {
        snapshotId: "backup_1",
        operation,
      }),
      executor: {
        status: "healthy",
        summary: "Executor ready.",
        executorDisabled: false,
        executorAvailable: true,
        executorPath: "/tmp/ordo-backup",
        canEnqueueExecution: true,
        warnings: [],
      },
      warnings: [],
      };
    });
    const service = {
      createManualBackup,
    } as unknown as BackupSelfService;

    const created = await repository.createOperation({
      id: "op_backup",
      kind: "backup_create",
      title: "Create backup",
      status: "draft",
      createdByUserId: "usr_admin",
      createdByRole: "ADMIN",
      now: NOW,
    });
    const action = createBackupCreateAction({
      operationId: created.operation.id,
      operationRevision: created.operation.revision,
      idFactory: (prefix) => `${prefix}_1`,
    });
    await repository.replaceActions({ operationId: created.operation.id, actions: [action], now: NOW });

    const dispatch = new OperationActionDispatchService({
      repository,
      executors: [new BackupRestoreOperationExecutor({ backupSelfService: service })],
    });

    const result = await dispatch.dispatch({
      operationId: "op_backup",
      actionId: action.id,
      idempotencyKey: action.idempotencyKey,
      clientOperationRevision: action.operationRevision,
      actorUserId: "usr_admin",
      actorRole: "ADMIN",
      confirmation: { confirmed: true },
      now: NOW,
    });

    expect(result.snapshot.operation.status).toBe("queued");
    expect(result.snapshot.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "backup.create",
        status: "running",
        systemCommandId: "syscmd_1",
        resourceRef: { type: "backup_snapshot", id: "backup_1", uri: "backup-snapshot:backup_1" },
      }),
    ]));
    expect(createManualBackup).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      operationId: "op_backup",
      stepId: "op_backup:backup.create",
      actionId: action.id,
      operationKind: "backup_create",
    }));
  });

  it("blocks restore.execute when the safety backup step has not succeeded", async () => {
    const executeConfirmedRestore = vi.fn();
    const service = {
      executeConfirmedRestore,
    } as unknown as BackupSelfService;
    const created = await repository.createOperation({
      id: "op_restore",
      kind: "restore_execute",
      title: "Restore",
      status: "blocked",
      riskLevel: "destructive",
      createdByUserId: "usr_admin",
      createdByRole: "ADMIN",
      now: NOW,
    });
    const action = createRestoreExecuteAction({
      operationId: created.operation.id,
      operationRevision: created.operation.revision,
      idFactory: (prefix) => `${prefix}_1`,
      restorePlanId: "restore_1",
    });
    await repository.replaceActions({ operationId: created.operation.id, actions: [action], now: NOW });
    const dispatch = new OperationActionDispatchService({
      repository,
      executors: [new BackupRestoreOperationExecutor({ backupSelfService: service })],
    });

    const result = await dispatch.dispatch({
      operationId: "op_restore",
      actionId: action.id,
      idempotencyKey: action.idempotencyKey,
      clientOperationRevision: action.operationRevision,
      actorUserId: "usr_admin",
      actorRole: "ADMIN",
      confirmation: { phrase: action.confirmationText ?? "" },
      now: NOW,
    });

    expect(result.snapshot.operation.status).toBe("blocked");
    expect(executeConfirmedRestore).not.toHaveBeenCalled();
    expect(result.snapshot.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "restore.execute",
        status: "blocked",
        error: expect.objectContaining({
          message: "restore.safety_backup must succeed before this action can run.",
        }),
      }),
    ]));
  });
});
