import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

import {
  isTrackedLinkEventType,
  isTrackedLinkStatus,
  isTrackedLinkTargetKind,
  type TrackedLink,
  type TrackedLinkEvent,
  type TrackedLinkEventAppendResult,
  type TrackedLinkEventSeed,
  type TrackedLinkPatch,
  type TrackedLinkSeed,
  type TrackedLinkTargetKind,
  type TrackedLinkWithPerformance,
} from "@/core/entities/tracked-link";
import type { TrackedLinkRepository } from "@/core/use-cases/TrackedLinkRepository";

interface TrackedLinkRow {
  id: string;
  code: string;
  owner_user_id: string;
  target_kind: string;
  target_id: string;
  destination_url: string;
  label: string;
  purpose: string;
  status: string;
  created_from_conversation_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

interface TrackedLinkEventRow {
  id: string;
  tracked_link_id: string;
  event_type: string;
  anonymous_visit_id: string | null;
  session_id: string | null;
  conversation_id: string | null;
  user_id: string | null;
  referral_id: string | null;
  offer_id: string | null;
  idempotency_key: string | null;
  metadata_json: string;
  created_at: string;
}

interface PerformanceRow {
  tracked_link_id: string;
  visits: number;
  chats: number;
  signups: number;
  offer_views: number;
  offer_choices: number;
  simulated_purchases: number;
  conversions: number;
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

function mapLinkRow(row: TrackedLinkRow): TrackedLink {
  return {
    id: row.id,
    code: row.code,
    ownerUserId: row.owner_user_id,
    targetKind: isTrackedLinkTargetKind(row.target_kind) ? row.target_kind : "url",
    targetId: row.target_id,
    destinationUrl: row.destination_url,
    label: row.label,
    purpose: row.purpose,
    status: isTrackedLinkStatus(row.status) ? row.status : "archived",
    createdFromConversationId: row.created_from_conversation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function mapEventRow(row: TrackedLinkEventRow): TrackedLinkEvent {
  return {
    id: row.id,
    trackedLinkId: row.tracked_link_id,
    eventType: isTrackedLinkEventType(row.event_type) ? row.event_type : "visit",
    anonymousVisitId: row.anonymous_visit_id,
    sessionId: row.session_id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    referralId: row.referral_id,
    offerId: row.offer_id,
    idempotencyKey: row.idempotency_key,
    metadata: parseJsonObject(row.metadata_json),
    createdAt: row.created_at,
  };
}

function emptyPerformance() {
  return {
    visits: 0,
    chats: 0,
    signups: 0,
    offerViews: 0,
    offerChoices: 0,
    simulatedPurchases: 0,
    conversions: 0,
  };
}

function performanceFromRow(row: PerformanceRow | undefined) {
  if (!row) {
    return emptyPerformance();
  }

  return {
    visits: row.visits,
    chats: row.chats,
    signups: row.signups,
    offerViews: row.offer_views,
    offerChoices: row.offer_choices,
    simulatedPurchases: row.simulated_purchases,
    conversions: row.conversions,
  };
}

export class TrackedLinkDataMapper implements TrackedLinkRepository {
  constructor(private readonly db: Database.Database) {}

  async create(seed: TrackedLinkSeed): Promise<TrackedLink> {
    const id = `tl_${randomUUID()}`;
    const now = new Date().toISOString();

    this.db.prepare(
      `INSERT INTO tracked_links (
         id, code, owner_user_id, target_kind, target_id, destination_url,
         label, purpose, status, created_from_conversation_id, created_at,
         updated_at, archived_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    ).run(
      id,
      seed.code,
      seed.ownerUserId,
      seed.targetKind,
      seed.targetId,
      seed.destinationUrl,
      seed.label,
      seed.purpose,
      seed.status ?? "active",
      seed.createdFromConversationId ?? null,
      now,
      now,
    );

    const created = await this.findById(id);
    if (!created) {
      throw new Error("Failed to read created tracked link.");
    }

    return created;
  }

  async findById(id: string): Promise<TrackedLink | null> {
    const row = this.db.prepare(`SELECT * FROM tracked_links WHERE id = ?`).get(id) as TrackedLinkRow | undefined;
    return row ? mapLinkRow(row) : null;
  }

  async findByCode(code: string): Promise<TrackedLink | null> {
    const row = this.db.prepare(`SELECT * FROM tracked_links WHERE code = ?`).get(code) as TrackedLinkRow | undefined;
    return row ? mapLinkRow(row) : null;
  }

  async listByOwnerUserId(ownerUserId: string): Promise<TrackedLink[]> {
    const rows = this.db.prepare(
      `SELECT * FROM tracked_links
       WHERE owner_user_id = ?
       ORDER BY updated_at DESC, created_at DESC`,
    ).all(ownerUserId) as TrackedLinkRow[];

    return rows.map(mapLinkRow);
  }

  async listByTarget(input: {
    ownerUserId: string;
    targetKind: TrackedLinkTargetKind;
    targetId: string;
  }): Promise<TrackedLink[]> {
    const rows = this.db.prepare(
      `SELECT * FROM tracked_links
       WHERE owner_user_id = ?
         AND target_kind = ?
         AND target_id = ?
       ORDER BY updated_at DESC, created_at DESC`,
    ).all(input.ownerUserId, input.targetKind, input.targetId) as TrackedLinkRow[];

    return rows.map(mapLinkRow);
  }

  async listWithPerformanceByOwnerUserId(ownerUserId: string): Promise<TrackedLinkWithPerformance[]> {
    const links = await this.listByOwnerUserId(ownerUserId);
    if (links.length === 0) {
      return [];
    }

    const placeholders = links.map(() => "?").join(", ");
    const rows = this.db.prepare(
      `SELECT
         tracked_link_id,
         SUM(CASE WHEN event_type IN ('scan', 'visit') THEN 1 ELSE 0 END) AS visits,
         SUM(CASE WHEN event_type = 'chat_started' THEN 1 ELSE 0 END) AS chats,
         SUM(CASE WHEN event_type = 'signup' THEN 1 ELSE 0 END) AS signups,
         SUM(CASE WHEN event_type = 'offer_viewed' THEN 1 ELSE 0 END) AS offer_views,
         SUM(CASE WHEN event_type = 'offer_chosen' THEN 1 ELSE 0 END) AS offer_choices,
         SUM(CASE WHEN event_type = 'purchase_simulated' THEN 1 ELSE 0 END) AS simulated_purchases,
         SUM(CASE WHEN event_type = 'conversion' THEN 1 ELSE 0 END) AS conversions
       FROM tracked_link_events
       WHERE tracked_link_id IN (${placeholders})
       GROUP BY tracked_link_id`,
    ).all(...links.map((link) => link.id)) as PerformanceRow[];
    const byLinkId = new Map(rows.map((row) => [row.tracked_link_id, row]));

    return links.map((link) => ({
      link,
      performance: performanceFromRow(byLinkId.get(link.id)),
    }));
  }

  async update(id: string, patch: TrackedLinkPatch): Promise<TrackedLink | null> {
    const current = await this.findById(id);
    if (!current) {
      return null;
    }

    const now = new Date().toISOString();
    this.db.prepare(
      `UPDATE tracked_links
       SET destination_url = ?,
           label = ?,
           purpose = ?,
           status = ?,
           archived_at = ?,
           updated_at = ?
       WHERE id = ?`,
    ).run(
      patch.destinationUrl ?? current.destinationUrl,
      patch.label ?? current.label,
      patch.purpose ?? current.purpose,
      patch.status ?? current.status,
      Object.prototype.hasOwnProperty.call(patch, "archivedAt") ? patch.archivedAt ?? null : current.archivedAt,
      now,
      id,
    );

    return this.findById(id);
  }

  async appendEvent(seed: TrackedLinkEventSeed): Promise<TrackedLinkEventAppendResult> {
    const id = `tle_${randomUUID()}`;
    const result = this.db.prepare(
      `INSERT OR IGNORE INTO tracked_link_events (
         id, tracked_link_id, event_type, anonymous_visit_id, session_id,
         conversation_id, user_id, referral_id, offer_id, idempotency_key,
         metadata_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      seed.trackedLinkId,
      seed.eventType,
      seed.anonymousVisitId ?? null,
      seed.sessionId ?? null,
      seed.conversationId ?? null,
      seed.userId ?? null,
      seed.referralId ?? null,
      seed.offerId ?? null,
      seed.idempotencyKey ?? null,
      JSON.stringify(seed.metadata ?? {}),
    );

    const row = seed.idempotencyKey
      ? this.db.prepare(
          `SELECT * FROM tracked_link_events
           WHERE tracked_link_id = ? AND idempotency_key = ?
           LIMIT 1`,
        ).get(seed.trackedLinkId, seed.idempotencyKey) as TrackedLinkEventRow | undefined
      : this.db.prepare(`SELECT * FROM tracked_link_events WHERE id = ?`).get(id) as TrackedLinkEventRow | undefined;

    if (!row) {
      throw new Error("Failed to read tracked link event.");
    }

    return {
      ...mapEventRow(row),
      wasInserted: result.changes > 0,
    };
  }

  async listEventsByTrackedLinkId(trackedLinkId: string): Promise<TrackedLinkEvent[]> {
    const rows = this.db.prepare(
      `SELECT * FROM tracked_link_events
       WHERE tracked_link_id = ?
       ORDER BY created_at ASC`,
    ).all(trackedLinkId) as TrackedLinkEventRow[];

    return rows.map(mapEventRow);
  }

  async listEventsByConversationIds(conversationIds: readonly string[]): Promise<TrackedLinkEvent[]> {
    const ids = Array.from(new Set(conversationIds.map((id) => id.trim()).filter(Boolean)));
    if (ids.length === 0) {
      return [];
    }

    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.db.prepare(
      `SELECT * FROM tracked_link_events
       WHERE conversation_id IN (${placeholders})
       ORDER BY created_at ASC`,
    ).all(...ids) as TrackedLinkEventRow[];

    return rows.map(mapEventRow);
  }
}
