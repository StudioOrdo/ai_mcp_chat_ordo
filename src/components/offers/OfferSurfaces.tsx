import Link from "next/link";

import {
  GovernanceSectionFrame,
  SectionBriefPanel,
  type GovernanceFilterControl,
  type GovernanceSelectorItem,
} from "@/components/governance/GovernanceSectionFrame";
import type { Offer, OfferEvent } from "@/core/entities/offer";
import { formatStableUtcShortDateTime } from "@/lib/format/stable-date";
import {
  buildOwnerOffersHref,
  type OwnerOfferObject,
  type OwnerOfferLifecycleStepStatus,
  type OwnerOffersWorkspaceData,
  type OwnerOffersWorkspaceQuery,
  type PublicOffersPageData,
} from "@/lib/offers/load-offers-workspace";
import {
  buildTrackedLinkPath,
  buildTrackedLinkQrPath,
} from "@/lib/tracked-links/tracked-link-origin";

const STATE_FILTER_OPTIONS: GovernanceFilterControl["options"] = [
  { label: "Any", value: null },
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Accepted", value: "accepted" },
  { label: "Purchased", value: "purchased" },
  { label: "Archived", value: "archived" },
];

const VISIBILITY_FILTER_OPTIONS: GovernanceFilterControl["options"] = [
  { label: "Any", value: null },
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
];

const EVENT_LABELS: Record<OfferEvent["eventType"], string> = {
  created: "Created",
  updated: "Updated",
  published: "Published",
  archived: "Archived",
  viewed: "Viewed",
  chosen: "Accepted",
  sent_private: "Sent privately",
  purchase_simulated: "Purchased",
};

