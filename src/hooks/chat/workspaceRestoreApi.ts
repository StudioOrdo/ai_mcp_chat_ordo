import type { ChatMessage } from "@/core/entities/chat-message";
import type { Conversation, Message } from "@/core/entities/conversation";
import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import type { WorkspaceRestorePayload } from "@/core/platform/conversation-restore/WorkspaceRestore";

import { hydrateFailedSendRecovery } from "./chatFailedSendRecovery";

export interface WorkspaceRestoredConversationPayload {
  workspaceRestore: WorkspaceRestorePayload;
  conversationId: string | null;
  conversation: Conversation | null;
  messages: ChatMessage[];
}

export interface WorkspaceRestoreResult {
  status: "restored" | "missing" | "unauthorized" | "error" | "network-error" | "aborted" | "unexpected-error";
  payload?: WorkspaceRestoredConversationPayload;
  statusCode?: number;
}

export const DEFAULT_WORKSPACE_RESTORE_RETRY_ATTEMPTS = 3;
export const DEFAULT_WORKSPACE_RESTORE_RETRY_DELAY_MS = 200;

function toChatMessages(messages: ReadonlyArray<{ id: string; role: "user" | "assistant" | "system"; content: string; parts: Message["parts"]; createdAt: string; }>): ChatMessage[] {
  const restoredMessages = messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    parts: message.parts,
    timestamp: new Date(message.createdAt),
  }));
  return hydrateFailedSendRecovery(restoredMessages).messages;
}

function buildWorkspaceRestoreConversation(payload: WorkspaceRestorePayload): Conversation | null {
  const workspace = payload.workspace;
  if (!workspace) {
    return null;
  }

  const firstMessageAt = payload.recentTranscript[0]?.createdAt ?? null;
  const status = workspace.status === "active" ? "active" : "archived";

  return {
    id: workspace.conversationId,
    userId: workspace.userId,
    title: workspace.title,
    status,
    createdAt: firstMessageAt ?? workspace.updatedAt,
    updatedAt: workspace.updatedAt,
    convertedFrom: null,
    messageCount: payload.recentTranscript.length,
    firstMessageAt,
    lastToolUsed: null,
    sessionSource: "workspace_restore",
    promptVersion: null,
    routingSnapshot: createConversationRoutingSnapshot({
      detectedNeedSummary: workspace.currentObjective,
      recommendedNextStep: workspace.recommendedNextStep,
    }),
    referralSource: null,
    ...(workspace.status === "deleted" ? { deletedAt: workspace.updatedAt } : {}),
  };
}

function isWorkspaceRestorePayload(value: unknown): value is WorkspaceRestorePayload {
  return typeof value === "object" && value !== null && "restoreMeta" in value && "recentTranscript" in value;
}

export function isTransientWorkspaceRestoreStatus(
  status: WorkspaceRestoreResult["status"],
): status is "network-error" | "aborted" {
  return status === "network-error" || status === "aborted";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function restoreWorkspaceFromPathOnce(path: string): Promise<WorkspaceRestoreResult> {
  let response: Response;

  try {
    response = await fetch(path, undefined);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { status: "aborted" };
    }

    return { status: "network-error" };
  }

  if (response.status === 204 || response.status === 404) {
    return { status: "missing", statusCode: response.status };
  }

  if (response.status === 401) {
    return { status: "unauthorized", statusCode: 401 };
  }

  if (!response.ok) {
    return { status: "error", statusCode: response.status };
  }

  let raw: unknown;
  try {
    raw = await response.json() as unknown;
  } catch {
    return { status: "unexpected-error" };
  }

  if (!isWorkspaceRestorePayload(raw)) {
    return { status: "unexpected-error" };
  }

  const payload = raw;
  const messages = toChatMessages(payload.recentTranscript);

  return {
    status: "restored",
    payload: {
      workspaceRestore: payload,
      conversationId: payload.workspace?.conversationId ?? null,
      conversation: buildWorkspaceRestoreConversation(payload),
      messages,
    },
  };
}

async function restoreWorkspaceFromPath(path: string): Promise<WorkspaceRestoreResult> {
  let attempt = 0;
  let result = await restoreWorkspaceFromPathOnce(path);

  while (
    attempt < DEFAULT_WORKSPACE_RESTORE_RETRY_ATTEMPTS - 1
    && isTransientWorkspaceRestoreStatus(result.status)
  ) {
    attempt += 1;
    await delay(DEFAULT_WORKSPACE_RESTORE_RETRY_DELAY_MS * attempt);
    result = await restoreWorkspaceFromPathOnce(path);
  }

  return result;
}

export async function restoreActiveWorkspace(): Promise<WorkspaceRestoreResult> {
  return restoreWorkspaceFromPath("/api/workspace/restore");
}

export async function restoreWorkspaceByConversationId(
  conversationId: string,
): Promise<WorkspaceRestoreResult> {
  return restoreWorkspaceFromPath(
    `/api/workspace/restore?conversationId=${encodeURIComponent(conversationId)}`,
  );
}
