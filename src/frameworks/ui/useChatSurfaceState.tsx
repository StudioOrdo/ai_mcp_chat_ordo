"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useGlobalChat } from "@/hooks/useGlobalChat";
import { usePresentedChatMessages } from "@/hooks/usePresentedChatMessages";
import { useUICommands } from "@/hooks/useUICommands";
import { useChatComposerController } from "@/hooks/chat/useChatComposerController";
import type { ActionLinkType } from "@/core/entities/rich-content";
import { buildTranscriptCopy } from "@/lib/chat/conversation-portability";
import { resolveProductExperienceFacade } from "@/frameworks/ui/product-experience-facade";
import {
  exportConversationById,
  importConversationFromPayload,
} from "@/hooks/chat/chatConversationApi";
import { resolveJobsRail, type JobsRailAction } from "@/frameworks/ui/jobs-rail/resolve-jobs-rail";
import type { OperationActionConfirmation } from "@/core/entities/operation";
import {
  buildOperationActionDispatchPayload,
  parseOperationActionLinkModel,
  type OperationActionLinkModel,
} from "@/lib/operations/operation-action-view-model";
import type {
  OperationActionConfirmationRequest,
  OperationActionConfirmationResolver,
} from "@/frameworks/ui/operations/OperationActionConfirmationDialog";

export type ActionDispatchDeps = {
  router: ReturnType<typeof useRouter>;
  conversationId: string | null;
  setConversationId: (id: string) => void;
  refreshConversation: (id?: string) => void;
  setComposerText: (text: string) => void;
  sendMessage?: (messageText: string) => Promise<{ ok: boolean; error?: string }>;
  setActionError?: (error: string) => void;
  confirmOperationAction?: OperationActionConfirmationResolver;
};

function isSyntheticBrowserJobId(jobId: string): boolean {
  return jobId.startsWith("browser:");
}

async function postJobAction(jobId: string, operation: string) {
  if (isSyntheticBrowserJobId(jobId)) {
    return { job: undefined };
  }

  const response = await fetch(`/api/chat/jobs/${encodeURIComponent(jobId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: operation }),
  });

  if (!response.ok) {
    throw new Error("Job action failed.");
  }

  return response.json() as Promise<{ job?: { conversationId?: string } }>;
}

async function resolveOperationActionConfirmation(
  model: OperationActionLinkModel,
  confirmOperationAction?: OperationActionConfirmationResolver,
): Promise<OperationActionConfirmation | null | undefined> {
  switch (model.confirmPolicy) {
    case "none":
      return undefined;
    case "single_click":
      if (model.riskLevel === "destructive" || model.riskLevel === "high") {
        return confirmOperationAction?.(model) ?? null;
      }
      return { confirmed: true };
    case "phrase":
      return confirmOperationAction?.(model) ?? null;
    case "admin_reauth":
      return confirmOperationAction?.(model) ?? null;
    default:
      model.confirmPolicy satisfies never;
      return null;
  }
}

async function postOperationAction(
  value: string,
  params?: Record<string, string>,
  confirmOperationAction?: OperationActionConfirmationResolver,
) {
  const model = parseOperationActionLinkModel(value, params);
  if (model.disabledReason) {
    return null;
  }

  const confirmation = await resolveOperationActionConfirmation(model, confirmOperationAction);
  if (confirmation === null) {
    return null;
  }

  const response = await fetch(
    `/api/operations/${encodeURIComponent(model.operationId)}/actions/${encodeURIComponent(model.actionId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildOperationActionDispatchPayload(model, confirmation)),
    },
  );
  const payload = await response.json().catch(() => ({}));

  if (!response.ok && typeof payload !== "object") {
    throw new Error("Operation action failed.");
  }

  return payload as {
    operation?: { conversationId?: string | null };
    snapshot?: { operation?: { conversationId?: string | null } };
    conversationSummary?: unknown;
  };
}

function resolveExternalActionUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("//")) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return new URL(trimmed, window.location.origin).toString();
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function isRetiredPublicRoute(value: string): boolean {
  return value === "/library"
    || value.startsWith("/library/")
    || value === "/journal"
    || value.startsWith("/journal/")
    || value === "/blog"
    || value.startsWith("/blog/");
}

function resolveRouteActionValue(value: string, params?: Record<string, string>): string {
  return (value || params?.href || params?.path || "").trim();
}

