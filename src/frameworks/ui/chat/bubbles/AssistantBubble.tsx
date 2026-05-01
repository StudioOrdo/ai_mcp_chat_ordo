import Image from "next/image";
import React from "react";
import type { PresentedMessage, MessageAction, ToolRenderEntry } from "@/adapters/ChatPresenter";
import type { ActionLinkType } from "@/core/entities/rich-content";
import { RichContentRenderer } from "../../RichContentRenderer";
import { ToolPluginPartRenderer } from "../ToolPluginPartRenderer";
import { MessageAttachments } from "./MessageAttachments";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MediaGalleryCard } from "../plugins/custom/MediaGalleryCard";
import { MediaWorkflowCard } from "../plugins/custom/MediaWorkflowCard";
import {
  getCreditExhaustionRetryLabel,
  getCreditExhaustionStatusLabel,
  isProviderCreditExhaustionMessage,
} from "@/lib/chat/stream-error-classification";

const ACTION_VALUE_KEY: Record<string, string> = {
  conversation: "id",
  route: "path",
  send: "text",
  corpus: "slug",
  external: "url",
  job: "jobId",
};

export const MessageActionChips: React.FC<{
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

export const MessageToolbar: React.FC<{ rawContent?: string }> = ({ rawContent }) => {
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

export function getGenerationStatusLabel(message: PresentedMessage): string | null {
  if (!message.generationStatus) {
    return null;
  }

  if (message.generationStatus.status === "interrupted" && isProviderCreditExhaustionMessage(message.generationStatus.reason)) {
    return getCreditExhaustionStatusLabel(message.generationStatus.reason);
  }

  return message.generationStatus.status === "stopped"
    ? "Response stopped"
    : "Response interrupted";
}

export interface AssistantBubbleSharedProps {
  message: PresentedMessage;
  isStreaming: boolean;
  onLinkClick: (slug: string) => void;
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
  isInitialGreeting?: boolean;
}

type MediaGalleryEntry = Extract<ToolRenderEntry, { kind: "tool-call" }> & {
  resultEnvelope: NonNullable<Extract<ToolRenderEntry, { kind: "tool-call" }>["resultEnvelope"]>;
};

type GroupedToolRenderEntry =
  | { kind: "single"; key: string; entry: ToolRenderEntry }
  | { kind: "media-gallery"; key: string; entries: MediaGalleryEntry[] };

function isGroupableMediaEntry(entry: ToolRenderEntry): entry is MediaGalleryEntry {
  if (entry.kind !== "tool-call" || !entry.resultEnvelope) {
    return false;
  }

  if (entry.resultEnvelope.cardKind !== "media_render") {
    return false;
  }

  const statusLine = entry.resultEnvelope.summary.statusLine?.toLowerCase();
  if (statusLine === "failed" || statusLine === "canceled") {
    return false;
  }

  return (entry.resultEnvelope.artifacts ?? []).some((artifact) => artifact.kind === "video");
}

function groupToolRenderEntries(entries: ToolRenderEntry[]): GroupedToolRenderEntry[] {
  const grouped: GroupedToolRenderEntry[] = [];
  let mediaBuffer: MediaGalleryEntry[] = [];

  const flushMediaBuffer = () => {
    if (mediaBuffer.length === 0) {
      return;
    }

    if (mediaBuffer.length === 1) {
      const [entry] = mediaBuffer;
      grouped.push({
        kind: "single",
        key: `tool-${entry.name}-${grouped.length}`,
        entry,
      });
    } else {
      const firstArtifactId = mediaBuffer[0]?.resultEnvelope.artifacts?.find((artifact) => artifact.kind === "video")?.assetId ?? grouped.length;
      grouped.push({
        kind: "media-gallery",
        key: `media-gallery-${firstArtifactId}-${mediaBuffer.length}`,
        entries: mediaBuffer,
      });
    }

    mediaBuffer = [];
  };

  for (const entry of entries) {
    if (isGroupableMediaEntry(entry)) {
      mediaBuffer.push(entry);
      continue;
    }

    flushMediaBuffer();
    grouped.push({
      kind: "single",
      key: entry.kind === "job-status"
        ? `job-${entry.part.jobId}-${entry.part.sequence ?? grouped.length}`
        : entry.kind === "workflow-status"
          ? `workflow-${entry.workflow.workflowId}-${grouped.length}`
        : `tool-${entry.name}-${grouped.length}`,
      entry,
    });
  }

  flushMediaBuffer();
  return grouped;
}

export const AssistantBubbleContent: React.FC<AssistantBubbleSharedProps & {
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
}) => {
  const groupedToolRenderEntries = React.useMemo(
    () => groupToolRenderEntries(message.toolRenderEntries ?? []),
    [message.toolRenderEntries],
  );

  return (
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

    {groupedToolRenderEntries.length > 0 && (!isInitialGreeting || !isTyping) && (
      <div className="mt-(--space-stack-tight) flex flex-col gap-(--space-stack-tight) ps-(--space-stack-tight)">
        {groupedToolRenderEntries.map((group) =>
          group.kind === "media-gallery" ? (
            <MediaGalleryCard key={group.key} entries={group.entries} />
          ) : group.entry.kind === "workflow-status" ? (
            <MediaWorkflowCard key={group.key} workflow={group.entry.workflow} />
          ) : group.entry.kind === "job-status" ? (
            <ToolPluginPartRenderer
              key={group.key}
              part={group.entry.part}
              computedActions={group.entry.computedActions}
              descriptor={group.entry.descriptor}
              resultEnvelope={group.entry.resultEnvelope}
              isStreaming={isStreaming}
              onActionClick={onActionClick}
            />
          ) : (
            <ToolPluginPartRenderer
              key={group.key}
              toolCall={group.entry}
              descriptor={group.entry.descriptor}
              resultEnvelope={group.entry.resultEnvelope}
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
};

AssistantBubbleContent.displayName = "AssistantBubbleContent";

export const AssistantBubbleFooter: React.FC<{
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
  const retryLabel = message.failedSend
    ? getCreditExhaustionRetryLabel(message.generationStatus?.reason ?? message.rawContent)
    : "Retry";

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
                {retryLabel}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
};

AssistantBubbleFooter.displayName = "AssistantBubbleFooter";

export const AssistantBubble = React.memo<{
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
  const jobMessageTokens = React.useMemo(() => {
    const jobIds = message.toolRenderEntries
      .filter((entry): entry is Extract<PresentedMessage["toolRenderEntries"][number], { kind: "job-status" }> => entry.kind === "job-status")
      .map((entry) => entry.part.jobId);

    return jobIds.length > 0 ? [...new Set(jobIds)].join(" ") : undefined;
  }, [message.toolRenderEntries]);
  
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
    <div className="group flex w-full items-start justify-start gap-(--space-stack-tight) px-(--space-1) transition-all duration-300 sm:gap-(--space-stack-default) sm:px-(--space-2) md:px-(--space-0)" data-chat-message-role="assistant" data-chat-message-emphasis={isAnchor ? "anchor" : "supporting"} data-chat-message-status={message.status} data-chat-response-state={message.responseState} data-chat-job-message={jobMessageTokens}>
      <div className="mt-(--space-1) flex h-(--chat-avatar-size) w-(--chat-avatar-size) shrink-0 items-center justify-center overflow-hidden rounded-full border border-foreground/6 bg-[color-mix(in_oklab,var(--surface)_90%,transparent)] shadow-[0_10px_24px_-22px_color-mix(in_srgb,var(--shadow-base)_16%,transparent)]">
        <Image src={brandLogoPath} alt="" width={28} height={28} sizes="28px" className="h-7 w-7 object-contain opacity-95" />
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
