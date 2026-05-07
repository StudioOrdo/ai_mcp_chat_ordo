import { redactSecrets } from "@/lib/observability/secret-redaction";

export const NATIVE_COMMAND_SCHEMA_VERSION = "1" as const;

export const NATIVE_OPERATION_KINDS = [
  "backup_create",
  "restore_execute",
  "system_diagnostic",
] as const;

export type NativeOperationKind = typeof NATIVE_OPERATION_KINDS[number];

export interface NativeOperationRef extends Record<string, unknown> {
  operationId: string;
  stepId: string;
  actionId: string;
  operationKind: NativeOperationKind;
}

export interface NativeCommandArtifact {
  kind: string;
  uri: string;
  label: string;
  metadata: Record<string, unknown>;
}

export interface NativeCommandError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type NativeCommandMetricValue = number | string | boolean | null;

export interface NativeCommandResult extends Record<string, unknown> {
  schemaVersion: typeof NATIVE_COMMAND_SCHEMA_VERSION;
  commandId: string;
  operation: NativeOperationRef | null;
  status: "succeeded" | "failed";
  summary: string;
  artifacts: NativeCommandArtifact[];
  metrics: Record<string, NativeCommandMetricValue>;
  error: NativeCommandError | null;
}

export class NativeCommandContractError extends Error {
  constructor(message: string, readonly details: Record<string, unknown> = {}) {
    super(message);
    this.name = "NativeCommandContractError";
  }
}

export function parseNativeOperationRef(value: unknown, label = "operation"): NativeOperationRef {
  const record = requireRecord(value, label);
  const operationId = requireString(record.operationId, `${label}.operationId`);
  const stepId = requireString(record.stepId, `${label}.stepId`);
  const actionId = requireString(record.actionId, `${label}.actionId`);
  const operationKind = requireString(record.operationKind, `${label}.operationKind`);
  if (!isNativeOperationKind(operationKind)) {
    throw new NativeCommandContractError(`${label}.operationKind is not supported.`, {
      operationKind,
      allowed: NATIVE_OPERATION_KINDS,
    });
  }
  return { operationId, stepId, actionId, operationKind };
}

export function parseNativeCommandResult(value: unknown): NativeCommandResult {
  const record = requireRecord(value, "native command result");
  const schemaVersion = requireString(record.schemaVersion, "result.schemaVersion");
  if (schemaVersion !== NATIVE_COMMAND_SCHEMA_VERSION) {
    throw new NativeCommandContractError("Native command result schemaVersion is not supported.", {
      schemaVersion,
      expected: NATIVE_COMMAND_SCHEMA_VERSION,
    });
  }

  const status = requireString(record.status, "result.status");
  if (status !== "succeeded" && status !== "failed") {
    throw new NativeCommandContractError("Native command result status is invalid.", { status });
  }

  return {
    schemaVersion,
    commandId: requireString(record.commandId, "result.commandId"),
    operation: record.operation == null ? null : parseNativeOperationRef(record.operation, "result.operation"),
    status,
    summary: requireString(record.summary, "result.summary"),
    artifacts: parseArtifacts(record.artifacts),
    metrics: parseMetrics(record.metrics),
    error: record.error == null ? null : parseNativeCommandError(record.error),
  };
}

export function createNativeCommandResult(input: {
  commandId: string;
  operation?: NativeOperationRef | null;
  status: NativeCommandResult["status"];
  summary: string;
  artifacts?: NativeCommandArtifact[];
  metrics?: Record<string, NativeCommandMetricValue>;
  error?: NativeCommandError | null;
}): NativeCommandResult {
  return parseNativeCommandResult({
    schemaVersion: NATIVE_COMMAND_SCHEMA_VERSION,
    commandId: input.commandId,
    operation: input.operation ?? null,
    status: input.status,
    summary: input.summary,
    artifacts: input.artifacts ?? [],
    metrics: input.metrics ?? {},
    error: input.error ?? null,
  });
}

export function nativeOperationRefsEqual(
  left: NativeOperationRef | null | undefined,
  right: NativeOperationRef | null | undefined,
): boolean {
  if (left == null || right == null) return left == null && right == null;
  return left.operationId === right.operationId
    && left.stepId === right.stepId
    && left.actionId === right.actionId
    && left.operationKind === right.operationKind;
}

export function redactNativeCommandResult(result: NativeCommandResult): NativeCommandResult {
  return redactSecrets(result).value;
}

function parseArtifacts(value: unknown): NativeCommandArtifact[] {
  if (!Array.isArray(value)) {
    throw new NativeCommandContractError("Native command result artifacts must be an array.");
  }
  return value.map((artifact, index) => {
    const record = requireRecord(artifact, `result.artifacts[${index}]`);
    return {
      kind: requireString(record.kind, `result.artifacts[${index}].kind`),
      uri: requireString(record.uri, `result.artifacts[${index}].uri`),
      label: requireString(record.label, `result.artifacts[${index}].label`),
      metadata: requireRecord(record.metadata ?? {}, `result.artifacts[${index}].metadata`),
    };
  });
}

function parseMetrics(value: unknown): Record<string, NativeCommandMetricValue> {
  const record = requireRecord(value ?? {}, "result.metrics");
  return Object.fromEntries(Object.entries(record).map(([key, entry]) => {
    if (
      entry !== null
      && typeof entry !== "number"
      && typeof entry !== "string"
      && typeof entry !== "boolean"
    ) {
      throw new NativeCommandContractError("Native command result metric value is invalid.", {
        key,
        valueType: typeof entry,
      });
    }
    return [key, entry as NativeCommandMetricValue];
  }));
}

function parseNativeCommandError(value: unknown): NativeCommandError {
  const record = requireRecord(value, "result.error");
  const details = record.details === undefined
    ? undefined
    : requireRecord(record.details, "result.error.details");
  return {
    code: requireString(record.code, "result.error.code"),
    message: requireString(record.message, "result.error.message"),
    ...(details ? { details } : {}),
  };
}

function isNativeOperationKind(value: string): value is NativeOperationKind {
  return (NATIVE_OPERATION_KINDS as readonly string[]).includes(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NativeCommandContractError(`${label} must be a JSON object.`, { label });
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new NativeCommandContractError(`${label} must be a non-empty string.`, { label });
  }
  return value.trim();
}
