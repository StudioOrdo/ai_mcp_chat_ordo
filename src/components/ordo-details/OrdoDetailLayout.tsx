import Link from "next/link";

import { OrdoCard } from "@/components/ordo-cards/OrdoCard";
import type { OrdoDetailLens } from "@/core/entities/ordo-object";
import type { OrdoCard as OrdoCardModel, OrdoCardAction } from "@/lib/ordo-cards";
import type {
  OrdoDetailAdminDiagnosticLink,
  OrdoDetailBadge,
  OrdoDetailFact,
  OrdoDetailLensModel,
  OrdoDetailLink,
  OrdoPersonDetailHeaderModel,
  OrdoDetailTimelineItem,
  OrdoObjectDetailModel,
} from "@/lib/ordo-details";
import type { OrdoSourceRef } from "@/lib/ordo-cards";
import { formatStableDateTimeOrValue } from "@/lib/format/stable-date";

import { OrdoDetailLensTabs } from "./OrdoDetailLensTabs";

function orderLensKeys(
  lenses: readonly OrdoDetailLens[],
  defaultLens: OrdoDetailLens,
): OrdoDetailLens[] {
  return [
    defaultLens,
    ...lenses.filter((lens) => lens !== defaultLens),
  ];
}

function orderLensModels(
  lenses: readonly OrdoDetailLensModel[],
  defaultLens: OrdoDetailLens,
): OrdoDetailLensModel[] {
  return [
    ...lenses.filter((lens) => lens.lens === defaultLens),
    ...lenses.filter((lens) => lens.lens !== defaultLens),
  ];
}

function formatTimestamp(value: string): string {
  return formatStableDateTimeOrValue(value);
}

const DIAGNOSTIC_SOURCE_KINDS = new Set([
  "job",
  "job_event",
  "operation",
  "operation_event",
]);

const DIAGNOSTIC_HREF_PREFIXES = [
  "/jobs",
  "/operations",
  "/admin",
  "/factory",
  "/api/",
  "/my/media",
];

function isDiagnosticRef(ref: Pick<OrdoSourceRef, "sourceKind" | "href">): boolean {
  if (DIAGNOSTIC_SOURCE_KINDS.has(ref.sourceKind)) {
    return true;
  }

  return Boolean(ref.href && DIAGNOSTIC_HREF_PREFIXES.some((prefix) => ref.href?.startsWith(prefix)));
}

function safeRefHref(ref?: OrdoSourceRef): string | undefined {
  if (!ref?.href || isDiagnosticRef(ref)) {
    return undefined;
  }

  return ref.href;
}

