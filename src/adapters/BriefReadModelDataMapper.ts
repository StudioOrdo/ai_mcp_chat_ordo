import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  assertValidBriefEvidenceManifest,
  assertValidSectionBrief,
  briefSourceRefId,
  isBriefStatus,
  isBriefVisibilityPolicy,
  type BriefAction,
  type BriefEventType,
  type BriefEvidenceManifest,
  type BriefEvidenceRef,
  type BriefObjectRef,
  type BriefReadModelEvent,
  type BriefStatus,
  type BriefVisibilityPolicy,
  type SectionBrief,
  type StoredSectionBrief,
} from "@/core/entities/brief";

interface BriefReadModelRow {
  id: string;
  scope_key: string;
  section_id: string;
  object_kind: string | null;
  object_id: string | null;
  object_label: string | null;
  owner_user_id: string | null;
  visibility_policy: string;
  status: string;
  version: number;
  prior_brief_id: string | null;
  as_of: string;
  generated_at: string;
  generated_by: string;
  title: string;
  summary: string;
  bullets_json: string;
  recommended_action_json: string | null;
  evidence_refs_json: string;
  limitations_json: string;
  manifest_json: string;
  is_current: number;
  created_at: string;
  updated_at: string;
}

interface BriefEventRow {
  id: string;
  brief_id: string;
  section_id: string;
  object_kind: string | null;
  object_id: string | null;
  object_label: string | null;
  owner_user_id: string | null;
  event_type: BriefEventType;
  payload_json: string;
  created_at: string;
}

export interface BriefReadModelScopeInput {
  sectionId: string;
  ownerUserId?: string | null;
  visibilityPolicy: BriefVisibilityPolicy;
  objectRef?: BriefObjectRef | null;
}

export interface SaveSectionBriefInput {
  brief: SectionBrief;
  manifest: BriefEvidenceManifest;
  ownerUserId?: string | null;
  visibilityPolicy: BriefVisibilityPolicy;
  now?: string;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function scopeKey(scope: BriefReadModelScopeInput): string {
  const owner = scope.ownerUserId ?? "global";
  const objectKind = scope.objectRef?.kind ?? "section";
  const objectId = scope.objectRef?.id ?? "section";
  return `${scope.visibilityPolicy}:${owner}:${scope.sectionId}:${objectKind}:${objectId}`;
}

function objectRefFromRow(row: BriefReadModelRow | BriefEventRow): BriefObjectRef | undefined {
  if (!row.object_kind || !row.object_id || !row.object_label) {
    return undefined;
  }
  return {
    kind: row.object_kind,
    id: row.object_id,
    label: row.object_label,
  };
}

function mapBriefRow(row: BriefReadModelRow): StoredSectionBrief {
  const status: BriefStatus = isBriefStatus(row.status) ? row.status : "limited";
  const visibilityPolicy: BriefVisibilityPolicy = isBriefVisibilityPolicy(row.visibility_policy)
    ? row.visibility_policy
    : "owner";
  return {
    id: row.id,
    sectionId: row.section_id,
    ...(objectRefFromRow(row) ? { objectRef: objectRefFromRow(row) } : {}),
    asOf: row.as_of,
    status,
    title: row.title,
    summary: row.summary,
    bullets: parseJson<string[]>(row.bullets_json, []),
    recommendedAction: parseJson<BriefAction | null>(row.recommended_action_json, null),
    evidenceRefs: parseJson<BriefEvidenceRef[]>(row.evidence_refs_json, []),
    limitations: parseJson<string[]>(row.limitations_json, []),
    version: row.version,
    priorBriefId: row.prior_brief_id ?? undefined,
    ownerUserId: row.owner_user_id,
    visibilityPolicy,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
    manifest: parseJson<BriefEvidenceManifest>(row.manifest_json, {
      schemaVersion: "1",
      briefId: row.id,
      briefVersion: row.version,
      generatedAt: row.generated_at,
      generatedBy: row.generated_by,
      ownerUserId: row.owner_user_id,
      sectionId: row.section_id,
      visibilityPolicy,
      includedSourceRefs: [],
      excludedSourceRefs: [],
      claims: [],
      limitations: [],
      executorMetadata: null,
      warnings: [],
    }),
    isCurrent: row.is_current === 1,
  };
}

function mapEventRow(row: BriefEventRow): BriefReadModelEvent {
  return {
    id: row.id,
    briefId: row.brief_id,
    sectionId: row.section_id,
    ...(objectRefFromRow(row) ? { objectRef: objectRefFromRow(row) } : {}),
    ownerUserId: row.owner_user_id,
    eventType: row.event_type,
    payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
    createdAt: row.created_at,
  };
}

function assertManifestMatchesBrief(
  brief: SectionBrief,
  manifest: BriefEvidenceManifest,
  ownerUserId: string | null,
  visibilityPolicy: BriefVisibilityPolicy,
): void {
  if (manifest.briefId !== brief.id) {
    throw new Error("Brief manifest must reference the saved brief id.");
  }
  if (manifest.briefVersion !== brief.version) {
    throw new Error("Brief manifest version must match the saved brief version.");
  }
  if (manifest.sectionId !== brief.sectionId) {
    throw new Error("Brief manifest section must match the saved brief section.");
  }
  if (manifest.ownerUserId !== ownerUserId) {
    throw new Error("Brief manifest owner scope must match the saved brief owner scope.");
  }
  if (manifest.visibilityPolicy !== visibilityPolicy) {
    throw new Error("Brief manifest visibility policy must match the saved brief visibility policy.");
  }
}

function briefEventType(brief: SectionBrief, current: StoredSectionBrief | null, willBecomeCurrent: boolean): BriefEventType {
  if (brief.status === "failed") {
    return "brief_update_failed";
  }
  if (brief.status === "stale" && !willBecomeCurrent) {
    return "brief_update_stale";
  }
  return current ? "brief_updated" : "brief_created";
}

export class BriefReadModelDataMapper {
  constructor(private readonly db: Database.Database) {}

