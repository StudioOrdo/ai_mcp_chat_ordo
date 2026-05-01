import { useMemo, useRef } from "react";

import { ChatPresenter, type PresentedMessage } from "@/adapters/ChatPresenter";
import { CommandParserService } from "@/adapters/CommandParserService";
import { MarkdownParserService } from "@/adapters/MarkdownParserService";
import type { ChatMessage } from "@/core/entities/chat-message";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";

interface PresentedChatMessagesResult {
  presentedMessages: PresentedMessage[];
  dynamicSuggestions: string[];
  scrollDependency: number;
}

export function usePresentedChatMessages(
  messages: ChatMessage[],
  isSending = false,
  jobSnapshots: readonly CanonicalJobSnapshot[] = [],
  workflowSnapshots: readonly CanonicalMediaWorkflowSnapshot[] = [],
): PresentedChatMessagesResult {
  const markdownParser = useMemo(() => new MarkdownParserService(), []);
  const commandParser = useMemo(() => new CommandParserService(), []);
  const presenter = useMemo(
    () => new ChatPresenter(markdownParser, commandParser),
    [commandParser, markdownParser],
  );

  const presentedMessages = useMemo(() => {
    const presented = presenter.presentMany(messages, jobSnapshots, workflowSnapshots);

    // Mark the last user message as pending while sending
    if (isSending) {
      for (let i = presented.length - 1; i >= 0; i--) {
        if (presented[i]?.role === "user") {
          presented[i] = { ...presented[i], status: "pending" };
          break;
        }
      }
    }

    // Mark user messages as failed when the following assistant has failedSend
    for (let i = 0; i < presented.length; i++) {
      const msg = presented[i];
      if (msg?.role === "assistant" && msg.failedSend) {
        const userId = msg.failedSend.failedUserMessageId;
        const userIdx = presented.findIndex((m) => m.id === userId);
        if (userIdx >= 0 && presented[userIdx]) {
          presented[userIdx] = { ...presented[userIdx], status: "failed" };
        }
      }
    }

    return presented;
  }, [messages, jobSnapshots, workflowSnapshots, presenter, isSending]);

  const dynamicSuggestions = useMemo(() => {
    const lastMsg = presentedMessages[presentedMessages.length - 1];
    return lastMsg?.role === "assistant" && lastMsg.responseState === "open" && lastMsg.suggestions
      ? lastMsg.suggestions
      : [];
  }, [presentedMessages]);

  const scrollEpochRef = useRef(0);
  const scrollDependency = useMemo(() => {
    scrollEpochRef.current += 1;
    return scrollEpochRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: counter increments when deps change
  }, [presentedMessages, dynamicSuggestions]);

  return {
    presentedMessages,
    dynamicSuggestions,
    scrollDependency,
  };
}
