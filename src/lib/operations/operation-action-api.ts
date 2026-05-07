import {
  OperationActionDispatchError,
  type OperationActionDispatchErrorCode,
} from "@/core/use-cases/operations/OperationActionDispatch";
import {
  OperationDomainError,
  type OperationActionConfirmation,
} from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";

export interface ParsedOperationActionRequestBody {
  idempotencyKey: string;
  operationRevision: number;
  payload?: Record<string, unknown>;
  confirmation?: OperationActionConfirmation;
}

export class OperationActionRequestError extends Error {
  readonly code = "OPERATION_ACTION_REQUEST_INVALID";
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "OperationActionRequestError";
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const ROLE_STRENGTH: readonly RoleName[] = [
  "ADMIN",
  "STAFF",
  "APPRENTICE",
  "AUTHENTICATED",
  "ANONYMOUS",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new OperationActionRequestError(`${label} must be an object.`, { label });
  }
  return value;
}

function readOptionalRecord(value: unknown, label: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  return assertRecord(value, label);
}

export function resolveStrongestOperationRole(roles: readonly RoleName[]): RoleName {
  return ROLE_STRENGTH.find((role) => roles.includes(role)) ?? "ANONYMOUS";
}

export function parseOperationActionRequestBody(value: unknown): ParsedOperationActionRequestBody {
  const body = assertRecord(value, "operation action request");
  const idempotencyKey = body.idempotencyKey;
  const operationRevision = body.operationRevision;

  if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
    throw new OperationActionRequestError("idempotencyKey is required.", { field: "idempotencyKey" });
  }

  if (typeof operationRevision !== "number" || !Number.isSafeInteger(operationRevision) || operationRevision < 1) {
    throw new OperationActionRequestError("operationRevision must be a positive integer.", { field: "operationRevision" });
  }

  return {
    idempotencyKey: idempotencyKey.trim(),
    operationRevision,
    payload: readOptionalRecord(body.payload, "payload"),
    confirmation: parseConfirmation(body.confirmation),
  };
}

function parseConfirmation(value: unknown): OperationActionConfirmation | undefined {
  if (value === undefined) return undefined;
  const confirmation = assertRecord(value, "confirmation");

  return {
    ...(typeof confirmation.confirmed === "boolean" ? { confirmed: confirmation.confirmed } : {}),
    ...(typeof confirmation.phrase === "string" ? { phrase: confirmation.phrase } : {}),
    ...(typeof confirmation.reauthenticated === "boolean" ? { reauthenticated: confirmation.reauthenticated } : {}),
  };
}

export function statusForOperationActionError(error: unknown, actorRole: RoleName): number {
  if (error instanceof OperationActionRequestError) return 422;

  const code = operationActionErrorCode(error);
  if (!code) return 500;

  switch (code) {
    case "OPERATION_NOT_FOUND":
      return 404;
    case "OPERATION_ACTION_REQUEST_INVALID":
      return 422;
    case "OPERATION_AUTHORIZATION_DENIED":
      return actorRole === "ANONYMOUS" ? 401 : 403;
    case "OPERATION_PAYLOAD_INVALID":
      return 422;
    case "OPERATION_ACTION_EXECUTOR_UNAVAILABLE":
      return 501;
    case "OPERATION_ACTION_REJECTED":
      return error instanceof Error && /confirmation/i.test(error.message) ? 422 : 409;
    case "OPERATION_ACTION_STALE":
    case "OPERATION_TRANSITION_INVALID":
      return 409;
    default:
      code satisfies never;
      return 500;
  }
}

export function operationActionErrorCode(error: unknown): OperationActionDispatchErrorCode | "OPERATION_ACTION_REQUEST_INVALID" | null {
  if (error instanceof OperationActionRequestError) return error.code;
  if (error instanceof OperationActionDispatchError) return error.code;
  if (error instanceof OperationDomainError) {
    switch (error.code) {
      case "OPERATION_NOT_FOUND":
      case "OPERATION_TRANSITION_INVALID":
      case "OPERATION_ACTION_REJECTED":
      case "OPERATION_ACTION_STALE":
      case "OPERATION_AUTHORIZATION_DENIED":
      case "OPERATION_PAYLOAD_INVALID":
        return error.code;
      case "OPERATION_KIND_NOT_REGISTERED":
        return "OPERATION_ACTION_REJECTED";
      default:
        error.code satisfies never;
        return null;
    }
  }
  return null;
}

export function operationActionErrorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof OperationActionRequestError) return error.details;
  if (error instanceof OperationActionDispatchError) return error.details;
  if (error instanceof OperationDomainError) return error.details;
  return {};
}
