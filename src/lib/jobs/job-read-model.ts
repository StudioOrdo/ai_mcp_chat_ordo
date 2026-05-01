import type {
  CapabilityArtifactRef,
  CapabilityResultEnvelope,
} from "@/core/entities/capability-result";
import type {
  JobEvent,
  JobFailureClass,
  JobInitiatorType,
  JobRecoveryMode,
  JobRequest,
  JobStatus,
} from "@/core/entities/job";
import type { MaterializationRecord } from "@/core/entities/materialization";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import { buildJobPublication } from "@/lib/jobs/job-publication";

const ACTIVE_JOB_STATUSES: JobStatus[] = ["queued", "running"];

export type CanonicalJobOriginFallback = "explicit_origin" | "tool_invocation" | "job_created_at";

export interface CanonicalJobOrigin {
  originMessageId?: string;
  originTurnId?: string;
  toolInvocationId?: string;
  fallback: CanonicalJobOriginFallback;
}

export interface CanonicalJobOwnership {
  userId: string | null;
  visibility: "owner" | "anonymous_session" | "admin";
  initiatorType: JobInitiatorType;
}

export interface CanonicalJobFailure {
  failureClass: JobFailureClass | null;
  recoveryMode: JobRecoveryMode | null;
  nextRetryAt: string | null;
  lastCheckpointId: string | null;
  replayedFromJobId: string | null;
  supersededByJobId: string | null;
}

export interface CanonicalJobSnapshot {
  jobId: string;
  conversationId: string;
  userId: string | null;
  toolName: string;
  label: string;
  title?: string;
  subtitle?: string;
  status: JobStatus;
  sequence: number;
  progressPercent?: number | null;
  progressLabel?: string | null;
  summary?: string;
  error?: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  origin: CanonicalJobOrigin;
  inputSnapshot: Record<string, unknown>;
  resultPayload?: unknown;
  resultEnvelope: CapabilityResultEnvelope | null;
  artifactRefs: readonly CapabilityArtifactRef[];
  materializationRefs: readonly string[];
  ownership: CanonicalJobOwnership;
  failure: CanonicalJobFailure;
}

export interface BuildCanonicalJobSnapshotOptions {
  materialization?: MaterializationRecord | null;
}

export function isCanonicalJobSnapshot(value: unknown): value is CanonicalJobSnapshot {
  return typeof value === "object"
    && value !== null
    && typeof (value as { jobId?: unknown }).jobId === "string"
    && typeof (value as { conversationId?: unknown }).conversationId === "string"
    && typeof (value as { toolName?: unknown }).toolName === "string"
    && typeof (value as { label?: unknown }).label === "string"
    && typeof (value as { status?: unknown }).status === "string"
    && typeof (value as { createdAt?: unknown }).createdAt === "string"
    && typeof (value as { updatedAt?: unknown }).updatedAt === "string";
}

export function getActiveJobStatuses(): JobStatus[] {
  return [...ACTIVE_JOB_STATUSES];
}

function toEventType(status: JobStatus): JobEvent["eventType"] {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "progress";
    case "succeeded":
      return "result";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    case "dead_letter":
      return "failed";
  }
}

export function buildSyntheticJobEvent(job: JobRequest): JobEvent {
  return {
    id: `synthetic_${job.id}`,
    jobId: job.id,
    conversationId: job.conversationId,
    sequence: 0,
    eventType: toEventType(job.status),
    payload: {
      result: job.resultPayload ?? undefined,
      errorMessage: job.errorMessage ?? undefined,
      progressPercent: job.progressPercent ?? undefined,
      progressLabel: job.progressLabel ?? undefined,
    },
    createdAt: job.updatedAt,
  };
}

function resolveOrigin(job: JobRequest): CanonicalJobOrigin {
  if (job.originMessageId || job.originTurnId) {
    return {
      ...(job.originMessageId ? { originMessageId: job.originMessageId } : {}),
      ...(job.originTurnId ? { originTurnId: job.originTurnId } : {}),
      ...(job.toolInvocationId ? { toolInvocationId: job.toolInvocationId } : {}),
      fallback: "explicit_origin",
    };
  }

  if (job.toolInvocationId) {
    return {
      toolInvocationId: job.toolInvocationId,
      fallback: "tool_invocation",
    };
  }

  return {
    fallback: "job_created_at",
  };
}

