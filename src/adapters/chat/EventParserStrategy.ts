import type { StreamEvent } from "../../core/entities/chat-stream";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import { isCapabilityResultEnvelope } from "@/lib/capabilities/capability-result-envelope";

type RawSSEData = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJobStatusPart(value: unknown): JobStatusMessagePart | undefined {
  if (!isRecord(value) || value.type !== "job_status") {
    return undefined;
  }

  const status = value.status === "running"
    || value.status === "succeeded"
    || value.status === "failed"
    || value.status === "canceled"
    ? value.status
    : "queued";

  return {
    type: "job_status",
    jobId: String(value.jobId ?? ""),
    toolName: String(value.toolName ?? ""),
    label: String(value.label ?? ""),
    status,
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    ...(typeof value.subtitle === "string" ? { subtitle: value.subtitle } : {}),
    ...(typeof value.sequence === "number" ? { sequence: value.sequence } : {}),
    ...(typeof value.progressPercent === "number" || value.progressPercent === null
      ? { progressPercent: value.progressPercent as number | null }
      : {}),
    ...(typeof value.progressLabel === "string" || value.progressLabel === null
      ? { progressLabel: value.progressLabel as string | null }
      : {}),
    ...(typeof value.summary === "string" ? { summary: value.summary } : {}),
    ...(typeof value.error === "string" ? { error: value.error } : {}),
    ...(typeof value.updatedAt === "string" ? { updatedAt: value.updatedAt } : {}),
    ...(typeof value.lifecyclePhase === "string"
      ? { lifecyclePhase: value.lifecyclePhase as JobStatusMessagePart["lifecyclePhase"] }
      : {}),
    ...(typeof value.failureCode === "string" || value.failureCode === null
      ? { failureCode: value.failureCode as string | null }
      : {}),
    ...(typeof value.failureStage === "string" || value.failureStage === null
      ? { failureStage: value.failureStage as JobStatusMessagePart["failureStage"] }
      : {}),
    ...(value.resultPayload !== undefined ? { resultPayload: value.resultPayload } : {}),
    ...(value.resultEnvelope === null
      ? { resultEnvelope: null }
      : isCapabilityResultEnvelope(value.resultEnvelope)
        ? { resultEnvelope: value.resultEnvelope }
        : {}),
    ...(typeof value.failureClass === "string" || value.failureClass === null
      ? { failureClass: value.failureClass as JobStatusMessagePart["failureClass"] }
      : {}),
    ...(typeof value.recoveryMode === "string" || value.recoveryMode === null
      ? { recoveryMode: value.recoveryMode as JobStatusMessagePart["recoveryMode"] }
      : {}),
    ...(typeof value.replayedFromJobId === "string" || value.replayedFromJobId === null
      ? { replayedFromJobId: value.replayedFromJobId as string | null }
      : {}),
    ...(typeof value.supersededByJobId === "string" || value.supersededByJobId === null
      ? { supersededByJobId: value.supersededByJobId as string | null }
      : {}),
    ...(typeof value.toolInvocationId === "string" ? { toolInvocationId: value.toolInvocationId } : {}),
  };
}

/**
 * Strategy Interface for Parsing Raw SSE JSON Data
 */
export interface EventParserStrategy {
  canParse(data: RawSSEData): boolean;
  parse(data: RawSSEData): StreamEvent;
}

export class TextDeltaParser implements EventParserStrategy {
  canParse(data: RawSSEData) { return !!data.delta; }
  parse(data: RawSSEData): StreamEvent {
    return { type: "text", delta: data.delta as string };
  }
}

export class ToolCallParser implements EventParserStrategy {
  canParse(data: RawSSEData) { return !!data.tool_call; }
  parse(data: RawSSEData): StreamEvent {
    const tc = data.tool_call as { name: string; args: Record<string, unknown>; toolInvocationId?: unknown };
    return { 
      type: "tool_call", 
      name: tc.name, 
      args: tc.args,
      ...(typeof tc.toolInvocationId === "string" ? { toolInvocationId: tc.toolInvocationId } : {}),
    };
  }
}

export class ToolResultParser implements EventParserStrategy {
  canParse(data: RawSSEData) { return !!data.tool_result; }
  parse(data: RawSSEData): StreamEvent {
    const tr = data.tool_result as {
      name: string;
      result: unknown;
      toolInvocationId?: unknown;
      sourceMessageId?: unknown;
      contentHash?: unknown;
    };

    return { 
      type: "tool_result", 
      name: tr.name, 
      result: tr.result,
      ...(typeof tr.toolInvocationId === "string" ? { toolInvocationId: tr.toolInvocationId } : {}),
      ...(typeof tr.sourceMessageId === "string" ? { sourceMessageId: tr.sourceMessageId } : {}),
      ...(typeof tr.contentHash === "string" ? { contentHash: tr.contentHash } : {}),
    };
  }
}

export class ConversationIdParser implements EventParserStrategy {
  canParse(data: RawSSEData) { return !!data.conversation_id; }
  parse(data: RawSSEData): StreamEvent {
    return { type: "conversation_id", id: data.conversation_id as string };
  }
}

