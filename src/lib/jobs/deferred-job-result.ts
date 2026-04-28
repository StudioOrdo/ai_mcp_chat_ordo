import type { StreamEvent } from "@/core/entities/chat-stream";
import type { JobEvent, JobRequest, JobStatus } from "@/core/entities/job";
import type { CapabilityResultEnvelope } from "@/core/entities/capability-result";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import { buildJobStatusPart } from "./job-status";
import { jobStatusPartToStreamEvent } from "./job-status-snapshots";

export interface DeferredJobEnvelope {
  jobId: string;
  conversationId: string;
  toolName: string;
  assetId?: string | null;
  label: string;
  title?: string;
  subtitle?: string;
  status: JobStatus;
  sequence: number;
  progressPercent?: number | null;
  progressLabel?: string | null;
  summary?: string;
  error?: string;
  lifecyclePhase?: JobStatusMessagePart["lifecyclePhase"];
  failureCode?: JobStatusMessagePart["failureCode"];
  failureStage?: JobStatusMessagePart["failureStage"];
  resultPayload?: unknown;
  resultEnvelope?: CapabilityResultEnvelope | null;
  failureClass?: JobStatusMessagePart["failureClass"];
  recoveryMode?: JobStatusMessagePart["recoveryMode"];
  replayedFromJobId?: string | null;
  supersededByJobId?: string | null;
  updatedAt?: string;
  deduped?: boolean;
  toolInvocationId?: string;
}

export interface DeferredJobResultPayload {
  deferred_job: DeferredJobEnvelope;
}

export function createDeferredJobResultPayload(
  job: JobRequest,
  event: JobEvent,
  options?: { deduped?: boolean; toolInvocationId?: string },
): DeferredJobResultPayload {
  const part = buildJobStatusPart(job, event);

  return {
    deferred_job: {
      jobId: job.id,
      ...(options?.toolInvocationId ?? part.toolInvocationId
        ? { toolInvocationId: options?.toolInvocationId ?? part.toolInvocationId }
        : {}),
      conversationId: job.conversationId,
      toolName: job.toolName,
      assetId:
        typeof job.requestPayload.assetId === "string" && job.requestPayload.assetId.trim().length > 0
          ? job.requestPayload.assetId
          : null,
      label: part.label,
      title: part.title,
      subtitle: part.subtitle,
      status: part.status,
      sequence: part.sequence ?? event.sequence,
      progressPercent: part.progressPercent,
      progressLabel: part.progressLabel,
      summary: part.summary,
      error: part.error,
      lifecyclePhase: part.lifecyclePhase,
      failureCode: part.failureCode,
      failureStage: part.failureStage,
      resultPayload: job.resultPayload ?? part.resultPayload,
      resultEnvelope: part.resultEnvelope ?? null,
      failureClass: part.failureClass,
      recoveryMode: part.recoveryMode,
      replayedFromJobId: part.replayedFromJobId,
      supersededByJobId: part.supersededByJobId,
      updatedAt: part.updatedAt,
      deduped: options?.deduped,
    },
  };
}

export function isDeferredJobResultPayload(value: unknown): value is DeferredJobResultPayload {
  return (
    typeof value === "object"
    && value !== null
    && "deferred_job" in value
    && typeof (value as { deferred_job?: unknown }).deferred_job === "object"
    && (value as { deferred_job?: unknown }).deferred_job !== null
  );
}

export function deferredJobResultToMessagePart(
  payload: DeferredJobResultPayload,
  fallbackToolInvocationId?: string,
): JobStatusMessagePart {
  const deferredJob = payload.deferred_job;
  const resultEnvelope = deferredJob.resultEnvelope ?? null;
  const envelopeSummary = resultEnvelope?.summary;
  const envelopeProgress = resultEnvelope?.progress;
  const summary = deferredJob.deduped && (deferredJob.status === "queued" || deferredJob.status === "running")
    ? `Using existing ${deferredJob.label} job in this conversation.`
    : deferredJob.summary ?? envelopeSummary?.message;

  return {
    type: "job_status",
    jobId: deferredJob.jobId,
    ...(deferredJob.toolInvocationId ?? fallbackToolInvocationId
      ? { toolInvocationId: deferredJob.toolInvocationId ?? fallbackToolInvocationId }
      : {}),
    toolName: deferredJob.toolName,
    label: deferredJob.label,
    title: deferredJob.title ?? envelopeSummary?.title,
    subtitle: deferredJob.subtitle ?? envelopeSummary?.subtitle,
    status: deferredJob.status,
    sequence: deferredJob.sequence,
    progressPercent: deferredJob.progressPercent ?? envelopeProgress?.percent,
    progressLabel: deferredJob.progressLabel ?? envelopeProgress?.label,
    summary,
    error: deferredJob.error,
    lifecyclePhase: deferredJob.lifecyclePhase,
    failureCode: deferredJob.failureCode,
    failureStage: deferredJob.failureStage,
    resultPayload: deferredJob.resultPayload,
    resultEnvelope,
    failureClass: deferredJob.failureClass,
    recoveryMode: deferredJob.recoveryMode,
    replayedFromJobId: deferredJob.replayedFromJobId,
    supersededByJobId: deferredJob.supersededByJobId,
    updatedAt: deferredJob.updatedAt,
  };
}

export function deferredJobResultToStreamEvent(
  payload: DeferredJobResultPayload,
  fallbackToolInvocationId?: string,
): Extract<
  StreamEvent,
  { type: "job_queued" | "job_started" | "job_progress" | "job_completed" | "job_failed" | "job_canceled" }
> {
  const deferredJob = payload.deferred_job;
  return jobStatusPartToStreamEvent(deferredJobResultToMessagePart(payload, fallbackToolInvocationId), {
    conversationId: deferredJob.conversationId,
    sequence: deferredJob.sequence,
  });
}