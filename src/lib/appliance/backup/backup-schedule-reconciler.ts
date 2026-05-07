import type {
  BackupPolicyRepository,
  BackupRestoreAuditRepository,
  BackupSnapshotQuery,
  BackupSnapshotRepository,
  SystemCommandQuery,
} from "./types";
import { BackupRetentionService, type BackupRetentionResult } from "./backup-retention-service";

export interface BackupScheduleReconcileResult {
  promotedSnapshotId: string | null;
  retention: BackupRetentionResult | null;
}

export class BackupScheduleReconciler {
  constructor(private readonly deps: {
    policy: BackupPolicyRepository;
    commands: SystemCommandQuery;
    snapshots: BackupSnapshotRepository & BackupSnapshotQuery;
    audit: BackupRestoreAuditRepository;
    retention: BackupRetentionService;
  }) {}

  async reconcile(): Promise<BackupScheduleReconcileResult> {
    const policy = await this.deps.policy.getOrCreateDefaultPolicy();
    const commands = await this.deps.commands.listSucceededScheduledBackupCommands(25);
    let promotedSnapshotId: string | null = null;
    let retention: BackupRetentionResult | null = null;

    for (const command of commands) {
      const snapshotId = typeof command.payload.snapshotId === "string"
        ? command.payload.snapshotId
        : typeof command.resultPayload?.snapshotId === "string"
          ? command.resultPayload.snapshotId
          : null;
      if (!snapshotId || snapshotId === policy.latestSuccessfulBackupId) {
        continue;
      }

      const snapshot = await this.deps.snapshots.findById(snapshotId);
      if (
        !snapshot
        || snapshot.kind !== "scheduled"
        || snapshot.status !== "succeeded"
        || !snapshot.archivePath
        || !snapshot.archiveHash
        || !snapshot.archiveSizeBytes
      ) {
        continue;
      }

      const latestSuccessful = await this.deps.snapshots.findLatestSuccessful();
      if (
        latestSuccessful
        && latestSuccessful.id !== snapshot.id
        && policy.latestSuccessfulBackupId === latestSuccessful.id
      ) {
        continue;
      }
      const latestId = latestSuccessful?.id ?? snapshot.id;
      const updated = await this.deps.policy.updateDefaultPolicy({
        enabled: policy.enabled,
        interval: policy.interval,
        retentionCount: policy.retentionCount,
        latestSuccessfulBackupId: latestId,
        lastScheduledAt: policy.lastScheduledAt,
        nextScheduledAt: policy.nextScheduledAt,
        updatedByUserId: policy.updatedByUserId,
      });

      await this.deps.audit.append({
        operationId: snapshot.id,
        operationKind: "backup",
        eventType: "scheduled_backup_reconciled",
        actorUserId: null,
        actorRole: null,
        metadata: {
          commandId: command.id,
          latestSuccessfulBackupId: updated.latestSuccessfulBackupId,
        },
      });

      promotedSnapshotId = updated.latestSuccessfulBackupId;
      retention = await this.deps.retention.pruneAfterValidatedBackup({
        snapshotId: snapshot.id,
        retentionCount: updated.retentionCount,
        latestSuccessfulBackupId: updated.latestSuccessfulBackupId,
      });
      break;
    }

    return { promotedSnapshotId, retention };
  }
}
