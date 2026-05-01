import type Database from "better-sqlite3";

import type { CanonicalEvidenceRef } from "@/core/entities/conversation-continuity";
import type {
  RelationshipMemoryRecord,
  RelationshipMemoryStatus,
  RelationshipMemoryType,
} from "@/core/entities/relationship-memory";
import type { RelationshipMemoryRepository } from "@/core/use-cases/RelationshipMemoryRepository";

interface RelationshipMemoryRow {
  id: string;
  user_id: string;
  conversation_id: string;
  memory_type: RelationshipMemoryType;
  summary: string;
  evidence_refs_json: string;
  status: RelationshipMemoryStatus;
  confidence: number;
  created_at: string;
  updated_at: string;
}

function parseEvidenceRefs(value: string): readonly CanonicalEvidenceRef[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as CanonicalEvidenceRef[]) : [];
  } catch {
    return [];
  }
}

function mapRow(row: RelationshipMemoryRow): RelationshipMemoryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    memoryType: row.memory_type,
    summary: row.summary,
    evidenceRefs: parseEvidenceRefs(row.evidence_refs_json),
    status: row.status,
    confidence: row.confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class RelationshipMemoryDataMapper implements RelationshipMemoryRepository {
  constructor(private readonly db: Database.Database) {}

  async findById(id: string): Promise<RelationshipMemoryRecord | null> {
    const row = this.db
      .prepare(`SELECT * FROM relationship_memory_records WHERE id = ?`)
      .get(id) as RelationshipMemoryRow | undefined;

    return row ? mapRow(row) : null;
  }

  async listActiveByConversation(conversationId: string): Promise<RelationshipMemoryRecord[]> {
    const rows = this.db.prepare(
      `SELECT * FROM relationship_memory_records
       WHERE conversation_id = ?
         AND status = 'active'
       ORDER BY updated_at DESC, created_at DESC`,
    ).all(conversationId) as RelationshipMemoryRow[];

    return rows.map(mapRow);
  }

  async listActiveByUser(userId: string, options?: { limit?: number }): Promise<RelationshipMemoryRecord[]> {
    const limit = options?.limit ?? 50;
    const rows = this.db.prepare(
      `SELECT * FROM relationship_memory_records
       WHERE user_id = ?
         AND status = 'active'
       ORDER BY updated_at DESC, created_at DESC
       LIMIT ?`,
    ).all(userId, limit) as RelationshipMemoryRow[];

    return rows.map(mapRow);
  }

  async upsert(record: RelationshipMemoryRecord): Promise<RelationshipMemoryRecord> {
    this.db.prepare(
      `INSERT INTO relationship_memory_records (
        id,
        user_id,
        conversation_id,
        memory_type,
        summary,
        evidence_refs_json,
        status,
        confidence,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        conversation_id = excluded.conversation_id,
        memory_type = excluded.memory_type,
        summary = excluded.summary,
        evidence_refs_json = excluded.evidence_refs_json,
        status = excluded.status,
        confidence = excluded.confidence,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
    ).run(
      record.id,
      record.userId,
      record.conversationId,
      record.memoryType,
      record.summary,
      JSON.stringify(record.evidenceRefs),
      record.status,
      record.confidence,
      record.createdAt,
      record.updatedAt,
    );

    return (await this.findById(record.id)) as RelationshipMemoryRecord;
  }

  async markSuperseded(id: string, supersededById: string, updatedAt: string): Promise<RelationshipMemoryRecord | null> {
    this.db.prepare(
      `UPDATE relationship_memory_records
       SET status = 'superseded',
           superseded_by_id = ?,
           updated_at = ?
       WHERE id = ?`,
    ).run(supersededById, updatedAt, id);

    return this.findById(id);
  }

  async transferOwnershipForConversations(input: {
    conversationIds: readonly string[];
    previousUserId: string;
    userId: string;
    transferredAt?: string;
  }): Promise<RelationshipMemoryRecord[]> {
    const conversationIds = Array.from(new Set(input.conversationIds.map((id) => id.trim()).filter(Boolean)));
    if (conversationIds.length === 0) {
      return [];
    }

    const placeholders = conversationIds.map(() => "?").join(", ");
    const rows = this.db.prepare(
      `SELECT * FROM relationship_memory_records
       WHERE conversation_id IN (${placeholders})
         AND user_id IN (?, ?)
       ORDER BY updated_at ASC, id ASC`,
    ).all(...conversationIds, input.previousUserId, input.userId) as RelationshipMemoryRow[];

    this.db.prepare(
      `UPDATE relationship_memory_records
       SET user_id = ?,
           updated_at = ?
       WHERE conversation_id IN (${placeholders})
         AND user_id = ?`,
    ).run(input.userId, input.transferredAt ?? new Date().toISOString(), ...conversationIds, input.previousUserId);

    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => row.id);
    const idPlaceholders = ids.map(() => "?").join(", ");
    const transferredRows = this.db.prepare(
      `SELECT * FROM relationship_memory_records
       WHERE id IN (${idPlaceholders})
       ORDER BY updated_at ASC, id ASC`,
    ).all(...ids) as RelationshipMemoryRow[];

    return transferredRows.map(mapRow);
  }
}
