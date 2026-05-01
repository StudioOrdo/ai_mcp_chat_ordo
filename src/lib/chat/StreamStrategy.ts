import type { StreamEvent } from "@/core/entities/chat-stream";
import type { GenerationStatusMessagePart } from "@/core/entities/message-parts";

function toGenerationStatusPart(event: Extract<
  StreamEvent,
  { type: "generation_stopped" | "generation_interrupted" }
>): GenerationStatusMessagePart {
  return {
    type: "generation_status",
    status: event.type === "generation_stopped" ? "stopped" : "interrupted",
    actor: event.actor,
    reason: event.reason,
    partialContentRetained: event.partialContentRetained,
    recordedAt: event.recordedAt,
  };
}

export interface StreamProcessingContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispatch: (action: any) => void;
  assistantIndex: number;
}

export interface StreamEventStrategy {
  canHandle(event: StreamEvent): boolean;
  handle(event: StreamEvent, context: StreamProcessingContext): void;
}

export class TextDeltaStrategy implements StreamEventStrategy {
  canHandle(event: StreamEvent) {
    return event.type === "text";
  }
  handle(event: StreamEvent, { dispatch, assistantIndex }: StreamProcessingContext) {
    if (event.type === "text") {
      dispatch({ type: "APPEND_TEXT", index: assistantIndex, delta: event.delta });
    }
  }
}

export class ToolCallStrategy implements StreamEventStrategy {
  canHandle(event: StreamEvent) {
    return event.type === "tool_call";
  }
  handle(event: StreamEvent, { dispatch, assistantIndex }: StreamProcessingContext) {
    if (event.type === "tool_call") {
      dispatch({
        type: "APPEND_TOOL_CALL",
        index: assistantIndex,
        name: event.name,
        args: event.args,
        toolInvocationId: event.toolInvocationId,
      });
    }
  }
}

export class ToolResultStrategy implements StreamEventStrategy {
  canHandle(event: StreamEvent) {
    return event.type === "tool_result";
  }
  handle(event: StreamEvent, { dispatch, assistantIndex }: StreamProcessingContext) {
    if (event.type === "tool_result") {
      dispatch({
        type: "APPEND_TOOL_RESULT",
        index: assistantIndex,
        name: event.name,
        result: event.result,
        toolInvocationId: event.toolInvocationId,
        sourceMessageId: event.sourceMessageId,
        contentHash: event.contentHash,
      });
    }
  }
}

export class ErrorStrategy implements StreamEventStrategy {
  canHandle(event: StreamEvent) {
    return event.type === "error";
  }
  handle(event: StreamEvent, { dispatch, assistantIndex }: StreamProcessingContext) {
    if (event.type === "error") {
      dispatch({
        type: "SET_STREAM_TERMINAL_STATE",
        index: assistantIndex,
        generation: {
          status: "interrupted",
          actor: "system",
          reason: event.message,
        },
      });
    }
  }
}

export class GenerationStoppedStrategy implements StreamEventStrategy {
  canHandle(event: StreamEvent) {
    return event.type === "generation_stopped";
  }
  handle(event: StreamEvent, { dispatch, assistantIndex }: StreamProcessingContext) {
    if (event.type === "generation_stopped") {
      dispatch({
        type: "SET_STREAM_TERMINAL_STATE",
        index: assistantIndex,
        generation: toGenerationStatusPart(event),
      });
    }
  }
}

export class GenerationInterruptedStrategy implements StreamEventStrategy {
  canHandle(event: StreamEvent) {
    return event.type === "generation_interrupted";
  }
  handle(event: StreamEvent, { dispatch, assistantIndex }: StreamProcessingContext) {
    if (event.type === "generation_interrupted") {
      dispatch({
        type: "SET_STREAM_TERMINAL_STATE",
        index: assistantIndex,
        generation: toGenerationStatusPart(event),
      });
    }
  }
}

export class ConversationIdStrategy implements StreamEventStrategy {
  canHandle(event: StreamEvent) {
    return event.type === "conversation_id";
  }
  handle(event: StreamEvent, { dispatch }: StreamProcessingContext) {
    if (event.type === "conversation_id") {
      dispatch({ type: "SET_CONVERSATION_ID", conversationId: event.id });
    }
  }
}

export class StreamIdStrategy implements StreamEventStrategy {
  canHandle(event: StreamEvent) {
    return event.type === "stream_id";
  }
  handle(event: StreamEvent, { dispatch }: StreamProcessingContext) {
    if (event.type === "stream_id") {
      dispatch({ type: "SET_STREAM_ID", streamId: event.id });
    }
  }
}

export class JobQueuedStrategy implements StreamEventStrategy {
  canHandle(event: StreamEvent) {
    return event.type === "job_queued";
  }
  handle() {
    return undefined;
  }
}

export class JobStartedStrategy implements StreamEventStrategy {
  canHandle(event: StreamEvent) {
    return event.type === "job_started";
  }
  handle() {
    return undefined;
  }
}

export class JobProgressStrategy implements StreamEventStrategy {
  canHandle(event: StreamEvent) {
    return event.type === "job_progress";
  }
  handle() {
    return undefined;
  }
}

export class JobCompletedStrategy implements StreamEventStrategy {
  canHandle(event: StreamEvent) {
    return event.type === "job_completed";
  }
  handle() {
    return undefined;
  }
}

export class JobFailedStrategy implements StreamEventStrategy {
  canHandle(event: StreamEvent) {
    return event.type === "job_failed";
  }
  handle() {
    return undefined;
  }
}

export class JobCanceledStrategy implements StreamEventStrategy {
  canHandle(event: StreamEvent) {
    return event.type === "job_canceled";
  }
  handle() {
    return undefined;
  }
}

export class StreamProcessor {
  private strategies: StreamEventStrategy[];

  constructor(strategies: StreamEventStrategy[]) {
    this.strategies = strategies;
  }

  process(event: StreamEvent, context: StreamProcessingContext) {
    const strategy = this.strategies.find((s) => s.canHandle(event));
    if (strategy) {
      strategy.handle(event, context);
    }
  }
}
