import type { Dispatch } from "react";

import type { ChatAction, GenerationStatusUpdate } from "./chatState";

export interface StreamConversationIdAction {
  type: "SET_CONVERSATION_ID";
  conversationId: string;
}

export interface StreamIdAction {
  type: "SET_STREAM_ID";
  streamId: string;
}

export interface StreamTerminalStateAction {
  type: "SET_STREAM_TERMINAL_STATE";
  index: number;
  generation: GenerationStatusUpdate;
}

interface CreateChatStreamDispatchOptions {
  initialConversationId: string | null;
  dispatch: Dispatch<ChatAction>;
  setConversationId: (conversationId: string | null) => void;
  setStreamId: (streamId: string | null) => void;
}

export interface ChatStreamDispatcher {
  dispatchStreamAction: (action: ChatAction | StreamConversationIdAction | StreamIdAction | StreamTerminalStateAction) => void;
  getResolvedConversationId: () => string | null;
  getResolvedStreamId: () => string | null;
  getResolvedTerminalState: () => GenerationStatusUpdate | null;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const objectValue = value as Record<string, unknown>;
  const keys = Object.keys(objectValue).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`).join(",")}}`;
}

function buildFallbackResultHash(name: string, result: unknown): string {
  return stableStringify({ name, result });
}

export function createChatStreamDispatcher({
  initialConversationId,
  dispatch,
  setConversationId,
  setStreamId,
}: CreateChatStreamDispatchOptions): ChatStreamDispatcher {
  let resolvedConversationId = initialConversationId;
  let resolvedStreamId: string | null = null;
  let resolvedTerminalState: GenerationStatusUpdate | null = null;
  const seenToolResultKeys = new Set<string>();

  return {
    dispatchStreamAction(action) {
      if (action.type === "SET_CONVERSATION_ID") {
        resolvedConversationId = action.conversationId;
        setConversationId(action.conversationId);
        return;
      }

      if (action.type === "SET_STREAM_ID") {
        resolvedStreamId = action.streamId;
        setStreamId(action.streamId);
        return;
      }

      if (action.type === "SET_STREAM_TERMINAL_STATE") {
        resolvedTerminalState = action.generation;
        dispatch({
          type: "UPSERT_GENERATION_STATUS",
          index: action.index,
          generation: action.generation,
        });
        return;
      }

      if (action.type === "APPEND_TOOL_RESULT") {
        const dedupeKey = action.toolInvocationId
          ? `toolInvocationId:${action.toolInvocationId}`
          : `${action.sourceMessageId ?? `assistant_index:${action.index}`}:${action.name}:${action.contentHash ?? buildFallbackResultHash(action.name, action.result)}`;

        if (seenToolResultKeys.has(dedupeKey)) {
          return;
        }

        seenToolResultKeys.add(dedupeKey);
      }

      dispatch(action);
    },
    getResolvedConversationId() {
      return resolvedConversationId;
    },
    getResolvedStreamId() {
      return resolvedStreamId;
    },
    getResolvedTerminalState() {
      return resolvedTerminalState;
    },
  };
}