import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ensureSchema } from "@/lib/db/schema";
import { BackupSnapshotDataMapper } from "@/adapters/BackupSnapshotDataMapper";
import { BackupRestoreAuditDataMapper } from "@/adapters/BackupRestoreAuditDataMapper";
import { BackupSystemCommandDataMapper } from "@/adapters/BackupSystemCommandDataMapper";
import { RestorePlanDataMapper } from "@/adapters/RestorePlanDataMapper";
import { Sha256ArchiveIntegrityService } from "./backup-archive-integrity";
import { BackupArchiveValidator, type ArchiveReader } from "./backup-archive-validator";
import {
  BACKUP_ARCHIVE_HASH_ALGORITHM,
  BACKUP_MANIFEST_SCHEMA_VERSION,
  BACKUP_RESTORE_PLAN_VERSION,
  type BackupManifest,
} from "./backup-manifest";
import { RestorePlanService } from "./restore-plan-service";
import { RestoreConfirmationService } from "./restore-confirmation-service";
import { RestoreCommandService } from "./restore-command-service";

const restoreOperation = {
  operationId: "op_restore",
  stepId: "op_restore:restore.execute",
  actionId: "act_execute",
  operationKind: "restore_execute" as const,
};

const safetyOperation = {
  ...restoreOperation,
  stepId: "op_restore:restore.safety_backup",
  actionId: "act_safety",
};

function validManifest(overrides: Partial<BackupManifest> = {}): BackupManifest {
  return {
    schemaVersion: BACKUP_MANIFEST_SCHEMA_VERSION,
    appVersion: "0.1.0",
    createdAt: "2026-05-02T12:00:00.000Z",
    backupId: "backup_123",
    kind: "manual",
    sourceRuntimeProfileId: "test-runtime",
    sourceDataRoot: "/tmp/source/.data",
    sqlite: {
      pathPolicy: "sqlite_backup_api_snapshot",
      relativePath: "data/local.db",
      quickIntegrityCheck: "ok",
    },
    roots: [
      {
        name: "local.db",
        relativePath: "data/local.db",
        optional: false,
        empty: false,
      },
      {
        name: "blog-assets",
        relativePath: "data/blog-assets/",
        optional: true,
        empty: true,
      },
      {
        name: "user-files",
        relativePath: "data/user-files/",
        optional: true,
        empty: true,
      },
    ],
    exclusions: {
      paths: [".server.lock"],
      symlinks: "rejected",
      runtimeLogs: "excluded",
      existingBackups: "excluded",
    },
    archive: {
      hashAlgorithm: BACKUP_ARCHIVE_HASH_ALGORITHM,
    },
    compatibility: {
      warnings: ["provider keys are external"],
      requiresRestorePlanVersion: BACKUP_RESTORE_PLAN_VERSION,
    },
    ...overrides,
  };
}

class MemoryArchiveReader implements ArchiveReader {
  constructor(private readonly manifest: unknown = validManifest()) {}

  async getEntries() {
    return [
      { name: "manifest.json", kind: "file" as const },
      { name: "data/local.db", kind: "file" as const },
      { name: "data/blog-assets/", kind: "directory" as const },
      { name: "data/user-files/", kind: "directory" as const },
    ];
  }

  async readManifest() {
    return this.manifest;
  }
}

