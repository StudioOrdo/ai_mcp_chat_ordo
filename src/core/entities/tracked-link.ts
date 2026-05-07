export const TRACKED_LINK_TARGET_KINDS = [
  "offer",
  "content_item",
  "media_asset",
  "campaign",
  "person",
  "referral",
  "url",
] as const;

export type TrackedLinkTargetKind = typeof TRACKED_LINK_TARGET_KINDS[number];

export const TRACKED_LINK_STATUSES = [
  "active",
  "archived",
] as const;

export type TrackedLinkStatus = typeof TRACKED_LINK_STATUSES[number];

export const TRACKED_LINK_EVENT_TYPES = [
  "scan",
  "visit",
  "chat_started",
  "signup",
  "offer_viewed",
  "offer_chosen",
  "purchase_simulated",
  "conversion",
] as const;

export type TrackedLinkEventType = typeof TRACKED_LINK_EVENT_TYPES[number];

export interface TrackedLink {
  id: string;
  code: string;
  ownerUserId: string;
  targetKind: TrackedLinkTargetKind;
  targetId: string;
  destinationUrl: string;
  label: string;
  purpose: string;
  status: TrackedLinkStatus;
  createdFromConversationId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface TrackedLinkSeed {
  code: string;
  ownerUserId: string;
  targetKind: TrackedLinkTargetKind;
  targetId: string;
  destinationUrl: string;
  label: string;
  purpose: string;
  status?: TrackedLinkStatus;
  createdFromConversationId?: string | null;
}

export interface TrackedLinkPatch {
  destinationUrl?: string;
  label?: string;
  purpose?: string;
  status?: TrackedLinkStatus;
  archivedAt?: string | null;
}

export interface TrackedLinkEvent {
  id: string;
  trackedLinkId: string;
  eventType: TrackedLinkEventType;
  anonymousVisitId: string | null;
  sessionId: string | null;
  conversationId: string | null;
  userId: string | null;
  referralId: string | null;
  offerId: string | null;
  idempotencyKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TrackedLinkEventSeed {
  trackedLinkId: string;
  eventType: TrackedLinkEventType;
  anonymousVisitId?: string | null;
  sessionId?: string | null;
  conversationId?: string | null;
  userId?: string | null;
  referralId?: string | null;
  offerId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TrackedLinkEventAppendResult extends TrackedLinkEvent {
  wasInserted: boolean;
}

export interface TrackedLinkPerformanceSummary {
  visits: number;
  chats: number;
  signups: number;
  offerViews: number;
  offerChoices: number;
  simulatedPurchases: number;
  conversions: number;
}

export interface TrackedLinkWithPerformance {
  link: TrackedLink;
  performance: TrackedLinkPerformanceSummary;
}

export function isTrackedLinkTargetKind(value: string | null | undefined): value is TrackedLinkTargetKind {
  return (TRACKED_LINK_TARGET_KINDS as readonly string[]).includes(value ?? "");
}

export function isTrackedLinkStatus(value: string | null | undefined): value is TrackedLinkStatus {
  return (TRACKED_LINK_STATUSES as readonly string[]).includes(value ?? "");
}

export function isTrackedLinkEventType(value: string | null | undefined): value is TrackedLinkEventType {
  return (TRACKED_LINK_EVENT_TYPES as readonly string[]).includes(value ?? "");
}
