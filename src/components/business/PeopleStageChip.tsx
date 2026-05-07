import type { PersonStageLabel } from "@/lib/business/people-read-model";

const STAGE_TONE: Record<PersonStageLabel, string> = {
  Visitor: "border-sky-500/20 bg-sky-500/[0.08] text-sky-800",
  Contact: "border-foreground/12 bg-foreground/[0.04] text-foreground/64",
  Conversation: "border-indigo-500/20 bg-indigo-500/[0.08] text-indigo-800",
  Offer: "border-amber-500/24 bg-amber-500/10 text-amber-800",
  Purchased: "border-emerald-500/24 bg-emerald-500/10 text-emerald-800",
  "Follow-up": "border-rose-500/24 bg-rose-500/10 text-rose-800",
};

export function PeopleStageChip({
  label,
  count,
}: {
  label: PersonStageLabel;
  count?: number;
}) {
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-(--space-1) rounded-full border px-(--space-2) py-[0.2rem] text-[0.72rem] font-semibold ${STAGE_TONE[label]}`}
      data-people-stage-chip={label}
    >
      <span>{label}</span>
      {typeof count === "number" ? (
        <span className="rounded-full bg-background/70 px-[0.4rem] text-[0.68rem] text-foreground/58">
          {count.toLocaleString()}
        </span>
      ) : null}
    </span>
  );
}
