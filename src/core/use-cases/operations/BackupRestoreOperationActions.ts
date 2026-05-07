import type {
  OperationAction,
  OperationConfirmPolicy,
  OperationRiskLevel,
  OperationStatus,
} from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";

export const BACKUP_RESTORE_OPERATION_ACTION_TYPES = [
  "backup.create",
  "backup.validate",
  "restore.prepare",
  "restore.confirm",
  "restore.create_safety_backup",
  "restore.execute",
  "restore.cancel",
] as const;

export type BackupRestoreOperationActionType = typeof BACKUP_RESTORE_OPERATION_ACTION_TYPES[number];

export const BACKUP_RESTORE_OPERATION_STEP_KINDS = [
  "backup.create",
  "backup.validate",
  "restore.prepare",
  "restore.confirm",
  "restore.safety_backup",
  "restore.execute",
  "restore.verify",
] as const;

export type BackupRestoreOperationStepKind = typeof BACKUP_RESTORE_OPERATION_STEP_KINDS[number];

export type BackupRestoreOperationIdFactory = (prefix: string) => string;

export interface BackupRestoreActionFactoryBase {
  operationId: string;
  operationRevision: number;
  idFactory: BackupRestoreOperationIdFactory;
  enabled?: boolean;
  disabledReason?: string | null;
  expiresAt?: string | null;
}

export interface RestoreActionFactoryBase extends BackupRestoreActionFactoryBase {
  restorePlanId: string;
}

const ADMIN_ONLY: readonly RoleName[] = ["ADMIN"];

const ACTION_TO_STEP_KIND: Record<BackupRestoreOperationActionType, BackupRestoreOperationStepKind> = {
  "backup.create": "backup.create",
  "backup.validate": "backup.validate",
  "restore.prepare": "restore.prepare",
  "restore.confirm": "restore.confirm",
  "restore.create_safety_backup": "restore.safety_backup",
  "restore.execute": "restore.execute",
  "restore.cancel": "restore.execute",
};

export function backupRestoreStepKindForAction(
  actionType: BackupRestoreOperationActionType,
): BackupRestoreOperationStepKind {
  return ACTION_TO_STEP_KIND[actionType];
}

export function backupRestoreStepId(
  operationId: string,
  stepKind: BackupRestoreOperationStepKind,
): string {
  return `${operationId}:${stepKind}`;
}

export function backupRestoreActionId(
  operationId: string,
  actionType: BackupRestoreOperationActionType,
): string {
  return `${operationId}:${actionType}`;
}

export function createBackupCreateAction(input: BackupRestoreActionFactoryBase): OperationAction {
  return createAction(input, {
    actionType: "backup.create",
    label: "Create backup",
    riskLevel: "medium",
    confirmPolicy: "single_click",
    allowedStatuses: ["draft", "blocked"],
    payloadSchemaKey: "backup.create",
    payload: {},
  });
}

export function createBackupValidateAction(input: BackupRestoreActionFactoryBase & {
  snapshotId: string;
}): OperationAction {
  return createAction(input, {
    actionType: "backup.validate",
    label: "Validate backup",
    riskLevel: "medium",
    confirmPolicy: "single_click",
    allowedStatuses: ["draft", "awaiting_confirmation", "blocked", "queued", "running"],
    payloadSchemaKey: "backup.validate",
    payload: { snapshotId: input.snapshotId },
  });
}

export function createRestorePrepareAction(input: BackupRestoreActionFactoryBase & {
  snapshotId: string;
}): OperationAction {
  return createAction(input, {
    actionType: "restore.prepare",
    label: "Prepare restore",
    riskLevel: "destructive",
    confirmPolicy: "single_click",
    allowedStatuses: ["draft", "blocked"],
    payloadSchemaKey: "restore.prepare",
    payload: { snapshotId: input.snapshotId },
  });
}

export function createRestoreConfirmAction(input: RestoreActionFactoryBase & {
  confirmationText: string;
}): OperationAction {
  return createAction(input, {
    actionType: "restore.confirm",
    label: "Confirm restore",
    riskLevel: "destructive",
    confirmPolicy: "phrase",
    allowedStatuses: ["awaiting_confirmation"],
    payloadSchemaKey: "restore.confirm",
    payload: { restorePlanId: input.restorePlanId },
    confirmationText: input.confirmationText,
  });
}

export function createRestoreSafetyBackupAction(input: RestoreActionFactoryBase): OperationAction {
  return createAction(input, {
    actionType: "restore.create_safety_backup",
    label: "Create safety backup",
    riskLevel: "destructive",
    confirmPolicy: "single_click",
    allowedStatuses: ["blocked", "awaiting_confirmation"],
    payloadSchemaKey: "restore.create_safety_backup",
    payload: { restorePlanId: input.restorePlanId },
  });
}

export function createRestoreExecuteAction(input: RestoreActionFactoryBase): OperationAction {
  return createAction(input, {
    actionType: "restore.execute",
    label: "Execute restore",
    riskLevel: "destructive",
    confirmPolicy: "phrase",
    allowedStatuses: ["blocked"],
    payloadSchemaKey: "restore.execute",
    payload: { restorePlanId: input.restorePlanId },
    confirmationText: restoreExecuteConfirmationText(input.restorePlanId),
  });
}

export function createRestoreCancelAction(input: RestoreActionFactoryBase): OperationAction {
  return createAction(input, {
    actionType: "restore.cancel",
    label: "Cancel restore",
    riskLevel: "medium",
    confirmPolicy: "single_click",
    allowedStatuses: ["draft", "awaiting_confirmation", "blocked", "queued", "running"],
    payloadSchemaKey: "restore.cancel",
    payload: { restorePlanId: input.restorePlanId },
  });
}

export function restoreExecuteConfirmationText(restorePlanId: string): string {
  return `EXECUTE ${restorePlanId.slice(0, 16)}`;
}

function createAction(
  input: BackupRestoreActionFactoryBase,
  definition: {
    actionType: BackupRestoreOperationActionType;
    label: string;
    riskLevel: OperationRiskLevel;
    confirmPolicy: OperationConfirmPolicy;
    allowedStatuses: readonly OperationStatus[];
    payloadSchemaKey: string;
    payload: Record<string, unknown>;
    confirmationText?: string | null;
  },
): OperationAction {
  const enabled = input.enabled ?? input.disabledReason == null;
  const id = input.idFactory("act");
  return {
    id,
    operationId: input.operationId,
    operationRevision: input.operationRevision,
    actionType: definition.actionType,
    label: definition.label,
    riskLevel: definition.riskLevel,
    confirmPolicy: definition.confirmPolicy,
    allowedRoles: ADMIN_ONLY,
    allowedStatuses: definition.allowedStatuses,
    enabled,
    disabledReason: enabled ? null : input.disabledReason ?? "Action is not currently available.",
    idempotencyKey: input.idFactory("idem"),
    expiresAt: input.expiresAt ?? null,
    payload: definition.payload,
    payloadSchemaKey: definition.payloadSchemaKey,
    confirmationText: definition.confirmationText ?? null,
  };
}
