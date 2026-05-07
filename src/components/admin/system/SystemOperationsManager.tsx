import Link from "next/link";

import type { OperationsWorkspaceModel } from "@/lib/operations/operation-workspace-loader";
import { OperationCard } from "@/frameworks/ui/operations/OperationCard";

export function SystemOperationsManager({ workspace }: { workspace: OperationsWorkspaceModel }) {
  const destructive = workspace.cards.filter((card) => card.riskLevel === "destructive" || card.riskLevel === "high");

  return (
    <div className="grid gap-(--space-5)" data-admin-system-operations="true">
      <section className="grid gap-(--space-3) sm:grid-cols-2 lg:grid-cols-4" aria-label="System operation health">
        <Metric label="Active" value={workspace.health.totalActiveOperations} />
        <Metric label="Blocked" value={workspace.health.blockedCount} />
        <Metric label="Failed" value={workspace.health.failedCount} />
        <Metric label="Pending destructive" value={workspace.health.pendingDestructiveActions} />
      </section>
      <nav className="flex flex-wrap gap-(--space-2)" aria-label="Related system controls">
        <SystemLink href="/admin/system/backups" label="Backups" />
        <SystemLink href="/admin/system/keys" label="Providers" />
        <SystemLink href="/admin/system/tools" label="Tools" />
        <SystemLink href="/admin/system" label="System Health" />
      </nav>
      {destructive.length > 0 ? (
        <section className="grid gap-(--space-3)" aria-label="High risk operations">
          <h2 className="text-lg font-semibold text-foreground">High-risk operations</h2>
          {destructive.map((card) => (
            <Link key={card.operationId} href={`/operations/${encodeURIComponent(card.operationId)}`} className="block no-underline">
              <OperationCard operation={card} />
            </Link>
          ))}
        </section>
      ) : null}
      <section className="grid gap-(--space-3)" aria-label="All system operations">
        <h2 className="text-lg font-semibold text-foreground">Recent operations</h2>
        {workspace.cards.length > 0 ? workspace.cards.map((card) => (
          <Link key={card.operationId} href={`/operations/${encodeURIComponent(card.operationId)}`} className="block no-underline">
            <OperationCard operation={card} />
          </Link>
        )) : (
          <p className="rounded-md border border-dashed border-border/60 p-(--space-4) text-sm text-foreground/55">
            No system operations have been recorded yet.
          </p>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/76 p-(--space-4)">
      <div className="text-xs uppercase tracking-[0.14em] text-foreground/50">{label}</div>
      <div className="mt-(--space-2) text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function SystemLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="rounded-md border border-border/70 px-3 py-2 text-sm font-medium hover:bg-surface-muted/60" href={href}>
      {label}
    </Link>
  );
}