  async saveSectionBrief(input: SaveSectionBriefInput): Promise<StoredSectionBrief> {
    const ownerUserId = input.ownerUserId ?? null;
    const brief: SectionBrief = {
      ...input.brief,
      asOf: input.brief.asOf ?? input.manifest.generatedAt,
    };
    const visibilityPolicy = input.visibilityPolicy;
    assertValidSectionBrief(brief, { visibilityPolicy, requireDurableFields: true });
    assertValidBriefEvidenceManifest(input.manifest);
    assertManifestMatchesBrief(brief, input.manifest, ownerUserId, visibilityPolicy);

    const current = await this.findCurrentByScope({
      sectionId: brief.sectionId,
      ownerUserId,
      visibilityPolicy,
      objectRef: brief.objectRef ?? null,
    });
    const keepPriorCurrent = (brief.status === "failed" || brief.status === "stale") && current !== null;
    const willBecomeCurrent = !keepPriorCurrent;
    const nextScopeKey = scopeKey({
      sectionId: brief.sectionId,
      ownerUserId,
      visibilityPolicy,
      objectRef: brief.objectRef ?? null,
    });
    const now = input.now ?? new Date().toISOString();

    const transaction = this.db.transaction(() => {
      if (willBecomeCurrent) {
        this.db.prepare(
          `UPDATE brief_read_models
           SET is_current = 0, updated_at = ?
           WHERE scope_key = ? AND is_current = 1`,
        ).run(now, nextScopeKey);
      }

      this.db.prepare(
        `INSERT INTO brief_read_models (
           id, scope_key, section_id, object_kind, object_id, object_label,
           owner_user_id, visibility_policy, status, version, prior_brief_id,
           as_of, generated_at, generated_by, title, summary, bullets_json,
           recommended_action_json, evidence_refs_json, limitations_json,
           manifest_json, is_current, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           scope_key = excluded.scope_key,
           section_id = excluded.section_id,
           object_kind = excluded.object_kind,
           object_id = excluded.object_id,
           object_label = excluded.object_label,
           owner_user_id = excluded.owner_user_id,
           visibility_policy = excluded.visibility_policy,
           status = excluded.status,
           version = excluded.version,
           prior_brief_id = excluded.prior_brief_id,
           as_of = excluded.as_of,
           generated_at = excluded.generated_at,
           generated_by = excluded.generated_by,
           title = excluded.title,
           summary = excluded.summary,
           bullets_json = excluded.bullets_json,
           recommended_action_json = excluded.recommended_action_json,
           evidence_refs_json = excluded.evidence_refs_json,
           limitations_json = excluded.limitations_json,
           manifest_json = excluded.manifest_json,
           is_current = excluded.is_current,
           updated_at = excluded.updated_at`,
      ).run(
        brief.id,
        nextScopeKey,
        brief.sectionId,
        brief.objectRef?.kind ?? null,
        brief.objectRef?.id ?? null,
        brief.objectRef?.label ?? null,
        ownerUserId,
        visibilityPolicy,
        brief.status,
        brief.version,
        brief.priorBriefId ?? null,
        brief.asOf,
        input.manifest.generatedAt,
        input.manifest.generatedBy,
        brief.title,
        brief.summary,
        JSON.stringify(brief.bullets),
        brief.recommendedAction ? JSON.stringify(brief.recommendedAction) : null,
        JSON.stringify(brief.evidenceRefs),
        JSON.stringify(brief.limitations),
        JSON.stringify(input.manifest),
        willBecomeCurrent ? 1 : 0,
        now,
        now,
      );

      if (current && willBecomeCurrent) {
        this.insertEvent({
          brief: current,
          eventType: "brief_superseded",
          now,
          payload: {
            supersededByBriefId: brief.id,
            priorVersion: current.version,
            nextVersion: brief.version,
          },
        });
      }

      this.insertEvent({
        brief: {
          id: brief.id,
          sectionId: brief.sectionId,
          ...(brief.objectRef ? { objectRef: brief.objectRef } : {}),
          ownerUserId,
        },
        eventType: briefEventType(brief, current, willBecomeCurrent),
        now,
        payload: {
          priorBriefId: current?.id ?? brief.priorBriefId ?? null,
          version: brief.version,
          status: brief.status,
          evidenceRefCount: brief.evidenceRefs.length,
          claimCount: input.manifest.claims.length,
          includedSourceRefIds: input.manifest.includedSourceRefs.map(briefSourceRefId),
          excludedSourceRefCount: input.manifest.excludedSourceRefs.length,
          keptPriorCurrent: keepPriorCurrent,
        },
      });
    });

    transaction();

    const saved = await this.findById(brief.id);
    if (!saved) {
      throw new Error(`Failed to read saved brief ${brief.id}.`);
    }
    return saved;
  }

