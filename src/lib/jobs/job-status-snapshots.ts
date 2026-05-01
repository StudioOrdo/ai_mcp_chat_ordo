import type { StreamEvent } from "@/core/entities/chat-stream";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import {
  canonicalJobSnapshotToStatusPart,
  type CanonicalJobSnapshot,
} from "@/lib/jobs/job-read-model";
import { getJobMessageId } from "@/lib/jobs/job-status";

export function jobStatusSnapshotToStreamEvent(
  snapshot: CanonicalJobSnapshot,
  conversationId = "",
): Extract<
  StreamEvent,
  { type: "job_queued" | "job_started" | "job_progress" | "job_completed" | "job_failed" | "job_canceled" }
> {
  return jobStatusPartToStreamEvent(canonicalJobSnapshotToStatusPart(snapshot), {
    messageId: getJobMessageId(snapshot.jobId),
    conversationId: snapshot.conversationId || conversationId,
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
