import Link from "next/link";

import {
  GovernanceSectionFrame,
  type GovernanceFilterControl,
  type GovernanceHiddenField,
  type GovernanceSectionModel,
  type GovernanceSelectorItem,
} from "@/components/governance/GovernanceSectionFrame";
import type {
  BusinessWorkspaceData,
  BusinessWorkspaceSummary,
  BusinessWorkspaceQuery,
} from "@/lib/business/load-business-workspace";
import type {
  PersonReadModelItem,
  PersonRelationshipRole,
  PersonSourceCategory,
  PersonStageLabel,
} from "@/lib/business/people-read-model";
import { formatStableUtcShortDateTime } from "@/lib/format/stable-date";

const STAGE_FILTERS: readonly PersonStageLabel[] = [
  "Visitor",
  "Conversation",
  "Contact",
  "Offer",
  "Purchased",
  "Follow-up",
];

const SOURCE_FILTERS: ReadonlyArray<{ value: PersonSourceCategory; label: string }> = [
  { value: "website", label: "Website" },
  { value: "qr_code", label: "QR code" },
  { value: "referral_link", label: "Referral link" },
  { value: "direct_conversation", label: "Direct conversation" },
  { value: "public_offer", label: "Public offer" },
  { value: "public_content", label: "Public content" },
];

const NEEDS_FILTERS: ReadonlyArray<{ value: NonNullable<BusinessWorkspaceQuery["needsAction"]>; label: string }> = [
  { value: "follow_up_due", label: "Follow-up due" },
  { value: "waiting_on_owner", label: "Waiting on owner" },
  { value: "offer_in_motion", label: "Offer in motion" },
  { value: "no_next_step", label: "No next step" },
];

const ROLE_FILTERS: readonly PersonRelationshipRole[] = [
  "Prospect",
  "Customer",
  "Affiliate",
  "Collaborator",
  "Staff",
];

const STAGE_TONE: Record<PersonStageLabel, string> = {
  Visitor: "border-sky-500/18 bg-sky-500/[0.07] text-sky-800",
  Contact: "border-foreground/12 bg-foreground/[0.04] text-foreground/64",
  Conversation: "border-indigo-500/18 bg-indigo-500/[0.07] text-indigo-800",
  Offer: "border-amber-500/22 bg-amber-500/[0.09] text-amber-800",
  Purchased: "border-emerald-500/22 bg-emerald-500/[0.09] text-emerald-800",
  "Follow-up": "border-rose-500/22 bg-rose-500/[0.09] text-rose-800",
};

function buildBusinessHref(
  current: BusinessWorkspaceQuery,
  patch: Partial<BusinessWorkspaceQuery> = {},
): string {
  const query = { ...current, ...patch };
  const searchParams = new URLSearchParams();

  if (query.q) searchParams.set("q", query.q);
  if (query.personId) searchParams.set("person", query.personId);
  if (query.stage) searchParams.set("stage", query.stage);
  if (query.source) searchParams.set("source", query.source);
  if (query.needsAction) searchParams.set("needs", query.needsAction);
  if (query.relationshipRole) searchParams.set("role", query.relationshipRole);
  if (query.affiliateStatus) searchParams.set("affiliate", query.affiliateStatus);
  if (query.page && query.page > 1) searchParams.set("page", String(query.page));
  if (query.limit && query.limit !== 20) searchParams.set("limit", String(query.limit));

  const queryString = searchParams.toString();
  return queryString ? `/business?${queryString}` : "/business";
}

