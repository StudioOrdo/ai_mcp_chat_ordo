import {
  isOperationKind,
  isOperationRiskLevel,
  type OperationKind,
  type OperationStatus,
} from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";
import type {
  OperationRepository,
  OperationSnapshot,
} from "@/core/use-cases/operations/OperationRepository";
import type {
  OperationDraftFactory,
} from "@/core/use-cases/operations/OperationDraftFactory";
import {
  createDefaultOperationKindRegistry,
  type OperationKindRegistry,
} from "@/core/use-cases/operations/OperationKindRegistry";
import {
  ACTIVE_OPERATION_INTENT_STATUSES,
  type OperationGateFact,
  type OperationIntentClarificationOutput,
  type OperationIntentCompilerInput,
  type OperationIntentOperationOutput,
  type OperationIntentRejectedOutput,
  type OperationIntentRouteResult,
} from "@/core/use-cases/operations/OperationIntent";
import {
  OperationIntentPolicy,
} from "@/core/use-cases/operations/OperationIntentPolicy";

export interface OperationIntentRouterDeps {
  repository: OperationRepository;
  draftFactory: OperationDraftFactory;
  policy?: OperationIntentPolicy;
  kindRegistry?: OperationKindRegistry;
}

export interface OperationIntentRouteInput {
  compilerInput: OperationIntentCompilerInput;
  compilerOutput: unknown;
}

const ACTIVE_STATUS_SET = new Set<OperationStatus>(ACTIVE_OPERATION_INTENT_STATUSES);

export class OperationIntentRouter {
  private readonly policy: OperationIntentPolicy;
  private readonly kindRegistry: OperationKindRegistry;

  constructor(private readonly deps: OperationIntentRouterDeps) {
    this.kindRegistry = deps.kindRegistry ?? createDefaultOperationKindRegistry();
    this.policy = deps.policy ?? new OperationIntentPolicy(this.kindRegistry);
  }

  async route(input: OperationIntentRouteInput): Promise<OperationIntentRouteResult> {
    const compilerOutput = input.compilerOutput;

    if (isPassThroughOutput(compilerOutput)) {
      return {
        kind: "pass_through",
        confidence: compilerOutput.confidence,
        reason: compilerOutput.reason,
      };
    }

    if (isRejectedOutput(compilerOutput)) {
      return {
        kind: "rejected_response",
        message: compilerOutput.rejectedReason,
        compilerOutput,
      };
    }

    if (isClarificationOutput(compilerOutput)) {
      return {
        kind: "clarification_response",
        message: compilerOutput.question,
        compilerOutput,
      };
    }

    const intent = this.policy.validateOperationIntentShape(compilerOutput);
    if (!intent) {
      return {
        kind: "rejected_response",
        message: "I could not validate that operation request safely. Please restate the request with the exact operation and required ids.",
      };
    }

    if (this.policy.shouldPassThroughLowConfidence(intent)) {
      return {
        kind: "pass_through",
        confidence: intent.confidence,
        reason: "low_confidence_non_destructive",
      };
    }

    if (this.policy.shouldClarifyLowConfidenceDestructive(intent)) {
      return {
        kind: "clarification_response",
        message: "This looks like a destructive operation, but I do not have enough confidence to act on it. Please name the exact backup or restore target.",
        compilerOutput: intent,
      };
    }

    const definition = this.kindRegistry.require(intent.operationKind);
    const roleDecision = this.policy.authorizeKind(intent.operationKind, input.compilerInput.role);
    if (!roleDecision.allowed) {
      return {
        kind: "rejected_response",
        message: roleDecision.message ?? `${definition.label} is not available for your role.`,
      };
    }

    if (intent.missingInputs.length > 0) {
      return {
        kind: "clarification_response",
        message: buildMissingInputQuestion(intent),
        compilerOutput: intent,
      };
    }

    if (!intent.explicitNewOperation) {
      const existing = await this.findExistingActiveOperation({
        conversationId: input.compilerInput.conversationId,
        kind: intent.operationKind,
        intent,
      });
      if (existing) {
        return {
          kind: "existing_operation",
          snapshot: existing,
          actions: existing.actions,
          compilerOutput: intent,
        };
      }
    }

    const blockingGates = dedupeGates([
      ...this.policy.findMissingCapabilities(intent, input.compilerInput.availableToolNames),
      ...this.policy.findMissingProviderSlots(intent, input.compilerInput.providerCapabilitySummary),
      ...this.policy.findBlockingGates(intent, input.compilerInput.gateSnapshot),
    ]);

    const draft = this.deps.draftFactory.build({
      compilerInput: input.compilerInput,
      intent,
      blockingGates,
    });
    const created = await this.deps.repository.createOperation(draft.operation);
    const snapshot = draft.actions.length > 0
      ? await this.deps.repository.replaceActions({
          operationId: created.operation.id,
          actions: [...draft.actions],
          actorType: "system",
          actorId: input.compilerInput.userId,
          now: input.compilerInput.now,
        })
      : created;

    return {
      kind: blockingGates.length > 0 ? "blocked_operation" : "created_operation",
      snapshot,
      actions: snapshot.actions,
      blockingGates,
      compilerOutput: intent,
    };
  }

