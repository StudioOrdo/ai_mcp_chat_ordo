import Link from "next/link";

import type { OperationsWorkspaceModel } from "@/lib/operations/operation-workspace-loader";
import { OperationCard } from "@/frameworks/ui/operations/OperationCard";

function formatAge(ms: number | null): string {
  if (ms == null) return "none";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function OperationsWorkspace({ workspace }: { workspace: OperationsWorkspaceModel }) {
  return (
    <div className="grid gap-(--space-6)" data-operations-workspace="true">
      <header className="flex flex-wrap items-end justify-between gap-(--space-4)">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Operations</p>
          <h1 className="text-2xl font-semibold text-foreground">Operation Queue</h1>
          <p className="mt-(--space-1) max-w-2xl text-sm text-foreground/62">
            Durable work across backup, restore, media, factory, help, and onboarding flows.
          </p>
        </div>
        <Link className="rounded-md border border-border/70 px-3 py-2 text-sm font-medium hover:bg-surface-muted/60" href="/operations/media">
          Media Operations
        </Link>
      </header>
      <section className="grid gap-(--space-3) sm:grid-cols-2 lg:grid-cols-5" aria-label="Operation summary">
        <SummaryTile label="Active" value={String(workspace.health.totalActiveOperations)} />
        <SummaryTile label="Blocked" value={String(workspace.health.blockedCount)} />
        <SummaryTile label="Failed" value={String(workspace.health.failedCount)} />
        <SummaryTile label="Destructive" value={String(workspace.health.pendingDestructiveActions)} />
        <SummaryTile label="Oldest Active" value={formatAge(workspace.health.oldestActiveOperationAgeMs)} />
      </section>
      <section className="grid gap-(--space-3)" aria-label="Operations list">
        {workspace.cards.length > 0 ? workspace.cards.map((card) => (
          <Link key={card.operationId} href={`/operations/${encodeURIComponent(card.operationId)}`} className="block no-underline">
            <OperationCard operation={card} />
          </Link>
        )) : (
          <div className="rounded-lg border border-dashed border-border/70 p-(--space-6) text-sm text-foreground/58">
            No readable operations match the current filters.
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/76 p-(--space-4)">
      <div className="text-xs uppercase tracking-[0.14em] text-foreground/50">{label}</div>
      <div className="mt-(--space-2) text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}