export const ACTION_HANDLERS: Record<ActionLinkType, (deps: ActionDispatchDeps, value: string, params?: Record<string, string>) => void | Promise<void>> = {
  conversation: (deps, value, params) => {
    const targetId = value || params?.id;
    if (!targetId) return;
    if (deps.conversationId && deps.conversationId !== targetId) {
      if (!window.confirm("Switch to a different conversation? Your current thread will be saved.")) return;
    }
    deps.setConversationId(targetId);
    deps.refreshConversation(targetId);
  },
  route: (deps, value, params) => {
    const target = resolveRouteActionValue(value, params);

    if (isRetiredPublicRoute(target)) {
      deps.setComposerText("Tell me what you want to find or publish, and I will help from here.");
      return;
    }
    if (target.startsWith("/") && !target.startsWith("//")) deps.router.push(target);
  },
  send: (deps, value, params) => {
    deps.setComposerText(value || params?.text || "");
  },
  tool: async (deps, value, params) => {
    const text = value || params?.text || "";
    if (!text.trim()) {
      return;
    }
    if (deps.sendMessage) {
      await deps.sendMessage(text);
      return;
    }
    deps.setComposerText(text);
  },
  corpus: (deps, value) => {
    deps.setComposerText(
      value
        ? `Find the internal material related to ${value}.`
        : "Find the internal material I need.",
    );
  },
  external: (_deps, value, params) => {
    const target = resolveExternalActionUrl(value || params?.url || "");
    if (!target) {
      return;
    }
    window.open(target, "_blank", "noopener,noreferrer");
  },
  job: async (deps, value, params) => {
    const operation = params?.operation;
    if (!value || !operation) {
      return;
    }

    if (isSyntheticBrowserJobId(value)) {
      return;
    }

    const payload = await postJobAction(value, operation);
    deps.refreshConversation(payload.job?.conversationId || deps.conversationId || undefined);
  },
  operation: async (deps, value, params) => {
    let payload: Awaited<ReturnType<typeof postOperationAction>>;
    try {
      payload = await postOperationAction(value, params, deps.confirmOperationAction);
    } catch {
      deps.setActionError?.("Operation action failed.");
      return;
    }
    if (!payload) {
      return;
    }

    const conversationId = payload.operation?.conversationId
      ?? payload.snapshot?.operation?.conversationId
      ?? deps.conversationId
      ?? undefined;
    deps.refreshConversation(conversationId);
  },
};