  private async findExistingActiveOperation(input: {
    conversationId: string;
    kind: OperationKind;
    intent: OperationIntentOperationOutput;
  }): Promise<OperationSnapshot | null> {
    const summaries = await this.deps.repository.listOperationsByConversation(input.conversationId, {
      kind: input.kind,
      limit: 25,
    });
    for (const summary of summaries) {
      if (!ACTIVE_STATUS_SET.has(summary.status)) continue;
      const snapshot = await this.deps.repository.findOperationById(summary.id);
      if (snapshot && isReusableOperationForIntent(snapshot, input.intent)) {
        return snapshot;
      }
    }

    return null;
  }
}

function isReusableOperationForIntent(
  snapshot: OperationSnapshot,
  intent: OperationIntentOperationOutput,
): boolean {
  if (snapshot.operation.kind !== intent.operationKind) {
    return false;
  }

  if (snapshot.operation.kind === "media_workflow" && snapshot.operation.status === "blocked") {
    return false;
  }

  const existingRequestedText = readRequestedText(snapshot.operation.input);
  const nextRequestedText = readRequestedText(intent.input);
  if (existingRequestedText && nextRequestedText) {
    return normalizeIntentText(existingRequestedText) === normalizeIntentText(nextRequestedText);
  }

  return true;
}

function readRequestedText(input: unknown): string | null {
  if (!isRecord(input)) {
    return null;
  }

  const request = input.request;
  const candidates = [
    input.requestedText,
    input.prompt,
    input.request,
    isRecord(request) ? request.requestedText : null,
    isRecord(request) ? request.prompt : null,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function normalizeIntentText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildMissingInputQuestion(intent: OperationIntentOperationOutput): string {
  if (intent.operationKind === "restore_execute" && intent.missingInputs.includes("snapshotId")) {
    return "Which exact backup should I restore from? Provide the full backup id before I create a restore operation.";
  }

  return `I need ${intent.missingInputs.join(", ")} before I can create ${intent.title}.`;
}

function dedupeGates(gates: readonly OperationGateFact[]): OperationGateFact[] {
  const seen = new Set<string>();
  const result: OperationGateFact[] = [];
  for (const gate of gates) {
    if (seen.has(gate.id)) continue;
    seen.add(gate.id);
    result.push(gate);
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isSource(value: unknown): boolean {
  return value === "deterministic" || value === "llm" || value === "hybrid";
}

function isRoleName(value: unknown): value is RoleName {
  return value === "ANONYMOUS"
    || value === "AUTHENTICATED"
    || value === "APPRENTICE"
    || value === "STAFF"
    || value === "ADMIN";
}

function isPassThroughOutput(value: unknown): value is { kind: "pass_through"; confidence: number; reason?: string } {
  return isRecord(value)
    && value.kind === "pass_through"
    && isConfidence(value.confidence)
    && isSource(value.source);
}

function isClarificationOutput(value: unknown): value is OperationIntentClarificationOutput {
  if (!isRecord(value) || value.kind !== "clarification_required") {
    return false;
  }

  return isConfidence(value.confidence)
    && isSource(value.source)
    && typeof value.question === "string"
    && value.question.trim().length > 0
    && typeof value.reason === "string"
    && value.reason.trim().length > 0
    && (value.operationKind === undefined || (typeof value.operationKind === "string" && isOperationKind(value.operationKind)))
    && (value.riskLevel === undefined || (typeof value.riskLevel === "string" && isOperationRiskLevel(value.riskLevel)));
}

function isRejectedOutput(value: unknown): value is OperationIntentRejectedOutput {
  if (!isRecord(value) || value.kind !== "rejected") {
    return false;
  }

  return isConfidence(value.confidence)
    && isSource(value.source)
    && typeof value.rejectedReason === "string"
    && value.rejectedReason.trim().length > 0
    && (value.operationKind === undefined || (typeof value.operationKind === "string" && isOperationKind(value.operationKind)))
    && (value.requiredRole === undefined || isRoleName(value.requiredRole))
    && (value.riskLevel === undefined || (typeof value.riskLevel === "string" && isOperationRiskLevel(value.riskLevel)));
}
