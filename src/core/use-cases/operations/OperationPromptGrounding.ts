import type {
  OperationArtifact,
  OperationEvent,
  OperationKind,
  OperationRiskLevel,
  OperationStatus,
} from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";
import type {
  OperationRepository,
  OperationSummary,
} from "@/core/use-cases/operations/OperationRepository";
import type { OperationProgressSummary } from "@/core/use-cases/operations/OperationReadModel";

export type OperationGroundingStatus = "available" | "empty" | "unavailable";
export type OperationGroundingReason =
  | "active"
  | "mentioned"
  | "recent_failure"
  | "recent_completion";
export type OperationToolEvidenceKind = "call" | "result" | "paired";

export interface OperationPromptGroundingBudget {
  maxOperations: number;
  maxActiveOperations: number;
  maxCompletedOperations: number;
  maxLatestEventsPerOperation: number;
  maxArtifactsPerOperation: number;
  maxAvailableActionsPerOperation: number;
  maxToolEvidenceEntries: number;
  maxSerializedSectionCharacters: number;
  maxJsonSummaryCharacters: number;
}

export const DEFAULT_OPERATION_PROMPT_GROUNDING_BUDGET: OperationPromptGroundingBudget = {
  maxOperations: 6,
  maxActiveOperations: 5,
  maxCompletedOperations: 2,
  maxLatestEventsPerOperation: 5,
  maxArtifactsPerOperation: 5,
  maxAvailableActionsPerOperation: 5,
  maxToolEvidenceEntries: 8,
  maxSerializedSectionCharacters: 5_000,
  maxJsonSummaryCharacters: 800,
};

export interface OperationPromptGroundingToolEvidence {
  messageId: string;
  toolInvocationId: string | null;
  toolName: string;
  evidenceKind: OperationToolEvidenceKind;
  summary: string;
  error: string | null;
  relatedOperationId: string | null;
  createdAt: string | null;
}

export interface OperationPromptGroundingEvent {
  sequence: number;
  type: string;
  stepId: string | null;
  createdAt: string;
  payloadSummary: string;
}

export interface OperationPromptGroundingAction {
  id: string;
  actionType: string;
  label: string;
  enabled?: boolean;
  disabledReason?: string | null;
  riskLevel?: OperationRiskLevel;
  confirmPolicy?: string;
}

export interface OperationPromptGroundingArtifact {
  label: string;
  uri: string;
  kind?: string;
  createdAt?: string;
}

export interface OperationPromptGroundingOperation {
  operationId: string;
  kind: OperationKind;
  title: string;
  status: OperationStatus;
  riskLevel: OperationRiskLevel;
  revision: number;
  currentStepId: string | null;
  summary: string | null;
  progress: OperationProgressSummary;
  error: { code: string; message: string } | null;
  latestEvents: OperationPromptGroundingEvent[];
  availableActions: OperationPromptGroundingAction[];
  artifacts: OperationPromptGroundingArtifact[];
  updatedAt: string;
  groundingReason: OperationGroundingReason;
}

export interface OperationPromptGroundingSnapshot {
  generatedAt: string;
  conversationId: string;
  status: OperationGroundingStatus;
  includeInPrompt: boolean;
  operations: OperationPromptGroundingOperation[];
  toolEvidence: OperationPromptGroundingToolEvidence[];
  budget: OperationPromptGroundingBudget & {
    operationsDropped: number;
    eventsDropped: number;
    artifactsDropped: number;
    actionsDropped: number;
    toolEvidenceDropped: number;
  };
  warnings: string[];
}

export interface OperationPromptGroundingInput {
  conversationId: string;
  userId: string;
  role: RoleName;
  latestUserText: string;
  toolEvidence?: readonly OperationPromptGroundingToolEvidence[];
  now?: string;
  budget?: Partial<OperationPromptGroundingBudget>;
}

interface RankedOperation {
  summary: OperationSummary;
  groundingReason: OperationGroundingReason;
  score: number;
}

interface GroundingLoadResult {
  operations: OperationPromptGroundingOperation[];
  eventsDropped: number;
  artifactsDropped: number;
  actionsDropped: number;
}

const ACTIVE_STATUSES = new Set<OperationStatus>([
  "draft",
  "awaiting_confirmation",
  "queued",
  "running",
  "blocked",
]);
const TERMINAL_STATUSES = new Set<OperationStatus>([
  "succeeded",
  "cancelled",
  "expired",
]);
const RECENT_FAILURE_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;
const RECENT_COMPLETION_WINDOW_MS = 48 * 60 * 60 * 1_000;
const OPERATION_QUESTION_PATTERN =
  /\b(status|state|ready|done|complete|completed|succeeded|failed|blocked|what happened|history|latest|check|action|execute|click|backup|restore|media|factory|publish|operation|queue|queued|running)\b/i;

