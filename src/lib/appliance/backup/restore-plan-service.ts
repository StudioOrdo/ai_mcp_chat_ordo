import { randomUUID } from "node:crypto";
import { getApplianceDataBoundary } from "@/lib/appliance/data-boundary";
import type { RoleName } from "@/core/entities/user";
import {
  BACKUP_RESTORE_PLAN_VERSION,
} from "./backup-manifest";
import { createBackupExecutorPayload } from "./backup-command-payload";
import type {
  ArchiveIntegrityService,
} from "./backup-archive-integrity";
import { BackupArchiveValidator } from "./backup-archive-validator";
import type { ArchiveReader } from "./backup-archive-validator";
import { ZipBackupArchiveReader } from "./backup-zip-archive-reader";
import { createRestorePlanImpactSummary } from "./restore-impact-summary";
import {
  assertAdminRole,
  validateOperationCommandMetadata,
} from "./backup-command-validation";
import type {
  BackupRestoreAuditRepository,
  BackupSnapshot,
  BackupSnapshotRepository,
  OperationCommandMetadata,
  RestorePlan,
  RestorePlanRepository,
  SystemCommandRepository,
} from "./types";

export interface RestorePlanRequester {
  userId: string | null;
  role: RoleName;
  requestedFrom: string;
}

export class RestorePlanService {
  constructor(private readonly deps: {
    snapshots: BackupSnapshotRepository;
    plans: RestorePlanRepository;
    audit: BackupRestoreAuditRepository;
    commands: SystemCommandRepository;
    validator: BackupArchiveValidator;
    integrity: ArchiveIntegrityService;
    createArchiveReader?: (archivePath: string) => ArchiveReader;
    getDataBoundary?: typeof getApplianceDataBoundary;
  }) {}

  async createPlan(input: {
    snapshotId: string;
    requester: RestorePlanRequester;
  }): Promise<RestorePlan> {
    assertAdminRole(input.requester.role);
    const snapshot = await this.readPlanEligibleSnapshot(input.snapshotId);
    const archivePath = snapshot.archivePath ?? "";
    const validation = await this.validateSnapshotArchiveForRestore({
      snapshot,
      archivePath,
      requester: input.requester,
    });

    if (!validation.valid || !validation.manifest) {
      const message = validation.errors.join("; ") || "Restore plan archive validation failed.";
      await this.deps.audit.append({
        operationId: input.snapshotId,
        operationKind: "restore",
        eventType: "restore_plan_validation_failed",
        actorUserId: input.requester.userId,
        actorRole: input.requester.role,
        metadata: {
          snapshotId: input.snapshotId,
          archivePath,
          errors: validation.errors,
        },
      });
      throw new Error(message);
    }

    const dataBoundary = (this.deps.getDataBoundary ?? getApplianceDataBoundary)();
    const impact = createRestorePlanImpactSummary({
      snapshot,
      manifest: validation.manifest,
      dataBoundary,
    });
    const planId = `restore_${randomUUID()}`;
    const draft = await this.deps.plans.createDraft({
      id: planId,
      snapshotId: snapshot.id,
      archivePath,
      archiveHash: snapshot.archiveHash ?? "",
      archiveSizeBytes: snapshot.archiveSizeBytes ?? 0,
      manifestSchemaVersion: snapshot.manifestSchemaVersion ?? validation.manifest.schemaVersion,
      appVersion: snapshot.appVersion ?? validation.manifest.appVersion,
      restorePlanVersion: BACKUP_RESTORE_PLAN_VERSION,
      impact,
      validationWarnings: validation.warnings,
      confirmationPhrase: createRestoreConfirmationPhrase(planId),
      createdByUserId: input.requester.userId,
    });
    const plan = await this.deps.plans.markValidated(draft.id);
    const confirmationRequired = await this.deps.plans.markConfirmationRequired(plan.id);

    await this.deps.audit.append({
      operationId: confirmationRequired.id,
      operationKind: "restore",
      eventType: "restore_plan_created",
      actorUserId: input.requester.userId,
      actorRole: input.requester.role,
      metadata: {
        snapshotId: snapshot.id,
        archivePath,
        archiveHash: snapshot.archiveHash,
        archiveSizeBytes: snapshot.archiveSizeBytes,
        warnings: validation.warnings,
      },
    });
    await this.deps.audit.append({
      operationId: confirmationRequired.id,
      operationKind: "restore",
      eventType: "restore_plan_confirmation_required",
      actorUserId: input.requester.userId,
      actorRole: input.requester.role,
      metadata: {
        snapshotId: snapshot.id,
      },
    });

    return confirmationRequired;
  }

