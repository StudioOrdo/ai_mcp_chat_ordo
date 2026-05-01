import { useCallback, useState, type Dispatch } from "react";

import type { Conversation } from "@/core/entities/conversation";
import type { WorkspaceRestorePayload } from "@/core/platform/conversation-restore/WorkspaceRestore";

import type { ChatAction } from "./chatState";
import {
  restoreActiveWorkspace,
  restoreWorkspaceByConversationId,
} from "./workspaceRestoreApi";
import { useChatRestore } from "./useChatRestore";

interface UseChatConversationSessionOptions {
  dispatch: Dispatch<ChatAction>;
}

interface ChatConversationSession {
  conversationId: string | null;
  currentConversation: Conversation | null;
  workspaceRestore: WorkspaceRestorePayload | null;
  isLoadingMessages: boolean;
  refreshConversation: (conversationIdOverride?: string | null) => Promise<void>;
  setCurrentConversation: (conversation: Conversation | null) => void;
  setConversationId: (conversationId: string | null) => void;
  setWorkspaceRestore: (workspaceRestore: WorkspaceRestorePayload | null) => void;
}

export function useChatConversationSession({
  dispatch,
}: UseChatConversationSessionOptions): ChatConversationSession {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [workspaceRestore, setWorkspaceRestore] = useState<WorkspaceRestorePayload | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  const refreshConversation = useCallback(async (conversationIdOverride?: string | null) => {
    const restoreTargetId = conversationIdOverride ?? conversationId;
    let result = restoreTargetId
      ? await restoreWorkspaceByConversationId(restoreTargetId)
      : await restoreActiveWorkspace();

    // Newly created conversations can race between the streamed id arriving and
    // the canonical active-conversation endpoint reflecting the persisted thread.
    if (
      restoreTargetId &&
      restoreTargetId !== conversationId &&
      (result.status === "missing" || result.status === "error" || result.status === "network-error")
    ) {
      result = await restoreActiveWorkspace();
    }

    if (result.status !== "restored" || !result.payload) {
      return;
    }

    setConversationId(result.payload.conversationId);
    setCurrentConversation(result.payload.conversation);
    setWorkspaceRestore(result.payload.workspaceRestore);
    dispatch({ type: "REPLACE_ALL", messages: result.payload.messages });
  }, [conversationId, dispatch]);

  useChatRestore({
    dispatch,
    setCurrentConversation,
    setConversationId,
    setIsLoadingMessages,
    setWorkspaceRestore,
  });

  return {
    conversationId,
    currentConversation,
    workspaceRestore,
    isLoadingMessages,
    refreshConversation,
    setCurrentConversation,
    setConversationId,
    setWorkspaceRestore,
  };
}