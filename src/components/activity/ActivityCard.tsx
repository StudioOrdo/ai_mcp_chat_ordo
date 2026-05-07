import Link from "next/link";
import type { ActivityAction, ActivityItem } from "@/lib/activity";
import { formatStableUpdatedAt } from "@/lib/format/stable-date";

const SOURCE_LABELS: Record<ActivityItem["sourceKind"], string> = {
  job: "Job",
  job_event: "Job event",
  media_workflow: "Workflow",
  operation: "Operation",
  operation_event: "Operation event",
  referral_milestone: "Referral",
  browser_push_delivery: "Push",
  runtime_audit_log: "Diagnostic",
  provider_log: "Provider",
  route_metric: "Route",
  mcp_process_log: "Runtime",
  admin_signal: "Admin",
};

function getActionHref(item: ActivityItem, action: ActivityAction | null): string {
  return action?.href ?? item.href;
}

export function ActivityCard({ item }: { item: ActivityItem }) {
  const primaryHref = getActionHref(item, item.primaryAction);
  const secondaryLinks = item.secondaryActions.filter((action) => action.href);

  return (
    <article
      className="rounded-lg border border-foreground/10 bg-background px-(--space-3) py-(--space-3) shadow-[0_18px_44px_-38px_rgba(15,23,42,0.42)]"
      data-dashboard-activity-card={item.id}
      data-dashboard-source-kind={item.sourceKind}
      data-dashboard-bucket={item.bucket}
    >
      <div className="flex flex-col gap-(--space-2) sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-(--space-1)">
            <span className="rounded-full border border-foreground/10 px-(--space-2) py-[0.25rem] text-[0.68rem] font-semibold uppercase text-foreground/58">
              {SOURCE_LABELS[item.sourceKind]}
            </span>
            <span className="rounded-full border border-foreground/10 px-(--space-2) py-[0.25rem] text-[0.68rem] font-semibold uppercase text-foreground/58">
              {item.statusLabel}
            </span>
          </div>
          <h3 className="mt-(--space-2) text-[1rem] font-semibold leading-snug text-foreground">
            {item.title}
          </h3>
          <p className="mt-(--space-1) text-sm leading-6 text-foreground/68">
            {item.summary}
          </p>
          <p className="mt-(--space-2) text-[0.76rem] text-foreground/46">
            {formatStableUpdatedAt(item.updatedAt)}
          </p>
        </div>

        <Link
          href={primaryHref}
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-foreground/12 bg-foreground px-(--space-3) py-(--space-2) text-[0.78rem] font-semibold text-background transition hover:opacity-85 focus-ring"
        >
          {item.primaryAction?.label ?? "Open"}
        </Link>
      </div>

      {secondaryLinks.length > 0 ? (
        <div className="mt-(--space-3) flex flex-wrap gap-(--space-2)">
          {secondaryLinks.map((action) => (
            <Link
              key={action.id}
              href={action.href ?? item.href}
              className="inline-flex min-h-9 items-center rounded-full border border-foreground/10 px-(--space-3) py-(--space-1) text-[0.76rem] font-semibold text-foreground/64 transition hover:border-foreground/18 hover:text-foreground focus-ring"
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function EmptyActivityState({ title, summary }: { title: string; summary: string }) {
  return (
    <div className="rounded-lg border border-dashed border-foreground/12 bg-foreground/[0.025] px-(--space-3) py-(--space-3)">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-(--space-1) text-sm leading-6 text-foreground/62">{summary}</p>
    </div>
  );
}
