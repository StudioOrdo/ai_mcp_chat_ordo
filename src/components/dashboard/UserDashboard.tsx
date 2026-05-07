import Link from "next/link";

import {
  GovernanceSectionFrame,
  type GovernanceFilterControl,
  type GovernanceHiddenField,
  type GovernanceSectionModel,
  type GovernanceSelectorItem,
} from "@/components/governance/GovernanceSectionFrame";
import { formatStableUpdatedAt } from "@/lib/format/stable-date";
import {
  buildTodayBriefReadModel,
  isTodayIntent,
  TODAY_INTENTS,
  todayIntentLabel,
  type TodayBriefItem,
  type TodayBriefReadModel,
  type TodayEvidenceRef,
  type TodayIntent,
  type TodaySourceLink,
} from "@/lib/dashboard/today-brief-read-model";
import type { UserDashboardData } from "@/lib/dashboard/load-user-dashboard";

interface UserDashboardProps {
  userName: string | null;
  dashboard: UserDashboardData;
  query?: UserDashboardQuery;
}

type RawUserDashboardSearchParams = Record<string, string | string[] | undefined>;

export interface UserDashboardQuery {
  q: string | null;
  intent: TodayIntent | null;
  objectId: string | null;
}

const DEFAULT_DASHBOARD_QUERY: UserDashboardQuery = {
  q: null,
  intent: null,
  objectId: null,
};

const LEGACY_TYPE_TO_INTENT: Record<string, TodayIntent> = {
  decision: "decide",
  motion: "watch",
  output: "inspect",
  result: "learn",
  weak_signal: "fix",
  business: "learn",
};

