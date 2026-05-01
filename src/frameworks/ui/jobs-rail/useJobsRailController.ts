"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useGlobalChat } from "@/hooks/useGlobalChat";
import { buildTranscriptCopy } from "@/lib/chat/conversation-portability";
import {
  exportConversationById,
  importConversationFromPayload,
} from "@/hooks/chat/chatConversationApi";
import {
  OPEN_GLOBAL_CHAT_EVENT,
  SET_CHAT_COMPOSER_TEXT_EVENT,
} from "@/lib/chat/chat-events";
import {
  ACTION_HANDLERS,
  type ActionDispatchDeps,
} from "@/frameworks/ui/useChatSurfaceState";

import { resolveJobsRail, type JobsRailAction } from "./resolve-jobs-rail";

function dispatchComposerText(text: string) {
  window.dispatchEvent(new Event(OPEN_GLOBAL_CHAT_EVENT));
  window.dispatchEvent(
    new CustomEvent<{ text: string }>(SET_CHAT_COMPOSER_TEXT_EVENT, {
      detail: { text },
    }),
  );
}

export function useJobsRailController() {
  const router = useRouter();
  const {
    conversationId,
    jobStateEntries,
    messages,
    setConversationId,
    refreshConversation,
    applyImportedConversationPayload,
  } = useGlobalChat();
  const [isConversationActionPending, setIsConversationActionPending] = useState(false);

  const handleCopyTranscript = useCallback(async () => {
    const transcript = buildTranscriptCopy(messages);
    if (!transcript) {
      return;
    }

    try {
      await navigator.clipboard.writeText(transcript);
    } catch {
      /* clipboard unavailable */
    }
  }, [messages]);

  const handleExportConversation = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    setIsConversationActionPending(true);
    try {
      const result = await exportConversationById(conversationId);
      if (result.status !== "exported" || !result.payload) {
        return;
      }

      const blob = new Blob([`${JSON.stringify(result.payload, null, 2)}\n`], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `conversation-${conversationId}.json`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsConversationActionPending(false);
    }
  }, [conversationId]);

  const handleImportConversationFile = useCallback(async (file: File) => {
    setIsConversationActionPending(true);
    try {
      const result = await importConversationFromPayload(await file.text());
      if (result.status === "imported" && result.payload) {
        applyImportedConversationPayload(result.payload);
      }
    } finally {
      setIsConversationActionPending(false);
    }
  }, [applyImportedConversationPayload]);

  const handleDiagnosticBundleDownload = useCallback(async (targetConversationId: string) => {
    setIsConversationActionPending(true);
    try {
      const response = await fetch(`/api/diagnostics/conversations/${encodeURIComponent(targetConversationId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          includeRuntimeLogs: true,
          includeConversationExport: true,
          includeJobTimelines: true,
        }),
      });

      if (!response.ok) {
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileNameMatch = /filename="([^"]+)"/.exec(disposition);
      const fileName = fileNameMatch?.[1] ?? `ordo-diagnostic-bundle-${targetConversationId}.json`;
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsConversationActionPending(false);
    }
  }, []);

  const handleActionClick = useCallback((action: JobsRailAction) => {
    if (action.kind === "download_bundle") {
      const targetConversationId = action.params?.conversationId ?? conversationId;
      if (targetConversationId) {
        void handleDiagnosticBundleDownload(targetConversationId);
      }
      return;
    }

    const deps: ActionDispatchDeps = {
      router,
      conversationId,
      setConversationId,
      refreshConversation,
      setComposerText: dispatchComposerText,
    };
    const handler = ACTION_HANDLERS[action.actionType];
    void handler?.(deps, action.value, action.params);
  }, [conversationId, handleDiagnosticBundleDownload, refreshConversation, router, setConversationId]);

  const model = useMemo(
    () => resolveJobsRail({
      entries: jobStateEntries ?? [],
      syncState: conversationId ? "live" : "unknown",
      conversationId,
      canExportDiagnostics: Boolean(conversationId),
    }),
    [conversationId, jobStateEntries],
  );

  return {
    model,
    utilityActions: {
      canCopyTranscript: messages.length > 0,
      canExportConversation: Boolean(conversationId),
      canImportConversation: true,
      isBusy: isConversationActionPending,
      onCopyTranscript: handleCopyTranscript,
      onExportConversation: handleExportConversation,
      onImportConversationFile: handleImportConversationFile,
    },
    onAction: handleActionClick,
  };
}