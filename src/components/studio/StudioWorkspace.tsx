import Link from "next/link";

import {
  GovernanceSectionFrame,
  type GovernanceFilterControl,
  type GovernanceSectionModel,
  type GovernanceSelectorItem,
} from "@/components/governance/GovernanceSectionFrame";
import {
  MediaAssetDetail,
  type MediaRelatedLink,
} from "@/components/media/MediaAssetDetail";
import type {
  OrdoCard as OrdoCardModel,
  OrdoCardKind,
  OrdoSourceRef,
} from "@/lib/ordo-cards/ordo-card-types";
import type {
  StudioWorkspaceData,
  StudioWorkspaceQuery,
  StudioWorkspaceSummary,
} from "@/lib/studio/load-studio-workspace";
import { formatStableUpdatedAt } from "@/lib/format/stable-date";

const BUCKET_FILTERS: Array<{ label: string; bucket: StudioWorkspaceQuery["bucket"] }> = [
  { label: "All", bucket: null },
  { label: "Needs attention", bucket: "needs_attention" },
  { label: "In motion", bucket: "in_motion" },
  { label: "Produced", bucket: "produced" },
  { label: "History", bucket: "history" },
];

const KIND_FILTERS: Array<{ label: string; kind: StudioWorkspaceQuery["kind"] }> = [
  { label: "All work", kind: null },
  { label: "Workflows", kind: "workflow_run" },
  { label: "Media", kind: "media_asset" },
  { label: "Content", kind: "content_item" },
  { label: "Campaigns", kind: "campaign" },
];

const KIND_LABELS: Record<OrdoCardKind, string> = {
  media_asset: "Media",
  content_item: "Content",
  workflow_run: "Workflow",
  operation: "Work",
  person: "Person",
  offer: "Offer",
  tracked_link: "Link",
  campaign: "Campaign",
  conversation: "Conversation",
  backup: "Backup",
  restore_plan: "Restore",
  system: "System",
};

function buildStudioHref(query: Partial<StudioWorkspaceQuery> = {}): string {
  const searchParams = new URLSearchParams();

  if (query.bucket) searchParams.set("bucket", query.bucket);
  if (query.kind) searchParams.set("kind", query.kind);
  if (query.q) searchParams.set("q", query.q);
  if (query.objectId) searchParams.set("object", query.objectId);
  if (query.page && query.page > 1) searchParams.set("page", String(query.page));
  if (query.limit && query.limit !== 20) searchParams.set("limit", String(query.limit));

  const queryString = searchParams.toString();
  return queryString ? `/studio?${queryString}` : "/studio";
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-background/80 p-(--space-3)">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/42">
        {label}
      </dt>
      <dd className="mt-(--space-1) text-2xl font-semibold text-foreground">
        {String(value)}
      </dd>
    </div>
  );
}

function StudioSummary({ summary }: { summary: StudioWorkspaceSummary }) {
  return (
    <dl className="grid gap-(--space-2) sm:grid-cols-3 lg:grid-cols-8">
      <SummaryMetric label="Total" value={summary.total} />
      <SummaryMetric label="Attention" value={summary.needsAttention} />
      <SummaryMetric label="In motion" value={summary.inMotion} />
      <SummaryMetric label="Produced" value={summary.produced} />
      <SummaryMetric label="Workflows" value={summary.workflows} />
      <SummaryMetric label="Assets" value={summary.assets} />
      <SummaryMetric label="Content" value={summary.content} />
      <SummaryMetric label="Campaigns" value={summary.campaigns} />
    </dl>
  );
}

function StudioSelectionPagination({
  pageInfo,
  query,
}: {
  pageInfo: StudioWorkspaceData["pageInfo"];
  query: StudioWorkspaceQuery;
}) {
  if (!pageInfo.hasPreviousPage && !pageInfo.hasNextPage) {
    return null;
  }

  return (
    <nav className="mt-(--space-3) flex items-center justify-between gap-(--space-2)" aria-label="Studio pagination">
      {pageInfo.hasPreviousPage ? (
        <Link
          href={buildStudioHref({ ...query, objectId: null, page: pageInfo.page - 1 })}
          className="focus-ring rounded-full border border-foreground/12 px-(--space-3) py-(--space-1) text-xs font-semibold text-foreground/62"
        >
          Previous
        </Link>
      ) : <span />}
      <span className="text-xs text-foreground/46">
        Page {pageInfo.page}
      </span>
      {pageInfo.hasNextPage ? (
        <Link
          href={buildStudioHref({ ...query, objectId: null, page: pageInfo.page + 1 })}
          className="focus-ring rounded-full border border-foreground/12 px-(--space-3) py-(--space-1) text-xs font-semibold text-foreground/62"
        >
          Next
        </Link>
      ) : <span />}
    </nav>
  );
}

