"use client";

import React from "react";

import type { PresentedMessage } from "@/adapters/ChatPresenter";
import type { MentionItem } from "@/core/entities/mentions";

import { ChatInput } from "./ChatInput";
import { MemoizedChatMessageViewport } from "./ChatMessageViewport";
import type { ActionLinkType } from "@/core/entities/rich-content";
import { ToolPluginRegistryProvider } from "./chat/registry/ToolPluginContext";
import { createDefaultToolRegistry } from "./chat/registry/default-tool-registry";
import type { ProductExperienceStateKind } from "./product-experience-facade";
import { ProductExperienceSummary } from "./ProductExperienceSummary";
import type { ProductExperienceSummaryModel } from "./product-experience-summary";
import {
  OperationActionConfirmationDialog,
  type OperationActionConfirmationDialogProps,
} from "@/frameworks/ui/operations/OperationActionConfirmationDialog";

const defaultToolRegistry = createDefaultToolRegistry();

interface ChatContentSurfaceProps {
  activeTrigger: string | null;
  canSend: boolean;
  canStopStream?: boolean;
  dynamicSuggestions: string[];
  input: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  isEmbedded: boolean;
  isFullScreen: boolean;
  isHeroState: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  mentionIndex: number;
  messages: PresentedMessage[];
  onFileDrop: (event: React.DragEvent) => void;
  onFileRemove: (index: number) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onInputChange: (value: string, selectionStart: number) => void;
  onLinkClick: (slug: string) => void;
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
  onMentionIndexChange: (index: number) => void;
  onRetryClick?: (retryKey: string) => void;
  onSend: () => void;
  onSuggestionClick: (text: string) => void;
  onSuggestionSelect: (item: MentionItem) => void;
  onStopStream?: () => void | Promise<unknown>;
  operationConfirmationDialog?: OperationActionConfirmationDialogProps;
  pendingFiles: File[];
  productExperienceState: ProductExperienceStateKind;
  productExperienceSummary: ProductExperienceSummaryModel | null;
  sendError?: string | null;
  scrollDependency: number;
  searchQuery: string;
  suggestions: MentionItem[];
}

export function ChatContentSurface({
  activeTrigger,
  canSend,
  canStopStream,
  dynamicSuggestions,
  input,
  inputRef,
  isEmbedded,
  isFullScreen,
  isHeroState,
  isLoadingMessages,
  isSending,
  mentionIndex,
  messages,
  onFileDrop,
  onFileRemove,
  onFileSelect,
  onInputChange,
  onLinkClick,
  onActionClick,
  onMentionIndexChange,
  onRetryClick,
  onSend,
  onSuggestionClick,
  onSuggestionSelect,
  onStopStream,
  operationConfirmationDialog,
  pendingFiles,
  productExperienceState,
  productExperienceSummary,
  sendError,
  scrollDependency,
  searchQuery,
  suggestions,
}: ChatContentSurfaceProps) {
  return (
    <ToolPluginRegistryProvider registry={defaultToolRegistry}>
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden" data-product-experience-state={productExperienceState}>
        <ProductExperienceSummary
          summary={productExperienceSummary}
          isEmbedded={isEmbedded}
          isFullScreen={isFullScreen}
          onActionClick={onActionClick}
        />

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <MemoizedChatMessageViewport
            dynamicSuggestions={dynamicSuggestions}
            isEmbedded={isEmbedded}
            isHeroState={isHeroState}
            isFullScreen={isFullScreen}
            isLoadingMessages={isLoadingMessages}
            isSending={isSending}
            messages={messages}
            onLinkClick={onLinkClick}
            onActionClick={onActionClick}
            onRetryClick={onRetryClick}
            onSuggestionClick={onSuggestionClick}
            scrollDependency={scrollDependency}
            searchQuery={searchQuery}
          />
        </div>
      </div>

      <div
        className={`ui-chat-composer-plane relative flex-none ${!isEmbedded && isFullScreen ? "safe-area-px safe-area-pb" : ""}`}
        data-chat-composer-row={isEmbedded ? "true" : undefined}
        data-chat-composer-plane={!isEmbedded ? "true" : undefined}
      >
        <div aria-hidden="true" className="ui-chat-composer-seam pointer-events-none absolute inset-x-(--space-16) top-0 h-px" />
        <div className={isFullScreen ? "mx-auto w-full max-w-4xl" : "w-full"} data-chat-composer-shell="true">
          <ChatInput
            inputRef={inputRef}
            maxTextareaHeight={isEmbedded ? 192 : isFullScreen ? 224 : 144}
            canStopStream={canStopStream}
            value={input}
            onChange={onInputChange}
            onSend={onSend}
            isSending={isSending}
            canSend={canSend}
            onStopStream={onStopStream}
            activeTrigger={activeTrigger}
            suggestions={suggestions}
            mentionIndex={mentionIndex}
            onMentionIndexChange={onMentionIndexChange}
            onSuggestionSelect={onSuggestionSelect}
            pendingFiles={pendingFiles}
            onFileSelect={onFileSelect}
            onFileRemove={onFileRemove}
            onFileDrop={onFileDrop}
            sendError={sendError}
          />
        </div>
      </div>
      {operationConfirmationDialog ? (
        <OperationActionConfirmationDialog {...operationConfirmationDialog} />
      ) : null}

    </ToolPluginRegistryProvider>
  );
}
