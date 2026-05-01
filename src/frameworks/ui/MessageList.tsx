import Image from "next/image";

import React from "react";
import type { PresentedMessage } from "../../adapters/ChatPresenter";
import type { MessageAction } from "../../adapters/ChatPresenter";
import { RichContentRenderer } from "./RichContentRenderer";
import { ToolPluginPartRenderer } from "./chat/ToolPluginPartRenderer";
import { MediaWorkflowCard } from "./chat/plugins/custom/MediaWorkflowCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { ActionLinkType, BlockNode, InlineNode, RichContent } from "@/core/entities/rich-content";
import { useInstanceIdentity, useInstancePrompts } from "@/lib/config/InstanceConfigContext";
import { DEFAULT_IDENTITY, DEFAULT_PROMPTS } from "@/lib/config/defaults";

interface MessageListProps {
  messages: PresentedMessage[];
  isSending: boolean;
  dynamicSuggestions: string[];
  isHeroState?: boolean;
  isSuggestionDisabled?: boolean;
  onSuggestionClick: (text: string) => void;
  onLinkClick: (slug: string) => void;
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
  onRetryClick?: (retryKey: string) => void;
  searchQuery: string;
  isEmbedded?: boolean;
}

const BrandHeader = ({ isEmbedded = false, serviceChips, heroHeading, heroSubheading }: { isEmbedded?: boolean; serviceChips: readonly string[]; heroHeading: string; heroSubheading: string }) => (
  <div
    className={`mx-auto flex w-full max-w-3xl flex-col items-center justify-center px-(--space-3) text-center animate-in fade-in slide-in-from-top-4 duration-700 ease-out fill-mode-both sm:px-(--space-4) ${isEmbedded ? "pb-(--space-3) space-y-(--space-3)" : "pt-(--phi-1) pb-(--space-3) space-y-(--space-3)"}`}
    data-homepage-chat-intro="true"
  >
    <div className="ui-chat-brand-chip-cluster flex flex-wrap items-center justify-center gap-x-(--hero-badge-gap) gap-y-(--phi-2) rounded-full px-(--hero-badge-padding-inline) py-(--hero-badge-padding-block) text-[0.66rem] font-medium uppercase tracking-[0.18em] text-foreground/56">
      {serviceChips.map((chip, index) => (
        <React.Fragment key={chip}>
          {index > 0 ? (
            <span aria-hidden="true" className="hidden text-foreground/20 sm:inline">
              /
            </span>
          ) : null}
          <span data-homepage-service-chip="true">{chip}</span>
        </React.Fragment>
      ))}
    </div>

    <h2
      className="theme-body text-foreground balance font-semibold"
      style={{
        maxWidth: "var(--hero-title-max-width)",
        fontSize: "var(--hero-title-font-size)",
        lineHeight: "var(--hero-title-line-height)",
        letterSpacing: "var(--tier-display-tracking)",
      }}
    >
      {heroHeading}
    </h2>

    <p
      className="theme-body text-foreground/64"
      style={{
        maxWidth: "var(--hero-greeting-max-width)",
        fontSize: "var(--hero-body-font-size)",
        lineHeight: "var(--hero-body-line-height)",
      }}
    >
      {heroSubheading}
    </p>
  </div>
);

function extractInlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "code-inline":
          return node.text;
        case "bold":
          return extractInlineText(node.content);
        case "library-link":
          return node.slug.replace(/-/g, " ");
        case "action-link":
          return node.label;
        default:
          return "";
      }
    })
    .join(" ");
}

function extractBlockText(block: BlockNode): string {
  switch (block.type) {
    case "paragraph":
    case "heading":
    case "blockquote":
      return extractInlineText(block.content);
    case "list":
      return block.items.map((item) => extractInlineText(item)).join(" ");
    case "table":
      return [
        ...(block.header ?? []).map((cell) => extractInlineText(cell)),
        ...block.rows.flat().map((cell) => extractInlineText(cell)),
      ].join(" ");
    case "audio":
      return `${block.title} ${block.text}`;
    case "operator-brief":
      return block.sections
        .map((section) => `${section.label} ${extractInlineText(section.summary)} ${(section.items ?? []).map((item) => extractInlineText(item)).join(" ")}`)
        .join(" ");
    case "job-status":
      return `${block.label} ${block.status} ${block.progressLabel ?? ""} ${block.summary ?? ""} ${block.error ?? ""} ${(block.actions ?? []).map((action) => extractInlineText([action])).join(" ")}`.trim();
    case "code-block":
      return block.code;
    case "divider":
      return "";
    default:
      return "";
  }
}