export function isOperationGroundingQuestion(text: string): boolean {
  return OPERATION_QUESTION_PATTERN.test(text);
}

export class OperationPromptGrounding {
  constructor(private readonly repository: Pick<
    OperationRepository,
    "listOperationsByConversation" | "getPromptGroundingSummary"
  >) {}

  async build(input: OperationPromptGroundingInput): Promise<OperationPromptGroundingSnapshot> {
    const generatedAt = input.now ?? new Date().toISOString();
    const budget = { ...DEFAULT_OPERATION_PROMPT_GROUNDING_BUDGET, ...input.budget };

    try {
      const summaries = await this.repository.listOperationsByConversation(input.conversationId, {
        limit: 50,
      });
      const visibleSummaries = summaries.filter((summary) =>
        canRoleSeeOperation(summary, input.role, input.userId)
      );
      const ranked = rankOperations({
        summaries: visibleSummaries,
        latestUserText: input.latestUserText,
        now: generatedAt,
      });
      const selected = applyOperationBudget(ranked, budget);
      const operationLoad = await this.loadSelectedOperations(selected, budget);
      const { operations } = operationLoad;
      const boundedToolEvidence = (input.toolEvidence ?? []).slice(0, budget.maxToolEvidenceEntries);
      const asksOperationQuestion = isOperationGroundingQuestion(input.latestUserText);

      return {
        generatedAt,
        conversationId: input.conversationId,
        status: operations.length > 0 ? "available" : "empty",
        includeInPrompt: operations.length > 0 || asksOperationQuestion,
        operations,
        toolEvidence: boundedToolEvidence,
        budget: {
          ...budget,
          operationsDropped: Math.max(0, ranked.length - selected.length),
          eventsDropped: operationLoad.eventsDropped,
          artifactsDropped: operationLoad.artifactsDropped,
          actionsDropped: operationLoad.actionsDropped,
          toolEvidenceDropped: Math.max(0, (input.toolEvidence ?? []).length - boundedToolEvidence.length),
        },
        warnings: operations.length === 0 && asksOperationQuestion
          ? ["no_current_operation_state_found_for_conversation"]
          : [],
      };
    } catch (error) {
      return {
        generatedAt,
        conversationId: input.conversationId,
        status: "unavailable",
        includeInPrompt: true,
        operations: [],
        toolEvidence: [],
        budget: {
          ...budget,
          operationsDropped: 0,
          eventsDropped: 0,
          artifactsDropped: 0,
          actionsDropped: 0,
          toolEvidenceDropped: 0,
        },
        warnings: [
          `operation_grounding_unavailable:${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  private async loadSelectedOperations(
    selected: readonly RankedOperation[],
    budget: OperationPromptGroundingBudget,
  ): Promise<GroundingLoadResult> {
    const operations: OperationPromptGroundingOperation[] = [];
    let eventsDropped = 0;
    let artifactsDropped = 0;
    let actionsDropped = 0;

    for (const candidate of selected) {
      const grounding = await this.repository.getPromptGroundingSummary(candidate.summary.id);
      if (!grounding) {
        continue;
      }
      const latestEvents = grounding.latestEvents.slice(-budget.maxLatestEventsPerOperation);
      const availableActions = grounding.availableActions.slice(0, budget.maxAvailableActionsPerOperation);
      const artifacts = grounding.artifacts.slice(0, budget.maxArtifactsPerOperation);
      eventsDropped += Math.max(0, grounding.latestEvents.length - latestEvents.length);
      actionsDropped += Math.max(0, grounding.availableActions.length - availableActions.length);
      artifactsDropped += Math.max(0, grounding.artifacts.length - artifacts.length);

      operations.push({
        operationId: candidate.summary.id,
        kind: grounding.kind,
        title: grounding.title,
        status: grounding.status,
        riskLevel: grounding.riskLevel,
        revision: grounding.revision,
        currentStepId: grounding.currentStepId,
        summary: grounding.summary,
        progress: grounding.progress,
        error: grounding.error,
        latestEvents: latestEvents.map((event) =>
          toGroundingEvent(event, budget.maxJsonSummaryCharacters)
        ),
        availableActions: availableActions.map((action) => ({
            id: action.id,
            actionType: action.actionType,
            label: action.label,
            enabled: action.enabled,
            disabledReason: action.disabledReason,
            riskLevel: action.riskLevel,
            confirmPolicy: action.confirmPolicy,
          })),
        artifacts: artifacts.map((artifact) => toGroundingArtifact(artifact)),
        updatedAt: grounding.updatedAt,
        groundingReason: candidate.groundingReason,
      });
    }

    return {
      operations,
      eventsDropped,
      artifactsDropped,
      actionsDropped,
    };
  }
}

function rankOperations(input: {
  summaries: readonly OperationSummary[];
  latestUserText: string;
  now: string;
}): RankedOperation[] {
  const asksOperationQuestion = isOperationGroundingQuestion(input.latestUserText);
  const mostRecentId = [...input.summaries]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]?.id;

  return input.summaries
    .map((summary): RankedOperation | null => {
      const mentioned = isOperationMentioned(summary, input.latestUserText);
      const ageMs = ageFromNow(summary.updatedAt, input.now);

      if (ACTIVE_STATUSES.has(summary.status)) {
        return {
          summary,
          groundingReason: mentioned ? "mentioned" : "active",
          score: mentioned ? 120 : 100,
        };
      }

      if (summary.status === "failed" && ageMs <= RECENT_FAILURE_WINDOW_MS) {
        return {
          summary,
          groundingReason: mentioned ? "mentioned" : "recent_failure",
          score: mentioned ? 115 : 90,
        };
      }

      if (
        TERMINAL_STATUSES.has(summary.status)
        && (
          mentioned
          || (asksOperationQuestion && summary.id === mostRecentId)
          || (summary.artifactCount > 0 && ageMs <= RECENT_COMPLETION_WINDOW_MS)
        )
      ) {
        return {
          summary,
          groundingReason: mentioned ? "mentioned" : "recent_completion",
          score: mentioned ? 110 : 70,
        };
      }

      return null;
    })
    .filter((entry): entry is RankedOperation => Boolean(entry))
    .sort((a, b) => b.score - a.score || Date.parse(b.summary.updatedAt) - Date.parse(a.summary.updatedAt));
}

function applyOperationBudget(
  ranked: readonly RankedOperation[],
  budget: OperationPromptGroundingBudget,
): RankedOperation[] {
  const active: RankedOperation[] = [];
  const completed: RankedOperation[] = [];

  for (const entry of ranked) {
    if (ACTIVE_STATUSES.has(entry.summary.status) || entry.summary.status === "failed") {
      if (active.length < budget.maxActiveOperations) {
        active.push(entry);
      }
    } else if (completed.length < budget.maxCompletedOperations) {
      completed.push(entry);
    }
  }

  return [...active, ...completed]
    .sort((a, b) => b.score - a.score || Date.parse(b.summary.updatedAt) - Date.parse(a.summary.updatedAt))
    .slice(0, budget.maxOperations);
}

function canRoleSeeOperation(
  summary: OperationSummary,
  role: RoleName,
  userId: string,
): boolean {
  if (summary.visibility === "conversation") {
    return true;
  }
  if (summary.visibility === "user") {
    return summary.createdByUserId === userId || role === "STAFF" || role === "ADMIN";
  }
  if (summary.visibility === "staff") {
    return role === "STAFF" || role === "ADMIN";
  }
  if (summary.visibility === "admin" || summary.visibility === "system") {
    return role === "ADMIN";
  }
  return false;
}

function isOperationMentioned(summary: OperationSummary, latestUserText: string): boolean {
  const text = latestUserText.toLowerCase();
  const operationId = summary.id.toLowerCase();
  if (text.includes(operationId)) {
    return true;
  }

  const shortId = operationId.slice(0, Math.min(operationId.length, 14));
  if (shortId.length >= 8 && text.includes(shortId)) {
    return true;
  }

  const possiblePrefixes = text.match(/\bop_[a-z0-9_-]{5,}\b/g) ?? [];
  if (possiblePrefixes.some((prefix) => operationId.startsWith(prefix))) {
    return true;
  }

  const titleWords = summary.title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4);
  return titleWords.length > 0 && titleWords.some((word) => text.includes(word));
}

function ageFromNow(updatedAt: string, now: string): number {
  const updatedAtMs = Date.parse(updatedAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(updatedAtMs) || !Number.isFinite(nowMs)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, nowMs - updatedAtMs);
}

function toGroundingEvent(
  event: OperationEvent,
  maxPayloadSummaryCharacters: number,
): OperationPromptGroundingEvent {
  return {
    sequence: event.sequence,
    type: event.type,
    stepId: event.stepId,
    createdAt: event.createdAt,
    payloadSummary: summarizeValue(event.payload, maxPayloadSummaryCharacters),
  };
}

function toGroundingArtifact(
  artifact: Pick<OperationArtifact, "label" | "uri"> & Partial<Pick<OperationArtifact, "kind" | "createdAt">>,
): OperationPromptGroundingArtifact {
  return {
    label: artifact.label,
    uri: artifact.uri,
    ...(artifact.kind ? { kind: artifact.kind } : {}),
    ...(artifact.createdAt ? { createdAt: artifact.createdAt } : {}),
  };
}

function summarizeValue(value: unknown, maxCharacters: number): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text || text === "{}") {
    return "none";
  }
  return text.length > maxCharacters ? `${text.slice(0, Math.max(0, maxCharacters - 1))}…` : text;
}
