import { BackupArchiveService } from "./backup-archive-service";
import { Sha256ArchiveIntegrityService } from "./backup-archive-integrity";
import { ZipBackupArchiveReader } from "./backup-zip-archive-reader";
import { BackupArchiveValidator } from "./backup-archive-validator";
import { BackupCommandService } from "./backup-command-service";
import { RestoreCommandService } from "./restore-command-service";
import { RestoreConfirmationService } from "./restore-confirmation-service";
import { RestorePlanService } from "./restore-plan-service";
import { BackupPolicyService, type BackupPolicyUpdateInput } from "./backup-policy-service";
import {
  createBackupHealthProjection,
  type BackupHealthProjection,
} from "./backup-health-projection";
import type {
  BackupCommandRequester,
  OperationCommandMetadata,
  BackupPolicyRepository,
  BackupRestoreAuditQuery,
  BackupRestoreAuditRepository,
  BackupSnapshot,
  BackupSnapshotQuery,
  BackupSnapshotRepository,
  RestorePlan,
  RestorePlanQuery,
  RestorePlanRepository,
  SystemCommand,
  SystemCommandQuery,
  SystemCommandRepository,
  RestoreCommandRepository,
} from "./types";
import type { ApplianceHealthProbeResult } from "@/lib/appliance/health-types";
import { createBackupRestoreProbe } from "@/lib/appliance/probes/backup-restore-probe";
import {
  ResourcePressureError,
  type ResourcePressureSummary,
} from "@/lib/appliance/resources/resource-pressure";
import { ResourcePressureService } from "@/lib/appliance/resources/resource-pressure-service";

export interface BackupSelfServiceDashboard {
  executor: ExecutorState;
  policyHealth: BackupHealthProjection;
  policy: Awaited<ReturnType<BackupPolicyRepository["getOrCreateDefaultPolicy"]>>;
  latestSuccessfulBackup: BackupSnapshot | null;
  latestAttempt: BackupSnapshot | null;
  recentBackups: BackupSnapshot[];
  recentRestorePlans: RestorePlan[];
  recentCommands: SystemCommand[];
  commandCounts: Partial<Record<SystemCommand["status"], number>>;
  resources: ResourcePressureSummary;
  warnings: string[];
}

export interface ExecutorState {
  status: ApplianceHealthProbeResult["status"];
  summary: string;
  remediation?: string;
  executorDisabled: boolean;
  executorAvailable: boolean;
  executorPath: string | null;
  canEnqueueExecution: boolean;
  warnings: string[];
}

export interface BackupActionResult {
  status: "queued" | "validated" | "confirmation_required" | "confirmed" | "running" | "cancelled";
  summary: string;
  nextAction: string | null;
  snapshot?: BackupSnapshot | null;
  restorePlan?: RestorePlan | null;
  command?: SystemCommand | null;
  executor: ExecutorState;
  resources?: ResourcePressureSummary;
  warnings: string[];
}

export class BackupSelfService {
  constructor(private readonly deps: {
    commands: SystemCommandRepository & SystemCommandQuery & RestoreCommandRepository;
    snapshots: BackupSnapshotRepository & BackupSnapshotQuery;
    plans: RestorePlanRepository & RestorePlanQuery;
    audit: BackupRestoreAuditRepository & BackupRestoreAuditQuery;
    policy: BackupPolicyRepository;
    getExecutorHealth?: () => ApplianceHealthProbeResult | Promise<ApplianceHealthProbeResult>;
    resources?: ResourcePressureService;
  }) {}

  async getDashboard(): Promise<BackupSelfServiceDashboard> {
    const [policy, latestSuccessfulBackup, latestAttempt, recentBackups, recentRestorePlans, recentCommands, commandCounts, resources] = await Promise.all([
      this.deps.policy.getOrCreateDefaultPolicy(),
      this.deps.snapshots.findLatestSuccessful(),
      this.deps.snapshots.findLatestAttempt(),
      this.deps.snapshots.listRecent(25),
      this.deps.plans.listRecent(25),
      this.deps.commands.listRecentBackupRestore(25),
      this.deps.commands.countByStatusForRustDaemon(),
      this.getResourcePressureSummary(),
    ]);
    const policyHealth = await createBackupHealthProjection({
      policy: this.deps.policy,
      snapshots: this.deps.snapshots,
      commands: this.deps.commands,
    });
    const executor = await this.getExecutorState();
    return {
      executor,
      policyHealth,
      policy,
      latestSuccessfulBackup,
      latestAttempt,
      recentBackups,
      recentRestorePlans,
      recentCommands,
      commandCounts,
      resources,
      warnings: [
        ...resources.warnings,
        ...executor.warnings,
        ...policyHealth.warnings,
        ...recentCommands.filter((command) => command.status === "failed").map((command) => command.errorMessage ?? `Command ${command.id} failed.`),
      ],
    };
  }

