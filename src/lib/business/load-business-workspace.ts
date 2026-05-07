import type {
  OrdoCard,
  OrdoCardBucket,
  OrdoCardKind,
} from "@/lib/ordo-cards/ordo-card-types";
import {
  projectPersonToOrdoCard,
  projectReferralActivityToOrdoCard,
  projectReferralLinkToOrdoCard,
  projectTrackedLinkToOrdoCard,
} from "@/lib/ordo-cards/ordo-card-projectors";
import {
  loadPeopleReadModel,
  type PersonReadModelItem,
  type PersonRelationshipRole,
  type PersonSourceCategory,
  type PersonStageLabel,
} from "@/lib/business/people-read-model";
import { loadReferralsWorkspace } from "@/lib/referrals/load-referrals-workspace";
import { getTrackedLinkService } from "@/lib/tracked-links/tracked-link-service";

const BUSINESS_DEFAULT_PAGE_LIMIT = 20;
const BUSINESS_MAX_PAGE_LIMIT = 50;

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

const VALID_STAGES = new Set<PersonStageLabel>([
  "Visitor",
  "Conversation",
  "Contact",
  "Offer",
  "Purchased",
  "Follow-up",
]);

const VALID_SOURCES = new Set<PersonSourceCategory>([
  "website",
  "qr_code",
  "referral_link",
  "direct_conversation",
  "public_offer",
  "public_content",
]);

const VALID_NEEDS_ACTION = new Set<NonNullable<BusinessWorkspaceQuery["needsAction"]>>([
  "follow_up_due",
  "waiting_on_owner",
  "offer_in_motion",
  "no_next_step",
]);

const VALID_RELATIONSHIP_ROLES = new Set<PersonRelationshipRole>([
  "Prospect",
  "Customer",
  "Affiliate",
  "Collaborator",
  "Staff",
]);

const VALID_AFFILIATE_STATUS = new Set<NonNullable<BusinessWorkspaceQuery["affiliateStatus"]>>([
  "affiliate",
  "not_affiliate",
]);

const BUCKET_ORDER: Record<OrdoCardBucket, number> = {
  needs_attention: 0,
  business_loop: 1,
  in_motion: 2,
  produced: 3,
  history: 4,
};

export interface BusinessWorkspaceQuery {
  bucket: OrdoCardBucket | null;
  kind: OrdoCardKind | null;
  q: string | null;
  personId: string | null;
  stage: PersonStageLabel | null;
  source: PersonSourceCategory | null;
  needsAction: "follow_up_due" | "waiting_on_owner" | "offer_in_motion" | "no_next_step" | null;
  relationshipRole: PersonRelationshipRole | null;
  affiliateStatus: "affiliate" | "not_affiliate" | null;
  page: number;
  limit: number;
}

export interface BusinessWorkspaceSummary {
  total: number;
  people: number;
  needsAttention: number;
  businessLoop: number;
  visitor: number;
  conversation: number;
  contact: number;
  offer: number;
  purchased: number;
  followUp: number;
  introductions: number;
  startedChats: number;
  registered: number;
  qualifiedOpportunities: number;
  referralEnabled: boolean;
}

export interface BusinessWorkspacePageInfo {
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface BusinessWorkspaceData {
  cards: OrdoCard[];
  people: PersonReadModelItem[];
  selectedPerson: PersonReadModelItem | null;
  peopleTotal: number;
  query: BusinessWorkspaceQuery;
  summary: BusinessWorkspaceSummary;
  pageInfo: BusinessWorkspacePageInfo;
  publicOfferHref: string;
  referralUrl: string | null;
}

type RawBusinessWorkspaceSearchParams = Record<string, string | string[] | undefined>;

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
    return BUSINESS_DEFAULT_PAGE_LIMIT;
  }

  const parsed = Number.parseInt(candidate, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return BUSINESS_DEFAULT_PAGE_LIMIT;
  }

  return Math.min(BUSINESS_MAX_PAGE_LIMIT, parsed);
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

function normalizePersonId(value: string | string[] | undefined): string | null {
  return firstSearchValue(value)?.slice(0, 160) ?? null;
}

function normalizeStage(value: string | string[] | undefined): PersonStageLabel | null {
  const candidate = firstSearchValue(value);
  return candidate && VALID_STAGES.has(candidate as PersonStageLabel)
    ? candidate as PersonStageLabel
    : null;
}

