import type { JobRequest, JobStatus } from "@/core/entities/job";
import type { WorkOrder, WorkOrderStatus } from "@/core/entities/work-order";
import type { FactoryCheckpointRecord } from "@/core/use-cases/FactoryRepository";
import type { ExecutionKind, ExecutionTimeline } from "@/core/platform/execution/ExecutionTimeline";
import type { RevisionAction, RevisionInspection, RevisionState } from "@/core/platform/revision/RevisionContract";
import { getJobCapability } from "@/lib/jobs/job-capability-registry";
import { canManualReplayJob, isJobCancelable } from "@/lib/jobs/manual-replay";

export interface JobRevisionProjectionInput {
  job: Pick<
    JobRequest,
    | "id"
    | "conversationId"
    | "userId"
    | "toolName"
    | "status"
    | "recoveryMode"
    | "lastCheckpointId"
    | "replayedFromJobId"
    | "supersededByJobId"
    | "startedAt"
    | "completedAt"
    | "updatedAt"
  >;
  timeline?: Pick<ExecutionTimeline, "title" | "summary" | "supportLevel" | "updatedAt">;
}

export interface WorkOrderRevisionProjectionInput {
  workOrder: Pick<
    WorkOrder,
    | "id"
    | "status"
    | "conversationId"
    | "userId"
    | "revision"
    | "previousWorkOrderIds"
    | "pausedState"
    | "startedAt"
    | "completedAt"
    | "createdAt"
  >;
  activeCheckpoint?: FactoryCheckpointRecord | null;
  timeline?: Pick<ExecutionTimeline, "title" | "summary" | "supportLevel">;
}

