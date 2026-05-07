import { describe, expect, it, vi } from "vitest";
import { BackupCommandService } from "./backup-command-service";
import type { BackupSnapshotRepository, SystemCommandRepository } from "./types";

describe("BackupCommandService", () => {
  const createPayload = vi.fn((input) => ({
    kind: input.kind,
    requestedAt: "2026-05-02T12:00:00.000Z",
    snapshotId: input.snapshotId,
    dataBoundary: {
      dataDir: "/tmp/ordo/.data",
      sqlitePath: "/tmp/ordo/.data/local.db",
      blogAssetRoot: "/tmp/ordo/.data/blog-assets",
      userFileRoot: "/tmp/ordo/.data/user-files",
    },
    appVersion: "0.1.0",
    sourceRuntimeProfileId: "test",
    operation: input.operation ?? null,
  }));

  it("creates only admin manual backup commands", async () => {
    const enqueue = vi.fn(async (input) => ({
      id: "syscmd_1",
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
      createdAt: "2026-05-02T12:00:00.000Z",
      updatedAt: "2026-05-02T12:00:00.000Z",
    }));
    const snapshots = {
      createPending: vi.fn(async () => ({
        id: "backup_1",
        kind: "manual",
        status: "pending",
        archivePath: null,
        archiveHash: null,
        archiveSizeBytes: null,
        manifestSchemaVersion: null,
        appVersion: null,
        createdByUserId: "usr_admin",
        createdAt: "2026-05-02T12:00:00.000Z",
        validatedAt: null,
        failureMessage: null,
      })),
    } as unknown as BackupSnapshotRepository;
    const service = new BackupCommandService({
      commands: {
      enqueue,
      findById: vi.fn(),
      } as unknown as SystemCommandRepository,
      snapshots,
      createPayload,
    });

    const command = await service.createManualBackupCommand({
      userId: "usr_admin",
      role: "ADMIN",
      requestedFrom: "admin_page",
    }, {
      operationId: "op_backup",
      stepId: "op_backup:backup.create",
      actionId: "act_backup",
      operationKind: "backup_create",
    });

    expect(command.command).toBe("backup.create");
    expect(command.payload.kind).toBe("manual");
    expect(command.payload.snapshotId).toBe("backup_1");
    expect(snapshots.createPending).toHaveBeenCalledWith({
      kind: "manual",
      createdByUserId: "usr_admin",
    });
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      target: "rust_daemon",
      command: "backup.create",
      status: "pending",
      requestedByRole: "ADMIN",
    }));
  });

  it("rejects non-admin manual backup command creation", async () => {
    const service = new BackupCommandService({
      commands: {
        enqueue: vi.fn(),
        findById: vi.fn(),
      } as unknown as SystemCommandRepository,
      snapshots: {
        createPending: vi.fn(),
      } as unknown as BackupSnapshotRepository,
      createPayload,
    });

    await expect(service.createManualBackupCommand({
      userId: "usr_staff",
      role: "STAFF",
      requestedFrom: "chat",
    }, {
      operationId: "op_backup",
      stepId: "op_backup:backup.create",
      actionId: "act_backup",
      operationKind: "backup_create",
    })).rejects.toThrow(/ADMIN/);
  });

  it("rejects manual backup command creation without operation metadata", async () => {
    const service = new BackupCommandService({
      commands: {
        enqueue: vi.fn(),
        findById: vi.fn(),
      } as unknown as SystemCommandRepository,
      snapshots: {
        createPending: vi.fn(),
      } as unknown as BackupSnapshotRepository,
      createPayload,
    });

    await expect(service.createManualBackupCommand({
      userId: "usr_admin",
      role: "ADMIN",
      requestedFrom: "admin_page",
    }, undefined as never)).rejects.toThrow(/operation metadata is required/);
  });

  it("validates restore requests without enqueueing execution", () => {
    const enqueue = vi.fn();
    const service = new BackupCommandService({
      commands: {
      enqueue,
      findById: vi.fn(),
      } as unknown as SystemCommandRepository,
      snapshots: {
        createPending: vi.fn(),
      } as unknown as BackupSnapshotRepository,
      createPayload,
    });

    expect(() => service.validateRestoreRequest({
      restorePlanId: "restore_123",
      snapshotId: "backup_123",
      archivePath: "/tmp/backup.zip",
      expectedArchiveHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expectedArchiveSizeBytes: 1024,
      manifestSchemaVersion: "1",
      restorePlanVersion: "1",
      requestedAt: "2026-05-02T12:00:00.000Z",
      dataBoundary: {
        dataDir: "/tmp/ordo/.data",
        sqlitePath: "/tmp/ordo/.data/local.db",
        blogAssetRoot: "/tmp/ordo/.data/blog-assets",
        userFileRoot: "/tmp/ordo/.data/user-files",
      },
      operation: {
        operationId: "op_restore",
        stepId: "op_restore:restore.execute",
        actionId: "act_execute",
        operationKind: "restore_execute",
      },
    })).not.toThrow();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
