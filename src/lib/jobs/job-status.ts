import type { JobEvent, JobRequest } from "@/core/entities/job";
import type {
  CapabilityArtifactRef,
  CapabilityProgressPhase,
} from "@/core/entities/capability-result";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";

import {
  isCapabilityResultEnvelope,
  projectCapabilityResultEnvelope,
} from "@/lib/capabilities/capability-result-envelope";
import { getAdminJournalPreviewPath } from "@/lib/journal/admin-journal-routes";
import { getJobCapability } from "@/lib/jobs/job-capability-registry";
import { normalizeJobProgressState } from "@/lib/jobs/job-progress-state";
import { normalizeMediaRuntimeState } from "@/lib/media/browser-runtime/media-runtime-normalization";

type JobStatusProjection = Pick<
  JobRequest,
  | "id"
  | "status"
  | "toolName"
  | "requestPayload"
  | "progressPercent"
  | "progressLabel"
  | "resultPayload"
  | "errorMessage"
  | "failureClass"
  | "recoveryMode"
  | "nextRetryAt"
  | "lastCheckpointId"
  | "replayedFromJobId"
  | "supersededByJobId"
>;

const CANONICAL_MEDIA_JOB_NAMES = new Set([
  "compose_media",
  "generate_audio",
  "generate_chart",
  "generate_graph",
]);

export function projectJobForEvent(
  job: Pick<
    JobRequest,
    | "id"
    | "status"
    | "toolName"
    | "requestPayload"
    | "failureClass"
    | "recoveryMode"
    | "nextRetryAt"
    | "lastCheckpointId"
    | "replayedFromJobId"
    | "supersededByJobId"
  >,
  event: JobEvent,
): JobStatusProjection {
  const payload = event.payload;

  return {
    id: job.id,
    status: job.status,
    toolName: job.toolName,
    requestPayload: job.requestPayload,
    progressPercent:
      typeof payload.progressPercent === "number" ? payload.progressPercent : null,
    progressLabel:
      typeof payload.progressLabel === "string" ? payload.progressLabel : null,
    resultPayload: payload.result ?? null,
    errorMessage:
      typeof payload.errorMessage === "string" ? payload.errorMessage : null,
    failureClass: job.failureClass,
    recoveryMode: job.recoveryMode,
    nextRetryAt: typeof payload.nextRetryAt === "string" || payload.nextRetryAt === null
      ? payload.nextRetryAt
      : job.nextRetryAt,
    lastCheckpointId:
      typeof payload.lastCheckpointId === "string" || payload.lastCheckpointId === null
        ? payload.lastCheckpointId
        : job.lastCheckpointId,
    replayedFromJobId: job.replayedFromJobId,
    supersededByJobId: job.supersededByJobId,
  };
}

