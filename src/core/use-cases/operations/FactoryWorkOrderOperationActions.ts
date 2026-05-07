import type {
  OperationAction,
  OperationConfirmPolicy,
  OperationRiskLevel,
  OperationStatus,
} from "@/core/entities/operation";
import type { ProductBrief } from "@/core/entities/product-brief";
import { listProductBriefValidationErrors } from "@/core/entities/product-brief";
import type { RoleName } from "@/core/entities/user";

export const FACTORY_WORK_ORDER_OPERATION_ACTION_TYPES = [
  "factory.work_order.create",
  "factory.work_order.pause",
  "factory.work_order.refine_asset",
  "factory.work_order.resume",
  "factory.work_order.retry_stage",
  "factory.work_order.cancel",
  "factory.work_order.approve_checkpoint",
] as const;

export type FactoryWorkOrderOperationActionType =
  typeof FACTORY_WORK_ORDER_OPERATION_ACTION_TYPES[number];

export const FACTORY_WORK_ORDER_OPERATION_STEP_KIND = "factory.stage" as const;

export type FactoryWorkOrderOperationIdFactory = (prefix: string) => string;

export type FactoryWorkOrderRefineMode =
  | "metadata_fix"
  | "replace_with_upload"
  | "regenerate";

export interface FactoryWorkOrderCreatePayload extends Record<string, unknown> {
  brief: ProductBrief;
  previousWorkOrderIds?: readonly string[];
}

export interface FactoryWorkOrderMutationPayload extends Record<string, unknown> {
  workOrderId: string;
}

export interface FactoryWorkOrderPausePayload extends FactoryWorkOrderMutationPayload {
  reason?: string;
}

export interface FactoryWorkOrderResumePayload extends FactoryWorkOrderMutationPayload {
  brief: ProductBrief;
  checkpointId: string;
  requestedStageKey?: string;
}

export interface FactoryWorkOrderRetryStagePayload extends FactoryWorkOrderMutationPayload {
  brief: ProductBrief;
  stageKey: string;
  checkpointId?: string;
}

export interface FactoryWorkOrderRefineAssetPayload extends FactoryWorkOrderMutationPayload {
  assetId: string;
  mode: FactoryWorkOrderRefineMode;
  checkpointId: string;
  brief?: ProductBrief;
  parameterOverrides?: Record<string, unknown>;
  requestedStageKey?: string;
  userFileId?: string;
}

export interface FactoryWorkOrderCancelPayload extends FactoryWorkOrderMutationPayload {
  reason?: string;
}

export interface FactoryWorkOrderApproveCheckpointPayload extends FactoryWorkOrderMutationPayload {
  checkpointId: string;
}

export interface FactoryWorkOrderActionFactoryBase {
  operationId: string;
  operationRevision: number;
  idFactory: FactoryWorkOrderOperationIdFactory;
  enabled?: boolean;
  disabledReason?: string | null;
  expiresAt?: string | null;
}

const STAFF_AND_ADMIN: readonly RoleName[] = ["STAFF", "ADMIN"];

export function isFactoryWorkOrderOperationActionType(
  value: string,
): value is FactoryWorkOrderOperationActionType {
  return (FACTORY_WORK_ORDER_OPERATION_ACTION_TYPES as readonly string[]).includes(value);
}

export function factoryWorkOrderOperationStepId(
  operationId: string,
  stageKey: string,
): string {
  return `${operationId}:factory_stage:${stageKey}`;
}

export function createFactoryWorkOrderCreateAction(input: FactoryWorkOrderActionFactoryBase & {
  payload: FactoryWorkOrderCreatePayload | Record<string, unknown>;
}): OperationAction {
  return createAction(input, {
    actionType: "factory.work_order.create",
    label: "Create work order",
    riskLevel: "medium",
    confirmPolicy: "single_click",
    allowedStatuses: ["draft", "blocked"],
    payloadSchemaKey: "factory.work_order.create",
    payload: input.payload,
  });
}

export function createFactoryWorkOrderPauseAction(input: FactoryWorkOrderActionFactoryBase & {
  payload: FactoryWorkOrderPausePayload;
}): OperationAction {
  return createAction(input, {
    actionType: "factory.work_order.pause",
    label: "Pause work order",
    riskLevel: "medium",
    confirmPolicy: "single_click",
    allowedStatuses: ["running"],
    payloadSchemaKey: "factory.work_order.pause",
    payload: input.payload,
  });
}

export function createFactoryWorkOrderRefineAssetAction(input: FactoryWorkOrderActionFactoryBase & {
  payload: FactoryWorkOrderRefineAssetPayload;
}): OperationAction {
  return createAction(input, {
    actionType: "factory.work_order.refine_asset",
    label: "Refine asset",
    riskLevel: "medium",
    confirmPolicy: "single_click",
    allowedStatuses: ["blocked"],
    payloadSchemaKey: "factory.work_order.refine_asset",
    payload: input.payload,
  });
}

export function createFactoryWorkOrderResumeAction(input: FactoryWorkOrderActionFactoryBase & {
  payload: FactoryWorkOrderResumePayload | Record<string, unknown>;
}): OperationAction {
  return createAction(input, {
    actionType: "factory.work_order.resume",
    label: "Resume work order",
    riskLevel: "medium",
    confirmPolicy: "single_click",
    allowedStatuses: ["blocked"],
    payloadSchemaKey: "factory.work_order.resume",
    payload: input.payload,
  });
}

