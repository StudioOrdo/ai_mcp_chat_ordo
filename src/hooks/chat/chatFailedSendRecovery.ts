import type { ChatMessage, FailedSendMetadata } from "@/core/entities/chat-message";
import type { GenerationStatusMessagePart } from "@/core/entities/message-parts";
import type { MediaContinuityHandoff } from "@/lib/chat/media-continuity-handoff";
import { getAttachmentParts, type AttachmentPart } from "@/lib/chat/message-attachments";
import type { TaskOriginHandoff } from "@/lib/chat/task-origin-handoff";

export interface FailedSendPayload {
  retryKey: string;
  failedUserMessageId: string;
  messageText: string;
  attachments: AttachmentPart[];
  taskOriginHandoff?: TaskOriginHandoff;
  mediaContinuityHandoff?: MediaContinuityHandoff;
}

function getGenerationStatusPart(parts?: ChatMessage["parts"]): GenerationStatusMessagePart | null {
  if (!parts || parts.length === 0) {
    return null;
  }

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (part?.type === "generation_status") {
      return part;
    }
  }

  return null;
}

function resolveFailedUserMessage(
  messages: ChatMessage[],
  assistantIndex: number,
  failedUserMessageId?: string,
): ChatMessage | null {
  if (failedUserMessageId) {
    const userMessage = messages.find(
      (message) => message.id === failedUserMessageId && message.role === "user",
    );
    if (userMessage) {
      return userMessage;
    }
  }

  const previousMessage = assistantIndex > 0 ? messages[assistantIndex - 1] : null;
  if (previousMessage?.role === "user") {
    return previousMessage;
  }

  return null;
}

function resolveFailedSendMetadata(
  messages: ChatMessage[],
  assistantIndex: number,
  message: ChatMessage,
): FailedSendMetadata | null {
  if (message.metadata?.failedSend) {
    return message.metadata.failedSend;
  }

  if (message.role !== "assistant") {
    return null;
  }

  const generationStatus = getGenerationStatusPart(message.parts);
  if (generationStatus?.status !== "interrupted") {
    return null;
  }

  const failedUserMessage = resolveFailedUserMessage(messages, assistantIndex);
  if (!failedUserMessage) {
    return null;
  }

  return {
    retryKey: failedUserMessage.id,
    failedUserMessageId: failedUserMessage.id,
  };
}

export function hydrateFailedSendRecovery(messages: ChatMessage[]): {
  messages: ChatMessage[];
  failedSends: FailedSendPayload[];
} {
  const failedSends: FailedSendPayload[] = [];
  let didMutate = false;

  const hydratedMessages = messages.map((message, index) => {
    const failedSend = resolveFailedSendMetadata(messages, index, message);
    if (!failedSend) {
      return message;
    }

    const failedUserMessage = resolveFailedUserMessage(messages, index, failedSend.failedUserMessageId);
    if (!failedUserMessage) {
      return message;
    }

    failedSends.push({
      retryKey: failedSend.retryKey,
      failedUserMessageId: failedSend.failedUserMessageId,
      messageText: failedUserMessage.content,
      attachments: getAttachmentParts(failedUserMessage.parts),
    });

    if (message.metadata?.failedSend) {
      return message;
    }

    didMutate = true;
    return {
      ...message,
      metadata: {
        ...message.metadata,
        failedSend,
      },
    };
  });

  return {
    messages: didMutate ? hydratedMessages : messages,
    failedSends,
  };
}