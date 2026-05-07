import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";

import { OperationDataMapper } from "@/adapters/OperationDataMapper";
import { ensureSchema } from "@/lib/db/schema";
import { backupRestoreStepId } from "@/core/use-cases/operations/BackupRestoreOperationActions";
import type { BackupSnapshot, RestorePlan, SystemCommand } from "@/lib/appliance/backup/types";
import { BackupRestoreOperationReconciler } from "@/lib/appliance/backup/backup-restore-operation-reconciler";
import { createNativeCommandResult } from "@/lib/appliance/native/native-command-contract";

const NOW = "2026-05-03T12:00:00.000Z";

function backupSnapshot(overrides: Partial<BackupSnapshot> = {}): BackupSnapshot {
  return {
    id: "backup_1",
    kind: "manual",
    status: "succeeded",
    archivePath: "/tmp/backup.zip",
    archiveHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    archiveSizeBytes: 1024,
    manifestSchemaVersion: "1",
    appVersion: "0.1.0",
    createdByUserId: "usr_admin",
    createdAt: NOW,
    validatedAt: NOW,
    failureMessage: null,
    ...overrides,
  };
}

function restorePlan(overrides: Partial<RestorePlan> = {}): RestorePlan {
  return {
    id: "restore_1",
    snapshotId: "backup_source",
    status: "confirmed",
    archivePath: "/tmp/source.zip",
    archiveHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    archiveSizeBytes: 2048,
    manifestSchemaVersion: "1",
    appVersion: "0.1.0",
    restorePlanVersion: "1",
    impact: {
      snapshotId: "backup_source",
      snapshotKind: "manual",
      snapshotCreatedAt: NOW,
      archivePath: "/tmp/source.zip",
      archiveHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      archiveSizeBytes: 2048,
      manifestSchemaVersion: "1",
      appVersion: "0.1.0",
      sourceRuntimeProfileId: "test",
      sourceDataRoot: "/tmp/ordo/.data",
      targetDataDir: "/tmp/ordo/.data",
      targetSqlitePath: "/tmp/ordo/.data/local.db",
      targetBlogAssetRoot: "/tmp/ordo/.data/blog-assets",
      targetUserFileRoot: "/tmp/ordo/.data/user-files",
      includedRoots: [],
      manifestWarnings: [],
      dataBoundaryWarnings: [],
      environmentNote: "test",
    },
    validationWarnings: [],
    confirmationPhrase: "RESTORE restore_1",
    preRestoreBackupCommandId: "syscmd_safety",
    preRestoreBackupSnapshotId: null,
    restoreCommandId: null,
    confirmedByUserId: "usr_admin",
    confirmedAt: NOW,
    failureMessage: null,
    createdByUserId: "usr_admin",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function command(overrides: Partial<SystemCommand> = {}): SystemCommand {
  const payload = {
    kind: "manual",
    snapshotId: "backup_1",
    operation: {
      operationId: "op_backup",
      stepId: "op_backup:backup.create",
      actionId: "act_backup",
      operationKind: "backup_create" as const,
    },
  };
  return {
    id: "syscmd_1",
    target: "rust_daemon",
    command: "backup.create",
    status: "succeeded",
    payload,
    resultPayload: createNativeCommandResult({
      commandId: "syscmd_1",
      operation: payload.operation,
      status: "succeeded",
      summary: "Backup completed.",
      artifacts: [{
        kind: "backup_archive",
        uri: "backup-snapshot:backup_1",
        label: "Backup snapshot backup_1",
        metadata: { snapshotId: "backup_1" },
      }],
      metrics: { bytesWritten: 1024, fileCount: 1 },
    }),
    errorMessage: null,
    requestedByUserId: "usr_admin",
    requestedByRole: "ADMIN",
    requestedFrom: "operation_kernel",
    leaseOwner: null,
    leaseExpiresAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("BackupRestoreOperationReconciler", () => {
  let db: Database.Database;
  let operations: OperationDataMapper;

  beforeEach(() => {
    db = new Database(":memory:");
    ensureSchema(db);
    operations = new OperationDataMapper(db);
  });

  afterEach(() => {
    db.close();
  });

  it("marks succeeded backup commands as succeeded operations and attaches artifacts", async () => {
    await operations.createOperation({
      id: "op_backup",
      kind: "backup_create",
      title: "Create backup",
      status: "queued",
      createdByUserId: "usr_admin",
      createdByRole: "ADMIN",
      now: NOW,
    });
    await operations.upsertStep({
      step: {
        id: backupRestoreStepId("op_backup", "backup.create"),
        operationId: "op_backup",
        sequence: 1,
        kind: "backup.create",
        status: "running",
        dependsOnStepIds: [],
        capabilityName: "appliance_backup",
        jobId: null,
        systemCommandId: "syscmd_1",
        resourceRef: null,
        input: {},
        output: null,
        error: null,
        retryCount: 0,
        startedAt: NOW,
        completedAt: null,
      },
      now: NOW,
    });
    const reconciler = new BackupRestoreOperationReconciler({
      operations,
      commands: {
        listRecentOperationBackedCommands: vi.fn(async () => [command()]),
        listByOperationId: vi.fn(async () => [command()]),
      } as never,
      snapshots: {
        findById: vi.fn(async () => backupSnapshot()),
      } as never,
      plans: {} as never,
      now: () => NOW,
    });

    await reconciler.reconcileRecent();
    await reconciler.reconcileRecent();

    const snapshot = await operations.findOperationById("op_backup");
    expect(snapshot?.operation.status).toBe("succeeded");
    expect(snapshot?.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "backup.create", status: "succeeded" }),
    ]));
    expect(snapshot?.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "backup_snapshot" }),
      expect.objectContaining({ kind: "native_backup_archive" }),
    ]));
    expect(snapshot?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "executor_event_received",
        payload: expect.objectContaining({
          commandId: "syscmd_1",
          nativeStatus: "succeeded",
        }),
      }),
    ]));
  });

  it("enables restore.execute only after a succeeded pre-restore backup", async () => {
    await operations.createOperation({
      id: "op_restore",
      kind: "restore_execute",
      title: "Restore",
      status: "queued",
      riskLevel: "destructive",
      createdByUserId: "usr_admin",
      createdByRole: "ADMIN",
      now: NOW,
    });
    const plan = restorePlan();
    const safetySnapshot = backupSnapshot({ id: "backup_safety", kind: "pre_restore" });
    const reconciler = new BackupRestoreOperationReconciler({
      operations,
      commands: {
        listRecentOperationBackedCommands: vi.fn(async () => [command({
          id: "syscmd_safety",
          payload: {
            kind: "pre_restore",
            snapshotId: "backup_safety",
            restorePlanId: plan.id,
            operation: {
              operationId: "op_restore",
              stepId: "op_restore:restore.safety_backup",
              actionId: "act_safety",
              operationKind: "restore_execute",
            },
          },
          resultPayload: createNativeCommandResult({
            commandId: "syscmd_safety",
            operation: {
              operationId: "op_restore",
              stepId: "op_restore:restore.safety_backup",
              actionId: "act_safety",
              operationKind: "restore_execute",
            },
            status: "succeeded",
            summary: "Safety backup completed.",
            artifacts: [{
              kind: "backup_archive",
              uri: "backup-snapshot:backup_safety",
              label: "Backup snapshot backup_safety",
              metadata: { snapshotId: "backup_safety" },
            }],
            metrics: { bytesWritten: 1024, fileCount: 1 },
          }),
        })]),
        listByOperationId: vi.fn(async () => []),
      } as never,
      snapshots: {
        findById: vi.fn(async () => safetySnapshot),
      } as never,
      plans: {
        findById: vi.fn(async () => plan),
        linkPreRestoreBackupSnapshot: vi.fn(async () => ({ ...plan, preRestoreBackupSnapshotId: safetySnapshot.id })),
      } as never,
      now: () => NOW,
    });

    await reconciler.reconcileRecent();

    const snapshot = await operations.findOperationById("op_restore");
    expect(snapshot?.operation.status).toBe("blocked");
    expect(snapshot?.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "restore.safety_backup", status: "succeeded" }),
    ]));
    expect(snapshot?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actionType: "restore.execute",
        enabled: true,
        payload: { restorePlanId: "restore_1" },
      }),
    ]));
  });
});
