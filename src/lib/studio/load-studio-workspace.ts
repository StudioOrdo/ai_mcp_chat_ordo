import {
  getJobStatusQuery,
  getMediaWorkflowReadModel,
  getUserFileDataMapper,
} from "@/adapters/RepositoryFactory";
import type { AssetCatalogEntry } from "@/core/entities/asset-catalog";
import { projectUserFileToAssetCatalogEntry } from "@/core/platform/asset-catalog/AssetCatalogProjector";
import type {
  OrdoCard,
  OrdoCardBucket,
  OrdoCardKind,
} from "@/lib/ordo-cards/ordo-card-types";
import {
  projectAssetCatalogEntryToOrdoCard,
  projectContentCampaignToOrdoCard,
  projectContentItemToOrdoCard,
  projectJobSnapshotToOrdoCard,
  projectMediaWorkflowToOrdoCard,
} from "@/lib/ordo-cards/ordo-card-projectors";
import {
  filterPrimaryJobSnapshotsForWorkflows,
} from "@/lib/media/workflows/media-workflow-read-model";
import { loadOwnerContentCampaign } from "@/lib/content/content-campaign-read-model";
import {
  projectUserFileToUserMediaItem,
  type UserMediaItem,
} from "@/lib/media/user-media";

const STUDIO_SOURCE_LIMIT = 100;
const STUDIO_DEFAULT_PAGE_LIMIT = 20;
const STUDIO_MAX_PAGE_LIMIT = 50;

const VALID_BUCKETS = new Set<OrdoCardBucket>([
  "needs_attention",
  "in_motion",
  "produced",
  "business_loop",
  "history",
]);

const VALID_KINDS = new Set<OrdoCardKind>([
  "media_asset",
  "content_item",
  "workflow_run",
  "operation",
  "person",
  "offer",
  "tracked_link",
  "campaign",
  "conversation",
]);

const BUCKET_ORDER: Record<OrdoCardBucket, number> = {
  needs_attention: 0,
  in_motion: 1,
  produced: 2,
  business_loop: 3,
  history: 4,
};

export interface StudioWorkspaceQuery {
  bucket: OrdoCardBucket | null;
  kind: OrdoCardKind | null;
  q: string | null;
  objectId: string | null;
  page: number;
  limit: number;
}

export interface StudioWorkspaceSummary {
  total: number;
  needsAttention: number;
  inMotion: number;
  produced: number;
  workflows: number;
  assets: number;
  content: number;
  campaigns: number;
}

