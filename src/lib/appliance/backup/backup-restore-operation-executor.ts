import { randomUUID } from "node:crypto";

import type {
  Operation,
  OperationAction,
  OperationArtifact,
  OperationErrorPayload,
  OperationStep,
  OperationStepStatus,
} from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";
import type {
  OperationActionExecutor,
  OperationActionExecutorInput,
  OperationActionExecutorResult,
} from "@/core/use-cases/operations/OperationActionDispatch";
import {
  backupRestoreStepId,
  createBackupCreateAction,
  createRestoreCancelAction,
  createRestoreConfirmAction,
  createRestorePrepareAction,
  createRestoreSafetyBackupAction,
  type BackupRestoreOperationActionType,
  type BackupRestoreOperationIdFactory,
  type BackupRestoreOperationStepKind,
} from "@/core/use-cases/operations/BackupRestoreOperationActions";
import type {
  OperationRepository,
  OperationSnapshot,
} from "@/core/use-cases/operations/OperationRepository";
import type {
  BackupActionResult,
  BackupSelfService,
} from "@/lib/appliance/backup/backup-self-service";
import type {
  BackupCommandRequester,
  OperationCommandMetadata,
  RestorePlan,
} from "@/lib/appliance/backup/types";

const BACKUP_RESTORE_ACTIONS = new Set<string>([
  "backup.create",
  "backup.validate",
  "restore.prepare",
  "restore.confirm",
  "restore.create_safety_backup",
  "restore.execute",
  "restore.cancel",
]);

const STEP_SEQUENCE: Record<BackupRestoreOperationStepKind, number> = {
  "backup.create": 1,
  "backup.validate": 2,
  "restore.prepare": 1,
  "restore.confirm": 2,
  "restore.safety_backup": 3,
  "restore.execute": 4,
  "restore.verify": 5,
};

export interface BackupRestoreOperationExecutorDeps {
  backupSelfService: BackupSelfService;
  idFactory?: BackupRestoreOperationIdFactory;
  reconcile?: (operationId?: string) => Promise<void>;
}

export class BackupRestoreOperationExecutor implements OperationActionExecutor {
  private readonly idFactory: BackupRestoreOperationIdFactory;

  constructor(private readonly deps: BackupRestoreOperationExecutorDeps) {
    this.idFactory = deps.idFactory ?? ((prefix) => `${prefix}_${randomUUID()}`);
  }

  canExecute(actionType: string): boolean {
    return BACKUP_RESTORE_ACTIONS.has(actionType);
  }

  async execute(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    try {
      switch (input.action.actionType as BackupRestoreOperationActionType) {
        case "backup.create":
          return await this.createBackup(input);
        case "backup.validate":
          return await this.validateBackup(input);
        case "restore.prepare":
          return await this.prepareRestore(input);
        case "restore.confirm":
          return await this.confirmRestore(input);
        case "restore.create_safety_backup":
          return await this.createRestoreSafetyBackup(input);
        case "restore.execute":
          return await this.executeRestore(input);
        case "restore.cancel":
          return await this.cancelRestore(input);
      }
    } catch (error) {
      const snapshot = await this.blockAfterExecutorError(input, error);
      return { snapshot };
    }
  }

  private async createBackup(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const stepKind: BackupRestoreOperationStepKind = "backup.create";
    const stepId = backupRestoreStepId(input.snapshot.operation.id, stepKind);
    await this.upsertStep(input.repository, input.snapshot.operation, stepKind, "running", {
      input: input.payload,
      actorUserId: input.actorUserId,
      now: input.now,
    });
    const result = await this.deps.backupSelfService.createManualBackup(
      requester(input.actorUserId, input.actorRole),
      operationMetadata(input.snapshot.operation.id, stepId, input.action, "backup_create"),
    );
    await this.upsertStep(input.repository, input.snapshot.operation, stepKind, "running", {
      output: actionResultOutput(result),
      systemCommandId: result.command?.id ?? null,
      resourceRef: result.snapshot ? { type: "backup_snapshot", id: result.snapshot.id, uri: `backup-snapshot:${result.snapshot.id}` } : null,
      actorUserId: input.actorUserId,
      now: input.now,
    });
    await advanceOperationStatus(input.repository, input.snapshot.operation.id, "queued", input.actorUserId, input.now);
    const current = await requireOperationSnapshot(input.repository, input.snapshot.operation.id);
    await input.repository.replaceActions({
      operationId: current.operation.id,
      actions: [],
      actorType: "system",
      actorId: input.actorUserId,
      now: input.now,
    });
    await this.deps.reconcile?.(input.snapshot.operation.id);
    return { snapshot: await requireOperationSnapshot(input.repository, input.snapshot.operation.id) };
  }

