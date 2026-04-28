import type { StreamEvent } from "@/core/entities/chat-stream";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import type { JobStatusSnapshot } from "@/lib/jobs/job-read-model";

function isJobStatusMessagePart(value: unknown): value is JobStatusMessagePart {
  return typeof value === "object"
    && value !== null
    && (value as { type?: unknown }).type === "job_status"
    && typeof (value as { jobId?: unknown }).jobId === "string"
    && typeof (value as { toolName?: unknown }).toolName === "string"
    && typeof (value as { label?: unknown }).label === "string";
}

function isJobStatusSnapshot(value: unknown): value is JobStatusSnapshot {
  return typeof value === "object"
    && value !== null
    && typeof (value as { messageId?: unknown }).messageId === "string"
    && (
      (value as { conversationId?: unknown }).conversationId === undefined
      || typeof (value as { conversationId?: unknown }).conversationId === "string"
    )
    && isJobStatusMessagePart((value as { part?: unknown }).part);
}

export function extractJobStatusSnapshots(value: unknown): JobStatusSnapshot[] {
  if (isJobStatusSnapshot(value)) {
    return [value];
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  const record = value as { job?: unknown; jobs?: unknown };
  if (isJobStatusSnapshot(record.job)) {
    return [record.job];
  }

  if (Array.isArray(record.jobs)) {
    return record.jobs.filter(isJobStatusSnapshot);
  }

  return [];
}

export function jobStatusSnapshotToStreamEvent(
  snapshot: JobStatusSnapshot,
  conversationId = "",
): Extract<
  StreamEvent,
  { type: "job_queued" | "job_started" | "job_progress" | "job_completed" | "job_failed" | "job_canceled" }
> {
  return jobStatusPartToStreamEvent(snapshot.part, {
    messageId: snapshot.messageId,
    conversationId: snapshot.conversationId ?? conversationId,
  });
}

export function jobStatusPartToStreamEvent(
  part: JobStatusMessagePart,
  options: {
    conversationId: string;
    messageId?: string;
    sequence?: number;
  },
): Extract<
  StreamEvent,
  { type: "job_queued" | "job_started" | "job_progress" | "job_completed" | "job_failed" | "job_canceled" }
> {
  const sequencedPart = options.sequence === undefined || part.sequence === options.sequence
    ? part
    : {
      ...part,
      sequence: options.sequence,
    };
  const base = {
    messageId: options.messageId,
    jobId: sequencedPart.jobId,
    conversationId: options.conversationId,
    sequence: sequencedPart.sequence ?? 0,
    toolName: sequencedPart.toolName,
    label: sequencedPart.label,
    title: sequencedPart.title,
    subtitle: sequencedPart.subtitle,
    updatedAt: sequencedPart.updatedAt,
    part: sequencedPart,
  };

  switch (sequencedPart.status) {
    case "queued":
      return {
        type: "job_queued",
        ...base,
      };
    case "running":
      if (sequencedPart.progressPercent != null || sequencedPart.progressLabel) {
        return {
          type: "job_progress",
          ...base,
          progressPercent: sequencedPart.progressPercent,
          progressLabel: sequencedPart.progressLabel,
        };
      }
      return {
        type: "job_started",
        ...base,
      };
    case "succeeded":
      return {
        type: "job_completed",
        ...base,
        summary: sequencedPart.summary,
        resultPayload: sequencedPart.resultPayload,
      };
    case "failed":
    case "dead_letter":
      return {
        type: "job_failed",
        ...base,
        error: sequencedPart.error ?? "Deferred job failed.",
      };
    case "canceled":
      return {
        type: "job_canceled",
        ...base,
      };
  }
}