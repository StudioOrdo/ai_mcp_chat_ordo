import { randomUUID } from "node:crypto";

import {
  isOperationKind,
  isOperationStatus,
  type OperationKind,
} from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";
import { OperationDraftFactory } from "@/core/use-cases/operations/OperationDraftFactory";
import type {
  OperationIntentCompilerInput,
  OperationIntentOperationOutput,
  OperationIntentRouteResult,
} from "@/core/use-cases/operations/OperationIntent";
import { OperationIntentPolicy } from "@/core/use-cases/operations/OperationIntentPolicy";
import { OperationIntentRouter } from "@/core/use-cases/operations/OperationIntentRouter";
import { createDefaultOperationKindRegistry } from "@/core/use-cases/operations/OperationKindRegistry";
import type {
  OperationListOptions,
  OperationRepository,
  OperationSnapshot,
  OperationSummary,
} from "@/core/use-cases/operations/OperationRepository";
import type { SessionUser } from "@/lib/auth";
import { resolveSessionAuthorizationRole, sessionHasRole } from "@/lib/auth";
import { DeterministicOperationIntentCompiler } from "@/lib/operations/operation-intent-compiler";

export class OperationReadApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "OperationReadApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const SUPPORTED_ROUTE_CREATED_KINDS: readonly OperationKind[] = [
  "help_flow",
  "onboarding_flow",
  "system_diagnostic",
];

export interface OperationReadContext {
  user: SessionUser;
  role: RoleName;
  isStaff: boolean;
  isAdmin: boolean;
}

export function createOperationReadContext(user: SessionUser): OperationReadContext {
  const role = resolveSessionAuthorizationRole(user);
  return {
    user,
    role,
    isStaff: sessionHasRole(user, ["STAFF", "ADMIN"]),
    isAdmin: sessionHasRole(user, ["ADMIN"]),
  };
}

export function parseOperationListOptions(searchParams: URLSearchParams): OperationListOptions {
  const options: OperationListOptions = {};
  const status = searchParams.get("status")?.trim();
  const kind = searchParams.get("kind")?.trim();
  const limit = Number(searchParams.get("limit") ?? "");
  const offset = Number(searchParams.get("offset") ?? "");

  if (status && isOperationStatus(status)) options.status = status;
  if (kind && isOperationKind(kind)) options.kind = kind;
  if (Number.isFinite(limit) && limit > 0) options.limit = Math.min(Math.floor(limit), 200);
  if (Number.isFinite(offset) && offset >= 0) options.offset = Math.floor(offset);

  return options;
}

export async function listReadableOperations(input: {
  repository: OperationRepository;
  context: OperationReadContext;
  options?: OperationListOptions;
}): Promise<OperationSummary[]> {
  const summaries = input.context.isAdmin
    ? await input.repository.listOperationsForAdmin(input.options)
    : input.context.isStaff
      ? await input.repository.listOperationsForAdmin(input.options)
      : await input.repository.listOperationsForUser(input.context.user.id, input.options);

  return summaries.filter((summary) => canReadOperationSummary(summary, input.context));
}

export function canReadOperationSummary(summary: OperationSummary, context: OperationReadContext): boolean {
  if (context.isAdmin) return true;
  if (summary.createdByUserId === context.user.id) return true;

  switch (summary.visibility) {
    case "system":
    case "admin":
      return false;
    case "staff":
      return context.isStaff;
    case "user":
    case "conversation":
      return false;
  }
}

export function canReadOperationSnapshot(snapshot: OperationSnapshot, context: OperationReadContext): boolean {
  return canReadOperationSummary({
    id: snapshot.operation.id,
    kind: snapshot.operation.kind,
    title: snapshot.operation.title,
    status: snapshot.operation.status,
    riskLevel: snapshot.operation.riskLevel,
    revision: snapshot.operation.revision,
    conversationId: snapshot.operation.conversationId,
    currentStepId: snapshot.operation.currentStepId,
    summary: snapshot.operation.summary,
    createdByUserId: snapshot.operation.createdByUserId,
    createdByRole: snapshot.operation.createdByRole,
    visibility: snapshot.operation.visibility,
    createdAt: snapshot.operation.createdAt,
    updatedAt: snapshot.operation.updatedAt,
    completedAt: snapshot.operation.completedAt,
    stepCount: snapshot.steps.length,
    actionCount: snapshot.actions.length,
    artifactCount: snapshot.artifacts.length,
    eventCount: snapshot.events.length,
    latestEventType: snapshot.events.at(-1)?.type ?? null,
    latestEventAt: snapshot.events.at(-1)?.createdAt ?? null,
    progress: {
      totalSteps: snapshot.steps.length,
      pendingSteps: 0,
      readySteps: 0,
      runningSteps: 0,
      blockedSteps: 0,
      succeededSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      cancelledSteps: 0,
      percentComplete: snapshot.steps.length > 0
        ? Math.round((snapshot.steps.filter((step) => step.status === "succeeded" || step.status === "skipped").length / snapshot.steps.length) * 100)
        : 0,
    },
  }, context);
}