export class StreamIdParser implements EventParserStrategy {
  canParse(data: RawSSEData) { return !!data.stream_id; }
  parse(data: RawSSEData): StreamEvent {
    return { type: "stream_id", id: data.stream_id as string };
  }
}

export class ErrorParser implements EventParserStrategy {
  canParse(data: RawSSEData) { return typeof data.error === "string"; }
  parse(data: RawSSEData): StreamEvent {
    return { type: "error", message: data.error as string };
  }
}

class TypedEventParser implements EventParserStrategy {
  constructor(private readonly eventType: StreamEvent["type"]) {}

  canParse(data: RawSSEData) {
    return data.type === this.eventType;
  }

  parse(data: RawSSEData): StreamEvent {
    switch (this.eventType) {
      case "generation_stopped":
      case "generation_interrupted":
        return {
          type: this.eventType,
          actor: data.actor === "user" ? "user" : "system",
          reason: typeof data.reason === "string" ? data.reason : "stream_interrupted",
          partialContentRetained: Boolean(data.partialContentRetained),
          recordedAt: typeof data.recordedAt === "string" ? data.recordedAt : undefined,
        };
      case "job_queued":
      case "job_started":
        return {
          type: this.eventType,
          jobId: data.jobId as string,
          conversationId: data.conversationId as string,
          sequence: data.sequence as number,
          toolName: data.toolName as string,
          label: data.label as string,
          title: typeof data.title === "string" ? data.title : undefined,
          subtitle: typeof data.subtitle === "string" ? data.subtitle : undefined,
          messageId: typeof data.messageId === "string" ? data.messageId : undefined,
          updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
          part: parseJobStatusPart(data.part),
        };
      case "job_progress":
        return {
          type: "job_progress",
          jobId: data.jobId as string,
          conversationId: data.conversationId as string,
          sequence: data.sequence as number,
          toolName: data.toolName as string,
          label: data.label as string,
          title: typeof data.title === "string" ? data.title : undefined,
          subtitle: typeof data.subtitle === "string" ? data.subtitle : undefined,
          messageId: typeof data.messageId === "string" ? data.messageId : undefined,
          progressPercent: typeof data.progressPercent === "number" ? data.progressPercent : undefined,
          progressLabel: typeof data.progressLabel === "string" ? data.progressLabel : undefined,
          updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
          part: parseJobStatusPart(data.part),
        };
      case "job_completed":
        return {
          type: "job_completed",
          jobId: data.jobId as string,
          conversationId: data.conversationId as string,
          sequence: data.sequence as number,
          toolName: data.toolName as string,
          label: data.label as string,
          title: typeof data.title === "string" ? data.title : undefined,
          subtitle: typeof data.subtitle === "string" ? data.subtitle : undefined,
          messageId: typeof data.messageId === "string" ? data.messageId : undefined,
          summary: typeof data.summary === "string" ? data.summary : undefined,
          resultPayload: data.resultPayload,
          updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
          part: parseJobStatusPart(data.part),
        };
      case "job_failed":
        return {
          type: "job_failed",
          jobId: data.jobId as string,
          conversationId: data.conversationId as string,
          sequence: data.sequence as number,
          toolName: data.toolName as string,
          label: data.label as string,
          title: typeof data.title === "string" ? data.title : undefined,
          subtitle: typeof data.subtitle === "string" ? data.subtitle : undefined,
          messageId: typeof data.messageId === "string" ? data.messageId : undefined,
          error: data.error as string,
          updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
          part: parseJobStatusPart(data.part),
        };
      case "job_canceled":
        return {
          type: "job_canceled",
          jobId: data.jobId as string,
          conversationId: data.conversationId as string,
          sequence: data.sequence as number,
          toolName: data.toolName as string,
          label: data.label as string,
          title: typeof data.title === "string" ? data.title : undefined,
          subtitle: typeof data.subtitle === "string" ? data.subtitle : undefined,
          messageId: typeof data.messageId === "string" ? data.messageId : undefined,
          updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
          part: parseJobStatusPart(data.part),
        };
      default:
        throw new Error(`Unsupported typed SSE event: ${String(this.eventType)}`);
    }
  }
}

export class JobQueuedParser extends TypedEventParser {
  constructor() {
    super("job_queued");
  }
}

export class GenerationStoppedParser extends TypedEventParser {
  constructor() {
    super("generation_stopped");
  }
}

export class GenerationInterruptedParser extends TypedEventParser {
  constructor() {
    super("generation_interrupted");
  }
}

export class JobStartedParser extends TypedEventParser {
  constructor() {
    super("job_started");
  }
}

export class JobProgressParser extends TypedEventParser {
  constructor() {
    super("job_progress");
  }
}

export class JobCompletedParser extends TypedEventParser {
  constructor() {
    super("job_completed");
  }
}

export class JobFailedParser extends TypedEventParser {
  constructor() {
    super("job_failed");
  }
}

export class JobCanceledParser extends TypedEventParser {
  constructor() {
    super("job_canceled");
  }
}

export class EventParser {
  constructor(private strategies: EventParserStrategy[]) {}

  parse(data: RawSSEData): StreamEvent | null {
    const strategy = this.strategies.find(s => s.canParse(data));
    return strategy ? strategy.parse(data) : null;
  }
}