describe("restore safety pipeline", () => {
  let db: Database.Database;
  let tempDir: string;
  let archivePath: string;
  let snapshots: BackupSnapshotDataMapper;
  let plans: RestorePlanDataMapper;
  let audit: BackupRestoreAuditDataMapper;
  let commands: BackupSystemCommandDataMapper;
  let integrity: Sha256ArchiveIntegrityService;
  let validator: BackupArchiveValidator;

  beforeEach(() => {
    db = new Database(":memory:");
    ensureSchema(db);
    tempDir = mkdtempSync(path.join(tmpdir(), "ordo-restore-test-"));
    archivePath = path.join(tempDir, "backup.zip");
    writeFileSync(archivePath, Buffer.from("archive bytes"));
    snapshots = new BackupSnapshotDataMapper(db);
    plans = new RestorePlanDataMapper(db);
    audit = new BackupRestoreAuditDataMapper(db);
    commands = new BackupSystemCommandDataMapper(db);
    integrity = new Sha256ArchiveIntegrityService();
    validator = new BackupArchiveValidator(integrity);
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  async function createValidatedSnapshot() {
    const snapshot = await snapshots.createPending({
      kind: "manual",
      createdByUserId: "usr_admin",
    });
    const archiveIntegrity = await integrity.fromFile(archivePath);
    return snapshots.markValidated({
      id: snapshot.id,
      archivePath,
      archiveHash: archiveIntegrity.hash,
      archiveSizeBytes: archiveIntegrity.sizeBytes,
      manifestSchemaVersion: "1",
      appVersion: "0.1.0",
    });
  }

  function createPlanService(manifest: BackupManifest = validManifest()) {
    return new RestorePlanService({
      snapshots,
      plans,
      audit,
      commands,
      validator,
      integrity,
      createArchiveReader: () => new MemoryArchiveReader({
        ...manifest,
        backupId: manifest.backupId === "backup_123" ? currentSnapshotId : manifest.backupId,
      }),
      getDataBoundary: () => ({
        dataDir: "/app/.data",
        sqlitePath: "/app/.data/local.db",
        sqliteWalPath: "/app/.data/local.db-wal",
        sqliteShmPath: "/app/.data/local.db-shm",
        sqliteInsideDataDir: true,
        defaultSqlitePath: "/app/.data/local.db",
        blogAssetRoot: "/app/.data/blog-assets",
        blogAssetRootInsideDataDir: true,
        userFileRoot: "/app/.data/user-files",
        userFileRootInsideDataDir: true,
        requiredIncludePaths: [],
        defaultExcludePaths: [],
        warnings: ["custom warning"],
      }),
    });
  }

  function createPlanServiceWithReader(reader: ArchiveReader) {
    return new RestorePlanService({
      snapshots,
      plans,
      audit,
      commands,
      validator,
      integrity,
      createArchiveReader: () => reader,
      getDataBoundary: () => ({
        dataDir: "/app/.data",
        sqlitePath: "/app/.data/local.db",
        sqliteWalPath: "/app/.data/local.db-wal",
        sqliteShmPath: "/app/.data/local.db-shm",
        sqliteInsideDataDir: true,
        defaultSqlitePath: "/app/.data/local.db",
        blogAssetRoot: "/app/.data/blog-assets",
        blogAssetRootInsideDataDir: true,
        userFileRoot: "/app/.data/user-files",
        userFileRootInsideDataDir: true,
        requiredIncludePaths: [],
        defaultExcludePaths: [],
        warnings: [],
      }),
    });
  }

  let currentSnapshotId = "";

  async function createPlan() {
    const snapshot = await createValidatedSnapshot();
    currentSnapshotId = snapshot.id;
    return createPlanService().createPlan({
      snapshotId: snapshot.id,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
    });
  }

  it("creates restore plan schema and explicit repository state transitions", async () => {
    const tableNames = db.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'restore_plans'`,
    ).all() as Array<{ name: string }>;
    expect(tableNames.map((row) => row.name)).toEqual(["restore_plans"]);

    const plan = await createPlan();
    expect(plan.status).toBe("confirmation_required");
    expect(plan.confirmationPhrase).toMatch(/^RESTORE restore_/);
    expect(plan.impact.targetDataDir).toBe("/app/.data");
    expect(plan.impact.includedRoots).toEqual(["local.db", "blog-assets", "user-files"]);
    expect(plan.impact.dataBoundaryWarnings).toEqual(["custom warning"]);
    expect(plan.validationWarnings).toEqual(["provider keys are external"]);

    const cancelled = await plans.markCancelled({
      id: plan.id,
      failureMessage: "operator cancelled",
    });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.failureMessage).toBe("operator cancelled");
    await expect(plans.markRunning({
      id: cancelled.id,
      restoreCommandId: "syscmd_123",
    })).rejects.toThrow(/cannot transition/);
  });

  it("rejects missing, incomplete, invalid, or non-admin restore planning", async () => {
    await expect(createPlanService().createPlan({
      snapshotId: "backup_missing",
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
    })).rejects.toThrow(/not found/);

    const pending = await snapshots.createPending({
      kind: "manual",
      createdByUserId: "usr_admin",
    });
    await expect(createPlanService().createPlan({
      snapshotId: pending.id,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
    })).rejects.toThrow(/validated or succeeded/);

    const snapshot = await createValidatedSnapshot();
    currentSnapshotId = snapshot.id;
    db.prepare(`UPDATE backup_snapshots SET archive_hash = NULL WHERE id = ?`).run(snapshot.id);
    await expect(createPlanService().createPlan({
      snapshotId: snapshot.id,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
    })).rejects.toThrow(/complete backup archive metadata/);

    const hashMismatchSnapshot = await createValidatedSnapshot();
    currentSnapshotId = hashMismatchSnapshot.id;
    db.prepare(`UPDATE backup_snapshots SET archive_hash = ? WHERE id = ?`).run(
      "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      hashMismatchSnapshot.id,
    );
    await expect(createPlanService().createPlan({
      snapshotId: hashMismatchSnapshot.id,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
    })).rejects.toThrow(/hash mismatch/);

    const mismatchSnapshot = await createValidatedSnapshot();
    currentSnapshotId = mismatchSnapshot.id;
    await expect(createPlanService(validManifest({
      backupId: "other_backup",
    })).createPlan({
      snapshotId: mismatchSnapshot.id,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
    })).rejects.toThrow(/backupId does not match/);

    const failureAudit = db.prepare(
      `SELECT * FROM backup_restore_audit_events
       WHERE operation_kind = 'restore'
         AND event_type = 'restore_plan_validation_failed'`,
    ).all();
    expect(failureAudit.length).toBeGreaterThanOrEqual(2);

    await expect(createPlanService().createPlan({
      snapshotId: mismatchSnapshot.id,
      requester: {
        userId: "usr_staff",
        role: "STAFF",
        requestedFrom: "test",
      },
    })).rejects.toThrow(/ADMIN/);
  });

  it("rejects restore planning when archive path validation fails", async () => {
    const snapshot = await createValidatedSnapshot();
    currentSnapshotId = snapshot.id;
    await expect(createPlanServiceWithReader({
      async getEntries() {
        return [
          { name: "manifest.json", kind: "file" as const },
          { name: "data/../local.db", kind: "file" as const },
        ];
      },
      async readManifest() {
        return validManifest({ backupId: snapshot.id });
      },
    }).createPlan({
      snapshotId: snapshot.id,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
    })).rejects.toThrow(/unsafe/);
  });

  it("requires exact confirmation and rejects changed snapshot metadata", async () => {
    const plan = await createPlan();
    const confirmation = new RestoreConfirmationService({ plans, snapshots, audit });

    await expect(confirmation.confirmPlan({
      planId: plan.id,
      confirmationPhrase: plan.confirmationPhrase,
      requester: {
        userId: "usr_staff",
        role: "STAFF",
        requestedFrom: "test",
      },
    })).rejects.toThrow(/ADMIN/);

    await expect(confirmation.confirmPlan({
      planId: plan.id,
      confirmationPhrase: "RESTORE wrong",
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
    })).rejects.toThrow(/does not match/);

    db.prepare(`UPDATE backup_snapshots SET archive_hash = ? WHERE id = ?`).run(
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      plan.snapshotId,
    );
    await expect(confirmation.confirmPlan({
      planId: plan.id,
      confirmationPhrase: plan.confirmationPhrase,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
    })).rejects.toThrow(/metadata changed/);
  });

  it("creates idempotent pre-restore backup requirement and links a succeeded snapshot", async () => {
    const plan = await createPlan();
    const confirmed = await new RestoreConfirmationService({ plans, snapshots, audit }).confirmPlan({
      planId: plan.id,
      confirmationPhrase: plan.confirmationPhrase,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
    });
    const service = createPlanService();
    const requested = await service.requestPreRestoreBackup({
      planId: confirmed.id,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
      operation: safetyOperation,
    });
    const retried = await service.requestPreRestoreBackup({
      planId: confirmed.id,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
      operation: safetyOperation,
    });
    expect(retried.preRestoreBackupCommandId).toBe(requested.preRestoreBackupCommandId);

    const safetySnapshot = await snapshots.createPending({
      kind: "pre_restore",
      createdByUserId: "usr_admin",
    });
    const archiveIntegrity = await integrity.fromFile(archivePath);
    await snapshots.markSucceeded({
      id: safetySnapshot.id,
      archivePath,
      archiveHash: archiveIntegrity.hash,
      archiveSizeBytes: archiveIntegrity.sizeBytes,
      manifestSchemaVersion: "1",
      appVersion: "0.1.0",
    });
    const linked = await service.linkPreRestoreBackupSnapshot({
      planId: confirmed.id,
      snapshotId: safetySnapshot.id,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
    });
    expect(linked.preRestoreBackupSnapshotId).toBe(safetySnapshot.id);
  });

  it("authorizes restore command only for confirmed and gated plans", async () => {
    const plan = await createPlan();
    const commandService = new RestoreCommandService({
      plans,
      snapshots,
      commandReader: commands,
      restoreCommands: commands,
      audit,
      getDataBoundary: () => ({
        dataDir: "/app/.data",
        sqlitePath: "/app/.data/local.db",
        sqliteWalPath: "/app/.data/local.db-wal",
        sqliteShmPath: "/app/.data/local.db-shm",
        sqliteInsideDataDir: true,
        defaultSqlitePath: "/app/.data/local.db",
        blogAssetRoot: "/app/.data/blog-assets",
        blogAssetRootInsideDataDir: true,
        userFileRoot: "/app/.data/user-files",
        userFileRootInsideDataDir: true,
        requiredIncludePaths: [],
        defaultExcludePaths: [],
        warnings: [],
      }),
    });

    await expect(commandService.authorizeRestoreCommand({
      planId: plan.id,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
      operation: restoreOperation,
    })).rejects.toThrow(/confirmed/);

    await expect(commandService.authorizeRestoreCommand({
      planId: plan.id,
      requester: {
        userId: "usr_staff",
        role: "STAFF",
        requestedFrom: "test",
      },
      operation: restoreOperation,
    })).rejects.toThrow(/ADMIN/);

    const confirmed = await new RestoreConfirmationService({ plans, snapshots, audit }).confirmPlan({
      planId: plan.id,
      confirmationPhrase: plan.confirmationPhrase,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
    });
    await expect(commandService.authorizeRestoreCommand({
      planId: confirmed.id,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
      operation: restoreOperation,
    })).rejects.toThrow(/pre-restore backup command/);

    const withCommand = await createPlanService().requestPreRestoreBackup({
      planId: confirmed.id,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
      operation: safetyOperation,
    });
    await expect(commandService.authorizeRestoreCommand({
      planId: withCommand.id,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
      operation: restoreOperation,
    })).rejects.toThrow(/has not succeeded/);

    db.prepare(`UPDATE system_commands SET status = 'succeeded' WHERE id = ?`).run(
      withCommand.preRestoreBackupCommandId,
    );
    await expect(commandService.authorizeRestoreCommand({
      planId: withCommand.id,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
      operation: restoreOperation,
    })).rejects.toThrow(/linked pre-restore backup snapshot/);

    const safetySnapshot = await snapshots.createPending({
      kind: "pre_restore",
      createdByUserId: "usr_admin",
    });
    await plans.linkPreRestoreBackupSnapshot({
      id: confirmed.id,
      snapshotId: safetySnapshot.id,
    });
    await expect(commandService.authorizeRestoreCommand({
      planId: withCommand.id,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
      operation: restoreOperation,
    })).rejects.toThrow(/snapshot has not succeeded/);

    const archiveIntegrity = await integrity.fromFile(archivePath);
    await snapshots.markSucceeded({
      id: safetySnapshot.id,
      archivePath,
      archiveHash: archiveIntegrity.hash,
      archiveSizeBytes: archiveIntegrity.sizeBytes,
      manifestSchemaVersion: "1",
      appVersion: "0.1.0",
    });

    const running = await commandService.authorizeRestoreCommand({
      planId: confirmed.id,
      requester: {
        userId: "usr_admin",
        role: "ADMIN",
        requestedFrom: "test",
      },
      operation: restoreOperation,
    });

    expect(running.status).toBe("running");
    expect(running.restoreCommandId).toMatch(/^syscmd_/);
    const command = await commands.findById(running.restoreCommandId ?? "");
    expect(command?.command).toBe("restore.request");
    expect(command?.payload).toMatchObject({
      restorePlanId: confirmed.id,
      snapshotId: confirmed.snapshotId,
      expectedArchiveHash: confirmed.archiveHash,
      restorePlanVersion: "1",
    });
  });

  it("keeps raw generic restore command enqueue blocked", async () => {
    await expect(commands.enqueue({
      target: "rust_daemon",
      command: "restore.request",
      payload: {
        restorePlanId: "restore_123",
        snapshotId: "backup_123",
        archivePath: archivePath,
        expectedArchiveHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        expectedArchiveSizeBytes: 1024,
        manifestSchemaVersion: "1",
        restorePlanVersion: "1",
        requestedAt: "2026-05-02T12:00:00.000Z",
      },
      requestedByUserId: "usr_admin",
      requestedByRole: "ADMIN",
      requestedFrom: "test",
    })).rejects.toThrow(/Phase 04C/);
  });
});
