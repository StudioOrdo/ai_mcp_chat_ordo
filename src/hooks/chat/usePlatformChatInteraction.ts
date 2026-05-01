import type { Dispatch } from "react";

import type { ChatMessage } from "@/core/entities/chat-message";
import type { CurrentPageMemento } from "@/lib/chat/CurrentPageMemento";

import type { ChatAction } from "./chatState";
import { useChatSend } from "./useChatSend";
import type { FailedSendPayload } from "./useChatSend";

interface UsePlatformChatInteractionOptions {
  conversationId: string | null;
  currentPathname: string;
  memento: CurrentPageMemento;
  refreshConversation: (conversationIdOverride?: string | null) => Promise<void>;
  dispatch: Dispatch<ChatAction>;
  getFailedSend: (retryKey: string) => FailedSendPayload | undefined;
  messages: ChatMessage[];
  registerFailedSend: (payload: FailedSendPayload) => void;
  setConversationId: (conversationId: string | null) => void;
  setIsSending: (isSending: boolean) => void;
  clearFailedSend: (retryKey: string) => void;
}

export function usePlatformChatInteraction(options: UsePlatformChatInteractionOptions) {
  return useChatSend(options);
}
