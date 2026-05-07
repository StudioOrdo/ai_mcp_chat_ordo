import {
  getBackupFreshnessGraceMs,
  intervalToMs,
  isBackupPolicySchedulingEnabled,
} from "./backup-schedule-time";
import type {
  BackupPolicy,
  BackupPolicyRepository,
  BackupSnapshot,
  BackupSnapshotQuery,
  SystemCommand,
  SystemCommandQuery,
} from "./types";

export type BackupPolicyHealthStatus = "healthy" | "degraded" | "blocked" | "disabled";

export interface BackupHealthProjection {
  status: BackupPolicyHealthStatus;
  summary: string;
  policy: BackupPolicy;
  latestSuccessfulBackup: BackupSnapshot | null;
  latestAttempt: BackupSnapshot | null;
  latestScheduledCommand: SystemCommand | null;
  latestAttemptStatus: "never" | "succeeded" | "failed" | "running";
  nextScheduledAt: string | null;
  overdue: boolean;
  retentionCount: number;
  validatedBackupCount: number;
  lastFailureMessage: string | null;
  warnings: string[];
}

export async function createBackupHealthProjection(input: {
  policy: BackupPolicyRepository;
  snapshots: BackupSnapshotQuery;
  commands: SystemCommandQuery;
  now?: Date;
}): Promise<BackupHealthProjection> {
  const now = input.now ?? new Date();
  const [policy, latestSuccessfulBackup, latestAttempt, latestScheduledCommand, validatedBackupCount] = await Promise.all([
    input.policy.getOrCreateDefaultPolicy(),
    input.snapshots.findLatestSuccessful(),
    input.snapshots.findLatestAttempt(),
    input.commands.findLatestScheduledCommand(),
    input.snapshots.countSucceededSnapshots(),
  ]);
  const schedulingEnabled = isBackupPolicySchedulingEnabled(policy);
  const latestAttemptStatus = getLatestAttemptStatus(latestScheduledCommand, latestAttempt);
  const lastFailureMessage = latestScheduledCommand?.status === "failed"
    ? latestScheduledCommand.errorMessage
    : latestAttempt?.status === "failed"
      ? latestAttempt.failureMessage
      : null;
  const overdue = schedulingEnabled
    ? isOverdue({ policy, latestSuccessfulBackup, now })
    : false;
  const warnings: string[] = [];

  if (lastFailureMessage) {
    warnings.push(lastFailureMessage);
  }
  if (overdue) {
    warnings.push("Automatic backup is overdue.");
  }

  if (!schedulingEnabled) {
    return {
      status: "healthy",
      summary: "Automatic backups are disabled; manual backup remains available.",
      policy,
      latestSuccessfulBackup,
      latestAttempt,
      latestScheduledCommand,
      latestAttemptStatus,
      nextScheduledAt: null,
      overdue: false,
      retentionCount: policy.retentionCount,
      validatedBackupCount,
      lastFailureMessage,
      warnings,
    };
  }

  if (latestScheduledCommand?.status === "failed" || latestAttemptStatus === "failed" || overdue) {
    return {
      status: "degraded",
      summary: overdue
        ? "Automatic backup is overdue."
        : "Latest automatic backup attempt failed.",
      policy,
      latestSuccessfulBackup,
      latestAttempt,
      latestScheduledCommand,
      latestAttemptStatus,
      nextScheduledAt: policy.nextScheduledAt,
      overdue,
      retentionCount: policy.retentionCount,
      validatedBackupCount,
      lastFailureMessage,
      warnings,
    };
  }

  return {
    status: "healthy",
    summary: latestSuccessfulBackup
      ? "Automatic backup policy is healthy."
      : "Automatic backup policy is enabled and waiting for its first due window.",
    policy,
    latestSuccessfulBackup,
    latestAttempt,
    latestScheduledCommand,
    latestAttemptStatus,
    nextScheduledAt: policy.nextScheduledAt,
    overdue,
    retentionCount: policy.retentionCount,
    validatedBackupCount,
    lastFailureMessage,
    warnings,
  };
}

function getLatestAttemptStatus(
  latestScheduledCommand: SystemCommand | null,
  latestAttempt: BackupSnapshot | null,
): BackupHealthProjection["latestAttemptStatus"] {
  if (latestScheduledCommand?.status === "running" || latestScheduledCommand?.status === "pending") {
    return "running";
  }
  if (latestScheduledCommand?.status === "failed") {
    return "failed";
  }
  if (latestScheduledCommand?.status === "succeeded") {
    return "succeeded";
  }
  if (!latestAttempt) {
    return "never";
  }
  if (latestAttempt.status === "failed") {
    return "failed";
  }
  if (latestAttempt.status === "succeeded" || latestAttempt.status === "validated") {
    return "succeeded";
  }
  if (latestAttempt.status === "pending" || latestAttempt.status === "validating") {
    return "running";
  }
  return "never";
}

function isOverdue(input: {
  policy: BackupPolicy;
  latestSuccessfulBackup: BackupSnapshot | null;
  now: Date;
}): boolean {
  const intervalMs = intervalToMs(input.policy.interval);
  if (intervalMs === null) {
    return false;
  }
  const graceMs = getBackupFreshnessGraceMs(input.policy.interval);
  if (!input.latestSuccessfulBackup?.validatedAt) {
    const firstDueAt = input.policy.nextScheduledAt ?? input.policy.updatedAt;
    const firstDue = new Date(firstDueAt);
    return !Number.isNaN(firstDue.getTime()) && input.now.getTime() > firstDue.getTime() + graceMs;
  }
  const validatedAt = new Date(input.latestSuccessfulBackup.validatedAt);
  return !Number.isNaN(validatedAt.getTime())
    && input.now.getTime() > validatedAt.getTime() + intervalMs + graceMs;
}