export function PublicOffersSurface({ data }: { data: PublicOffersPageData }) {
  return (
    <main className="shell-page editorial-page-shell">
      <div className="site-container px-(--container-padding) py-[clamp(3rem,8vw,6rem)]">
        <section className="max-w-3xl">
          <p className="shell-section-heading mb-4 opacity-60">{data.identityName} offers</p>
          <h1 className="journal-intro-title mb-6">Offers</h1>
          <p className="journal-intro-dek mb-8">
            Clear ways to get help. Each public offer is published by the owner;
            unpublished work stays out of the public view.
          </p>
        </section>

        {data.offers.length > 0 ? (
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {data.offers.map((offer) => (
              <article key={offer.id} className="about-feature-card">
                <p className="about-feature-title">{offer.title}</p>
                <p className="about-feature-body">{offer.summary}</p>
                <dl className="mt-4 grid gap-2 text-sm text-foreground/62">
                  <div>
                    <dt className="font-semibold text-foreground/50">For</dt>
                    <dd>{offer.audience}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground/50">Price</dt>
                    <dd>{offer.priceLabel}</dd>
                  </div>
                </dl>
                <Link
                  href={offer.detailHref}
                  className="shell-nav-guest-link shell-nav-guest-link-primary mt-5 inline-flex px-5"
                >
                  {offer.ctaLabel}
                </Link>
              </article>
            ))}
          </section>
        ) : (
          <section className="profile-feature-surface grid max-w-3xl gap-(--space-3) p-(--space-inset-default)">
            <p className="about-feature-title">No current public offers</p>
            <p className="about-feature-body">
              There are no public offers right now. Start a chat and Ordo can
              help route the request or explain what is available next.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/" className="shell-nav-guest-link shell-nav-guest-link-primary px-5">
                Start chat
              </Link>
              <Link href="/about" className="shell-nav-guest-link shell-nav-guest-link-secondary px-5">
                About Ordo
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export function OwnerOffersWorkspace({
  userName,
  workspace,
}: {
  userName: string;
  workspace: OwnerOffersWorkspaceData;
}) {
  const model = {
    sectionId: "offers",
    sectionTitle: "Offers",
    brief: workspace.brief,
    summary: workspace.summary,
    objects: workspace.filteredObjects,
    selectedObject: workspace.selectedOffer,
    permissions: {
      canView: true,
      canSelect: true,
      canFilter: true,
      canMutate: true,
      canViewDiagnostics: false,
    },
  };
  const detailRequested = Boolean(workspace.query.offerId);

  return (
    <GovernanceSectionFrame
      model={model}
      detailRequested={detailRequested}
      listHref={buildOwnerOffersHref(workspace.query, { offerId: null })}
      mobileBackLabel="Back to offers"
      selector={{
        ariaLabel: "Offer selection",
        title: "Offers",
        guidance: "Select governed offers. Chat creates and revises; this column keeps public, private, draft, and sent offers inspectable.",
        overview: <OffersSelectorOverview workspace={workspace} />,
        search: {
          action: "/offers",
          label: "Search offers",
          placeholder: "Search offers...",
          defaultValue: workspace.query.q,
          hiddenFields: [
            { name: "state", value: workspace.query.state },
            { name: "visibility", value: workspace.query.visibility },
          ],
        },
        filters: {
          label: "Open offer filters",
          action: "/offers",
          clearHref: buildOwnerOffersHref(workspace.query, {
            state: null,
            visibility: null,
            page: 1,
          }),
          hiddenFields: [
            { name: "q", value: workspace.query.q },
          ],
          controls: offerFilterControls(workspace.query),
        },
        items: offerSelectorItems(workspace),
        emptyTitle: "No offers match this view.",
        emptySummary: "Ask Ordo to create an offer in chat, or clear filters to inspect all governed offers.",
        footer: <OfferSelectorFooter workspace={workspace} />,
        pagination: <OfferPagination workspace={workspace} />,
        dataAttributes: {
          "data-offers-selector": true,
        },
      }}
      main={{
        ariaLabel: detailRequested ? "Selected offer" : "Offers brief",
        renderBrief: () => <OffersBrief workspace={workspace} userName={userName} />,
        renderDetail: (object) => <OfferDetail object={object} />,
        missingDetail: {
          title: "Offer was not found.",
          summary: "The offer may have been removed, archived by another owner action, or unavailable to this account.",
        },
        dataAttributes: {
          "data-offers-main-column": true,
        },
      }}
      rootDataAttributes={{
        "data-offers-workspace": true,
      }}
    />
  );
}

function offerFilterControls(query: OwnerOffersWorkspaceQuery): GovernanceFilterControl[] {
  return [
    {
      id: "offers-state-filter",
      label: "State",
      name: "state",
      value: query.state,
      options: STATE_FILTER_OPTIONS,
    },
    {
      id: "offers-visibility-filter",
      label: "Visibility",
      name: "visibility",
      value: query.visibility,
      options: VISIBILITY_FILTER_OPTIONS,
    },
  ];
}

function offerSelectorItems(workspace: OwnerOffersWorkspaceData): GovernanceSelectorItem[] {
  return workspace.filteredObjects.map((object) => ({
    id: object.id,
    href: buildOwnerOffersHref(workspace.query, { offerId: object.id }),
    title: object.offer.title,
    summary: `${object.priceLabel} · ${object.offer.audience}`,
    meta: formatDate(object.latestEventAt),
    iconLabel: iconLabelForOffer(object),
    statusLabel: object.statusLabel,
    selected: workspace.selectedOffer?.id === object.id,
    countLabel: object.visibilityLabel,
    dataAttributes: {
      "data-offer-visibility": object.offer.visibility,
      "data-offer-status": object.offer.status,
    },
  }));
}

function iconLabelForOffer(object: OwnerOfferObject): string {
  if (object.stateLabels.includes("purchased")) return "$";
  if (object.stateLabels.includes("accepted")) return "A";
  if (object.stateLabels.includes("sent")) return "S";
  if (object.stateLabels.includes("public")) return "P";
  if (object.stateLabels.includes("archived")) return "H";
  return "O";
}

function formatDate(value: string): string {
  return formatStableUtcShortDateTime(value) ?? value;
}

function OffersSelectorOverview({ workspace }: { workspace: OwnerOffersWorkspaceData }) {
  const { summary } = workspace;
  return (
    <div className="rounded-lg border border-foreground/10 bg-background/74 p-(--space-3)" data-offers-selector-overview="true">
      <p className="text-sm font-semibold text-foreground">Offer Brief</p>
      <p className="mt-(--space-1) text-xs leading-5 text-foreground/52">
        {summary.total} total · {summary.public} public · {summary.private} private · {summary.draft} draft
      </p>
      {summary.missingPrice > 0 ? (
        <p className="mt-(--space-2) text-xs font-semibold text-foreground/58">
          {summary.missingPrice} need price review
        </p>
      ) : null}
    </div>
  );
}

function OfferSelectorFooter({ workspace }: { workspace: OwnerOffersWorkspaceData }) {
  return (
    <p data-offers-footer-count="true">
      Showing {workspace.filteredObjects.length} of {workspace.pageInfo.total} offers.
    </p>
  );
}

function OfferPagination({ workspace }: { workspace: OwnerOffersWorkspaceData }) {
  const { query, pageInfo } = workspace;
  if (!pageInfo.hasPreviousPage && !pageInfo.hasNextPage) {
    return null;
  }

  return (
    <nav className="mt-(--space-3) flex items-center justify-between gap-(--space-3)" aria-label="Offer pagination">
      {pageInfo.hasPreviousPage ? (
        <Link
          href={buildOwnerOffersHref(query, { page: pageInfo.page - 1 })}
          className="focus-ring rounded-full border border-foreground/12 px-(--space-3) py-(--space-1) text-sm font-semibold text-foreground/62"
        >
          Previous
        </Link>
      ) : <span />}
      <span>Page {pageInfo.page}</span>
      {pageInfo.hasNextPage ? (
        <Link
          href={buildOwnerOffersHref(query, { page: pageInfo.page + 1 })}
          className="focus-ring rounded-full border border-foreground/12 px-(--space-3) py-(--space-1) text-sm font-semibold text-foreground/62"
        >
          Next
        </Link>
      ) : <span />}
    </nav>
  );
}

function OffersBrief({
  workspace,
  userName,
}: {
  workspace: OwnerOffersWorkspaceData;
  userName: string;
}) {
  return (
    <div className="grid max-w-5xl gap-(--space-5)" data-offers-brief="true">
      <SectionBriefPanel brief={workspace.brief} />
      <CreateOfferPanel userName={userName} />
    </div>
  );
}

function CreateOfferPanel({ userName }: { userName: string }) {
  return (
    <section
      id="create-offer"
      className="grid gap-(--space-4) rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-default)"
      aria-label="Create offer"
      data-offer-create-panel="true"
    >
      <div>
        <p className="theme-label tier-micro uppercase text-foreground/42">Governed fallback</p>
        <h2 className="mt-(--space-1) text-lg font-semibold text-foreground">Create an offer</h2>
        <p className="mt-(--space-1) max-w-3xl text-sm leading-6 text-foreground/58">
          The fastest path is still chat. This form gives {userName} exact control
          over price, visibility, and publish readiness when structured review is needed.
        </p>
      </div>
      <OfferEditForm mode="create" />
    </section>
  );
}

function OfferDetail({ object }: { object: OwnerOfferObject }) {
  return (
    <article
      className="grid max-w-6xl gap-(--space-5)"
      data-offer-detail={object.offer.id}
    >
      <OfferDetailHeader object={object} />
      <OfferFacts object={object} />
      <div className="grid gap-(--space-5) xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] xl:items-start">
        <div className="grid gap-(--space-5)">
          <OfferCopy object={object} />
          <AcceptedOfferLifecycle object={object} />
          <OfferEvidenceTrail object={object} />
        </div>
        <div className="grid gap-(--space-5)">
          <OfferSharingCard object={object} />
          <OfferActionPanel object={object} />
        </div>
      </div>
    </article>
  );
}

function OfferDetailHeader({ object }: { object: OwnerOfferObject }) {
  return (
    <header className="max-w-4xl" data-offer-detail-header="true">
      <p className="theme-label tier-micro uppercase text-foreground/42">Selected offer</p>
      <div className="mt-(--space-2) flex flex-wrap items-center gap-(--space-2)">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {object.offer.title}
        </h1>
        <OfferBadge>{object.statusLabel}</OfferBadge>
        <OfferBadge>{object.visibilityLabel}</OfferBadge>
      </div>
      <p className="mt-(--space-2) max-w-3xl text-sm leading-6 text-foreground/62 sm:text-base">
        {object.offer.summary}
      </p>
      <p className="mt-(--space-2) text-sm font-semibold text-foreground/58">
        Next action: {object.nextActionLabel}
      </p>
    </header>
  );
}

function OfferBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-foreground/10 bg-foreground/[0.035] px-(--space-2) py-[0.16rem] text-[0.7rem] font-semibold text-foreground/58">
      {children}
    </span>
  );
}

function OfferFacts({ object }: { object: OwnerOfferObject }) {
  const facts = [
    { label: "Price", value: object.priceLabel },
    { label: "Visibility", value: object.visibilityLabel },
    { label: "Audience", value: object.offer.audience },
    { label: "Status", value: object.offer.status === "ready" ? "Ready for review" : object.statusLabel },
    { label: "Source", value: object.sourceLabel, href: object.sourceHref },
  ];

  return (
    <dl
      className="grid gap-(--space-2) border-y border-foreground/10 py-(--space-4) sm:grid-cols-2 xl:grid-cols-5"
      data-offer-facts-row="true"
    >
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
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

function OfferCopy({ object }: { object: OwnerOfferObject }) {
  return (
    <section className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-default)" data-offer-copy="true">
      <p className="theme-label tier-micro uppercase text-foreground/42">Offer</p>
      <h2 className="mt-(--space-1) text-xl font-semibold tracking-tight text-foreground">
        Promise and buyer path
      </h2>
      <p className="mt-(--space-3) text-sm font-semibold text-foreground/78">{object.offer.promise}</p>
      <p className="mt-(--space-2) whitespace-pre-wrap text-sm leading-6 text-foreground/62">
        {object.offer.description}
      </p>
      {object.offer.estimatedMinutes ? (
        <p className="mt-(--space-3) text-xs text-foreground/46">
          Estimated time: {object.offer.estimatedMinutes} minutes
        </p>
      ) : null}
    </section>
  );
}

const LIFECYCLE_STATUS_LABELS: Record<OwnerOfferLifecycleStepStatus, string> = {
  complete: "Complete",
  pending: "Pending",
  limited: "Limited",
  inactive: "Inactive",
};

function AcceptedOfferLifecycle({ object }: { object: OwnerOfferObject }) {
  const { lifecycle } = object;

  return (
    <section
      className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-default)"
      data-offer-lifecycle={lifecycle.active ? "active" : "inactive"}
      aria-labelledby={`offer-lifecycle-${object.offer.id}`}
    >
      <p className="theme-label tier-micro uppercase text-foreground/42">Accepted offer</p>
      <div className="mt-(--space-1) flex flex-wrap items-center justify-between gap-(--space-2)">
        <h2 id={`offer-lifecycle-${object.offer.id}`} className="text-xl font-semibold tracking-tight text-foreground">
          Lifecycle
        </h2>
        <OfferBadge>{lifecycle.stateLabel}</OfferBadge>
      </div>
      <p className="mt-(--space-2) text-sm leading-6 text-foreground/62">
        {lifecycle.active
          ? "This lens shows durable accepted-offer evidence and the fulfillment path that still needs owner or Studio work."
          : "This offer has not reached accepted-offer lifecycle yet."}
      </p>
      <ol className="mt-(--space-4) grid gap-(--space-3)">
        {lifecycle.steps.map((step) => (
          <li key={step.id} className="grid gap-(--space-1) border-l border-foreground/12 pl-(--space-3)">
            <div className="flex flex-wrap items-center justify-between gap-(--space-2)">
              <p className="text-sm font-semibold text-foreground">{step.label}</p>
              <span className="text-xs font-semibold text-foreground/48">
                {LIFECYCLE_STATUS_LABELS[step.status]}
              </span>
            </div>
            <p className="text-sm leading-6 text-foreground/62">{step.summary}</p>
            <div className="flex flex-wrap items-center gap-(--space-2)">
              {step.occurredAt ? (
                <time className="text-xs text-foreground/46" dateTime={step.occurredAt}>
                  {formatDate(step.occurredAt)}
                </time>
              ) : null}
              {step.sourceHref && step.sourceLabel ? (
                <Link
                  href={step.sourceHref}
                  className="focus-ring inline-flex w-fit text-xs font-semibold text-foreground/56 underline decoration-foreground/20 underline-offset-4 hover:text-foreground"
                >
                  {step.sourceLabel}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {lifecycle.limitations.length > 0 ? (
        <ul className="mt-(--space-4) grid gap-(--space-2)" aria-label="Lifecycle limitations">
          {lifecycle.limitations.map((limitation) => (
            <li key={limitation} className="rounded-lg border border-foreground/10 bg-foreground/[0.025] px-(--space-3) py-(--space-2) text-sm leading-6 text-foreground/58">
              {limitation}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function OfferSharingCard({ object }: { object: OwnerOfferObject }) {
  const isPublic = Boolean(object.publicHref);

  return (
    <aside
      className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-default)"
      data-offer-sharing-card="true"
    >
      <p className="theme-label tier-micro uppercase text-foreground/42">Visibility</p>
      <h2 className="mt-(--space-1) text-lg font-semibold tracking-tight text-foreground">
        {isPublic ? "Public link and QR" : "Private audience"}
      </h2>
      {isPublic && object.publicHref ? (
        <div className="mt-(--space-4) grid gap-(--space-3)">
          <Link href={object.publicHref} className="btn-secondary min-h-10 w-fit">
            Open public offer
          </Link>
          <form action="/api/tracked-links" method="post">
            <input type="hidden" name="targetKind" value="offer" />
            <input type="hidden" name="targetId" value={object.offer.id} />
            <input type="hidden" name="label" value={`${object.offer.title} QR`} />
            <input type="hidden" name="purpose" value="offer" />
            <button type="submit" className="btn-primary min-h-10 w-full">
              Create QR / tracked link
            </button>
          </form>
          {object.trackedLinks.length > 0 ? (
            <ul className="grid gap-(--space-2)">
              {object.trackedLinks.map(({ link, performance }) => (
                <li key={link.id} className="rounded-lg border border-foreground/10 bg-foreground/[0.025] p-(--space-3)">
                  <p className="text-sm font-semibold text-foreground">{link.label}</p>
                  <p className="mt-(--space-1) break-all text-xs text-foreground/52">{buildTrackedLinkPath(link.code)}</p>
                  <p className="mt-(--space-1) text-xs text-foreground/46">
                    {performance.visits} visits · {performance.offerViews} views · {performance.offerChoices} choices
                  </p>
                  <Link
                    href={buildTrackedLinkQrPath(link.code)}
                    className="mt-(--space-2) inline-flex text-xs font-semibold text-foreground/58 underline decoration-foreground/20 underline-offset-4 hover:text-foreground"
                  >
                    Open QR
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-6 text-foreground/58">
              No tracked link has been created for this public offer yet.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-(--space-4) grid gap-(--space-3)">
          {object.relationshipLinks.length > 0 ? (
            <ul className="grid gap-(--space-2)">
              {object.relationshipLinks.map((link) => (
                <li key={link.id}>
                  <Link
                    href={link.href}
                    className="text-sm font-semibold text-foreground/70 underline decoration-foreground/20 underline-offset-4 hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-6 text-foreground/58">
              No private recipient evidence has been recorded yet.
            </p>
          )}
          <Link
            href={`/?prompt=${encodeURIComponent(`Help me send or revise the private offer "${object.offer.title}".`)}`}
            className="btn-secondary min-h-10 w-fit"
          >
            Discuss in chat
          </Link>
        </div>
      )}
    </aside>
  );
}

function eventSummary(event: OfferEvent): string {
  switch (event.eventType) {
    case "created":
      return "Offer draft was created.";
    case "updated":
      return "Offer details were updated.";
    case "published":
      return "Offer became visible on the public offer surface.";
    case "archived":
      return "Offer was removed from active selling surfaces.";
    case "viewed":
      return "A public offer view was recorded.";
    case "chosen":
      return "A visitor or relationship accepted the offer.";
    case "sent_private":
      return "Offer was sent as a private proposal.";
    case "purchase_simulated":
      return "A simulated purchase was recorded.";
  }
}

function eventHref(event: OfferEvent): { href: string; label: string } | null {
  if (event.conversationId) {
    return {
      href: `/business/conversations/${encodeURIComponent(event.conversationId)}`,
      label: "Open conversation",
    };
  }
  if (event.personRef) {
    return {
      href: `/business/people/${encodeURIComponent(event.personRef)}`,
      label: "Open person",
    };
  }
  return null;
}

function OfferEvidenceTrail({ object }: { object: OwnerOfferObject }) {
  if (object.events.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-foreground/14 bg-background/72 p-(--space-inset-default)" data-offer-evidence-trail="empty">
        <p className="text-sm font-semibold text-foreground">Offer Trail</p>
        <p className="mt-(--space-1) text-sm leading-6 text-foreground/58">
          No durable offer events have been recorded yet.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-default)"
      data-offer-evidence-trail="true"
      aria-labelledby={`offer-trail-${object.offer.id}`}
    >
      <p className="theme-label tier-micro uppercase text-foreground/42">Evidence</p>
      <h2 id={`offer-trail-${object.offer.id}`} className="mt-(--space-1) text-xl font-semibold tracking-tight text-foreground">
        Offer Trail
      </h2>
      <ol className="mt-(--space-4) grid gap-(--space-3)">
        {object.events.map((event) => {
          const source = eventHref(event);
          return (
            <li key={event.id} className="grid gap-(--space-1) border-l border-foreground/12 pl-(--space-3)">
              <div className="flex flex-wrap items-center justify-between gap-(--space-2)">
                <p className="text-sm font-semibold text-foreground">{EVENT_LABELS[event.eventType]}</p>
                <time className="text-xs text-foreground/46" dateTime={event.createdAt}>
                  {formatDate(event.createdAt)}
                </time>
              </div>
              <p className="text-sm leading-6 text-foreground/62">{eventSummary(event)}</p>
              {source ? (
                <Link
                  href={source.href}
                  className="focus-ring inline-flex w-fit text-xs font-semibold text-foreground/56 underline decoration-foreground/20 underline-offset-4 hover:text-foreground"
                >
                  {source.label}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function canPublishOffer(offer: Offer): boolean {
  if (offer.status === "archived") {
    return false;
  }
  if (!offer.title.trim() || !offer.ctaLabel.trim()) {
    return false;
  }
  if (!offer.promise.trim() && !offer.description.trim()) {
    return false;
  }
  if ((offer.billingKind === "fixed" || offer.billingKind === "hourly")
    && (!Number.isInteger(offer.priceCents) || (offer.priceCents ?? 0) <= 0)) {
    return false;
  }
  return offer.status !== "published";
}

function OfferActionPanel({ object }: { object: OwnerOfferObject }) {
  const { offer } = object;
  const canPublish = canPublishOffer(offer);

  return (
    <aside
      id="edit-offer"
      className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-default)"
      data-offer-actions="true"
    >
      <p className="theme-label tier-micro uppercase text-foreground/42">Actions</p>
      <h2 className="mt-(--space-1) text-lg font-semibold tracking-tight text-foreground">
        Govern this offer
      </h2>
      <div className="mt-(--space-4) grid gap-(--space-3)">
        <div className="flex flex-wrap gap-(--space-2)">
          {canPublish ? (
            <form action={`/api/offers/${encodeURIComponent(offer.id)}`} method="post">
              <input type="hidden" name="action" value="publish" />
              <button type="submit" className="btn-primary min-h-10">
                Publish
              </button>
            </form>
          ) : offer.status !== "published" && offer.status !== "archived" ? (
            <p className="rounded-lg border border-foreground/10 bg-foreground/[0.025] px-(--space-3) py-(--space-2) text-sm text-foreground/58">
              Add price, free billing, or contact billing before publishing.
            </p>
          ) : null}
          {offer.status !== "archived" ? (
            <form action={`/api/offers/${encodeURIComponent(offer.id)}`} method="post">
              <input type="hidden" name="action" value="archive" />
              <button type="submit" className="btn-secondary min-h-10">
                Archive
              </button>
            </form>
          ) : null}
        </div>

        <details className="rounded-lg border border-foreground/10 bg-background/76 p-(--space-3)">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            Edit offer details
          </summary>
          <div className="mt-(--space-3)">
            <OfferEditForm mode="update" offer={offer} />
          </div>
        </details>
      </div>
    </aside>
  );
}

function OfferEditForm({
  mode,
  offer,
}: {
  mode: "create" | "update";
  offer?: Offer;
}) {
  const priceValue = offer && typeof offer.priceCents === "number" && offer.priceCents > 0
    ? String(offer.priceCents / 100)
    : "";
  const action = mode === "create"
    ? "/api/offers"
    : `/api/offers/${encodeURIComponent(offer?.id ?? "")}`;

  return (
    <form action={action} method="post" className="grid gap-(--space-3)">
      {mode === "update" ? <input type="hidden" name="action" value="update" /> : null}
      <div className="grid gap-(--space-3) md:grid-cols-2">
        <FormField name="title" label="Title" required placeholder="Strategy call" defaultValue={offer?.title} />
        <FormField name="audience" label="Audience" placeholder="Solopreneurs with messy AI workflows" defaultValue={offer?.audience} />
        <FormField name="promise" label="Promise" placeholder="Turn a messy workflow into a repeatable process" defaultValue={offer?.promise} />
        <FormField name="summary" label="Summary" placeholder="A focused session to clarify the next best move" defaultValue={offer?.summary} />
        <FormField name="price" label="Price in dollars" inputMode="decimal" placeholder="500" defaultValue={priceValue} />
        <FormField name="estimatedMinutes" label="Estimated minutes" inputMode="numeric" placeholder="90" defaultValue={offer?.estimatedMinutes ?? ""} />
      </div>
      <label className="grid gap-1 text-sm font-semibold text-foreground/62">
        Billing
        <select name="billingKind" defaultValue={offer?.billingKind ?? "fixed"} className="input-field min-h-11">
          <option value="fixed">Fixed price</option>
          <option value="hourly">Hourly</option>
          <option value="free">Free</option>
          <option value="contact">Contact for price</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold text-foreground/62">
        Description
        <textarea
          name="description"
          rows={4}
          className="input-field min-h-28"
          placeholder="Describe what the buyer gets and what happens next."
          defaultValue={offer?.description}
        />
      </label>
      <div className="grid gap-(--space-3) md:grid-cols-2">
        <FormField name="ctaLabel" label="CTA label" placeholder="Start a conversation" defaultValue={offer?.ctaLabel} />
        <label className="grid gap-1 text-sm font-semibold text-foreground/62">
          Visibility
          <select name="visibility" defaultValue={offer?.visibility ?? "private"} className="input-field min-h-11">
            <option value="private">Private draft</option>
            <option value="public">Public after publish</option>
          </select>
        </label>
      </div>
      <button type="submit" className={mode === "create" ? "btn-primary min-h-11 w-full sm:w-fit" : "btn-secondary min-h-10 w-full sm:w-fit"}>
        {mode === "create" ? "Save draft" : "Save changes"}
      </button>
    </form>
  );
}

function FormField({
  name,
  label,
  required,
  placeholder,
  inputMode,
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
  defaultValue?: string | number | null;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-foreground/62">
      {label}
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        defaultValue={defaultValue ?? ""}
        className="input-field min-h-11"
      />
    </label>
  );
}
