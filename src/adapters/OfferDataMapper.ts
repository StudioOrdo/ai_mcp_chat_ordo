import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

import {
  isOfferBillingKind,
  isOfferEventType,
  isOfferStatus,
  isOfferVisibility,
  type Offer,
  type OfferBillingKind,
  type OfferEvent,
  type OfferEventSeed,
  type OfferPatch,
  type OfferSeed,
  type OfferStatus,
  type OfferVisibility,
} from "@/core/entities/offer";
import type { OfferRepository } from "@/core/use-cases/OfferRepository";

interface OfferRow {
  id: string;
  slug: string;
  owner_user_id: string;
  title: string;
  summary: string;
  description: string;
  audience: string;
  promise: string;
  price_cents: number | null;
  currency: string;
  billing_kind: string;
  estimated_minutes: number | null;
  status: string;
  visibility: string;
  cta_label: string;
  created_from_conversation_id: string | null;
  created_from_message_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
}

interface OfferEventRow {
  id: string;
  offer_id: string;
  event_type: string;
  actor_user_id: string | null;
  person_ref: string | null;
  conversation_id: string | null;
  message_id: string | null;
  tracked_link_id: string | null;
  metadata_json: string;
  created_at: string;
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function mapOfferRow(row: OfferRow): Offer {
  return {
    id: row.id,
    slug: row.slug,
    ownerUserId: row.owner_user_id,
    title: row.title,
    summary: row.summary,
    description: row.description,
    audience: row.audience,
    promise: row.promise,
    priceCents: row.price_cents,
    currency: row.currency,
    billingKind: isOfferBillingKind(row.billing_kind) ? row.billing_kind : "contact",
    estimatedMinutes: row.estimated_minutes,
    status: isOfferStatus(row.status) ? row.status : "draft",
    visibility: isOfferVisibility(row.visibility) ? row.visibility : "private",
    ctaLabel: row.cta_label,
    createdFromConversationId: row.created_from_conversation_id,
    createdFromMessageId: row.created_from_message_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
  };
}

function mapEventRow(row: OfferEventRow): OfferEvent {
  return {
    id: row.id,
    offerId: row.offer_id,
    eventType: isOfferEventType(row.event_type) ? row.event_type : "updated",
    actorUserId: row.actor_user_id,
    personRef: row.person_ref,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    trackedLinkId: row.tracked_link_id,
    metadata: parseJsonObject(row.metadata_json),
    createdAt: row.created_at,
  };
}

export class OfferDataMapper implements OfferRepository {
  constructor(private readonly db: Database.Database) {}

