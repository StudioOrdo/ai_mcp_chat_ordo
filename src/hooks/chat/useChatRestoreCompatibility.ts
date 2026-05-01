import { useCallback, useMemo, useState, type Dispatch } from "react";

import type { Conversation } from "@/core/entities/conversation";
import {
  createConversationRoutingSnapshot,
  type ConversationRoutingSnapshot,
} from "@/core/entities/conversation-routing";
import type { WorkspaceRestorePayload } from "@/core/platform/conversation-restore/WorkspaceRestore";

import type { ChatAction } from "./chatState";
import type { RestoredConversationPayload } from "./chatConversationApi";

interface UseChatRestoreCompatibilityOptions {
  currentConversation: Conversation | null;
  workspaceRestore: WorkspaceRestorePayload | null;
  dispatch: Dispatch<ChatAction>;
  setConversationId: (conversationId: string | null) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  setWorkspaceRestore: (workspaceRestore: WorkspaceRestorePayload | null) => void;
}

interface ChatRestoreCompatibilityResult {
  routingSnapshot: ConversationRoutingSnapshot | null;
  nonExecutableMessageIds: ReadonlySet<string>;
  restoredMessageIds: ReadonlySet<string>;
  applyImportedConversationPayload: (payload: RestoredConversationPayload) => void;
}

export function useChatRestoreCompatibility({
  currentConversation,
  workspaceRestore,
  dispatch,
  setConversationId,
  setCurrentConversation,
  setWorkspaceRestore,
}: UseChatRestoreCompatibilityOptions): ChatRestoreCompatibilityResult {
  const [nonExecutableMessageIds, setNonExecutableMessageIds] = useState<ReadonlySet<string>>(new Set());

  const routingSnapshot = useMemo(() => {
    if (workspaceRestore?.workspace) {
      return createConversationRoutingSnapshot({
        detectedNeedSummary: workspaceRestore.workspace.currentObjective,
        recommendedNextStep: workspaceRestore.workspace.recommendedNextStep,
      });
    }

    return currentConversation?.routingSnapshot ?? null;
  }, [currentConversation, workspaceRestore]);

  const restoredMessageIds = useMemo(
    () => new Set((workspaceRestore?.recentTranscript ?? []).map((message) => message.id)),
    [workspaceRestore],
  );

  const applyImportedConversationPayload = useCallback((payload: RestoredConversationPayload) => {
    setConversationId(payload.conversationId);
    setCurrentConversation(payload.conversation);
    setWorkspaceRestore(null);
    setNonExecutableMessageIds(new Set(payload.messages.map((message) => message.id)));
    dispatch({ type: "REPLACE_ALL", messages: payload.messages });
  }, [dispatch, setConversationId, setCurrentConversation, setWorkspaceRestore]);

  return {
    routingSnapshot,
    nonExecutableMessageIds,
    restoredMessageIds,
    applyImportedConversationPayload,
  };
}