  async updatePolicy(input: BackupPolicyUpdateInput, requester: BackupCommandRequester): Promise<BackupActionResult & { policy: Awaited<ReturnType<BackupPolicyRepository["getOrCreateDefaultPolicy"]>> }> {
    const service = new BackupPolicyService({
      policy: this.deps.policy,
      audit: this.deps.audit,
    });
    const policy = await service.updatePolicy(input, requester);
    const executor = await this.getExecutorState();
    return {
      status: "confirmed",
      summary: "Backup policy was updated.",
      nextAction: policy.enabled ? "Automatic backups will run on the configured schedule." : "Manual backups remain available.",
      policy,
      executor,
      warnings: executor.warnings,
    };
  }

  async createManualBackup(
    requester: BackupCommandRequester,
    operation: OperationCommandMetadata,
  ): Promise<BackupActionResult> {
    const executor = await this.requireExecutorAvailable();
    const resources = await this.resourcePressure().assertCanCreateBackup();
    const service = new BackupCommandService({
      commands: this.deps.commands,
      snapshots: this.deps.snapshots,
    });
    const command = await service.createManualBackupCommand(requester, operation);
    const snapshotId = typeof command.payload.snapshotId === "string" ? command.payload.snapshotId : "";
    const snapshot = snapshotId ? await this.deps.snapshots.findById(snapshotId) : null;
    return {
      status: "queued",
      summary: "Backup has been queued.",
      nextAction: "Refresh backup status.",
      snapshot,
      command,
      executor,
      resources,
      warnings: [...resources.warnings, ...executor.warnings],
    };
  }

  async validateBackup(snapshotId: string, requester: BackupCommandRequester): Promise<BackupActionResult> {
    const snapshot = await this.readRequiredSnapshot(snapshotId);
    if (!snapshot.archivePath || !snapshot.archiveHash || !snapshot.archiveSizeBytes) {
      throw new Error("Backup has no complete archive metadata to validate.");
    }
    const integrity = new Sha256ArchiveIntegrityService();
    const service = new BackupArchiveService({
      validator: new BackupArchiveValidator(integrity),
      snapshots: this.deps.snapshots,
      audit: this.deps.audit,
    });
    const result = await service.validateSnapshotArchive({
      snapshotId,
      archivePath: snapshot.archivePath,
      reader: new ZipBackupArchiveReader(snapshot.archivePath),
      actualIntegrity: await integrity.fromFile(snapshot.archivePath),
      expectedIntegrity: {
        hash: snapshot.archiveHash,
        sizeBytes: snapshot.archiveSizeBytes,
      },
      expectedBackupId: snapshot.id,
      actorUserId: requester.userId,
      actorRole: requester.role,
      markSucceeded: snapshot.status === "succeeded",
    });
    const executor = await this.getExecutorState();
    return {
      status: "validated",
      summary: result.validation.valid ? "Backup archive is valid." : "Backup archive validation failed.",
      nextAction: result.validation.valid ? "Prepare restore if needed." : "Review validation errors.",
      snapshot: result.snapshot,
      executor,
      warnings: [...executor.warnings, ...result.validation.warnings, ...result.validation.errors],
    };
  }

  async createRestorePlan(snapshotId: string, requester: BackupCommandRequester): Promise<BackupActionResult> {
    const service = this.createRestorePlanService();
    const restorePlan = await service.createPlan({ snapshotId, requester });
    const executor = await this.getExecutorState();
    return {
      status: "confirmation_required",
      summary: "Restore plan is ready for confirmation.",
      nextAction: `Type ${restorePlan.confirmationPhrase} to confirm.`,
      restorePlan,
      executor,
      warnings: [...executor.warnings, ...restorePlan.validationWarnings],
    };
  }

  async requestPreRestoreBackup(
    planId: string,
    requester: BackupCommandRequester,
    operation: OperationCommandMetadata,
  ): Promise<BackupActionResult> {
    const executor = await this.requireExecutorAvailable();
    const service = this.createRestorePlanService();
    const existingPlan = await this.deps.plans.findById(planId);
    const resources = await this.resourcePressure().assertCanCreatePreRestoreBackup({
      archiveSizeBytes: existingPlan?.archiveSizeBytes,
    });
    const restorePlan = await service.requestPreRestoreBackup({ planId, requester, operation });
    const command = restorePlan.preRestoreBackupCommandId
      ? await this.deps.commands.findById(restorePlan.preRestoreBackupCommandId)
      : null;
    return {
      status: "queued",
      summary: "Safety backup has been queued.",
      nextAction: "Wait for the safety backup to succeed before executing restore.",
      restorePlan,
      command,
      executor,
      resources,
      warnings: [...resources.warnings, ...executor.warnings],
    };
  }

  async confirmRestorePlan(planId: string, confirmationPhrase: string, requester: BackupCommandRequester): Promise<BackupActionResult> {
    const service = new RestoreConfirmationService({
      plans: this.deps.plans,
      snapshots: this.deps.snapshots,
      audit: this.deps.audit,
    });
    const restorePlan = await service.confirmPlan({ planId, confirmationPhrase, requester });
    const executor = await this.getExecutorState();
    return {
      status: "confirmed",
      summary: "Restore plan is confirmed.",
      nextAction: restorePlan.preRestoreBackupCommandId ? "Wait for the safety backup." : "Create the safety backup.",
      restorePlan,
      executor,
      warnings: executor.warnings,
    };
  }

