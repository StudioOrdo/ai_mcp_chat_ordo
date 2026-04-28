import type { JobStatusMessagePart } from "./message-parts";

export type StreamEvent =
  | { type: "text"; delta: string }
    | { type: "tool_call"; name: string; args: Record<string, unknown>; toolInvocationId?: string }
  | {
      type: "tool_result";
      name: string;
      result: unknown;
      toolInvocationId?: string;
      sourceMessageId?: string;
      contentHash?: string;
    }
  | { type: "stream_id"; id: string }
  | { type: "conversation_id"; id: string }
  | {
      type: "generation_stopped";
      actor: "user" | "system";
      reason: string;
      partialContentRetained: boolean;
      recordedAt?: string;
    }
  | {
      type: "generation_interrupted";
      actor: "user" | "system";
      reason: string;
      partialContentRetained: boolean;
      recordedAt?: string;
    }
  | {
      type: "job_queued";
      messageId?: string;
      jobId: string;
      conversationId: string;
      sequence: number;
      toolName: string;
      label: string;
      title?: string;
      subtitle?: string;
      updatedAt?: string;
      part?: JobStatusMessagePart;
    }
  | {
      type: "job_started";
      messageId?: string;
      jobId: string;
      conversationId: string;
      sequence: number;
      toolName: string;
      label: string;
      title?: string;
      subtitle?: string;
      updatedAt?: string;
      part?: JobStatusMessagePart;
    }
  | {
      type: "job_progress";
      messageId?: string;
      jobId: string;
      conversationId: string;
      sequence: number;
      toolName: string;
      label: string;
      title?: string;
      subtitle?: string;
      progressPercent?: number | null;
      progressLabel?: string | null;
      updatedAt?: string;
      part?: JobStatusMessagePart;
    }
  | {
      type: "job_completed";
      messageId?: string;
      jobId: string;
      conversationId: string;
      sequence: number;
      toolName: string;
      label: string;
      title?: string;
      subtitle?: string;
      summary?: string;
      resultPayload?: unknown;
      updatedAt?: string;
      part?: JobStatusMessagePart;
    }
  | {
      type: "job_failed";
      messageId?: string;
      jobId: string;
      conversationId: string;
      sequence: number;
      toolName: string;
      label: string;
      title?: string;
      subtitle?: string;
      error: string;
      updatedAt?: string;
      part?: JobStatusMessagePart;
    }
  | {
      type: "job_canceled";
      messageId?: string;
      jobId: string;
      conversationId: string;
      sequence: number;
      toolName: string;
      label: string;
      title?: string;
      subtitle?: string;
      updatedAt?: string;
      part?: JobStatusMessagePart;
    }
  | { type: "error"; message: string }
  | { type: "done" };