function StudioSelectorOverview({ summary }: { summary: StudioWorkspaceSummary }) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-background/74 p-(--space-3)" data-studio-selector-overview="true">
      <p className="text-sm font-semibold text-foreground">Overview</p>
      <p className="mt-(--space-1) text-xs leading-5 text-foreground/52">
        {summary.total} total · {summary.assets} media · {summary.workflows} workflows
      </p>
    </div>
  );
}

function studioFilterControls(query: StudioWorkspaceQuery): GovernanceFilterControl[] {
  return [
    {
      id: "studio-kind-filter",
      label: "Studio kind",
      name: "kind",
      value: query.kind,
      options: KIND_FILTERS.map((filter) => ({
        label: filter.label,
        value: filter.kind,
      })),
    },
    {
      id: "studio-bucket-filter",
      label: "Studio status",
      name: "bucket",
      value: query.bucket,
      options: BUCKET_FILTERS.map((filter) => ({
        label: filter.label,
        value: filter.bucket,
      })),
    },
  ];
}

function studioSelectorItems(
  cards: StudioWorkspaceData["cards"],
  query: StudioWorkspaceQuery,
  selectedCard: StudioWorkspaceData["selectedCard"],
): GovernanceSelectorItem[] {
  return cards.map((card) => ({
    id: card.id,
    href: buildStudioHref({ ...query, objectId: card.id, page: query.page }),
    title: card.title,
    summary: card.summary,
    meta: ownerSafeStatusLabel(card.status),
    countLabel: formatStableUpdatedAt(card.updatedAt),
    iconLabel: KIND_LABELS[card.kind].slice(0, 1),
    statusLabel: KIND_LABELS[card.kind],
    selected: selectedCard?.id === card.id,
    dataAttributes: {
      "data-studio-row": card.id,
    },
  }));
}

function StudioOverview({
  summary,
  userName,
}: {
  summary: StudioWorkspaceSummary;
  userName: string;
}) {
  return (
    <section className="grid gap-(--space-5)" data-studio-overview="true">
      <header className="grid gap-(--space-3)">
        <p className="theme-label tier-micro uppercase text-foreground/42">Studio</p>
        <h1 className="theme-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Production Brief
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-foreground/62 sm:text-base">
          Review generated media, active workflows, and production work owned by {userName}. Select an item in the Studio column to inspect one object and its evidence.
        </p>
      </header>

      <section aria-label="Studio summary">
        <StudioSummary summary={summary} />
      </section>
    </section>
  );
}

const RELATED_SOURCE_LABELS: Partial<Record<OrdoSourceRef["sourceKind"], string>> = {
  artifact: "Output",
  blog_asset: "Content asset",
  blog_post: "Content",
  campaign: "Campaign",
  conversation: "Source conversation",
  materialization: "Saved output",
  media_workflow: "Source workflow",
  tracked_link: "Shared link",
  user_file: "Stored asset",
  job: "Producing work",
};

function ownerSafeStatusLabel(status: OrdoCardModel["status"]): string {
  switch (status) {
    case "queued":
      return "Waiting";
    case "running":
      return "In motion";
    case "needs_review":
      return "Needs review";
    case "blocked":
      return "Needs attention";
    case "failed":
      return "Needs attention";
    case "succeeded":
      return "Ready";
    case "published":
      return "Published";
    case "draft":
      return "Draft";
    case "archived":
      return "Archived";
    case "unavailable":
      return "Unavailable";
    case "canceled":
      return "Canceled";
  }
}

function legacyOwnerHrefToStudioHref(href: string): string | undefined {
  if (href.startsWith("/jobs")) {
    const url = new URL(href, "http://ordo.local");
    const workflowId = url.searchParams.get("sourceKind") === "media_workflow"
      ? url.searchParams.get("sourceId")
      : null;
    const jobId = url.searchParams.get("jobId")
      ?? (url.searchParams.get("sourceKind") === "job" ? url.searchParams.get("sourceId") : null);

    if (workflowId) {
      return buildStudioHref({ objectId: `workflow_run:media_workflow:${workflowId}` });
    }

    if (jobId) {
      return buildStudioHref({ objectId: `workflow_run:job:${jobId}` });
    }

    return buildStudioHref({ kind: "workflow_run" });
  }

  if (href.startsWith("/my/media")) {
    const url = new URL(href, "http://ordo.local");
    const assetId = url.searchParams.get("assetId")
      ?? url.searchParams.get("id")
      ?? url.searchParams.get("object");

    return buildStudioHref({
      kind: "media_asset",
      objectId: assetId
        ? assetId.startsWith("media_asset:")
          ? assetId
          : `media_asset:${assetId}`
        : null,
    });
  }

  return undefined;
}