function extractRichContentText(content: RichContent): string {
  return content.blocks.map((block) => extractBlockText(block)).join(" ").trim();
}

const searchableMessageTextCache = new WeakMap<PresentedMessage, string>();

function getSearchableMessageText(message: PresentedMessage): string {
  const cached = searchableMessageTextCache.get(message);
  if (cached) {
    return cached;
  }

  const searchableText = `${message.rawContent} ${extractRichContentText(message.content)}`.toLowerCase();
  searchableMessageTextCache.set(message, searchableText);
  return searchableText;
}

function getLastAssistantMessageId(messages: PresentedMessage[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") {
      return messages[index]?.id;
    }
  }

  return undefined;
}

function isOpenSuggestionSurface(message: PresentedMessage | undefined): boolean {
  if (!message || message.role !== "assistant") {
    return false;
  }

  if (message.responseState) {
    return message.responseState === "open";
  }

  return message.suggestions.length > 0;
}

export const MessageList: React.FC<MessageListProps> = React.memo(({
  messages,
  isSending,
  dynamicSuggestions,
  isHeroState = false,
  isSuggestionDisabled = false,
  onSuggestionClick,
  onLinkClick,
  onActionClick,
  onRetryClick,
  searchQuery,
  isEmbedded = false,
}) => {
  const identity = useInstanceIdentity();
  const instancePrompts = useInstancePrompts();
  const serviceChips = identity.serviceChips ?? DEFAULT_IDENTITY.serviceChips ?? [];
  const heroHeading = instancePrompts.heroHeading ?? DEFAULT_PROMPTS.heroHeading ?? "";
  const heroSubheading = instancePrompts.heroSubheading ?? DEFAULT_PROMPTS.heroSubheading ?? "";
  const normalizedQuery = React.useMemo(
    () => searchQuery.trim().toLowerCase(),
    [searchQuery],
  );
  const filteredMessages = React.useMemo(() => {
    if (!normalizedQuery) {
      return messages;
    }

    return messages.filter((message) =>
      getSearchableMessageText(message).includes(normalizedQuery),
    );
  }, [messages, normalizedQuery]);
  const hideHeroTranscript = React.useMemo(
    () =>
      isHeroState &&
      !searchQuery &&
      filteredMessages.length === 1 &&
      filteredMessages[0]?.role === "assistant",
    [filteredMessages, isHeroState, searchQuery],
  );
  const renderedMessages = React.useMemo(
    () => (hideHeroTranscript ? [] : filteredMessages),
    [filteredMessages, hideHeroTranscript],
  );

  const firstMessageId = messages[0]?.id;
  const lastMessageId = messages[messages.length - 1]?.id;
  const lastVisibleMessageId = renderedMessages[renderedMessages.length - 1]?.id;
  const lastAssistantMessageId = React.useMemo(
    () => getLastAssistantMessageId(messages),
    [messages],
  );
  const lastAssistantMessage = React.useMemo(
    () => messages.find((message) => message.id === lastAssistantMessageId),
    [lastAssistantMessageId, messages],
  );
  const hasVisibleSuggestionChips = React.useMemo(
    () =>
      !isSending &&
      isOpenSuggestionSurface(lastAssistantMessage) &&
      dynamicSuggestions.length > 0 &&
      lastAssistantMessageId != null &&
      lastAssistantMessageId === lastVisibleMessageId,
    [dynamicSuggestions.length, isSending, lastAssistantMessage, lastAssistantMessageId, lastVisibleMessageId],
  );

  if (filteredMessages.length === 0 && searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-(--space-16) text-center opacity-40">
        <p className="text-sm font-medium">
          No messages found matching &ldquo;{searchQuery}&rdquo;
        </p>
      </div>
    );
  }

  return (
    <div
      className="ui-chat-message-stack mx-auto flex w-full max-w-176 flex-col"
      data-message-list-mode={isEmbedded ? "embedded" : "floating"}
      data-message-list-state={isHeroState ? "hero" : "conversation"}
      data-chat-suggestion-tail={hasVisibleSuggestionChips ? "present" : "absent"}
      data-chat-fold-buffer={isEmbedded ? "true" : undefined}
    >
      {isHeroState && !searchQuery && <BrandHeader isEmbedded={isEmbedded} serviceChips={serviceChips} heroHeading={heroHeading} heroSubheading={heroSubheading} />}

      {renderedMessages.map((message) => (
        <div key={message.id} className="flex flex-col gap-(--space-stack-tight) animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both">
          {message.role === "user" ? (
            <UserBubble content={message} />
          ) : (
            <AssistantBubble
              message={message}
              isStreaming={isSending && message.id === lastMessageId}
              onLinkClick={onLinkClick}
              onActionClick={onActionClick}
              onRetryClick={onRetryClick}
              isInitialGreeting={message.id === firstMessageId}
              isAnchor={message.id === lastAssistantMessageId && !isHeroState}
              brandName={identity.name}
              brandLogoPath={identity.logoPath}
            />
          )}

          {message.role === "assistant" &&
            !isSending &&
            isOpenSuggestionSurface(message) &&
            message.id === lastAssistantMessageId &&
            message.id === lastVisibleMessageId &&
            dynamicSuggestions.length > 0 && (
              <div className={`ui-chat-suggestion-band-entry ${isHeroState ? "mt-(--space-stack-tight) flex justify-center pb-(--space-1)" : "ui-chat-suggestion-band-promoted mt-(--space-stack-tight) pb-(--space-1)"} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
                <SuggestionChips
                  suggestions={dynamicSuggestions}
                  onSend={onSuggestionClick}
                  disabled={isSuggestionDisabled}
                  centered={isHeroState}
                />
              </div>
            )}
        </div>
      ))}

      {hideHeroTranscript && isOpenSuggestionSurface(messages[0]) && dynamicSuggestions.length > 0 && (
        <div className="ui-chat-suggestion-band-entry mt-(--space-stack-tight) flex justify-center pb-(--space-1) animate-in fade-in slide-in-from-bottom-2 duration-500">
          <SuggestionChips
            suggestions={dynamicSuggestions}
            onSend={onSuggestionClick}
            disabled={isSuggestionDisabled}
            centered
            label={undefined}
          />
        </div>
      )}

      {isSending && !hideHeroTranscript && lastVisibleMessageId === lastMessageId && messages[messages.length - 1]?.role === "user" && (
        <TypingIndicator />
      )}
    </div>
  );
});

MessageList.displayName = "MessageList";

const UserBubble = React.memo<{ content: PresentedMessage }>(({ content }) => {
  return (
    <div className="flex w-full flex-col items-end gap-(--chat-message-meta-gap) px-(--space-1) sm:px-(--space-2) md:px-(--space-0)" data-chat-message-role="user" data-chat-message-emphasis="supporting" data-chat-message-status={content.status}>
      <div className="theme-label tier-micro pe-(--space-inset-default) font-medium text-foreground/48" data-chat-message-meta="true">
        <span>You</span>
        {content.timestamp ? <span className="ms-(--space-2) tabular-nums text-foreground/36">{content.timestamp}</span> : null}
      </div>
      <div className="ui-chat-message-user relative theme-body tier-body max-w-[92%] rounded-[calc(var(--chat-suggestion-frame-radius)-var(--space-2))] rounded-br-[calc(var(--space-6)+var(--space-2))] rounded-tr-[calc(var(--space-6)+var(--space-1))] px-(--space-inset-default) py-(--space-inset-compact) sm:max-w-[74%]" data-chat-bubble-surface="true">
        <ErrorBoundary name="UserBubble">
          <RichContentRenderer content={content.content} />
          <MessageAttachments attachments={content.attachments} rawContent={content.rawContent} />
        </ErrorBoundary>
      </div>
    </div>
  );
});

UserBubble.displayName = "UserBubble";

const MessageAttachments = React.memo<{
  attachments: PresentedMessage["attachments"];
  rawContent?: string;
}>(({ attachments, rawContent }) => {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={`${rawContent ? "mt-(--space-3)" : ""} flex flex-col gap-(--space-2)`}>
      {attachments.map((attachment) => (
        attachment.kind === "imported" ? (
          <div
            key={`${attachment.fileName}-${attachment.availability}-${attachment.originalAssetId ?? "imported"}`}
            className="ui-chat-attachment-card rounded-2xl border border-foreground/10 px-(--space-inset-compact) py-(--space-2)"
            data-chat-imported-attachment={attachment.availability}
          >
            <div className="flex items-center justify-between gap-(--space-inset-compact)">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/56">
                  Imported attachment
                </span>
                <span className="block truncate text-sm font-medium normal-case tracking-normal text-foreground">
                  {attachment.fileName}
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-foreground/64">
                {Math.max(1, Math.round(attachment.fileSize / 1024))} KB
              </span>
            </div>
            <p className="mt-(--space-2) text-[0.78rem] leading-relaxed text-foreground/60">
              {attachment.note}
            </p>
          </div>
        ) : (
          <a
            key={attachment.assetId}
            href={`/api/user-files/${attachment.assetId}`}
            target="_blank"
            rel="noreferrer"
            className="ui-chat-attachment-card flex items-center justify-between gap-(--space-inset-compact) rounded-2xl px-(--space-inset-compact) py-(--space-2) text-left transition-colors hover:bg-background"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/56">
                Attachment
              </span>
              <span className="block truncate text-sm font-medium normal-case tracking-normal text-foreground">
                {attachment.fileName}
              </span>
              {(attachment.assetKind || typeof attachment.durationSeconds === "number" || (typeof attachment.width === "number" && typeof attachment.height === "number")) ? (
                <span className="block truncate text-[11px] text-foreground/56">
                  {[
                    attachment.assetKind,
                    typeof attachment.durationSeconds === "number" ? `${Math.round(attachment.durationSeconds)}s` : null,
                    typeof attachment.width === "number" && typeof attachment.height === "number"
                      ? `${attachment.width}x${attachment.height}`
                      : null,
                  ].filter(Boolean).join(" · ")}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-[11px] text-foreground/64">
              {Math.max(1, Math.round(attachment.fileSize / 1024))} KB
            </span>
          </a>
        )
      ))}
    </div>
  );
});

MessageAttachments.displayName = "MessageAttachments";

function getGenerationStatusLabel(message: PresentedMessage): string | null {
  if (!message.generationStatus) {
    return null;
  }

  return message.generationStatus.status === "stopped"
    ? "Response stopped"
    : "Response interrupted";
}

interface AssistantBubbleSharedProps {
  message: PresentedMessage;
  isStreaming: boolean;
  onLinkClick: (slug: string) => void;
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
  isInitialGreeting?: boolean;
}

const AssistantBubbleContent: React.FC<AssistantBubbleSharedProps & {
  displayText: string;
  isTyping: boolean;
}> = ({
  message,
  isStreaming,
  onLinkClick,
  onActionClick,
  isInitialGreeting,
  displayText,
  isTyping,
}) => (
  <>
    <ErrorBoundary name="AssistantBubble">
      {isInitialGreeting ? (
        <div className="relative ps-(--space-stack-tight)">
          <div className="invisible pointer-events-none" aria-hidden="true">
            <RichContentRenderer content={message.content} />
          </div>
          <div className="absolute inset-x-0 top-0">
            {isTyping ? (
              <div className="inline whitespace-pre-wrap">
                {displayText}
                <span className="inline-block w-1.5 h-4 ms-1 bg-accent animate-pulse align-middle" />
              </div>
            ) : (
              <div className="animate-in fade-in duration-500">
                <RichContentRenderer content={message.content} onLinkClick={onLinkClick} onActionClick={onActionClick} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="ps-(--space-stack-tight)">
          <RichContentRenderer
            content={message.content}
            onLinkClick={onLinkClick}
            onActionClick={onActionClick}
          />
        </div>
      )}
    </ErrorBoundary>

    {(message.toolRenderEntries?.length ?? 0) > 0 && (!isInitialGreeting || !isTyping) && (
      <div className="mt-(--space-stack-tight) flex flex-col gap-(--space-stack-tight) ps-(--space-stack-tight)">
        {message.toolRenderEntries?.map((entry, idx) =>
          entry.kind === "job-status" ? (
            <ToolPluginPartRenderer
              key={`job-${entry.part.jobId}-${idx}`}
              part={entry.part}
              computedActions={entry.computedActions}
              descriptor={entry.descriptor}
              resultEnvelope={entry.resultEnvelope}
              isStreaming={isStreaming}
              onActionClick={onActionClick}
            />
          ) : entry.kind === "workflow-status" ? (
            <MediaWorkflowCard key={`workflow-${entry.workflow.workflowId}-${idx}`} workflow={entry.workflow} />
          ) : (
            <ToolPluginPartRenderer
              key={`tool-${entry.name}-${idx}`}
              toolCall={entry}
              descriptor={entry.descriptor}
              resultEnvelope={entry.resultEnvelope}
              isStreaming={isStreaming}
              onActionClick={onActionClick}
            />
          ),
        )}
      </div>
    )}

    {(!isInitialGreeting || !isTyping) && (
      <MessageAttachments attachments={message.attachments} rawContent={message.rawContent} />
    )}

    {isStreaming && !isInitialGreeting && (
      <span className="inline-block w-(--space-1) h-(--space-4) bg-accent animate-pulse align-middle ms-(--space-1) rounded-sm relative" />
    )}
  </>
);

AssistantBubbleContent.displayName = "AssistantBubbleContent";

const AssistantBubbleFooter: React.FC<{
  message: PresentedMessage;
  generationStatusLabel: string | null;
  isStreaming: boolean;
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
  onRetryClick?: (retryKey: string) => void;
}> = ({
  message,
  generationStatusLabel,
  isStreaming,
  onActionClick,
  onRetryClick,
}) => {
  const hasStatusFooter = Boolean(generationStatusLabel || message.failedSend);

  return (
    <>
      {message.actions.length > 0 && (
        <div className="mt-(--space-3) border-t border-border/40 pt-(--space-3)">
          <MessageActionChips
            actions={message.actions}
            onActionClick={onActionClick}
            disabled={isStreaming}
          />
        </div>
      )}

      {hasStatusFooter && (
        <div className="mt-(--space-3) border-t border-border/40 pt-(--space-3)">
          {generationStatusLabel ? (
            <div
              className="flex flex-wrap items-center gap-(--space-2) text-[0.8rem] text-foreground/68"
              data-chat-generation-status={message.generationStatus?.status}
            >
              <span
                className="ui-chat-action-chip inline-flex items-center rounded-full px-(--space-inset-compact) py-(--space-1) font-semibold"
                aria-live="polite"
              >
                {generationStatusLabel}
              </span>
              {message.generationStatus?.reason ? (
                <span className="text-[0.78rem] text-foreground/52">{message.generationStatus.reason}</span>
              ) : null}
            </div>
          ) : null}

          {message.failedSend ? (
            <div className={generationStatusLabel ? "mt-(--space-3)" : undefined}>
              <button
                type="button"
                disabled={isStreaming}
                onClick={() => {
                  if (!message.failedSend) {
                    return;
                  }
                  onRetryClick?.(message.failedSend.retryKey);
                }}
                className={`ui-chat-action-chip inline-flex items-center gap-(--space-2) rounded-full px-(--space-inset-compact) py-(--space-1) text-[0.8rem] font-semibold transition-colors focus-ring ${isStreaming ? "cursor-wait opacity-55" : "hover:bg-accent-interactive/14 hover:border-accent-interactive/30 active:scale-[0.98]"}`}
                data-chat-retry-key={message.failedSend.retryKey}
              >
                Retry
              </button>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
};

AssistantBubbleFooter.displayName = "AssistantBubbleFooter";

const AssistantBubble = React.memo<{
  message: PresentedMessage;
  isStreaming: boolean;
  onLinkClick: (slug: string) => void;
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
  onRetryClick?: (retryKey: string) => void;
  isInitialGreeting?: boolean;
  isAnchor?: boolean;
  brandName: string;
  brandLogoPath: string;
}>(({ message, isStreaming, onLinkClick, onActionClick, onRetryClick, isInitialGreeting, isAnchor = false, brandName, brandLogoPath }) => {
  const [displayText, setDisplayText] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(!!isInitialGreeting);
  const generationStatusLabel = getGenerationStatusLabel(message);
  
  React.useEffect(() => {
    if (!isInitialGreeting) return;
    const fullText = message.rawContent || "";
    let charIndex = 0;
    let frameId: number;

    function step() {
      charIndex += 2;
      const end = Math.min(charIndex, fullText.length);
      setDisplayText(fullText.slice(0, end));
      if (end >= fullText.length) {
        setIsTyping(false);
      } else {
        frameId = requestAnimationFrame(step);
      }
    }

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [message.rawContent, isInitialGreeting]);

  return (
    <div className="group flex w-full items-start justify-start gap-(--space-stack-tight) px-(--space-1) transition-all duration-300 sm:gap-(--space-stack-default) sm:px-(--space-2) md:px-(--space-0)" data-chat-message-role="assistant" data-chat-message-emphasis={isAnchor ? "anchor" : "supporting"} data-chat-message-status={message.status} data-chat-response-state={message.responseState}>
      <div className="mt-(--space-1) flex h-(--chat-avatar-size) w-(--chat-avatar-size) shrink-0 items-center justify-center overflow-hidden rounded-full shadow-[0_8px_20px_-20px_color-mix(in_srgb,var(--shadow-base)_8%,transparent)]">
        <Image src={brandLogoPath} alt="" width={32} height={32} className="object-cover" style={{ width: "100%", height: "100%" }} />
      </div>

      <div className={`flex w-full max-w-[95%] flex-col gap-(--space-stack-tight) sm:max-w-[86%] ${isInitialGreeting ? "pt-(--space-1)" : ""}`}>
        <div className="flex items-center gap-(--space-2) ps-(--space-2)" data-chat-message-meta="true">
          <span className="theme-label tier-micro font-medium text-foreground/48">
            {brandName}
          </span>
          {message.timestamp ? (
            <span className="theme-label tier-micro font-medium tabular-nums text-foreground/36">
              {message.timestamp}
            </span>
          ) : null}
        </div>
        <div className="ui-chat-message-assistant theme-body tier-body relative overflow-hidden rounded-[calc(var(--chat-suggestion-frame-radius)-var(--space-2))] rounded-bl-[calc(var(--space-6)+var(--space-2))] rounded-tl-[calc(var(--space-6)+var(--space-1))] px-(--space-inset-default) py-(--chat-bubble-padding-block-prominent)" data-chat-bubble-surface="true">
          <div className="ui-chat-inline-rail pointer-events-none absolute inset-y-[calc(var(--space-inset-compact)+var(--space-1))] left-(--space-inset-default) w-0.5 rounded-full" aria-hidden="true" />
          <AssistantBubbleContent
            message={message}
            isStreaming={isStreaming}
            onLinkClick={onLinkClick}
            onActionClick={onActionClick}
            isInitialGreeting={isInitialGreeting}
            displayText={displayText}
            isTyping={isTyping}
          />

          <AssistantBubbleFooter
            message={message}
            generationStatusLabel={generationStatusLabel}
            isStreaming={isStreaming}
            onActionClick={onActionClick}
            onRetryClick={onRetryClick}
          />
        </div>

        {!isStreaming && !isInitialGreeting && (
          <MessageToolbar rawContent={message.rawContent} />
        )}
      </div>
    </div>
  );
});

AssistantBubble.displayName = "AssistantBubble";

const MessageToolbar: React.FC<{ rawContent?: string }> = ({ rawContent }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    const text = rawContent ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [rawContent]);

  return (
    <div
      className="ui-chat-message-toolbar flex items-center gap-(--space-1) ps-(--space-2) pt-(--space-1) opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100"
      role="toolbar"
      aria-label="Message tools"
      data-chat-message-toolbar="true"
    >
      <button
        type="button"
        onClick={handleCopy}
        className="ui-chat-toolbar-button inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/40 transition-colors hover:bg-foreground/6 hover:text-foreground/70 focus-ring active:scale-95"
        aria-label={copied ? "Copied" : "Copy message"}
        data-chat-toolbar-action="copy"
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
        )}
      </button>
    </div>
  );
};

const ACTION_VALUE_KEY: Record<string, string> = {
  conversation: "id",
  route: "path",
  send: "text",
  corpus: "slug",
  external: "url",
  job: "jobId",
};

const MessageActionChips: React.FC<{
  actions: MessageAction[];
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
  disabled?: boolean;
}> = ({ actions, onActionClick, disabled = false }) => {
  const displayed = actions.slice(0, 3);
  return (
    <div role="group" aria-label="Message actions" className="flex flex-wrap gap-(--space-2)" data-chat-action-chips="true">
      {displayed.map((action, i) => {
        const primaryValue = action.params[ACTION_VALUE_KEY[action.action] ?? ""] ?? "";
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onActionClick?.(action.action, primaryValue, action.params)}
            className={`ui-chat-action-chip inline-flex items-center gap-(--space-2) rounded-full px-(--space-inset-compact) py-(--space-1) text-[0.8rem] font-semibold transition-colors focus-ring ${disabled ? "cursor-wait opacity-55" : "hover:bg-accent-interactive/14 hover:border-accent-interactive/30 active:scale-[0.98]"}`}
            data-chat-action-chip={action.action}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
};

const TypingIndicator = () => (
  <div className="ui-chat-typing-indicator mt-(--space-stack-tight) flex items-center justify-start gap-(--space-cluster-default) ms-(--chat-message-indent)">
    <div className="flex items-center gap-(--space-2) px-(--space-inset-compact) py-(--space-2)">
      <span className="w-(--space-2) h-(--space-2) rounded-full bg-accent opacity-60 animate-bounce [animation-delay:0ms]" />
      <span className="w-(--space-2) h-(--space-2) rounded-full bg-accent opacity-60 animate-bounce [animation-delay:120ms]" />
      <span className="w-(--space-2) h-(--space-2) rounded-full bg-accent opacity-60 animate-bounce [animation-delay:240ms]" />
    </div>
  </div>
);

const SuggestionChips: React.FC<{
  suggestions: string[];
  onSend: (text: string) => void;
  disabled?: boolean;
  centered?: boolean;
  label?: string;
}> = ({ suggestions, onSend, disabled = false, centered = false, label }) => (
      <div className={`flex flex-col ${centered ? "gap-(--hero-suggestion-stack-gap) items-center" : "gap-(--space-stack-tight) items-start"}`}>
    {label ? (
      <p className={`theme-label tier-micro font-medium text-foreground/20 ${centered ? "text-center" : "ps-(--space-stack-tight)"}`}>
        {label}
      </p>
    ) : null}
    <div
      className={centered
        ? "ui-chat-hero-suggestion-frame w-full rounded-(--hero-suggestion-frame-radius) max-w-(--hero-suggestion-max-width)"
        : "ui-chat-followup-frame w-full max-w-[min(38rem,100%)] rounded-[1.45rem]"
      }
      data-chat-suggestion-group={centered ? "hero" : "followup"}
      data-chat-suggestion-priority={centered ? "balanced" : "promoted"}
    >
      <div
        className={`flex flex-wrap ${centered ? "gap-x-(--hero-chip-cluster-gap) gap-y-(--hero-suggestion-row-gap) justify-center" : "gap-x-(--space-stack-tight) gap-y-(--space-stack-tight) justify-start"}`}
        data-chat-suggestion-list={centered ? "hero" : "followup"}
      >
      {suggestions.map((s, i) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onSend(s)}
          style={{ animationDelay: `${i * 100}ms` }}
          data-chat-suggestion-rank={centered ? "neutral" : i === 0 ? "primary" : "secondary"}
          className={centered
            ? `ui-chat-hero-chip group theme-body relative inline-flex min-h-(--hero-suggestion-chip-height) items-center justify-center gap-(--space-2) rounded-full px-(--hero-suggestion-chip-padding-inline) py-(--hero-suggestion-chip-padding-block) text-[0.88rem] font-medium tracking-[-0.018em] transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 fill-mode-both focus-ring ${disabled ? "cursor-wait opacity-55" : "hover:border-foreground/10 hover:bg-background hover:text-foreground active:scale-[0.995]"}`
            : `ui-chat-followup-chip group theme-body relative inline-flex min-h-(--chat-followup-chip-height) items-center justify-center gap-(--space-2) rounded-full px-(--chat-followup-chip-padding-inline) py-(--chat-followup-chip-padding-block) text-[0.8rem] font-semibold tracking-[-0.012em] transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 fill-mode-both focus-ring ${disabled ? "cursor-wait opacity-55" : "hover:border-foreground/14 hover:text-foreground hover:shadow-[0_14px_24px_-18px_color-mix(in_srgb,var(--shadow-base)_28%,transparent)] active:scale-[0.99]"}`}
        >
          <span className="relative">{s}</span>
        </button>
      ))}
      </div>
    </div>
  </div>
);
