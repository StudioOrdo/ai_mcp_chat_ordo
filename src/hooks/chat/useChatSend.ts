import { useCallback, useRef, type Dispatch } from "react";

import { MessageFactory } from "@/core/entities/MessageFactory";
import type { ChatMessage } from "@/core/entities/chat-message";
import type { CurrentPageMemento } from "@/lib/chat/CurrentPageMemento";
import type { MediaContinuityHandoff } from "@/lib/chat/media-continuity-handoff";
import type { AttachmentPart } from "@/lib/chat/message-attachments";
import type { TaskOriginHandoff } from "@/lib/chat/task-origin-handoff";

import type { ChatAction } from "./chatState";
import {
  cleanupChatAttachments,
  uploadChatAttachments,
} from "./chatAttachmentApi";
import { hydrateFailedSendRecovery, type FailedSendPayload } from "./chatFailedSendRecovery";
import {
  buildBackendHistory,
  type PreparedChatSend,
  prepareChatSend,
  shouldRefreshConversationAfterStream,
  validateChatSend,
} from "./chatSendPolicy";
import {
  formatProviderCreditCircuitBreakerMessage,
  getProviderCreditCircuitBreakerState,
} from "./providerCreditCircuitBreaker";
import { useChatStreamRuntime } from "./useChatStreamRuntime";

interface UseChatSendOptions {
  conversationId: string | null;
  currentPathname: string;
  memento: CurrentPageMemento;
  refreshConversation: (conversationIdOverride?: string | null) => Promise<void>;
  dispatch: Dispatch<ChatAction>;
  getFailedSend: (retryKey: string) => FailedSendPayload | undefined;
  messages: ChatMessage[];
  registerFailedSend: (payload: FailedSendPayload) => void;
  setConversationId: (conversationId: string | null) => void;
  setIsSending: (isSending: boolean) => void;
  clearFailedSend: (retryKey: string) => void;
}

export type { FailedSendPayload } from "./chatFailedSendRecovery";

function createFailedAssistantMessage(errorMessage: string, retryKey: string, failedUserMessageId: string) {
  return MessageFactory.createAssistantMessage(errorMessage, [], {
    failedSend: {
      retryKey,
      failedUserMessageId,
    },
  });
}

function prepareRetrySend(
  messages: ChatMessage[],
  failedUserMessageId: string,
  trimmedMessage: string,
  attachmentParts: AttachmentPart[],
  mediaContinuityHandoff: MediaContinuityHandoff | null,
): PreparedChatSend | null {
  const failedUserIndex = messages.findIndex((message) => message.id === failedUserMessageId);
  if (failedUserIndex < 0) {
    return null;
  }

  const existingUserMessage = messages[failedUserIndex];
  if (!existingUserMessage || existingUserMessage.role !== "user") {
    return null;
  }

  const userParts = [
    ...(trimmedMessage ? [{ type: "text" as const, text: trimmedMessage }] : []),
    ...attachmentParts,
  ];
  const assistantIndex = failedUserIndex + 1;
  const optimisticMessages = [
    ...messages.slice(0, failedUserIndex),
    {
      ...existingUserMessage,
      content: trimmedMessage,
      parts: userParts,
    },
    MessageFactory.createAssistantMessage(),
  ];

  return {
    assistantIndex,
    optimisticMessages,
    historyForBackend: buildBackendHistory(optimisticMessages.slice(0, assistantIndex)),
    mediaContinuityHandoff,
  };
}

function markInterruptedSend(
  dispatch: Dispatch<ChatAction>,
  registerFailedSend: (payload: FailedSendPayload) => void,
  assistantIndex: number,
  payload: FailedSendPayload,
) {
  registerFailedSend(payload);
  dispatch({
    type: "SET_FAILED_SEND",
    index: assistantIndex,
    failedSend: {
      retryKey: payload.retryKey,
      failedUserMessageId: payload.failedUserMessageId,
    },
  });
}

