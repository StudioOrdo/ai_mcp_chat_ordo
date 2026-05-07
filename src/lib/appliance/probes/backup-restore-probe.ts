import { existsSync } from "node:fs";
import { BackupPolicyDataMapper } from "@/adapters/BackupPolicyDataMapper";
import { BackupSnapshotDataMapper } from "@/adapters/BackupSnapshotDataMapper";
import { BackupSystemCommandDataMapper } from "@/adapters/BackupSystemCommandDataMapper";
import { createBackupHealthProjection } from "@/lib/appliance/backup/backup-health-projection";
import { getDb } from "@/lib/db";
import { getNativeBinaryStatus } from "@/lib/appliance/native/native-binary-registry";
import {
  createProbeResult,
  type ApplianceHealthProbe,
} from "@/lib/appliance/health-types";

export function createBackupRestoreProbe(input: {
  env?: Record<string, string | undefined>;
  fileExists?: (filePath: string) => boolean;
  getDatabase?: typeof getDb;
} = {}): ApplianceHealthProbe {
  return {
    component: "backup_restore",
    async run(context) {
      const env = input.env ?? process.env;
      const fileExists = input.fileExists ?? existsSync;
      const executor = getNativeBinaryStatus("ordo-backup", {
        env,
        exists: fileExists,
        executable: fileExists,
      });

      if (executor.disabled) {
        return createProbeResult({
          component: "backup_restore",
          impact: "informational",
          status: "disabled",
          checkedAt: context.generatedAt,
          summary: executor.summary,
          remediation: executor.remediation ?? undefined,
          metadata: {
            executorConfigured: false,
            executorDisabled: true,
            executorPath: executor.path,
          },
        });
      }

      if (!executor.available) {
        return createProbeResult({
          component: "backup_restore",
          impact: "informational",
          status: "degraded",
          checkedAt: context.generatedAt,
          summary: executor.summary,
          remediation: executor.remediation ?? undefined,
          metadata: {
            executorConfigured: true,
            executorDisabled: false,
            executorPath: executor.path,
            executorAvailable: false,
            executorExecutable: executor.executable,
          },
          warnings: [`${executor.summary} Path: ${executor.path}.`],
        });
      }

      const db = (input.getDatabase ?? getDb)();
      const pending = countCommands(db, "pending");
      const running = countCommands(db, "running");
      const failed = countCommands(db, "failed");
      const policyHealth = await createBackupHealthProjection({
        policy: new BackupPolicyDataMapper(db),
        snapshots: new BackupSnapshotDataMapper(db),
        commands: new BackupSystemCommandDataMapper(db),
        now: new Date(context.generatedAt),
      });

      const status = failed > 0 && policyHealth.status === "healthy"
        ? "degraded"
        : policyHealth.status;
      return createProbeResult({
        component: "backup_restore",
        impact: "informational",
        status,
        checkedAt: context.generatedAt,
        summary: policyHealth.status !== "healthy"
          ? policyHealth.summary
          : failed > 0
          ? "Backup executor has failed commands requiring review."
          : running > 0
            ? "Backup executor is processing governed work."
            : "Backup executor is configured and idle.",
        remediation: failed > 0 || policyHealth.status === "degraded" || policyHealth.status === "blocked"
          ? "Review failed rust_daemon system_commands and backup/restore audit events."
          : undefined,
        metadata: {
          executorConfigured: true,
          executorDisabled: false,
          executorPath: executor.path,
          executorAvailable: true,
          executorExecutable: executor.executable,
          pendingCommands: pending,
          runningCommands: running,
          failedCommands: failed,
          policy: {
            enabled: policyHealth.policy.enabled,
            interval: policyHealth.policy.interval,
            retentionCount: policyHealth.policy.retentionCount,
            latestSuccessfulBackupId: policyHealth.policy.latestSuccessfulBackupId,
            lastScheduledAt: policyHealth.policy.lastScheduledAt,
            nextScheduledAt: policyHealth.policy.nextScheduledAt,
          },
          schedulingEnabled: policyHealth.policy.enabled && policyHealth.policy.interval !== "disabled",
          automaticBackupOverdue: policyHealth.overdue,
          latestScheduledAttemptStatus: policyHealth.latestAttemptStatus,
          validatedBackupCount: policyHealth.validatedBackupCount,
          lastFailureMessage: policyHealth.lastFailureMessage,
          latestSuccessfulBackup: policyHealth.latestSuccessfulBackup ? {
            id: policyHealth.latestSuccessfulBackup.id,
            archivePath: policyHealth.latestSuccessfulBackup.archivePath,
            archiveHash: policyHealth.latestSuccessfulBackup.archiveHash,
            archiveSizeBytes: policyHealth.latestSuccessfulBackup.archiveSizeBytes,
            validatedAt: policyHealth.latestSuccessfulBackup.validatedAt,
          } : null,
        },
        warnings: [
          ...(failed > 0 ? [`${failed} backup or restore command(s) failed.`] : []),
          ...policyHealth.warnings,
        ],
      });
    },
  };
}

function countCommands(db: ReturnType<typeof getDb>, status: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) AS count
     FROM system_commands
     WHERE target = 'rust_daemon'
       AND command IN ('backup.create', 'restore.request')
       AND status = ?`,
  ).get(status) as { count: number };
  return row.count;
}