  private async validateBackup(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const snapshotId = requirePayloadString(input.payload, "snapshotId");
    const stepKind: BackupRestoreOperationStepKind = "backup.validate";
    await this.upsertStep(input.repository, input.snapshot.operation, stepKind, "running", {
      input: { snapshotId },
      actorUserId: input.actorUserId,
      now: input.now,
    });
    const result = await this.deps.backupSelfService.validateBackup(snapshotId, requester(input.actorUserId, input.actorRole));
    await this.upsertStep(input.repository, input.snapshot.operation, stepKind, "succeeded", {
      output: actionResultOutput(result),
      resourceRef: result.snapshot ? { type: "backup_snapshot", id: result.snapshot.id, uri: `backup-snapshot:${result.snapshot.id}` } : null,
      actorUserId: input.actorUserId,
      now: input.now,
    });
    return { snapshot: await requireOperationSnapshot(input.repository, input.snapshot.operation.id) };
  }

  private async prepareRestore(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const snapshotId = requirePayloadString(input.payload, "snapshotId");
    const operation = input.snapshot.operation;
    await this.ensureRestoreSkeleton(input.repository, operation, snapshotId, input.actorUserId, input.now);
    await this.upsertStep(input.repository, operation, "restore.prepare", "running", {
      input: { snapshotId },
      actorUserId: input.actorUserId,
      now: input.now,
    });
    const result = await this.deps.backupSelfService.createRestorePlan(snapshotId, requester(input.actorUserId, input.actorRole));
    const restorePlan = requireRestorePlan(result);
    await this.upsertStep(input.repository, operation, "restore.prepare", "succeeded", {
      output: actionResultOutput(result),
      resourceRef: { type: "restore_plan", id: restorePlan.id, uri: `restore-plan:${restorePlan.id}` },
      actorUserId: input.actorUserId,
      now: input.now,
    });
    await attachArtifactOnce(input.repository, {
      id: `${operation.id}:restore_plan:${restorePlan.id}`,
      operationId: operation.id,
      stepId: backupRestoreStepId(operation.id, "restore.prepare"),
      kind: "restore_plan",
      uri: `restore-plan:${restorePlan.id}`,
      label: `Restore plan ${restorePlan.id}`,
      metadata: restorePlanArtifactMetadata(restorePlan),
    }, input.actorUserId, input.now);
    await advanceOperationStatus(input.repository, operation.id, "awaiting_confirmation", input.actorUserId, input.now);
    await this.replaceWithRestoreConfirmActions(input.repository, operation.id, restorePlan, input.actorUserId, input.now);
    return { snapshot: await requireOperationSnapshot(input.repository, operation.id) };
  }

  private async confirmRestore(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const restorePlanId = requirePayloadString(input.payload, "restorePlanId");
    const confirmationPhrase = input.action.confirmationText ?? "";
    const operation = input.snapshot.operation;
    this.requireStepSucceeded(input.snapshot, "restore.prepare");
    await this.upsertStep(input.repository, operation, "restore.confirm", "running", {
      input: { restorePlanId },
      actorUserId: input.actorUserId,
      now: input.now,
    });
    const result = await this.deps.backupSelfService.confirmRestorePlan(
      restorePlanId,
      confirmationPhrase,
      requester(input.actorUserId, input.actorRole),
    );
    const restorePlan = requireRestorePlan(result);
    await this.upsertStep(input.repository, operation, "restore.confirm", "succeeded", {
      output: actionResultOutput(result),
      resourceRef: { type: "restore_plan", id: restorePlan.id, uri: `restore-plan:${restorePlan.id}` },
      actorUserId: input.actorUserId,
      now: input.now,
    });
    await advanceOperationStatus(input.repository, operation.id, "blocked", input.actorUserId, input.now);
    await this.replaceWithRestoreSafetyActions(input.repository, operation.id, restorePlan.id, null, input.actorUserId, input.now);
    return { snapshot: await requireOperationSnapshot(input.repository, operation.id) };
  }

