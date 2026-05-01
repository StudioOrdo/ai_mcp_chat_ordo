import { useMemo } from "react";

import type { ChatMessage } from "@/core/entities/chat-message";
import type { WorkspaceRestorePayload } from "@/core/platform/conversation-restore/WorkspaceRestore";

import { useJobStateStore } from "./useJobStateStore";

export function useChatJobState(
  conversationId: string | null,
  _messages: readonly ChatMessage[],
  workspaceRestore: WorkspaceRestorePayload | null,
) {
  const seededEntries = useMemo(() => [
    ...(workspaceRestore?.activeJobs ?? []),
    ...(workspaceRestore?.attentionNeededJobs ?? []),
  ], [workspaceRestore]);

  return useJobStateStore(
    conversationId,
    seededEntries,
  );
}