function ownerSafeHref(ref: OrdoSourceRef): string | undefined {
  if (!ref.href) {
    return undefined;
  }

  return legacyOwnerHrefToStudioHref(ref.href) ?? ref.href;
}

function relatedLinksForCard(card: OrdoCardModel): MediaRelatedLink[] {
  const seen = new Set<string>();
  const links: MediaRelatedLink[] = [];

  for (const ref of [...card.provenanceRefs, ...card.sourceRefs]) {
    const key = `${ref.sourceKind}:${ref.sourceId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    if (ref.sourceKind === "asset_catalog") {
      continue;
    }

    links.push({
      id: key,
      label: RELATED_SOURCE_LABELS[ref.sourceKind] ?? ref.label ?? "Related evidence",
      href: ownerSafeHref(ref),
    });
  }

  return links;
}

function safeActions(card: OrdoCardModel) {
  const actions = [
    ...(card.primaryAction ? [card.primaryAction] : []),
    ...(card.secondaryActions ?? []),
  ];

  return actions
    .map((action) => {
      if (!action.href) {
        return null;
      }

      return {
        ...action,
        href: legacyOwnerHrefToStudioHref(action.href) ?? action.href,
      };
    })
    .filter((action): action is NonNullable<typeof action> => action !== null);
}

function StudioWorkDetail({ card }: { card: OrdoCardModel }) {
  const relatedLinks = relatedLinksForCard(card);
  const outputLinks = relatedLinks.filter((link) => link.label === "Output" || link.label === "Stored asset");
  const actions = safeActions(card);

  return (
    <section className="grid gap-(--space-5)" data-studio-work-detail="true" data-studio-selected-object="true">
      <header className="max-w-3xl">
        <p className="theme-label tier-micro uppercase text-foreground/42">{KIND_LABELS[card.kind]}</p>
        <h1 className="mt-(--space-2) text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {card.title}
        </h1>
        <p className="mt-(--space-2) text-sm leading-6 text-foreground/60">
          {card.summary}
        </p>
      </header>

      <dl className="grid gap-(--space-3) rounded-lg border border-foreground/10 bg-background/72 p-(--space-4) sm:grid-cols-3">
        <div>
          <dt className="theme-label tier-micro uppercase text-foreground/42">Status</dt>
          <dd className="mt-(--space-1) text-sm font-semibold text-foreground">{ownerSafeStatusLabel(card.status)}</dd>
        </div>
        <div>
          <dt className="theme-label tier-micro uppercase text-foreground/42">Updated</dt>
          <dd className="mt-(--space-1) text-sm text-foreground">{formatStableUpdatedAt(card.updatedAt)}</dd>
        </div>
        <div>
          <dt className="theme-label tier-micro uppercase text-foreground/42">Kind</dt>
          <dd className="mt-(--space-1) text-sm text-foreground">{KIND_LABELS[card.kind]}</dd>
        </div>
      </dl>

      {outputLinks.length > 0 ? (
        <section className="rounded-lg border border-foreground/10 bg-background/72 p-(--space-4)" aria-label="Related outputs">
          <p className="theme-label tier-micro uppercase text-foreground/42">Related outputs</p>
          <div className="mt-(--space-3) flex flex-wrap gap-(--space-2)">
            {outputLinks.map((link) => link.href ? (
              <Link
                key={link.id}
                href={link.href}
                className="focus-ring inline-flex min-h-9 items-center rounded-full border border-foreground/12 px-(--space-3) text-xs font-semibold text-foreground/64 transition hover:bg-foreground/5"
              >
                {link.label}
              </Link>
            ) : (
              <span key={link.id} className="inline-flex min-h-9 items-center rounded-full border border-foreground/10 px-(--space-3) text-xs font-semibold text-foreground/48">
                {link.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {relatedLinks.length > 0 ? (
        <section className="rounded-lg border border-foreground/10 bg-background/72 p-(--space-4)" aria-label="Studio evidence">
          <p className="theme-label tier-micro uppercase text-foreground/42">Evidence</p>
          <div className="mt-(--space-3) flex flex-wrap gap-(--space-2)">
            {relatedLinks.map((link) => link.href ? (
              <Link
                key={link.id}
                href={link.href}
                className="focus-ring inline-flex min-h-9 items-center rounded-full border border-foreground/12 px-(--space-3) text-xs font-semibold text-foreground/64 transition hover:bg-foreground/5"
              >
                {link.label}
              </Link>
            ) : (
              <span key={link.id} className="inline-flex min-h-9 items-center rounded-full border border-foreground/10 px-(--space-3) text-xs font-semibold text-foreground/48">
                {link.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-(--space-2)">
          {actions.map((action) => (
            <Link
              key={action.id}
              href={action.href ?? "#"}
              className="focus-ring inline-flex min-h-10 items-center rounded-full border border-foreground/12 px-(--space-4) text-sm font-semibold text-foreground/64 transition hover:bg-foreground/5"
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SelectedStudioObject({
  card,
  selectedMediaItem,
}: {
  card: OrdoCardModel | null;
  selectedMediaItem: StudioWorkspaceData["selectedMediaItem"];
}) {
  if (!card) {
    return (
      <section className="rounded-lg border border-dashed border-foreground/14 bg-background/72 p-(--space-inset-panel)">
        <p className="text-sm font-semibold text-foreground">No Studio object selected.</p>
        <p className="mt-(--space-1) text-sm leading-6 text-foreground/58">
          Select media or production work from the Studio column.
        </p>
      </section>
    );
  }

  if (card.kind === "media_asset" && selectedMediaItem) {
    return (
      <section className="grid gap-(--space-5)" data-studio-media-detail="true" data-studio-selected-object="true">
        <header className="max-w-3xl">
          <p className="theme-label tier-micro uppercase text-foreground/42">Media</p>
          <h1 className="mt-(--space-2) text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {selectedMediaItem.fileName}
          </h1>
          <p className="mt-(--space-2) text-sm leading-6 text-foreground/60">
            Inspect this asset, play or preview it, and review the evidence that connects it to production work.
          </p>
        </header>
        <MediaAssetDetail
          item={selectedMediaItem}
          relatedLinks={relatedLinksForCard(card)}
          showSectionChrome={false}
        />
      </section>
    );
  }

  return (
    <StudioWorkDetail card={card} />
  );
}

export function StudioWorkspace({
  userName,
  workspace,
}: {
  userName: string;
  workspace: StudioWorkspaceData;
}) {
  const { cards, query, selectedCard, selectedMediaItem, summary } = workspace;
  const sectionModel: GovernanceSectionModel<OrdoCardModel, StudioWorkspaceSummary> = {
    sectionId: "studio",
    sectionTitle: "Studio",
    brief: null,
    summary,
    objects: cards,
    selectedObject: selectedCard,
    permissions: {
      canView: true,
      canSelect: true,
      canFilter: true,
      canViewDiagnostics: false,
    },
  };
  const firstVisible = workspace.pageInfo.total === 0
    ? 0
    : ((workspace.pageInfo.page - 1) * workspace.pageInfo.limit) + 1;
  const lastVisible = Math.min(
    workspace.pageInfo.page * workspace.pageInfo.limit,
    workspace.pageInfo.total,
  );
  const detailRequested = Boolean(query.objectId);

  return (
    <GovernanceSectionFrame
      model={sectionModel}
      detailRequested={detailRequested}
      listHref={buildStudioHref({ ...query, objectId: null })}
      mobileBackLabel="Back to Studio"
      rootDataAttributes={{
        "data-studio-workspace": "true",
        "data-studio-mobile-state": detailRequested ? "detail" : "list",
      }}
      selector={{
        ariaLabel: "Studio selection",
        title: "Studio",
        guidance: "Select production work. Chat creates and changes the work; this column keeps the output inspectable.",
        overview: <StudioSelectorOverview summary={summary} />,
        search: {
          action: "/studio",
          label: "Search Studio media",
          placeholder: "Search Studio...",
          defaultValue: query.q,
          hiddenFields: [
            { name: "bucket", value: query.bucket },
            { name: "kind", value: query.kind },
          ],
        },
        filters: {
          label: "Open Studio filters",
          action: "/studio",
          clearHref: "/studio",
          hiddenFields: [
            { name: "q", value: query.q },
          ],
          controls: studioFilterControls(query),
        },
        items: studioSelectorItems(cards, query, selectedCard),
        emptyTitle: "No Studio objects match this view.",
        emptySummary: "Generated media, content, campaigns, and workflow runs will appear here.",
        footer: (
          <p>
            Showing {firstVisible}
            {"-"}
            {lastVisible} of {workspace.pageInfo.total} Studio objects.
          </p>
        ),
        pagination: <StudioSelectionPagination pageInfo={workspace.pageInfo} query={query} />,
        dataAttributes: {
          "data-studio-selection-column": "true",
        },
      }}
      main={{
        ariaLabel: "Studio production workspace",
        renderBrief: () => <StudioOverview summary={summary} userName={userName} />,
        renderDetail: (card) => <SelectedStudioObject card={card} selectedMediaItem={selectedMediaItem} />,
        missingDetail: {
          title: "No Studio object selected.",
          summary: "Select media or production work from the Studio column.",
        },
        dataAttributes: {
          "data-studio-main-column": "true",
        },
      }}
    />
  );
}
