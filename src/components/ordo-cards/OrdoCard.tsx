"use client";

import Link from "next/link";

import type { OrdoCard as OrdoCardModel, OrdoCardAction } from "@/lib/ordo-cards/ordo-card-types";
import { formatStableUpdatedAt } from "@/lib/format/stable-date";

const KIND_LABELS: Record<OrdoCardModel["kind"], string> = {
  media_asset: "Media",
  content_item: "Content",
  workflow_run: "Workflow",
  operation: "Work",
  person: "Person",
  offer: "Offer",
  tracked_link: "Link",
  campaign: "Campaign",
  conversation: "Conversation",
  backup: "Backup",
  restore_plan: "Restore",
  system: "System",
};

const KIND_INITIALS: Record<OrdoCardModel["kind"], string> = {
  media_asset: "M",
  content_item: "C",
  workflow_run: "W",
  operation: "O",
  person: "P",
  offer: "O",
  tracked_link: "L",
  campaign: "C",
  conversation: "C",
  backup: "B",
  restore_plan: "R",
  system: "S",
};

function getCopyActionText(action: OrdoCardAction): string | null {
  const text = action.payload?.text;
  return typeof text === "string" && text.length > 0 ? text : null;
}

function dispatchClientAction(action: OrdoCardAction, onAction?: (action: OrdoCardAction) => void): void {
  if (onAction) {
    onAction(action);
    return;
  }

  const copyText = action.actionType === "copy" ? getCopyActionText(action) : null;
  if (copyText && typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(copyText);
  }
}

function statusLabel(status: OrdoCardModel["status"]): string {
  switch (status) {
    case "queued":
      return "waiting";
    case "running":
      return "in motion";
    case "needs_review":
      return "needs review";
    case "failed":
      return "needs recovery";
    case "succeeded":
      return "succeeded";
    default:
      return status.replace(/_/g, " ");
  }
}

function renderAction(action: OrdoCardAction, onAction?: (action: OrdoCardAction) => void) {
  const canCopy = action.actionType === "copy" && Boolean(getCopyActionText(action));
  const canDispatch = Boolean(action.href) || Boolean(onAction) || canCopy;
  const disabled = action.disabled || !canDispatch;
  const disabledReason = action.disabledReason ?? (!canDispatch ? "Action unavailable in this surface" : null);
  const className = action.tone === "destructive"
    ? "inline-flex min-h-9 items-center justify-center rounded-full border border-red-500/28 px-(--space-3) py-(--space-1) text-[0.76rem] font-semibold text-red-700 transition hover:border-red-500/45 focus-ring disabled:cursor-not-allowed disabled:opacity-48"
    : "inline-flex min-h-9 items-center justify-center rounded-full border border-foreground/10 px-(--space-3) py-(--space-1) text-[0.76rem] font-semibold text-foreground/64 transition hover:border-foreground/18 hover:text-foreground focus-ring disabled:cursor-not-allowed disabled:opacity-48";

  if (action.href && !disabled) {
    return (
      <Link key={action.id} href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button
      key={action.id}
      type="button"
      className={className}
      disabled={disabled}
      title={disabledReason ?? undefined}
      onClick={() => dispatchClientAction(action, onAction)}
    >
      {action.label}
    </button>
  );
}

export function OrdoCard({
  card,
  onAction,
}: {
  card: OrdoCardModel;
  onAction?: (action: OrdoCardAction) => void;
}) {
  const primaryAction = card.primaryAction ?? {
    id: "open",
    label: "Open",
    href: card.detailHref,
    tone: "primary" as const,
  };
  const secondaryActions = card.secondaryActions ?? [];
  const visibleMetrics = card.metrics?.slice(0, 4) ?? [];

  return (
    <article
      className="overflow-hidden rounded-lg border border-foreground/10 bg-background shadow-[0_20px_48px_-42px_rgba(15,23,42,0.5)]"
      data-ordo-card={card.id}
      data-ordo-card-kind={card.kind}
      data-ordo-card-bucket={card.bucket}
      data-ordo-card-status={card.status}
    >
      <div className="grid gap-(--space-3) p-(--space-3) sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-(--space-1)">
            <span
              className="inline-flex size-8 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.04] text-[0.7rem] font-semibold text-foreground"
              aria-hidden="true"
            >
              {KIND_INITIALS[card.kind]}
            </span>
            <span className="rounded-full border border-foreground/10 px-(--space-2) py-[0.25rem] text-[0.68rem] font-semibold uppercase text-foreground/58">
              {KIND_LABELS[card.kind]}
            </span>
            <span className="rounded-full border border-foreground/10 px-(--space-2) py-[0.25rem] text-[0.68rem] font-semibold uppercase text-foreground/58">
              {statusLabel(card.status)}
            </span>
          </div>

          <h3 className="mt-(--space-2) text-[1.05rem] font-semibold leading-snug text-foreground">
            <Link href={card.detailHref} className="focus-ring rounded-sm">
              {card.title}
            </Link>
          </h3>
          <p className="mt-(--space-1) text-sm leading-6 text-foreground/68">
            {card.summary}
          </p>
          <p className="mt-(--space-2) text-[0.76rem] text-foreground/46">
            {formatStableUpdatedAt(card.updatedAt)}
          </p>
        </div>

        {card.preview ? (
          <Link
            href={card.preview.href ?? card.detailHref}
            className="flex min-h-24 min-w-36 items-center justify-center rounded-lg border border-foreground/10 bg-foreground/[0.03] px-(--space-3) text-center text-[0.76rem] font-semibold uppercase tracking-[0.14em] text-foreground/52 focus-ring"
            data-ordo-card-preview-kind={card.preview.kind}
            aria-label={card.preview.alt ?? card.preview.label ?? `${KIND_LABELS[card.kind]} preview`}
          >
            {card.preview.label ?? card.preview.kind}
          </Link>
        ) : null}
      </div>

      {visibleMetrics.length > 0 ? (
        <dl className="grid grid-cols-2 gap-px border-t border-foreground/8 bg-foreground/8 sm:grid-cols-4">
          {visibleMetrics.map((metric) => (
            <div key={metric.id} className="bg-background px-(--space-3) py-(--space-2)">
              <dt className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-foreground/42">
                {metric.label}
              </dt>
              <dd className="mt-[0.2rem] truncate text-[0.9rem] font-semibold text-foreground">
                {metric.value}{metric.unit ?? ""}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="flex flex-wrap gap-(--space-2) border-t border-foreground/8 px-(--space-3) py-(--space-3)">
        {renderAction(primaryAction, onAction)}
        {secondaryActions.map((action) => renderAction(action, onAction))}
      </div>
    </article>
  );
}
