import React from "react";
import type { PresentedMessage } from "@/adapters/ChatPresenter";
import { RichContentRenderer } from "../../RichContentRenderer";
import { MessageAttachments } from "./MessageAttachments";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const UserBubble = React.memo<{ content: PresentedMessage }>(({ content }) => {
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