export async function createOperationFromRequest(input: {
  repository: OperationRepository;
  context: OperationReadContext;
  body: unknown;
  now?: string;
}): Promise<OperationIntentRouteResult> {
  const body = assertRecord(input.body, "operation create request");
  const conversationId = readRequiredString(body, "conversationId");
  const latestUserText = readOptionalString(body, "latestUserText")
    ?? readOptionalString(body, "requestedText")
    ?? "Create a governed operation.";
  const originMessageId = readOptionalString(body, "originMessageId");
  const now = input.now ?? new Date().toISOString();
  const operationKind = readOptionalOperationKind(body.operationKind);
  const compilerInput = buildRouteCompilerInput({
    conversationId,
    originMessageId,
    userId: input.context.user.id,
    role: input.context.role,
    latestUserText,
    now,
  });
  const compilerOutput = operationKind
    ? buildManualOperationOutput({
        operationKind,
        role: input.context.role,
        latestUserText,
        body,
      })
    : new DeterministicOperationIntentCompiler().compile(compilerInput);

  const registry = createDefaultOperationKindRegistry();
  const router = new OperationIntentRouter({
    repository: input.repository,
    kindRegistry: registry,
    policy: new OperationIntentPolicy(registry),
    draftFactory: new OperationDraftFactory((prefix) => `${prefix}_${randomUUID()}`, registry),
  });

  return router.route({
    compilerInput,
    compilerOutput,
  });
}

function buildRouteCompilerInput(input: {
  conversationId: string;
  originMessageId: string | null;
  userId: string;
  role: RoleName;
  latestUserText: string;
  now: string;
}): OperationIntentCompilerInput {
  return {
    conversationId: input.conversationId,
    originMessageId: input.originMessageId,
    userId: input.userId,
    role: input.role,
    latestUserText: input.latestUserText,
    latestUserContent: input.latestUserText,
    routingSnapshot: {
      lane: "uncertain",
      confidence: 1,
      recommendedNextStep: null,
      detectedNeedSummary: "operation route request",
      lastAnalyzedAt: input.now,
    },
    attachments: [],
    taskOriginHandoff: null,
    mediaContinuityHandoff: null,
    effectiveToolManifestVersion: "operation-api",
    availableToolNames: [],
    providerCapabilitySummary: {},
    gateSnapshot: { generatedAt: input.now, gates: [] },
    operationGrounding: null,
    now: input.now,
  };
}

function buildManualOperationOutput(input: {
  operationKind: OperationKind;
  role: RoleName;
  latestUserText: string;
  body: Record<string, unknown>;
}): OperationIntentOperationOutput {
  if (!SUPPORTED_ROUTE_CREATED_KINDS.includes(input.operationKind)) {
    throw new OperationReadApiError(422, "OPERATION_KIND_UNSUPPORTED", "This operation kind cannot be created directly from the operations API.", {
      operationKind: input.operationKind,
    });
  }

  const request = assertOptionalRecord(input.body.input, "input") ?? {};
  const title = readOptionalString(input.body, "title") ?? titleForKind(input.operationKind, input.role);
  const summary = readOptionalString(input.body, "summary") ?? summaryForKind(input.operationKind, input.role);
  return {
    kind: "operation_intent",
    intentKind: input.operationKind,
    operationKind: input.operationKind,
    requiredRole: input.role,
    riskLevel: input.operationKind === "system_diagnostic" ? "low" : "info",
    confidence: 1,
    source: "deterministic",
    title,
    summary,
    input: {
      ...request,
      requestedText: readOptionalString(input.body, "requestedText") ?? input.latestUserText,
      role: input.role,
    },
    requiredCapabilities: [],
    requiredProviderSlots: [],
    missingInputs: [],
    explicitNewOperation: input.body.explicitNewOperation === true,
  };
}

function titleForKind(kind: OperationKind, role: RoleName): string {
  switch (kind) {
    case "help_flow":
      return "Open System Help";
    case "onboarding_flow":
      return `Start ${role.toLowerCase()} onboarding`;
    case "system_diagnostic":
      return "Run System Diagnostic";
    default:
      return "Create Operation";
  }
}

function summaryForKind(kind: OperationKind, role: RoleName): string {
  switch (kind) {
    case "help_flow":
      return "Open role-governed system help from the active handbook.";
    case "onboarding_flow":
      return `Start the role-aware onboarding path for ${role}.`;
    case "system_diagnostic":
      return "Create a governed diagnostic draft.";
    default:
      return "Create a governed operation draft.";
  }
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new OperationReadApiError(422, "OPERATION_REQUEST_INVALID", `${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function assertOptionalRecord(value: unknown, label: string): Record<string, unknown> | null {
  if (value == null) return null;
  return assertRecord(value, label);
}

function readRequiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new OperationReadApiError(422, "OPERATION_REQUEST_INVALID", `${key} is required.`, { field: key });
  }
  return value.trim();
}

function readOptionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readOptionalOperationKind(value: unknown): OperationKind | null {
  if (value == null) return null;
  if (typeof value !== "string" || !isOperationKind(value)) {
    throw new OperationReadApiError(422, "OPERATION_KIND_INVALID", "operationKind is invalid.", { operationKind: value });
  }
  return value;
}