function formatDate(value: string | null | undefined): string {
  return formatStableUtcShortDateTime(value ?? "") ?? "No date yet";
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

function sourceLabel(person: PersonReadModelItem): string {
  return person.sourceLabels[0] ?? "Relationship evidence";
}

function descriptorFor(person: PersonReadModelItem): string {
  return person.organization
    ?? person.email
    ?? person.sourceLabels[0]
    ?? person.summary;
}

function personSubtitle(person: PersonReadModelItem): string {
  return person.organization
    ?? (person.isAnonymous ? sourceLabel(person) : person.email)
    ?? sourceLabel(person);
}

function latestTrailDate(
  person: PersonReadModelItem,
  predicate: (item: PersonReadModelItem["relationshipTrail"][number]) => boolean,
): string | null {
  const matchingItems = person.relationshipTrail.filter(predicate);
  if (matchingItems.length === 0) {
    return null;
  }

  return matchingItems.reduce((latest, item) => (
    Date.parse(item.occurredAt) > Date.parse(latest.occurredAt) ? item : latest
  )).occurredAt;
}

function lastConversationDate(person: PersonReadModelItem): string {
  const occurredAt = latestTrailDate(person, (item) => (
    item.sourceRef.sourceKind === "conversation" || item.label.toLowerCase().includes("conversation")
  ));

  return occurredAt ? formatDate(occurredAt) : "—";
}

function introducedByValue(person: PersonReadModelItem): { value: string; href?: string } {
  const referralCode = person.referralCodes[0];
  return referralCode
    ? { value: `Referral ${referralCode}`, href: `/business/referrals/${encodeURIComponent(referralCode)}` }
    : { value: "—" };
}

function openConversationHref(person: PersonReadModelItem): string | null {
  return person.primaryConversationId
    ? `/business/conversations/${encodeURIComponent(person.primaryConversationId)}`
    : null;
}

function safeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function PersonAvatar({ person, size = "lg" }: { person: PersonReadModelItem; size?: "sm" | "lg" }) {
  const sizeClass = size === "sm" ? "h-12 w-12 text-sm" : "h-16 w-16 text-lg";

  return (
    <span className={`flex ${sizeClass} items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.035] font-semibold text-foreground/72`}>
      {initialsFor(person.displayName)}
    </span>
  );
}

function RelationshipFactsRow({ person }: { person: PersonReadModelItem }) {
  const introducedBy = introducedByValue(person);
  const facts = [
    {
      id: "introduced-by",
      label: "Introduced by",
      value: introducedBy.value,
      href: introducedBy.href,
    },
    {
      id: "came-from",
      label: "Came from",
      value: person.sourceLabels.length > 0 ? person.sourceLabels.join(" · ") : "—",
    },
    {
      id: "last-conversation",
      label: "Last conversation",
      value: lastConversationDate(person),
    },
    {
      id: "next-follow-up",
      label: "Next follow-up",
      value: person.nextAction ?? "—",
    },
  ];

  return (
    <dl
      className="grid gap-(--space-2) border-y border-foreground/10 py-(--space-4) sm:grid-cols-2 xl:grid-cols-4"
      data-relationship-facts-row="true"
    >
      {facts.map((fact) => (
        <div key={fact.id} className="min-w-0">
          <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/42">
            {fact.label}
          </dt>
          <dd className="mt-(--space-1) break-words text-sm text-foreground/74">
            {fact.href ? (
              <Link href={fact.href} className="underline decoration-foreground/20 underline-offset-4 hover:text-foreground">
                {fact.value}
              </Link>
            ) : fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PersonDetailHeader({ person }: { person: PersonReadModelItem }) {
  const conversationHref = openConversationHref(person);

  return (
    <header
      className="grid gap-(--space-3) sm:grid-cols-[4rem_minmax(0,1fr)]"
      data-person-detail-header="true"
    >
      <PersonAvatar person={person} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-(--space-2)">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{person.displayName}</h1>
          <StageBadge stage={person.stageLabel} />
        </div>
        <p className="mt-(--space-1) text-sm text-foreground/58">{personSubtitle(person)}</p>
        {conversationHref ? (
          <Link
            href={conversationHref}
            className="focus-ring mt-(--space-3) inline-flex min-h-10 items-center rounded-full border border-foreground/12 px-(--space-3) text-sm font-semibold text-foreground/66 transition hover:border-foreground/24 hover:text-foreground"
          >
            Open conversation
          </Link>
        ) : null}
      </div>
    </header>
  );
}

function RelationshipTrailList({ person }: { person: PersonReadModelItem }) {
  if (person.relationshipTrail.length === 0) {
    return (
      <section
        className="rounded-lg border border-dashed border-foreground/14 bg-background/72 p-(--space-inset-default)"
        data-relationship-trail="true"
      >
        <p className="text-sm font-semibold text-foreground">Relationship Trail</p>
        <p className="mt-(--space-1) text-sm leading-6 text-foreground/58">
          No relationship trail has been recorded yet.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-default)"
      data-relationship-trail="true"
      aria-labelledby="relationship-trail-title"
    >
      <div className="mb-(--space-3)">
        <p className="theme-label tier-micro uppercase text-foreground/42">Evidence</p>
        <h2 id="relationship-trail-title" className="mt-(--space-1) text-xl font-semibold tracking-tight text-foreground">
          Relationship Trail
        </h2>
      </div>
      <ol className="grid gap-(--space-3)">
        {person.relationshipTrail.map((item) => (
          <li key={item.id} className="grid gap-(--space-1) border-l border-foreground/12 pl-(--space-3)">
            <div className="flex flex-wrap items-center justify-between gap-(--space-2)">
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              <time className="text-xs text-foreground/46" dateTime={item.occurredAt}>
                {formatDate(item.occurredAt)}
              </time>
            </div>
            <p className="text-sm leading-6 text-foreground/62">{item.summary}</p>
            {item.sourceRef.href ? (
              <Link
                href={item.sourceRef.href}
                className="focus-ring inline-flex w-fit text-xs font-semibold text-foreground/56 underline decoration-foreground/20 underline-offset-4 hover:text-foreground"
              >
                {item.sourceActionLabel ?? "Open related item"}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function RelationshipSettingsCard({ person }: { person: PersonReadModelItem }) {
  const stableId = safeIdPart(person.id);
  const conversationHref = openConversationHref(person);
  const actionHref = conversationHref ?? "/";
  const actionLabel = conversationHref ? "Discuss in conversation" : "Ask Ordo in chat";

  return (
    <aside
      className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-default)"
      data-relationship-settings-card="true"
      aria-labelledby={`relationship-settings-title-${stableId}`}
    >
      <p className="theme-label tier-micro uppercase text-foreground/42">Settings</p>
      <h2
        id={`relationship-settings-title-${stableId}`}
        className="mt-(--space-1) text-lg font-semibold tracking-tight text-foreground"
      >
        Relationship settings
      </h2>

      <div className="mt-(--space-4) grid gap-(--space-4)">
        <label
          htmlFor={`relationship-role-${stableId}`}
          className="grid gap-(--space-1) text-xs font-semibold text-foreground/58"
        >
          Relationship role
          <select
            id={`relationship-role-${stableId}`}
            aria-label="Relationship role"
            defaultValue={person.relationshipRole}
            disabled
            data-relationship-role-readonly="true"
            className="min-h-10 rounded-lg border border-foreground/12 bg-foreground/[0.03] px-(--space-2) text-sm text-foreground/70"
          >
            {ROLE_FILTERS.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </label>

        <div className="grid gap-(--space-2)">
          <span className="text-xs font-semibold text-foreground/58">Affiliate</span>
          <label className="flex min-h-10 items-center justify-between gap-(--space-3) rounded-lg border border-foreground/10 bg-foreground/[0.025] px-(--space-3)">
            <span className="text-sm text-foreground/68">{person.affiliate ? "On" : "Off"}</span>
            <input
              type="checkbox"
              aria-label="Affiliate"
              defaultChecked={person.affiliate}
              disabled
              readOnly
              data-affiliate-readonly="true"
              className="h-5 w-5 accent-foreground"
            />
          </label>
        </div>

        <p className="text-xs leading-5 text-foreground/50">
          These values are derived from relationship evidence. Use chat when this relationship needs to be reclassified.
        </p>

        <Link
          href={actionHref}
          className="focus-ring inline-flex min-h-10 w-fit items-center rounded-full border border-foreground/12 px-(--space-3) text-sm font-semibold text-foreground/62 transition hover:border-foreground/24 hover:text-foreground"
        >
          {actionLabel}
        </Link>
      </div>
    </aside>
  );
}

function StageBadge({ stage }: { stage: PersonStageLabel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-(--space-2) py-[0.14rem] text-[0.68rem] font-semibold ${STAGE_TONE[stage]}`}
      data-people-stage-badge={stage}
    >
      {stage}
    </span>
  );
}

function RelationshipPreview({ person }: { person: PersonReadModelItem }) {
  return (
    <article
      className="grid gap-(--space-5) rounded-lg border border-foreground/10 bg-background/92 p-(--space-inset-default) shadow-[0_24px_72px_-56px_rgba(15,23,42,0.6)] sm:p-(--space-inset-panel)"
      data-people-detail-preview="true"
    >
      <PersonDetailHeader person={person} />
      <RelationshipFactsRow person={person} />

      <section>
        <p className="theme-label tier-micro uppercase text-foreground/42">Relationship evidence</p>
        <p className="mt-(--space-2) max-w-3xl text-sm leading-6 text-foreground/66">
          {person.summary}
        </p>
        {person.offerLabels.length > 0 ? (
          <p className="mt-(--space-2) text-sm text-foreground/58">
            Offer in motion: {person.offerLabels.join(", ")}
          </p>
        ) : null}
      </section>
      <div
        className="grid gap-(--space-5) xl:grid-cols-[minmax(0,1fr)_minmax(16rem,18rem)] xl:items-start"
        data-relationship-governance-layout="true"
      >
        <RelationshipTrailList person={person} />
        <RelationshipSettingsCard person={person} />
      </div>
    </article>
  );
}

function peopleHiddenFields(
  query: BusinessWorkspaceQuery,
  omitted: Array<keyof BusinessWorkspaceQuery> = [],
): GovernanceHiddenField[] {
  const omit = new Set<keyof BusinessWorkspaceQuery>(omitted);
  const fields: GovernanceHiddenField[] = [
    { name: "q", value: query.q },
    { name: "person", value: query.personId },
    { name: "stage", value: query.stage },
    { name: "source", value: query.source },
    { name: "needs", value: query.needsAction },
    { name: "role", value: query.relationshipRole },
    { name: "affiliate", value: query.affiliateStatus },
    { name: "limit", value: query.limit !== 20 ? query.limit : null },
  ];

  const keyByName: Record<string, keyof BusinessWorkspaceQuery> = {
    q: "q",
    person: "personId",
    stage: "stage",
    source: "source",
    needs: "needsAction",
    role: "relationshipRole",
    affiliate: "affiliateStatus",
    limit: "limit",
  };

  return fields.filter((field) => !omit.has(keyByName[field.name]));
}

function peopleFilterControls(query: BusinessWorkspaceQuery): GovernanceFilterControl[] {
  return [
    {
      id: "people-stage-filter",
      label: "Stage",
      name: "stage",
      value: query.stage,
      options: [
        { label: "Any", value: null },
        ...STAGE_FILTERS.map((stage) => ({ label: stage, value: stage })),
      ],
    },
    {
      id: "people-source-filter",
      label: "Source",
      name: "source",
      value: query.source,
      options: [
        { label: "Any", value: null },
        ...SOURCE_FILTERS.map((source) => ({ label: source.label, value: source.value })),
      ],
    },
    {
      id: "people-needs-filter",
      label: "Next follow-up",
      name: "needs",
      value: query.needsAction,
      options: [
        { label: "Any", value: null },
        ...NEEDS_FILTERS.map((filter) => ({ label: filter.label, value: filter.value })),
      ],
    },
    {
      id: "people-role-filter",
      label: "Relationship role",
      name: "role",
      value: query.relationshipRole,
      options: [
        { label: "Any", value: null },
        ...ROLE_FILTERS.map((role) => ({ label: role, value: role })),
      ],
    },
    {
      id: "people-affiliate-filter",
      label: "Affiliate status",
      name: "affiliate",
      value: query.affiliateStatus,
      options: [
        { label: "Any", value: null },
        { label: "Affiliate", value: "affiliate" },
        { label: "Not affiliate", value: "not_affiliate" },
      ],
    },
  ];
}

function peopleSelectorItems(workspace: BusinessWorkspaceData): GovernanceSelectorItem[] {
  const { people, query, selectedPerson } = workspace;

  return people.map((person) => ({
    id: person.id,
    href: buildBusinessHref(query, { personId: person.id, page: query.page }),
    title: person.displayName,
    summary: descriptorFor(person),
    meta: sourceLabel(person),
    countLabel: formatDate(person.updatedAt),
    iconLabel: initialsFor(person.displayName),
    statusLabel: person.stageLabel,
    selected: Boolean(query.personId && selectedPerson?.id === person.id),
    dataAttributes: {
      "data-people-row": person.id,
    },
  }));
}

function PeopleSelectorOverview({ workspace }: { workspace: BusinessWorkspaceData }) {
  return (
    <div
      className="rounded-lg border border-foreground/10 bg-background/72 p-(--space-3)"
      data-people-selector-overview="true"
    >
      <p className="text-sm font-semibold text-foreground">Overview</p>
      <p className="mt-(--space-1) text-xs leading-5 text-foreground/52">
        {workspace.peopleTotal} people · {workspace.summary.needsAttention} need attention · {workspace.summary.followUp} follow-up
      </p>
    </div>
  );
}

function PeopleBrief({
  userName,
  workspace,
}: {
  userName: string;
  workspace: BusinessWorkspaceData;
}) {
  const metrics = [
    { label: "People", value: workspace.summary.people },
    { label: "Needs attention", value: workspace.summary.needsAttention },
    { label: "Conversations", value: workspace.summary.conversation },
    { label: "Offers", value: workspace.summary.offer },
  ];

  return (
    <section className="grid gap-(--space-5)" data-business-brief="true">
      <header className="max-w-3xl">
        <p className="theme-label tier-micro uppercase text-foreground/42">People</p>
        <h1 className="mt-(--space-2) text-3xl font-semibold tracking-tight text-foreground">
          Relationship selection
        </h1>
        <p className="mt-(--space-2) text-sm leading-6 text-foreground/60">
          {userName} can ask Ordo what to do in chat. This surface keeps relationship evidence selectable, inspectable, and quiet.
        </p>
      </header>

      <section className="grid gap-(--space-2) sm:grid-cols-2 xl:grid-cols-4" aria-label="People overview">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-3)"
          >
            <p className="theme-label tier-micro uppercase text-foreground/42">{metric.label}</p>
            <p className="mt-(--space-1) text-2xl font-semibold text-foreground">{metric.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-dashed border-foreground/14 bg-background/72 p-(--space-inset-panel)">
        <p className="text-sm font-semibold text-foreground">Select a relationship to inspect.</p>
        <p className="mt-(--space-1) max-w-3xl text-sm leading-6 text-foreground/58">
          The second column contains the relationship evidence index. Choose a person to open the current facts, relationship trail, and owner-safe settings.
        </p>
      </section>
    </section>
  );
}

function Pagination({ workspace }: { workspace: BusinessWorkspaceData }) {
  const { query, pageInfo } = workspace;
  if (!pageInfo.hasPreviousPage && !pageInfo.hasNextPage) {
    return null;
  }

  return (
    <nav className="flex items-center justify-between gap-(--space-3)" aria-label="People pagination">
      {pageInfo.hasPreviousPage ? (
        <Link
          href={buildBusinessHref(query, { page: pageInfo.page - 1 })}
          className="focus-ring rounded-full border border-foreground/12 px-(--space-3) py-(--space-1) text-sm font-semibold text-foreground/62"
        >
          Previous
        </Link>
      ) : <span />}
      <span className="text-sm text-foreground/52">
        Page {pageInfo.page}
      </span>
      {pageInfo.hasNextPage ? (
        <Link
          href={buildBusinessHref(query, { page: pageInfo.page + 1 })}
          className="focus-ring rounded-full border border-foreground/12 px-(--space-3) py-(--space-1) text-sm font-semibold text-foreground/62"
        >
          Next
        </Link>
      ) : <span />}
    </nav>
  );
}

export function BusinessWorkspace({
  userName,
  workspace,
}: {
  userName: string;
  workspace: BusinessWorkspaceData;
}) {
  const { query, selectedPerson } = workspace;
  const model: GovernanceSectionModel<PersonReadModelItem, BusinessWorkspaceSummary> = {
    sectionId: "business",
    sectionTitle: "People",
    brief: null,
    summary: workspace.summary,
    objects: workspace.people,
    selectedObject: selectedPerson,
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
      model={model}
      detailRequested={Boolean(query.personId)}
      listHref={buildBusinessHref(query, { personId: null })}
      mobileBackLabel="Back to people"
      rootDataAttributes={{
        "data-business-workspace": "true",
        "data-people-mobile-state": query.personId ? "detail" : "list",
      }}
      selector={{
        ariaLabel: "People selection",
        title: "People",
        guidance: "Select relationship evidence. Chat remains the operating interface.",
        overview: <PeopleSelectorOverview workspace={workspace} />,
        search: {
          action: "/business",
          label: "Search people",
          placeholder: "Search people...",
          defaultValue: query.q,
          hiddenFields: peopleHiddenFields(query, ["q", "personId"]),
        },
        filters: {
          label: "Open People filters",
          action: "/business",
          clearHref: buildBusinessHref(query, {
            stage: null,
            source: null,
            needsAction: null,
            relationshipRole: null,
            affiliateStatus: null,
            page: 1,
          }),
          hiddenFields: peopleHiddenFields(query, ["stage", "source", "needsAction", "relationshipRole", "affiliateStatus"]),
          controls: peopleFilterControls(query),
        },
        items: peopleSelectorItems(workspace),
        emptyTitle: "No people match this view.",
        emptySummary: "Conversations, referrals, offer choices, and contact evidence will appear here.",
        footer: (
          <p data-people-footer-count="true">
            Showing {String(workspace.people.length)} of {String(workspace.peopleTotal)} people
          </p>
        ),
        pagination: <Pagination workspace={workspace} />,
        dataAttributes: {
          "data-people-selection-column": "true",
        },
      }}
      main={{
        ariaLabel: "Selected relationship",
        renderBrief: () => <PeopleBrief userName={userName} workspace={workspace} />,
        renderDetail: (person) => <RelationshipPreview person={person} />,
        missingDetail: {
          title: "Relationship was not found.",
          summary: "Return to the People brief or select another relationship from the evidence index.",
        },
        dataAttributes: {
          "data-people-detail-column": "true",
        },
      }}
    />
  );
}
