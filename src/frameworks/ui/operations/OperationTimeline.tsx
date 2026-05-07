import type { OperationEvent, OperationStep } from "@/core/entities/operation";

export function OperationTimeline({
  events,
  steps = [],
}: {
  events: readonly OperationEvent[];
  steps?: readonly OperationStep[];
}) {
  const visibleEvents = events.slice(-20).reverse();

  return (
    <section className="grid gap-(--space-3)" aria-label="Operation timeline">
      {steps.length > 0 ? (
        <div className="grid gap-(--space-2)">
          <h3 className="text-sm font-semibold text-foreground">Steps</h3>
          <ol className="grid gap-(--space-2)">
            {steps.map((step) => (
              <li key={step.id} className="rounded-md border border-border/60 bg-surface-muted/35 p-(--space-3)">
                <div className="flex flex-wrap items-center justify-between gap-(--space-2)">
                  <span className="font-medium text-foreground">{step.kind}</span>
                  <span className="rounded border border-border/60 px-2 py-0.5 text-xs text-foreground/60">{step.status}</span>
                </div>
                {step.error ? <p className="mt-(--space-1) text-sm text-danger">{step.error.message}</p> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <div className="grid gap-(--space-2)">
        <h3 className="text-sm font-semibold text-foreground">Events</h3>
        {visibleEvents.length > 0 ? (
          <ol className="grid gap-(--space-2)">
            {visibleEvents.map((event) => (
              <li key={event.id} className="rounded-md border border-border/60 bg-background/72 p-(--space-3)">
                <div className="flex flex-wrap items-center justify-between gap-(--space-2)">
                  <span className="font-medium text-foreground">{event.type.replaceAll("_", " ")}</span>
                  <span className="text-xs text-foreground/55">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
                {Object.keys(event.payload).length > 0 ? (
                  <pre className="mt-(--space-2) max-h-44 overflow-auto rounded bg-surface-muted/55 p-(--space-2) text-xs text-foreground/70">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-md border border-dashed border-border/60 p-(--space-3) text-sm text-foreground/55">
            No operation events have been recorded yet.
          </p>
        )}
      </div>
    </section>
  );
}
