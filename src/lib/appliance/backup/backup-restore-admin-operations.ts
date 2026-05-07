import { randomUUID } from "node:crypto";

import type { OperationActionConfirmation, OperationKind } from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";
import {
  createBackupCreateAction,
  createBackupValidateAction,
  createRestorePrepareAction,
} from "@/core/use-cases/operations/BackupRestoreOperationActions";
import {
  getBackupSelfService,
  getOperationRepository,
} from "@/adapters/RepositoryFactory";
import { createBackupRestoreOperationReconciler, createOperationActionDispatchService } from "@/lib/operations/operation-action-dispatch-root";

export interface AdminOperationActor {
  userId: string | null;
  role: RoleName;
}

export async function getBackupDashboardAfterReconciliation() {
  await createBackupRestoreOperationReconciler().reconcileRecent();
  return getBackupSelfService().getDashboard();
}

export async function createAdminBackupOperation(actor: AdminOperationActor) {
  const repository = getOperationRepository();
  const operationId = `op_${randomUUID()}`;
  await repository.createOperation({
    id: operationId,
    kind: "backup_create",
    title: "Create appliance backup",
    status: "draft",
    riskLevel: "medium",
    createdByUserId: actor.userId,
    createdByRole: actor.role,
    visibility: "admin",
    input: { request: { source: "admin_backup_page" } },
    actorType: "user",
    actorId: actor.userId,
  });
  await exposeInitialAction(operationId, "backup_create", actor, {});
  const snapshot = await repository.findOperationById(operationId);
  const action = snapshot?.actions.find((candidate) => candidate.actionType === "backup.create");
  if (!snapshot || !action) throw new Error("Backup operation action was not created.");
  return createOperationActionDispatchService({ repository }).dispatch({
    operationId,
    actionId: action.id,
    idempotencyKey: action.idempotencyKey,
    clientOperationRevision: action.operationRevision,
    actorUserId: actor.userId,
    actorRole: actor.role,
    confirmation: { confirmed: true },
  });
}

export async function createAdminBackupValidationOperation(snapshotId: string, actor: AdminOperationActor) {
  const repository = getOperationRepository();
  const operationId = `op_${randomUUID()}`;
  await repository.createOperation({
    id: operationId,
    kind: "backup_create",
    title: `Validate backup ${snapshotId}`,
    status: "draft",
    riskLevel: "medium",
    createdByUserId: actor.userId,
    createdByRole: actor.role,
    visibility: "admin",
    input: { request: { source: "admin_backup_page", snapshotId } },
    actorType: "user",
    actorId: actor.userId,
  });
  await exposeInitialAction(operationId, "backup_create", actor, { snapshotId, validateOnly: true });
  const snapshot = await repository.findOperationById(operationId);
  const action = snapshot?.actions.find((candidate) => candidate.actionType === "backup.validate");
  if (!snapshot || !action) throw new Error("Backup validation operation action was not created.");
  return createOperationActionDispatchService({ repository }).dispatch({
    operationId,
    actionId: action.id,
    idempotencyKey: action.idempotencyKey,
    clientOperationRevision: action.operationRevision,
    actorUserId: actor.userId,
    actorRole: actor.role,
    confirmation: { confirmed: true },
  });
}

export async function createAdminRestoreOperation(snapshotId: string, actor: AdminOperationActor) {
  const repository = getOperationRepository();
  const operationId = `op_${randomUUID()}`;
  await repository.createOperation({
    id: operationId,
    kind: "restore_execute",
    title: `Restore appliance from ${snapshotId}`,
    status: "draft",
    riskLevel: "destructive",
    createdByUserId: actor.userId,
    createdByRole: actor.role,
    visibility: "admin",
    input: { request: { source: "admin_backup_page", snapshotId } },
    actorType: "user",
    actorId: actor.userId,
  });
  await exposeInitialAction(operationId, "restore_execute", actor, { snapshotId });
  const snapshot = await repository.findOperationById(operationId);
  const action = snapshot?.actions.find((candidate) => candidate.actionType === "restore.prepare");
  if (!snapshot || !action) throw new Error("Restore operation action was not created.");
  return createOperationActionDispatchService({ repository }).dispatch({
    operationId,
    actionId: action.id,
    idempotencyKey: action.idempotencyKey,
    clientOperationRevision: action.operationRevision,
    actorUserId: actor.userId,
    actorRole: actor.role,
    confirmation: { confirmed: true },
  });
}