export function useChatSurfaceState({
  isEmbedded,
  surfaceVariant = "chat",
}: {
  isEmbedded: boolean;
  surfaceVariant?: "chat" | "workspace";
}) {
  const router = useRouter();
  const {
    viewerRole,
    activeStreamId,
    messages,
    isSending,
    retryFailedMessage,
    sendMessage,
    stopStream,
    jobStateEntries,
    workflowStateEntries,
    conversationId,
    currentConversation,
    workspaceRestore,
    isLoadingMessages,
    applyImportedConversationPayload,
    setConversationId,
    refreshConversation,
  } =
    useGlobalChat();
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const [isConversationActionPending, setIsConversationActionPending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [operationConfirmationRequest, setOperationConfirmationRequest] =
    useState<OperationActionConfirmationRequest | null>(null);
  const operationConfirmationResolverRef =
    useRef<((confirmation: OperationActionConfirmation | null | undefined) => void) | null>(null);
  const sendErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSendError = useCallback((error: string) => {
    setSendError(error);
    if (sendErrorTimerRef.current) clearTimeout(sendErrorTimerRef.current);
    sendErrorTimerRef.current = setTimeout(() => setSendError(null), 3000);
  }, []);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    activeTrigger,
    canSend,
    handleFileDrop,
    handleFileRemove,
    handleFileSelect,
    handleInputChange,
    handleSend,
    handleSuggestionSelect,
    input,
    mentionIndex,
    pendingFiles,
    setComposerText,
    setMentionIndex,
    suggestions: mentionSuggestions,
  } = useChatComposerController({
    isSending,
    onSendMessage: sendMessage,
    onSendError: handleSendError,
    textareaRef,
  });

  const {
    presentedMessages,
    dynamicSuggestions,
    scrollDependency,
  } = usePresentedChatMessages(messages, isSending, jobStateEntries, workflowStateEntries);
  const productExperience = useMemo(
    () => resolveProductExperienceFacade({
      isEmbedded,
      viewerRole,
      sessionSearchQuery,
      presentedMessages,
      workspaceRestore,
      jobStateEntries,
      currentConversationTitle: currentConversation?.title ?? null,
    }),
    [currentConversation?.title, isEmbedded, jobStateEntries, presentedMessages, sessionSearchQuery, viewerRole, workspaceRestore],
  );

  useUICommands(presentedMessages, isLoadingMessages);

  const handleSuggestionClick = useCallback(async (txt: string) => {
    if (isSending) {
      return;
    }

    await sendMessage(txt);
  }, [isSending, sendMessage]);

  const handleLinkClick = useCallback((slug: string) => {
    setComposerText(
      slug
        ? `Find the internal material related to ${slug}.`
        : "Find the internal material I need.",
    );
  }, [setComposerText]);

  const confirmOperationAction = useCallback<OperationActionConfirmationResolver>((model, label = "Operation action") => {
    return new Promise((resolve) => {
      operationConfirmationResolverRef.current = resolve;
      setOperationConfirmationRequest({ model, label });
    });
  }, []);

  const handleOperationConfirmationCancel = useCallback(() => {
    const resolve = operationConfirmationResolverRef.current;
    operationConfirmationResolverRef.current = null;
    setOperationConfirmationRequest(null);
    resolve?.(null);
  }, []);

  const handleOperationConfirmationConfirm = useCallback((confirmation: OperationActionConfirmation) => {
    const resolve = operationConfirmationResolverRef.current;
    operationConfirmationResolverRef.current = null;
    setOperationConfirmationRequest(null);
    resolve?.(confirmation);
  }, []);

  const handleActionClick = useCallback(
    (actionType: ActionLinkType, value: string, params?: Record<string, string>) => {
      const deps: ActionDispatchDeps = {
        router,
        conversationId,
        setConversationId,
        refreshConversation,
        setComposerText,
        sendMessage,
        setActionError: handleSendError,
        confirmOperationAction,
      };
      const handler = ACTION_HANDLERS[actionType];
      void handler?.(deps, value, params);
    },
    [router, conversationId, setConversationId, refreshConversation, setComposerText, sendMessage, handleSendError, confirmOperationAction],
  );

  const handleRetryClick = useCallback(async (retryKey: string) => {
    if (isSending) {
      return;
    }

    await retryFailedMessage(retryKey);
  }, [isSending, retryFailedMessage]);

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

  const isHeroState = productExperience.isHeroState;
  const visibleProductExperienceSummary = surfaceVariant === "workspace"
    ? productExperience.summary
    : null;
  const jobsRail = useMemo(
    () => resolveJobsRail({
      entries: jobStateEntries ?? [],
      workflows: workflowStateEntries ?? [],
      syncState: conversationId ? "live" : "unknown",
      conversationId,
      canExportDiagnostics: Boolean(conversationId),
    }),
    [conversationId, jobStateEntries, workflowStateEntries],
  );
  const handleJobsRailAction = useCallback((action: JobsRailAction) => {
    if (action.kind === "download_bundle") {
      const targetConversationId = action.params?.conversationId ?? conversationId;
      if (targetConversationId) {
        void handleDiagnosticBundleDownload(targetConversationId);
      }
      return;
    }

    handleActionClick(action.actionType, action.value, action.params);
  }, [conversationId, handleActionClick, handleDiagnosticBundleDownload]);

  const headerProps = {
    canCopyTranscript: messages.length > 0,
    canExportConversation: Boolean(conversationId),
    canImportConversation: true,
    isConversationActionPending,
    onCopyTranscript: handleCopyTranscript,
    onExportConversation: handleExportConversation,
    onImportConversationFile: handleImportConversationFile,
    jobsRail,
    conversationUtilityActions: {
      canCopyTranscript: messages.length > 0,
      canExportConversation: Boolean(conversationId),
      canImportConversation: true,
      isBusy: isConversationActionPending,
      onCopyTranscript: handleCopyTranscript,
      onExportConversation: handleExportConversation,
      onImportConversationFile: handleImportConversationFile,
    },
    onJobsRailAction: handleJobsRailAction,
  };

  const contentProps = {
    activeTrigger: activeTrigger ? activeTrigger.char : null,
    activeStreamId,
    canSend,
    canStopStream: Boolean(activeStreamId),
    dynamicSuggestions,
    input,
    inputRef: textareaRef,
    isHeroState,
    isLoadingMessages,
    isSending,
    mentionIndex,
    messages: presentedMessages,
    onFileDrop: handleFileDrop,
    onFileRemove: handleFileRemove,
    onFileSelect: handleFileSelect,
    onInputChange: handleInputChange,
    onLinkClick: handleLinkClick,
    onActionClick: handleActionClick,
    onMentionIndexChange: setMentionIndex,
    onRetryClick: handleRetryClick,
    onSend: handleSend,
    onSuggestionClick: handleSuggestionClick,
    onSuggestionSelect: handleSuggestionSelect,
    onStopStream: stopStream,
    operationConfirmationDialog: {
      request: operationConfirmationRequest,
      onCancel: handleOperationConfirmationCancel,
      onConfirm: handleOperationConfirmationConfirm,
    },
    pendingFiles,
    productExperienceState: productExperience.kind,
    productExperienceSummary: visibleProductExperienceSummary,
    sendError,
    scrollDependency,
    searchQuery: sessionSearchQuery,
    suggestions: mentionSuggestions,
  };

  return {
    canStopStream: Boolean(activeStreamId),
    contentProps,
    conversationId,
    currentConversation,
    handleActionClick,
    headerProps,
    sessionSearchQuery,
    setSessionSearchQuery,
  };
}
