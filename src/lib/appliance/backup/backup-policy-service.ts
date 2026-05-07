import {
  assertAdminRole,
  assertBackupInterval,
  assertRetentionCount,
} from "./backup-command-validation";
import {
  addBackupInterval,
  normalizeBackupPolicySchedule,
} from "./backup-schedule-time";
import type {
  BackupCommandRequester,
  BackupInterval,
  BackupPolicy,
  BackupPolicyRepository,
  BackupRestoreAuditRepository,
} from "./types";

export interface BackupPolicyUpdateInput {
  enabled: boolean;
  interval: BackupInterval;
  retentionCount: number;
}

export class BackupPolicyService {
  constructor(private readonly deps: {
    policy: BackupPolicyRepository;
    audit: BackupRestoreAuditRepository;
    now?: () => Date;
  }) {}

  async getPolicy(): Promise<BackupPolicy> {
    return this.deps.policy.getOrCreateDefaultPolicy();
  }

  async updatePolicy(input: BackupPolicyUpdateInput, requester: BackupCommandRequester): Promise<BackupPolicy> {
    assertAdminRole(requester.role);
    assertBackupInterval(input.interval);
    assertRetentionCount(input.retentionCount);

    const current = await this.deps.policy.getOrCreateDefaultPolicy();
    const normalized = normalizeBackupPolicySchedule({
      enabled: input.enabled,
      interval: input.interval,
    });
    const now = this.getNow();
    const nextScheduledAt = normalized.enabled
      ? addBackupInterval(now, normalized.interval)?.toISOString() ?? null
      : null;

    const updated = await this.deps.policy.updateDefaultPolicy({
      enabled: normalized.enabled,
      interval: normalized.interval,
      retentionCount: input.retentionCount,
      latestSuccessfulBackupId: current.latestSuccessfulBackupId,
      lastScheduledAt: current.lastScheduledAt,
      nextScheduledAt,
      updatedByUserId: requester.userId,
    });

    await this.deps.audit.append({
      operationId: updated.id,
      operationKind: "policy",
      eventType: "backup_policy_updated",
      actorUserId: requester.userId,
      actorRole: requester.role,
      metadata: {
        requestedFrom: requester.requestedFrom,
        before: {
          enabled: current.enabled,
          interval: current.interval,
          retentionCount: current.retentionCount,
          nextScheduledAt: current.nextScheduledAt,
        },
        after: {
          enabled: updated.enabled,
          interval: updated.interval,
          retentionCount: updated.retentionCount,
          nextScheduledAt: updated.nextScheduledAt,
        },
      },
    });

    return updated;
  }

  private getNow(): Date {
    return this.deps.now ? this.deps.now() : new Date();
  }
}
