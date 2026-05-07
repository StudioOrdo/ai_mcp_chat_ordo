import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { createBackupExecutorPayload } from "./backup-command-payload";
import { addBackupInterval } from "./backup-schedule-time";
import type {
  BackupPolicy,
  BackupSnapshot,
  SystemCommand,
} from "./types";

type SnapshotRow = {
  id: string;
  kind: BackupSnapshot["kind"];
  status: BackupSnapshot["status"];
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

type CommandRow = {
  id: string;
  target: SystemCommand["target"];
  command: SystemCommand["command"];
  status: SystemCommand["status"];
  payload_json: string;
  result_payload: string | null;
  error_message: string | null;
  requested_by_user_id: string | null;
  requested_by_role: SystemCommand["requestedByRole"];
  requested_from: string;
  lease_owner: string | null;
  lease_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export interface ScheduledBackupCommandResult {
  snapshot: BackupSnapshot;
  command: SystemCommand;
  policy: BackupPolicy;
}

export class BackupScheduledCommandService {
  constructor(private readonly deps: {
    db: Database.Database;
    now?: () => Date;
  }) {}

  enqueueScheduledBackup(policy: BackupPolicy): ScheduledBackupCommandResult {
    if (!policy.enabled || policy.interval === "disabled") {
      throw new Error("Automatic backup policy is disabled.");
    }

    const now = this.getNow();
    const next = addBackupInterval(now, policy.interval);
    if (!next) {
      throw new Error("Automatic backup interval is disabled.");
    }

    const run = this.deps.db.transaction(() => {
      const snapshotId = `backup_${randomUUID()}`;
      const commandId = `syscmd_${randomUUID()}`;
      const nowIso = now.toISOString();
      const payload = createBackupExecutorPayload({
        kind: "scheduled",
        snapshotId,
        requestedAt: nowIso,
        operation: null,
      });

      this.deps.db.prepare(
        `INSERT INTO backup_snapshots (
          id, kind, status, created_by_user_id, created_at
        ) VALUES (?, 'scheduled', 'pending', NULL, ?)`,
      ).run(snapshotId, nowIso);

      this.deps.db.prepare(
        `INSERT INTO system_commands (
          id, target, command, status, payload_json, requested_by_user_id,
          requested_by_role, requested_from, created_at, updated_at
        ) VALUES (?, 'rust_daemon', 'backup.create', 'pending', ?, NULL, NULL, 'backup_scheduler', ?, ?)`,
      ).run(commandId, JSON.stringify(payload), nowIso, nowIso);

      this.deps.db.prepare(
        `UPDATE backup_policy
         SET enabled = ?,
             interval = ?,
             retention_count = ?,
             latest_successful_backup_id = ?,
             last_scheduled_at = ?,
             next_scheduled_at = ?,
             updated_by_user_id = ?,
             updated_at = ?
         WHERE id = ?`,
      ).run(
        policy.enabled ? 1 : 0,
        policy.interval,
        policy.retentionCount,
        policy.latestSuccessfulBackupId,
        nowIso,
        next.toISOString(),
        policy.updatedByUserId,
        nowIso,
        policy.id,
      );

      return {
        snapshot: mapSnapshot(this.deps.db.prepare(
          `SELECT * FROM backup_snapshots WHERE id = ?`,
        ).get(snapshotId) as SnapshotRow),
        command: mapCommand(this.deps.db.prepare(
          `SELECT * FROM system_commands WHERE id = ?`,
        ).get(commandId) as CommandRow),
        policy: mapPolicy(this.deps.db.prepare(
          `SELECT * FROM backup_policy WHERE id = ?`,
        ).get(policy.id) as PolicyRow),
      };
    });

    return run();
  }

  private getNow(): Date {
    return this.deps.now ? this.deps.now() : new Date();
  }
}

type PolicyRow = {
  id: "default";
  enabled: 0 | 1;
  interval: BackupPolicy["interval"];
  retention_count: number;
  latest_successful_backup_id: string | null;
  last_scheduled_at: string | null;
  next_scheduled_at: string | null;
  updated_by_user_id: string | null;
  updated_at: string;
};

function mapPolicy(row: PolicyRow): BackupPolicy {
  return {
    id: row.id,
    enabled: row.enabled === 1,
    interval: row.interval,
    retentionCount: row.retention_count,
    latestSuccessfulBackupId: row.latest_successful_backup_id,
    lastScheduledAt: row.last_scheduled_at,
    nextScheduledAt: row.next_scheduled_at,
    updatedByUserId: row.updated_by_user_id,
    updatedAt: row.updated_at,
  };
}

function mapSnapshot(row: SnapshotRow): BackupSnapshot {
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

function mapCommand(row: CommandRow): SystemCommand {
  return {
    id: row.id,
    target: row.target,
    command: row.command,
    status: row.status,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    resultPayload: row.result_payload ? JSON.parse(row.result_payload) as Record<string, unknown> : null,
    errorMessage: row.error_message,
    requestedByUserId: row.requested_by_user_id,
    requestedByRole: row.requested_by_role,
    requestedFrom: row.requested_from,
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
