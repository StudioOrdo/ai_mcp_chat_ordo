import type { ChatMessage, FailedSendMetadata } from "@/core/entities/chat-message";
import type { GenerationStatusMessagePart, MessagePart } from "@/core/entities/message-parts";

export interface GenerationStatusUpdate {
  status: GenerationStatusMessagePart["status"];
  actor: GenerationStatusMessagePart["actor"];
  reason: string;
  partialContentRetained?: boolean;
  recordedAt?: string;
}

export function updateMessageAtIndex(
  state: ChatMessage[],
  index: number,
  updater: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  const message = state[index];
  if (!message) {
    return state;
  }

  const updated = [...state];
  updated[index] = updater(message);
  return updated;
}

export function updateMessageById(
  state: ChatMessage[],
  messageId: string,
  updater: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  const index = state.findIndex((message) => message.id === messageId);
  if (index < 0) {
    return state;
  }

  return updateMessageAtIndex(state, index, updater);
}

export function appendPart(
  message: ChatMessage,
  part: NonNullable<ChatMessage["parts"]>[number],
): ChatMessage {
  return {
    ...message,
    parts: [...(message.parts || []), part],
  };
}

export function appendTextDelta(message: ChatMessage, delta: string): ChatMessage {
  const parts = [...(message.parts || [])];
  const lastPart = parts[parts.length - 1];

  if (lastPart && lastPart.type === "text") {
    parts[parts.length - 1] = {
      ...lastPart,
      text: lastPart.text + delta,
    };
  } else {
    parts.push({ type: "text", text: delta });
  }

  return {
    ...message,
    content: (message.content || "") + delta,
    parts,
  };
}

export function isGenerationStatusMessagePart(
  part: NonNullable<ChatMessage["parts"]>[number],
): part is GenerationStatusMessagePart {
  return part.type === "generation_status";
}

export function hasRetainedAssistantOutput(message: ChatMessage): boolean {
  if ((message.content || "").trim().length > 0) {
    return true;
  }

  return (message.parts ?? []).some((part) => part.type !== "generation_status");
}

export function upsertGenerationStatusMessage(
  state: ChatMessage[],
  index: number,
  generation: GenerationStatusUpdate,
): ChatMessage[] {
  return updateMessageAtIndex(state, index, (message) => ({
    ...message,
    parts: [
      ...(message.parts ?? []).filter(
        (candidate) => !isGenerationStatusMessagePart(candidate),
      ),
      {
        type: "generation_status" as const,
        status: generation.status,
        actor: generation.actor,
        reason: generation.reason,
        partialContentRetained:
          generation.partialContentRetained ?? hasRetainedAssistantOutput(message),
        recordedAt: generation.recordedAt,
      },
    ],
  }));
}

export function setFailedSendMetadata(
  state: ChatMessage[],
  index: number,
  failedSend: FailedSendMetadata,
): ChatMessage[] {
  return updateMessageAtIndex(state, index, (message) => ({
    ...message,
    metadata: {
      ...message.metadata,
      failedSend,
    },
  }));
}

export function replaceMessageParts(
  state: ChatMessage[],
  messageId: string,
  parts: MessagePart[],
  content?: string,
): ChatMessage[] {
  return updateMessageById(state, messageId, (message) => ({
    ...message,
    ...(content === undefined ? {} : { content }),
    parts,
  }));
}
