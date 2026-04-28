import type { JobEvent, JobRequest, JobStatus } from "@/core/entities/job";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import { getJobMessageId } from "@/lib/jobs/job-status";
import { buildJobPublication } from "@/lib/jobs/job-publication";

const ACTIVE_JOB_STATUSES: JobStatus[] = ["queued", "running"];

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

export interface JobStatusSnapshot {
  messageId: string;
  conversationId?: string;
  part: JobStatusMessagePart;
}

export function getActiveJobStatuses(): JobStatus[] {
  return [...ACTIVE_JOB_STATUSES];
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

/**
 * Build a snapshot for a job, delegating to the unified publication contract.
 * This is the canonical way to produce a JobStatusSnapshot for snapshot channels.
 */
export function buildJobStatusSnapshot(job: JobRequest, event?: JobEvent | null): JobStatusSnapshot {
  const publication = buildJobPublication(job, event);

  return {
    messageId: getJobMessageId(job.id),
    conversationId: job.conversationId,
    part: publication.part,
  };
}