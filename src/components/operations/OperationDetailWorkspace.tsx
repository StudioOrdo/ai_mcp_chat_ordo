import Link from "next/link";

import type { OperationDetailWorkspaceModel } from "@/lib/operations/operation-workspace-loader";
import { OperationCard } from "@/frameworks/ui/operations/OperationCard";
import { OperationTimeline } from "@/frameworks/ui/operations/OperationTimeline";

export function OperationDetailWorkspace({ detail }: { detail: OperationDetailWorkspaceModel }) {
  return (
    <div className="grid gap-(--space-6)" data-operation-detail-workspace="true">
      <header className="flex flex-wrap items-center justify-between gap-(--space-3)">
        <div>
          <Link className="text-sm text-accent-interactive hover:underline" href="/operations">Back to operations</Link>
          <h1 className="mt-(--space-2) text-2xl font-semibold text-foreground">{detail.snapshot.operation.title}</h1>
          <p className="text-sm text-foreground/58">{detail.snapshot.operation.id}</p>
        </div>
      </header>
      <OperationCard operation={detail.card} />
      <section className="grid gap-(--space-3)" aria-label="Operation artifacts">
        <h2 className="text-lg font-semibold text-foreground">Artifacts</h2>
        {detail.artifacts.length > 0 ? (
          <ul className="grid gap-(--space-2)">
            {detail.artifacts.map((artifact) => (
              <li key={artifact.id} className="rounded-md border border-border/60 p-(--space-3)">
                <div className="font-medium">{artifact.label}</div>
                <div className="text-xs text-foreground/55">{artifact.kind} - {artifact.uri}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-border/60 p-(--space-3) text-sm text-foreground/55">No artifacts attached.</p>
        )}
      </section>
      <OperationTimeline steps={detail.snapshot.steps} events={detail.events} />
    </div>
  );
}