  private async createRestoreSafetyBackup(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const restorePlanId = requirePayloadString(input.payload, "restorePlanId");
    const operation = input.snapshot.operation;
    this.requireStepSucceeded(input.snapshot, "restore.confirm");
    await this.upsertStep(input.repository, operation, "restore.safety_backup", "running", {
      input: { restorePlanId },
      actorUserId: input.actorUserId,
      now: input.now,
    });
    const stepId = backupRestoreStepId(operation.id, "restore.safety_backup");
    const result = await this.deps.backupSelfService.requestPreRestoreBackup(
      restorePlanId,
      requester(input.actorUserId, input.actorRole),
      operationMetadata(operation.id, stepId, input.action, "restore_execute"),
    );
    await this.upsertStep(input.repository, operation, "restore.safety_backup", "running", {
      output: actionResultOutput(result),
      systemCommandId: result.command?.id ?? null,
      resourceRef: result.command ? { type: "system_command", id: result.command.id, uri: `system-command:${result.command.id}` } : null,
      actorUserId: input.actorUserId,
      now: input.now,
    });
    await advanceOperationStatus(input.repository, operation.id, "queued", input.actorUserId, input.now);
    await input.repository.replaceActions({
      operationId: operation.id,
      actions: [],
      actorType: "system",
      actorId: input.actorUserId,
      now: input.now,
    });
    await this.deps.reconcile?.(operation.id);
    return { snapshot: await requireOperationSnapshot(input.repository, operation.id) };
  }

  private async executeRestore(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const restorePlanId = requirePayloadString(input.payload, "restorePlanId");
    const operation = input.snapshot.operation;
    this.requireStepSucceeded(input.snapshot, "restore.safety_backup");
    await this.upsertStep(input.repository, operation, "restore.execute", "running", {
      input: { restorePlanId },
      actorUserId: input.actorUserId,
      now: input.now,
    });
    const stepId = backupRestoreStepId(operation.id, "restore.execute");
    const result = await this.deps.backupSelfService.executeConfirmedRestore(
      restorePlanId,
      requester(input.actorUserId, input.actorRole),
      operationMetadata(operation.id, stepId, input.action, "restore_execute"),
    );
    await this.upsertStep(input.repository, operation, "restore.execute", "running", {
      output: actionResultOutput(result),
      systemCommandId: result.command?.id ?? null,
      resourceRef: result.command ? { type: "system_command", id: result.command.id, uri: `system-command:${result.command.id}` } : null,
      actorUserId: input.actorUserId,
      now: input.now,
    });
    await advanceOperationStatus(input.repository, operation.id, "running", input.actorUserId, input.now);
    await input.repository.replaceActions({
      operationId: operation.id,
      actions: [],
      actorType: "system",
      actorId: input.actorUserId,
      now: input.now,
    });
    await this.deps.reconcile?.(operation.id);
    return { snapshot: await requireOperationSnapshot(input.repository, operation.id) };
  }

  private async cancelRestore(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const restorePlanId = requirePayloadString(input.payload, "restorePlanId");
    const operation = input.snapshot.operation;
    const result = await this.deps.backupSelfService.cancelRestorePlan(restorePlanId, requester(input.actorUserId, input.actorRole));
    await this.upsertStep(input.repository, operation, "restore.execute", "cancelled", {
      input: { restorePlanId },
      output: actionResultOutput(result),
      actorUserId: input.actorUserId,
      now: input.now,
    });
    await advanceOperationStatus(input.repository, operation.id, "cancelled", input.actorUserId, input.now);
    await input.repository.replaceActions({
      operationId: operation.id,
      actions: [],
      actorType: "system",
      actorId: input.actorUserId,
      now: input.now,
    });
    return { snapshot: await requireOperationSnapshot(input.repository, operation.id) };
  }

