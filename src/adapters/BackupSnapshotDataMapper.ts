import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { assertBackupKind } from "@/lib/appliance/backup/backup-command-validation";
import type {
  BackupKind,
  BackupSnapshot,
  BackupSnapshotQuery,
  BackupSnapshotRepository,
  BackupSnapshotStatus,
} from "@/lib/appliance/backup/types";

type BackupSnapshotRow = {
  id: string;
  kind: BackupKind;
  status: BackupSnapshotStatus;
  archive_path: string | null;
  archive_hash: string | null;
  archive_size_bytes: number | null;
  manifest_schema_version: string | null;
  app_version: string | null;
  created_by_user_id: string | null;
  created_at: string;
  validated_at: string | null;
  failure_message: string | null;
};

function mapSnapshot(row: BackupSnapshotRow): BackupSnapshot {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    archivePath: row.archive_path,
    archiveHash: row.archive_hash,
    archiveSizeBytes: row.archive_size_bytes,
    manifestSchemaVersion: row.manifest_schema_version,
    appVersion: row.app_version,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    validatedAt: row.validated_at,
    failureMessage: row.failure_message,
  };
}

export class BackupSnapshotDataMapper implements BackupSnapshotRepository, BackupSnapshotQuery {
  constructor(private readonly db: Database.Database) {}