function sourceKindLabel(sourceKind: OrdoSourceRef["sourceKind"]): string {
  return sourceKind
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function detailLinkFromSourceRef(ref: OrdoSourceRef, suffix: string): OrdoDetailLink {
  const href = safeRefHref(ref);

  return {
    id: `${suffix}:${ref.sourceKind}:${ref.sourceId}`,
    label: ref.label ?? sourceKindLabel(ref.sourceKind),
    ...(href ? { href } : {}),
    ...(!href && isDiagnosticRef(ref) ? { unavailableReason: "Available in System for authorized operators." } : {}),
  };
}

function renderAction(action: OrdoCardAction) {
  const className = action.tone === "destructive"
    ? "focus-ring inline-flex min-h-10 items-center justify-center rounded-full border border-red-500/30 px-(--space-3) text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
    : "focus-ring inline-flex min-h-10 items-center justify-center rounded-full border border-foreground/12 px-(--space-3) text-sm font-semibold text-foreground/70 transition hover:border-foreground/24 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

  if (action.href && !action.disabled) {
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
      disabled
      title={action.disabledReason ?? "Action is available from its source surface."}
    >
      {action.label}
    </button>
  );
}

function badgeClassName(tone: OrdoDetailBadge["tone"] = "neutral"): string {
  const base = "inline-flex min-h-7 items-center rounded-full border px-(--space-2) text-[0.68rem] font-semibold uppercase tracking-[0.12em]";

  switch (tone) {
    case "active":
      return `${base} border-blue-500/20 bg-blue-500/8 text-blue-700`;
    case "good":
      return `${base} border-emerald-500/22 bg-emerald-500/8 text-emerald-700`;
    case "warn":
      return `${base} border-amber-500/26 bg-amber-500/10 text-amber-700`;
    case "bad":
      return `${base} border-red-500/24 bg-red-500/8 text-red-700`;
    case "neutral":
    default:
      return `${base} border-foreground/12 bg-foreground/[0.035] text-foreground/58`;
  }
}

function BadgeStrip({ badges }: { badges: readonly OrdoDetailBadge[] }) {
  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-(--space-2)" data-ordo-detail-badges="true">
      {badges.map((badge) => (
        <span key={badge.id} className={badgeClassName(badge.tone)}>
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function ActionBar({ actions }: { actions: readonly OrdoCardAction[] }) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-(--space-2)" data-ordo-detail-action-bar="true">
      {actions.map(renderAction)}
    </div>
  );
}

function DetailLinkList({
  title,
  links,
}: {
  title: string;
  links: readonly OrdoDetailLink[];
}) {
  if (links.length === 0) {
    return null;
  }

  return (
    <section className="rounded-md border border-foreground/10 bg-background/64 p-(--space-3)" data-ordo-detail-link-list={title.toLowerCase().replace(/\s+/g, "-")}>
      <h2 className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/42">{title}</h2>
      <ul className="mt-(--space-2) grid gap-(--space-2)">
        {links.map((link) => (
          <li key={link.id} className="min-w-0">
            {link.href ? (
              <Link href={link.href} className="text-sm font-semibold text-foreground/72 underline decoration-foreground/20 underline-offset-4 hover:text-foreground">
                {link.label}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-foreground/58">{link.label}</span>
            )}
            {link.summary ? (
              <p className="mt-[0.15rem] text-xs leading-5 text-foreground/48">{link.summary}</p>
            ) : null}
            {!link.href && link.unavailableReason ? (
              <p className="mt-[0.15rem] text-xs leading-5 text-foreground/42">{link.unavailableReason}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function HeaderFacts({ facts }: { facts: readonly OrdoDetailFact[] }) {
  if (facts.length === 0) {
    return null;
  }

  return (
    <dl className="grid gap-(--space-2) border-y border-foreground/10 py-(--space-4) sm:grid-cols-2 xl:grid-cols-4" data-ordo-detail-header-facts="true">
      {facts.map((fact) => {
        const href = safeRefHref(fact.sourceRef);

        return (
          <div key={fact.id} className="min-w-0">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/42">
              {fact.label}
            </dt>
            <dd className="mt-(--space-1) break-words text-sm text-foreground/74">
              {href ? (
                <Link href={href} className="underline decoration-foreground/20 underline-offset-4 hover:text-foreground">
                  {fact.value}
                </Link>
              ) : fact.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function AdminDiagnosticLink({ diagnostic }: { diagnostic: OrdoDetailAdminDiagnosticLink | null | undefined }) {
  if (!diagnostic) {
    return null;
  }

  return (
    <Link
      href={diagnostic.href}
      className="focus-ring inline-flex min-h-10 items-center justify-center rounded-full border border-foreground/12 px-(--space-3) text-sm font-semibold text-foreground/62 transition hover:border-foreground/24 hover:text-foreground"
      data-ordo-detail-admin-diagnostic="true"
      title={diagnostic.summary}
    >
      {diagnostic.label}
    </Link>
  );
}

function FactList({ facts }: { facts: readonly OrdoDetailFact[] }) {
  if (facts.length === 0) {
    return null;
  }

  return (
    <dl className="grid gap-(--space-2) sm:grid-cols-2">
      {facts.map((fact) => {
        const href = safeRefHref(fact.sourceRef);

        return (
          <div key={fact.id} className="rounded-md border border-foreground/10 bg-background/70 p-(--space-3)">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/42">
              {fact.label}
            </dt>
            <dd className="mt-(--space-1) break-words text-sm font-semibold text-foreground/78">
              {href ? (
                <Link href={href} className="underline decoration-foreground/20 underline-offset-4 hover:text-foreground">
                  {fact.value}
                </Link>
              ) : fact.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function initialsFor(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "P";
}

function PersonHeaderFacts({ facts }: { facts: readonly OrdoDetailFact[] }) {
  return (
    <dl className="grid gap-(--space-2) border-y border-foreground/10 py-(--space-4) sm:grid-cols-2 xl:grid-cols-4">
      {facts.map((fact) => {
        const href = safeRefHref(fact.sourceRef);

        return (
          <div key={fact.id} className="min-w-0">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/42">
              {fact.label}
            </dt>
            <dd className="mt-(--space-1) break-words text-sm text-foreground/74">
              {href ? (
                <Link href={href} className="underline decoration-foreground/20 underline-offset-4 hover:text-foreground">
                  {fact.value}
                </Link>
              ) : fact.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function PersonDetailHeader({ header }: { header: OrdoPersonDetailHeaderModel }) {
  return (
    <div className="grid gap-(--space-4)" data-person-detail-header="true">
      <div className="grid gap-(--space-3) sm:grid-cols-[4rem_minmax(0,1fr)]">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.035] text-lg font-semibold text-foreground/72">
          {initialsFor(header.displayName)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-(--space-2)">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {header.displayName}
            </h1>
            <span className="inline-flex items-center rounded-full border border-foreground/12 bg-foreground/[0.04] px-(--space-2) py-[0.14rem] text-[0.68rem] font-semibold text-foreground/64">
              {header.stageLabel}
            </span>
          </div>
          {header.organization ? (
            <p className="mt-(--space-1) text-sm text-foreground/58">{header.organization}</p>
          ) : null}
          {header.primaryConversationHref ? (
            <Link
              href={header.primaryConversationHref}
              className="focus-ring mt-(--space-3) inline-flex min-h-10 items-center rounded-full border border-foreground/12 px-(--space-3) text-sm font-semibold text-foreground/66 transition hover:border-foreground/24 hover:text-foreground"
            >
              Open conversation
            </Link>
          ) : null}
        </div>
      </div>
      <PersonHeaderFacts facts={header.facts} />
    </div>
  );
}

function Timeline({ items }: { items: readonly OrdoDetailTimelineItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ol className="grid gap-(--space-2)" data-ordo-detail-timeline="true">
      {items.map((item) => (
        <li key={item.id} className="rounded-md border border-foreground/10 bg-background/72 p-(--space-3)">
          <div className="flex flex-wrap items-center justify-between gap-(--space-2)">
            <p className="text-sm font-semibold text-foreground">{item.label}</p>
            <time className="text-xs text-foreground/46" dateTime={item.occurredAt}>
              {formatTimestamp(item.occurredAt)}
            </time>
          </div>
          {item.summary ? (
            <p className="mt-(--space-1) text-sm leading-6 text-foreground/62">{item.summary}</p>
          ) : null}
          {safeRefHref(item.sourceRef) ? (
            <Link href={safeRefHref(item.sourceRef) as string} className="mt-(--space-2) inline-flex text-xs font-semibold text-foreground/56 underline decoration-foreground/20 underline-offset-4 hover:text-foreground">
              {item.sourceActionLabel ?? "Open source"}
            </Link>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function LensSection({ lens }: { lens: OrdoDetailLensModel }) {
  const facts = lens.facts ?? [];
  const cards = lens.cards ?? [];
  const timeline = lens.timeline ?? [];
  const actions = lens.actions ?? [];
  const isEmpty = facts.length === 0 && cards.length === 0 && timeline.length === 0 && actions.length === 0;

  return (
    <section
      id={`lens-${lens.lens}`}
      className="scroll-mt-28 rounded-lg border border-foreground/10 bg-background/86 p-(--space-inset-default) shadow-[0_24px_64px_-52px_rgba(15,23,42,0.55)] sm:p-(--space-inset-panel)"
      data-ordo-detail-lens={lens.lens}
      aria-labelledby={`lens-title-${lens.lens}`}
    >
      <div className="mb-(--space-4)">
        <p className="theme-label tier-micro uppercase text-foreground/42">{lens.lens.replace(/_/g, " ")}</p>
        <h2 id={`lens-title-${lens.lens}`} className="mt-(--space-1) text-2xl font-semibold tracking-tight text-foreground">
          {lens.label}
        </h2>
        {lens.summary ? (
          <p className="mt-(--space-2) max-w-3xl text-sm leading-6 text-foreground/62">{lens.summary}</p>
        ) : null}
      </div>

      <div className="grid gap-(--space-4)">
        <FactList facts={facts} />
        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-(--space-2)">
            {actions.map(renderAction)}
          </div>
        ) : null}
        {cards.length > 0 ? (
          <div className="grid gap-(--space-3)">
            {cards.map((card) => <OrdoCard key={card.id} card={card} />)}
          </div>
        ) : null}
        <Timeline items={timeline} />
        {isEmpty && lens.emptyState ? (
          <p className="rounded-md border border-dashed border-foreground/12 bg-background/55 p-(--space-4) text-sm leading-6 text-foreground/56">
            {lens.emptyState}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function defaultBadges(detail: OrdoObjectDetailModel): OrdoDetailBadge[] {
  return [
    { id: "kind", label: detail.object.kind.replace(/_/g, " ") },
    ...(detail.object.status ? [{ id: "status", label: detail.object.status }] : []),
  ];
}

function defaultHeaderFacts(detail: OrdoObjectDetailModel): OrdoDetailFact[] {
  return [
    { id: "state", label: "Current state", value: detail.object.status ?? detail.primaryCard.status },
    { id: "updated", label: "Updated", value: formatTimestamp(detail.primaryCard.updatedAt) },
  ];
}

function defaultDetailLinks(refs: readonly OrdoSourceRef[], suffix: string): OrdoDetailLink[] {
  const seen = new Set<string>();
  const links: OrdoDetailLink[] = [];

  for (const ref of refs) {
    const key = `${ref.sourceKind}:${ref.sourceId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    links.push(detailLinkFromSourceRef(ref, suffix));
  }

  return links;
}

export function OrdoDetailLayout({ detail }: { detail: OrdoObjectDetailModel }) {
  const orderedLensKeys = orderLensKeys(detail.availableLenses, detail.defaultLens);
  const orderedLenses = orderLensModels(detail.lenses, detail.defaultLens);
  const badges = detail.badges ?? defaultBadges(detail);
  const headerFacts = detail.headerFacts ?? defaultHeaderFacts(detail);
  const primaryActions = detail.primaryActions ?? compactPrimaryActions(detail.primaryCard);
  const sourceLinks = detail.sourceLinks ?? defaultDetailLinks(detail.sourceRefs, "source");
  const provenanceLinks = detail.provenanceLinks ?? defaultDetailLinks(detail.provenanceRefs, "provenance");

  return (
    <main
      className="mx-auto grid w-full max-w-6xl gap-(--space-6) px-(--space-frame-default) py-(--space-section-loose) sm:py-(--space-frame-wide)"
      data-ordo-detail-layout="true"
      data-ordo-detail-kind={detail.object.kind}
      data-ordo-detail-id={detail.object.id}
    >
      <header className="grid gap-(--space-4) rounded-lg border border-foreground/10 bg-background/90 p-(--space-inset-default) shadow-[0_24px_72px_-56px_rgba(15,23,42,0.6)] sm:p-(--space-inset-panel)">
        {detail.personHeader ? (
          <PersonDetailHeader header={detail.personHeader} />
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-(--space-4)">
            <div className="min-w-0">
              <p className="theme-label tier-micro uppercase text-foreground/42">{detail.object.kind.replace(/_/g, " ")}</p>
              <h1 className="mt-(--space-2) text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {detail.title}
              </h1>
              <p className="mt-(--space-2) max-w-3xl text-sm leading-6 text-foreground/62 sm:text-base">
                {detail.summary}
              </p>
            </div>
            <AdminDiagnosticLink diagnostic={detail.adminDiagnostic} />
          </div>
        )}
        <BadgeStrip badges={badges} />
        {!detail.personHeader ? <HeaderFacts facts={headerFacts} /> : null}
        <ActionBar actions={primaryActions} />
        <div className="grid gap-(--space-3) lg:grid-cols-2">
          <DetailLinkList title="Source Links" links={sourceLinks} />
          <DetailLinkList title="Evidence Links" links={provenanceLinks} />
        </div>
        <OrdoDetailLensTabs lenses={orderedLensKeys} defaultLens={detail.defaultLens} />
      </header>

      <div className="grid gap-(--space-6) lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start">
        <div className="grid gap-(--space-4)">
          {orderedLenses.map((lens) => <LensSection key={lens.lens} lens={lens} />)}
        </div>

        <aside className="grid gap-(--space-4) lg:sticky lg:top-28" aria-label="Object summary">
          <OrdoCard card={detail.primaryCard} />
          {detail.relatedCards.length > 0 ? (
            <section className="rounded-lg border border-foreground/10 bg-background/86 p-(--space-inset-default)">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground/42">Related</h2>
              <div className="mt-(--space-3) grid gap-(--space-3)">
                {detail.relatedCards.slice(0, 3).map((card) => <OrdoCard key={card.id} card={card} />)}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function compactPrimaryActions(card: OrdoCardModel): OrdoCardAction[] {
  return [
    card.primaryAction,
    ...(card.secondaryActions ?? []),
  ].filter((action): action is OrdoCardAction => Boolean(action));
}
