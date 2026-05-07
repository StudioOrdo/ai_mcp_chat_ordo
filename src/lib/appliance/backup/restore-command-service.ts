import { getApplianceDataBoundary } from "@/lib/appliance/data-boundary";
import {
  assertAdminRole,
  validateOperationCommandMetadata,
} from "./backup-command-validation";
import { assertSnapshotStillMatchesPlan } from "./restore-confirmation-service";
import type { RestorePlanRequester } from "./restore-plan-service";
import type {
  BackupRestoreAuditRepository,
  BackupSnapshot,
  BackupSnapshotRepository,
  OperationCommandMetadata,
  RestoreCommandRepository,
  RestorePlan,
  RestorePlanRepository,
  SystemCommandRepository,
} from "./types";

export class RestoreCommandService {
  constructor(private readonly deps: {
    plans: RestorePlanRepository;
    snapshots: BackupSnapshotRepository;
    commandReader: SystemCommandRepository;
    restoreCommands: RestoreCommandRepository;
    audit: BackupRestoreAuditRepository;
    getDataBoundary?: typeof getApplianceDataBoundary;
  }) {}

  async authorizeRestoreCommand(input: {
    planId: string;
    requester: RestorePlanRequester;
    operation: OperationCommandMetadata;
  }): Promise<RestorePlan> {
    assertAdminRole(input.requester.role);
    validateOperationCommandMetadata(input.operation, "restore_execute", { required: true });
    const plan = await this.readRequiredPlan(input.planId);
    if (plan.status !== "confirmed") {
      throw new Error("Restore command requires a confirmed restore plan.");
    }
    const snapshot = await this.readRequiredSnapshot(plan.snapshotId);
    assertSnapshotStillMatchesPlan(snapshot, plan);
    await this.assertPreRestoreBackupSatisfied(plan, input.requester);

    const command = await this.deps.restoreCommands.enqueueRestoreRequest({
      payload: {
        restorePlanId: plan.id,
        snapshotId: plan.snapshotId,
        archivePath: plan.archivePath,
        expectedArchiveHash: plan.archiveHash,
        expectedArchiveSizeBytes: plan.archiveSizeBytes,
        manifestSchemaVersion: plan.manifestSchemaVersion,
        restorePlanVersion: plan.restorePlanVersion,
        requestedAt: new Date().toISOString(),
        dataBoundary: this.createExecutorDataBoundaryPayload(),
        confirmationRef: plan.confirmationPhrase,
        operation: input.operation,
      },
      requestedByUserId: input.requester.userId,
      requestedByRole: input.requester.role,
      requestedFrom: input.requester.requestedFrom,
    });

    const running = await this.deps.plans.markRunning({
      id: plan.id,
      restoreCommandId: command.id,
    });
    await this.deps.audit.append({
      operationId: plan.id,
      operationKind: "restore",
      eventType: "restore_command_enqueued",
      actorUserId: input.requester.userId,
      actorRole: input.requester.role,
      metadata: {
        commandId: command.id,
        snapshotId: plan.snapshotId,
      },
    });
    return running;
  }

  private async assertPreRestoreBackupSatisfied(
    plan: RestorePlan,
    requester: RestorePlanRequester,
  ): Promise<void> {
    if (!plan.preRestoreBackupCommandId) {
      await this.appendBlockedAudit(plan, requester, "Restore requires a pre-restore backup command.");
      throw new Error("Restore requires a pre-restore backup command.");
    }
    const command = await this.deps.commandReader.findById(plan.preRestoreBackupCommandId);
    if (!command || command.status !== "succeeded") {
      await this.appendBlockedAudit(plan, requester, "Pre-restore backup command has not succeeded.");
      throw new Error("Pre-restore backup command has not succeeded.");
    }
    if (!plan.preRestoreBackupSnapshotId) {
      await this.appendBlockedAudit(plan, requester, "Restore requires a linked pre-restore backup snapshot.");
      throw new Error("Restore requires a linked pre-restore backup snapshot.");
    }
    const snapshot = await this.deps.snapshots.findById(plan.preRestoreBackupSnapshotId);
    if (!snapshot || snapshot.kind !== "pre_restore" || snapshot.status !== "succeeded") {
      await this.appendBlockedAudit(plan, requester, "Linked pre-restore backup snapshot has not succeeded.");
      throw new Error("Linked pre-restore backup snapshot has not succeeded.");
    }
  }

  private createExecutorDataBoundaryPayload(): {
    dataDir: string;
    sqlitePath: string;
    blogAssetRoot: string;
    userFileRoot: string;
  } {
    const boundary = (this.deps.getDataBoundary ?? getApplianceDataBoundary)();
    return {
      dataDir: boundary.dataDir,
      sqlitePath: boundary.sqlitePath,
      blogAssetRoot: boundary.blogAssetRoot,
      userFileRoot: boundary.userFileRoot,
    };
  }

  private async appendBlockedAudit(
    plan: RestorePlan,
    requester: RestorePlanRequester,
    reason: string,
  ): Promise<void> {
    await this.deps.audit.append({
      operationId: plan.id,
      operationKind: "restore",
      eventType: "restore_pre_restore_backup_blocked",
      actorUserId: requester.userId,
      actorRole: requester.role,
      metadata: {
        reason,
        preRestoreBackupCommandId: plan.preRestoreBackupCommandId,
        preRestoreBackupSnapshotId: plan.preRestoreBackupSnapshotId,
      },
    });
  }

  private async readRequiredPlan(planId: string): Promise<RestorePlan> {
    const plan = await this.deps.plans.findById(planId);
    if (!plan) {
      throw new Error(`Restore plan not found: ${planId}`);
    }
    return plan;
  }

  private async readRequiredSnapshot(snapshotId: string): Promise<BackupSnapshot> {
    const snapshot = await this.deps.snapshots.findById(snapshotId);
    if (!snapshot) {
      throw new Error(`Backup snapshot not found: ${snapshotId}`);
    }
    return snapshot;
  }
}