  async createPending(input: {
    kind: BackupKind;
    createdByUserId: string | null;
  }): Promise<BackupSnapshot> {
    assertBackupKind(input.kind);
    const id = `backup_${randomUUID()}`;
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO backup_snapshots (
        id, kind, status, created_by_user_id, created_at
      ) VALUES (?, ?, 'pending', ?, ?)`,
    ).run(id, input.kind, input.createdByUserId, now);

    const snapshot = await this.findById(id);
    if (!snapshot) {
      throw new Error(`Failed to read inserted backup snapshot ${id}.`);
    }
    return snapshot;
  }

  async findById(id: string): Promise<BackupSnapshot | null> {
    const row = this.db.prepare(
      `SELECT * FROM backup_snapshots WHERE id = ?`,
    ).get(id) as BackupSnapshotRow | undefined;
    return row ? mapSnapshot(row) : null;
  }

  async listRecent(limit: number, offset = 0): Promise<BackupSnapshot[]> {
    const rows = this.db.prepare(
      `SELECT * FROM backup_snapshots
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    ).all(normalizeLimit(limit), normalizeOffset(offset)) as BackupSnapshotRow[];
    return rows.map(mapSnapshot);
  }

  async findLatestSuccessful(): Promise<BackupSnapshot | null> {
    const row = this.db.prepare(
      `SELECT * FROM backup_snapshots
       WHERE status = 'succeeded'
       ORDER BY validated_at DESC, created_at DESC, id DESC
       LIMIT 1`,
    ).get() as BackupSnapshotRow | undefined;
    return row ? mapSnapshot(row) : null;
  }

  async listPrunableScheduledSnapshots(retentionCount: number): Promise<BackupSnapshot[]> {
    const keep = Number.isSafeInteger(retentionCount) && retentionCount > 0 ? retentionCount : 7;
    const rows = this.db.prepare(
      `SELECT * FROM backup_snapshots
       WHERE kind = 'scheduled'
         AND status = 'succeeded'
         AND archive_path IS NOT NULL
         AND archive_hash IS NOT NULL
         AND archive_size_bytes IS NOT NULL
       ORDER BY validated_at DESC, created_at DESC, id DESC
       LIMIT -1 OFFSET ?`,
    ).all(keep) as BackupSnapshotRow[];
    return rows.map(mapSnapshot);
  }

  async countSucceededSnapshots(): Promise<number> {
    const row = this.db.prepare(
      `SELECT COUNT(*) AS count
       FROM backup_snapshots
       WHERE status = 'succeeded'`,
    ).get() as { count: number };
    return row.count;
  }

  async findLatestAttempt(): Promise<BackupSnapshot | null> {
    const row = this.db.prepare(
      `SELECT * FROM backup_snapshots
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
    ).get() as BackupSnapshotRow | undefined;
    return row ? mapSnapshot(row) : null;
  }

  async markValidating(id: string): Promise<BackupSnapshot> {
    this.db.prepare(
      `UPDATE backup_snapshots
       SET status = 'validating',
           failure_message = NULL
       WHERE id = ?`,
    ).run(id);

    return this.readRequired(id);
  }

  async markValidated(input: {
    id: string;
    archivePath: string;
    archiveHash: string;
    archiveSizeBytes: number;
    manifestSchemaVersion: string;
    appVersion: string;
  }): Promise<BackupSnapshot> {
    return this.markArchiveReady("validated", input);
  }

  async markSucceeded(input: {
    id: string;
    archivePath: string;
    archiveHash: string;
    archiveSizeBytes: number;
    manifestSchemaVersion: string;
    appVersion: string;
  }): Promise<BackupSnapshot> {
    return this.markArchiveReady("succeeded", input);
  }

  async markFailed(input: {
    id: string;
    failureMessage: string;
  }): Promise<BackupSnapshot> {
    const message = input.failureMessage.trim();
    if (!message) {
      throw new Error("Backup snapshot failure message is required.");
    }

    this.db.prepare(
      `UPDATE backup_snapshots
       SET status = 'failed',
           failure_message = ?,
           validated_at = NULL
       WHERE id = ?`,
    ).run(message, input.id);

    return this.readRequired(input.id);
  }

  async markDeleted(id: string): Promise<BackupSnapshot> {
    this.db.prepare(
      `UPDATE backup_snapshots
       SET status = 'deleted',
           archive_path = NULL,
           archive_hash = NULL,
           archive_size_bytes = NULL,
           failure_message = NULL
       WHERE id = ?`,
    ).run(id);

    return this.readRequired(id);
  }

  private async markArchiveReady(
    status: "validated" | "succeeded",
    input: {
      id: string;
      archivePath: string;
      archiveHash: string;
      archiveSizeBytes: number;
      manifestSchemaVersion: string;
      appVersion: string;
    },
  ): Promise<BackupSnapshot> {
    assertArchiveMetadata(input);
    const now = new Date().toISOString();
    this.db.prepare(
      `UPDATE backup_snapshots
       SET status = ?,
           archive_path = ?,
           archive_hash = ?,
           archive_size_bytes = ?,
           manifest_schema_version = ?,
           app_version = ?,
           validated_at = ?,
           failure_message = NULL
       WHERE id = ?`,
    ).run(
      status,
      input.archivePath,
      input.archiveHash,
      input.archiveSizeBytes,
      input.manifestSchemaVersion,
      input.appVersion,
      now,
      input.id,
    );

    return this.readRequired(input.id);
  }

  private async readRequired(id: string): Promise<BackupSnapshot> {
    const snapshot = await this.findById(id);
    if (!snapshot) {
      throw new Error(`Backup snapshot not found: ${id}`);
    }
    return snapshot;
  }
}

function normalizeLimit(limit: number): number {
  return Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 100) : 25;
}

function normalizeOffset(offset: number): number {
  return Number.isSafeInteger(offset) && offset > 0 ? offset : 0;
}

function assertArchiveMetadata(input: {
  archivePath: string;
  archiveHash: string;
  archiveSizeBytes: number;
  manifestSchemaVersion: string;
  appVersion: string;
}): void {
  if (!input.archivePath.trim()) {
    throw new Error("Backup snapshot archive path is required.");
  }
  if (!/^sha256:[a-f0-9]{64}$/i.test(input.archiveHash)) {
    throw new Error("Backup snapshot archive hash must be a sha256 digest.");
  }
  if (!Number.isSafeInteger(input.archiveSizeBytes) || input.archiveSizeBytes <= 0) {
    throw new Error("Backup snapshot archive size must be a positive integer.");
  }
  if (!input.manifestSchemaVersion.trim()) {
    throw new Error("Backup snapshot manifest schema version is required.");
  }
  if (!input.appVersion.trim()) {
    throw new Error("Backup snapshot app version is required.");
  }
}