  async findById(id: string): Promise<StoredSectionBrief | null> {
    const row = this.db.prepare(
      `SELECT * FROM brief_read_models WHERE id = ?`,
    ).get(id) as BriefReadModelRow | undefined;
    return row ? mapBriefRow(row) : null;
  }

  async findCurrentSectionBrief(
    sectionId: string,
    input: {
      ownerUserId?: string | null;
      visibilityPolicy?: BriefVisibilityPolicy;
    } = {},
  ): Promise<StoredSectionBrief | null> {
    return this.findCurrentByScope({
      sectionId,
      ownerUserId: input.ownerUserId ?? null,
      visibilityPolicy: input.visibilityPolicy ?? "owner",
      objectRef: null,
    });
  }

  async findCurrentForScope(input: BriefReadModelScopeInput): Promise<StoredSectionBrief | null> {
    return this.findCurrentByScope(input);
  }

  async listHistoryForScope(input: BriefReadModelScopeInput, limit = 20): Promise<StoredSectionBrief[]> {
    const rows = this.db.prepare(
      `SELECT * FROM brief_read_models
       WHERE scope_key = ?
       ORDER BY version DESC, updated_at DESC, id DESC
       LIMIT ?`,
    ).all(scopeKey(input), normalizeLimit(limit)) as BriefReadModelRow[];
    return rows.map(mapBriefRow);
  }

  async listEventsForBrief(briefId: string): Promise<BriefReadModelEvent[]> {
    const rows = this.db.prepare(
      `SELECT * FROM brief_events
       WHERE brief_id = ?
       ORDER BY created_at ASC, id ASC`,
    ).all(briefId) as BriefEventRow[];
    return rows.map(mapEventRow);
  }

  private async findCurrentByScope(input: BriefReadModelScopeInput): Promise<StoredSectionBrief | null> {
    const row = this.db.prepare(
      `SELECT * FROM brief_read_models
       WHERE scope_key = ? AND is_current = 1
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`,
    ).get(scopeKey(input)) as BriefReadModelRow | undefined;
    return row ? mapBriefRow(row) : null;
  }

  private insertEvent(input: {
    brief: Pick<StoredSectionBrief, "id" | "sectionId" | "objectRef" | "ownerUserId">;
    eventType: BriefEventType;
    now: string;
    payload: Record<string, unknown>;
  }): void {
    this.db.prepare(
      `INSERT INTO brief_events (
         id, brief_id, section_id, object_kind, object_id, object_label,
         owner_user_id, event_type, payload_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `brief_evt_${randomUUID()}`,
      input.brief.id,
      input.brief.sectionId,
      input.brief.objectRef?.kind ?? null,
      input.brief.objectRef?.id ?? null,
      input.brief.objectRef?.label ?? null,
      input.brief.ownerUserId,
      input.eventType,
      JSON.stringify(input.payload),
      input.now,
    );
  }
}

function normalizeLimit(limit: number): number {
  return Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;
}