function normalizeSource(value: string | string[] | undefined): PersonSourceCategory | null {
  const candidate = firstSearchValue(value);
  return candidate && VALID_SOURCES.has(candidate as PersonSourceCategory)
    ? candidate as PersonSourceCategory
    : null;
}

function normalizeNeedsAction(
  value: string | string[] | undefined,
): BusinessWorkspaceQuery["needsAction"] {
  const candidate = firstSearchValue(value);
  return candidate && VALID_NEEDS_ACTION.has(candidate as NonNullable<BusinessWorkspaceQuery["needsAction"]>)
    ? candidate as NonNullable<BusinessWorkspaceQuery["needsAction"]>
    : null;
}

function normalizeRelationshipRole(value: string | string[] | undefined): PersonRelationshipRole | null {
  const candidate = firstSearchValue(value);
  return candidate && VALID_RELATIONSHIP_ROLES.has(candidate as PersonRelationshipRole)
    ? candidate as PersonRelationshipRole
    : null;
}

function normalizeAffiliateStatus(
  value: string | string[] | undefined,
): BusinessWorkspaceQuery["affiliateStatus"] {
  const candidate = firstSearchValue(value);
  return candidate && VALID_AFFILIATE_STATUS.has(candidate as NonNullable<BusinessWorkspaceQuery["affiliateStatus"]>)
    ? candidate as NonNullable<BusinessWorkspaceQuery["affiliateStatus"]>
    : null;
}

function normalizeSearch(value: string | string[] | undefined): string | null {
  const candidate = firstSearchValue(value);
  return candidate ? candidate.slice(0, 120) : null;
}

