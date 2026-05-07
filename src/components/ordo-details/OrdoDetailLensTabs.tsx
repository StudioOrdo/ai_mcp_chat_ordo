import type { OrdoDetailLens } from "@/core/entities/ordo-object";

const LENS_LABELS: Record<OrdoDetailLens, string> = {
  overview: "Overview",
  provenance: "Provenance",
  funnel: "Funnel",
  performance: "Performance",
  actions: "Actions",
  history: "History",
  related: "Related",
  activity: "Activity",
  visibility: "Visibility",
};

export function OrdoDetailLensTabs({
  lenses,
  defaultLens,
}: {
  lenses: readonly OrdoDetailLens[];
  defaultLens: OrdoDetailLens;
}) {
  return (
    <nav
      className="flex gap-(--space-2) overflow-x-auto py-(--space-2)"
      aria-label="Object detail lenses"
      data-ordo-detail-lens-tabs="true"
    >
      {lenses.map((lens) => (
        <a
          key={lens}
          href={`#lens-${lens}`}
          className={lens === defaultLens
            ? "focus-ring inline-flex min-h-10 items-center rounded-full border border-foreground/16 bg-foreground px-(--space-3) text-sm font-semibold text-background"
            : "focus-ring inline-flex min-h-10 items-center rounded-full border border-foreground/12 bg-background/72 px-(--space-3) text-sm font-semibold text-foreground/64 transition hover:border-foreground/24 hover:text-foreground"}
          aria-current={lens === defaultLens ? "true" : undefined}
        >
          {LENS_LABELS[lens]}
        </a>
      ))}
    </nav>
  );
}