  private async blockAfterExecutorError(
    input: OperationActionExecutorInput,
    error: unknown,
  ): Promise<OperationSnapshot> {
    const message = error instanceof Error ? error.message : "Backup/restore operation failed.";
    const errorPayload: OperationErrorPayload = {
      code: "BACKUP_RESTORE_EXECUTOR_BLOCKED",
      message,
      details: { actionType: input.action.actionType },
    };
    const stepKind = stepKindForAction(input.action.actionType);
    if (stepKind) {
      await this.upsertStep(input.repository, input.snapshot.operation, stepKind, "blocked", {
        input: input.payload,
        error: errorPayload,
        actorUserId: input.actorUserId,
        now: input.now,
      });
    }
    await advanceOperationStatus(input.repository, input.snapshot.operation.id, "blocked", input.actorUserId, input.now);
    const current = await requireOperationSnapshot(input.repository, input.snapshot.operation.id);
    await input.repository.replaceActions({
      operationId: current.operation.id,
      actions: disabledRetryActions({
        snapshot: current,
        action: input.action,
        idFactory: this.idFactory,
        reason: message,
      }),
      actorType: "system",
      actorId: input.actorUserId,
      now: input.now,
    });
    return await requireOperationSnapshot(input.repository, input.snapshot.operation.id);
  }

  private async ensureRestoreSkeleton(
    repository: OperationRepository,
    operation: Operation,
    snapshotId: string,
    actorUserId: string | null,
    now?: string,
  ): Promise<void> {
    await this.upsertStep(repository, operation, "restore.prepare", "pending", {
      input: { snapshotId },
      actorUserId,
      now,
    });
    await this.upsertStep(repository, operation, "restore.confirm", "pending", {
      input: {},
      dependsOnStepIds: [backupRestoreStepId(operation.id, "restore.prepare")],
      actorUserId,
      now,
    });
    await this.upsertStep(repository, operation, "restore.safety_backup", "pending", {
      input: {},
      dependsOnStepIds: [backupRestoreStepId(operation.id, "restore.confirm")],
      actorUserId,
      now,
    });
    await this.upsertStep(repository, operation, "restore.execute", "pending", {
      input: {},
      dependsOnStepIds: [backupRestoreStepId(operation.id, "restore.safety_backup")],
      actorUserId,
      now,
    });
    await this.upsertStep(repository, operation, "restore.verify", "pending", {
      input: {},
      dependsOnStepIds: [backupRestoreStepId(operation.id, "restore.execute")],
      actorUserId,
      now,
    });
  }

  private async replaceWithRestoreConfirmActions(
    repository: OperationRepository,
    operationId: string,
    restorePlan: RestorePlan,
    actorUserId: string | null,
    now?: string,
  ): Promise<void> {
    const current = await requireOperationSnapshot(repository, operationId);
    await repository.replaceActions({
      operationId,
      actions: [
        createRestoreConfirmAction({
          operationId,
          operationRevision: current.operation.revision,
          idFactory: this.idFactory,
          restorePlanId: restorePlan.id,
          confirmationText: restorePlan.confirmationPhrase,
        }),
        createRestoreCancelAction({
          operationId,
          operationRevision: current.operation.revision,
          idFactory: this.idFactory,
          restorePlanId: restorePlan.id,
        }),
      ],
      actorType: "system",
      actorId: actorUserId,
      now,
    });
  }

