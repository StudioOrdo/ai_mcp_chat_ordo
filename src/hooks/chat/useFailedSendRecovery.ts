"use client";

import { useCallback, useEffect, useRef } from "react";

import type { ChatMessage } from "@/core/entities/chat-message";
import type { FailedSendPayload } from "@/hooks/chat/useChatSend";
import { hydrateFailedSendRecovery } from "@/hooks/chat/chatFailedSendRecovery";

export interface UseFailedSendRecoveryReturn {
  getFailedSend: (retryKey: string) => FailedSendPayload | undefined;
  registerFailedSend: (payload: FailedSendPayload) => void;
  clearFailedSend: (retryKey: string) => void;
}

export function useFailedSendRecovery(
  messages: ChatMessage[],
): UseFailedSendRecoveryReturn {
  const failedSendsRef = useRef(new Map<string, FailedSendPayload>());

  const getFailedSend = useCallback(
    (retryKey: string) => failedSendsRef.current.get(retryKey),
    [],
  );

  const registerFailedSend = useCallback((payload: FailedSendPayload) => {
    failedSendsRef.current.set(payload.retryKey, payload);
  }, []);

  const clearFailedSend = useCallback((retryKey: string) => {
    failedSendsRef.current.delete(retryKey);
  }, []);

  useEffect(() => {
    const { failedSends } = hydrateFailedSendRecovery(messages);
    const nextFailedSends = new Map<string, FailedSendPayload>();

    for (const payload of failedSends) {
      const existing = failedSendsRef.current.get(payload.retryKey);
      nextFailedSends.set(payload.retryKey, {
        ...payload,
        ...(existing?.taskOriginHandoff
          ? { taskOriginHandoff: existing.taskOriginHandoff }
          : {}),
        ...(existing?.mediaContinuityHandoff
          ? { mediaContinuityHandoff: existing.mediaContinuityHandoff }
          : {}),
      });
    }

    failedSendsRef.current = nextFailedSends;
  }, [messages]);

  return { getFailedSend, registerFailedSend, clearFailedSend };
}