  async requestPreRestoreBackup(input: {
    planId: string;
    requester: RestorePlanRequester;
    operation: OperationCommandMetadata;
  }): Promise<RestorePlan> {
    assertAdminRole(input.requester.role);
    validateOperationCommandMetadata(input.operation, "restore_execute", { required: true });
    const plan = await this.readRequiredPlan(input.planId);
    if (plan.preRestoreBackupCommandId) {
      return plan;
    }
    const snapshot = await this.deps.snapshots.createPending({
      kind: "pre_restore",
      createdByUserId: input.requester.userId,
    });

    const command = await this.deps.commands.enqueue({
      target: "rust_daemon",
      command: "backup.create",
      status: "pending",
      payload: createBackupExecutorPayload({
        kind: "pre_restore",
        snapshotId: snapshot.id,
        restorePlanId: plan.id,
        operation: input.operation,
      }),
      requestedByUserId: input.requester.userId,
      requestedByRole: input.requester.role,
      requestedFrom: input.requester.requestedFrom,
    });
    const updated = await this.deps.plans.markPreRestoreBackupRequired({
      id: plan.id,
      commandId: command.id,
    });

    await this.deps.audit.append({
      operationId: plan.id,
      operationKind: "restore",
      eventType: "restore_pre_restore_backup_required",
      actorUserId: input.requester.userId,
      actorRole: input.requester.role,
      metadata: {
        commandId: command.id,
        snapshotId: snapshot.id,
      },
    });

    return updated;
  }

  async linkPreRestoreBackupSnapshot(input: {
    planId: string;
    snapshotId: string;
    requester: RestorePlanRequester;
  }): Promise<RestorePlan> {
    assertAdminRole(input.requester.role);
    const plan = await this.readRequiredPlan(input.planId);
    if (!plan.preRestoreBackupCommandId) {
      throw new Error("Restore plan requires a pre-restore backup command before linking a snapshot.");
    }
    const snapshot = await this.deps.snapshots.findById(input.snapshotId);
    if (!snapshot || snapshot.kind !== "pre_restore") {
      throw new Error("Restore plan can only link a pre_restore backup snapshot.");
    }
    const updated = await this.deps.plans.linkPreRestoreBackupSnapshot({
      id: input.planId,
      snapshotId: input.snapshotId,
    });
    await this.deps.audit.append({
      operationId: input.planId,
      operationKind: "restore",
      eventType: "restore_pre_restore_backup_linked",
      actorUserId: input.requester.userId,
      actorRole: input.requester.role,
      metadata: {
        snapshotId: input.snapshotId,
      },
    });
    return updated;
  }

  private async readPlanEligibleSnapshot(snapshotId: string): Promise<BackupSnapshot> {
    const snapshot = await this.deps.snapshots.findById(snapshotId);
    if (!snapshot) {
      throw new Error(`Backup snapshot not found: ${snapshotId}`);
    }
    if (snapshot.status !== "validated" && snapshot.status !== "succeeded") {
      throw new Error("Restore plans require a validated or succeeded backup snapshot.");
    }
    if (
      !snapshot.archivePath
      || !snapshot.archiveHash
      || !snapshot.archiveSizeBytes
      || !snapshot.manifestSchemaVersion
      || !snapshot.appVersion
    ) {
      throw new Error("Restore plans require complete backup archive metadata.");
    }
    return snapshot;
  }

  private createArchiveReader(archivePath: string) {
    return this.deps.createArchiveReader
      ? this.deps.createArchiveReader(archivePath)
      : new ZipBackupArchiveReader(archivePath);
  }

  private async validateSnapshotArchiveForRestore(input: {
    snapshot: BackupSnapshot;
    archivePath: string;
    requester: RestorePlanRequester;
  }) {
    try {
      const actualIntegrity = await this.deps.integrity.fromFile(input.archivePath);
      return await this.deps.validator.validate({
        reader: this.createArchiveReader(input.archivePath),
        actualIntegrity,
        expectedIntegrity: {
          hash: input.snapshot.archiveHash ?? "",
          sizeBytes: input.snapshot.archiveSizeBytes ?? 0,
        },
        expectedBackupId: input.snapshot.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Restore plan archive validation failed.";
      await this.deps.audit.append({
        operationId: input.snapshot.id,
        operationKind: "restore",
        eventType: "restore_plan_validation_failed",
        actorUserId: input.requester.userId,
        actorRole: input.requester.role,
        metadata: {
          snapshotId: input.snapshot.id,
          archivePath: input.archivePath,
          errors: [message],
        },
      });
      throw new Error(message);
    }
  }

  private async readRequiredPlan(planId: string): Promise<RestorePlan> {
    const plan = await this.deps.plans.findById(planId);
    if (!plan) {
      throw new Error(`Restore plan not found: ${planId}`);
    }
    return plan;
  }

}

export function createRestoreConfirmationPhrase(planId: string): string {
  return `RESTORE ${planId.slice(0, 16)}`;
}
