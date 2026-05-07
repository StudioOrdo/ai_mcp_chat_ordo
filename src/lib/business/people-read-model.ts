import type Database from "better-sqlite3";

import { getDb } from "@/lib/db";
import type { OrdoSourceRef } from "@/lib/ordo-cards";
import {
  businessConversationDetailHref,
  businessOfferDetailHref,
  businessPersonDetailHref,
  businessReferralDetailHref,
  studioContentDetailHref,
} from "@/lib/ordo-details/ordo-detail-routes";

export type PersonCustomerStage =
  | "anonymous"
  | "known"
  | "interested"
  | "offer_chosen"
  | "purchased_simulated"
  | "customer"
  | "lost_or_inactive";

export type PersonStageLabel =
  | "Visitor"
  | "Contact"
  | "Conversation"
  | "Offer"
  | "Purchased"
  | "Follow-up";

export type PersonSourceCategory =
  | "website"
  | "qr_code"
  | "referral_link"
  | "direct_conversation"
  | "public_offer"
  | "public_content";

export type PersonRelationshipRole =
  | "Prospect"
  | "Customer"
  | "Affiliate"
  | "Collaborator"
  | "Staff";

export interface PersonRelationshipTrailItem {
  id: string;
  label: string;
  summary: string;
  occurredAt: string;
  sourceRef: OrdoSourceRef;
  sourceActionLabel?: string;
}

export interface PersonReadModelItem {
  id: string;
  ownerUserId: string;
  stage: PersonCustomerStage;
  stageLabel: PersonStageLabel;
  displayName: string;
  email: string | null;
  organization: string | null;
  summary: string;
  nextAction: string | null;
  sourceLabels: string[];
  sourceCategories: PersonSourceCategory[];
  offerLabels: string[];
  relationshipRole: PersonRelationshipRole;
  affiliate: boolean;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
  detailHref: string;
  primaryConversationId: string | null;
  conversationIds: string[];
  leadIds: string[];
  consultationRequestIds: string[];
  dealIds: string[];
  referralIds: string[];
  referralCodes: string[];
  offerIds: string[];
  sourceRefs: OrdoSourceRef[];
  provenanceRefs: OrdoSourceRef[];
  relationshipTrail: PersonRelationshipTrailItem[];
}

interface ConversationPersonRow {
  id: string;
  user_id: string;
  title: string;
  status: string;
  message_count: number;
  session_source: string | null;
  lane: string | null;
  detected_need_summary: string | null;
  recommended_next_step: string | null;
  referral_id: string | null;
  referral_source: string | null;
  created_at: string;
  updated_at: string;
  user_name: string | null;
  user_email: string | null;
  roles_csv: string | null;
}

interface ReferralPersonRow {
  id: string;
  referrer_user_id: string;
  referred_user_id: string | null;
  conversation_id: string | null;
  referral_code: string;
  status: string;
  credit_status: string;
  scanned_at: string | null;
  converted_at: string | null;
  last_validated_at: string | null;
  last_event_at: string | null;
  created_at: string;
  conversation_title: string | null;
  conversation_user_id: string | null;
  conversation_updated_at: string | null;
  conversation_next_step: string | null;
  user_name: string | null;
  user_email: string | null;
  roles_csv: string | null;
}

interface LeadPersonRow {
  id: string;
  conversation_id: string;
  name: string | null;
  email: string | null;
  organization: string | null;
  problem_summary: string | null;
  recommended_next_action: string | null;
  capture_status: string;
  created_at: string;
  updated_at: string;
  conversation_user_id: string;
  conversation_title: string | null;
  conversation_updated_at: string;
  referral_id: string | null;
  referral_code: string | null;
}

interface ConsultationPersonRow {
  id: string;
  conversation_id: string;
  user_id: string;
  request_summary: string;
  status: string;
  created_at: string;
  updated_at: string;
  conversation_title: string | null;
  referral_id: string | null;
  referral_code: string | null;
}

interface DealPersonRow {
  id: string;
  conversation_id: string;
  consultation_request_id: string | null;
  lead_record_id: string | null;
  user_id: string;
  title: string;
  organization_name: string | null;
  problem_summary: string;
  estimated_price: number | null;
  status: string;
  next_action: string | null;
  created_at: string;
  updated_at: string;
  conversation_title: string | null;
  lead_name: string | null;
  lead_email: string | null;
  lead_organization: string | null;
  referral_id: string | null;
  referral_code: string | null;
}

interface OfferEventPersonRow {
  id: string;
  offer_id: string;
  event_type: string;
  person_ref: string | null;
  conversation_id: string | null;
  tracked_link_id: string | null;
  created_at: string;
  offer_title: string;
  offer_slug: string;
  owner_user_id: string;
}

interface TrackedLinkPersonRow {
  id: string;
  tracked_link_id: string;
  event_type: string;
  conversation_id: string | null;
  user_id: string | null;
  referral_id: string | null;
  offer_id: string | null;
  anonymous_visit_id: string | null;
  created_at: string;
  code: string;
  target_kind: string;
  target_id: string;
  destination_url: string;
  label: string;
  purpose: string;
  created_from_conversation_id: string | null;
  user_name: string | null;
  user_email: string | null;
  roles_csv: string | null;
  content_title: string | null;
  content_slug: string | null;
  offer_title: string | null;
  offer_slug: string | null;
}

