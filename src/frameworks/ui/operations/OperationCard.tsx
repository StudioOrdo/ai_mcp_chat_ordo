import type { OperationCardModel, ActionLinkType } from "@/core/entities/rich-content";
import { OperationActionButton } from "@/frameworks/ui/operations/OperationActionButton";

export interface OperationCardProps {
  operation: OperationCardModel;
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
}

export function OperationCard({ operation, onActionClick }: OperationCardProps) {
  return (
    <section
      className="ui-operation-card rounded-xl border border-border/70 bg-background/82 p-(--space-inset-default) shadow-[0_18px_40px_-32px_color-mix(in_srgb,var(--shadow-base)_18%,transparent)]"
      data-operation-card="true"
      data-operation-status={operation.status}
      data-operation-risk={operation.riskLevel}
      aria-label={`${operation.title} operation`}
    >
      <div className="flex flex-wrap items-start justify-between gap-(--space-3)">
        <div className="min-w-0">
          <p className="theme-label tier-micro font-semibold uppercase text-foreground/48">{operation.kind.replaceAll("_", " ")}</p>
          <h3 className="mt-(--space-1) text-base font-semibold leading-6 text-foreground">{operation.title}</h3>
          {operation.summary ? (
            <p className="mt-(--space-2) max-w-2xl text-sm leading-6 text-foreground/68">{operation.summary}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-(--space-2)">
          <span className="rounded-md border px-(--space-2) py-1 text-xs font-semibold capitalize" data-operation-status-tone={operation.statusTone}>
            {operation.statusLabel}
          </span>
          <span className="rounded-md border px-(--space-2) py-1 text-xs font-semibold capitalize">
            {operation.riskLabel}
          </span>
        </div>
      </div>

      <dl className="mt-(--space-4) grid gap-(--space-2) text-xs text-foreground/58 sm:grid-cols-4">
        <div>
          <dt className="font-semibold uppercase tracking-[0.12em]">Operation</dt>
          <dd className="mt-1 font-mono text-[0.72rem] text-foreground/74">{operation.operationId}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-[0.12em]">Progress</dt>
          <dd className="mt-1 text-foreground/74">{operation.progressPercent == null ? "No steps yet" : `${operation.progressPercent}%`}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-[0.12em]">Evidence</dt>
          <dd className="mt-1 text-foreground/74">{operation.artifactCount} artifacts</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-[0.12em]">Latest</dt>
          <dd className="mt-1 text-foreground/74">{operation.latestEventLabel ?? "No events yet"}</dd>
        </div>
      </dl>

      {operation.actions.length > 0 ? (
        <div className="mt-(--space-4) flex flex-wrap gap-(--space-2)" data-operation-card-actions="true">
          {operation.actions.map((action, index) => (
            <OperationActionButton
              key={`${action.value}-${action.params?.actionId ?? action.label}-${index}`}
              action={action}
              onActionClick={onActionClick}
            />
          ))}
        </div>
      ) : (
        <p className="mt-(--space-4) text-xs text-foreground/50">No available actions.</p>
      )}
    </section>
  );
}
