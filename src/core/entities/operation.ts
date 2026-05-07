import type { RoleName } from "./user";

export const OPERATION_KINDS = [
  "backup_create",
  "restore_execute",
  "media_workflow",
  "factory_work_order",
  "system_diagnostic",
  "tool_task",
  "content_publish",
  "onboarding_flow",
  "help_flow",
] as const;

export type OperationKind = typeof OPERATION_KINDS[number];

export const OPERATION_STATUSES = [
  "draft",
  "awaiting_confirmation",
  "queued",
  "running",
  "blocked",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
] as const;

export type OperationStatus = typeof OPERATION_STATUSES[number];

export const OPERATION_STEP_STATUSES = [
  "pending",
  "ready",
  "running",
  "blocked",
  "succeeded",
  "failed",
  "skipped",
  "cancelled",
] as const;

export type OperationStepStatus = typeof OPERATION_STEP_STATUSES[number];

export const OPERATION_RISK_LEVELS = [
  "info",
  "low",
  "medium",
  "high",
  "destructive",
] as const;

export type OperationRiskLevel = typeof OPERATION_RISK_LEVELS[number];

export const OPERATION_VISIBILITIES = [
  "conversation",
  "user",
  "staff",
  "admin",
  "system",
] as const;

export type OperationVisibility = typeof OPERATION_VISIBILITIES[number];

export const OPERATION_CONFIRM_POLICIES = [
  "none",
  "single_click",
  "phrase",
  "admin_reauth",
] as const;

export type OperationConfirmPolicy = typeof OPERATION_CONFIRM_POLICIES[number];

export const OPERATION_EVENT_TYPES = [
  "operation_created",
  "operation_status_changed",
  "step_status_changed",
  "action_exposed",
  "action_requested",
  "action_rejected",
  "artifact_attached",
  "executor_event_received",
  "operation_completed",
] as const;

export type OperationEventType = typeof OPERATION_EVENT_TYPES[number];

export type OperationActorType = "user" | "system" | "worker" | "llm";

export interface OperationErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface OperationResourceRef {
  type: string;
  id: string;
  uri?: string;
}

export interface Operation {
  id: string;
  kind: OperationKind;
  revision: number;
  title: string;
  status: OperationStatus;
  riskLevel: OperationRiskLevel;
  conversationId: string | null;
  originMessageId: string | null;
  createdByUserId: string | null;
  createdByRole: RoleName;
  visibility: OperationVisibility;
  currentStepId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  summary: string | null;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: OperationErrorPayload | null;
}

export interface OperationStep {
  id: string;
  operationId: string;
  sequence: number;
  kind: string;
  status: OperationStepStatus;
  dependsOnStepIds: readonly string[];
  capabilityName: string | null;
  jobId: string | null;
  systemCommandId: string | null;
  resourceRef: OperationResourceRef | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: OperationErrorPayload | null;
  retryCount: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface OperationAction {
  id: string;
  operationId: string;
  operationRevision: number;
  actionType: string;
  label: string;
  riskLevel: OperationRiskLevel;
  confirmPolicy: OperationConfirmPolicy;
  allowedRoles: readonly RoleName[];
  allowedStatuses: readonly OperationStatus[];
  enabled: boolean;
  disabledReason: string | null;
  idempotencyKey: string;
  expiresAt: string | null;
  payload: Record<string, unknown>;
  payloadSchemaKey: string;
  confirmationText?: string | null;
}

export interface OperationActionConfirmation {
  confirmed?: boolean;
  phrase?: string;
  reauthenticated?: boolean;
}

export interface OperationEvent {
  id: string;
  operationId: string;
  stepId: string | null;
  sequence: number;
  type: OperationEventType;
  actorType: OperationActorType;
  actorId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface OperationArtifact {
  id: string;
  operationId: string;
  stepId: string | null;
  kind: string;
  uri: string;
  label: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface OperationKindDefinition {
  kind: OperationKind;
  label: string;
  description: string;
  defaultRiskLevel: OperationRiskLevel;
  defaultVisibility: OperationVisibility;
  allowedRoles: readonly RoleName[];
  supportsRetry: boolean;
  requiresConversation: boolean;
  handlerKey: string;
}

export type OperationErrorCode =
  | "OPERATION_NOT_FOUND"
  | "OPERATION_TRANSITION_INVALID"
  | "OPERATION_ACTION_REJECTED"
  | "OPERATION_ACTION_STALE"
  | "OPERATION_AUTHORIZATION_DENIED"
  | "OPERATION_PAYLOAD_INVALID"
  | "OPERATION_KIND_NOT_REGISTERED";

export class OperationDomainError extends Error {
  readonly code: OperationErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: OperationErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class OperationNotFoundError extends OperationDomainError {
  constructor(operationId: string) {
    super("OPERATION_NOT_FOUND", `Operation not found: ${operationId}`, { operationId });
  }
}

export class OperationTransitionError extends OperationDomainError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("OPERATION_TRANSITION_INVALID", message, details);
  }
}

export class OperationActionRejectedError extends OperationDomainError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("OPERATION_ACTION_REJECTED", message, details);
  }
}

export class OperationActionStaleError extends OperationDomainError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("OPERATION_ACTION_STALE", message, details);
  }
}

export class OperationAuthorizationError extends OperationDomainError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("OPERATION_AUTHORIZATION_DENIED", message, details);
  }
}

export class OperationPayloadValidationError extends OperationDomainError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("OPERATION_PAYLOAD_INVALID", message, details);
  }
}

export class OperationKindNotRegisteredError extends OperationDomainError {
  constructor(kind: string) {
    super("OPERATION_KIND_NOT_REGISTERED", `Operation kind is not registered: ${kind}`, { kind });
  }
}

export function isOperationKind(value: string): value is OperationKind {
  return (OPERATION_KINDS as readonly string[]).includes(value);
}

export function isOperationStatus(value: string): value is OperationStatus {
  return (OPERATION_STATUSES as readonly string[]).includes(value);
}

export function isOperationStepStatus(value: string): value is OperationStepStatus {
  return (OPERATION_STEP_STATUSES as readonly string[]).includes(value);
}

export function isOperationRiskLevel(value: string): value is OperationRiskLevel {
  return (OPERATION_RISK_LEVELS as readonly string[]).includes(value);
}

export function isOperationVisibility(value: string): value is OperationVisibility {
  return (OPERATION_VISIBILITIES as readonly string[]).includes(value);
}

export function isOperationConfirmPolicy(value: string): value is OperationConfirmPolicy {
  return (OPERATION_CONFIRM_POLICIES as readonly string[]).includes(value);
}

export function isOperationEventType(value: string): value is OperationEventType {
  return (OPERATION_EVENT_TYPES as readonly string[]).includes(value);
}

export function isOperationActorType(value: string): value is OperationActorType {
  return value === "user" || value === "system" || value === "worker" || value === "llm";
}

export function isTerminalOperationStatus(status: OperationStatus): boolean {
  return status === "succeeded" || status === "cancelled" || status === "expired";
}

export function isTerminalOperationStepStatus(status: OperationStepStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "skipped" || status === "cancelled";
}

export function isDestructiveOperation(value: OperationRiskLevel | { riskLevel: OperationRiskLevel }): boolean {
  return typeof value === "string" ? value === "destructive" : value.riskLevel === "destructive";
}
