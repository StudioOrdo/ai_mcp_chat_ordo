import type { BackupPolicy } from "./types";

export const DEFAULT_BACKUP_POLICY_ID = "default";
export const DEFAULT_BACKUP_RETENTION_COUNT = 7;

export function createDefaultBackupPolicy(updatedAt: string): BackupPolicy {
  return {
    id: DEFAULT_BACKUP_POLICY_ID,
    enabled: true,
    interval: "daily",
    retentionCount: DEFAULT_BACKUP_RETENTION_COUNT,
    latestSuccessfulBackupId: null,
    lastScheduledAt: null,
    nextScheduledAt: null,
    updatedByUserId: null,
    updatedAt,
  };
}