export interface StudioWorkspacePageInfo {
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface StudioWorkspaceData {
  cards: OrdoCard[];
  selectedCard: OrdoCard | null;
  selectedMediaItem: UserMediaItem | null;
  query: StudioWorkspaceQuery;
  summary: StudioWorkspaceSummary;
  pageInfo: StudioWorkspacePageInfo;
}

type RawStudioWorkspaceSearchParams = Record<string, string | string[] | undefined>;

function firstSearchValue(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePage(value: string | string[] | undefined): number {
  const candidate = firstSearchValue(value);
  if (!candidate) {
    return 1;
  }

  const parsed = Number.parseInt(candidate, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value: string | string[] | undefined): number {
  const candidate = firstSearchValue(value);
  if (!candidate) {
    return STUDIO_DEFAULT_PAGE_LIMIT;
  }

  const parsed = Number.parseInt(candidate, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return STUDIO_DEFAULT_PAGE_LIMIT;
  }

  return Math.min(STUDIO_MAX_PAGE_LIMIT, parsed);
}

function normalizeBucket(value: string | string[] | undefined): OrdoCardBucket | null {
  const candidate = firstSearchValue(value);
  return candidate && VALID_BUCKETS.has(candidate as OrdoCardBucket)
    ? candidate as OrdoCardBucket
    : null;
}

function normalizeKind(value: string | string[] | undefined): OrdoCardKind | null {
  const candidate = firstSearchValue(value);
  return candidate && VALID_KINDS.has(candidate as OrdoCardKind)
    ? candidate as OrdoCardKind
    : null;
}

function normalizeSearch(value: string | string[] | undefined): string | null {
  const candidate = firstSearchValue(value);
  return candidate ? candidate.slice(0, 120) : null;
}

function normalizeObjectId(value: string | string[] | undefined): string | null {
  const candidate = firstSearchValue(value);
  return candidate ? candidate.slice(0, 180) : null;
}

export function parseStudioWorkspaceQuery(
  rawSearchParams: RawStudioWorkspaceSearchParams = {},
): StudioWorkspaceQuery {
  return {
    bucket: normalizeBucket(rawSearchParams.bucket),
    kind: normalizeKind(rawSearchParams.kind),
    q: normalizeSearch(rawSearchParams.q),
    objectId: normalizeObjectId(rawSearchParams.object),
    page: normalizePage(rawSearchParams.page),
    limit: normalizeLimit(rawSearchParams.limit),
  };
}

function updatedAtMs(value: string | null | undefined): number {
  const parsed = Date.parse(value ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function includesQuery(fields: Array<string | null | undefined>, query: string | null): boolean {
  if (!query) {
    return true;
  }

  const lowerQuery = query.toLowerCase();
  return fields.some((field) => field?.toLowerCase().includes(lowerQuery));
}

function cardMatchesQuery(card: OrdoCard, query: StudioWorkspaceQuery): boolean {
  if (query.bucket && card.bucket !== query.bucket) {
    return false;
  }

  if (query.kind && card.kind !== query.kind) {
    return false;
  }

  return includesQuery([
    card.id,
    card.title,
    card.summary,
    card.status,
    card.kind,
    card.objectRef.id,
    card.objectRef.label,
    ...card.sourceRefs.flatMap((ref) => [ref.sourceId, ref.label]),
    ...card.provenanceRefs.flatMap((ref) => [ref.sourceId, ref.label]),
  ], query.q);
}

function sortStudioCards(cards: readonly OrdoCard[]): OrdoCard[] {
  return [...cards].sort((left, right) => {
    const bucketDelta = BUCKET_ORDER[left.bucket] - BUCKET_ORDER[right.bucket];
    if (bucketDelta !== 0) {
      return bucketDelta;
    }

    return updatedAtMs(right.updatedAt) - updatedAtMs(left.updatedAt);
  });
}

function buildSummary(cards: readonly OrdoCard[]): StudioWorkspaceSummary {
  return {
    total: cards.length,
    needsAttention: cards.filter((card) => card.bucket === "needs_attention").length,
    inMotion: cards.filter((card) => card.bucket === "in_motion").length,
    produced: cards.filter((card) => card.bucket === "produced").length,
    workflows: cards.filter((card) => card.kind === "workflow_run").length,
    assets: cards.filter((card) => card.kind === "media_asset").length,
    content: cards.filter((card) => card.kind === "content_item").length,
    campaigns: cards.filter((card) => card.kind === "campaign").length,
  };
}

function mediaAssetStudioSummary(entry: AssetCatalogEntry): string {
  const sourceLabel = entry.conversationId
    ? "attached to a conversation"
    : entry.source === "generated"
      ? "generated by Ordo"
      : entry.source === "derived"
        ? "derived from prior work"
        : "uploaded by the owner";

  return `${entry.kind} asset · ${sourceLabel}`;
}

function paginateCards(
  cards: readonly OrdoCard[],
  query: StudioWorkspaceQuery,
): { cards: OrdoCard[]; pageInfo: StudioWorkspacePageInfo } {
  const total = cards.length;
  const pageCount = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * query.limit;

  return {
    cards: cards.slice(start, start + query.limit),
    pageInfo: {
      page,
      limit: query.limit,
      total,
      hasNextPage: page < pageCount,
      hasPreviousPage: page > 1,
    },
  };
}

export async function loadStudioWorkspace(
  userId: string,
  rawSearchParams: RawStudioWorkspaceSearchParams = {},
): Promise<StudioWorkspaceData> {
  const query = parseStudioWorkspaceQuery(rawSearchParams);
  const fileRepository = getUserFileDataMapper();

  const [jobs, workflows, files, campaign] = await Promise.all([
    getJobStatusQuery().listUserJobSnapshots(userId, { limit: STUDIO_SOURCE_LIMIT }),
    getMediaWorkflowReadModel().listUserWorkflows(userId, { limit: STUDIO_SOURCE_LIMIT }),
    fileRepository.listForUser(userId, {
      limit: STUDIO_SOURCE_LIMIT,
      ...(query.q ? { search: query.q } : {}),
    }),
    loadOwnerContentCampaign(userId),
  ]);

  const workflowCards = workflows.map((workflow) => projectMediaWorkflowToOrdoCard(workflow));
  const jobCards = filterPrimaryJobSnapshotsForWorkflows(jobs, workflows)
    .map((job) => projectJobSnapshotToOrdoCard(job));
  const assetCards = files.items
    .map((file) => projectUserFileToAssetCatalogEntry(file, null))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .map((entry) => ({
      ...projectAssetCatalogEntryToOrdoCard(entry),
      summary: mediaAssetStudioSummary(entry),
    }));
  const mediaItemsById = new Map(
    files.items.map((file) => [file.id, projectUserFileToUserMediaItem(file)] as const),
  );
  const contentCards = campaign?.items.map((item) => projectContentItemToOrdoCard(item)) ?? [];
  const campaignCards = campaign && (campaign.items.length > 0 || campaign.offers.length > 0 || campaign.trackedLinks.length > 0)
    ? [projectContentCampaignToOrdoCard(campaign)]
    : [];

  const allCards = sortStudioCards([...workflowCards, ...jobCards, ...assetCards, ...contentCards, ...campaignCards]);
  const filteredCards = sortStudioCards(allCards.filter((card) => cardMatchesQuery(card, query)));
  const { cards, pageInfo } = paginateCards(filteredCards, query);
  const selectedCard = query.objectId
    ? filteredCards.find((card) => card.id === query.objectId || card.objectRef.id === query.objectId) ?? null
    : null;
  const selectedMediaItem = selectedCard?.kind === "media_asset"
    ? mediaItemsById.get(selectedCard.objectRef.id) ?? mediaItemsById.get(selectedCard.id.replace(/^media_asset:/, "")) ?? null
    : null;

  return {
    cards,
    selectedCard,
    selectedMediaItem,
    query,
    summary: buildSummary(allCards),
    pageInfo,
  };
}