export interface UnsupportedRevisionProjectionInput {
  executionId: string;
  executionKind: ExecutionKind;
  title: string;
  summary: string;
  conversationId?: string;
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function mapJobStatusToRevisionState(status: JobStatus, canRetry: boolean): RevisionState {
  switch (status) {
    case "queued":
    case "running":
      return "active";
    case "failed":
    case "canceled":
    case "dead_letter":
      return canRetry ? "recoverable" : "terminal";
    case "succeeded":
      return "terminal";
  }
}

function mapWorkOrderStatusToRevisionState(status: WorkOrderStatus): RevisionState {
  switch (status) {
    case "planned":
    case "running":
      return "active";
    case "paused":
      return "paused";
    case "succeeded":
    case "failed":
    case "canceled":
      return "terminal";
  }
}

export function projectJobRevisionActions(
  job: Pick<JobRequest, "id" | "status" | "toolName">,
): RevisionAction[] {
  const actions: RevisionAction[] = [];

  if (isJobCancelable(job.status)) {
    actions.push({
      key: "cancel",
      label: "Cancel",
      operation: "cancel",
      transportKind: "job",
      value: job.id,
      available: true,
      params: { operation: "cancel" },
    });
  }

  if (canManualReplayJob(job)) {
    actions.push({
      key: "retry",
      label: job.status === "dead_letter" ? "Recover job" : "Retry",
      operation: "retry",
      transportKind: "job",
      value: job.id,
      available: true,
      params: { operation: "retry" },
    });
  }

  return actions;
}

function buildJobRevisionSummary(state: RevisionState, hasReducedSupport: boolean): string {
  if (!hasReducedSupport) {
    return "This job is not backed by a platform revision owner.";
  }

  switch (state) {
    case "active":
      return "Reduced revision support is available while this job is in progress.";
    case "recoverable":
      return "Reduced revision support is available through whole-job replay.";
    case "terminal":
      return "This job exposes reduced revision support, but no revision actions are available in its current state.";
    default:
      return "This job is not backed by a platform revision owner.";
  }
}

export function projectJobRevision(input: JobRevisionProjectionInput): RevisionInspection {
  const actions = projectJobRevisionActions(input.job);
  const hasReducedSupport = actions.length > 0 || getJobCapability(input.job.toolName) !== null;
  const state = mapJobStatusToRevisionState(input.job.status, actions.some((action) => action.operation === "retry"));

  return {
    executionId: input.job.id,
    executionKind: "job",
    supportLevel: hasReducedSupport ? "reduced" : "unsupported",
    state: hasReducedSupport ? state : "unsupported",
    title: input.timeline?.title ?? titleCase(input.job.toolName),
    summary: input.timeline?.summary ?? buildJobRevisionSummary(state, hasReducedSupport),
    conversationId: input.job.conversationId,
    userId: input.job.userId,
    toolName: input.job.toolName,
    actions,
    checkpoints: input.job.lastCheckpointId
      ? [{
          checkpointId: input.job.lastCheckpointId,
          label: "Last checkpoint",
          createdAt: input.timeline?.updatedAt ?? input.job.updatedAt ?? input.job.completedAt ?? input.job.startedAt ?? null,
        }]
      : [],
    metadata: {
      recoveryMode: input.job.recoveryMode,
      replayedFromJobId: input.job.replayedFromJobId,
      supersededByJobId: input.job.supersededByJobId,
      executionSupportLevel: input.timeline?.supportLevel,
    },
  };
}

function buildWorkOrderRevisionSummary(input: WorkOrderRevisionProjectionInput, state: RevisionState): string {
  if (input.timeline?.summary) {
    return input.timeline.summary;
  }

  if (state === "paused") {
    return input.workOrder.pausedState?.reason ?? "Advanced revision support is available while this work order is paused.";
  }

  if (state === "active") {
    return "Advanced revision support is available while this work order is active.";
  }

  return "This work order is backed by the factory revision runtime, but no revision actions are available in its current state.";
}

export function projectWorkOrderRevision(input: WorkOrderRevisionProjectionInput): RevisionInspection {
  const state = mapWorkOrderStatusToRevisionState(input.workOrder.status);
  const actions: RevisionAction[] = [];

  if (input.workOrder.status === "running") {
    actions.push({
      key: "pause",
      label: "Pause",
      operation: "pause",
      transportKind: "factory",
      value: input.workOrder.id,
      available: true,
      params: { operation: "pause" },
    });
  }

  if (input.workOrder.status === "paused") {
    actions.push({
      key: "refine",
      label: "Refine",
      operation: "refine",
      transportKind: "factory",
      value: input.workOrder.id,
      available: true,
      params: { operation: "refine" },
    });

    if (input.activeCheckpoint) {
      actions.push({
        key: "resume",
        label: "Resume",
        operation: "resume",
        transportKind: "factory",
        value: input.workOrder.id,
        available: true,
        params: {
          operation: "resume",
          checkpointId: input.activeCheckpoint.checkpointId,
        },
      });
    }
  }

  return {
    executionId: input.workOrder.id,
    executionKind: "work_order",
    supportLevel: "advanced",
    state,
    title: input.timeline?.title ?? `Work order ${input.workOrder.id}`,
    summary: buildWorkOrderRevisionSummary(input, state),
    conversationId: input.workOrder.conversationId,
    userId: input.workOrder.userId,
    actions,
    checkpoints: input.activeCheckpoint
      ? [{
          checkpointId: input.activeCheckpoint.checkpointId,
          label: "Active checkpoint",
          createdAt: input.activeCheckpoint.createdAt,
          consumedAt: input.activeCheckpoint.consumedAt,
          stageKey: input.activeCheckpoint.resumeFromStageKey,
          reason: input.activeCheckpoint.pauseState.reason,
        }]
      : [],
    metadata: {
      revision: input.workOrder.revision,
      previousWorkOrderIds: [...input.workOrder.previousWorkOrderIds],
      pausedAt: input.workOrder.pausedState?.pausedAt,
      resumeFromStageKey: input.workOrder.pausedState?.resumeFromStageKey,
      executionSupportLevel: input.timeline?.supportLevel,
    },
  };
}

export function createUnsupportedRevision(input: UnsupportedRevisionProjectionInput): RevisionInspection {
  return {
    executionId: input.executionId,
    executionKind: input.executionKind,
    supportLevel: "unsupported",
    state: "unsupported",
    title: input.title,
    summary: input.summary,
    conversationId: input.conversationId,
    actions: [],
    checkpoints: [],
  };
}