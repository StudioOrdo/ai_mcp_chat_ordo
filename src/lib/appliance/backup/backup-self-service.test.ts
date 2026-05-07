import { describe, expect, it, vi } from "vitest";

import { BackupSelfService } from "./backup-self-service";
import { ResourcePressureService } from "@/lib/appliance/resources/resource-pressure-service";
import { DEFAULT_APPLIANCE_RESOURCE_POLICY } from "@/lib/appliance/resources/appliance-resource-policy";
import type {
  BackupPolicy,
  BackupRestoreAuditQuery,
  BackupRestoreAuditRepository,
  BackupSnapshot,
  BackupSnapshotQuery,
  BackupSnapshotRepository,
  RestorePlanQuery,
  RestorePlanRepository,
  SystemCommand,
  SystemCommandQuery,
  SystemCommandRepository,
  RestoreCommandRepository,
} from "./types";

const requester = { userId: "usr_admin", role: "ADMIN" as const, requestedFrom: "test" };
const operation = {
  operationId: "op_backup",
  stepId: "op_backup:backup.create",
  actionId: "act_backup",
  operationKind: "backup_create" as const,
};

function health(overrides: Record<string, unknown> = {}) {
  return {
    component: "backup_restore" as const,
    status: "healthy" as const,
    impact: "informational" as const,
    checkedAt: "2026-05-02T00:00:00.000Z",
    summary: "Backup executor is configured and idle.",
    remediation: null,
    metadata: {
      executorConfigured: true,
      executorDisabled: false,
      executorAvailable: true,
      executorPath: "/bin/ordo-backup",
      ...overrides,
    },
    warnings: [],
  };
}

function createHarness(options: {
  freeBytes?: number;
} = {}) {
  const snapshots: BackupSnapshot[] = [];
  const commands: SystemCommand[] = [];
  const plans: never[] = [];
  const policy: BackupPolicy = {
    id: "default",
    enabled: false,
    interval: "disabled",
    retentionCount: 7,
    latestSuccessfulBackupId: null,
    lastScheduledAt: null,
    nextScheduledAt: null,
    updatedByUserId: null,
    updatedAt: "2026-05-02T00:00:00.000Z",
  };
  const snapshotRepo: BackupSnapshotRepository & BackupSnapshotQuery = {
    async createPending(input) {
      const snapshot: BackupSnapshot = {
        id: `backup_${snapshots.length + 1}`,
        kind: input.kind,
        status: "pending",
        archivePath: null,
        archiveHash: null,
        archiveSizeBytes: null,
        manifestSchemaVersion: null,
        appVersion: null,
        createdByUserId: input.createdByUserId,
        createdAt: "2026-05-02T00:00:00.000Z",
        validatedAt: null,
        failureMessage: null,
      };
      snapshots.push(snapshot);
      return snapshot;
    },
    async findById(id) { return snapshots.find((snapshot) => snapshot.id === id) ?? null; },
    async markValidating(id) { return (await this.findById(id))!; },
    async markValidated() { throw new Error("not used"); },
    async markSucceeded() { throw new Error("not used"); },
    async markFailed() { throw new Error("not used"); },
    async markDeleted(id) { return (await this.findById(id))!; },
    async listRecent() { return snapshots; },
    async findLatestSuccessful() { return snapshots.find((snapshot) => snapshot.status === "succeeded") ?? null; },
    async findLatestAttempt() { return snapshots.at(-1) ?? null; },
    async listPrunableScheduledSnapshots() { return []; },
    async countSucceededSnapshots() { return snapshots.filter((snapshot) => snapshot.status === "succeeded").length; },
  };
  const commandRepo: SystemCommandRepository & SystemCommandQuery & RestoreCommandRepository = {
    async enqueue(input) {
      const command: SystemCommand = {
        id: `cmd_${commands.length + 1}`,
        target: input.target,
        command: input.command,
        status: input.status ?? "pending",
        payload: input.payload,
        resultPayload: null,
        errorMessage: null,
        requestedByUserId: input.requestedByUserId,
        requestedByRole: input.requestedByRole,
        requestedFrom: input.requestedFrom,
        leaseOwner: null,
        leaseExpiresAt: null,
        createdAt: "2026-05-02T00:00:00.000Z",
        updatedAt: "2026-05-02T00:00:00.000Z",
      };
      commands.push(command);
      return command;
    },
    async enqueueRestoreRequest(input) {
      return this.enqueue({
        target: "rust_daemon",
        command: "restore.request",
        payload: input.payload,
        requestedByUserId: input.requestedByUserId,
        requestedByRole: input.requestedByRole,
        requestedFrom: input.requestedFrom,
      });
    },
    async findById(id) { return commands.find((command) => command.id === id) ?? null; },
    async listRecentBackupRestore() { return commands; },
    async listBySnapshotId(snapshotId) { return commands.filter((command) => command.payload.snapshotId === snapshotId); },
    async listByRestorePlanId(restorePlanId) { return commands.filter((command) => command.payload.restorePlanId === restorePlanId); },
    async listRecentOperationBackedCommands() { return commands.filter((command) => typeof command.payload.operation === "object"); },
    async listByOperationId(operationId) {
      return commands.filter((command) => (
        typeof command.payload.operation === "object"
        && command.payload.operation !== null
        && (command.payload.operation as Record<string, unknown>).operationId === operationId
      ));
    },
    async countByStatusForRustDaemon() { return { pending: commands.filter((command) => command.status === "pending").length }; },
    async hasActiveBackupOrRestoreCommand() { return commands.some((command) => command.status === "pending" || command.status === "running"); },
    async findLatestScheduledCommand() { return commands.find((command) => command.payload.kind === "scheduled") ?? null; },
    async listSucceededScheduledBackupCommands() { return commands.filter((command) => command.status === "succeeded" && command.payload.kind === "scheduled"); },
  };
  const restorePlans = {
    createDraft: vi.fn(),
    findById: vi.fn(),
    markValidated: vi.fn(),
    markConfirmationRequired: vi.fn(),
    markConfirmed: vi.fn(),
    markPreRestoreBackupRequired: vi.fn(),
    linkPreRestoreBackupSnapshot: vi.fn(),
    markRunning: vi.fn(),
    markSucceeded: vi.fn(),
    markFailed: vi.fn(),
    markCancelled: vi.fn(),
    listRecent: vi.fn(async () => plans),
    findActiveBySnapshotId: vi.fn(async () => null),
    hasRestoreInProgressOrArmed: vi.fn(async () => false),
  } as unknown as RestorePlanRepository & RestorePlanQuery;
  const audit = {
    append: vi.fn(),
    findById: vi.fn(),
    listByOperationId: vi.fn(async () => []),
  } as unknown as BackupRestoreAuditRepository & BackupRestoreAuditQuery;
  const service = new BackupSelfService({
    commands: commandRepo,
    snapshots: snapshotRepo,
    plans: restorePlans,
    audit,
    policy: { getOrCreateDefaultPolicy: vi.fn(async () => policy), updateDefaultPolicy: vi.fn(async (input) => ({ ...policy, ...input })) },
    getExecutorHealth: () => health(),
    resources: new ResourcePressureService({
      getPolicy: () => ({
        ...DEFAULT_APPLIANCE_RESOURCE_POLICY,
        dataFreeWarnBytes: 200,
        dataFreeWarnPercent: 20,
        dataFreeBlockBytes: 100,
        dataFreeBlockPercent: 10,
      }),
      getCapacity: async () => ({
        status: "available",
        checkedAt: "2026-05-02T00:00:00.000Z",
        rootPath: "/app/.data",
        totalBytes: 1000,
        freeBytes: options.freeBytes ?? 500,
        usedBytes: 1000 - (options.freeBytes ?? 500),
        percentUsed: ((1000 - (options.freeBytes ?? 500)) / 1000) * 100,
      }),
    }),
  });
  return { service, commands, snapshots };
}

