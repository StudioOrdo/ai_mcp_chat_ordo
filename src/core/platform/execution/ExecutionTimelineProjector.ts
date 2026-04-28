import type { CapabilityArtifactRef, CapabilityResultEnvelope } from "@/core/entities/capability-result";
import type { JobEvent, JobRequest } from "@/core/entities/job";
import { INLINE_TYPES, type ActionLinkInlineNode } from "@/core/entities/rich-content";
import type { StageRunRecord } from "@/core/entities/stage-run-record";
import type { WorkOrder, WorkOrderStatus } from "@/core/entities/work-order";
export { projectChatTurnExecutionTimeline, type ChatTurnTimelineProjectionInput } from "@/core/platform/execution/ChatTurnTimelineProjector";
import type {
  FactoryCheckpointRecord,
  FactoryEventRecord,
  FactoryOutputRecord,
} from "@/core/use-cases/FactoryRepository";
import {
  type ExecutionLifecycleState,
  type ExecutionTimeline,
  type ExecutionTimelineArtifact,
  type ExecutionTimelineEvent,
  type ExecutionTimelineNextAction,
  mapJobStatusToExecutionLifecycleState,
} from "@/core/platform/execution/ExecutionTimeline";
import { buildJobStatusActions } from "@/lib/chat/JobActionResolvers";
import { buildJobPublication } from "@/lib/jobs/job-publication";
import { isAuditOnlyJobEventType, isRenderableJobEventType } from "@/lib/jobs/job-renderable-event";

export interface JobExecutionTimelineProjectionInput {
  job: JobRequest;
  latestRenderableEvent?: JobEvent | null;
  history?: JobEvent[];
}

export interface WorkOrderExecutionTimelineProjectionInput {
  workOrder: WorkOrder;
  stageRuns: StageRunRecord[];
  outputs: FactoryOutputRecord[];
  events: FactoryEventRecord[];
  activeCheckpoint?: FactoryCheckpointRecord | null;
}