function humanizeToolName(toolName: string): string {
  return toolName
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function inferSummary(result: unknown): string | undefined {
  if (typeof result === "string" && result.trim()) {
    return result;
  }

  if (typeof result === "object" && result !== null) {
    const candidate = result as Record<string, unknown>;
    if (typeof candidate.summary === "string" && candidate.summary.trim()) {
      return candidate.summary;
    }
    if (typeof candidate.message === "string" && candidate.message.trim()) {
      return candidate.message;
    }
    if (
      candidate.action === "prepare_journal_post_for_publish"
      && typeof candidate.summary === "string"
      && candidate.summary.trim()
    ) {
      return candidate.summary;
    }
    if (
      candidate.status === "draft"
      && typeof candidate.title === "string"
      && typeof candidate.slug === "string"
    ) {
      return `Draft journal article \"${candidate.title}\" ready at ${getAdminJournalPreviewPath(candidate.slug)}.`;
    }
    if (
      candidate.status === "published"
      && typeof candidate.title === "string"
      && typeof candidate.slug === "string"
    ) {
      return `Published journal article \"${candidate.title}\" at /journal/${candidate.slug}.`;
    }
  }

  return undefined;
}

function compactText(value: string, maxLength = 84): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readStringOrNull(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  return readString(value);
}

function readFailureStage(value: unknown): JobStatusMessagePart["failureStage"] | undefined {
  if (value === null) {
    return null;
  }

  switch (value) {
    case "asset_generation":
      return "asset_generation";
    case "composition_preflight":
      return "composition_preflight";
    case "local_execution":
      return "local_execution";
    case "playback_verification":
      return "playback_verification";
    case "deferred_enqueue":
      return "deferred_enqueue";
    case "deferred_execution":
      return "deferred_execution";
    case "recovery":
      return "recovery";
    case "unknown":
      return "unknown";
    default:
      return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCapabilityArtifactRef(value: unknown): value is CapabilityArtifactRef {
  return isRecord(value)
    && typeof value.kind === "string"
    && typeof value.label === "string"
    && typeof value.mimeType === "string";
}

function readArtifacts(value: unknown): CapabilityArtifactRef[] | undefined {
  return Array.isArray(value)
    ? value.filter(isCapabilityArtifactRef)
    : undefined;
}

function isCapabilityProgressPhase(value: unknown): value is CapabilityProgressPhase {
  return isRecord(value)
    && typeof value.key === "string"
    && typeof value.label === "string"
    && typeof value.status === "string";
}

function readPhases(value: unknown): CapabilityProgressPhase[] | undefined {
  return Array.isArray(value)
    ? value.filter(isCapabilityProgressPhase)
    : undefined;
}

function readReplaySnapshot(value: unknown): Record<string, unknown> | null | undefined {
  if (value === null) {
    return null;
  }

  return isRecord(value) ? value : undefined;
}

function buildEditorialContextSubtitle(payload: Record<string, unknown>): string | undefined {
  const audience = readString(payload.audience);
  const objective = readString(payload.objective);

  const parts = [
    audience ? `Audience: ${compactText(audience, 40)}` : undefined,
    objective ? `Objective: ${compactText(objective, 40)}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function buildIdentityTitle(
  toolName: string,
  payload: Record<string, unknown>,
): string | undefined {
  const title = readString(payload.title);
  const brief = readString(payload.brief);
  const altText = readString(payload.alt_text);
  const postId = readString(payload.post_id);

  switch (toolName) {
    case "draft_content":
    case "qa_blog_article":
    case "resolve_blog_article_qa":
    case "generate_blog_image_prompt":
      return title ? compactText(title) : undefined;
    case "compose_blog_article":
    case "produce_blog_article":
      return brief ? compactText(brief) : undefined;
    case "generate_blog_image":
      return altText ? compactText(altText) : undefined;
    case "publish_content":
      return postId ? `Publish journal draft ${postId}` : "Publish journal draft";
    case "prepare_journal_post_for_publish":
      return postId ? `Journal publish readiness for ${postId}` : "Journal publish readiness";
    default:
      return undefined;
  }
}

function buildHumanReadableIdentity(
  job: Pick<JobStatusProjection, "toolName" | "requestPayload">,
): Pick<JobStatusMessagePart, "title" | "subtitle"> {
  const capability = getJobCapability(job.toolName);
  const postId = readString(job.requestPayload.post_id);
  const contextualSubtitle =
    job.toolName === "compose_blog_article" || job.toolName === "produce_blog_article"
      ? buildEditorialContextSubtitle(job.requestPayload)
      : job.toolName === "generate_blog_image" && !postId
        ? "Generate and store an image asset for reuse in the conversation."
      : undefined;

  return {
    title: buildIdentityTitle(job.toolName, job.requestPayload),
    subtitle: contextualSubtitle ?? capability?.description,
  };
}

function resolveJobLabel(job: Pick<JobStatusProjection, "toolName" | "requestPayload">): string {
  if (job.toolName === "generate_blog_image" && !readString(job.requestPayload.post_id)) {
    return "Generate Image";
  }

  if (job.toolName === "generate_blog_image_prompt" && !readString(job.requestPayload.post_id)) {
    return "Design Image Prompt";
  }

  return humanizeToolName(job.toolName);
}

export function buildJobStatusPart(job: JobRequest, event: JobEvent): JobStatusMessagePart {
  return buildJobStatusPartFromProjection(job, event);
}

export function buildJobStatusPartFromProjection(
  job: JobStatusProjection,
  event: JobEvent,
): JobStatusMessagePart {
  const status =
    event.eventType === "queued"
      ? "queued"
      : event.eventType === "started" || event.eventType === "progress"
        ? "running"
        : event.eventType === "requeued" || event.eventType === "retry_scheduled" || event.eventType === "lease_recovered"
          ? "queued"
        : event.eventType === "result"
          ? "succeeded"
          : event.eventType === "failed" || event.eventType === "retry_exhausted"
            ? "failed"
            : event.eventType === "canceled"
              ? "canceled"
              : job.status;

  const payload = event.payload;
  const shouldSuppressProgress = status === "failed" || status === "canceled";
  const identity = buildHumanReadableIdentity(job);
  const eventEnvelope = isCapabilityResultEnvelope(payload.resultEnvelope)
    ? payload.resultEnvelope
    : null;
  const progressPercent =
    shouldSuppressProgress
      ? null
      : typeof payload.progressPercent === "number"
        ? payload.progressPercent
        : job.progressPercent;
  const progressLabel =
    shouldSuppressProgress
      ? null
      : typeof payload.progressLabel === "string"
        ? payload.progressLabel
        : job.progressLabel;
  const summary =
    typeof payload.summary === "string"
      ? payload.summary
      : inferSummary(eventEnvelope?.payload ?? payload.result) ?? inferSummary(job.resultPayload);
  const error =
    typeof payload.errorMessage === "string"
      ? payload.errorMessage
      : job.errorMessage ?? undefined;
  const resultPayload = payload.result ?? job.resultPayload ?? undefined;
  const nativeEnvelope = eventEnvelope
    ?? (isCapabilityResultEnvelope(resultPayload) ? resultPayload : null);
  const normalizedProgress = normalizeJobProgressState({
    toolName: job.toolName,
    phases: shouldSuppressProgress ? undefined : readPhases(payload.phases) ?? nativeEnvelope?.progress?.phases,
    activePhaseKey:
      shouldSuppressProgress
        ? null
        : (typeof payload.activePhaseKey === "string" || payload.activePhaseKey === null
            ? payload.activePhaseKey
            : undefined)
          ?? nativeEnvelope?.progress?.activePhaseKey,
    progressPercent,
    progressLabel,
  });
  const rawResultPayload = eventEnvelope?.payload ?? nativeEnvelope?.payload ?? resultPayload;
  const resultEnvelope = projectCapabilityResultEnvelope({
    toolName: job.toolName,
    payload: eventEnvelope ?? resultPayload,
    inputSnapshot: job.requestPayload,
    executionMode: "deferred",
    summary: {
      title: nativeEnvelope?.summary.title === undefined ? identity.title : undefined,
      subtitle:
        nativeEnvelope?.summary.subtitle === undefined ? identity.subtitle : undefined,
      statusLine:
        nativeEnvelope?.summary.statusLine === undefined ? error : undefined,
      message: summary,
    },
    progress:
      (!shouldSuppressProgress && (
        normalizedProgress.phases
        || normalizedProgress.progressPercent != null
        || normalizedProgress.progressLabel
        || normalizedProgress.activePhaseKey !== undefined
      ))
        ? {
          percent: normalizedProgress.progressPercent,
          label: normalizedProgress.progressLabel,
          phases: normalizedProgress.phases,
          activePhaseKey: normalizedProgress.activePhaseKey,
        }
        : undefined,
    replaySnapshot:
      readReplaySnapshot(payload.replaySnapshot)
      ?? eventEnvelope?.replaySnapshot
      ?? nativeEnvelope?.replaySnapshot,
    artifacts:
      readArtifacts(payload.artifacts)
      ?? eventEnvelope?.artifacts
      ?? nativeEnvelope?.artifacts,
  });
  const envelopeSummary = resultEnvelope?.summary;
  const envelopeProgress = resultEnvelope?.progress;
  const canonicalFailureCode = readStringOrNull(payload.failureCode)
    ?? (job.toolName === "compose_media" && status === "failed" ? "deferred_execution_failed" : undefined);
  const canonicalFailureStage = readFailureStage(payload.failureStage)
    ?? (job.toolName === "compose_media" && status === "failed" ? "deferred_execution" : undefined);
  const mediaRuntimeState = CANONICAL_MEDIA_JOB_NAMES.has(job.toolName)
    ? normalizeMediaRuntimeState({
        toolName: job.toolName,
        jobStatus: status,
        executionMode: "deferred",
        payload: rawResultPayload,
        failureCode: canonicalFailureCode,
        failureStage: canonicalFailureStage,
        failureClass: job.failureClass,
        recoveryMode: job.recoveryMode,
      })
    : null;

  return {
    type: "job_status",
    jobId: job.id,
    ...(typeof payload.toolInvocationId === "string" ? { toolInvocationId: payload.toolInvocationId } : {}),
    toolName: job.toolName,
    label: resolveJobLabel(job),
    title: envelopeSummary?.title ?? identity.title,
    subtitle: envelopeSummary?.subtitle ?? identity.subtitle,
    status,
    sequence: event.sequence,
    progressPercent: envelopeProgress?.percent ?? normalizedProgress.progressPercent ?? progressPercent,
    progressLabel: envelopeProgress?.label ?? normalizedProgress.progressLabel ?? progressLabel,
    summary: summary ?? envelopeSummary?.message,
    error,
    updatedAt: event.createdAt,
    ...(mediaRuntimeState ? { lifecyclePhase: mediaRuntimeState.lifecyclePhase } : {}),
    ...(mediaRuntimeState ? { failureCode: mediaRuntimeState.failureCode } : {}),
    ...(mediaRuntimeState ? { failureStage: mediaRuntimeState.failureStage } : {}),
    resultPayload: rawResultPayload,
    resultEnvelope,
    failureClass: mediaRuntimeState?.failureClass ?? job.failureClass,
    recoveryMode: mediaRuntimeState?.recoveryMode ?? job.recoveryMode,
    nextRetryAt: job.nextRetryAt,
    lastCheckpointId: job.lastCheckpointId,
    replayedFromJobId: job.replayedFromJobId,
    supersededByJobId: job.supersededByJobId,
  };
}

export function describeJobStatus(part: JobStatusMessagePart): string {
  const subject = part.title ? `${part.label} job for ${part.title}` : `${part.label} job`;
  const activePhaseLabel = part.progressLabel ?? part.resultEnvelope?.progress?.label;
  const activePercent = part.progressPercent ?? part.resultEnvelope?.progress?.percent;

  switch (part.status) {
    case "queued":
      return `${subject} queued.`;
    case "running":
      if (activePhaseLabel && activePercent != null) {
        return `${subject} running: ${activePhaseLabel} (${Math.round(activePercent)}%).`;
      }
      if (activePhaseLabel) {
        return `${subject} running: ${activePhaseLabel}.`;
      }
      if (activePercent != null) {
        return `${subject} running (${Math.round(activePercent)}%).`;
      }
      return `${subject} running.`;
    case "succeeded":
      return part.summary ? `${subject} completed: ${part.summary}` : `${subject} completed.`;
    case "failed":
    case "dead_letter":
      return part.error ? `${subject} failed: ${part.error}` : `${subject} failed.`;
    case "canceled":
      return `${subject} canceled.`;
  }
}

export function getJobMessageId(jobId: string): string {
  return `jobmsg_${jobId}`;
}