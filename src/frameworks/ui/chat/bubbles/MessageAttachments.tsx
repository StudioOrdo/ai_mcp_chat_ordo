import React from "react";
import type { PresentedMessage } from "@/adapters/ChatPresenter";

export const MessageAttachments = React.memo<{
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
