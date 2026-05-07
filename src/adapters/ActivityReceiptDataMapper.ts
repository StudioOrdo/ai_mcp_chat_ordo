import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  isActivitySourceKind,
  type ActivitySourceKind,
} from "@/lib/activity/activity-taxonomy";
import type {
  ActivityReceiptPatch,
  ActivityReceiptRecord,
  ActivityReceiptRepository,
  ActivitySourceRef,
} from "@/lib/activity/activity-types";

type ActivityReceiptRow = {
  id: string;
  user_id: string;
  source_kind: ActivitySourceKind;
  source_id: string;
  read_at: string | null;
  acknowledged_at: string | null;
  dismissed_at: string | null;
  pinned_at: string | null;
  updated_at: string;
};

function mapReceipt(row: ActivityReceiptRow): ActivityReceiptRecord {
  return {
    id: row.id,
    userId: row.user_id,
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    readAt: row.read_at,
    acknowledgedAt: row.acknowledged_at,
    dismissedAt: row.dismissed_at,
    pinnedAt: row.pinned_at,
    updatedAt: row.updated_at,
  };
}

function assertSourceKind(sourceKind: string): asserts sourceKind is ActivitySourceKind {
  if (!isActivitySourceKind(sourceKind)) {
    throw new Error(`Unknown activity source kind: ${sourceKind}`);
  }
}

function assertSource(source: ActivitySourceRef): void {
  assertSourceKind(source.sourceKind);
  if (!source.sourceId.trim()) {
    throw new Error("Activity source id is required.");
  }
}

export class ActivityReceiptDataMapper implements ActivityReceiptRepository {
  constructor(private readonly db: Database.Database) {}

  async findByUserAndSource(
    userId: string,
    source: ActivitySourceRef,
  ): Promise<ActivityReceiptRecord | null> {
    assertSource(source);
    const row = this.db.prepare(
      `SELECT *
       FROM activity_receipts
       WHERE user_id = ?
         AND source_kind = ?
         AND source_id = ?`,
    ).get(userId, source.sourceKind, source.sourceId) as ActivityReceiptRow | undefined;

    return row ? mapReceipt(row) : null;
  }

  async listByUserAndSources(
    userId: string,
    sources: readonly ActivitySourceRef[],
  ): Promise<ActivityReceiptRecord[]> {
    if (sources.length === 0) {
      return [];
    }

    const uniqueSources = Array.from(new Map(sources.map((source) => {
      assertSource(source);
      return [`${source.sourceKind}:${source.sourceId}`, source] as const;
    })).values());
    const clauses = uniqueSources.map(() => "(source_kind = ? AND source_id = ?)");
    const params = uniqueSources.flatMap((source) => [source.sourceKind, source.sourceId]);
    const rows = this.db.prepare(
      `SELECT *
       FROM activity_receipts
       WHERE user_id = ?
         AND (${clauses.join(" OR ")})`,
    ).all(userId, ...params) as ActivityReceiptRow[];

    return rows.map(mapReceipt);
  }

  async upsert(
    userId: string,
    source: ActivitySourceRef,
    patch: ActivityReceiptPatch,
    now = new Date().toISOString(),
  ): Promise<ActivityReceiptRecord> {
    assertSource(source);
    const existing = await this.findByUserAndSource(userId, source);
    const next = {
      readAt: Object.prototype.hasOwnProperty.call(patch, "readAt") ? patch.readAt ?? null : existing?.readAt ?? null,
      acknowledgedAt: Object.prototype.hasOwnProperty.call(patch, "acknowledgedAt") ? patch.acknowledgedAt ?? null : existing?.acknowledgedAt ?? null,
      dismissedAt: Object.prototype.hasOwnProperty.call(patch, "dismissedAt") ? patch.dismissedAt ?? null : existing?.dismissedAt ?? null,
      pinnedAt: Object.prototype.hasOwnProperty.call(patch, "pinnedAt") ? patch.pinnedAt ?? null : existing?.pinnedAt ?? null,
    };
    const id = existing?.id ?? `actrec_${randomUUID()}`;

    this.db.prepare(
      `INSERT INTO activity_receipts (
         id, user_id, source_kind, source_id, read_at, acknowledged_at,
         dismissed_at, pinned_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, source_kind, source_id) DO UPDATE SET
         read_at = excluded.read_at,
         acknowledged_at = excluded.acknowledged_at,
         dismissed_at = excluded.dismissed_at,
         pinned_at = excluded.pinned_at,
         updated_at = excluded.updated_at`,
    ).run(
      id,
      userId,
      source.sourceKind,
      source.sourceId,
      next.readAt,
      next.acknowledgedAt,
      next.dismissedAt,
      next.pinnedAt,
      now,
    );

    const receipt = await this.findByUserAndSource(userId, source);
    if (!receipt) {
      throw new Error("Failed to read updated activity receipt.");
    }

    return receipt;
  }
}