interface MutablePerson extends PersonReadModelItem {
  stageRank: number;
  lastEvidenceAt: string;
}

const STAGE_LABELS: Record<PersonCustomerStage, PersonStageLabel> = {
  anonymous: "Visitor",
  known: "Contact",
  interested: "Conversation",
  offer_chosen: "Offer",
  purchased_simulated: "Purchased",
  customer: "Purchased",
  lost_or_inactive: "Follow-up",
};

const STAGE_RANK: Record<PersonCustomerStage, number> = {
  anonymous: 0,
  known: 1,
  interested: 2,
  lost_or_inactive: 3,
  offer_chosen: 4,
  purchased_simulated: 5,
  customer: 6,
};

const STALE_AFTER_DAYS = 45;

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sourceRef(
  sourceKind: OrdoSourceRef["sourceKind"],
  sourceId: string,
  label: string,
  href?: string,
): OrdoSourceRef {
  return {
    sourceKind,
    sourceId,
    label,
    ...(href ? { href } : {}),
  };
}

function compactRefs(refs: Array<OrdoSourceRef | null | undefined>): OrdoSourceRef[] {
  const seen = new Set<string>();
  const result: OrdoSourceRef[] = [];

  for (const ref of refs) {
    if (!ref) continue;
    const key = `${ref.sourceKind}:${ref.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ref);
  }

  return result;
}

function compactStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = trimToNull(value);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function compactSourceCategories(
  values: Array<PersonSourceCategory | null | undefined>,
): PersonSourceCategory[] {
  return [...new Set(values.filter((value): value is PersonSourceCategory => Boolean(value)))];
}

function normalizeRoles(csv: string | null): Set<string> {
  return new Set((csv ?? "").split(",").map((role) => role.trim()).filter(Boolean));
}

function isAnonymousUser(row: { roles_csv: string | null; user_email?: string | null; user_name?: string | null }): boolean {
  const roles = normalizeRoles(row.roles_csv);
  if (roles.has("ANONYMOUS")) return true;
  const email = row.user_email?.toLowerCase() ?? "";
  const name = row.user_name?.toLowerCase() ?? "";
  return email.startsWith("anonymous") || name === "anonymous";
}

function parseTime(value: string | null | undefined): number {
  const parsed = Date.parse(value ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function newer(left: string, right: string): string {
  return parseTime(left) >= parseTime(right) ? left : right;
}

function isStale(updatedAt: string, now: Date): boolean {
  const updatedMs = parseTime(updatedAt);
  if (updatedMs === 0) return false;
  return now.getTime() - updatedMs > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

function stageLabel(stage: PersonCustomerStage): PersonStageLabel {
  return STAGE_LABELS[stage];
}

function humanizeToken(value: string): string {
  return value.replace(/_/g, " ").trim();
}

function sentenceFromToken(value: string): string {
  const text = humanizeToken(value);
  return text ? `${text[0]?.toUpperCase() ?? ""}${text.slice(1)}.` : "Evidence recorded.";
}

function roleForStage(stage: PersonCustomerStage): PersonRelationshipRole {
  if (stage === "customer" || stage === "purchased_simulated") {
    return "Customer";
  }

  return "Prospect";
}

function createPerson(input: {
  key: string;
  ownerUserId: string;
  stage: PersonCustomerStage;
  displayName: string;
  email?: string | null;
  organization?: string | null;
  summary: string;
  nextAction?: string | null;
  sourceLabels?: readonly string[];
  sourceCategories?: readonly PersonSourceCategory[];
  offerLabels?: readonly string[];
  relationshipRole?: PersonRelationshipRole | null;
  affiliate?: boolean;
  isAnonymous?: boolean;
  occurredAt: string;
  sourceRef: OrdoSourceRef;
  trail: Omit<PersonRelationshipTrailItem, "id"> & { id?: string };
  primaryConversationId?: string | null;
}): MutablePerson {
  const id = `person:${input.key}`;
  const detailHref = businessPersonDetailHref(id);
  const trailItem: PersonRelationshipTrailItem = {
    id: input.trail.id ?? `${input.sourceRef.sourceKind}:${input.sourceRef.sourceId}`,
    ...input.trail,
  };

  return {
    id,
    ownerUserId: input.ownerUserId,
    stage: input.stage,
    stageLabel: stageLabel(input.stage),
    displayName: input.displayName,
    email: trimToNull(input.email),
    organization: trimToNull(input.organization),
    summary: input.summary,
    nextAction: input.nextAction ?? null,
    sourceLabels: compactStrings([...(input.sourceLabels ?? [])]),
    sourceCategories: compactSourceCategories([...(input.sourceCategories ?? [])]),
    offerLabels: compactStrings([...(input.offerLabels ?? [])]),
    relationshipRole: input.relationshipRole ?? roleForStage(input.stage),
    affiliate: Boolean(input.affiliate),
    isAnonymous: Boolean(input.isAnonymous),
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
    detailHref,
    primaryConversationId: input.primaryConversationId ?? null,
    conversationIds: input.primaryConversationId ? [input.primaryConversationId] : [],
    leadIds: [],
    consultationRequestIds: [],
    dealIds: [],
    referralIds: [],
    referralCodes: [],
    offerIds: [],
    sourceRefs: [input.sourceRef],
    provenanceRefs: [input.sourceRef],
    relationshipTrail: [trailItem],
    stageRank: STAGE_RANK[input.stage],
    lastEvidenceAt: input.occurredAt,
  };
}

function advanceStage(person: MutablePerson, stage: PersonCustomerStage): void {
  const rank = STAGE_RANK[stage];
  if (rank >= person.stageRank) {
    person.stage = stage;
    person.stageLabel = stageLabel(stage);
    person.stageRank = rank;
  }
}

function mergePerson(
  people: Map<string, MutablePerson>,
  input: Parameters<typeof createPerson>[0],
): MutablePerson {
  const existing = people.get(input.key);
  if (!existing) {
    const created = createPerson(input);
    people.set(input.key, created);
    return created;
  }

  advanceStage(existing, input.stage);
  existing.updatedAt = newer(existing.updatedAt, input.occurredAt);
  existing.createdAt = parseTime(input.occurredAt) < parseTime(existing.createdAt) ? input.occurredAt : existing.createdAt;
  existing.lastEvidenceAt = newer(existing.lastEvidenceAt, input.occurredAt);
  existing.nextAction = existing.nextAction ?? input.nextAction ?? null;
  existing.isAnonymous = existing.isAnonymous && Boolean(input.isAnonymous);
  existing.email = existing.email ?? trimToNull(input.email);
  existing.organization = existing.organization ?? trimToNull(input.organization);
  existing.sourceLabels = compactStrings([...existing.sourceLabels, ...(input.sourceLabels ?? [])]);
  existing.sourceCategories = compactSourceCategories([
    ...existing.sourceCategories,
    ...(input.sourceCategories ?? []),
  ]);
  existing.offerLabels = compactStrings([...existing.offerLabels, ...(input.offerLabels ?? [])]);
  existing.relationshipRole = input.relationshipRole
    ?? (existing.relationshipRole === "Customer" ? existing.relationshipRole : roleForStage(existing.stage));
  existing.affiliate = existing.affiliate || Boolean(input.affiliate);

  if (existing.displayName === "Visitor" || existing.displayName === "Anonymous visitor") {
    existing.displayName = input.displayName;
  }
  if (existing.summary.length < input.summary.length || existing.summary === "Relationship evidence captured.") {
    existing.summary = input.summary;
  }
  if (input.primaryConversationId && !existing.conversationIds.includes(input.primaryConversationId)) {
    existing.conversationIds.push(input.primaryConversationId);
    existing.primaryConversationId ??= input.primaryConversationId;
  }

  existing.sourceRefs = compactRefs([...existing.sourceRefs, input.sourceRef]);
  existing.provenanceRefs = compactRefs([...existing.provenanceRefs, input.sourceRef]);
  existing.relationshipTrail.push({
    id: input.trail.id ?? `${input.sourceRef.sourceKind}:${input.sourceRef.sourceId}`,
    ...input.trail,
  });
  return existing;
}

function addUnique(target: string[], value: string | null | undefined): void {
  if (value && !target.includes(value)) {
    target.push(value);
  }
}

function addTrailItem(person: MutablePerson, item: PersonRelationshipTrailItem): void {
  if (person.relationshipTrail.some((existing) => existing.id === item.id)) {
    return;
  }
  person.relationshipTrail.push(item);
  person.sourceRefs = compactRefs([...person.sourceRefs, item.sourceRef]);
  person.provenanceRefs = compactRefs([...person.provenanceRefs, item.sourceRef]);
}

function keyFromLead(row: Pick<LeadPersonRow, "id" | "email" | "name">): string {
  const email = trimToNull(row.email)?.toLowerCase();
  if (email) return `email:${email}`;
  return `lead:${row.id}`;
}

function keyFromConversation(row: ConversationPersonRow, ownerUserId: string): string {
  if (isAnonymousUser(row)) return `conversation:${row.id}`;
  if (row.user_id === ownerUserId) return `user:${row.user_id}`;
  return `conversation:${row.id}`;
}

function keyFromReferral(row: ReferralPersonRow): string {
  if (row.referred_user_id) return `user:${row.referred_user_id}`;
  if (row.conversation_id) return `conversation:${row.conversation_id}`;
  return `referral:${row.id}`;
}

function keyFromDeal(row: DealPersonRow): string {
  if (row.lead_email) return `email:${row.lead_email.toLowerCase()}`;
  if (row.lead_record_id) return `lead:${row.lead_record_id}`;
  return `deal:${row.id}`;
}

function keyFromOfferPersonRef(personRef: string | null): string | null {
  const value = trimToNull(personRef);
  if (!value) return null;
  if (value.startsWith("person:lead_")) return `lead:${value.slice("person:".length)}`;
  if (value.startsWith("person:email:")) return `email:${value.slice("person:email:".length).toLowerCase()}`;
  if (value.startsWith("lead:")) return value;
  if (value.startsWith("email:")) return value.toLowerCase();
  return `external:${value}`;
}

function keyFromTrackedLinkEvent(
  row: TrackedLinkPersonRow,
  ownerUserId: string,
  conversationKeys: ReadonlyMap<string, string>,
): string | null {
  if (row.conversation_id) {
    const conversationKey = conversationKeys.get(row.conversation_id);
    if (conversationKey) return conversationKey;
    return `conversation:${row.conversation_id}`;
  }

  if (row.created_from_conversation_id) {
    const conversationKey = conversationKeys.get(row.created_from_conversation_id);
    if (conversationKey) return conversationKey;
  }

  if (row.user_id && !isAnonymousUser(row)) {
    return row.user_id === ownerUserId ? `user:${row.user_id}` : `user:${row.user_id}`;
  }

  return null;
}

function labelFromConversation(row: ConversationPersonRow, ownerUserId: string): string {
  if (isAnonymousUser(row)) return "Anonymous visitor";
  if (row.user_id === ownerUserId) return trimToNull(row.user_name) ?? "Account owner";
  return trimToNull(row.user_name) ?? "Contact";
}

function labelFromReferral(row: ReferralPersonRow): string {
  if (isAnonymousUser(row)) return "Referred visitor";
  return trimToNull(row.user_name) ?? (row.referred_user_id ? "Referred contact" : "Referred visitor");
}

function leadDisplayName(row: LeadPersonRow): string {
  return trimToNull(row.name)
    ?? trimToNull(row.organization)
    ?? trimToNull(row.email)
    ?? "Prospect";
}

function dealDisplayName(row: DealPersonRow): string {
  return trimToNull(row.lead_name)
    ?? trimToNull(row.lead_organization)
    ?? trimToNull(row.organization_name)
    ?? trimToNull(row.title)
    ?? "Prospect";
}

function sourceFromConversation(row: ConversationPersonRow): {
  labels: string[];
  categories: PersonSourceCategory[];
} {
  if (trimToNull(row.referral_id) || trimToNull(row.referral_source)) {
    return { labels: ["Referral link"], categories: ["referral_link"] };
  }

  if ((row.session_source ?? "").toLowerCase().includes("public")) {
    return { labels: ["Website"], categories: ["website"] };
  }

  return { labels: ["Direct conversation"], categories: ["direct_conversation"] };
}

function sourceFromReferral(row: ReferralPersonRow): {
  labels: string[];
  categories: PersonSourceCategory[];
} {
  if (trimToNull(row.scanned_at)) {
    return { labels: ["QR code"], categories: ["qr_code"] };
  }

  return { labels: ["Referral link"], categories: ["referral_link"] };
}

function sourceFromReferralCode(referralCode: string | null): {
  labels: string[];
  categories: PersonSourceCategory[];
} {
  return trimToNull(referralCode)
    ? { labels: ["Referral link"], categories: ["referral_link"] }
    : { labels: ["Direct conversation"], categories: ["direct_conversation"] };
}

function offerHref(row: Pick<OfferEventPersonRow | TrackedLinkPersonRow, "offer_id" | "offer_slug">): string {
  const slug = trimToNull(row.offer_slug);
  if (slug) {
    return `/offers/${encodeURIComponent(slug)}`;
  }

  return row.offer_id ? businessOfferDetailHref(row.offer_id) : "/offers";
}

function trackedTargetHref(row: TrackedLinkPersonRow): string {
  if (row.target_kind === "content_item") {
    return studioContentDetailHref(row.target_id);
  }

  if (row.target_kind === "offer" || row.offer_id) {
    return offerHref({
      offer_id: row.offer_id ?? row.target_id,
      offer_slug: row.offer_slug,
    });
  }

  return row.destination_url;
}

function trackedSourceActionLabel(row: TrackedLinkPersonRow): string {
  if (row.target_kind === "content_item") return "View content";
  if (row.target_kind === "offer" || row.offer_id) return "View offer";
  return "Open link";
}

function trackedTargetLabel(row: TrackedLinkPersonRow): string {
  return trimToNull(row.content_title)
    ?? trimToNull(row.offer_title)
    ?? trimToNull(row.label)
    ?? row.code;
}

function offerTrailCopy(eventType: string): { label: string; verb: string; stage: PersonCustomerStage; nextAction: string | null } | null {
  switch (eventType) {
    case "sent_private":
      return {
        label: "Offer sent",
        verb: "was sent privately",
        stage: "interested",
        nextAction: null,
      };
    case "viewed":
      return {
        label: "Offer viewed",
        verb: "was viewed",
        stage: "interested",
        nextAction: null,
      };
    case "chosen":
      return {
        label: "Offer accepted",
        verb: "was accepted",
        stage: "offer_chosen",
        nextAction: "Follow up on the accepted offer.",
      };
    case "purchase_simulated":
      return {
        label: "Purchase simulated",
        verb: "was marked purchased",
        stage: "purchased_simulated",
        nextAction: null,
      };
    default:
      return null;
  }
}

function listOwnerConversations(db: Database.Database, ownerUserId: string): ConversationPersonRow[] {
  return db.prepare(
    `SELECT
       c.id,
       c.user_id,
       c.title,
       c.status,
       c.message_count,
       c.session_source,
       c.lane,
       c.detected_need_summary,
       c.recommended_next_step,
       c.referral_id,
       c.referral_source,
       c.created_at,
       c.updated_at,
       u.name AS user_name,
       u.email AS user_email,
       GROUP_CONCAT(r.name) AS roles_csv
     FROM conversations c
     INNER JOIN users u ON u.id = c.user_id
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE c.user_id = ?
       AND c.deleted_at IS NULL
     GROUP BY c.id
     ORDER BY c.updated_at DESC`,
  ).all(ownerUserId) as ConversationPersonRow[];
}

function listOwnerReferrals(db: Database.Database, ownerUserId: string): ReferralPersonRow[] {
  return db.prepare(
    `SELECT
       rf.id,
       rf.referrer_user_id,
       rf.referred_user_id,
       rf.conversation_id,
       rf.referral_code,
       rf.status,
       rf.credit_status,
       rf.scanned_at,
       rf.converted_at,
       rf.last_validated_at,
       rf.last_event_at,
       rf.created_at,
      c.title AS conversation_title,
      c.user_id AS conversation_user_id,
      c.updated_at AS conversation_updated_at,
      c.recommended_next_step AS conversation_next_step,
      u.name AS user_name,
       u.email AS user_email,
       GROUP_CONCAT(role.name) AS roles_csv
     FROM referrals rf
     LEFT JOIN conversations c ON c.id = rf.conversation_id
     LEFT JOIN users u ON u.id = COALESCE(rf.referred_user_id, c.user_id)
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles role ON role.id = ur.role_id
     WHERE rf.referrer_user_id = ?
     GROUP BY rf.id
     ORDER BY COALESCE(rf.last_event_at, rf.last_validated_at, rf.scanned_at, rf.created_at) DESC`,
  ).all(ownerUserId) as ReferralPersonRow[];
}

function listOwnerLeads(db: Database.Database, ownerUserId: string): LeadPersonRow[] {
  return db.prepare(
    `SELECT
       lr.id,
       lr.conversation_id,
       lr.name,
       lr.email,
       lr.organization,
       lr.problem_summary,
       lr.recommended_next_action,
       lr.capture_status,
       lr.created_at,
       lr.updated_at,
       c.user_id AS conversation_user_id,
       c.title AS conversation_title,
       c.updated_at AS conversation_updated_at,
       rf.id AS referral_id,
       rf.referral_code
     FROM lead_records lr
     INNER JOIN conversations c ON c.id = lr.conversation_id
     LEFT JOIN referrals rf ON rf.conversation_id = c.id
     WHERE c.user_id = ? OR rf.referrer_user_id = ?
     ORDER BY lr.updated_at DESC`,
  ).all(ownerUserId, ownerUserId) as LeadPersonRow[];
}

function listOwnerConsultations(db: Database.Database, ownerUserId: string): ConsultationPersonRow[] {
  return db.prepare(
    `SELECT
       cr.id,
       cr.conversation_id,
       cr.user_id,
       cr.request_summary,
       cr.status,
       cr.created_at,
       cr.updated_at,
       c.title AS conversation_title,
       rf.id AS referral_id,
       rf.referral_code
     FROM consultation_requests cr
     INNER JOIN conversations c ON c.id = cr.conversation_id
     LEFT JOIN referrals rf ON rf.conversation_id = c.id
     WHERE cr.user_id = ? OR rf.referrer_user_id = ?
     ORDER BY cr.updated_at DESC`,
  ).all(ownerUserId, ownerUserId) as ConsultationPersonRow[];
}

function listOwnerDeals(db: Database.Database, ownerUserId: string): DealPersonRow[] {
  return db.prepare(
    `SELECT
       dr.id,
       dr.conversation_id,
       dr.consultation_request_id,
       dr.lead_record_id,
       dr.user_id,
       dr.title,
       dr.organization_name,
       dr.problem_summary,
       dr.estimated_price,
       dr.status,
       dr.next_action,
       dr.created_at,
       dr.updated_at,
       c.title AS conversation_title,
       lr.name AS lead_name,
       lr.email AS lead_email,
       lr.organization AS lead_organization,
       rf.id AS referral_id,
       rf.referral_code
     FROM deal_records dr
     INNER JOIN conversations c ON c.id = dr.conversation_id
     LEFT JOIN lead_records lr ON lr.id = dr.lead_record_id
     LEFT JOIN referrals rf ON rf.conversation_id = c.id
     WHERE dr.user_id = ? OR rf.referrer_user_id = ?
     ORDER BY dr.updated_at DESC`,
  ).all(ownerUserId, ownerUserId) as DealPersonRow[];
}

function listOwnerOfferEvents(db: Database.Database, ownerUserId: string): OfferEventPersonRow[] {
  return db.prepare(
    `SELECT
       oe.id,
       oe.offer_id,
       oe.event_type,
       oe.person_ref,
       oe.conversation_id,
       oe.tracked_link_id,
       oe.created_at,
       o.title AS offer_title,
       o.slug AS offer_slug,
       o.owner_user_id
     FROM offer_events oe
     INNER JOIN offers o ON o.id = oe.offer_id
     WHERE o.owner_user_id = ?
     ORDER BY oe.created_at ASC`,
  ).all(ownerUserId) as OfferEventPersonRow[];
}

function listOwnerTrackedLinkEvents(db: Database.Database, ownerUserId: string): TrackedLinkPersonRow[] {
  return db.prepare(
    `SELECT
       tle.id,
       tle.tracked_link_id,
       tle.event_type,
       tle.conversation_id,
       tle.user_id,
       tle.referral_id,
       tle.offer_id,
       tle.anonymous_visit_id,
       tle.created_at,
       tl.code,
       tl.target_kind,
       tl.target_id,
       tl.destination_url,
       tl.label,
       tl.purpose,
       tl.created_from_conversation_id,
       u.name AS user_name,
       u.email AS user_email,
       GROUP_CONCAT(role.name) AS roles_csv,
       bp.title AS content_title,
       bp.slug AS content_slug,
       o.title AS offer_title,
       o.slug AS offer_slug
     FROM tracked_link_events tle
     INNER JOIN tracked_links tl ON tl.id = tle.tracked_link_id
     LEFT JOIN users u ON u.id = tle.user_id
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles role ON role.id = ur.role_id
     LEFT JOIN blog_posts bp ON bp.id = tl.target_id AND tl.target_kind = 'content_item'
     LEFT JOIN offers o ON o.id = COALESCE(tle.offer_id, CASE WHEN tl.target_kind = 'offer' THEN tl.target_id ELSE NULL END)
     WHERE tl.owner_user_id = ?
     GROUP BY tle.id
     ORDER BY tle.created_at ASC`,
  ).all(ownerUserId) as TrackedLinkPersonRow[];
}

export function derivePeopleReadModel(
  input: {
    ownerUserId: string;
    conversations?: readonly ConversationPersonRow[];
    referrals?: readonly ReferralPersonRow[];
    leads?: readonly LeadPersonRow[];
    consultations?: readonly ConsultationPersonRow[];
    deals?: readonly DealPersonRow[];
    offerEvents?: readonly OfferEventPersonRow[];
    trackedLinkEvents?: readonly TrackedLinkPersonRow[];
    now?: Date;
  },
): PersonReadModelItem[] {
  const people = new Map<string, MutablePerson>();
  const conversationKeys = new Map<string, string>();
  const leadKeys = new Map<string, string>();
  const consultationKeys = new Map<string, string>();
  const dealKeys = new Map<string, string>();
  const now = input.now ?? new Date();

  for (const row of input.conversations ?? []) {
    const stale = isStale(row.updated_at, now) && !trimToNull(row.recommended_next_step);
    const stage: PersonCustomerStage = stale
      ? "lost_or_inactive"
      : isAnonymousUser(row)
        ? "anonymous"
        : "known";
    const key = keyFromConversation(row, input.ownerUserId);
    const href = businessConversationDetailHref(row.id);
    const ref = sourceRef("conversation", row.id, "Conversation", href);
    const source = sourceFromConversation(row);
    const person = mergePerson(people, {
      key,
      ownerUserId: input.ownerUserId,
      stage,
      displayName: labelFromConversation(row, input.ownerUserId),
      email: isAnonymousUser(row) ? null : row.user_email,
      summary: trimToNull(row.detected_need_summary)
        ?? trimToNull(row.title)
        ?? `${row.message_count} conversation messages recorded.`,
      nextAction: trimToNull(row.recommended_next_step),
      sourceLabels: source.labels,
      sourceCategories: source.categories,
      isAnonymous: isAnonymousUser(row),
      occurredAt: row.updated_at,
      sourceRef: ref,
      primaryConversationId: row.id,
      trail: {
        label: stale ? "Follow-up scheduled" : "Conversation started",
        summary: trimToNull(row.title) ?? "Conversation evidence captured.",
        occurredAt: stale ? row.updated_at : row.created_at,
        sourceRef: ref,
        sourceActionLabel: "Open conversation",
      },
    });
    conversationKeys.set(row.id, key);
    addUnique(person.conversationIds, row.id);
  }

  for (const row of input.referrals ?? []) {
    const key = keyFromReferral(row);
    const href = businessReferralDetailHref(row.referral_code);
    const ref = sourceRef("referral", row.id, `Referral ${row.referral_code}`, href);
    const occurredAt = row.last_event_at ?? row.last_validated_at ?? row.scanned_at ?? row.created_at;
    const source = sourceFromReferral(row);
    const stage: PersonCustomerStage = row.conversation_updated_at
      && isStale(row.conversation_updated_at, now)
      && !trimToNull(row.conversation_next_step)
      ? "lost_or_inactive"
      : row.converted_at || row.referred_user_id ? "known" : "anonymous";
    const person = mergePerson(people, {
      key,
      ownerUserId: input.ownerUserId,
      stage,
      displayName: labelFromReferral(row),
      email: row.referred_user_id && !isAnonymousUser(row) ? row.user_email : null,
      summary: `Arrived through referral ${row.referral_code}.`,
      nextAction: row.status === "visited" ? "Invite them to continue the conversation." : null,
      sourceLabels: source.labels,
      sourceCategories: source.categories,
      isAnonymous: !row.referred_user_id,
      occurredAt,
      sourceRef: ref,
      primaryConversationId: row.conversation_id,
      trail: {
        label: "First visit",
        summary: `Visited through referral ${row.referral_code}.`,
        occurredAt: row.created_at,
        sourceRef: ref,
        sourceActionLabel: "Open referral",
      },
    });
    addTrailItem(person, {
      id: `referral-source:${row.id}`,
      label: "QR / referral source",
      summary: source.categories.includes("qr_code")
        ? `QR code recorded for referral ${row.referral_code}.`
        : `Referral link recorded for ${row.referral_code}.`,
      occurredAt,
      sourceRef: ref,
      sourceActionLabel: "Open referral",
    });
    addUnique(person.referralIds, row.id);
    addUnique(person.referralCodes, row.referral_code);
    if (row.conversation_id) conversationKeys.set(row.conversation_id, key);
  }

  for (const row of input.leads ?? []) {
    const key = keyFromLead(row);
    const href = businessConversationDetailHref(row.conversation_id);
    const ref = sourceRef("lead", row.id, "Lead", href);
    const source = sourceFromReferralCode(row.referral_code);
    const person = mergePerson(people, {
      key,
      ownerUserId: input.ownerUserId,
      stage: "interested",
      displayName: leadDisplayName(row),
      email: row.email,
      organization: row.organization,
      summary: trimToNull(row.problem_summary) ?? "Lead evidence captured.",
      nextAction: trimToNull(row.recommended_next_action),
      sourceLabels: source.labels,
      sourceCategories: source.categories,
      isAnonymous: false,
      occurredAt: row.updated_at,
      sourceRef: ref,
      primaryConversationId: row.conversation_id,
      trail: {
        label: "Contact captured",
        summary: sentenceFromToken(row.capture_status),
        occurredAt: row.updated_at,
        sourceRef: ref,
        sourceActionLabel: "Open conversation",
      },
    });
    addUnique(person.leadIds, row.id);
    addUnique(person.conversationIds, row.conversation_id);
    addUnique(person.referralIds, row.referral_id);
    addUnique(person.referralCodes, row.referral_code);
    addTrailItem(person, {
      id: `conversation:${row.conversation_id}`,
      label: "Conversation started",
      summary: trimToNull(row.conversation_title) ?? "Conversation evidence captured.",
      occurredAt: row.conversation_updated_at,
      sourceRef: sourceRef("conversation", row.conversation_id, "Conversation", businessConversationDetailHref(row.conversation_id)),
      sourceActionLabel: "Open conversation",
    });
    conversationKeys.set(row.conversation_id, key);
    leadKeys.set(row.id, key);
  }

  for (const row of input.consultations ?? []) {
    const key = conversationKeys.get(row.conversation_id) ?? `consultation:${row.id}`;
    const href = businessConversationDetailHref(row.conversation_id);
    const ref = sourceRef("consultation", row.id, "Consultation", href);
    const source = sourceFromReferralCode(row.referral_code);
    const person = mergePerson(people, {
      key,
      ownerUserId: input.ownerUserId,
      stage: "interested",
      displayName: trimToNull(row.conversation_title) ?? "Prospect",
      summary: trimToNull(row.request_summary) ?? "Consultation requested.",
      nextAction: "Review consultation request.",
      sourceLabels: source.labels,
      sourceCategories: source.categories,
      isAnonymous: false,
      occurredAt: row.updated_at,
      sourceRef: ref,
      primaryConversationId: row.conversation_id,
      trail: {
        label: "Owner action taken",
        summary: `Consultation request ${humanizeToken(row.status)}.`,
        occurredAt: row.updated_at,
        sourceRef: ref,
        sourceActionLabel: "Open conversation",
      },
    });
    addUnique(person.consultationRequestIds, row.id);
    addUnique(person.conversationIds, row.conversation_id);
    addUnique(person.referralIds, row.referral_id);
    addUnique(person.referralCodes, row.referral_code);
    conversationKeys.set(row.conversation_id, key);
    consultationKeys.set(row.id, key);
  }

  for (const row of input.deals ?? []) {
    const key = (row.lead_record_id ? leadKeys.get(row.lead_record_id) : null)
      ?? (row.consultation_request_id ? consultationKeys.get(row.consultation_request_id) : null)
      ?? conversationKeys.get(row.conversation_id)
      ?? keyFromDeal(row);
    const href = businessConversationDetailHref(row.conversation_id);
    const ref = sourceRef("deal", row.id, "Deal", href);
    const completed = ["won", "completed", "paid", "closed_won"].includes(row.status);
    const source = sourceFromReferralCode(row.referral_code);
    const person = mergePerson(people, {
      key,
      ownerUserId: input.ownerUserId,
      stage: completed ? "customer" : "interested",
      displayName: dealDisplayName(row),
      email: row.lead_email,
      organization: row.lead_organization ?? row.organization_name,
      summary: trimToNull(row.problem_summary) ?? trimToNull(row.title) ?? "Deal evidence captured.",
      nextAction: trimToNull(row.next_action),
      sourceLabels: source.labels,
      sourceCategories: source.categories,
      isAnonymous: false,
      occurredAt: row.updated_at,
      sourceRef: ref,
      primaryConversationId: row.conversation_id,
      trail: {
        label: completed ? "Purchase or customer outcome" : "Owner action taken",
        summary: `${trimToNull(row.title) ?? "Relationship work"} ${humanizeToken(row.status)}.`,
        occurredAt: row.updated_at,
        sourceRef: ref,
        sourceActionLabel: "Open conversation",
      },
    });
    addUnique(person.dealIds, row.id);
    addUnique(person.conversationIds, row.conversation_id);
    addUnique(person.referralIds, row.referral_id);
    addUnique(person.referralCodes, row.referral_code);
    if (row.lead_record_id) leadKeys.set(row.lead_record_id, key);
    if (row.consultation_request_id) consultationKeys.set(row.consultation_request_id, key);
    conversationKeys.set(row.conversation_id, key);
    dealKeys.set(row.id, key);
  }

  for (const row of input.offerEvents ?? []) {
    const copy = offerTrailCopy(row.event_type);
    if (!copy) {
      continue;
    }
    const personRefKey = keyFromOfferPersonRef(row.person_ref);
    const leadKey = personRefKey?.startsWith("lead:")
      ? leadKeys.get(personRefKey.slice("lead:".length))
      : null;
    const key = leadKey
      ?? personRefKey
      ?? (row.conversation_id ? conversationKeys.get(row.conversation_id) : null)
      ?? (row.person_ref ? `external:${row.person_ref}` : null);
    if (!key) {
      continue;
    }

    const ref = sourceRef("offer_event", row.id, row.offer_title, offerHref(row));
    const person = mergePerson(people, {
      key,
      ownerUserId: input.ownerUserId,
      stage: copy.stage,
      displayName: "Prospect",
      summary: `${row.offer_title} ${copy.verb}.`,
      nextAction: copy.nextAction,
      sourceLabels: ["Public offer"],
      sourceCategories: ["public_offer"],
      offerLabels: [row.offer_title],
      isAnonymous: false,
      occurredAt: row.created_at,
      sourceRef: ref,
      primaryConversationId: row.conversation_id,
      trail: {
        label: copy.label,
        summary: `${row.offer_title} ${copy.verb}.`,
        occurredAt: row.created_at,
        sourceRef: ref,
        sourceActionLabel: "View offer",
      },
    });
    addUnique(person.offerIds, row.offer_id);
    addUnique(person.conversationIds, row.conversation_id);
  }

  for (const row of input.trackedLinkEvents ?? []) {
    const key = keyFromTrackedLinkEvent(row, input.ownerUserId, conversationKeys);
    if (!key) {
      continue;
    }

    const targetLabel = trackedTargetLabel(row);
    const href = trackedTargetHref(row);
    const actionLabel = trackedSourceActionLabel(row);
    const ref = sourceRef("tracked_link_event", row.id, targetLabel, href);
    const isContentEvent = row.target_kind === "content_item" && ["visit", "scan"].includes(row.event_type);
    const isQrSourceEvent = row.event_type === "scan";
    const isConversationEvent = row.event_type === "chat_started" && row.conversation_id;
    const isSignupEvent = row.event_type === "signup" && row.user_id;

    if (!isContentEvent && !isQrSourceEvent && !isConversationEvent && !isSignupEvent) {
      continue;
    }

    const stage: PersonCustomerStage = isSignupEvent
      ? "known"
      : isConversationEvent
        ? "interested"
        : "anonymous";
    const label = isQrSourceEvent
      ? "QR / referral source"
      : isConversationEvent
        ? "Conversation started"
        : isSignupEvent
          ? "Contact registered"
          : "Public content viewed";
    const summary = isQrSourceEvent
      ? `QR or tracked link ${row.code} opened ${targetLabel}.`
      : isConversationEvent
        ? `Conversation started from ${targetLabel}.`
        : isSignupEvent
          ? `Contact registered from ${targetLabel}.`
          : `${targetLabel} was viewed.`;
    const sourceLabelForPerson = isQrSourceEvent
      ? "QR code"
      : row.target_kind === "content_item"
        ? "Public content"
        : "QR code";
    const sourceCategory: PersonSourceCategory = isQrSourceEvent
      ? "qr_code"
      : row.target_kind === "content_item"
        ? "public_content"
        : "qr_code";
    const person = mergePerson(people, {
      key,
      ownerUserId: input.ownerUserId,
      stage,
      displayName: trimToNull(row.user_name) ?? trimToNull(row.user_email) ?? "Tracked visitor",
      email: isAnonymousUser(row) ? null : row.user_email,
      summary,
      nextAction: null,
      sourceLabels: [sourceLabelForPerson],
      sourceCategories: [sourceCategory],
      isAnonymous: !row.user_id || isAnonymousUser(row),
      occurredAt: row.created_at,
      sourceRef: ref,
      primaryConversationId: row.conversation_id ?? row.created_from_conversation_id,
      trail: {
        id: `tracked-link:${row.id}`,
        label,
        summary,
        occurredAt: row.created_at,
        sourceRef: ref,
        sourceActionLabel: actionLabel,
      },
    });

    addUnique(person.conversationIds, row.conversation_id);
    addUnique(person.referralIds, row.referral_id);
    addUnique(person.offerIds, row.offer_id);
  }

  return Array.from(people.values())
    .map(({ stageRank: _stageRank, lastEvidenceAt: _lastEvidenceAt, ...person }) => ({
      ...person,
      sourceRefs: compactRefs(person.sourceRefs),
      provenanceRefs: compactRefs(person.provenanceRefs),
      relationshipTrail: [...person.relationshipTrail].sort((left, right) => (
        parseTime(left.occurredAt) - parseTime(right.occurredAt)
        || left.id.localeCompare(right.id)
      )),
    }))
    .sort((left, right) => parseTime(right.updatedAt) - parseTime(left.updatedAt));
}

export async function loadPeopleReadModel(
  ownerUserId: string,
  options: { db?: Database.Database; now?: Date } = {},
): Promise<PersonReadModelItem[]> {
  const db = options.db ?? getDb();
  return derivePeopleReadModel({
    ownerUserId,
    conversations: listOwnerConversations(db, ownerUserId),
    referrals: listOwnerReferrals(db, ownerUserId),
    leads: listOwnerLeads(db, ownerUserId),
    consultations: listOwnerConsultations(db, ownerUserId),
    deals: listOwnerDeals(db, ownerUserId),
    offerEvents: listOwnerOfferEvents(db, ownerUserId),
    trackedLinkEvents: listOwnerTrackedLinkEvents(db, ownerUserId),
    now: options.now,
  });
}

export async function loadPersonReadModelItem(
  ownerUserId: string,
  personId: string,
  options: { db?: Database.Database; now?: Date } = {},
): Promise<PersonReadModelItem | null> {
  const people = await loadPeopleReadModel(ownerUserId, options);
  return people.find((person) => person.id === personId) ?? null;
}
