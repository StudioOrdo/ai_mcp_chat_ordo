import type {
  OperationCardModel,
  OperationCardStatusTone,
} from "@/core/entities/rich-content";
import { BLOCK_TYPES, type BlockNode } from "@/core/entities/rich-content";
import type {
  OperationEvent,
  OperationRiskLevel,
  OperationStatus,
} from "@/core/entities/operation";
import type {
  AdminOperationSummary,
  ConversationOperationSummary,
} from "@/core/use-cases/operations/OperationReadModel";
import type {
  OperationSnapshot,
  OperationSummary,
} from "@/core/use-cases/operations/OperationRepository";
import { operationActionsToActionLinks } from "@/lib/operations/operation-action-view-model";

type OperationPresentationSource =
  | OperationSnapshot
  | OperationSummary
  | ConversationOperationSummary
  | AdminOperationSummary;

export function operationSnapshotToCardModel(snapshot: OperationSnapshot): OperationCardModel {
  return operationSourceToCardModel(snapshot);
}

export function operationSourceToCardModel(source: OperationPresentationSource): OperationCardModel {
  if ("operation" in source) {
    const latestEvent = source.events.at(-1) ?? null;
    return {
      operationId: source.operation.id,
      title: source.operation.title,
      kind: source.operation.kind,
      status: source.operation.status,
      statusLabel: formatStatus(source.operation.status),
      statusTone: statusTone(source.operation.status),
      riskLevel: source.operation.riskLevel,
      riskLabel: formatRisk(source.operation.riskLevel),
      summary: source.operation.summary,
      progressPercent: summarizeProgress(source.steps),
      updatedAt: source.operation.updatedAt,
      latestEventLabel: latestEventLabel(latestEvent),
      artifactCount: source.artifacts.length,
      actionCount: source.actions.length,
      actions: operationActionsToActionLinks(source.actions),
    };
  }

  const operationId = "operationId" in source ? source.operationId : source.id;
  const artifactCount = "artifactCount" in source ? source.artifactCount : 0;
  const actionCount = "actionCount" in source ? source.actionCount : source.availableActions.length;
  return {
    operationId,
    title: source.title,
    kind: source.kind,
    status: source.status,
    statusLabel: formatStatus(source.status),
    statusTone: statusTone(source.status),
    riskLevel: source.riskLevel,
    riskLabel: formatRisk(source.riskLevel),
    summary: source.summary,
    progressPercent: source.progress.percentComplete,
    updatedAt: source.updatedAt,
    latestEventLabel: "latestEvent" in source ? latestEventLabel(source.latestEvent) : formatEventType(source.latestEventType),
    artifactCount,
    actionCount,
    actions: operationActionsToActionLinks("availableActions" in source ? source.availableActions : []),
  };
}

export function operationCardBlock(operation: OperationCardModel): Extract<BlockNode, { type: typeof BLOCK_TYPES.OPERATION_CARD }> {
  return {
    type: BLOCK_TYPES.OPERATION_CARD,
    operation,
  };
}

export function serializeOperationCardMarkdown(model: OperationCardModel): string {
  return `__operation_card__:${JSON.stringify(model)}`;
}

export function parseSerializedOperationCard(line: string): OperationCardModel | null {
  const marker = "__operation_card__:";
  if (!line.startsWith(marker)) return null;
  try {
    const parsed = JSON.parse(line.slice(marker.length)) as unknown;
    return isOperationCardModel(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function summarizeProgress(steps: readonly unknown[]): number | null {
  if (steps.length === 0) return null;
  const succeeded = steps.filter((step) =>
    typeof step === "object"
    && step !== null
    && "status" in step
    && ((step as { status?: unknown }).status === "succeeded" || (step as { status?: unknown }).status === "skipped"),
  ).length;
  return Math.round((succeeded / steps.length) * 100);
}

function formatStatus(status: OperationStatus | string): string {
  return status.replaceAll("_", " ");
}

function formatRisk(risk: OperationRiskLevel | string): string {
  return risk.replaceAll("_", " ");
}

function statusTone(status: OperationStatus | string): OperationCardStatusTone {
  switch (status) {
    case "queued":
    case "running":
    case "awaiting_confirmation":
      return "active";
    case "blocked":
    case "failed":
    case "expired":
      return "blocked";
    case "cancelled":
      return "danger";
    case "succeeded":
      return "success";
    default:
      return "neutral";
  }
}

function latestEventLabel(event: OperationEvent | null): string | null {
  return event ? formatEventType(event.type) : null;
}

function formatEventType(eventType: string | null | undefined): string | null {
  return eventType ? eventType.replaceAll("_", " ") : null;
}

function isOperationCardModel(value: unknown): value is OperationCardModel {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.operationId === "string"
    && typeof record.title === "string"
    && typeof record.kind === "string"
    && typeof record.status === "string"
    && typeof record.statusLabel === "string"
    && typeof record.statusTone === "string"
    && typeof record.riskLevel === "string"
    && typeof record.riskLabel === "string"
    && Array.isArray(record.actions);
}
