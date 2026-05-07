/**
 * Unified Job Publication Contract
 *
 * Sprint 6: Single entry-point for building job status representations.
 * All 5 publication channels (main-stream, chat-events, job-events,
 * per-job-events, conversation-projector) converge through this module
 * to eliminate duplicated orchestration logic.
 *
 * The shared function chain is:
 *   buildJobPublication() → projectJobForEvent() → buildJobStatusPartFromProjection()
 *
 * Edge cases handled here (not by each channel individually):
 *   - Synthetic event fallback when no event is available
 *   - Audit-only event filtering (notification_sent, etc.)
 *   - Latest renderable event resolution
 */

import type { JobEvent, JobRequest } from "@/core/entities/job";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import type { StreamEvent } from "@/core/entities/chat-stream";
import {
  buildJobStatusPartFromProjection,
  getJobMessageId,
  projectJobForEvent,
} from "@/lib/jobs/job-status";
import { buildSyntheticJobEvent } from "@/lib/jobs/job-read-model";
import { isRenderableJobEventType } from "@/lib/jobs/job-renderable-event";
import { jobStatusPartToStreamEvent } from "@/lib/jobs/job-status-snapshots";

// ---------------------------------------------------------------------------
// Publication result
// ---------------------------------------------------------------------------

export interface JobPublication {
  /** The canonical job status message part — all channels derive from this. */
  part: JobStatusMessagePart;
  /** The event that was used to build the part (may be synthetic). */
  resolvedEvent: JobEvent;
}

// ---------------------------------------------------------------------------
// Unified entry-point
// ---------------------------------------------------------------------------

/**
 * Build a unified job publication from a job request and an optional event.
 *
 * This is the single orchestration function that all publication channels
 * should call. It handles:
 * - Missing event → synthetic event fallback
 * - Audit-only event → falls back to renderableEvent or synthetic
 * - Normal event → direct projection
 *
 * @param job           The job request (from the queue repository)
 * @param event         The trigger event (may be absent or audit-only)
 * @param renderableEvent Optional pre-fetched latest renderable event for
 *                        the job (used when the trigger event is audit-only)
 */
export function buildJobPublication(
  job: JobRequest,
  event?: JobEvent | null,
  renderableEvent?: JobEvent | null,
): JobPublication {
  const resolvedEvent = resolvePublicationEvent(job, event, renderableEvent);
  const projection = projectJobForEvent(job, resolvedEvent);
  const part = buildJobStatusPartFromProjection(projection, resolvedEvent);

  return { part, resolvedEvent };
}

/**
 * Resolve which event to use for building the publication.
 *
 * Priority:
 * 1. The provided event, if it's renderable
 * 2. The pre-fetched renderableEvent (for audit-only trigger events)
 * 3. A synthetic event derived from the job's current state
 */
function resolvePublicationEvent(
  job: JobRequest,
  event?: JobEvent | null,
  renderableEvent?: JobEvent | null,
): JobEvent {
  // If we have a renderable trigger event, use it directly
  if (event && isRenderableJobEventType(event.eventType) && !isStaleComparedToJobState(job, event)) {
    return event;
  }

  // If the trigger event is audit-only, prefer the latest renderable event
  if (
    renderableEvent
    && isRenderableJobEventType(renderableEvent.eventType)
    && !isStaleComparedToJobState(job, renderableEvent)
  ) {
    return renderableEvent;
  }

  // Fall back to a synthetic event from the job's persisted state
  return buildSyntheticJobEvent(job);
}

function eventTypeToStatus(eventType: JobEvent["eventType"]): JobRequest["status"] | null {
  switch (eventType) {
    case "queued":
    case "requeued":
    case "retry_scheduled":
    case "lease_recovered":
      return "queued";
    case "started":
    case "progress":
      return "running";
    case "result":
      return "succeeded";
    case "failed":
    case "retry_exhausted":
      return "failed";
    case "canceled":
      return "canceled";
    default:
      return null;
  }
}

function isStaleComparedToJobState(job: JobRequest, event: JobEvent): boolean {
  const eventStatus = eventTypeToStatus(event.eventType);

  if (!eventStatus || eventStatus === job.status) {
    return false;
  }

  const jobUpdatedAt = Date.parse(job.updatedAt);
  const eventCreatedAt = Date.parse(event.createdAt);

  return Number.isFinite(jobUpdatedAt)
    && Number.isFinite(eventCreatedAt)
    && jobUpdatedAt >= eventCreatedAt;
}

// ---------------------------------------------------------------------------
// Channel-specific projection helpers
// ---------------------------------------------------------------------------

/**
 * Build a stream event payload from a job publication.
 * Used by SSE channels (main-stream, chat-events, job-events).
 */
export function publicationToStreamEvent(
  publication: JobPublication,
  job: JobRequest,
  options?: { sequence?: number },
): Record<string, unknown> {
  return jobStatusPartToStreamEvent(publication.part, {
    messageId: getJobMessageId(job.id),
    conversationId: job.conversationId,
    sequence: options?.sequence,
  });
}

/**
 * Build a typed stream event from a job publication.
 * Used by the main-stream promotion channel.
 */
export function publicationToTypedStreamEvent(
  publication: JobPublication,
  conversationId: string,
): Extract<
  StreamEvent,
  { type: "job_queued" | "job_started" | "job_progress" | "job_completed" | "job_failed" | "job_canceled" }
> {
  return jobStatusPartToStreamEvent(publication.part, {
    messageId: getJobMessageId(publication.part.jobId),
    conversationId,
  });
}
