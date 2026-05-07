import { assertAdminRole } from "./backup-command-validation";
import type {
  BackupRestoreAuditRepository,
  BackupSnapshot,
  BackupSnapshotRepository,
  RestorePlan,
  RestorePlanRepository,
} from "./types";
import type { RestorePlanRequester } from "./restore-plan-service";

export class RestoreConfirmationService {
  constructor(private readonly deps: {
    plans: RestorePlanRepository;
    snapshots: BackupSnapshotRepository;
    audit: BackupRestoreAuditRepository;
  }) {}

  async confirmPlan(input: {
    planId: string;
    confirmationPhrase: string;
    requester: RestorePlanRequester;
  }): Promise<RestorePlan> {
    assertAdminRole(input.requester.role);
    const plan = await this.readRequiredPlan(input.planId);
    if (plan.status !== "confirmation_required") {
      throw new Error("Restore plan is not waiting for confirmation.");
    }
    if (input.confirmationPhrase !== plan.confirmationPhrase) {
      throw new Error("Restore confirmation phrase does not match.");
    }
    const snapshot = await this.readRequiredSnapshot(plan.snapshotId);
    assertSnapshotStillMatchesPlan(snapshot, plan);

    const confirmed = await this.deps.plans.markConfirmed({
      id: plan.id,
      confirmedByUserId: input.requester.userId,
    });
    await this.deps.audit.append({
      operationId: plan.id,
      operationKind: "restore",
      eventType: "restore_plan_confirmed",
      actorUserId: input.requester.userId,
      actorRole: input.requester.role,
      metadata: {
        snapshotId: plan.snapshotId,
      },
    });
    return confirmed;
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

export function assertSnapshotStillMatchesPlan(snapshot: BackupSnapshot, plan: RestorePlan): void {
  if (
    snapshot.archivePath !== plan.archivePath
    || snapshot.archiveHash !== plan.archiveHash
    || snapshot.archiveSizeBytes !== plan.archiveSizeBytes
    || snapshot.manifestSchemaVersion !== plan.manifestSchemaVersion
    || snapshot.appVersion !== plan.appVersion
  ) {
    throw new Error("Backup snapshot metadata changed after restore plan creation.");
  }
}
