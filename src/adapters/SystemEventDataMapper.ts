import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  isSystemEventVisibility,
  type CreateSystemEventInput,
  type SystemEvent,
  type SystemEventObjectRef,
  type SystemEventSourceRef,
  type SystemEventViewer,
  type SystemEventVisibility,
} from "@/core/entities/system-event";

interface SystemEventRow {
  sequence: number;
  id: string;
  event_type: string;
  occurred_at: string;
  actor_user_id: string | null;
  owner_user_id: string | null;
  object_kind: string | null;
  object_id: string | null;
  object_label: string | null;
  section_ids_json: string;
  visibility: string;
  summary: string;
  source_refs_json: string;
  payload_json: string;
  created_at: string;
}

export interface ListSystemEventsInput {
  viewer?: SystemEventViewer | null;
  afterSequence?: number;
  sectionId?: string | null;
  objectRef?: Pick<SystemEventObjectRef, "kind" | "id"> | null;
  limit?: number;
}

export type FindLatestVisibleSystemEventInput = Omit<ListSystemEventsInput, "afterSequence" | "limit">;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeLimit(limit: number | null | undefined): number {
  return typeof limit === "number" && Number.isSafeInteger(limit) && limit > 0
    ? Math.min(limit, 200)
    : 50;
}

function normalizeAfterSequence(sequence: number | null | undefined): number {
  return typeof sequence === "number" && Number.isSafeInteger(sequence) && sequence >= 0
    ? sequence
    : 0;
}

function nonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
}

