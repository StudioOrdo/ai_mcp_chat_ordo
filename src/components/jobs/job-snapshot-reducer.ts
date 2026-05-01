import type { StreamEvent } from "@/core/entities/chat-stream";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import type { JobHistoryEntry } from "@/lib/jobs/job-event-history";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import type { UserJobsWorkspaceData } from "@/lib/jobs/load-user-jobs-workspace";
import { sortUserJobSnapshots } from "@/lib/jobs/user-jobs-workspace";

export type JobsWorkspaceStreamEvent = Extract<
  StreamEvent,
  {
    type:
      | "job_queued"
      | "job_started"
      | "job_progress"
      | "job_completed"
      | "job_failed"
      | "job_canceled";
  }
>;

export type JobsWorkspaceState = UserJobsWorkspaceData;

function toTimestamp(value: string | undefined): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function compareSnapshotFreshness(left: CanonicalJobSnapshot, right: CanonicalJobSnapshot): number {
  const leftSequence = left.sequence ?? -1;
  const rightSequence = right.sequence ?? -1;

  if (leftSequence !== rightSequence) {
    return leftSequence - rightSequence;
  }

  return toTimestamp(left.updatedAt) - toTimestamp(right.updatedAt);
}

function pickFresherSnapshot(
  current: CanonicalJobSnapshot | null,
  incoming: CanonicalJobSnapshot | null,
): CanonicalJobSnapshot | null {
  if (!current) {
    return incoming;
  }

  if (!incoming) {
    return current;
  }

  return compareSnapshotFreshness(current, incoming) > 0 ? current : incoming;
}

function mapStreamEventStatus(event: JobsWorkspaceStreamEvent): CanonicalJobSnapshot["status"] {
  switch (event.type) {
    case "job_queued":
      return "queued";
    case "job_started":
    case "job_progress":
      return "running";
    case "job_completed":
      return "succeeded";
    case "job_failed":
      return "failed";
    case "job_canceled":
      return "canceled";
  }
}

function mapStreamEventType(event: JobsWorkspaceStreamEvent): JobHistoryEntry["eventType"] {
  switch (event.type) {
    case "job_queued":
      return "queued";
    case "job_started":
      return "started";
    case "job_progress":
      return "progress";
    case "job_completed":
      return "result";
    case "job_failed":
      return "failed";
    case "job_canceled":
      return "canceled";
  }
}

function buildJobPartFromStreamEvent(event: JobsWorkspaceStreamEvent): JobStatusMessagePart {
  if (event.part) {
    return {
      ...event.part,
      sequence: event.sequence,
    };
  }

  return {
    type: "job_status",
    jobId: event.jobId,
    toolName: event.toolName,
    label: event.label,
    title: event.title,
    subtitle: event.subtitle,
    status: mapStreamEventStatus(event),
    sequence: event.sequence,
    progressPercent: event.type === "job_progress" ? event.progressPercent ?? null : null,
    progressLabel: event.type === "job_progress" ? event.progressLabel ?? null : null,
    summary: event.type === "job_completed" ? event.summary : undefined,
    error: event.type === "job_failed" ? event.error : undefined,
    updatedAt: event.updatedAt,
    resultPayload: event.type === "job_completed" ? event.resultPayload : undefined,
  };
}

export function buildJobSnapshotFromStreamEvent(event: JobsWorkspaceStreamEvent): CanonicalJobSnapshot {
  const part = buildJobPartFromStreamEvent(event);

  return {
    jobId: event.jobId,
    conversationId: event.conversationId,
    userId: null,
    toolName: part.toolName,
    label: part.label,
    title: part.title,
    subtitle: part.subtitle,
    status: part.status,
    sequence: part.sequence ?? event.sequence,
    progressPercent: part.progressPercent,
    progressLabel: part.progressLabel,
    summary: part.summary,
    error: part.error,
    createdAt: event.updatedAt ?? new Date().toISOString(),
    startedAt: null,
    completedAt: part.status === "succeeded" || part.status === "failed" || part.status === "canceled"
      ? event.updatedAt ?? null
      : null,
    updatedAt: event.updatedAt ?? new Date().toISOString(),
    origin: {
      ...(event.messageId ? { originMessageId: event.messageId } : {}),
      ...(part.toolInvocationId ? { toolInvocationId: part.toolInvocationId } : {}),
      fallback: event.messageId ? "explicit_origin" : part.toolInvocationId ? "tool_invocation" : "job_created_at",
    },
    inputSnapshot: {},
    resultPayload: part.resultPayload,
    resultEnvelope: part.resultEnvelope ?? null,
    artifactRefs: part.resultEnvelope?.artifacts ?? [],
    materializationRefs: [],
    ownership: {
      userId: null,
      visibility: "anonymous_session",
      initiatorType: "user",
    },
    failure: {
      failureClass: part.failureClass ?? null,
      recoveryMode: part.recoveryMode ?? null,
      nextRetryAt: part.nextRetryAt ?? null,
      lastCheckpointId: part.lastCheckpointId ?? null,
      replayedFromJobId: part.replayedFromJobId ?? null,
      supersededByJobId: part.supersededByJobId ?? null,
    },
  };
}