export interface ToolExecutionTimelineProjectionInput {
  executionId: string;
  toolName: string;
  envelope?: CapabilityResultEnvelope | null;
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isActionLinkInlineNode(value: unknown): value is ActionLinkInlineNode {
  return isRecord(value) && value.type === INLINE_TYPES.ACTION_LINK;
}

function toNextActionKind(actionType: string): ExecutionTimelineNextAction["kind"] {
  switch (actionType) {
    case "job":
      return "job";
    case "route":
      return "route";
    case "send":
      return "send";
    default:
      return "unsupported";
  }
}

function toJobArtifacts(artifacts: CapabilityArtifactRef[] | undefined): ExecutionTimelineArtifact[] {
  return (artifacts ?? []).map((artifact, index) => ({
    id: artifact.assetId ?? artifact.toolInvocationId ?? `${artifact.kind}_${index}`,
    kind: artifact.kind,
    label: artifact.label,
    mimeType: artifact.mimeType,
    uri: artifact.uri,
    source: "job_result",
    metadata: {
      retentionClass: artifact.retentionClass,
      source: artifact.source,
      width: artifact.width,
      height: artifact.height,
      durationSeconds: artifact.durationSeconds,
      derivativeOfToolInvocationId: artifact.derivativeOfToolInvocationId,
    },
  }));
}

function toJobTimelineEvent(job: JobRequest, event: JobEvent): ExecutionTimelineEvent {
  const publication = buildJobPublication(job, event, event);

  return {
    id: event.id,
    timestamp: event.createdAt,
    eventType: event.eventType,
    title: publication.part.label || titleCase(event.eventType),
    summary: publication.part.summary,
    state: mapJobStatusToExecutionLifecycleState(publication.part.status),
    sequence: event.sequence,
    source: event.id.startsWith("synthetic_") ? "synthetic" : "durable",
    renderable: isRenderableJobEventType(event.eventType),
    auditOnly: isAuditOnlyJobEventType(event.eventType),
    details: event.payload,
  };
}

function mapWorkOrderStatus(status: WorkOrderStatus): ExecutionLifecycleState {
  switch (status) {
    case "planned":
      return "planned";
    case "running":
      return "running";
    case "paused":
      return "paused";
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
  }
}

function normalizeFactoryLifecycleEventType(eventType: string): string {
  switch (eventType) {
    case "stage_started":
      return "started";
    case "stage_progress":
      return "progress";
    case "stage_succeeded":
      return "succeeded";
    case "stage_failed":
      return "failed";
    default:
      return eventType;
  }
}

function toFactoryEventTitle(eventType: string, stageKey?: string): string {
  const base = titleCase(normalizeFactoryLifecycleEventType(eventType));
  return stageKey ? `${base}: ${titleCase(stageKey)}` : base;
}

function toFactoryEventRecords(events: FactoryEventRecord[]): ExecutionTimelineEvent[] {
  return events.map((event) => ({
    id: event.id,
    timestamp: event.createdAt,
    eventType: event.eventType,
    title: toFactoryEventTitle(event.eventType, typeof event.payload.stageKey === "string" ? event.payload.stageKey : undefined),
    stageKey: typeof event.payload.stageKey === "string" ? event.payload.stageKey : undefined,
    sequence: event.sequence,
    source: "durable",
    details: event.payload,
  }));
}

function toExecutionLogEvents(input: WorkOrderExecutionTimelineProjectionInput): ExecutionTimelineEvent[] {
  const durableMoments = new Set(
    input.events.map((event) => {
      const stageKey = typeof event.payload.stageKey === "string" ? event.payload.stageKey : "";
      return `${event.createdAt}:${normalizeFactoryLifecycleEventType(event.eventType)}:${stageKey}`;
    }),
  );

  return input.workOrder.executionLog.flatMap((entry, index) => {
    const key = `${entry.timestamp}:${entry.eventType}:${entry.stageKey ?? ""}`;
    if (durableMoments.has(key)) {
      return [];
    }

    return [{
      id: `execution_log_${input.workOrder.id}_${index}`,
      timestamp: entry.timestamp,
      eventType: entry.eventType,
      title: toFactoryEventTitle(entry.eventType, entry.stageKey),
      stageKey: entry.stageKey,
      source: "derived" as const,
      details: {
        ...(entry.details ?? {}),
        ...(entry.errorCode ? { errorCode: entry.errorCode } : {}),
        ...(entry.errorMessage ? { errorMessage: entry.errorMessage } : {}),
      },
    }];
  });
}

function toFactoryArtifacts(outputs: FactoryOutputRecord[], stageRuns: StageRunRecord[]): ExecutionTimelineArtifact[] {
  const stageRunById = new Map(stageRuns.map((stageRun) => [stageRun.id, stageRun]));

  return outputs.map((output) => {
    const payload = isRecord(output.payload) ? output.payload : undefined;
    const stageRun = output.stageRunId ? stageRunById.get(output.stageRunId) : undefined;
    const label = typeof payload?.label === "string"
      ? payload.label
      : typeof payload?.title === "string"
        ? payload.title
        : titleCase(output.entityKind);

    return {
      id: output.entityId,
      kind: output.entityKind,
      label,
      mimeType: typeof payload?.mimeType === "string" ? payload.mimeType : undefined,
      uri: typeof payload?.uri === "string" ? payload.uri : undefined,
      source: "factory_output",
      stageKey: stageRun?.stageKey ?? null,
      stageRunId: output.stageRunId,
      entityKind: output.entityKind,
      metadata: {
        supersedesEntityId: output.supersedesEntityId,
        createdAt: output.createdAt,
      },
    };
  });
}

function toFactoryCheckpoints(activeCheckpoint?: FactoryCheckpointRecord | null) {
  if (!activeCheckpoint) {
    return [];
  }

  return [{
    checkpointId: activeCheckpoint.checkpointId,
    label: "Active checkpoint",
    createdAt: activeCheckpoint.createdAt,
    consumedAt: activeCheckpoint.consumedAt,
    stageKey: activeCheckpoint.resumeFromStageKey,
    pauseReason: activeCheckpoint.pauseState.reason,
  }];
}

function toFactoryNextActions(input: WorkOrderExecutionTimelineProjectionInput): ExecutionTimelineNextAction[] {
  const actions: ExecutionTimelineNextAction[] = [];

  if (input.workOrder.status === "running") {
    actions.push({
      key: "pause",
      label: "Pause",
      kind: "factory",
      value: input.workOrder.id,
      available: true,
      params: { operation: "pause" },
    });
  }

  if (input.workOrder.status === "paused" && input.activeCheckpoint) {
    actions.push({
      key: "resume",
      label: "Resume",
      kind: "factory",
      value: input.workOrder.id,
      available: true,
      params: { operation: "resume", checkpointId: input.activeCheckpoint.checkpointId },
    });
  }

  if (input.workOrder.status === "paused") {
    actions.push({
      key: "refine",
      label: "Refine",
      kind: "factory",
      value: input.workOrder.id,
      available: true,
      params: { operation: "refine" },
    });
  }

  return actions;
}

export function projectJobExecutionTimeline(input: JobExecutionTimelineProjectionInput): ExecutionTimeline {
  const publication = buildJobPublication(input.job, input.latestRenderableEvent, input.latestRenderableEvent);
  const history = (input.history ?? []).filter((event) => isRenderableJobEventType(event.eventType));
  const events = history.length > 0
    ? history.map((event) => toJobTimelineEvent(input.job, event))
    : [toJobTimelineEvent(input.job, publication.resolvedEvent)];
  const actions = buildJobStatusActions(publication.part) ?? [];

  return {
    executionId: input.job.id,
    executionKind: "job",
    supportLevel: "full",
    state: mapJobStatusToExecutionLifecycleState(input.job.status),
    title: publication.part.title ?? publication.part.label,
    summary: publication.part.summary,
    conversationId: input.job.conversationId,
    userId: input.job.userId,
    toolName: input.job.toolName,
    startedAt: input.job.startedAt,
    completedAt: input.job.completedAt,
    updatedAt: input.job.updatedAt,
    progress: {
      percent: publication.part.progressPercent,
      label: publication.part.progressLabel,
      phases: publication.part.resultEnvelope?.progress?.phases,
      activePhaseKey: publication.part.resultEnvelope?.progress?.activePhaseKey,
    },
    events,
    artifacts: toJobArtifacts(publication.part.resultEnvelope?.artifacts),
    checkpoints: input.job.lastCheckpointId
      ? [{
          checkpointId: input.job.lastCheckpointId,
          label: "Last checkpoint",
          createdAt: input.job.updatedAt,
        }]
      : [],
    nextActions: actions.reduce<ExecutionTimelineNextAction[]>((accumulator, action, index) => {
      if (!isActionLinkInlineNode(action)) {
        return accumulator;
      }

      accumulator.push({
        key: `${action.actionType}_${index}`,
        label: action.label,
        kind: toNextActionKind(action.actionType),
        value: action.value,
        available: true,
        params: action.params,
      });
      return accumulator;
    }, []),
    metadata: {
      failureClass: input.job.failureClass,
      recoveryMode: input.job.recoveryMode,
      replayedFromJobId: input.job.replayedFromJobId,
      supersededByJobId: input.job.supersededByJobId,
      attemptCount: input.job.attemptCount,
      claimedBy: input.job.claimedBy,
    },
  };
}

export function projectWorkOrderExecutionTimeline(input: WorkOrderExecutionTimelineProjectionInput): ExecutionTimeline {
  const durableEvents = toFactoryEventRecords(input.events);
  const executionLogEvents = toExecutionLogEvents(input);
  const events = [...durableEvents, ...executionLogEvents].sort((left, right) => {
    if (left.timestamp === right.timestamp) {
      return left.id.localeCompare(right.id);
    }

    return left.timestamp.localeCompare(right.timestamp);
  });

  return {
    executionId: input.workOrder.id,
    executionKind: "work_order",
    supportLevel: "full",
    state: mapWorkOrderStatus(input.workOrder.status),
    title: `Work order ${input.workOrder.id}`,
    summary: input.workOrder.pausedState?.reason,
    conversationId: input.workOrder.conversationId,
    userId: input.workOrder.userId,
    startedAt: input.workOrder.startedAt,
    completedAt: input.workOrder.completedAt,
    updatedAt: input.workOrder.completedAt ?? input.workOrder.startedAt ?? input.workOrder.createdAt,
    progress: undefined,
    events,
    artifacts: toFactoryArtifacts(input.outputs, input.stageRuns),
    checkpoints: toFactoryCheckpoints(input.activeCheckpoint),
    nextActions: toFactoryNextActions(input),
    metadata: {
      revision: input.workOrder.revision,
      previousWorkOrderIds: [...input.workOrder.previousWorkOrderIds],
      initiatedBy: input.workOrder.initiatedBy,
      activeStageKey: input.stageRuns.find((stageRun) => stageRun.status === "running")?.stageKey ?? null,
    },
  };
}

export function projectToolExecutionTimeline(input: ToolExecutionTimelineProjectionInput): ExecutionTimeline {
  if (!input.envelope) {
    return createUnsupportedExecutionTimeline({
      executionId: input.executionId,
      executionKind: "tool",
      title: input.toolName,
      summary: "Tool execution does not have enough durable state to project a timeline.",
    });
  }

  return {
    executionId: input.executionId,
    executionKind: "tool",
    supportLevel: "limited",
    state: input.envelope.payload ? "succeeded" : "running",
    title: input.toolName,
    summary: input.envelope.summary.message ?? input.envelope.summary.statusLine,
    toolName: input.envelope.toolName,
    progress: input.envelope.progress,
    events: [{
      id: `tool_${input.executionId}`,
      timestamp: new Date(0).toISOString(),
      eventType: input.envelope.payload ? "result" : "progress",
      title: input.envelope.summary.title ?? titleCase(input.toolName),
      summary: input.envelope.summary.message ?? input.envelope.summary.statusLine,
      source: "derived",
    }],
    artifacts: toJobArtifacts(input.envelope.artifacts),
    checkpoints: [],
    nextActions: [],
    metadata: {
      executionMode: input.envelope.executionMode,
      family: input.envelope.family,
      cardKind: input.envelope.cardKind,
      replaySnapshot: input.envelope.replaySnapshot,
    },
  };
}

export function createUnsupportedExecutionTimeline(input: {
  executionId: string;
  executionKind: ExecutionTimeline["executionKind"];
  title: string;
  summary: string;
  conversationId?: string;
}): ExecutionTimeline {
  return {
    executionId: input.executionId,
    executionKind: input.executionKind,
    supportLevel: "unsupported",
    state: "unknown",
    title: input.title,
    summary: input.summary,
    conversationId: input.conversationId,
    events: [],
    artifacts: [],
    checkpoints: [],
    nextActions: [],
  };
}