function assertStringArray(value: readonly string[], label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must include at least one item.`);
  }
  return Array.from(new Set(value.map((entry) => nonEmpty(entry, label))));
}

function assertSourceRefs(value: readonly SystemEventSourceRef[]): SystemEventSourceRef[] {
  return value.map((ref, index) => ({
    sourceKind: nonEmpty(ref.sourceKind, `sourceRefs[${index}].sourceKind`),
    sourceId: nonEmpty(ref.sourceId, `sourceRefs[${index}].sourceId`),
    ...(ref.label?.trim() ? { label: ref.label.trim() } : {}),
    ...(ref.href?.trim() ? { href: ref.href.trim() } : {}),
  }));
}

function normalizeObjectRef(value: SystemEventObjectRef | null | undefined): SystemEventObjectRef | null {
  if (!value) return null;
  return {
    kind: nonEmpty(value.kind, "objectRef.kind"),
    id: nonEmpty(value.id, "objectRef.id"),
    ...(value.label?.trim() ? { label: value.label.trim() } : {}),
  };
}

function isAdminViewer(viewer: SystemEventViewer | null | undefined): boolean {
  const role = viewer?.role?.toUpperCase();
  return role === "ADMIN" || role === "SYSTEM";
}

function mapRow(row: SystemEventRow): SystemEvent {
  const visibility: SystemEventVisibility = isSystemEventVisibility(row.visibility)
    ? row.visibility
    : "admin";
  const objectRef = row.object_kind && row.object_id
    ? {
      kind: row.object_kind,
      id: row.object_id,
      ...(row.object_label ? { label: row.object_label } : {}),
    }
    : null;

  return {
    id: row.id,
    sequence: row.sequence,
    type: row.event_type,
    occurredAt: row.occurred_at,
    actorUserId: row.actor_user_id,
    ownerUserId: row.owner_user_id,
    objectRef,
    sectionIds: parseJson<string[]>(row.section_ids_json, []),
    visibility,
    summary: row.summary,
    sourceRefs: parseJson<SystemEventSourceRef[]>(row.source_refs_json, []),
    payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
    createdAt: row.created_at,
  };
}

export class SystemEventDataMapper {
  constructor(private readonly db: Database.Database) {}

  async append(input: CreateSystemEventInput, now = new Date().toISOString()): Promise<SystemEvent> {
    const visibility = input.visibility;
    if (!isSystemEventVisibility(visibility)) {
      throw new Error(`System event visibility is invalid: ${String(visibility)}`);
    }
    if (visibility === "owner" && !input.ownerUserId?.trim()) {
      throw new Error("ownerUserId is required for owner-visible system events.");
    }

    const objectRef = normalizeObjectRef(input.objectRef);
    const sectionIds = assertStringArray(input.sectionIds, "sectionIds");
    const sourceRefs = assertSourceRefs(input.sourceRefs ?? []);
    const id = input.id?.trim() || `sysevt_${randomUUID()}`;

    this.db.prepare(
      `INSERT INTO system_events (
         id, event_type, occurred_at, actor_user_id, owner_user_id,
         object_kind, object_id, object_label, section_ids_json, visibility,
         summary, source_refs_json, payload_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      nonEmpty(input.type, "type"),
      input.occurredAt ?? now,
      input.actorUserId?.trim() || null,
      input.ownerUserId?.trim() || null,
      objectRef?.kind ?? null,
      objectRef?.id ?? null,
      objectRef?.label ?? null,
      JSON.stringify(sectionIds),
      visibility,
      nonEmpty(input.summary, "summary"),
      JSON.stringify(sourceRefs),
      JSON.stringify(input.payload ?? {}),
      now,
    );

    const event = await this.findById(id);
    if (!event) {
      throw new Error("Failed to read created system event.");
    }
    return event;
  }

  async findById(id: string): Promise<SystemEvent | null> {
    const row = this.db.prepare(
      `SELECT * FROM system_events WHERE id = ?`,
    ).get(id) as SystemEventRow | undefined;
    return row ? mapRow(row) : null;
  }

  async listVisible(input: ListSystemEventsInput = {}): Promise<SystemEvent[]> {
    const clauses = ["sequence > ?"];
    const params: unknown[] = [normalizeAfterSequence(input.afterSequence)];
    const viewer = input.viewer ?? null;

    if (!isAdminViewer(viewer)) {
      if (viewer?.userId) {
        clauses.push("(visibility = 'public' OR (visibility = 'owner' AND owner_user_id = ?))");
        params.push(viewer.userId);
      } else {
        clauses.push("visibility = 'public'");
      }
    }

    if (input.sectionId?.trim()) {
      clauses.push("EXISTS (SELECT 1 FROM json_each(system_events.section_ids_json) WHERE value = ?)");
      params.push(input.sectionId.trim());
    }

    if (input.objectRef) {
      clauses.push("object_kind = ? AND object_id = ?");
      params.push(input.objectRef.kind, input.objectRef.id);
    }

    const rows = this.db.prepare(
      `SELECT *
       FROM system_events
       WHERE ${clauses.join(" AND ")}
       ORDER BY sequence ASC
       LIMIT ?`,
    ).all(...params, normalizeLimit(input.limit)) as SystemEventRow[];

    return rows.map(mapRow);
  }

  async findLatestVisible(input: FindLatestVisibleSystemEventInput = {}): Promise<SystemEvent | null> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const viewer = input.viewer ?? null;

    if (!isAdminViewer(viewer)) {
      if (viewer?.userId) {
        clauses.push("(visibility = 'public' OR (visibility = 'owner' AND owner_user_id = ?))");
        params.push(viewer.userId);
      } else {
        clauses.push("visibility = 'public'");
      }
    }

    if (input.sectionId?.trim()) {
      clauses.push("EXISTS (SELECT 1 FROM json_each(system_events.section_ids_json) WHERE value = ?)");
      params.push(input.sectionId.trim());
    }

    if (input.objectRef) {
      clauses.push("object_kind = ? AND object_id = ?");
      params.push(input.objectRef.kind, input.objectRef.id);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const row = this.db.prepare(
      `SELECT *
       FROM system_events
       ${where}
       ORDER BY sequence DESC
       LIMIT 1`,
    ).get(...params) as SystemEventRow | undefined;

    return row ? mapRow(row) : null;
  }
}
