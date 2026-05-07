import type { SessionUser } from "@/lib/auth";
import type { Offer, OfferEvent } from "@/core/entities/offer";
import type { TrackedLinkWithPerformance } from "@/core/entities/tracked-link";
import type { SectionBrief } from "@/components/governance/GovernanceSectionFrame";
import type { OrdoCard } from "@/lib/ordo-cards/ordo-card-types";
import { projectOfferToOrdoCard } from "@/lib/ordo-cards/ordo-card-projectors";
import { projectOfferToOrdoDetail, type OrdoObjectDetailModel } from "@/lib/ordo-details";
import { getInstanceIdentity, getInstanceServices } from "@/lib/config/instance";
import { formatStableUtcShortDateTime } from "@/lib/format/stable-date";
import {
  resolveSectionBrief,
  type SectionBriefStore,
} from "@/lib/briefs/section-brief-resolver";
import { getOfferService, type OfferActor, type OfferService } from "@/lib/offers/offer-service";
import { formatOfferPrice } from "@/lib/offers/offer-format";
import { getTrackedLinkService, type TrackedLinkService } from "@/lib/tracked-links/tracked-link-service";

const OFFER_DEFAULT_PAGE_LIMIT = 20;
const OFFER_MAX_PAGE_LIMIT = 50;

const OWNER_OFFER_STATES = [
  "public",
  "private",
  "draft",
  "sent",
  "accepted",
  "purchased",
  "archived",
] as const;

export type OwnerOfferState = typeof OWNER_OFFER_STATES[number];

type RawOfferSearchParams = Record<string, string | string[] | undefined>;
type OwnerOffersLoaderOfferService = Pick<OfferService, "listOwnerOffers" | "listOfferEvents">;
type OwnerOffersLoaderTrackedLinkService = Pick<TrackedLinkService, "listOwnerLinks">;

export interface PublicOfferView {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  audience: string;
  promise: string;
  priceLabel: string;
  ctaLabel: string;
  detailHref: string;
  source: "durable" | "config_fallback";
}

export interface PublicOffersPageData {
  identityName: string;
  offers: PublicOfferView[];
  hasDurableOffers: boolean;
}

export interface OwnerOffersWorkspaceQuery {
  q: string | null;
  state: OwnerOfferState | null;
  visibility: Offer["visibility"] | null;
  offerId: string | null;
  page: number;
  limit: number;
}

export interface OwnerOffersSummary {
  total: number;
  public: number;
  private: number;
  draft: number;
  sent: number;
  accepted: number;
  purchased: number;
  archived: number;
  missingPrice: number;
}

