import type Database from "better-sqlite3";
import {
  DEFAULT_BACKUP_POLICY_ID,
  createDefaultBackupPolicy,
} from "@/lib/appliance/backup/backup-policy-defaults";
import {
  assertBackupInterval,
  assertRetentionCount,
} from "@/lib/appliance/backup/backup-command-validation";
import type {
  BackupInterval,
  BackupPolicy,
  BackupPolicyRepository,
} from "@/lib/appliance/backup/types";

type BackupPolicyRow = {
  id: "default";
  enabled: 0 | 1;
  interval: BackupInterval;
  retention_count: number;
  latest_successful_backup_id: string | null;
  last_scheduled_at: string | null;
  next_scheduled_at: string | null;
  updated_by_user_id: string | null;
  updated_at: string;
};

function mapPolicy(row: BackupPolicyRow): BackupPolicy {
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

export class BackupPolicyDataMapper implements BackupPolicyRepository {
  constructor(private readonly db: Database.Database) {}

  async getOrCreateDefaultPolicy(): Promise<BackupPolicy> {
    const existing = this.findDefaultPolicy();
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const policy = createDefaultBackupPolicy(now);
    this.db.prepare(
      `INSERT INTO backup_policy (
        id, enabled, interval, retention_count, latest_successful_backup_id,
        last_scheduled_at, next_scheduled_at, updated_by_user_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      policy.id,
      policy.enabled ? 1 : 0,
      policy.interval,
      policy.retentionCount,
      policy.latestSuccessfulBackupId,
      policy.lastScheduledAt,
      policy.nextScheduledAt,
      policy.updatedByUserId,
      policy.updatedAt,
    );

    return policy;
  }

  async updateDefaultPolicy(input: {
    enabled: boolean;
    interval: BackupInterval;
    retentionCount: number;
    latestSuccessfulBackupId?: string | null;
    lastScheduledAt?: string | null;
    nextScheduledAt?: string | null;
    updatedByUserId?: string | null;
  }): Promise<BackupPolicy> {
    assertBackupInterval(input.interval);
    assertRetentionCount(input.retentionCount);
    await this.getOrCreateDefaultPolicy();

    const now = new Date().toISOString();
    this.db.prepare(
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
      input.enabled ? 1 : 0,
      input.interval,
      input.retentionCount,
      input.latestSuccessfulBackupId ?? null,
      input.lastScheduledAt ?? null,
      input.nextScheduledAt ?? null,
      input.updatedByUserId ?? null,
      now,
      DEFAULT_BACKUP_POLICY_ID,
    );

    const updated = this.findDefaultPolicy();
    if (!updated) {
      throw new Error("Failed to read updated backup policy.");
    }
    return updated;
  }

  private findDefaultPolicy(): BackupPolicy | null {
    const row = this.db.prepare(
      `SELECT * FROM backup_policy WHERE id = ?`,
    ).get(DEFAULT_BACKUP_POLICY_ID) as BackupPolicyRow | undefined;
    return row ? mapPolicy(row) : null;
  }
}
