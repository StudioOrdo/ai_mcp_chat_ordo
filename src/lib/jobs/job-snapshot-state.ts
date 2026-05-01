import type { StreamEvent } from "@/core/entities/chat-stream";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import { sortUserJobSnapshots } from "@/lib/jobs/user-jobs-workspace";

export type JobSnapshotStreamEvent = Extract<
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

function toTimestamp(value: string | undefined): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

export function compareJobSnapshotFreshness(left: CanonicalJobSnapshot, right: CanonicalJobSnapshot): number {
  const leftSequence = left.sequence ?? -1;
  const rightSequence = right.sequence ?? -1;

  if (leftSequence !== rightSequence) {
    return leftSequence - rightSequence;
  }

  return toTimestamp(left.updatedAt) - toTimestamp(right.updatedAt);
}

export function mergeJobSnapshots(
  current: readonly CanonicalJobSnapshot[],
  incoming: readonly CanonicalJobSnapshot[],
): CanonicalJobSnapshot[] {
  if (incoming.length === 0) {
    return sortUserJobSnapshots([...current]);
  }

  const byJobId = new Map<string, CanonicalJobSnapshot>();
  for (const snapshot of current) {
    byJobId.set(snapshot.jobId, snapshot);
  }

  for (const snapshot of incoming) {
    const existing = byJobId.get(snapshot.jobId);
    if (!existing || compareJobSnapshotFreshness(existing, snapshot) <= 0) {
      byJobId.set(snapshot.jobId, existing ? mergeCanonicalJobSnapshot(existing, snapshot) : snapshot);
    }
  }

  return sortUserJobSnapshots([...byJobId.values()]);
}

function mergeCanonicalJobSnapshot(
  existing: CanonicalJobSnapshot,
  incoming: CanonicalJobSnapshot,
): CanonicalJobSnapshot {
  return {
    ...existing,
    ...incoming,
    title: incoming.title ?? existing.title,
    subtitle: incoming.subtitle ?? existing.subtitle,
    progressPercent: incoming.progressPercent !== undefined ? incoming.progressPercent : existing.progressPercent,
    progressLabel: incoming.progressLabel !== undefined ? incoming.progressLabel : existing.progressLabel,
    summary: incoming.summary ?? existing.summary,
    error: incoming.error ?? existing.error,
    resultPayload: incoming.resultPayload !== undefined ? incoming.resultPayload : existing.resultPayload,
    resultEnvelope: incoming.resultEnvelope !== undefined ? incoming.resultEnvelope : existing.resultEnvelope,
    artifactRefs: incoming.artifactRefs.length > 0 ? incoming.artifactRefs : existing.artifactRefs,
    materializationRefs: incoming.materializationRefs.length > 0 ? incoming.materializationRefs : existing.materializationRefs,
    origin: {
      ...existing.origin,
      ...incoming.origin,
    },
    ownership: {
      ...existing.ownership,
      ...incoming.ownership,
    },
    failure: {
      ...existing.failure,
      ...incoming.failure,
    },
  };
}

function mapStreamEventStatus(event: JobSnapshotStreamEvent): CanonicalJobSnapshot["status"] {
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

export function buildJobStatusPartFromStreamEvent(event: JobSnapshotStreamEvent): JobStatusMessagePart {
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

export function buildJobSnapshotFromStreamEvent(event: JobSnapshotStreamEvent): CanonicalJobSnapshot {
  const part = buildJobStatusPartFromStreamEvent(event);
  const now = new Date().toISOString();
  const updatedAt = event.updatedAt ?? part.updatedAt ?? now;

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
    createdAt: updatedAt,
    startedAt: part.startedAt ?? null,
    completedAt: part.status === "succeeded" || part.status === "failed" || part.status === "canceled"
      ? part.completedAt ?? updatedAt
      : part.completedAt ?? null,
    updatedAt,
    origin: {
      ...(event.messageId ? { originMessageId: event.messageId } : {}),
      ...(part.toolInvocationId ? { toolInvocationId: part.toolInvocationId } : {}),
      fallback: event.messageId ? "explicit_origin" : part.toolInvocationId ? "tool_invocation" : "job_created_at",
    },
    inputSnapshot: part.resultEnvelope?.inputSnapshot ?? {},
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