  private async replaceWithRestoreSafetyActions(
    repository: OperationRepository,
    operationId: string,
    restorePlanId: string,
    disabledReason: string | null,
    actorUserId: string | null,
    now?: string,
  ): Promise<void> {
    const current = await requireOperationSnapshot(repository, operationId);
    await repository.replaceActions({
      operationId,
      actions: [
        createRestoreSafetyBackupAction({
          operationId,
          operationRevision: current.operation.revision,
          idFactory: this.idFactory,
          restorePlanId,
          disabledReason,
        }),
        createRestoreCancelAction({
          operationId,
          operationRevision: current.operation.revision,
          idFactory: this.idFactory,
          restorePlanId,
        }),
      ],
      actorType: "system",
      actorId: actorUserId,
      now,
    });
  }

  private requireStepSucceeded(snapshot: OperationSnapshot, stepKind: BackupRestoreOperationStepKind): void {
    const step = snapshot.steps.find((candidate) => candidate.id === backupRestoreStepId(snapshot.operation.id, stepKind));
    if (step?.status !== "succeeded") {
      throw new Error(`${stepKind} must succeed before this action can run.`);
    }
  }

  private async upsertStep(
    repository: OperationRepository,
    operation: Operation,
    kind: BackupRestoreOperationStepKind,
    status: OperationStepStatus,
    options: {
      input?: Record<string, unknown>;
      output?: Record<string, unknown> | null;
      error?: OperationErrorPayload | null;
      dependsOnStepIds?: readonly string[];
      systemCommandId?: string | null;
      resourceRef?: OperationStep["resourceRef"];
      actorUserId?: string | null;
      now?: string;
    } = {},
  ): Promise<OperationSnapshot> {
    const step: OperationStep = {
      id: backupRestoreStepId(operation.id, kind),
      operationId: operation.id,
      sequence: STEP_SEQUENCE[kind],
      kind,
      status,
      dependsOnStepIds: options.dependsOnStepIds ?? defaultDependsOn(operation.id, kind),
      capabilityName: kind.startsWith("backup.") ? "appliance_backup" : "appliance_restore",
      jobId: null,
      systemCommandId: options.systemCommandId ?? null,
      resourceRef: options.resourceRef ?? null,
      input: options.input ?? {},
      output: options.output ?? null,
      error: options.error ?? null,
      retryCount: 0,
      startedAt: status === "running" ? options.now ?? new Date().toISOString() : null,
      completedAt: ["succeeded", "failed", "skipped", "cancelled"].includes(status)
        ? options.now ?? new Date().toISOString()
        : null,
    };

    return repository.upsertStep({
      step,
      actorType: "system",
      actorId: options.actorUserId ?? null,
      now: options.now,
    });
  }
}

export async function advanceOperationStatus(
  repository: OperationRepository,
  operationId: string,
  targetStatus: Operation["status"],
  actorUserId?: string | null,
  now?: string,
): Promise<OperationSnapshot> {
  let snapshot = await requireOperationSnapshot(repository, operationId);
  if (snapshot.operation.status === targetStatus) return snapshot;
  if (["succeeded", "failed", "cancelled", "expired"].includes(snapshot.operation.status)) return snapshot;

  const path = statusPath(snapshot.operation.status, targetStatus);
  for (const status of path) {
    snapshot = await repository.updateOperationStatus({
      operationId,
      status,
      actorType: "system",
      actorId: actorUserId ?? null,
      now,
    });
  }
  return snapshot;
}

export async function requireOperationSnapshot(
  repository: OperationRepository,
  operationId: string,
): Promise<OperationSnapshot> {
  const snapshot = await repository.findOperationById(operationId);
  if (!snapshot) throw new Error(`Operation not found: ${operationId}`);
  return snapshot;
}

function statusPath(current: Operation["status"], target: Operation["status"]): Operation["status"][] {
  if (current === target) return [];
  if (target === "succeeded" && current !== "running") return ["running", "succeeded"];
  if (target === "failed" && current === "draft") return ["blocked", "failed"];
  if (target === "failed" && current === "awaiting_confirmation") return ["blocked", "failed"];
  if (target === "failed") return ["failed"];
  if (target === "running" && current === "draft") return ["queued", "running"];
  return [target];
}