export function useChatSend({
  conversationId,
  currentPathname,
  memento,
  refreshConversation,
  dispatch,
  getFailedSend,
  messages,
  registerFailedSend,
  setConversationId,
  setIsSending,
  clearFailedSend,
}: UseChatSendOptions) {
  const inFlightRef = useRef(false);
  const { activeStreamId, runStream, stopStream } = useChatStreamRuntime({
    conversationId,
    currentPathname,
    dispatch,
    setConversationId,
  });

  const sendMessage = useCallback(
    async (
      messageText: string,
      files: File[] = [],
      taskOriginHandoff?: TaskOriginHandoff,
    ) => {
      const { trimmedMessage, error } = validateChatSend(
        messageText,
        files.length,
        inFlightRef.current,
      );

      if (error) {
        return { ok: false, error };
      }

      const providerCircuit = getProviderCreditCircuitBreakerState(messages);
      if (providerCircuit.active) {
        return {
          ok: false,
          error: formatProviderCreditCircuitBreakerMessage(providerCircuit),
        };
      }

      inFlightRef.current = true;
      setIsSending(true);
      let uploadedAttachmentIds: string[] = [];
      let preparedSend: PreparedChatSend | null = null;
      let attachmentParts: AttachmentPart[] = [];

      try {
        const currentPageSnapshot = memento.getSnapshot();
        attachmentParts = files.length
          ? await uploadChatAttachments(files, conversationId)
          : [];
        uploadedAttachmentIds = attachmentParts.map((attachment) => attachment.assetId);
        preparedSend = prepareChatSend(messages, trimmedMessage, attachmentParts);

        dispatch({
          type: "REPLACE_ALL",
          messages: preparedSend.optimisticMessages,
        });

        const {
          conversationId: resolvedConversationId,
          lifecycle,
          didReceiveTextDelta,
        } = await runStream(
          preparedSend.historyForBackend,
          preparedSend.assistantIndex,
          attachmentParts,
          taskOriginHandoff,
          currentPageSnapshot,
          preparedSend.mediaContinuityHandoff,
        );

        if (lifecycle?.status === "interrupted") {
          const failedUserMessageId = preparedSend.optimisticMessages[preparedSend.assistantIndex - 1]?.id;
          if (failedUserMessageId) {
            markInterruptedSend(dispatch, registerFailedSend, preparedSend.assistantIndex, {
              retryKey: failedUserMessageId,
              failedUserMessageId,
              messageText: trimmedMessage,
              attachments: attachmentParts,
              taskOriginHandoff,
              mediaContinuityHandoff: preparedSend.mediaContinuityHandoff ?? undefined,
            });
          }

          if (shouldRefreshConversationAfterStream(conversationId, resolvedConversationId, didReceiveTextDelta)) {
            await refreshConversation(resolvedConversationId);
          }

          return { ok: true };
        }

        if (shouldRefreshConversationAfterStream(conversationId, resolvedConversationId, didReceiveTextDelta)) {
          await refreshConversation(resolvedConversationId);
        }

        return { ok: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unexpected chat error.";

        if (preparedSend) {
          const failedUserMessageId = preparedSend.optimisticMessages[preparedSend.assistantIndex - 1]?.id;
          if (failedUserMessageId) {
            registerFailedSend({
              retryKey: failedUserMessageId,
              failedUserMessageId,
              messageText: trimmedMessage,
              attachments: attachmentParts,
              taskOriginHandoff,
              mediaContinuityHandoff: preparedSend.mediaContinuityHandoff ?? undefined,
            });

            const failedMessages = [...preparedSend.optimisticMessages];
            failedMessages[preparedSend.assistantIndex] = createFailedAssistantMessage(
              errorMessage,
              failedUserMessageId,
              failedUserMessageId,
            );

            dispatch({
              type: "REPLACE_ALL",
              messages: failedMessages,
            });
          }
        } else {
          await cleanupChatAttachments(uploadedAttachmentIds);
        }

        return { ok: false, error: errorMessage };
      } finally {
        setIsSending(false);
        inFlightRef.current = false;
      }
    },
    [
      conversationId,
      memento,
      refreshConversation,
      dispatch,
      registerFailedSend,
      messages,
      setIsSending,
      runStream,
    ],
  );

  const retryFailedMessage = useCallback(
    async (retryKey: string) => {
      const failedSend = getFailedSend(retryKey)
        ?? hydrateFailedSendRecovery(messages).failedSends.find((payload) => payload.retryKey === retryKey);
      if (!failedSend) {
        return { ok: false, error: "This failed message can no longer be retried." };
      }

      const { trimmedMessage, error } = validateChatSend(
        failedSend.messageText,
        failedSend.attachments.length,
        inFlightRef.current,
      );

      if (error) {
        return { ok: false, error };
      }

      const providerCircuit = getProviderCreditCircuitBreakerState(messages);
      if (providerCircuit.active) {
        return {
          ok: false,
          error: formatProviderCreditCircuitBreakerMessage(providerCircuit),
        };
      }

      inFlightRef.current = true;
      setIsSending(true);
      let preparedRetry: PreparedChatSend | null = null;

      try {
        const currentPageSnapshot = memento.getSnapshot();
        preparedRetry = prepareRetrySend(
          messages,
          failedSend.failedUserMessageId,
          trimmedMessage,
          failedSend.attachments,
          failedSend.mediaContinuityHandoff ?? null,
        );

        if (!preparedRetry) {
          return { ok: false, error: "The original message is no longer available." };
        }

        dispatch({
          type: "REPLACE_ALL",
          messages: preparedRetry.optimisticMessages,
        });

        const {
          conversationId: resolvedConversationId,
          lifecycle,
          didReceiveTextDelta,
        } = await runStream(
          preparedRetry.historyForBackend,
          preparedRetry.assistantIndex,
          failedSend.attachments,
          failedSend.taskOriginHandoff,
          currentPageSnapshot,
          preparedRetry.mediaContinuityHandoff,
        );

        if (lifecycle?.status === "interrupted") {
          markInterruptedSend(dispatch, registerFailedSend, preparedRetry.assistantIndex, failedSend);

          if (shouldRefreshConversationAfterStream(conversationId, resolvedConversationId, didReceiveTextDelta)) {
            await refreshConversation(resolvedConversationId);
          }

          return { ok: true };
        }

        if (shouldRefreshConversationAfterStream(conversationId, resolvedConversationId, didReceiveTextDelta)) {
          await refreshConversation(resolvedConversationId);
        }

        clearFailedSend(retryKey);
        return { ok: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unexpected chat error.";

        if (preparedRetry) {
          const failedMessages = [...preparedRetry.optimisticMessages];
          failedMessages[preparedRetry.assistantIndex] = createFailedAssistantMessage(
            errorMessage,
            retryKey,
            failedSend.failedUserMessageId,
          );

          dispatch({
            type: "REPLACE_ALL",
            messages: failedMessages,
          });
        }

        registerFailedSend(failedSend);
        return { ok: false, error: errorMessage };
      } finally {
        setIsSending(false);
        inFlightRef.current = false;
      }
    },
    [
      clearFailedSend,
      conversationId,
      dispatch,
      getFailedSend,
      memento,
      messages,
      refreshConversation,
      registerFailedSend,
      runStream,
      setIsSending,
    ],
  );

  return {
    activeStreamId,
    retryFailedMessage,
    sendMessage,
    stopStream,
  };
}