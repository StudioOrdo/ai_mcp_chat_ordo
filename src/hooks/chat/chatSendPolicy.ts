import type { ChatMessage } from "@/core/entities/chat-message";
import type { MessagePart } from "@/core/entities/message-parts";
import { MessageFactory } from "@/core/entities/MessageFactory";
import {
  buildMediaContinuityHandoff,
  type MediaContinuityHandoff,
} from "@/lib/chat/media-continuity-handoff";
import type { AttachmentPart } from "@/lib/chat/message-attachments";

export interface SendValidationResult {
  trimmedMessage: string;
  error: string | null;
}

export interface PreparedChatSend {
  assistantIndex: number;
  optimisticMessages: ChatMessage[];
  historyForBackend: BackendHistoryMessage[];
  mediaContinuityHandoff: MediaContinuityHandoff | null;
}

export interface BackendHistoryMessage {
  role: Exclude<ChatMessage["role"], "system">;
  content: string;
}

function summarizeMessagePart(part: MessagePart): string | null {
  switch (part.type) {
    case "text":
    case "error":
    case "summary":
    case "meta_summary": {
      const text = part.text.trim();
      return text.length > 0 ? text : null;
    }
    case "job_status": {
      const headline = part.title?.trim() || part.label.trim() || part.toolName.trim();
      const details = [
        part.progressLabel?.trim(),
        part.summary?.trim(),
        part.error?.trim() ? `Error: ${part.error.trim()}` : null,
      ].filter((value): value is string => Boolean(value && value.length > 0));

      return [`Job ${part.status}: ${headline}`, details.length > 0 ? details.join(" ") : null]
        .filter((value): value is string => Boolean(value && value.length > 0))
        .join(" - ");
    }
    case "generation_status":
      return `Generation ${part.status} by ${part.actor}: ${part.reason}`;
    case "attachment":
      return `Attachment: ${part.fileName}`;
    case "imported_attachment":
      return `Imported attachment: ${part.fileName} (${part.availability})`;
    case "compaction_marker":
      return `Conversation compaction marker: ${part.kind} (${part.compactedCount} items)`;
    case "tool_call":
    case "tool_result":
      return null;
    default:
      return null;
  }
}

function getBackendMessageContent(message: ChatMessage): string | null {
  const directContent = message.content.trim();
  if (directContent.length > 0) {
    return directContent;
  }

  const derivedContent = (message.parts ?? [])
    .map((part) => summarizeMessagePart(part))
    .filter((value): value is string => Boolean(value && value.length > 0))
    .join("\n");

  return derivedContent.length > 0 ? derivedContent : null;
}

export function buildBackendHistory(messages: ChatMessage[]): BackendHistoryMessage[] {
  return messages.flatMap((message) => {
    if (message.role === "system") {
      return [];
    }

    const content = getBackendMessageContent(message);
    if (!content) {
      return [];
    }

    return [{
      role: message.role,
      content,
    }];
  });
}

export function validateChatSend(
  messageText: string,
  fileCount: number,
  isInFlight: boolean,
): SendValidationResult {
  const trimmedMessage = messageText.trim();

  if (!trimmedMessage && fileCount === 0) {
    return { trimmedMessage, error: "Cannot send an empty message." };
  }

  if (isInFlight) {
    return { trimmedMessage, error: "A message is already sending." };
  }

  return { trimmedMessage, error: null };
}

export function prepareChatSend(
  messages: ChatMessage[],
  trimmedMessage: string,
  attachmentParts: AttachmentPart[],
): PreparedChatSend {
  const userParts = [
    ...(trimmedMessage ? [{ type: "text" as const, text: trimmedMessage }] : []),
    ...attachmentParts,
  ];
  const userMessage = MessageFactory.createUserMessage(trimmedMessage, userParts);
  const nextMessages = [...messages, userMessage];

  return {
    assistantIndex: nextMessages.length,
    optimisticMessages: [...nextMessages, MessageFactory.createAssistantMessage()],
    historyForBackend: buildBackendHistory(nextMessages),
    mediaContinuityHandoff: buildMediaContinuityHandoff(nextMessages),
  };
}

export function shouldRefreshConversationAfterStream(
  activeConversationId: string | null,
  resolvedConversationId: string | null,
  didReceiveTextDelta: boolean = true,
): boolean {
  if (!activeConversationId) {
    return true;
  }

  if (!resolvedConversationId) {
    return false;
  }

  return resolvedConversationId !== activeConversationId || !didReceiveTextDelta;
}