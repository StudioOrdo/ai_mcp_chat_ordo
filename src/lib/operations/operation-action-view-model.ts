import type {
  ActionLinkInlineNode,
} from "@/core/entities/rich-content";
import type {
  OperationAction,
  OperationActionConfirmation,
  OperationConfirmPolicy,
  OperationRiskLevel,
} from "@/core/entities/operation";

export interface OperationActionLinkModel {
  operationId: string;
  actionId: string;
  idempotencyKey: string;
  operationRevision: number;
  payload: Record<string, unknown>;
  confirmPolicy: OperationConfirmPolicy;
  confirmationText: string | null;
  riskLevel: OperationRiskLevel;
  disabledReason: string | null;
}

export interface OperationActionDispatchPayload {
  idempotencyKey: string;
  operationRevision: number;
  payload?: Record<string, unknown>;
  confirmation?: OperationActionConfirmation;
}

export class OperationActionViewModelError extends Error {
  readonly code = "OPERATION_ACTION_VIEW_MODEL_INVALID";
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "OperationActionViewModelError";
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function stringifyPayload(payload: Record<string, unknown>): string | undefined {
  return Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePayloadJson(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new OperationActionViewModelError("payloadJson is malformed.", { field: "payloadJson" });
  }
  if (!isRecord(parsed)) {
    throw new OperationActionViewModelError("payloadJson must decode to an object.", { field: "payloadJson" });
  }
  return parsed;
}

function parseRequiredString(params: Record<string, string> | undefined, key: string): string {
  const value = params?.[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new OperationActionViewModelError(`${key} is required.`, { field: key });
  }
  return value.trim();
}

function parseOperationRevision(params: Record<string, string> | undefined): number {
  const raw = parseRequiredString(params, "operationRevision");
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new OperationActionViewModelError("operationRevision must be a positive integer.", { field: "operationRevision" });
  }
  return parsed;
}

function parseConfirmPolicy(value: string | undefined): OperationConfirmPolicy {
  if (value === "none" || value === "single_click" || value === "phrase" || value === "admin_reauth") {
    return value;
  }
  return "none";
}

function parseRiskLevel(value: string | undefined): OperationRiskLevel {
  if (value === "info" || value === "low" || value === "medium" || value === "high" || value === "destructive") {
    return value;
  }
  return "info";
}

export function operationActionToActionLink(action: OperationAction): ActionLinkInlineNode {
  const payloadJson = stringifyPayload(action.payload);
  return {
    type: "action-link",
    label: action.label,
    actionType: "operation",
    value: action.operationId,
    params: {
      operationId: action.operationId,
      actionId: action.id,
      idempotencyKey: action.idempotencyKey,
      operationRevision: String(action.operationRevision),
      confirmPolicy: action.confirmPolicy,
      riskLevel: action.riskLevel,
      ...(payloadJson ? { payloadJson } : {}),
      ...(action.confirmationText ? { confirmationText: action.confirmationText } : {}),
      ...(action.disabledReason ? { disabledReason: action.disabledReason } : {}),
    },
  };
}

export function operationActionsToActionLinks(actions: readonly OperationAction[]): ActionLinkInlineNode[] {
  return actions.map(operationActionToActionLink);
}

export function parseOperationActionLinkModel(
  value: string,
  params?: Record<string, string>,
): OperationActionLinkModel {
  const operationId = parseRequiredString(params, "operationId") || value;
  if (operationId !== value && value.trim() && value.trim() !== operationId) {
    throw new OperationActionViewModelError("Operation action value does not match params.operationId.", {
      value,
      operationId,
    });
  }

  return {
    operationId,
    actionId: parseRequiredString(params, "actionId"),
    idempotencyKey: parseRequiredString(params, "idempotencyKey"),
    operationRevision: parseOperationRevision(params),
    payload: parsePayloadJson(params?.payloadJson),
    confirmPolicy: parseConfirmPolicy(params?.confirmPolicy),
    confirmationText: params?.confirmationText ?? null,
    riskLevel: parseRiskLevel(params?.riskLevel),
    disabledReason: params?.disabledReason ?? null,
  };
}

export function buildOperationActionDispatchPayload(
  model: OperationActionLinkModel,
  confirmation?: OperationActionConfirmation,
): OperationActionDispatchPayload {
  return {
    idempotencyKey: model.idempotencyKey,
    operationRevision: model.operationRevision,
    ...(Object.keys(model.payload).length > 0 ? { payload: model.payload } : {}),
    ...(confirmation ? { confirmation } : {}),
  };
}