describe("BackupSelfService", () => {
  it("creates a manual backup by enqueueing governed rust_daemon work", async () => {
    const { service, commands, snapshots } = createHarness();

    const result = await service.createManualBackup(requester, operation);

    expect(result.status).toBe("queued");
    expect(snapshots).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      target: "rust_daemon",
      command: "backup.create",
      status: "pending",
    });
    expect(commands[0]?.payload.snapshotId).toBe(snapshots[0]?.id);
  });

  it("refuses new executor work when the Rust executor is disabled", async () => {
    const { service } = createHarness();
    vi.spyOn(service as unknown as { getExecutorState: () => unknown }, "getExecutorState").mockReturnValue({
      status: "disabled",
      summary: "Backup executor is disabled.",
      executorDisabled: true,
      executorAvailable: false,
      executorPath: "/bin/ordo-backup",
      canEnqueueExecution: false,
      warnings: [],
    });

    await expect(service.createManualBackup(requester, operation)).rejects.toThrow(/disabled/);
  });

  it("blocks manual backup before snapshot or command creation when capacity is unsafe", async () => {
    const { service, commands, snapshots } = createHarness({ freeBytes: 50 });

    await expect(service.createManualBackup(requester, operation)).rejects.toMatchObject({
      code: "APPLIANCE_RESOURCE_PRESSURE",
      operation: "manual_backup",
    });
    expect(snapshots).toHaveLength(0);
    expect(commands).toHaveLength(0);
  });

  it("dashboard distinguishes latest success from latest attempt and command counts", async () => {
    const { service } = createHarness();

    const dashboard = await service.getDashboard();

    expect(dashboard.executor.canEnqueueExecution).toBe(true);
    expect(dashboard.commandCounts.pending).toBe(0);
    expect(dashboard.recentBackups).toEqual([]);
  });
});
