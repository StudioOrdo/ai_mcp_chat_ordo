export const OFFER_STATUSES = [
  "draft",
  "ready",
  "published",
  "archived",
] as const;

export type OfferStatus = typeof OFFER_STATUSES[number];

export const OFFER_VISIBILITIES = [
  "private",
  "public",
] as const;

export type OfferVisibility = typeof OFFER_VISIBILITIES[number];

export const OFFER_BILLING_KINDS = [
  "fixed",
  "hourly",
  "free",
  "contact",
] as const;

export type OfferBillingKind = typeof OFFER_BILLING_KINDS[number];

export const OFFER_EVENT_TYPES = [
  "created",
  "updated",
  "published",
  "archived",
  "viewed",
  "chosen",
  "sent_private",
  "purchase_simulated",
] as const;

export type OfferEventType = typeof OFFER_EVENT_TYPES[number];

export interface Offer {
  id: string;
  slug: string;
  ownerUserId: string;
  title: string;
  summary: string;
  description: string;
  audience: string;
  promise: string;
  priceCents: number | null;
  currency: string;
  billingKind: OfferBillingKind;
  estimatedMinutes: number | null;
  status: OfferStatus;
  visibility: OfferVisibility;
  ctaLabel: string;
  createdFromConversationId: string | null;
  createdFromMessageId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
}

export interface OfferSeed {
  slug: string;
  ownerUserId: string;
  title: string;
  summary: string;
  description: string;
  audience: string;
  promise: string;
  priceCents: number | null;
  currency: string;
  billingKind: OfferBillingKind;
  estimatedMinutes: number | null;
  status?: OfferStatus;
  visibility?: OfferVisibility;
  ctaLabel: string;
  createdFromConversationId?: string | null;
  createdFromMessageId?: string | null;
}

export interface OfferPatch {
  slug?: string;
  title?: string;
  summary?: string;
  description?: string;
  audience?: string;
  promise?: string;
  priceCents?: number | null;
  currency?: string;
  billingKind?: OfferBillingKind;
  estimatedMinutes?: number | null;
  status?: OfferStatus;
  visibility?: OfferVisibility;
  ctaLabel?: string;
  publishedAt?: string | null;
  archivedAt?: string | null;
}

export interface OfferEvent {
  id: string;
  offerId: string;
  eventType: OfferEventType;
  actorUserId: string | null;
  personRef: string | null;
  conversationId: string | null;
  messageId: string | null;
  trackedLinkId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface OfferEventSeed {
  offerId: string;
  eventType: OfferEventType;
  actorUserId?: string | null;
  personRef?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  trackedLinkId?: string | null;
  metadata?: Record<string, unknown>;
}

export function isOfferStatus(value: string | null | undefined): value is OfferStatus {
  return (OFFER_STATUSES as readonly string[]).includes(value ?? "");
}

export function isOfferVisibility(value: string | null | undefined): value is OfferVisibility {
  return (OFFER_VISIBILITIES as readonly string[]).includes(value ?? "");
}

export function isOfferBillingKind(value: string | null | undefined): value is OfferBillingKind {
  return (OFFER_BILLING_KINDS as readonly string[]).includes(value ?? "");
}

export function isOfferEventType(value: string | null | undefined): value is OfferEventType {
  return (OFFER_EVENT_TYPES as readonly string[]).includes(value ?? "");
}