function firstSearchValue(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDashboardIntent(rawSearchParams: RawUserDashboardSearchParams): TodayIntent | null {
  const explicitIntent = firstSearchValue(rawSearchParams.intent);
  if (isTodayIntent(explicitIntent)) {
    return explicitIntent;
  }

  const legacyType = firstSearchValue(rawSearchParams.type);
  return legacyType ? LEGACY_TYPE_TO_INTENT[legacyType] ?? null : null;
}

function normalizeDashboardSearch(value: string | string[] | undefined): string | null {
  const candidate = firstSearchValue(value);
  return candidate ? candidate.slice(0, 120) : null;
}

function normalizeDashboardObjectId(value: string | string[] | undefined): string | null {
  const candidate = firstSearchValue(value);
  return candidate ? candidate.slice(0, 180) : null;
}

export function parseUserDashboardQuery(
  rawSearchParams: RawUserDashboardSearchParams = {},
): UserDashboardQuery {
  return {
    q: normalizeDashboardSearch(rawSearchParams.q),
    intent: normalizeDashboardIntent(rawSearchParams),
    objectId: normalizeDashboardObjectId(rawSearchParams.object),
  };
}

function buildDashboardHref(query: Partial<UserDashboardQuery> = {}): string {
  const merged = { ...DEFAULT_DASHBOARD_QUERY, ...query };
  const searchParams = new URLSearchParams();

  if (merged.q) searchParams.set("q", merged.q);
  if (merged.intent) searchParams.set("intent", merged.intent);
  if (merged.objectId) searchParams.set("object", merged.objectId);

  const queryString = searchParams.toString();
  return queryString ? `/workspace?${queryString}` : "/workspace";
}

function todayItemMatchesQuery(item: TodayBriefItem, query: UserDashboardQuery): boolean {
  if (query.intent && item.intent !== query.intent) {
    return false;
  }

  if (!query.q) {
    return true;
  }

  const lowerQuery = query.q.toLowerCase();
  const fields = [
    item.intentLabel,
    item.domain,
    item.title,
    item.summary,
    item.statusLabel,
    item.why,
    item.currentState,
    item.card.objectRef.label,
    item.card.objectRef.id,
    ...item.evidenceRefs.flatMap((ref) => [ref.label, ref.kindLabel, ref.kind, ref.id]),
    ...item.sourceLinks.flatMap((link) => [link.label, link.href]),
  ];

  return fields.some((field) => field?.toLowerCase().includes(lowerQuery));
}

function findTodayItem(items: readonly TodayBriefItem[], objectId: string | null): TodayBriefItem | null {
  if (!objectId) {
    return null;
  }

  return items.find((item) => (
    item.id === objectId
    || item.card.id === objectId
    || item.card.objectRef.id === objectId
  )) ?? null;
}

function selectorHiddenFields(query: UserDashboardQuery, omit: "q" | "intent" | "objectId"): GovernanceHiddenField[] {
  const fields: Array<GovernanceHiddenField | null> = [
    omit === "q" ? null : { name: "q", value: query.q },
    omit === "intent" ? null : { name: "intent", value: query.intent },
    omit === "objectId" ? null : { name: "object", value: query.objectId },
  ];

  return fields.filter((field): field is GovernanceHiddenField => Boolean(field));
}

function selectorFilters(query: UserDashboardQuery): GovernanceFilterControl[] {
  return [
    {
      id: "today-intent-filter",
      label: "Intent",
      name: "intent",
      value: query.intent,
      options: [
        { label: "Any", value: null },
        ...TODAY_INTENTS.map((intent) => ({
          label: todayIntentLabel(intent),
          value: intent,
        })),
      ],
    },
  ];
}

function buildSelectorItems(
  items: readonly TodayBriefItem[],
  query: UserDashboardQuery,
  selectedItem: TodayBriefItem | null,
): GovernanceSelectorItem[] {
  return items.map((item) => ({
    id: item.id,
    href: buildDashboardHref({ ...query, objectId: item.id }),
    title: item.title,
    summary: item.summary,
    meta: formatStableUpdatedAt(item.updatedAt),
    iconLabel: item.iconLabel,
    statusLabel: item.intentLabel,
    countLabel: item.domain,
    selected: selectedItem?.id === item.id,
    dataAttributes: {
      "data-dashboard-selection-row": item.id,
      "data-dashboard-selection-intent": item.intent,
      "data-dashboard-selection-domain": item.domain,
    },
  }));
}

function TodaySelectorOverview({ brief }: { brief: TodayBriefReadModel }) {
  return (
    <div className="grid gap-(--space-2)" data-dashboard-selector-brief="true">
      <div className="grid grid-cols-5 gap-(--space-1)" aria-label="Today intent counts">
        {TODAY_INTENTS.map((intent) => (
          <div key={intent} className="rounded-lg border border-foreground/8 bg-background px-(--space-2) py-(--space-2)">
            <p className="text-[0.58rem] font-semibold uppercase text-foreground/38">{todayIntentLabel(intent)}</p>
            <p className="mt-[0.12rem] text-sm font-semibold text-foreground">{brief.counts[intent]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceList({ refs }: { refs: readonly TodayEvidenceRef[] }) {
  if (refs.length === 0) {
    return (
      <p className="text-sm leading-6 text-foreground/54">
        No durable evidence is available for this item yet.
      </p>
    );
  }

  return (
    <ul className="grid gap-(--space-2)" data-dashboard-evidence-list="true">
      {refs.map((ref) => (
        <li key={ref.id} className="flex items-center justify-between gap-(--space-3) rounded-lg border border-foreground/8 bg-background/74 px-(--space-3) py-(--space-2)">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground/72">{ref.label}</span>
            <span className="block truncate text-xs text-foreground/42">{ref.kindLabel}</span>
          </span>
          {ref.href ? (
            <Link href={ref.href} className="focus-ring shrink-0 rounded-full border border-foreground/12 px-(--space-2) py-(--space-1) text-xs font-semibold text-foreground/58">
              Open
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function SourceLinks({ links }: { links: readonly TodaySourceLink[] }) {
  if (links.length === 0) {
    return (
      <p className="text-sm leading-6 text-foreground/54">
        No source route is available yet.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-(--space-2)" data-dashboard-source-links="true">
      {links.map((link) => (
        <Link
          key={link.id}
          href={link.href}
          className="focus-ring inline-flex min-h-10 items-center rounded-full border border-foreground/12 px-(--space-3) text-sm font-semibold text-foreground/62 transition hover:border-foreground/22 hover:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

function TodayBriefPanel({ brief }: { brief: TodayBriefReadModel }) {
  return (
    <section className="grid gap-(--space-5)" data-dashboard-brief="true" data-dashboard-brief-status={brief.status}>
      <header className="max-w-3xl">
        <p className="theme-label tier-micro uppercase text-foreground/42">Today</p>
        <h1 className="mt-(--space-2) text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {brief.title}
        </h1>
        <p className="mt-(--space-2) text-sm leading-6 text-foreground/62">
          {brief.summary}
        </p>
      </header>

      <section className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-panel)" aria-label="Today brief summary">
        <div className="grid gap-(--space-2) sm:grid-cols-5">
          {TODAY_INTENTS.map((intent) => (
            <div key={intent} className="rounded-lg border border-foreground/8 bg-background px-(--space-3) py-(--space-2)">
              <p className="text-[0.66rem] font-semibold uppercase text-foreground/44">{todayIntentLabel(intent)}</p>
              <p className="mt-(--space-1) text-[1.1rem] font-semibold text-foreground">{brief.counts[intent]}</p>
            </div>
          ))}
        </div>

        <ul className="mt-(--space-4) grid gap-(--space-2) text-sm leading-6 text-foreground/68">
          {brief.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-(--space-2)">
              <span aria-hidden="true">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        {brief.limitations.length > 0 ? (
          <div className="mt-(--space-4) rounded-lg border border-foreground/10 bg-foreground/[0.025] px-(--space-3) py-(--space-2)" data-dashboard-brief-limitations="true">
            <p className="text-xs font-semibold uppercase text-foreground/44">Limitations</p>
            <ul className="mt-(--space-1) grid gap-(--space-1) text-sm leading-6 text-foreground/60">
              {brief.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
            </ul>
          </div>
        ) : null}

        <Link href={brief.recommendedAction.href} className="btn-primary mt-(--space-4) w-fit">
          {brief.recommendedAction.label}
        </Link>
      </section>

      <section className="rounded-lg border border-foreground/10 bg-background/72 p-(--space-inset-panel)" aria-label="Brief evidence">
        <p className="theme-label tier-micro uppercase text-foreground/42">Evidence behind the brief</p>
        <div className="mt-(--space-3)">
          <EvidenceList refs={brief.evidenceRefs} />
        </div>
      </section>
    </section>
  );
}

function TodayItemDetail({ item }: { item: TodayBriefItem }) {
  return (
    <section className="grid gap-(--space-5)" data-dashboard-selected-object="true" data-dashboard-selected-intent={item.intent}>
      <header className="max-w-3xl">
        <p className="theme-label tier-micro uppercase text-foreground/42">
          {item.intentLabel} · {item.domain}
        </p>
        <h1 className="mt-(--space-2) text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {item.title}
        </h1>
        <p className="mt-(--space-2) text-sm leading-6 text-foreground/60">
          {item.summary}
        </p>
      </header>

      <section className="grid gap-px overflow-hidden rounded-lg border border-foreground/10 bg-foreground/8 sm:grid-cols-3" aria-label="Today item interpretation">
        <div className="bg-background p-(--space-inset-default)">
          <p className="theme-label tier-micro uppercase text-foreground/42">Why this is on Today</p>
          <p className="mt-(--space-2) text-sm leading-6 text-foreground/68">{item.why}</p>
        </div>
        <div className="bg-background p-(--space-inset-default)">
          <p className="theme-label tier-micro uppercase text-foreground/42">Current state</p>
          <p className="mt-(--space-2) text-sm leading-6 text-foreground/68">{item.currentState}</p>
        </div>
        <div className="bg-background p-(--space-inset-default)">
          <p className="theme-label tier-micro uppercase text-foreground/42">Recommended action</p>
          <Link href={item.recommendedAction.href} className="btn-primary mt-(--space-2) w-fit">
            {item.recommendedAction.label}
          </Link>
          {item.recommendedAction.prompt ? (
            <p className="mt-(--space-2) text-sm leading-6 text-foreground/58">
              {item.recommendedAction.prompt}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-panel)" aria-label="Today item evidence">
        <p className="theme-label tier-micro uppercase text-foreground/42">Evidence</p>
        <div className="mt-(--space-3)">
          <EvidenceList refs={item.evidenceRefs} />
        </div>
      </section>

      <section className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-panel)" aria-label="Source links">
        <p className="theme-label tier-micro uppercase text-foreground/42">Source links</p>
        <div className="mt-(--space-3)">
          <SourceLinks links={item.sourceLinks} />
        </div>
      </section>
    </section>
  );
}

export function UserDashboard({ userName, dashboard, query = DEFAULT_DASHBOARD_QUERY }: UserDashboardProps) {
  const normalizedQuery = { ...DEFAULT_DASHBOARD_QUERY, ...query };
  const readModel = buildTodayBriefReadModel(dashboard);
  const visibleItems = readModel.items.filter((item) => todayItemMatchesQuery(item, normalizedQuery));
  const selectedItem = findTodayItem(readModel.items, normalizedQuery.objectId);
  const selectorItems = buildSelectorItems(visibleItems, normalizedQuery, selectedItem);
  const displayName = userName?.trim() || "there";
  const sectionModel: GovernanceSectionModel<TodayBriefItem, TodayBriefReadModel["counts"]> = {
    sectionId: "today",
    sectionTitle: "Today",
    brief: null,
    summary: readModel.counts,
    objects: visibleItems,
    selectedObject: selectedItem,
    permissions: {
      canView: true,
      canSelect: true,
      canFilter: true,
      canMutate: false,
      canViewDiagnostics: false,
    },
  };

  return (
    <GovernanceSectionFrame
      model={sectionModel}
      detailRequested={Boolean(normalizedQuery.objectId)}
      listHref={buildDashboardHref({ ...normalizedQuery, objectId: null })}
      mobileBackLabel="Back to Today"
      rootDataAttributes={{
        "data-user-dashboard": "true",
        "data-dashboard-mobile-state": normalizedQuery.objectId ? "detail" : "list",
      }}
      selector={{
        ariaLabel: "Today evidence index",
        title: "Today",
        guidance: `${displayName} can ask Ordo what to do in chat. This column keeps the decision evidence selectable.`,
        overview: <TodaySelectorOverview brief={readModel} />,
        search: {
          action: "/workspace",
          label: "Search Today",
          placeholder: "Search Today...",
          defaultValue: normalizedQuery.q,
          hiddenFields: selectorHiddenFields(normalizedQuery, "q"),
        },
        filters: {
          label: "Open Today filters",
          action: "/workspace",
          clearHref: "/workspace",
          hiddenFields: selectorHiddenFields(normalizedQuery, "intent"),
          controls: selectorFilters(normalizedQuery),
        },
        items: selectorItems,
        emptyTitle: "No Today items match this view",
        emptySummary: "Adjust the search or filter, or ask Ordo what to do first.",
        footer: (
          <>
            <p>Showing {visibleItems.length} of {readModel.counts.total} Today items.</p>
            <p className="mt-[0.2rem]">
              {readModel.counts.decide} to decide · {readModel.counts.fix} to fix
            </p>
          </>
        ),
        dataAttributes: {
          "data-dashboard-decisions-column": "true",
        },
      }}
      main={{
        ariaLabel: "Today brief",
        renderBrief: () => <TodayBriefPanel brief={readModel} />,
        renderDetail: (item) => <TodayItemDetail item={item} />,
        missingDetail: {
          title: "Today item was not found.",
          summary: "Return to the Today brief or select another item from the evidence index.",
        },
        dataAttributes: {
          "data-dashboard-main-column": "true",
        },
      }}
    />
  );
}
