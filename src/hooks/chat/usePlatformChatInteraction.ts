import type { Dispatch } from "react";

import type { ChatMessage } from "@/core/entities/chat-message";
import type { CurrentPageMemento } from "@/lib/chat/CurrentPageMemento";

import type { ChatAction } from "./chatState";
import { useBrowserCapabilityRuntime } from "./useBrowserCapabilityRuntime";
import { useChatJobEvents } from "./useChatJobEvents";
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
  const interaction = useChatSend(options);

  useChatJobEvents({
    conversationId: options.conversationId,
    dispatch: options.dispatch,
  });
  useBrowserCapabilityRuntime({
    conversationId: options.conversationId,
    messages: options.messages,
    dispatch: options.dispatch,
  });

  return interaction;
}
