"use client";

import React from "react";

import type { ActionLinkType } from "@/core/entities/rich-content";

import type {
  ProductExperienceAction,
  ProductExperienceSummaryModel,
} from "./product-experience-summary";

interface ProductExperienceSummaryProps {
  summary: ProductExperienceSummaryModel | null;
  isEmbedded: boolean;
  isFullScreen: boolean;
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
}

function ActionButton({
  action,
  onActionClick,
}: {
  action: ProductExperienceAction | null;
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
}) {
  if (!action || !onActionClick) {
    return null;
  }

  return (
    <button
      type="button"
      className="inline-flex min-h-10 items-center rounded-full border border-foreground/12 bg-background px-(--space-3) py-(--space-2) text-[0.78rem] font-semibold text-foreground transition hover:border-foreground/20 hover:bg-foreground/4 focus-ring"
      onClick={() => onActionClick(action.actionType, action.value, action.params)}
      data-product-experience-action={action.label}
    >
      {action.label}
    </button>
  );
}

function SectionCard({
  eyebrow,
  title,
  body,
  meta,
  action,
  onActionClick,
  children,
}: {
  eyebrow: string;
  title: string;
  body?: string | null;
  meta?: string | null;
  action?: ProductExperienceAction | null;
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.6rem] border border-foreground/8 bg-background/90 px-(--space-4) py-(--space-4) shadow-[0_24px_72px_-48px_rgba(15,23,42,0.42)]" data-product-experience-card={eyebrow.toLowerCase()}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-foreground/46">{eyebrow}</p>
      <h3 className="mt-(--space-2) text-[1rem] font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
      {body ? <p className="mt-(--space-2) text-sm leading-6 text-foreground/72">{body}</p> : null}
      {meta ? <p className="mt-(--space-2) text-[0.78rem] text-foreground/48">{meta}</p> : null}
      {children}
      <div className="mt-(--space-3)">
        <ActionButton action={action ?? null} onActionClick={onActionClick} />
      </div>
    </section>
  );
}

