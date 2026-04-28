"use client";
import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useState,
} from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Conversation } from "@/core/entities/conversation";
import type { ConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
export type { MessagePart } from "@/core/entities/message-parts";
export type { ChatMessage } from "@/core/entities/chat-message";
import type { ChatMessage } from "@/core/entities/chat-message";
import {
  chatReducer,
  createInitialChatMessages,
} from "@/hooks/chat/chatState";
import { useChatJobEvents } from "@/hooks/chat/useChatJobEvents";
import { useChatPushNotifications } from "@/hooks/useChatPushNotifications";
import { useChatConversationSession } from "@/hooks/chat/useChatConversationSession";
import { useCurrentPageMemento } from "@/hooks/chat/useCurrentPageMemento";
import { usePlatformChatInteraction } from "@/hooks/chat/usePlatformChatInteraction";
import type { RoleName } from "@/core/entities/user";
import type { TaskOriginHandoff } from "@/lib/chat/task-origin-handoff";
import { useInstancePrompts } from "@/lib/config/InstanceConfigContext";
import type { RestoredConversationPayload } from "@/hooks/chat/chatConversationApi";
import { useReferralContext } from "@/hooks/chat/useReferralContext";
import { useFailedSendRecovery } from "@/hooks/chat/useFailedSendRecovery";
import { useBootstrapMessages } from "@/hooks/chat/useBootstrapMessages";
import { useBrowserCapabilityRuntime } from "@/hooks/chat/useBrowserCapabilityRuntime";

interface ChatContextType {
  messages: ChatMessage[];
  isSending: boolean;
  activeStreamId: string | null;
  conversationId: string | null;
  currentConversation: Conversation | null;
  isLoadingMessages: boolean;
  routingSnapshot: ConversationRoutingSnapshot | null;
  sendMessage: (
    messageText: string,
    files?: File[],
    taskOriginHandoff?: TaskOriginHandoff,
  ) => Promise<{ ok: boolean; error?: string }>;
  retryFailedMessage: (retryKey: string) => Promise<{ ok: boolean; error?: string }>;
  stopStream: () => Promise<{ ok: boolean; error?: string }>;
  setConversationId: (id: string | null) => void;
  refreshConversation: (conversationIdOverride?: string | null) => Promise<void>;
  applyConversationPayload: (payload: RestoredConversationPayload) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({
  children,
  initialRole = "ANONYMOUS",
  canResolveReferralVisit = true,
}: {
  children: ReactNode;
  initialRole?: RoleName;
  canResolveReferralVisit?: boolean;
}) {
  const currentPathname = usePathname();
  const prompts = useInstancePrompts();
  const [messages, dispatch] = useReducer(
    chatReducer,
    initialRole,
    (role) => createInitialChatMessages(role, prompts),
  );
  const [isSending, setIsSending] = useState(false);

  const { getFailedSend, registerFailedSend, clearFailedSend } =
    useFailedSendRecovery(messages);

  const {
    conversationId,
    currentConversation,
    isLoadingMessages,
    refreshConversation,
    setCurrentConversation,
    setConversationId,
  } = useChatConversationSession({ dispatch });

  const applyConversationPayload = useCallback((payload: RestoredConversationPayload) => {
    setConversationId(payload.conversationId);
    setCurrentConversation(payload.conversation);
    dispatch({ type: "REPLACE_ALL", messages: payload.messages });
  }, [dispatch, setConversationId, setCurrentConversation]);

  const memento = useCurrentPageMemento(currentPathname);
  const referralCtx = useReferralContext(initialRole, prompts, dispatch, canResolveReferralVisit);

  const { activeStreamId, sendMessage, retryFailedMessage, stopStream } = usePlatformChatInteraction({
    conversationId,
    currentPathname,
    memento,
    refreshConversation,
    dispatch,
    getFailedSend,
    messages,
    registerFailedSend,
    setConversationId,
    setIsSending,
    clearFailedSend,
  });
  useChatPushNotifications(initialRole);

  useBootstrapMessages({
    messages,
    initialRole,
    conversationId,
    currentConversation,
    isLoadingMessages,
    isSending,
    prompts,
    referralCtx,
    dispatch,
  });

  return (
    <ChatContext.Provider value={{
      messages, isSending, activeStreamId, conversationId,
      currentConversation,
      isLoadingMessages,
      routingSnapshot: currentConversation?.routingSnapshot ?? null,
      retryFailedMessage,
      sendMessage,
      stopStream,
      setConversationId,
      refreshConversation,
      applyConversationPayload,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useGlobalChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useGlobalChat must be used within a ChatProvider");
  }
  return context;
}
