import { useEffect, useMemo, useRef } from "react";

import {
  clearPersistedBrowserRuntimeEntriesForConversation,
  readPersistedBrowserRuntimeEntries,
  removePersistedBrowserRuntimeEntry,
  restorePersistedBrowserRuntimeEntry,
  type PersistedBrowserRuntimeEntry,
  upsertPersistedBrowserRuntimeEntry,
} from "@/lib/media/browser-runtime/browser-runtime-state";

export interface RuntimeSnapshots {
  list: () => PersistedBrowserRuntimeEntry[];
  restore: (jobId: string) => PersistedBrowserRuntimeEntry | null;
  persist: (entry: PersistedBrowserRuntimeEntry) => void;
  remove: (jobId: string) => void;
}

export function useRuntimeSnapshots(conversationId: string | null): RuntimeSnapshots {
  const previousConversationIdRef = useRef<string | null | undefined>(conversationId);

  useEffect(() => {
    const previousConversationId = previousConversationIdRef.current;
    previousConversationIdRef.current = conversationId;

    if (previousConversationId === undefined || previousConversationId === conversationId) {
      return;
    }

    clearPersistedBrowserRuntimeEntriesForConversation(previousConversationId);
  }, [conversationId]);

  return useMemo(() => ({
    list: readPersistedBrowserRuntimeEntries,
    restore: restorePersistedBrowserRuntimeEntry,
    persist: upsertPersistedBrowserRuntimeEntry,
    remove: removePersistedBrowserRuntimeEntry,
  }), []);
}