import { useCallback, useRef, useState, type Dispatch } from "react";

import type { AttachmentPart } from "@/lib/chat/message-attachments";
import type { MediaContinuityHandoff } from "@/lib/chat/media-continuity-handoff";
import type { CurrentPageSnapshot } from "@/lib/chat/current-page-context";
import type { TaskOriginHandoff } from "@/lib/chat/task-origin-handoff";

import { getChatStreamAdapter } from "./chatStreamAdapter";
import { createChatStreamDispatcher } from "./chatStreamDispatch";
import { createChatStreamProcessor } from "./chatStreamProcessor";
import { runChatStream } from "./chatStreamRunner";
import { createChatStreamTextBuffer } from "./chatStreamTextBuffer";
import type { ChatAction, GenerationStatusUpdate } from "./chatState";

interface StopStreamResult {
  ok: boolean;
  error?: string;
}

interface RunChatStreamResult {
  conversationId: string | null;
  lifecycle: GenerationStatusUpdate | null;
  didReceiveTextDelta: boolean;
}

const streamAdapter = getChatStreamAdapter();
const streamProcessor = createChatStreamProcessor();

interface UseChatStreamRuntimeOptions {
  conversationId: string | null;
  currentPathname: string;
  dispatch: Dispatch<ChatAction>;
  setConversationId: (conversationId: string | null) => void;
}

export function useChatStreamRuntime({
  conversationId,
  currentPathname,
  dispatch,
  setConversationId,
}: UseChatStreamRuntimeOptions) {
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const activeStreamIdRef = useRef<string | null>(null);

  const updateActiveStreamId = useCallback((streamId: string | null) => {
    activeStreamIdRef.current = streamId;
    setActiveStreamId(streamId);
  }, []);

  const runStream = useCallback(
    async (
      historyForBackend: Array<{ role: string; content: string }>,
      assistantIndex: number,
      attachments: AttachmentPart[],
      taskOriginHandoff?: TaskOriginHandoff,
      currentPageSnapshot?: CurrentPageSnapshot,
      mediaContinuityHandoff?: MediaContinuityHandoff | null,
    ): Promise<RunChatStreamResult> => {
      const streamOptions = {
        conversationId: conversationId || undefined,
        currentPathname,
        attachments,
        taskOriginHandoff,
        ...(mediaContinuityHandoff ? { mediaContinuityHandoff } : {}),
        ...(currentPageSnapshot ? { currentPageSnapshot } : {}),
      };
      const stream = await streamAdapter.fetchStream(historyForBackend, streamOptions);
      const textBuffer = createChatStreamTextBuffer({ assistantIndex, dispatch });
      const streamDispatch = createChatStreamDispatcher({
        initialConversationId: conversationId,
        dispatch,
        setConversationId,
        setStreamId: updateActiveStreamId,
      });

      updateActiveStreamId(null);

      try {
        const resolvedConversationId = await runChatStream({
          stream,
          textBuffer,
          streamDispatch,
          streamProcessor,
          assistantIndex,
        });

        return {
          conversationId: resolvedConversationId,
          lifecycle: streamDispatch.getResolvedTerminalState(),
          didReceiveTextDelta: textBuffer.hasDispatchedText(),
        };
      } finally {
        updateActiveStreamId(null);
      }
    },
    [conversationId, currentPathname, dispatch, setConversationId, updateActiveStreamId],
  );

  const stopStream = useCallback(async (): Promise<StopStreamResult> => {
    const streamId = activeStreamIdRef.current;
    if (!streamId) {
      return { ok: false, error: "No active stream is available to stop." };
    }

    try {
      const response = await fetch(`/api/chat/streams/${encodeURIComponent(streamId)}/stop`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        return {
          ok: false,
          error: typeof payload.error === "string" ? payload.error : "Unable to stop the active stream.",
        };
      }

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to stop the active stream.",
      };
    }
  }, []);

  return {
    activeStreamId,
    runStream,
    stopStream,
  };
}