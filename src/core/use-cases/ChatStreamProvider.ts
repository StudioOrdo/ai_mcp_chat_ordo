import type { StreamEvent } from "../entities/chat-stream";
import type { MediaContinuityHandoff } from "@/lib/chat/media-continuity-handoff";
import type { TaskOriginHandoff } from "@/lib/chat/task-origin-handoff";
import type { CurrentPageSnapshot } from "@/lib/chat/current-page-context";
import type { AttachmentMessagePart } from "@/core/entities/message-parts";

/**
 * Core Interface for AI Streaming
 * 
 * Defines the contract for external AI providers.
 * Adheres to the Adapter pattern (GoF).
 */
export interface ChatStream {
  events(): AsyncIterableIterator<StreamEvent>;
  cancel(): void;
}

export interface FetchChatStreamOptions {
  conversationId?: string;
  currentPathname?: string;
  currentPageSnapshot?: CurrentPageSnapshot;
  attachments?: Array<Omit<AttachmentMessagePart, "type">>;
  taskOriginHandoff?: TaskOriginHandoff;
  mediaContinuityHandoff?: MediaContinuityHandoff;
}

export interface ChatStreamProvider {
  fetchStream(
    messages: { role: string; content: string }[],
    options?: FetchChatStreamOptions,
  ): Promise<ChatStream>;
}