export function createFactoryWorkOrderRetryStageAction(input: FactoryWorkOrderActionFactoryBase & {
  payload: FactoryWorkOrderRetryStagePayload | Record<string, unknown>;
}): OperationAction {
  return createAction(input, {
    actionType: "factory.work_order.retry_stage",
    label: "Retry stage",
    riskLevel: "medium",
    confirmPolicy: "single_click",
    allowedStatuses: ["blocked", "failed"],
    payloadSchemaKey: "factory.work_order.retry_stage",
    payload: input.payload,
  });
}

export function createFactoryWorkOrderCancelAction(input: FactoryWorkOrderActionFactoryBase & {
  payload: FactoryWorkOrderCancelPayload;
  running?: boolean;
}): OperationAction {
  return createAction(input, {
    actionType: "factory.work_order.cancel",
    label: "Cancel work order",
    riskLevel: input.running ? "high" : "medium",
    confirmPolicy: "single_click",
    allowedStatuses: ["draft", "queued", "running", "blocked"],
    payloadSchemaKey: "factory.work_order.cancel",
    payload: input.payload,
  });
}

export function createFactoryWorkOrderApproveCheckpointAction(input: FactoryWorkOrderActionFactoryBase & {
  payload: FactoryWorkOrderApproveCheckpointPayload;
}): OperationAction {
  return createAction(input, {
    actionType: "factory.work_order.approve_checkpoint",
    label: "Approve checkpoint",
    riskLevel: "medium",
    confirmPolicy: "single_click",
    allowedStatuses: ["blocked"],
    payloadSchemaKey: "factory.work_order.approve_checkpoint",
    payload: input.payload,
  });
}

export function listFactoryWorkOrderCreatePayloadErrors(payload: Record<string, unknown>): string[] {
  return listBriefPayloadErrors(payload, "brief");
}

export function listFactoryWorkOrderResumePayloadErrors(payload: Record<string, unknown>): string[] {
  return [
    ...requireAllNonEmptyStrings(payload, ["workOrderId", "checkpointId"]),
    ...listBriefPayloadErrors(payload, "brief"),
  ];
}

export function listFactoryWorkOrderRetryStagePayloadErrors(payload: Record<string, unknown>): string[] {
  return [
    ...requireAllNonEmptyStrings(payload, ["workOrderId", "stageKey"]),
    ...listBriefPayloadErrors(payload, "brief"),
  ];
}

export function listFactoryWorkOrderRefineAssetPayloadErrors(payload: Record<string, unknown>): string[] {
  const errors = [
    ...requireAllNonEmptyStrings(payload, ["workOrderId", "assetId", "checkpointId", "mode"]),
  ];
  const mode = payload.mode;

  if (!isFactoryWorkOrderRefineMode(mode)) {
    errors.push("mode must be one of metadata_fix, replace_with_upload, or regenerate.");
    return errors;
  }

  if (mode === "replace_with_upload") {
    errors.push(...requireAllNonEmptyStrings(payload, ["userFileId"]));
  }
  if (mode === "regenerate") {
    errors.push(...listBriefPayloadErrors(payload, "brief"));
  }

  return errors;
}

export function listFactoryWorkOrderApproveCheckpointPayloadErrors(payload: Record<string, unknown>): string[] {
  return requireAllNonEmptyStrings(payload, ["workOrderId", "checkpointId"]);
}

function createAction(
  input: FactoryWorkOrderActionFactoryBase,
  definition: {
    actionType: FactoryWorkOrderOperationActionType;
    label: string;
    riskLevel: OperationRiskLevel;
    confirmPolicy: OperationConfirmPolicy;
    allowedStatuses: readonly OperationStatus[];
    payloadSchemaKey: string;
    payload: Record<string, unknown>;
  },
): OperationAction {
  const enabled = input.enabled ?? input.disabledReason == null;
  return {
    id: input.idFactory("act"),
    operationId: input.operationId,
    operationRevision: input.operationRevision,
    actionType: definition.actionType,
    label: definition.label,
    riskLevel: definition.riskLevel,
    confirmPolicy: definition.confirmPolicy,
    allowedRoles: STAFF_AND_ADMIN,
    allowedStatuses: definition.allowedStatuses,
    enabled,
    disabledReason: enabled ? null : input.disabledReason ?? "Action is not currently available.",
    idempotencyKey: input.idFactory("idem"),
    expiresAt: input.expiresAt ?? null,
    payload: definition.payload,
    payloadSchemaKey: definition.payloadSchemaKey,
    confirmationText: null,
  };
}

function requireAllNonEmptyStrings(payload: Record<string, unknown>, fields: readonly string[]): string[] {
  return fields.flatMap((field) =>
    typeof payload[field] === "string" && payload[field].trim()
      ? []
      : [`${field} must be a non-empty string.`],
  );
}

function listBriefPayloadErrors(payload: Record<string, unknown>, field: string): string[] {
  const value = payload[field];
  if (!isRecord(value)) {
    return [`${field} must be a ProductBrief object.`];
  }

  try {
    return listProductBriefValidationErrors(value as unknown as ProductBrief);
  } catch {
    return [`${field} must be a valid ProductBrief object.`];
  }
}

function isFactoryWorkOrderRefineMode(value: unknown): value is FactoryWorkOrderRefineMode {
  return value === "metadata_fix" || value === "replace_with_upload" || value === "regenerate";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