function resolveOwnership(job: JobRequest): CanonicalJobOwnership {
  return {
    userId: job.userId,
    visibility: job.userId ? "owner" : "anonymous_session",
    initiatorType: job.initiatorType,
  };
}

function resolveMaterializationRefs(materialization?: MaterializationRecord | null): readonly string[] {
  return materialization ? [materialization.id] : [];
}

const SENSITIVE_INPUT_KEY = /(?:api[_-]?key|authorization|cookie|credential|password|passwd|private[_-]?key|secret|session|token)/i;
const REDACTED_VALUE = "[redacted]";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactSnapshotValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSnapshotValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SENSITIVE_INPUT_KEY.test(key) ? REDACTED_VALUE : redactSnapshotValue(entry),
    ]),
  );
}

export function redactJobInputSnapshot(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) {
    return {};
  }

  return redactSnapshotValue(input) as Record<string, unknown>;
}

/**
 * Build the product-facing job snapshot. This is the only product read-model
 * DTO for job lifecycle rendering; transcript-shaped message parts must not be
 * used as the product contract.
 */
export function buildCanonicalJobSnapshot(
  job: JobRequest,
  event?: JobEvent | null,
  options: BuildCanonicalJobSnapshotOptions = {},
): CanonicalJobSnapshot {
  const publication = buildJobPublication(job, event);
  const part = publication.part;
  const rawResultEnvelope = part.resultEnvelope ?? null;
  const resultEnvelope = rawResultEnvelope
    ? {
        ...rawResultEnvelope,
        inputSnapshot: redactJobInputSnapshot(rawResultEnvelope.inputSnapshot),
      }
    : null;
  const updatedAt = part.updatedAt ?? publication.resolvedEvent.createdAt ?? job.updatedAt;

  return {
    jobId: job.id,
    conversationId: job.conversationId,
    userId: job.userId,
    toolName: job.toolName,
    label: part.label,
    title: part.title,
    subtitle: part.subtitle,
    status: part.status,
    sequence: part.sequence ?? publication.resolvedEvent.sequence,
    progressPercent: part.progressPercent,
    progressLabel: part.progressLabel,
    summary: part.summary,
    error: part.error,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    updatedAt,
    origin: resolveOrigin(job),
    inputSnapshot: resultEnvelope?.inputSnapshot ?? redactJobInputSnapshot(job.requestPayload),
    resultPayload: part.resultPayload,
    resultEnvelope,
    artifactRefs: resultEnvelope?.artifacts ?? [],
    materializationRefs: resolveMaterializationRefs(options.materialization),
    ownership: resolveOwnership(job),
    failure: {
      failureClass: part.failureClass ?? job.failureClass,
      recoveryMode: part.recoveryMode ?? job.recoveryMode,
      nextRetryAt: part.nextRetryAt ?? job.nextRetryAt,
      lastCheckpointId: part.lastCheckpointId ?? job.lastCheckpointId,
      replayedFromJobId: part.replayedFromJobId ?? job.replayedFromJobId,
      supersededByJobId: part.supersededByJobId ?? job.supersededByJobId,
    },
  };
}

export function canonicalJobSnapshotToStatusPart(snapshot: CanonicalJobSnapshot): JobStatusMessagePart {
  return {
    type: "job_status",
    jobId: snapshot.jobId,
    ...(snapshot.origin.toolInvocationId ? { toolInvocationId: snapshot.origin.toolInvocationId } : {}),
    toolName: snapshot.toolName,
    label: snapshot.label,
    title: snapshot.title,
    subtitle: snapshot.subtitle,
    status: snapshot.status,
    sequence: snapshot.sequence,
    progressPercent: snapshot.progressPercent,
    progressLabel: snapshot.progressLabel,
    summary: snapshot.summary,
    error: snapshot.error,
    updatedAt: snapshot.updatedAt,
    resultPayload: snapshot.resultPayload,
    resultEnvelope: snapshot.resultEnvelope,
    failureClass: snapshot.failure.failureClass,
    recoveryMode: snapshot.failure.recoveryMode,
    nextRetryAt: snapshot.failure.nextRetryAt,
    lastCheckpointId: snapshot.failure.lastCheckpointId,
    replayedFromJobId: snapshot.failure.replayedFromJobId,
    supersededByJobId: snapshot.failure.supersededByJobId,
    startedAt: snapshot.startedAt,
    completedAt: snapshot.completedAt,
  };
}
