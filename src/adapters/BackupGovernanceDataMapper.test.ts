import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { ensureSchema } from "@/lib/db/schema";
import { BackupSystemCommandDataMapper } from "./BackupSystemCommandDataMapper";
import { BackupPolicyDataMapper } from "./BackupPolicyDataMapper";
import { BackupSnapshotDataMapper } from "./BackupSnapshotDataMapper";
import { BackupRestoreAuditDataMapper } from "./BackupRestoreAuditDataMapper";
import { RestorePlanDataMapper } from "./RestorePlanDataMapper";

describe("backup governance data mappers", () => {
  let db: Database.Database;
  let commands: BackupSystemCommandDataMapper;
  let policy: BackupPolicyDataMapper;
  let snapshots: BackupSnapshotDataMapper;
  let audit: BackupRestoreAuditDataMapper;
  let plans: RestorePlanDataMapper;

  beforeEach(() => {
    db = new Database(":memory:");
    ensureSchema(db);
    commands = new BackupSystemCommandDataMapper(db);
    policy = new BackupPolicyDataMapper(db);
    snapshots = new BackupSnapshotDataMapper(db);
    audit = new BackupRestoreAuditDataMapper(db);
    plans = new RestorePlanDataMapper(db);
  });

  afterEach(() => {
    db.close();
  });

  function validBackupPayload(overrides: Record<string, unknown> = {}) {
    return {
      kind: "manual",
      requestedAt: "2026-05-02T12:00:00.000Z",
      snapshotId: "backup_123",
      dataBoundary: {
        dataDir: "/tmp/ordo/.data",
        sqlitePath: "/tmp/ordo/.data/local.db",
        blogAssetRoot: "/tmp/ordo/.data/blog-assets",
        userFileRoot: "/tmp/ordo/.data/user-files",
      },
      appVersion: "0.1.0",
      sourceRuntimeProfileId: "test",
      ...overrides,
    };
  }

  it("creates the backup governance schema idempotently", () => {
    ensureSchema(db);
    const tableNames = db.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (
        'system_commands',
        'backup_snapshots',
        'backup_restore_audit_events',
        'backup_policy',
        'restore_plans'
      ) ORDER BY name`,
    ).all() as Array<{ name: string }>;

    expect(tableNames.map((row) => row.name)).toEqual([
      "backup_policy",
      "backup_restore_audit_events",
      "backup_snapshots",
      "restore_plans",
      "system_commands",
    ]);

    const systemCommandColumns = db.pragma("table_info(system_commands)") as Array<{ name: string }>;
    expect(systemCommandColumns.map((column) => column.name)).toEqual(expect.arrayContaining([
      "id",
      "target",
      "command",
      "status",
      "payload_json",
      "result_payload",
      "error_message",
      "requested_by_user_id",
      "requested_by_role",
      "requested_from",
      "lease_owner",
      "lease_expires_at",
      "created_at",
      "updated_at",
    ]));

    const systemCommandIndexes = db.pragma("index_list(system_commands)") as Array<{ name: string }>;
    expect(systemCommandIndexes.map((index) => index.name)).toEqual(expect.arrayContaining([
      "idx_system_commands_target_status_created",
      "idx_system_commands_requested_by_created",
      "idx_system_commands_updated",
    ]));

    const snapshotColumns = db.pragma("table_info(backup_snapshots)") as Array<{ name: string }>;
    expect(snapshotColumns.map((column) => column.name)).toEqual(expect.arrayContaining([
      "id",
      "kind",
      "status",
      "archive_path",
      "archive_hash",
      "archive_size_bytes",
      "manifest_schema_version",
      "app_version",
      "created_by_user_id",
      "created_at",
      "validated_at",
      "failure_message",
    ]));
  });

  it("inserts and reads a manual backup command with requester metadata", async () => {
    const command = await commands.enqueue({
      target: "rust_daemon",
      command: "backup.create",
      payload: validBackupPayload(),
      requestedByUserId: "usr_admin",
      requestedByRole: "ADMIN",
      requestedFrom: "admin_page",
    });

    expect(command.status).toBe("pending");
    expect(command.payload).toEqual(validBackupPayload());
    expect(command.requestedByUserId).toBe("usr_admin");
    expect(command.requestedByRole).toBe("ADMIN");
    expect(command.requestedFrom).toBe("admin_page");
  });

  it("queries operation-backed commands by operation metadata", async () => {
    await commands.enqueue({
      target: "rust_daemon",
      command: "backup.create",
      payload: validBackupPayload({
        snapshotId: "backup_op_1",
        operation: {
          operationId: "op_backup",
          stepId: "op_backup:backup.create",
          actionId: "act_backup",
          operationKind: "backup_create",
        },
      }),
      requestedByUserId: "usr_admin",
      requestedByRole: "ADMIN",
      requestedFrom: "operation_kernel",
    });
    await commands.enqueue({
      target: "rust_daemon",
      command: "backup.create",
      payload: validBackupPayload({ snapshotId: "backup_no_op" }),
      requestedByUserId: "usr_admin",
      requestedByRole: "ADMIN",
      requestedFrom: "admin_page",
    });

    expect(await commands.listRecentOperationBackedCommands(10)).toHaveLength(1);
    expect((await commands.listByOperationId("op_backup", 10))[0]).toMatchObject({
      payload: {
        operation: {
          operationId: "op_backup",
          stepId: "op_backup:backup.create",
          actionId: "act_backup",
          operationKind: "backup_create",
        },
      },
    });
  });

  it("rejects invalid command status, target, and payload", async () => {
    await expect(commands.enqueue({
      target: "unknown" as "rust_daemon",
      command: "backup.create",
      payload: validBackupPayload(),
      requestedByUserId: null,
      requestedByRole: "ADMIN",
      requestedFrom: "test",
    })).rejects.toThrow(/Invalid system command target/);

    await expect(commands.enqueue({
      target: "rust_daemon",
      command: "backup.create",
      status: "complete" as "pending",
      payload: validBackupPayload(),
      requestedByUserId: null,
      requestedByRole: "ADMIN",
      requestedFrom: "test",
    })).rejects.toThrow(/Invalid backup command status/);

    await expect(commands.enqueue({
      target: "rust_daemon",
      command: "backup.create",
      payload: validBackupPayload({ apiKey: "secret" }),
      requestedByUserId: null,
      requestedByRole: "ADMIN",
      requestedFrom: "test",
    })).rejects.toThrow(/secret-like key/);

    await expect(commands.enqueue({
      target: "rust_daemon",
      command: "backup.create",
      payload: validBackupPayload(),
      requestedByUserId: "usr_staff",
      requestedByRole: "STAFF",
      requestedFrom: "admin_page",
    })).rejects.toThrow(/ADMIN requester role/);

    await expect(commands.enqueue({
      target: "rust_daemon",
      command: "backup.create",
      payload: validBackupPayload(),
      requestedByUserId: "usr_admin",
      requestedByRole: "ADMIN",
      requestedFrom: "",
    })).rejects.toThrow(/requestedFrom/);
  });

  it("rejects restore request enqueue until Phase 04C", async () => {
    await expect(commands.enqueue({
      target: "rust_daemon",
      command: "restore.request",
      payload: {
        snapshotId: "backup_123",
        requestedAt: "2026-05-02T12:00:00.000Z",
      },
      requestedByUserId: "usr_admin",
      requestedByRole: "ADMIN",
      requestedFrom: "admin_page",
    })).rejects.toThrow(/Phase 04C/);
  });

  it("initializes and updates the singleton default backup policy", async () => {
    const created = await policy.getOrCreateDefaultPolicy();
    expect(created).toMatchObject({
      id: "default",
      enabled: true,
      interval: "daily",
      retentionCount: 7,
      latestSuccessfulBackupId: null,
    });

    const updated = await policy.updateDefaultPolicy({
      enabled: false,
      interval: "weekly",
      retentionCount: 12,
      updatedByUserId: "usr_admin",
    });

    expect(updated.enabled).toBe(false);
    expect(updated.interval).toBe("weekly");
    expect(updated.retentionCount).toBe(12);
    expect(updated.updatedByUserId).toBe("usr_admin");
  });

  it("rejects invalid policy intervals and retention counts", async () => {
    await expect(policy.updateDefaultPolicy({
      enabled: true,
      interval: "monthly" as "daily",
      retentionCount: 7,
    })).rejects.toThrow(/Invalid backup interval/);

    await expect(policy.updateDefaultPolicy({
      enabled: true,
      interval: "daily",
      retentionCount: 0,
    })).rejects.toThrow(/retention count/);
  });

  it("creates compact snapshot metadata without file inventory", async () => {
    const snapshot = await snapshots.createPending({
      kind: "manual",
      createdByUserId: "usr_admin",
    });

    expect(snapshot.kind).toBe("manual");
    expect(snapshot.status).toBe("pending");
    expect(snapshot.archivePath).toBeNull();
    expect(snapshot.archiveHash).toBeNull();
  });

  it("updates compact snapshot validation metadata without file inventory", async () => {
    const snapshot = await snapshots.createPending({
      kind: "manual",
      createdByUserId: "usr_admin",
    });

    const validating = await snapshots.markValidating(snapshot.id);
    expect(validating.status).toBe("validating");

    const validated = await snapshots.markValidated({
      id: snapshot.id,
      archivePath: "/tmp/backup.zip",
      archiveHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      archiveSizeBytes: 1024,
      manifestSchemaVersion: "1",
      appVersion: "0.1.0",
    });

    expect(validated).toMatchObject({
      status: "validated",
      archivePath: "/tmp/backup.zip",
      archiveHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      archiveSizeBytes: 1024,
      manifestSchemaVersion: "1",
      appVersion: "0.1.0",
      failureMessage: null,
    });
    expect(validated.validatedAt).toBeTruthy();
  });

  it("rejects invalid snapshot archive metadata and records failures", async () => {
    const snapshot = await snapshots.createPending({
      kind: "manual",
      createdByUserId: "usr_admin",
    });

    await expect(snapshots.markValidated({
      id: snapshot.id,
      archivePath: "/tmp/backup.zip",
      archiveHash: "not-a-hash",
      archiveSizeBytes: 1024,
      manifestSchemaVersion: "1",
      appVersion: "0.1.0",
    })).rejects.toThrow(/sha256/);

    await expect(snapshots.markFailed({
      id: snapshot.id,
      failureMessage: "",
    })).rejects.toThrow(/failure message/);

    const failed = await snapshots.markFailed({
      id: snapshot.id,
      failureMessage: "Archive validation failed.",
    });

    expect(failed.status).toBe("failed");
    expect(failed.failureMessage).toBe("Archive validation failed.");
  });

  it("appends audit events with redacted metadata", async () => {
    const event = await audit.append({
      operationId: "backup_123",
      operationKind: "backup",
      eventType: "manual_backup_requested",
      actorUserId: "usr_admin",
      actorRole: "ADMIN",
      metadata: {
        archivePath: "/tmp/backup.zip",
        nested: {
          token: "secret",
        },
      },
    });

    expect(event.metadata).toEqual({
      archivePath: "/tmp/backup.zip",
      nested: {
        token: "[redacted]",
      },
    });
  });

  it("queries recent snapshots, latest successful attempt, commands, plans, and audit events", async () => {
    const pending = await snapshots.createPending({ kind: "manual", createdByUserId: "usr_admin" });
    const succeeded = await snapshots.createPending({ kind: "manual", createdByUserId: "usr_admin" });
    await snapshots.markSucceeded({
      id: succeeded.id,
      archivePath: "/tmp/backup.zip",
      archiveHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      archiveSizeBytes: 2048,
      manifestSchemaVersion: "1",
      appVersion: "0.1.0",
    });

    await commands.enqueue({
      target: "rust_daemon",
      command: "backup.create",
      payload: validBackupPayload({ snapshotId: succeeded.id }),
      requestedByUserId: "usr_admin",
      requestedByRole: "ADMIN",
      requestedFrom: "admin_page",
    });
    await audit.append({
      operationId: succeeded.id,
      operationKind: "backup",
      eventType: "backup_executor_succeeded",
      actorUserId: "usr_admin",
      actorRole: "ADMIN",
      metadata: { snapshotId: succeeded.id },
    });

    const plan = await plans.createDraft({
      snapshotId: succeeded.id,
      archivePath: "/tmp/backup.zip",
      archiveHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      archiveSizeBytes: 2048,
      manifestSchemaVersion: "1",
      appVersion: "0.1.0",
      restorePlanVersion: "1",
      impact: {
        snapshotId: succeeded.id,
        snapshotKind: "manual",
        snapshotCreatedAt: succeeded.createdAt,
        archivePath: "/tmp/backup.zip",
        archiveHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        archiveSizeBytes: 2048,
        manifestSchemaVersion: "1",
        appVersion: "0.1.0",
        sourceRuntimeProfileId: "test",
        sourceDataRoot: "/tmp/ordo/.data",
        targetDataDir: "/tmp/ordo/.data",
        targetSqlitePath: "/tmp/ordo/.data/local.db",
        targetBlogAssetRoot: "/tmp/ordo/.data/blog-assets",
        targetUserFileRoot: "/tmp/ordo/.data/user-files",
        includedRoots: ["data/local.db"],
        manifestWarnings: [],
        dataBoundaryWarnings: [],
        environmentNote: "test",
      },
      validationWarnings: [],
      confirmationPhrase: "RESTORE restore_test",
      createdByUserId: "usr_admin",
    });

    expect((await snapshots.listRecent(10)).map((snapshot) => snapshot.id)).toContain(pending.id);
    expect((await snapshots.findLatestSuccessful())?.id).toBe(succeeded.id);
    expect(await snapshots.findLatestAttempt()).not.toBeNull();
    expect(await commands.countByStatusForRustDaemon()).toMatchObject({ pending: 1 });
    expect((await commands.listBySnapshotId(succeeded.id))).toHaveLength(1);
    expect((await plans.listRecent(10)).map((entry) => entry.id)).toContain(plan.id);
    expect((await plans.findActiveBySnapshotId(succeeded.id))?.id).toBe(plan.id);
    expect((await audit.listByOperationId(succeeded.id))).toHaveLength(1);
  });
});
