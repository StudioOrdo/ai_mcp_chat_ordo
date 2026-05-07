import type {
  OperationAction,
  OperationConfirmPolicy,
  OperationRiskLevel,
  OperationStatus,
} from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";

export const MEDIA_WORKFLOW_OPERATION_ACTION_TYPES = [
  "media.workflow.create",
  "media.workflow.retry_step",
  "media.workflow.cancel",
] as const;

export type MediaWorkflowOperationActionType = typeof MEDIA_WORKFLOW_OPERATION_ACTION_TYPES[number];

export const MEDIA_WORKFLOW_OPERATION_STEP_KINDS = [
  "media.generate_chart",
  "media.generate_audio",
  "media.generate_image",
  "media.compose",
  "media.reuse_asset",
] as const;

export type MediaWorkflowOperationStepKind = typeof MEDIA_WORKFLOW_OPERATION_STEP_KINDS[number];

export const MEDIA_WORKFLOW_SOURCE_STEP_KINDS = [
  "generate_chart",
  "generate_audio",
  "generate_image",
  "compose_media",
  "reuse_asset",
] as const;

export type MediaWorkflowSourceStepKind = typeof MEDIA_WORKFLOW_SOURCE_STEP_KINDS[number];

export type MediaWorkflowOperationIdFactory = (prefix: string) => string;

export type MediaWorkflowTemplate =
  | "generated_audio"
  | "compose_media"
  | "visual_audio_video"
  | "chart_audio_video";

export interface MediaWorkflowCreatePayload extends Record<string, unknown> {
  requestedDeliverable: string;
  template: MediaWorkflowTemplate | string;
  idempotencyKey: string;
  conversationId?: string | null;
  originMessageId?: string | null;
  originTurnId?: string | null;
  requestedText?: string | null;
  providerChoices?: Record<string, unknown>;
  toolChoices?: Record<string, unknown>;
  audio?: Record<string, unknown>;
  visual?: Record<string, unknown>;
  compose?: Record<string, unknown>;
  request?: Record<string, unknown>;
}

export interface MediaWorkflowRetryStepPayload extends Record<string, unknown> {
  workflowId: string;
  stepId: string;
  idempotencyKey: string;
}

export interface MediaWorkflowCancelPayload extends Record<string, unknown> {
  workflowId: string;
  reason: string;
}

export interface MediaWorkflowJobOperationMetadata {
  operationId: string;
  stepId: string;
  actionId: string;
  operationKind: "media_workflow";
  workflowId: string;
  workflowStepId: string;
}

export interface MediaWorkflowActionFactoryBase {
  operationId: string;
  operationRevision: number;
  idFactory: MediaWorkflowOperationIdFactory;
  enabled?: boolean;
  disabledReason?: string | null;
  expiresAt?: string | null;
}

const AUTHENTICATED_ROLES: readonly RoleName[] = ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"];

const ACTION_TO_STEP_KIND: Partial<Record<MediaWorkflowOperationActionType, MediaWorkflowOperationStepKind>> = {
  "media.workflow.create": "media.compose",
  "media.workflow.retry_step": "media.compose",
  "media.workflow.cancel": "media.compose",
};

const SOURCE_STEP_TO_OPERATION_STEP_KIND: Record<MediaWorkflowSourceStepKind, MediaWorkflowOperationStepKind> = {
  generate_chart: "media.generate_chart",
  generate_audio: "media.generate_audio",
  generate_image: "media.generate_image",
  compose_media: "media.compose",
  reuse_asset: "media.reuse_asset",
};

export function isMediaWorkflowOperationActionType(value: string): value is MediaWorkflowOperationActionType {
  return (MEDIA_WORKFLOW_OPERATION_ACTION_TYPES as readonly string[]).includes(value);
}

export function mediaWorkflowStepKindForAction(
  actionType: MediaWorkflowOperationActionType,
): MediaWorkflowOperationStepKind {
  return ACTION_TO_STEP_KIND[actionType] ?? "media.compose";
}

export function mediaWorkflowOperationStepKindForMediaStepKind(
  stepKind: MediaWorkflowSourceStepKind | string,
): MediaWorkflowOperationStepKind {
  if ((MEDIA_WORKFLOW_SOURCE_STEP_KINDS as readonly string[]).includes(stepKind)) {
    return SOURCE_STEP_TO_OPERATION_STEP_KIND[stepKind as MediaWorkflowSourceStepKind];
  }
  throw new Error(`Unsupported media workflow step kind: ${stepKind}`);
}

export function mediaWorkflowOperationStepId(
  operationId: string,
  workflowStepId: string,
): string {
  return `${operationId}:media_step:${workflowStepId}`;
}

export function createMediaWorkflowCreateAction(input: MediaWorkflowActionFactoryBase & {
  payload: MediaWorkflowCreatePayload | Record<string, unknown>;
}): OperationAction {
  return createAction(input, {
    actionType: "media.workflow.create",
    label: "Create media workflow",
    riskLevel: "medium",
    confirmPolicy: "single_click",
    allowedStatuses: ["draft", "blocked"],
    payloadSchemaKey: "media.workflow.create",
    payload: input.payload,
  });
}

export function createMediaWorkflowRetryStepAction(input: MediaWorkflowActionFactoryBase & {
  workflowId: string;
  stepId: string;
  idempotencyKey?: string;
}): OperationAction {
  return createAction(input, {
    actionType: "media.workflow.retry_step",
    label: "Retry media step",
    riskLevel: "medium",
    confirmPolicy: "single_click",
    allowedStatuses: ["blocked", "failed"],
    payloadSchemaKey: "media.workflow.retry_step",
    payload: {
      workflowId: input.workflowId,
      stepId: input.stepId,
      idempotencyKey: input.idempotencyKey ?? input.idFactory("media_retry"),
    },
  });
}

export function createMediaWorkflowCancelAction(input: MediaWorkflowActionFactoryBase & {
  workflowId: string;
  reason?: string;
}): OperationAction {
  return createAction(input, {
    actionType: "media.workflow.cancel",
    label: "Cancel media workflow",
    riskLevel: "low",
    confirmPolicy: "single_click",
    allowedStatuses: ["draft", "awaiting_confirmation", "queued", "running", "blocked"],
    payloadSchemaKey: "media.workflow.cancel",
    payload: {
      workflowId: input.workflowId,
      reason: input.reason ?? "User requested cancellation.",
    },
  });
}

function createAction(
  input: MediaWorkflowActionFactoryBase,
  definition: {
    actionType: MediaWorkflowOperationActionType;
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
    allowedRoles: AUTHENTICATED_ROLES,
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
