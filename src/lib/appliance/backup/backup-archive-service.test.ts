import { describe, expect, it, vi } from "vitest";
import type { RoleName } from "@/core/entities/user";
import type {
  BackupRestoreAuditRepository,
  BackupSnapshot,
  BackupSnapshotRepository,
} from "./types";
import { BackupArchiveService } from "./backup-archive-service";
import { BackupArchiveValidator, type ArchiveReader } from "./backup-archive-validator";
import { Sha256ArchiveIntegrityService } from "./backup-archive-integrity";
import {
  BACKUP_ARCHIVE_HASH_ALGORITHM,
  BACKUP_MANIFEST_SCHEMA_VERSION,
  BACKUP_RESTORE_PLAN_VERSION,
  type BackupManifest,
} from "./backup-manifest";
import type { BackupArchiveEntry } from "./backup-archive-paths";

function snapshot(status: BackupSnapshot["status"]): BackupSnapshot {
  return {
    id: "backup_123",
    kind: "manual",
    status,
    archivePath: status === "validated" ? "/tmp/backup.zip" : null,
    archiveHash: null,
    archiveSizeBytes: null,
    manifestSchemaVersion: null,
    appVersion: null,
    createdByUserId: "usr_admin",
    createdAt: "2026-05-02T12:00:00.000Z",
    validatedAt: null,
    failureMessage: null,
  };
}

function manifest(): BackupManifest {
  return {
    schemaVersion: BACKUP_MANIFEST_SCHEMA_VERSION,
    appVersion: "0.1.0",
    createdAt: "2026-05-02T12:00:00.000Z",
    backupId: "backup_123",
    kind: "manual",
    sourceRuntimeProfileId: "test",
    sourceDataRoot: "/tmp/ordo/.data",
    sqlite: {
      pathPolicy: "sqlite_backup_api_snapshot",
      relativePath: "data/local.db",
      quickIntegrityCheck: "ok",
    },
    roots: [
      { name: "local.db", relativePath: "data/local.db", optional: false, empty: false },
      { name: "blog-assets", relativePath: "data/blog-assets/", optional: true, empty: true },
      { name: "user-files", relativePath: "data/user-files/", optional: true, empty: true },
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
      warnings: [],
      requiresRestorePlanVersion: BACKUP_RESTORE_PLAN_VERSION,
    },
  };
}

class Reader implements ArchiveReader {
  constructor(
    private readonly entries: BackupArchiveEntry[],
    private readonly payload: unknown,
  ) {}

  async getEntries(): Promise<BackupArchiveEntry[]> {
    return this.entries;
  }

  async readManifest(): Promise<unknown | null> {
    return this.payload;
  }
}

function createRepos() {
  const snapshots: BackupSnapshotRepository = {
    createPending: vi.fn(),
    findById: vi.fn(),
    markValidating: vi.fn(async () => snapshot("validating")),
    markValidated: vi.fn(async (input) => ({
      ...snapshot("validated"),
      archivePath: input.archivePath,
      archiveHash: input.archiveHash,
      archiveSizeBytes: input.archiveSizeBytes,
      manifestSchemaVersion: input.manifestSchemaVersion,
      appVersion: input.appVersion,
      validatedAt: "2026-05-02T12:01:00.000Z",
    })),
    markSucceeded: vi.fn(async (input) => ({
      ...snapshot("succeeded"),
      archivePath: input.archivePath,
      archiveHash: input.archiveHash,
      archiveSizeBytes: input.archiveSizeBytes,
      manifestSchemaVersion: input.manifestSchemaVersion,
      appVersion: input.appVersion,
      validatedAt: "2026-05-02T12:01:00.000Z",
    })),
    markFailed: vi.fn(async (input) => ({
      ...snapshot("failed"),
      failureMessage: input.failureMessage,
    })),
    markDeleted: vi.fn(async () => snapshot("deleted")),
  };
  const audit: BackupRestoreAuditRepository = {
    append: vi.fn(async (input) => ({
      id: `audit_${input.eventType}`,
      operationId: input.operationId,
      operationKind: input.operationKind,
      eventType: input.eventType,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole as RoleName | null,
      metadata: input.metadata,
      createdAt: "2026-05-02T12:00:00.000Z",
    })),
    findById: vi.fn(),
  };

  return { snapshots, audit };
}

describe("BackupArchiveService", () => {
  it("marks a valid archive as validated and writes audit events", async () => {
    const integrity = new Sha256ArchiveIntegrityService();
    const actualIntegrity = integrity.fromBuffer(Buffer.from("archive"));
    const repos = createRepos();
    const service = new BackupArchiveService({
      validator: new BackupArchiveValidator(integrity),
      snapshots: repos.snapshots,
      audit: repos.audit,
    });

    const result = await service.validateSnapshotArchive({
      snapshotId: "backup_123",
      archivePath: "/tmp/backup.zip",
      actorUserId: "usr_admin",
      actorRole: "ADMIN",
      reader: new Reader([
        { name: "manifest.json", kind: "file" },
        { name: "data/local.db", kind: "file" },
        { name: "data/blog-assets/", kind: "directory" },
        { name: "data/user-files/", kind: "directory" },
      ], manifest()),
      actualIntegrity,
      expectedIntegrity: actualIntegrity,
    });

    expect(result.validation.valid).toBe(true);
    expect(result.snapshot.status).toBe("validated");
    expect(repos.snapshots.markValidating).toHaveBeenCalledWith("backup_123");
    expect(repos.snapshots.markValidated).toHaveBeenCalledWith(expect.objectContaining({
      id: "backup_123",
      archiveHash: actualIntegrity.hash,
      archiveSizeBytes: actualIntegrity.sizeBytes,
      manifestSchemaVersion: "1",
      appVersion: "0.1.0",
    }));
    expect(repos.audit.append).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "backup_archive_validation_started",
    }));
    expect(repos.audit.append).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "backup_archive_validation_succeeded",
    }));
  });

  it("marks invalid archives failed and does not mark them successful", async () => {
    const integrity = new Sha256ArchiveIntegrityService();
    const actualIntegrity = integrity.fromBuffer(Buffer.from("archive"));
    const repos = createRepos();
    const service = new BackupArchiveService({
      validator: new BackupArchiveValidator(integrity),
      snapshots: repos.snapshots,
      audit: repos.audit,
    });

    const result = await service.validateSnapshotArchive({
      snapshotId: "backup_123",
      archivePath: "/tmp/backup.zip",
      actorUserId: "usr_admin",
      actorRole: "ADMIN",
      reader: new Reader([
        { name: "data/../local.db", kind: "file" },
      ], manifest()),
      actualIntegrity,
    });

    expect(result.validation.valid).toBe(false);
    expect(result.snapshot.status).toBe("failed");
    expect(repos.snapshots.markFailed).toHaveBeenCalledWith(expect.objectContaining({
      id: "backup_123",
    }));
    expect(repos.snapshots.markValidated).not.toHaveBeenCalled();
    expect(repos.snapshots.markSucceeded).not.toHaveBeenCalled();
    expect(repos.audit.append).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "backup_archive_validation_failed",
    }));
  });
});
