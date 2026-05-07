import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { OperationDataMapper } from "@/adapters/OperationDataMapper";
import { ensureSchema } from "@/lib/db/schema";
import type { SystemCommand } from "@/lib/appliance/backup/types";
import { createNativeCommandResult } from "./native-command-contract";
import { NativeResultReconciler } from "./native-result-reconciler";

const NOW = "2026-05-03T13:00:00.000Z";
const operation = {
  operationId: "op_backup",
  stepId: "op_backup:backup.create",
  actionId: "act_backup",
  operationKind: "backup_create" as const,
};

function command(overrides: Partial<SystemCommand> = {}): SystemCommand {
  return {
    id: "syscmd_1",
    target: "rust_daemon",
    command: "backup.create",
    status: "succeeded",
    payload: {
      kind: "manual",
      snapshotId: "backup_1",
      operation,
    },
    resultPayload: createNativeCommandResult({
      commandId: "syscmd_1",
      operation,
      status: "succeeded",
      summary: "Backup completed.",
      artifacts: [{
        kind: "backup_archive",
        uri: "backup-snapshot:backup_1",
        label: "Backup snapshot backup_1",
        metadata: { snapshotId: "backup_1", apiKey: "secret" },
      }],
      metrics: { bytesWritten: 100, fileCount: 3 },
    }),
    errorMessage: null,
    requestedByUserId: "usr_admin",
    requestedByRole: "ADMIN",
    requestedFrom: "test",
    leaseOwner: null,
    leaseExpiresAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("NativeResultReconciler", () => {
  let db: Database.Database;
  let operations: OperationDataMapper;

  beforeEach(async () => {
    db = new Database(":memory:");
    ensureSchema(db);
    operations = new OperationDataMapper(db);
    await operations.createOperation({
      id: "op_backup",
      kind: "backup_create",
      title: "Create backup",
      status: "running",
      createdByUserId: "usr_admin",
      createdByRole: "ADMIN",
      now: NOW,
    });
    await operations.upsertStep({
      step: {
        id: "op_backup:backup.create",
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
  });

  it("appends native executor evidence and artifacts exactly once", async () => {
    const reconciler = new NativeResultReconciler({ operations, now: () => NOW });

    const first = await reconciler.reconcile({ command: command(), expectedOperation: operation });
    const second = await reconciler.reconcile({ command: command(), expectedOperation: operation });

    expect(first.eventAppended).toBe(true);
    expect(first.artifactIds).toHaveLength(1);
    expect(second.eventAppended).toBe(false);
    expect(second.artifactIds).toHaveLength(0);

    const snapshot = await operations.findOperationById("op_backup");
    const executorEvents = snapshot?.events.filter((event) => event.type === "executor_event_received") ?? [];
    expect(executorEvents).toHaveLength(1);
    expect(executorEvents[0]?.payload).toMatchObject({
      commandId: "syscmd_1",
      nativeStatus: "succeeded",
      metrics: { bytesWritten: 100, fileCount: 3 },
    });
    expect(JSON.stringify(executorEvents[0]?.payload)).not.toContain("secret");
    expect(snapshot?.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "native_backup_archive",
        metadata: expect.objectContaining({
          apiKey: "[redacted]",
          commandId: "syscmd_1",
        }),
      }),
    ]));
  });

  it("rejects command/result mismatches before touching operation state", async () => {
    const reconciler = new NativeResultReconciler({ operations, now: () => NOW });

    await expect(reconciler.reconcile({
      command: command({
        resultPayload: createNativeCommandResult({
          commandId: "other",
          operation,
          status: "succeeded",
          summary: "done",
        }),
      }),
      expectedOperation: operation,
    })).rejects.toThrow(/does not match/);

    await expect(reconciler.reconcile({
      command: command(),
      expectedOperation: { ...operation, actionId: "different" },
    })).rejects.toThrow(/operation metadata/);
  });

  it("skips scheduled operation-null native results without failing", async () => {
    const reconciler = new NativeResultReconciler({ operations, now: () => NOW });

    const reconciliation = await reconciler.reconcile({
      command: command({
        payload: { kind: "scheduled", snapshotId: "backup_1" },
        resultPayload: createNativeCommandResult({
          commandId: "syscmd_1",
          operation: null,
          status: "succeeded",
          summary: "Scheduled backup completed.",
        }),
      }),
      expectedOperation: null,
    });

    expect(reconciliation.skippedReason).toBe("operation_null");
  });
});