export interface OwnerOffersPageInfo {
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface OwnerOfferRelationshipLink {
  id: string;
  label: string;
  href: string;
}

export type OwnerOfferLifecycleStepId =
  | "accepted"
  | "fulfillment"
  | "delivery"
  | "feedback"
  | "report"
  | "follow_up";

export type OwnerOfferLifecycleStepStatus =
  | "complete"
  | "pending"
  | "limited"
  | "inactive";

export interface OwnerOfferLifecycleStep {
  id: OwnerOfferLifecycleStepId;
  label: string;
  status: OwnerOfferLifecycleStepStatus;
  summary: string;
  occurredAt: string | null;
  sourceHref: string | null;
  sourceLabel: string | null;
}

export interface OwnerOfferLifecycle {
  active: boolean;
  stateLabel: string;
  nextActionLabel: string;
  steps: OwnerOfferLifecycleStep[];
  limitations: string[];
}

export interface OwnerOfferObject {
  id: string;
  offer: Offer;
  card: OrdoCard;
  detail: OrdoObjectDetailModel;
  events: OfferEvent[];
  trackedLinks: TrackedLinkWithPerformance[];
  href: string;
  publicHref: string | null;
  priceLabel: string;
  statusLabel: string;
  visibilityLabel: string;
  sourceLabel: string;
  sourceHref: string | null;
  stateLabels: OwnerOfferState[];
  relationshipLinks: OwnerOfferRelationshipLink[];
  lifecycle: OwnerOfferLifecycle;
  latestEventAt: string;
  nextActionLabel: string;
}

export interface OwnerOffersWorkspaceData {
  offers: Offer[];
  objects: OwnerOfferObject[];
  filteredObjects: OwnerOfferObject[];
  selectedOffer: OwnerOfferObject | null;
  cards: OrdoCard[];
  brief: SectionBrief;
  query: OwnerOffersWorkspaceQuery;
  summary: OwnerOffersSummary;
  pageInfo: OwnerOffersPageInfo;
}

export async function loadPublicOffersPageData(): Promise<PublicOffersPageData> {
  const identity = getInstanceIdentity();
  const durableOffers = await getOfferService().listPublicOffers();

  if (durableOffers.length > 0) {
    return {
      identityName: identity.name,
      hasDurableOffers: true,
      offers: durableOffers.map((offer) => ({
        id: offer.id,
        slug: offer.slug,
        title: offer.title,
        summary: offer.summary,
        description: offer.description,
        audience: offer.audience,
        promise: offer.promise,
        priceLabel: formatPublicOfferPrice(offer),
        ctaLabel: offer.ctaLabel,
        detailHref: `/offers/${encodeURIComponent(offer.slug)}`,
        source: "durable",
      })),
    };
  }

  const services = getInstanceServices();
  return {
    identityName: identity.name,
    hasDurableOffers: false,
    offers: services.offerings.map((offer) => ({
      id: offer.id,
      slug: offer.id,
      title: offer.name,
      summary: offer.description,
      description: offer.description,
      audience: offer.lane === "both" ? "Solopreneurs and teams" : offer.lane,
      promise: offer.description,
      priceLabel: [
        typeof offer.estimatedPrice === "number" ? `$${offer.estimatedPrice.toLocaleString()}` : null,
        typeof offer.estimatedHours === "number" ? `${offer.estimatedHours} hr${offer.estimatedHours === 1 ? "" : "s"}` : null,
      ].filter(Boolean).join(" / ") || "Details available in conversation",
      ctaLabel: "Start a conversation",
      detailHref: "/",
      source: "config_fallback",
    })),
  };
}

export async function loadOwnerOffersWorkspace(
  user: SessionUser,
  rawSearchParams: RawOfferSearchParams = {},
  dependencies: {
    offerService?: OwnerOffersLoaderOfferService;
    trackedLinkService?: OwnerOffersLoaderTrackedLinkService;
    briefs?: SectionBriefStore | null;
  } = {},
): Promise<OwnerOffersWorkspaceData> {
  const query = parseOwnerOffersQuery(rawSearchParams);
  const actor: OfferActor = {
    userId: user.id,
    role: user.roles[0] ?? "AUTHENTICATED",
  };
  const offerService = dependencies.offerService ?? getOfferService();
  const trackedLinkService = dependencies.trackedLinkService ?? getTrackedLinkService();
  const offers = await offerService.listOwnerOffers(actor);
  const [eventLists, ownerLinks] = await Promise.all([
    Promise.all(offers.map((offer) => offerService.listOfferEvents(actor, offer.id).catch(() => [] as OfferEvent[]))),
    trackedLinkService.listOwnerLinks(actor).catch(() => [] as TrackedLinkWithPerformance[]),
  ]);
  const eventsByOfferId = new Map<string, OfferEvent[]>();
  offers.forEach((offer, index) => {
    eventsByOfferId.set(offer.id, eventLists[index] ?? []);
  });

  const linksByOfferId = new Map<string, TrackedLinkWithPerformance[]>();
  for (const link of ownerLinks) {
    if (link.link.targetKind !== "offer") {
      continue;
    }
    const existing = linksByOfferId.get(link.link.targetId) ?? [];
    existing.push(link);
    linksByOfferId.set(link.link.targetId, existing);
  }

  const objects = sortOfferObjects(offers.map((offer) => projectOwnerOfferObject({
    offer,
    events: eventsByOfferId.get(offer.id) ?? [],
    trackedLinks: linksByOfferId.get(offer.id) ?? [],
  })));
  const filtered = objects.filter((object) => offerObjectMatchesQuery(object, query));
  const { pageObjects, pageInfo } = paginateOfferObjects(filtered, query);
  const selectedOffer = query.offerId
    ? objects.find((object) => object.id === query.offerId) ?? null
    : null;
  const summary = summarizeOffers(objects);
  const fallbackBrief = buildOffersBrief(summary, objects);
  const { brief } = await resolveSectionBrief({
    briefs: dependencies.briefs,
    sectionId: "offers",
    ownerUserId: user.id,
    visibilityPolicy: "owner",
    fallback: fallbackBrief,
  });

  return {
    offers,
    objects,
    filteredObjects: pageObjects,
    selectedOffer,
    cards: pageObjects.map((object) => object.card),
    brief,
    query,
    summary,
    pageInfo,
  };
}

function formatPublicOfferPrice(offer: Offer): string {
  if (offer.billingKind === "free") {
    return "Free";
  }
  if (offer.billingKind === "contact") {
    return "Contact for price";
  }

  const price = typeof offer.priceCents === "number"
    ? new Intl.NumberFormat("en", {
        style: "currency",
        currency: offer.currency,
        maximumFractionDigits: 0,
      }).format(offer.priceCents / 100)
    : "Price required";

  return offer.billingKind === "hourly" ? `${price}/hr` : price;
}

function firstSearchValue(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSearch(value: string | string[] | undefined): string | null {
  return firstSearchValue(value)?.slice(0, 120) ?? null;
}

function normalizeOfferId(value: string | string[] | undefined): string | null {
  return firstSearchValue(value)?.slice(0, 160) ?? null;
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
    return OFFER_DEFAULT_PAGE_LIMIT;
  }

  const parsed = Number.parseInt(candidate, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return OFFER_DEFAULT_PAGE_LIMIT;
  }

  return Math.min(OFFER_MAX_PAGE_LIMIT, parsed);
}

function normalizeState(value: string | string[] | undefined): OwnerOfferState | null {
  const candidate = firstSearchValue(value);
  return candidate && (OWNER_OFFER_STATES as readonly string[]).includes(candidate)
    ? candidate as OwnerOfferState
    : null;
}

function normalizeVisibility(value: string | string[] | undefined): Offer["visibility"] | null {
  const candidate = firstSearchValue(value);
  return candidate === "public" || candidate === "private" ? candidate : null;
}

export function parseOwnerOffersQuery(rawSearchParams: RawOfferSearchParams = {}): OwnerOffersWorkspaceQuery {
  return {
    q: normalizeSearch(rawSearchParams.q),
    state: normalizeState(rawSearchParams.state),
    visibility: normalizeVisibility(rawSearchParams.visibility),
    offerId: normalizeOfferId(rawSearchParams.offerId ?? rawSearchParams.offer),
    page: normalizePage(rawSearchParams.page),
    limit: normalizeLimit(rawSearchParams.limit),
  };
}

export function buildOwnerOffersHref(
  current: OwnerOffersWorkspaceQuery,
  patch: Partial<OwnerOffersWorkspaceQuery> = {},
): string {
  const query = { ...current, ...patch };
  const searchParams = new URLSearchParams();

  if (query.q) searchParams.set("q", query.q);
  if (query.state) searchParams.set("state", query.state);
  if (query.visibility) searchParams.set("visibility", query.visibility);
  if (query.offerId) searchParams.set("offerId", query.offerId);
  if (query.page && query.page > 1) searchParams.set("page", String(query.page));
  if (query.limit && query.limit !== OFFER_DEFAULT_PAGE_LIMIT) searchParams.set("limit", String(query.limit));

  const queryString = searchParams.toString();
  return queryString ? `/offers?${queryString}` : "/offers";
}

function hasEvent(events: readonly OfferEvent[], eventType: OfferEvent["eventType"]): boolean {
  return events.some((event) => event.eventType === eventType);
}

function offerStates(offer: Offer, events: readonly OfferEvent[]): OwnerOfferState[] {
  const states = new Set<OwnerOfferState>();
  if (offer.status === "archived") states.add("archived");
  if (offer.status === "published" && offer.visibility === "public" && !offer.archivedAt) states.add("public");
  if (offer.visibility === "private" && offer.status !== "archived") states.add("private");
  if (offer.status === "draft" || offer.status === "ready") states.add("draft");
  if (hasEvent(events, "sent_private")) states.add("sent");
  if (hasEvent(events, "chosen")) states.add("accepted");
  if (hasEvent(events, "purchase_simulated")) states.add("purchased");
  return Array.from(states);
}

function primaryStateLabel(states: readonly OwnerOfferState[]): string {
  const priority: readonly OwnerOfferState[] = ["purchased", "accepted", "sent", "public", "draft", "private", "archived"];
  const state = priority.find((candidate) => states.includes(candidate)) ?? "draft";
  return state === "public"
    ? "Public"
    : state === "private"
      ? "Private"
      : state === "draft"
        ? "Draft"
        : state === "sent"
          ? "Sent"
          : state === "accepted"
            ? "Accepted"
            : state === "purchased"
              ? "Purchased"
              : "Archived";
}

function eventCreatedAtMs(event: OfferEvent): number {
  const parsed = Date.parse(event.createdAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function offerUpdatedAtMs(object: OwnerOfferObject): number {
  const latestEventMs = object.events.reduce((latest, event) => Math.max(latest, eventCreatedAtMs(event)), 0);
  const offerMs = Date.parse(object.offer.updatedAt);
  return Math.max(Number.isNaN(offerMs) ? 0 : offerMs, latestEventMs);
}

function sortOfferObjects(objects: readonly OwnerOfferObject[]): OwnerOfferObject[] {
  return [...objects].sort((left, right) => offerUpdatedAtMs(right) - offerUpdatedAtMs(left));
}

function personLabel(personRef: string): string {
  if (personRef.startsWith("person:email:")) {
    return personRef.slice("person:email:".length);
  }
  if (personRef.startsWith("person:lead_")) {
    return `Lead ${personRef.slice("person:".length)}`;
  }
  if (personRef.startsWith("person:")) {
    return personRef.slice("person:".length).replaceAll(":", " ");
  }
  return "Recipient";
}

function personHref(personRef: string): string {
  return `/business/people/${encodeURIComponent(personRef)}`;
}

function relationshipLinksForEvents(events: readonly OfferEvent[]): OwnerOfferRelationshipLink[] {
  const seen = new Set<string>();
  const links: OwnerOfferRelationshipLink[] = [];

  for (const event of events) {
    if (!event.personRef || seen.has(event.personRef)) {
      continue;
    }
    seen.add(event.personRef);
    links.push({
      id: event.personRef,
      label: personLabel(event.personRef),
      href: personHref(event.personRef),
    });
  }

  return links;
}

function sourceForOffer(offer: Offer, events: readonly OfferEvent[]): { label: string; href: string | null } {
  const conversationId = offer.createdFromConversationId
    ?? events.find((event) => event.conversationId)?.conversationId
    ?? null;

  if (conversationId) {
    return {
      label: "Created from conversation",
      href: `/business/conversations/${encodeURIComponent(conversationId)}`,
    };
  }

  const createdEvent = events.find((event) => event.eventType === "created");
  const source = typeof createdEvent?.metadata.source === "string"
    ? createdEvent.metadata.source
    : "ui";

  return {
    label: source === "conversation" ? "Created from conversation" : "Created in Offers",
    href: null,
  };
}

function latestOfferEventAt(offer: Offer, events: readonly OfferEvent[]): string {
  const latestEvent = events.reduce<OfferEvent | null>((latest, event) => {
    if (!latest) return event;
    return eventCreatedAtMs(event) > eventCreatedAtMs(latest) ? event : latest;
  }, null);

  return latestEvent?.createdAt ?? offer.updatedAt;
}

function latestEventOfType(
  events: readonly OfferEvent[],
  eventType: OfferEvent["eventType"],
): OfferEvent | null {
  return events
    .filter((event) => event.eventType === eventType)
    .sort((left, right) => eventCreatedAtMs(right) - eventCreatedAtMs(left))[0] ?? null;
}

function metadataText(event: OfferEvent | null, keys: readonly string[]): string | null {
  if (!event) {
    return null;
  }
  for (const key of keys) {
    const value = event.metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 240);
    }
  }
  return null;
}

function lifecycleSourceForEvent(event: OfferEvent | null): { href: string | null; label: string | null } {
  if (!event) {
    return { href: null, label: null };
  }
  if (event.conversationId) {
    return {
      href: `/business/conversations/${encodeURIComponent(event.conversationId)}`,
      label: "Open conversation",
    };
  }
  if (event.personRef) {
    return {
      href: personHref(event.personRef),
      label: "Open person",
    };
  }
  return { href: null, label: null };
}

function lifecycleMetadataSource(event: OfferEvent | null, step: OwnerOfferLifecycleStepId): { href: string | null; label: string | null } {
  const href = metadataText(event, [`${step}Href`, `${step}WorkHref`, "sourceHref"]);
  const label = metadataText(event, [`${step}Label`, `${step}WorkLabel`, "sourceLabel"]);
  return {
    href,
    label: label ?? (href ? "Open evidence" : null),
  };
}

function lifecycleStep(input: {
  id: OwnerOfferLifecycleStepId;
  label: string;
  status: OwnerOfferLifecycleStepStatus;
  summary: string;
  event?: OfferEvent | null;
  source?: { href: string | null; label: string | null };
}): OwnerOfferLifecycleStep {
  const event = input.event ?? null;
  const source = input.source ?? lifecycleSourceForEvent(event);
  return {
    id: input.id,
    label: input.label,
    status: input.status,
    summary: input.summary,
    occurredAt: event?.createdAt ?? null,
    sourceHref: source.href,
    sourceLabel: source.label,
  };
}

function buildOfferLifecycle(offer: Offer, events: readonly OfferEvent[]): OwnerOfferLifecycle {
  const acceptedEvent = latestEventOfType(events, "chosen");
  const purchaseEvent = latestEventOfType(events, "purchase_simulated");
  const active = Boolean(acceptedEvent || purchaseEvent);
  const primaryEvent = purchaseEvent ?? acceptedEvent;
  const limitations: string[] = [];

  if (!active) {
    return {
      active: false,
      stateLabel: "Not accepted",
      nextActionLabel: nextActionForOffer(offer, events),
      limitations: [
        "Accepted-offer lifecycle starts only after durable accepted or simulated purchase evidence exists.",
      ],
      steps: [
        lifecycleStep({
          id: "accepted",
          label: "Offer accepted",
          status: "inactive",
          summary: "No accepted-offer event has been recorded yet.",
        }),
      ],
    };
  }

  if (!primaryEvent?.personRef) {
    limitations.push("No related person is attached to the accepted-offer event yet.");
  }

  const fulfillmentSource = lifecycleMetadataSource(primaryEvent, "fulfillment");
  const deliverySource = lifecycleMetadataSource(primaryEvent, "delivery");
  const feedbackSource = lifecycleMetadataSource(primaryEvent, "feedback");
  const reportSource = lifecycleMetadataSource(primaryEvent, "report");
  const followUpSource = lifecycleMetadataSource(primaryEvent, "follow_up");

  if (!fulfillmentSource.href) {
    limitations.push("No fulfillment work is linked to this accepted offer yet.");
  }

  if (purchaseEvent) {
    limitations.push("Purchase state is simulated until real payment evidence exists.");
  }

  const acceptedSummary = purchaseEvent
    ? "A simulated purchase event exists. Treat this as purchase evidence only for product flow testing."
    : "A durable accepted-offer event exists. Use it to guide fulfillment and relationship follow-up.";

  return {
    active: true,
    stateLabel: purchaseEvent ? "Purchased (simulated)" : "Accepted",
    nextActionLabel: fulfillmentSource.href
      ? "Inspect fulfillment evidence"
      : "Plan fulfillment in chat",
    limitations,
    steps: [
      lifecycleStep({
        id: "accepted",
        label: purchaseEvent ? "Purchase simulated" : "Offer accepted",
        status: "complete",
        summary: acceptedSummary,
        event: purchaseEvent ?? acceptedEvent,
      }),
      lifecycleStep({
        id: "fulfillment",
        label: "Fulfillment work",
        status: fulfillmentSource.href ? "complete" : "pending",
        summary: fulfillmentSource.href
          ? "Fulfillment work is linked as durable offer evidence."
          : "No fulfillment work is linked yet. Ask Ordo to turn the accepted offer into governed Studio work.",
        event: primaryEvent,
        source: fulfillmentSource.href ? fulfillmentSource : { href: null, label: null },
      }),
      lifecycleStep({
        id: "delivery",
        label: "Delivery",
        status: deliverySource.href ? "complete" : "pending",
        summary: deliverySource.href
          ? "Delivery evidence is linked to this offer."
          : "Delivery has not been linked yet.",
        event: primaryEvent,
        source: deliverySource.href ? deliverySource : { href: null, label: null },
      }),
      lifecycleStep({
        id: "feedback",
        label: "Feedback",
        status: feedbackSource.href ? "complete" : "pending",
        summary: feedbackSource.href
          ? "Feedback evidence is linked to this offer."
          : "Feedback has not been linked yet.",
        event: primaryEvent,
        source: feedbackSource.href ? feedbackSource : { href: null, label: null },
      }),
      lifecycleStep({
        id: "report",
        label: "Report",
        status: reportSource.href ? "complete" : "pending",
        summary: reportSource.href
          ? "Report evidence is linked to this offer."
          : "No report or outcome summary has been linked yet.",
        event: primaryEvent,
        source: reportSource.href ? reportSource : { href: null, label: null },
      }),
      lifecycleStep({
        id: "follow_up",
        label: "Follow-up",
        status: followUpSource.href ? "complete" : "pending",
        summary: followUpSource.href
          ? "Follow-up evidence is linked to this offer."
          : "No follow-up has been scheduled or linked yet.",
        event: primaryEvent,
        source: followUpSource.href ? followUpSource : { href: null, label: null },
      }),
    ],
  };
}

function nextActionForOffer(offer: Offer, events: readonly OfferEvent[]): string {
  if (offer.status === "archived") {
    return "Review history";
  }
  if (hasEvent(events, "purchase_simulated")) {
    return "Review purchase evidence";
  }
  if (hasEvent(events, "chosen")) {
    return "Follow up on accepted offer";
  }
  if (offer.status === "published" && offer.visibility === "public") {
    return "Share or inspect public link";
  }
  if (offer.status === "draft" || offer.status === "ready") {
    return typeof offer.priceCents === "number" || offer.billingKind === "free" || offer.billingKind === "contact"
      ? "Review and publish when ready"
      : "Add a price or contact billing";
  }
  return "Discuss next step in chat";
}

function projectOwnerOfferObject(input: {
  offer: Offer;
  events: OfferEvent[];
  trackedLinks: TrackedLinkWithPerformance[];
}): OwnerOfferObject {
  const { offer, events, trackedLinks } = input;
  const card = projectOfferToOrdoCard(offer);
  const detail = projectOfferToOrdoDetail({ offer, events, trackedLinks });
  const stateLabels = offerStates(offer, events);
  const source = sourceForOffer(offer, events);
  const lifecycle = buildOfferLifecycle(offer, events);

  return {
    id: offer.id,
    offer,
    card,
    detail,
    events,
    trackedLinks,
    href: buildOwnerOffersHref(parseOwnerOffersQuery(), { offerId: offer.id }),
    publicHref: offer.status === "published" && offer.visibility === "public" && !offer.archivedAt
      ? `/offers/${encodeURIComponent(offer.slug)}`
      : null,
    priceLabel: formatOfferPrice(offer),
    statusLabel: primaryStateLabel(stateLabels),
    visibilityLabel: offer.status === "archived"
      ? "Archived"
      : offer.visibility === "public"
        ? "Public"
        : "Private",
    sourceLabel: source.label,
    sourceHref: source.href,
    stateLabels,
    relationshipLinks: relationshipLinksForEvents(events),
    lifecycle,
    latestEventAt: latestOfferEventAt(offer, events),
    nextActionLabel: lifecycle.active ? lifecycle.nextActionLabel : nextActionForOffer(offer, events),
  };
}

function includesQuery(fields: Array<string | null | undefined>, query: string | null): boolean {
  if (!query) {
    return true;
  }

  const needle = query.toLowerCase();
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

function offerObjectMatchesQuery(object: OwnerOfferObject, query: OwnerOffersWorkspaceQuery): boolean {
  if (query.state && !object.stateLabels.includes(query.state)) {
    return false;
  }
  if (query.visibility && object.offer.visibility !== query.visibility) {
    return false;
  }

  return includesQuery([
    object.offer.id,
    object.offer.slug,
    object.offer.title,
    object.offer.summary,
    object.offer.description,
    object.offer.audience,
    object.offer.promise,
    object.priceLabel,
    object.statusLabel,
    object.visibilityLabel,
    object.sourceLabel,
    ...object.relationshipLinks.map((link) => link.label),
  ], query.q);
}

function paginateOfferObjects(
  objects: readonly OwnerOfferObject[],
  query: OwnerOffersWorkspaceQuery,
): { pageObjects: OwnerOfferObject[]; pageInfo: OwnerOffersPageInfo } {
  const total = objects.length;
  const pageCount = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * query.limit;

  return {
    pageObjects: objects.slice(start, start + query.limit),
    pageInfo: {
      page,
      limit: query.limit,
      total,
      hasNextPage: page < pageCount,
      hasPreviousPage: page > 1,
    },
  };
}

function summarizeOffers(objects: readonly OwnerOfferObject[]): OwnerOffersSummary {
  return {
    total: objects.length,
    public: objects.filter((object) => object.stateLabels.includes("public")).length,
    private: objects.filter((object) => object.stateLabels.includes("private")).length,
    draft: objects.filter((object) => object.stateLabels.includes("draft")).length,
    sent: objects.filter((object) => object.stateLabels.includes("sent")).length,
    accepted: objects.filter((object) => object.stateLabels.includes("accepted")).length,
    purchased: objects.filter((object) => object.stateLabels.includes("purchased")).length,
    archived: objects.filter((object) => object.stateLabels.includes("archived")).length,
    missingPrice: objects.filter((object) => object.priceLabel === "Price required").length,
  };
}

function formatBriefAsOf(objects: readonly OwnerOfferObject[]): string {
  const latest = objects.reduce<string | null>((current, object) => {
    if (!current) return object.latestEventAt;
    return Date.parse(object.latestEventAt) > Date.parse(current) ? object.latestEventAt : current;
  }, null);

  return latest ? formatStableUtcShortDateTime(latest) ?? latest : formatStableUtcShortDateTime(new Date()) ?? "";
}

function buildOffersBrief(summary: OwnerOffersSummary, objects: readonly OwnerOfferObject[]): SectionBrief {
  const hasOffers = summary.total > 0;
  const unpricedBullet = summary.missingPrice > 0
    ? `${summary.missingPrice} offer${summary.missingPrice === 1 ? " needs" : "s need"} a price, free billing, or contact-for-price language before it can be trusted.`
    : "Every governed offer has an explicit price state; no fake price metrics are shown.";

  return {
    id: "offers-brief",
    sectionId: "offers",
    asOf: hasOffers ? formatBriefAsOf(objects) : undefined,
    status: hasOffers ? "fresh" : "limited",
    title: "Offers Brief",
    summary: hasOffers
      ? "This is the owner view for public offers and private proposals. Chat creates or revises offers; this surface governs price, visibility, evidence, and sharing."
      : "No governed offers exist yet. Start with one clear public offer or a private proposal, then let Ordo keep the evidence inspectable.",
    bullets: hasOffers
      ? [
          `${summary.public} public, ${summary.private} private, and ${summary.draft} draft offer${summary.total === 1 ? "" : "s"} are in the owner workspace.`,
          `${summary.sent} sent, ${summary.accepted} accepted, and ${summary.purchased} purchased offer event${summary.sent + summary.accepted + summary.purchased === 1 ? "" : "s"} are backed by durable evidence.`,
          unpricedBullet,
        ]
      : [
          "Ask Ordo to create an offer with audience, promise, price, visibility, and next step.",
          "The UI fallback can save a draft when exact fields need owner review.",
          "Private offers stay out of the public visitor surface.",
        ],
    recommendedAction: hasOffers
      ? { label: "Review offer evidence", href: "/offers" }
      : {
          label: "Create first offer",
          href: "/offers#create-offer",
          prompt: "Help me create one clear offer with a price, audience, promise, and next step.",
        },
    evidenceRefs: objects.slice(0, 5).map((object) => ({
      kind: "offer",
      id: object.offer.id,
      label: object.offer.title,
      href: object.href,
    })),
    limitations: summary.total === 0
      ? ["Offer performance will remain limited until public/private offers generate durable view, choice, or purchase evidence."]
      : summary.missingPrice > 0
        ? ["Unpriced fixed/hourly offers cannot be published until pricing or contact/free billing is explicit."]
        : [],
  };
}