  async executeConfirmedRestore(
    planId: string,
    requester: BackupCommandRequester,
    operation: OperationCommandMetadata,
  ): Promise<BackupActionResult> {
    const executor = await this.requireExecutorAvailable();
    const existingPlan = await this.deps.plans.findById(planId);
    const resources = await this.resourcePressure().assertCanExecuteRestore({
      archiveSizeBytes: existingPlan?.archiveSizeBytes,
    });
    const service = new RestoreCommandService({
      plans: this.deps.plans,
      snapshots: this.deps.snapshots,
      commandReader: this.deps.commands,
      restoreCommands: this.deps.commands,
      audit: this.deps.audit,
    });
    const restorePlan = await service.authorizeRestoreCommand({ planId, requester, operation });
    const command = restorePlan.restoreCommandId ? await this.deps.commands.findById(restorePlan.restoreCommandId) : null;
    return {
      status: "running",
      summary: "Restore has been queued for execution.",
      nextAction: "Refresh restore status.",
      restorePlan,
      command,
      executor,
      resources,
      warnings: [...resources.warnings, ...executor.warnings],
    };
  }

  async cancelRestorePlan(planId: string, requester: BackupCommandRequester): Promise<BackupActionResult> {
    assertAdmin(requester);
    const restorePlan = await this.deps.plans.markCancelled({
      id: planId,
      failureMessage: "Cancelled by admin self-service workflow.",
    });
    await this.deps.audit.append({
      operationId: planId,
      operationKind: "restore",
      eventType: "restore_plan_cancelled",
      actorUserId: requester.userId,
      actorRole: requester.role,
      metadata: { requestedFrom: requester.requestedFrom },
    });
    const executor = await this.getExecutorState();
    return {
      status: "cancelled",
      summary: "Restore plan was cancelled.",
      nextAction: null,
      restorePlan,
      executor,
      warnings: executor.warnings,
    };
  }

  private createRestorePlanService(): RestorePlanService {
    return new RestorePlanService({
      snapshots: this.deps.snapshots,
      plans: this.deps.plans,
      audit: this.deps.audit,
      commands: this.deps.commands,
      validator: new BackupArchiveValidator(new Sha256ArchiveIntegrityService()),
      integrity: new Sha256ArchiveIntegrityService(),
    });
  }

  private async readRequiredSnapshot(snapshotId: string): Promise<BackupSnapshot> {
    const snapshot = await this.deps.snapshots.findById(snapshotId);
    if (!snapshot) {
      throw new Error(`Backup snapshot not found: ${snapshotId}`);
    }
    return snapshot;
  }

  private async requireExecutorAvailable(): Promise<ExecutorState> {
    const state = await this.getExecutorState();
    if (!state.canEnqueueExecution) {
      throw new Error(state.summary || "Backup executor is unavailable.");
    }
    return state;
  }

  private async getExecutorState(): Promise<ExecutorState> {
    const result = await (this.deps.getExecutorHealth
      ? this.deps.getExecutorHealth()
      : createBackupRestoreProbe().run({ generatedAt: new Date().toISOString() } as never));
    const metadata = result.metadata as Record<string, unknown>;
    const executorDisabled = metadata.executorDisabled === true || result.status === "disabled";
    const executorAvailable = metadata.executorAvailable === true || (
      metadata.executorConfigured === true
      && metadata.executorDisabled !== true
      && metadata.executorAvailable !== false
      && result.status !== "disabled"
    );
    return {
      status: result.status,
      summary: result.summary,
      ...(result.remediation ? { remediation: result.remediation } : {}),
      executorDisabled,
      executorAvailable,
      executorPath: typeof metadata.executorPath === "string" ? metadata.executorPath : null,
      canEnqueueExecution: !executorDisabled && executorAvailable,
      warnings: result.warnings,
    };
  }

  private resourcePressure(): ResourcePressureService {
    return this.deps.resources ?? new ResourcePressureService();
  }

  private async getResourcePressureSummary(): Promise<ResourcePressureSummary> {
    try {
      return await this.resourcePressure().getResourcePressureSummary();
    } catch (error) {
      if (error instanceof ResourcePressureError) {
        return {
          status: error.status === "blocked" ? "blocked" : "degraded",
          summary: error.message,
          remediation: "Free disk space or attach a larger DATA_DIR volume.",
          warnings: [error.message],
          metadata: error.metadata,
        };
      }
      return {
        status: "unknown",
        summary: "Resource pressure could not be evaluated.",
        remediation: error instanceof Error ? error.message : "Inspect application logs.",
        warnings: [error instanceof Error ? error.message : String(error)],
        metadata: {
          warnFreeBytes: 0,
          warnFreePercent: 0,
          blockFreeBytes: 0,
          blockFreePercent: 0,
          reason: "resource_pressure_error",
        },
      };
    }
  }
}

function assertAdmin(requester: BackupCommandRequester): void {
  if (requester.role !== "ADMIN") {
    throw new Error("Backup and restore self-service is admin-only.");
  }
}