export async function dispatchAdminRestorePlanOperationAction(input: {
  planId: string;
  actionType: "restore.confirm" | "restore.create_safety_backup" | "restore.execute" | "restore.cancel";
  actor: AdminOperationActor;
  confirmationPhrase?: string;
}) {
  const repository = getOperationRepository();
  await createBackupRestoreOperationReconciler().reconcileRecent();
  const operation = await findRestoreOperationByPlanId(input.planId);
  if (!operation) throw new Error(`Operation for restore plan ${input.planId} was not found.`);
  const availableActions = await repository.listAvailableActions(operation.operation.id);
  const action = availableActions.find((candidate) => candidate.actionType === input.actionType);
  if (!action) throw new Error(`Restore action ${input.actionType} is not currently available.`);

  return createOperationActionDispatchService({ repository }).dispatch({
    operationId: operation.operation.id,
    actionId: action.id,
    idempotencyKey: action.idempotencyKey,
    clientOperationRevision: action.operationRevision,
    actorUserId: input.actor.userId,
    actorRole: input.actor.role,
    confirmation: confirmationForAction(action.confirmPolicy, input.confirmationPhrase ?? action.confirmationText ?? ""),
  });
}

async function exposeInitialAction(
  operationId: string,
  kind: OperationKind,
  actor: AdminOperationActor,
  input: Record<string, unknown>,
): Promise<void> {
  const repository = getOperationRepository();
  const snapshot = await repository.findOperationById(operationId);
  if (!snapshot) throw new Error(`Operation not found: ${operationId}`);
  const idFactory = (prefix: string) => `${prefix}_${randomUUID()}`;
  const action = input.validateOnly === true
    ? createBackupValidateAction({
        operationId,
        operationRevision: snapshot.operation.revision,
        idFactory,
        snapshotId: String(input.snapshotId ?? ""),
      })
    : kind === "backup_create"
      ? createBackupCreateAction({
          operationId,
          operationRevision: snapshot.operation.revision,
          idFactory,
        })
      : createRestorePrepareAction({
          operationId,
          operationRevision: snapshot.operation.revision,
          idFactory,
          snapshotId: String(input.snapshotId ?? ""),
        });

  await repository.replaceActions({
    operationId,
    actions: [action],
    actorType: "user",
    actorId: actor.userId,
  });
}

async function findRestoreOperationByPlanId(planId: string) {
  const repository = getOperationRepository();
  const summaries = await repository.listOperationsForAdmin({ kind: "restore_execute", limit: 100 });
  for (const summary of summaries) {
    const snapshot = await repository.findOperationById(summary.id);
    if (!snapshot) continue;
    if (snapshot.artifacts.some((artifact) => artifact.kind === "restore_plan" && artifact.metadata.restorePlanId === planId)) {
      return snapshot;
    }
    if (snapshot.actions.some((action) => action.payload.restorePlanId === planId)) {
      return snapshot;
    }
    if (snapshot.steps.some((step) => step.output?.restorePlanId === planId || step.resourceRef?.id === planId)) {
      return snapshot;
    }
  }
  return null;
}

function confirmationForAction(
  policy: "none" | "single_click" | "phrase" | "admin_reauth",
  phrase: string,
): OperationActionConfirmation {
  switch (policy) {
    case "none":
      return {};
    case "single_click":
      return { confirmed: true };
    case "phrase":
      return { phrase };
    case "admin_reauth":
      return { reauthenticated: true };
  }
}
