"use client";
import { createContext, useContext, useReducer, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Conversation } from "@/core/entities/conversation";
import type { ConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
export type { MessagePart } from "@/core/entities/message-parts";
export type { ChatMessage } from "@/core/entities/chat-message";
import type { ChatMessage } from "@/core/entities/chat-message";
import { chatReducer, createInitialChatMessages } from "@/hooks/chat/chatState";
import { useChatPushNotifications } from "@/hooks/useChatPushNotifications";
import { useChatConversationSession } from "@/hooks/chat/useChatConversationSession";
import { useCurrentPageMemento } from "@/hooks/chat/useCurrentPageMemento";
import { useChatJobEvents } from "@/hooks/chat/useChatJobEvents";
import { usePlatformChatInteraction } from "@/hooks/chat/usePlatformChatInteraction";
import { useBrowserCapabilityRuntime } from "@/hooks/chat/useBrowserCapabilityRuntime";
import type { RoleName } from "@/core/entities/user";
import type { TaskOriginHandoff } from "@/lib/chat/task-origin-handoff";
import { useInstancePrompts } from "@/lib/config/InstanceConfigContext";
import type { RestoredConversationPayload } from "@/hooks/chat/chatConversationApi";
import { useReferralContext } from "@/hooks/chat/useReferralContext";
import { useFailedSendRecovery } from "@/hooks/chat/useFailedSendRecovery";
import { useBootstrapMessages } from "@/hooks/chat/useBootstrapMessages";
import { useChatJobState } from "@/hooks/chat/useChatJobState";
import { useChatRestoreCompatibility } from "@/hooks/chat/useChatRestoreCompatibility";
import { useWorkflowStateStore, type JobStateEntry, type WorkflowStateEntry } from "@/hooks/chat/useJobStateStore";
import type { WorkspaceRestorePayload } from "@/core/platform/conversation-restore/WorkspaceRestore";
interface ChatContextType {
  viewerRole: RoleName;
  messages: ChatMessage[];
  jobStateEntries: JobStateEntry[];
  workflowStateEntries: WorkflowStateEntry[];
  isSending: boolean;
  activeStreamId: string | null;
  conversationId: string | null;
  currentConversation: Conversation | null; workspaceRestore: WorkspaceRestorePayload | null;
  isLoadingMessages: boolean;
  routingSnapshot: ConversationRoutingSnapshot | null;
  sendMessage: (messageText: string, files?: File[], taskOriginHandoff?: TaskOriginHandoff) => Promise<{ ok: boolean; error?: string }>;
  retryFailedMessage: (retryKey: string) => Promise<{ ok: boolean; error?: string }>;
  stopStream: () => Promise<{ ok: boolean; error?: string }>;
  setConversationId: (id: string | null) => void;
  refreshConversation: (conversationIdOverride?: string | null) => Promise<void>;
  applyImportedConversationPayload: (payload: RestoredConversationPayload) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({
  children,
  initialRole = "ANONYMOUS",
  canResolveReferralVisit = true,
}: { children: ReactNode; initialRole?: RoleName; canResolveReferralVisit?: boolean }) {
  const currentPathname = usePathname();
  const prompts = useInstancePrompts();
  const [messages, dispatch] = useReducer(chatReducer, initialRole, (role) => createInitialChatMessages(role, prompts));
  const [isSending, setIsSending] = useState(false);
  const { getFailedSend, registerFailedSend, clearFailedSend } = useFailedSendRecovery(messages);

  const {
    conversationId,
    currentConversation,
    workspaceRestore,
    isLoadingMessages,
    refreshConversation,
    setCurrentConversation,
    setConversationId,
    setWorkspaceRestore,
  } = useChatConversationSession({ dispatch });
  const { jobStateEntries, upsertJobStateEntries } = useChatJobState(conversationId, messages, workspaceRestore);
  const { workflowStateEntries, upsertWorkflowStateEntries } = useWorkflowStateStore(conversationId);
  const {
    routingSnapshot,
    nonExecutableMessageIds,
    restoredMessageIds,
    applyImportedConversationPayload,
  } = useChatRestoreCompatibility({
    currentConversation,
    workspaceRestore,
    dispatch,
    setConversationId,
    setCurrentConversation,
    setWorkspaceRestore,
  });

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
  useChatJobEvents({ conversationId, dispatch, upsertJobStateEntries, upsertWorkflowStateEntries });
  useBrowserCapabilityRuntime({
    conversationId,
    messages,
    dispatch,
    nonExecutableMessageIds: workspaceRestore ? restoredMessageIds : nonExecutableMessageIds,
    reusableMediaAssets: workspaceRestore?.reusableMediaAssets ?? [],
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
      viewerRole: initialRole,
      messages, jobStateEntries, workflowStateEntries, isSending, activeStreamId, conversationId,
      currentConversation,
      workspaceRestore,
      isLoadingMessages,
      routingSnapshot,
      retryFailedMessage,
      sendMessage,
      stopStream,
      setConversationId,
      refreshConversation,
      applyImportedConversationPayload,
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
