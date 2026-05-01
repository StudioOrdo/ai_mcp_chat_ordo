import { useCallback, useEffect, useRef, type RefObject } from "react";

import type { MentionItem } from "@/core/entities/mentions";
import { useMentions } from "@/hooks/useMentions";
import { useCommandRegistry } from "@/hooks/useCommandRegistry";
import { SET_CHAT_COMPOSER_TEXT_EVENT } from "@/lib/chat/chat-events";

import { useChatComposerState } from "./useChatComposerState";

interface UseChatComposerControllerOptions {
  isSending: boolean;
  onSendMessage: (
    messageText: string,
    pendingFiles: File[],
  ) => Promise<{ ok: boolean; error?: string }>;
  onSendError?: (error: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export function useChatComposerController({
  isSending,
  onSendMessage,
  onSendError,
  textareaRef,
}: UseChatComposerControllerOptions) {
  const composer = useChatComposerState(isSending);
  const { executeCommand, findCommands } = useCommandRegistry();
  const mentions = useMentions(textareaRef, { findCommands });
  const cursorRef = useRef(0);

  const setComposerText = useCallback(
    (text: string) => {
      composer.updateInput(text);
      textareaRef.current?.focus();
    },
    [composer, textareaRef],
  );

  useEffect(() => {
    const handleComposerText = (event: Event) => {
      const customEvent = event as CustomEvent<{ text?: string }>;
      setComposerText(customEvent.detail?.text ?? "");
    };

    window.addEventListener(SET_CHAT_COMPOSER_TEXT_EVENT, handleComposerText);
    return () => window.removeEventListener(SET_CHAT_COMPOSER_TEXT_EVENT, handleComposerText);
  }, [setComposerText]);

  const handleInputChange = useCallback(
    (value: string, selectionStart: number) => {
      composer.updateInput(value);
      cursorRef.current = selectionStart;
      mentions.handleInput(value, selectionStart);
      composer.setMentionIndex(0);
    },
    [composer, mentions],
  );

  const handleSuggestionSelect = useCallback(
    (item: MentionItem) => {
      if (mentions.activeTrigger?.char === "/") {
        if (executeCommand(item.id)) {
          composer.clearComposer();
          return;
        }
      }

      const nextText = mentions.insertMention(item, composer.input, cursorRef.current);
      composer.updateInput(nextText);
    },
    [composer, executeCommand, mentions],
  );

  const handleSend = useCallback(async () => {
    if (isSending || !composer.canSend) {
      return;
    }

    const draft = composer.input.trim();
    if (!draft && composer.pendingFiles.length === 0) {
      return;
    }

    const queuedFiles = [...composer.pendingFiles];
    composer.clearComposer();

    try {
      const result = await onSendMessage(draft, queuedFiles);
      if (!result.ok) {
        composer.restoreComposer(draft, queuedFiles);
        if (result.error) onSendError?.(result.error);
      }
    } catch (error) {
      composer.restoreComposer(draft, queuedFiles);
      onSendError?.(error instanceof Error ? error.message : "Failed to send message");
    }
  }, [composer, isSending, onSendMessage, onSendError]);

  return {
    activeTrigger: mentions.activeTrigger,
    canSend: composer.canSend,
    handleFileDrop: composer.handleFileDrop,
    handleFileRemove: composer.handleFileRemove,
    handleFileSelect: composer.handleFileSelect,
    handleInputChange,
    handleSend,
    handleSuggestionSelect,
    input: composer.input,
    setComposerText,
    mentionIndex: composer.mentionIndex,
    pendingFiles: composer.pendingFiles,
    setMentionIndex: composer.setMentionIndex,
    suggestions: mentions.suggestions,
  };
}