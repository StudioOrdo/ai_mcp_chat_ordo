import { addBackupInterval, isBackupPolicySchedulingEnabled } from "./backup-schedule-time";
import type {
  BackupPolicy,
  BackupPolicyRepository,
  BackupRestoreAuditRepository,
  RestorePlanQuery,
  SystemCommandQuery,
} from "./types";
import { BackupScheduledCommandService, type ScheduledBackupCommandResult } from "./backup-scheduled-command-service";
import { ResourcePressureError } from "@/lib/appliance/resources/resource-pressure";
import { ResourcePressureService } from "@/lib/appliance/resources/resource-pressure-service";
import { getNativeBinaryStatus } from "@/lib/appliance/native/native-binary-registry";

export type BackupScheduleDecision =
  | { action: "disabled"; policy: BackupPolicy; reason: string }
  | { action: "blocked"; policy: BackupPolicy; reason: string }
  | { action: "not_due"; policy: BackupPolicy; nextScheduledAt: string | null }
  | { action: "enqueue"; policy: BackupPolicy; dueAt: string };

export class BackupScheduleService {
  constructor(private readonly deps: {
    policy: BackupPolicyRepository;
    commands: SystemCommandQuery;
    plans: RestorePlanQuery;
    scheduledCommands: BackupScheduledCommandService;
    audit: BackupRestoreAuditRepository;
    now?: () => Date;
    isExecutorAvailable?: () => boolean;
    resources?: ResourcePressureService;
  }) {}

  async evaluateDueBackup(): Promise<BackupScheduleDecision> {
    const policy = await this.deps.policy.getOrCreateDefaultPolicy();
    if (!isBackupPolicySchedulingEnabled(policy)) {
      return { action: "disabled", policy, reason: "Automatic backups are disabled." };
    }

    if (!this.isExecutorAvailable()) {
      return { action: "blocked", policy, reason: "Backup executor is unavailable." };
    }

    if (await this.deps.commands.hasActiveBackupOrRestoreCommand()) {
      return { action: "blocked", policy, reason: "Backup or restore command is already active." };
    }

    if (await this.deps.plans.hasRestoreInProgressOrArmed()) {
      return { action: "blocked", policy, reason: "Restore plan is armed or running." };
    }

    try {
      await this.resourcePressure().assertCanCreateScheduledBackup();
    } catch (error) {
      if (error instanceof ResourcePressureError) {
        return { action: "blocked", policy, reason: error.message };
      }
      throw error;
    }

    const now = this.getNow();
    const dueAt = policy.nextScheduledAt ?? policy.lastScheduledAt ?? policy.updatedAt;
    const dueDate = new Date(dueAt);
    if (Number.isNaN(dueDate.getTime())) {
      return { action: "enqueue", policy, dueAt: now.toISOString() };
    }

    if (policy.nextScheduledAt === null && policy.lastScheduledAt === null) {
      const firstDue = addBackupInterval(new Date(policy.updatedAt), policy.interval);
      if (firstDue && firstDue.getTime() > now.getTime()) {
        return { action: "not_due", policy, nextScheduledAt: firstDue.toISOString() };
      }
    }

    if (dueDate.getTime() > now.getTime()) {
      return { action: "not_due", policy, nextScheduledAt: dueDate.toISOString() };
    }

    const latestScheduled = await this.deps.commands.findLatestScheduledCommand();
    if (latestScheduled?.status === "failed") {
      const latestCreated = new Date(latestScheduled.createdAt);
      if (!Number.isNaN(latestCreated.getTime()) && latestCreated.getTime() >= dueDate.getTime()) {
        return { action: "blocked", policy, reason: "Latest scheduled backup failed in the current due window." };
      }
    }

    return { action: "enqueue", policy, dueAt: dueDate.toISOString() };
  }

  async runOnce(): Promise<{ decision: BackupScheduleDecision; result: ScheduledBackupCommandResult | null }> {
    const decision = await this.evaluateDueBackup();
    if (decision.action !== "enqueue") {
      return { decision, result: null };
    }

    const result = this.deps.scheduledCommands.enqueueScheduledBackup(decision.policy);
    await this.deps.audit.append({
      operationId: result.snapshot.id,
      operationKind: "backup",
      eventType: "scheduled_backup_enqueued",
      actorUserId: null,
      actorRole: null,
      metadata: {
        commandId: result.command.id,
        dueAt: decision.dueAt,
        nextScheduledAt: result.policy.nextScheduledAt,
      },
    });
    return { decision, result };
  }

  private getNow(): Date {
    return this.deps.now ? this.deps.now() : new Date();
  }

  private isExecutorAvailable(): boolean {
    if (this.deps.isExecutorAvailable) {
      return this.deps.isExecutorAvailable();
    }
    return getNativeBinaryStatus("ordo-backup").available;
  }

  private resourcePressure(): ResourcePressureService {
    return this.deps.resources ?? new ResourcePressureService();
  }
}