export function parseBusinessWorkspaceQuery(
  rawSearchParams: RawBusinessWorkspaceSearchParams = {},
): BusinessWorkspaceQuery {
  return {
    bucket: normalizeBucket(rawSearchParams.bucket),
    kind: normalizeKind(rawSearchParams.kind),
    q: normalizeSearch(rawSearchParams.q),
    personId: normalizePersonId(rawSearchParams.person),
    stage: normalizeStage(rawSearchParams.stage),
    source: normalizeSource(rawSearchParams.source),
    needsAction: normalizeNeedsAction(rawSearchParams.needs),
    relationshipRole: normalizeRelationshipRole(rawSearchParams.role),
    affiliateStatus: normalizeAffiliateStatus(rawSearchParams.affiliate),
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

function cardMatchesQuery(card: OrdoCard, query: BusinessWorkspaceQuery): boolean {
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

function peopleIncludesQuery(person: PersonReadModelItem, query: string | null): boolean {
  return includesQuery([
    person.id,
    person.displayName,
    person.email,
    person.organization,
    person.summary,
    person.nextAction,
    person.stageLabel,
    person.relationshipRole,
    ...person.sourceLabels,
    ...person.sourceCategories,
    ...person.offerLabels,
    ...person.referralCodes,
    ...person.offerIds,
    ...person.sourceRefs.flatMap((ref) => [ref.label]),
    ...person.provenanceRefs.flatMap((ref) => [ref.label]),
  ], query);
}

function personMatchesNeedsAction(
  person: PersonReadModelItem,
  needsAction: BusinessWorkspaceQuery["needsAction"],
): boolean {
  if (!needsAction) {
    return true;
  }

  if (needsAction === "follow_up_due") {
    return person.stageLabel === "Follow-up" || Boolean(person.nextAction?.toLowerCase().includes("follow"));
  }

  if (needsAction === "waiting_on_owner") {
    return Boolean(person.nextAction);
  }

  if (needsAction === "offer_in_motion") {
    return person.stageLabel === "Offer" || Boolean(person.nextAction?.toLowerCase().includes("offer"));
  }

  return !person.nextAction;
}

function personMatchesQuery(person: PersonReadModelItem, query: BusinessWorkspaceQuery): boolean {
  if (query.stage && person.stageLabel !== query.stage) {
    return false;
  }

  if (query.source && !person.sourceCategories.includes(query.source)) {
    return false;
  }

  if (!personMatchesNeedsAction(person, query.needsAction)) {
    return false;
  }

  if (query.relationshipRole && person.relationshipRole !== query.relationshipRole) {
    return false;
  }

  if (query.affiliateStatus === "affiliate" && !person.affiliate) {
    return false;
  }

  if (query.affiliateStatus === "not_affiliate" && person.affiliate) {
    return false;
  }

  return peopleIncludesQuery(person, query.q);
}

function sortBusinessCards(cards: readonly OrdoCard[]): OrdoCard[] {
  return [...cards].sort((left, right) => {
    const bucketDelta = BUCKET_ORDER[left.bucket] - BUCKET_ORDER[right.bucket];
    if (bucketDelta !== 0) {
      return bucketDelta;
    }

    return updatedAtMs(right.updatedAt) - updatedAtMs(left.updatedAt);
  });
}

function paginatePeople(
  people: readonly PersonReadModelItem[],
  query: BusinessWorkspaceQuery,
): { people: PersonReadModelItem[]; pageInfo: BusinessWorkspacePageInfo } {
  const total = people.length;
  const pageCount = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * query.limit;

  return {
    people: people.slice(start, start + query.limit),
    pageInfo: {
      page,
      limit: query.limit,
      total,
      hasNextPage: page < pageCount,
      hasPreviousPage: page > 1,
    },
  };
}

function paginateCards(
  cards: readonly OrdoCard[],
  query: BusinessWorkspaceQuery,
): { cards: OrdoCard[]; pageInfo: BusinessWorkspacePageInfo } {
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

export async function loadBusinessWorkspace(
  userId: string,
  rawSearchParams: RawBusinessWorkspaceSearchParams = {},
): Promise<BusinessWorkspaceData> {
  const query = parseBusinessWorkspaceQuery(rawSearchParams);
  const [referralWorkspace, people, trackedLinks] = await Promise.all([
    loadReferralsWorkspace(userId),
    loadPeopleReadModel(userId),
    getTrackedLinkService().listOwnerLinks({ userId, role: "AUTHENTICATED" }),
  ]);
  const personCards = people.map((person) => projectPersonToOrdoCard(person));
  const referralCard = projectReferralLinkToOrdoCard({
    profile: referralWorkspace.profile,
    overview: referralWorkspace.overview,
    pipeline: referralWorkspace.pipeline,
    updatedAt: referralWorkspace.recentActivity[0]?.occurredAt ?? undefined,
  });
  const activityCards = referralWorkspace.recentActivity.map((item) =>
    projectReferralActivityToOrdoCard(item, userId),
  );
  const trackedLinkCards = trackedLinks.map(projectTrackedLinkToOrdoCard);

  const allCards = sortBusinessCards([
    ...personCards,
    ...trackedLinkCards,
    ...(referralCard ? [referralCard] : []),
    ...activityCards,
  ]);
  const filteredCards = sortBusinessCards(allCards.filter((card) => cardMatchesQuery(card, query)));
  const filteredPeople = people.filter((person) => personMatchesQuery(person, query));
  const { people: paginatedPeople, pageInfo } = paginatePeople(filteredPeople, query);
  const { cards } = paginateCards(filteredCards, query);
  const selectedPerson = (query.personId
    ? people.find((person) => person.id === query.personId)
    : null)
    ?? paginatedPeople[0]
    ?? null;

  return {
    cards,
    people: paginatedPeople,
    selectedPerson,
    peopleTotal: filteredPeople.length,
    query,
    pageInfo,
    publicOfferHref: "/offers",
    referralUrl: referralWorkspace.profile.referralUrl ?? null,
    summary: {
      total: allCards.length,
      people: personCards.length,
      needsAttention: allCards.filter((card) => card.bucket === "needs_attention").length,
      businessLoop: allCards.filter((card) => card.bucket === "business_loop").length,
      visitor: people.filter((person) => person.stageLabel === "Visitor").length,
      conversation: people.filter((person) => person.stageLabel === "Conversation").length,
      contact: people.filter((person) => person.stageLabel === "Contact").length,
      offer: people.filter((person) => person.stageLabel === "Offer").length,
      purchased: people.filter((person) => person.stageLabel === "Purchased").length,
      followUp: people.filter((person) => person.stageLabel === "Follow-up").length,
      introductions: referralWorkspace.overview?.introductions ?? 0,
      startedChats: referralWorkspace.overview?.startedChats ?? 0,
      registered: referralWorkspace.overview?.registered ?? 0,
      qualifiedOpportunities: referralWorkspace.overview?.qualifiedOpportunities ?? 0,
      referralEnabled: Boolean(referralWorkspace.profile.affiliateEnabled
        && referralWorkspace.profile.referralCode
        && referralWorkspace.profile.referralUrl
        && referralWorkspace.profile.qrCodeUrl),
    },
  };
}