export function buildJobHistoryEntryFromStreamEvent(event: JobsWorkspaceStreamEvent): JobHistoryEntry {
  return {
    id: `${event.jobId}_${event.sequence}`,
    jobId: event.jobId,
    conversationId: event.conversationId,
    sequence: event.sequence,
    eventType: mapStreamEventType(event),
    createdAt: event.updatedAt ?? new Date().toISOString(),
    part: buildJobPartFromStreamEvent(event),
  };
}

export function buildOptimisticJobHistoryEntry(
  snapshot: CanonicalJobSnapshot,
  eventType: JobHistoryEntry["eventType"],
  sequence?: number,
): JobHistoryEntry {
  return {
    id: `${snapshot.jobId}_${sequence ?? snapshot.sequence ?? "optimistic"}`,
    jobId: snapshot.jobId,
    conversationId: snapshot.conversationId ?? "",
    sequence: sequence ?? snapshot.sequence ?? 0,
    eventType,
    createdAt: snapshot.updatedAt ?? new Date().toISOString(),
    part: {
      type: "job_status",
      jobId: snapshot.jobId,
      toolName: snapshot.toolName,
      label: snapshot.label,
      title: snapshot.title,
      subtitle: snapshot.subtitle,
      status: snapshot.status,
      progressPercent: snapshot.progressPercent,
      progressLabel: snapshot.progressLabel,
      summary: snapshot.summary,
      error: snapshot.error,
      updatedAt: snapshot.updatedAt,
      resultPayload: snapshot.resultPayload,
      resultEnvelope: snapshot.resultEnvelope ?? undefined,
      failureClass: snapshot.failure.failureClass,
      recoveryMode: snapshot.failure.recoveryMode,
      nextRetryAt: snapshot.failure.nextRetryAt,
      lastCheckpointId: snapshot.failure.lastCheckpointId,
      replayedFromJobId: snapshot.failure.replayedFromJobId,
      supersededByJobId: snapshot.failure.supersededByJobId,
      sequence: sequence ?? snapshot.sequence,
    },
  };
}

function upsertJobSnapshot(jobs: CanonicalJobSnapshot[], nextSnapshot: CanonicalJobSnapshot): CanonicalJobSnapshot[] {
  const index = jobs.findIndex((job) => job.jobId === nextSnapshot.jobId);
  if (index === -1) {
    return sortUserJobSnapshots([nextSnapshot, ...jobs]);
  }

  if (compareSnapshotFreshness(jobs[index], nextSnapshot) > 0) {
    return sortUserJobSnapshots(jobs);
  }

  const nextJobs = [...jobs];
  nextJobs[index] = nextSnapshot;
  return sortUserJobSnapshots(nextJobs);
}

function mergeJobHistoryEntry(history: JobHistoryEntry[], nextEntry: JobHistoryEntry): JobHistoryEntry[] {
  const index = history.findIndex(
    (entry) => entry.jobId === nextEntry.jobId && entry.sequence === nextEntry.sequence,
  );

  if (index === -1) {
    return [...history, nextEntry].sort((left, right) => left.sequence - right.sequence);
  }

  const nextHistory = [...history];
  nextHistory[index] = nextEntry;
  return nextHistory;
}

export function createJobsWorkspaceState(data: UserJobsWorkspaceData): JobsWorkspaceState {
  return {
    workflows: data.workflows ?? [],
    jobs: sortUserJobSnapshots(data.jobs),
    selectedJobId: data.selectedJobId,
    selectedJob: data.selectedJob,
    selectedJobHistory: [...data.selectedJobHistory].sort((left, right) => left.sequence - right.sequence),
  };
}