function requester(userId: string | null, role: RoleName): BackupCommandRequester {
  return {
    userId,
    role,
    requestedFrom: "operation_kernel",
  };
}

function operationMetadata(
  operationId: string,
  stepId: string,
  action: OperationAction,
  operationKind: OperationCommandMetadata["operationKind"],
): OperationCommandMetadata {
  return {
    operationId,
    stepId,
    actionId: action.id,
    operationKind,
  };
}

function actionResultOutput(result: BackupActionResult): Record<string, unknown> {
  return {
    status: result.status,
    summary: result.summary,
    nextAction: result.nextAction,
    snapshotId: result.snapshot?.id ?? null,
    restorePlanId: result.restorePlan?.id ?? null,
    commandId: result.command?.id ?? null,
    warnings: result.warnings,
  };
}

function requirePayloadString(payload: Record<string, unknown>, field: string): string {
  const value = payload[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function requireRestorePlan(result: BackupActionResult): RestorePlan {
  if (!result.restorePlan) throw new Error("Restore plan result was not returned.");
  return result.restorePlan;
}

function defaultDependsOn(operationId: string, kind: BackupRestoreOperationStepKind): readonly string[] {
  switch (kind) {
    case "restore.confirm":
      return [backupRestoreStepId(operationId, "restore.prepare")];
    case "restore.safety_backup":
      return [backupRestoreStepId(operationId, "restore.confirm")];
    case "restore.execute":
      return [backupRestoreStepId(operationId, "restore.safety_backup")];
    case "restore.verify":
      return [backupRestoreStepId(operationId, "restore.execute")];
    case "backup.create":
    case "backup.validate":
    case "restore.prepare":
      return [];
  }
}

function stepKindForAction(actionType: string): BackupRestoreOperationStepKind | null {
  switch (actionType) {
    case "backup.create":
      return "backup.create";
    case "backup.validate":
      return "backup.validate";
    case "restore.prepare":
      return "restore.prepare";
    case "restore.confirm":
      return "restore.confirm";
    case "restore.create_safety_backup":
      return "restore.safety_backup";
    case "restore.execute":
    case "restore.cancel":
      return "restore.execute";
    default:
      return null;
  }
}

function disabledRetryActions(input: {
  snapshot: OperationSnapshot;
  action: OperationAction;
  idFactory: BackupRestoreOperationIdFactory;
  reason: string;
}): OperationAction[] {
  const revision = input.snapshot.operation.revision;
  if (input.action.actionType === "backup.create") {
    return [createBackupCreateAction({
      operationId: input.snapshot.operation.id,
      operationRevision: revision,
      idFactory: input.idFactory,
      disabledReason: input.reason,
    })];
  }
  if (input.action.actionType === "restore.prepare") {
    const snapshotId = typeof input.action.payload.snapshotId === "string" ? input.action.payload.snapshotId : "";
    return [createRestorePrepareAction({
      operationId: input.snapshot.operation.id,
      operationRevision: revision,
      idFactory: input.idFactory,
      snapshotId,
      disabledReason: input.reason,
    })];
  }
  return [];
}

async function attachArtifactOnce(
  repository: OperationRepository,
  artifact: Omit<OperationArtifact, "createdAt">,
  actorUserId: string | null,
  now?: string,
): Promise<void> {
  const existing = await repository.listArtifacts(artifact.operationId, { limit: 200 });
  if (existing.some((candidate) => candidate.id === artifact.id)) return;
  await repository.attachArtifact({
    artifact,
    actorType: "system",
    actorId: actorUserId,
    now,
  });
}

function restorePlanArtifactMetadata(plan: RestorePlan): Record<string, unknown> {
  return {
    restorePlanId: plan.id,
    snapshotId: plan.snapshotId,
    status: plan.status,
    archivePath: plan.archivePath,
    archiveHash: plan.archiveHash,
    archiveSizeBytes: plan.archiveSizeBytes,
    manifestSchemaVersion: plan.manifestSchemaVersion,
    restorePlanVersion: plan.restorePlanVersion,
    validationWarnings: plan.validationWarnings,
  };
}