export function ProductExperienceSummary({
  summary,
  isEmbedded,
  isFullScreen,
  onActionClick,
}: ProductExperienceSummaryProps) {
  if (!summary) {
    return null;
  }

  return (
    <div
      className={`mx-auto w-full ${isFullScreen ? "max-w-4xl" : "max-w-5xl"} px-(--space-3) pb-(--space-3) pt-(--space-3) sm:px-(--space-4)`}
      data-product-experience-summary={isEmbedded ? "embedded" : "floating"}
    >
      <section className="rounded-[2rem] border border-foreground/10 bg-background/92 px-(--space-4) py-(--space-4) shadow-[0_32px_110px_-64px_rgba(15,23,42,0.5)] backdrop-blur-sm" data-product-experience-card="current-work">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-foreground/44">Current work</p>
        <div className="mt-(--space-2) flex flex-col gap-(--space-3) md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-[1.35rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[1.5rem]">
              {summary.objective ?? summary.headline}
            </h2>
            {summary.nextStep ? (
              <p className="mt-(--space-2) max-w-2xl text-sm leading-6 text-foreground/72">
                Next: {summary.nextStep}
              </p>
            ) : null}
            {summary.objective && summary.headline !== summary.objective ? (
              <p className="mt-(--space-2) text-[0.8rem] text-foreground/48">
                Workspace: {summary.headline}
              </p>
            ) : null}
          </div>

          {summary.statPills.length > 0 ? (
            <div className="flex flex-wrap gap-(--space-2) md:max-w-sm md:justify-end" data-product-experience-stats="true">
              {summary.statPills.map((pill) => (
                <span
                  key={pill}
                  className="inline-flex min-h-9 items-center rounded-full border border-foreground/10 bg-foreground/3 px-(--space-3) py-(--space-1) text-[0.74rem] font-medium text-foreground/66"
                >
                  {pill}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="mt-(--space-3) grid gap-(--space-3) lg:grid-cols-2" data-product-experience-grid="true">
        {summary.workflow ? (
          <SectionCard
            eyebrow="Workflow"
            title={summary.workflow.modeLabel}
            body={summary.workflow.actionLabel ?? summary.workflow.originLabel ?? "Business workflow context is available for this conversation."}
            meta={summary.workflow.blockerLabel ? `Blocker: ${summary.workflow.blockerLabel}` : summary.workflow.originLabel ? `Return source: ${summary.workflow.originLabel}` : null}
            action={summary.workflow.action}
            onActionClick={onActionClick}
          >
            {summary.workflow.relatedLabels.length > 0 ? (
              <div className="mt-(--space-3) flex flex-wrap gap-(--space-2)" data-product-experience-related="true">
                {summary.workflow.relatedLabels.map((label) => (
                  <span key={label} className="inline-flex rounded-full border border-foreground/8 px-(--space-2) py-[0.32rem] text-[0.72rem] text-foreground/60">
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
          </SectionCard>
        ) : null}

        {summary.transition ? (
          <SectionCard
            eyebrow="Operator motion"
            title={summary.transition.modeLabel ?? "Operator transition"}
            body={summary.transition.actionLabel ?? summary.transition.shareLabel ?? "Transition and trust-distribution context are available."}
            meta={summary.transition.referralCode ? `Referral code: ${summary.transition.referralCode}` : summary.transition.statusLabel}
            action={summary.transition.action}
            onActionClick={onActionClick}
          />
        ) : null}

        {summary.jobs ? (
          <SectionCard
            eyebrow="Current work"
            title={summary.jobs.attentionCount > 0 ? `${summary.jobs.attentionCount} item${summary.jobs.attentionCount === 1 ? "" : "s"} need attention` : `${summary.jobs.activeCount} active job${summary.jobs.activeCount === 1 ? "" : "s"}`}
            body={summary.jobs.attentionCount > 0 ? "These jobs need an explicit next action." : "Background work is still in motion and tracked separately from the transcript."}
            action={summary.jobs.action}
            onActionClick={onActionClick}
          >
            <div className="mt-(--space-3) grid gap-(--space-2)" data-product-experience-jobs="true">
              {summary.jobs.items.map((job) => (
                <div key={job.id} className="rounded-[1.1rem] border border-foreground/8 bg-foreground/3 px-(--space-3) py-(--space-3)">
                  <div className="flex items-start justify-between gap-(--space-2)">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{job.title}</p>
                      {job.summary ? <p className="mt-(--space-1) text-[0.8rem] text-foreground/62">{job.summary}</p> : null}
                    </div>
                    <span className="shrink-0 rounded-full border border-foreground/8 px-(--space-2) py-[0.25rem] text-[0.68rem] text-foreground/58">
                      {job.statusLabel}
                    </span>
                  </div>
                  {job.action ? (
                    <div className="mt-(--space-2)">
                      <ActionButton action={job.action} onActionClick={onActionClick} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </SectionCard>
        ) : null}

        {summary.assets ? (
          <SectionCard
            eyebrow="Reusable assets"
            title={`${summary.assets.count} asset${summary.assets.count === 1 ? "" : "s"} ready to reuse`}
            body="Durable media and generated outputs now live in their own workspace instead of hiding inside transcript cards."
            action={summary.assets.action}
            onActionClick={onActionClick}
          >
            <div className="mt-(--space-3) grid gap-(--space-2)" data-product-experience-assets="true">
              {summary.assets.items.map((asset) => (
                <div key={asset.id} className="rounded-[1.1rem] border border-foreground/8 bg-foreground/3 px-(--space-3) py-(--space-3)">
                  <p className="text-sm font-semibold text-foreground">{asset.title}</p>
                  <p className="mt-(--space-1) text-[0.8rem] text-foreground/62">{asset.subtitle}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        ) : null}

        {summary.memory ? (
          <SectionCard
            eyebrow="Memory-backed next action"
            title={summary.memory.typeLabel}
            body={summary.memory.summary}
            meta={summary.memory.confidenceLabel}
          />
        ) : null}
      </div>
    </div>
  );
}