  async create(seed: OfferSeed): Promise<Offer> {
    const id = `offer_${randomUUID()}`;
    const now = new Date().toISOString();

    this.db.prepare(
      `INSERT INTO offers (
         id, slug, owner_user_id, title, summary, description, audience, promise,
         price_cents, currency, billing_kind, estimated_minutes, status, visibility,
         cta_label, created_from_conversation_id, created_from_message_id,
         created_at, updated_at, published_at, archived_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
    ).run(
      id,
      seed.slug,
      seed.ownerUserId,
      seed.title,
      seed.summary,
      seed.description,
      seed.audience,
      seed.promise,
      seed.priceCents,
      seed.currency,
      seed.billingKind,
      seed.estimatedMinutes,
      seed.status ?? "draft",
      seed.visibility ?? "private",
      seed.ctaLabel,
      seed.createdFromConversationId ?? null,
      seed.createdFromMessageId ?? null,
      now,
      now,
    );

    const offer = await this.findById(id);
    if (!offer) {
      throw new Error("Failed to read created offer.");
    }

    return offer;
  }

  async findById(id: string): Promise<Offer | null> {
    const row = this.db.prepare(`SELECT * FROM offers WHERE id = ?`).get(id) as OfferRow | undefined;
    return row ? mapOfferRow(row) : null;
  }

  async findBySlug(slug: string): Promise<Offer | null> {
    const row = this.db.prepare(`SELECT * FROM offers WHERE slug = ?`).get(slug) as OfferRow | undefined;
    return row ? mapOfferRow(row) : null;
  }

  async listByOwnerUserId(ownerUserId: string): Promise<Offer[]> {
    const rows = this.db.prepare(
      `SELECT * FROM offers
       WHERE owner_user_id = ?
       ORDER BY
         CASE status
           WHEN 'draft' THEN 0
           WHEN 'ready' THEN 1
           WHEN 'published' THEN 2
           ELSE 3
         END,
         updated_at DESC`,
    ).all(ownerUserId) as OfferRow[];

    return rows.map(mapOfferRow);
  }

  async listPublishedPublic(): Promise<Offer[]> {
    const rows = this.db.prepare(
      `SELECT * FROM offers
       WHERE status = 'published'
         AND visibility = 'public'
         AND archived_at IS NULL
       ORDER BY published_at DESC, updated_at DESC`,
    ).all() as OfferRow[];

    return rows.map(mapOfferRow);
  }

  async update(id: string, patch: OfferPatch): Promise<Offer | null> {
    const current = await this.findById(id);
    if (!current) {
      return null;
    }

    const now = new Date().toISOString();
    this.db.prepare(
      `UPDATE offers
       SET slug = ?,
           title = ?,
           summary = ?,
           description = ?,
           audience = ?,
           promise = ?,
           price_cents = ?,
           currency = ?,
           billing_kind = ?,
           estimated_minutes = ?,
           status = ?,
           visibility = ?,
           cta_label = ?,
           updated_at = ?,
           published_at = ?,
           archived_at = ?
       WHERE id = ?`,
    ).run(
      patch.slug ?? current.slug,
      patch.title ?? current.title,
      patch.summary ?? current.summary,
      patch.description ?? current.description,
      patch.audience ?? current.audience,
      patch.promise ?? current.promise,
      Object.prototype.hasOwnProperty.call(patch, "priceCents") ? patch.priceCents ?? null : current.priceCents,
      patch.currency ?? current.currency,
      (patch.billingKind ?? current.billingKind) satisfies OfferBillingKind,
      Object.prototype.hasOwnProperty.call(patch, "estimatedMinutes") ? patch.estimatedMinutes ?? null : current.estimatedMinutes,
      (patch.status ?? current.status) satisfies OfferStatus,
      (patch.visibility ?? current.visibility) satisfies OfferVisibility,
      patch.ctaLabel ?? current.ctaLabel,
      now,
      Object.prototype.hasOwnProperty.call(patch, "publishedAt") ? patch.publishedAt ?? null : current.publishedAt,
      Object.prototype.hasOwnProperty.call(patch, "archivedAt") ? patch.archivedAt ?? null : current.archivedAt,
      id,
    );

    return this.findById(id);
  }

  async createEvent(seed: OfferEventSeed): Promise<OfferEvent> {
    const id = `offer_evt_${randomUUID()}`;
    const now = new Date().toISOString();

    this.db.prepare(
      `INSERT INTO offer_events (
         id, offer_id, event_type, actor_user_id, person_ref, conversation_id,
         message_id, tracked_link_id, metadata_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      seed.offerId,
      seed.eventType,
      seed.actorUserId ?? null,
      seed.personRef ?? null,
      seed.conversationId ?? null,
      seed.messageId ?? null,
      seed.trackedLinkId ?? null,
      JSON.stringify(seed.metadata ?? {}),
      now,
    );

    const row = this.db.prepare(`SELECT * FROM offer_events WHERE id = ?`).get(id) as OfferEventRow | undefined;
    if (!row) {
      throw new Error("Failed to read created offer event.");
    }

    return mapEventRow(row);
  }

  async listEventsByOfferId(offerId: string): Promise<OfferEvent[]> {
    const rows = this.db.prepare(
      `SELECT * FROM offer_events
       WHERE offer_id = ?
       ORDER BY created_at ASC`,
    ).all(offerId) as OfferEventRow[];

    return rows.map(mapEventRow);
  }
}
