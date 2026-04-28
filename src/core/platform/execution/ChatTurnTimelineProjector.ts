import type { Message } from "@/core/entities/conversation";
import type { ExecutionTimeline, ExecutionTimelineEvent } from "@/core/platform/execution/ExecutionTimeline";
import type { PromptTurnProvenanceRecord } from "@/lib/prompts/prompt-provenance-store";

export interface ChatTurnTimelineProjectionInput {
  executionId: string;
  record: PromptTurnProvenanceRecord;
  userMessage: Message | null;
  assistantMessage: Message | null;
}

function truncateText(value: string | null | undefined, maxLength = 140): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function createMessageEvent(input: {
  id: string;
  timestamp: string;
  eventType: string;
  title: string;
  summary?: string;
  state?: ExecutionTimelineEvent["state"];
  details?: Record<string, unknown>;
}): ExecutionTimelineEvent {
  return {
    id: input.id,
    timestamp: input.timestamp,
    eventType: input.eventType,
    title: input.title,
    summary: input.summary,
    state: input.state,
    source: "durable",
    details: input.details,
  };
}

export function projectChatTurnExecutionTimeline(input: ChatTurnTimelineProjectionInput): ExecutionTimeline {
  const events: ExecutionTimelineEvent[] = [];

  if (input.userMessage) {
    events.push(createMessageEvent({
      id: input.userMessage.id,
      timestamp: input.userMessage.createdAt,
      eventType: "user_message",
      title: "User message received",
      summary: truncateText(input.userMessage.content),
      state: "queued",
      details: {
        role: input.userMessage.role,
        partCount: input.userMessage.parts.length,
        tokenEstimate: input.userMessage.tokenEstimate,
      },
    }));
  }

  events.push(createMessageEvent({
    id: input.record.id,
    timestamp: input.record.recordedAt,
    eventType: "prompt_provenance_recorded",
    title: "Prompt recorded",
    summary: `Surface ${input.record.surface} with ${input.record.slotRefs.length} slot refs and ${input.record.warnings.length} warnings.`,
    state: input.assistantMessage ? "running" : "queued",
    details: {
      surface: input.record.surface,
      effectiveHash: input.record.effectiveHash,
      slotRefs: input.record.slotRefs,
      sections: input.record.sections,
      warnings: input.record.warnings,
      replayContext: input.record.replayContext,
    },
  }));

  if (input.assistantMessage) {
    events.push(createMessageEvent({
      id: input.assistantMessage.id,
      timestamp: input.assistantMessage.createdAt,
      eventType: "assistant_message",
      title: "Assistant response persisted",
      summary: truncateText(input.assistantMessage.content),
      state: "succeeded",
      details: {
        role: input.assistantMessage.role,
        partCount: input.assistantMessage.parts.length,
        tokenEstimate: input.assistantMessage.tokenEstimate,
      },
    }));
  }

  return {
    executionId: input.executionId,
    executionKind: "chat_turn",
    supportLevel: "limited",
    state: input.assistantMessage ? "succeeded" : "running",
    title: "Chat turn",
    summary: input.assistantMessage
      ? "Prompt provenance and the persisted assistant response are available for this turn."
      : "Prompt provenance is recorded, but the assistant response has not been attached yet.",
    conversationId: input.record.conversationId,
    startedAt: input.userMessage?.createdAt ?? input.record.recordedAt,
    completedAt: input.assistantMessage?.createdAt ?? null,
    updatedAt: input.assistantMessage?.createdAt ?? input.record.recordedAt,
    events,
    artifacts: [],
    checkpoints: [],
    nextActions: [],
    metadata: {
      surface: input.record.surface,
      effectiveHash: input.record.effectiveHash,
      userMessageId: input.record.userMessageId,
      assistantMessageId: input.record.assistantMessageId,
      warningCodes: input.record.warnings.map((warning) => warning.code),
      slotRefCount: input.record.slotRefs.length,
      sectionCount: input.record.sections.length,
    },
  };
}