export function replaceJobsWorkspaceState(
  currentState: JobsWorkspaceState,
  nextState: UserJobsWorkspaceData,
): JobsWorkspaceState {
  const jobs = nextState.jobs.reduce(
    (merged, snapshot) => upsertJobSnapshot(merged, snapshot),
    sortUserJobSnapshots(currentState.jobs),
  );

  const selectedJobId = nextState.selectedJobId;
  const selectedJob = selectedJobId
    ? pickFresherSnapshot(
      currentState.selectedJobId === selectedJobId ? currentState.selectedJob : null,
      nextState.selectedJob,
    )
    : nextState.selectedJob;

  const historyMap = new Map<string, JobHistoryEntry>();
  for (const entry of currentState.selectedJobHistory) {
    historyMap.set(`${entry.jobId}:${entry.sequence}`, entry);
  }
  for (const entry of nextState.selectedJobHistory) {
    historyMap.set(`${entry.jobId}:${entry.sequence}`, entry);
  }

  return {
    workflows: nextState.workflows ?? currentState.workflows,
    jobs,
    selectedJobId,
    selectedJob,
    selectedJobHistory: Array.from(historyMap.values())
      .filter((entry) => !selectedJobId || entry.jobId === selectedJobId)
      .sort((left, right) => left.sequence - right.sequence),
  };
}

export function selectJobsWorkspaceJob(
  state: JobsWorkspaceState,
  jobId: string,
  selectedJobHistory: JobHistoryEntry[] = [],
): JobsWorkspaceState {
  const selectedJob = state.jobs.find((job) => job.jobId === jobId) ?? state.selectedJob;

  return {
    ...state,
    selectedJobId: jobId,
    selectedJob: selectedJob?.jobId === jobId ? selectedJob : null,
    selectedJobHistory: [...selectedJobHistory].sort((left, right) => left.sequence - right.sequence),
  };
}

export function reconcileSelectedJobsWorkspaceJob(
  state: JobsWorkspaceState,
  jobId: string,
  selectedJob: CanonicalJobSnapshot | null,
  selectedJobHistory: JobHistoryEntry[],
): JobsWorkspaceState {
  const currentSelected = state.selectedJobId === jobId ? state.selectedJob : null;
  const freshestSelected = pickFresherSnapshot(currentSelected, selectedJob);
  const jobs = freshestSelected ? upsertJobSnapshot(state.jobs, freshestSelected) : state.jobs;

  const historyMap = new Map<string, JobHistoryEntry>();
  for (const entry of state.selectedJobHistory) {
    if (entry.jobId === jobId) {
      historyMap.set(`${entry.jobId}:${entry.sequence}`, entry);
    }
  }
  for (const entry of selectedJobHistory) {
    if (entry.jobId === jobId) {
      historyMap.set(`${entry.jobId}:${entry.sequence}`, entry);
    }
  }

  return {
    ...state,
    jobs,
    selectedJobId: jobId,
    selectedJob: freshestSelected,
    selectedJobHistory: Array.from(historyMap.values()).sort((left, right) => left.sequence - right.sequence),
  };
}

export function applyJobsWorkspaceEvent(
  state: JobsWorkspaceState,
  event: JobsWorkspaceStreamEvent,
): JobsWorkspaceState {
  const snapshot = buildJobSnapshotFromStreamEvent(event);
  const jobs = upsertJobSnapshot(state.jobs, snapshot);

  if (state.selectedJobId !== snapshot.jobId) {
    return {
      ...state,
      jobs,
    };
  }

  return {
    ...state,
    jobs,
    selectedJobId: state.selectedJobId,
    selectedJob: pickFresherSnapshot(state.selectedJob, snapshot),
    selectedJobHistory: mergeJobHistoryEntry(
      state.selectedJobHistory,
      buildJobHistoryEntryFromStreamEvent(event),
    ),
  };
}

export function applyOptimisticJobSnapshot(
  state: JobsWorkspaceState,
  snapshot: CanonicalJobSnapshot,
  options?: {
    selectJob?: boolean;
    optimisticHistoryEntry?: JobHistoryEntry;
  },
): JobsWorkspaceState {
  const jobs = upsertJobSnapshot(state.jobs, snapshot);
  const selectJob = options?.selectJob ?? state.selectedJobId === snapshot.jobId;

  if (!selectJob) {
    return {
      ...state,
      jobs,
    };
  }

  return {
    ...state,
    jobs,
    selectedJobId: snapshot.jobId,
    selectedJob: snapshot,
    selectedJobHistory: options?.optimisticHistoryEntry
      ? mergeJobHistoryEntry(state.selectedJobHistory, options.optimisticHistoryEntry)
      : state.selectedJobHistory,
  };
}

export function getJobsWorkspaceMaxSequence(state: JobsWorkspaceState): number {
  return Math.max(
    0,
    ...state.jobs.map((job) => job.sequence ?? 0),
    ...state.selectedJobHistory.map((entry) => entry.sequence),
    state.selectedJob?.sequence ?? 0,
  );
}
