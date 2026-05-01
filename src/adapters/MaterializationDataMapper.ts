import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import type {
  CanonicalEvidenceRef,
  ContinuitySourceRef,
} from "@/core/entities/conversation-continuity";
import {
  isReusableMaterialization,
  type MaterializationRecord,
  type MaterializationReusePolicy,
  type MaterializationStatus,
} from "@/core/entities/materialization";
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";

interface MaterializationRow {
  id: string;
  user_id: string | null;
  conversation_id: string | null;
  materialization_key: string;
  tool_name: string;
  pipeline_version: string | null;
  status: MaterializationStatus;
  reuse_policy: MaterializationReusePolicy;
  input_source_refs_json: string;
  output_refs_json: string;
  evidence_refs_json: string;
  produced_by_job_id: string | null;
  superseded_by_record_id: string | null;
  created_at: string;
  updated_at: string;
}

function parseJsonArray<T>(value: string, fallback: readonly T[] = []): readonly T[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function mapRow(row: MaterializationRow): MaterializationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    materializationKey: row.materialization_key,
    toolName: row.tool_name,
    pipelineVersion: row.pipeline_version,
    status: row.status,
    reusePolicy: row.reuse_policy,
    inputSourceRefs: parseJsonArray<ContinuitySourceRef>(row.input_source_refs_json),
    outputRefs: parseJsonArray<MaterializationRecord["outputRefs"][number]>(row.output_refs_json),
    evidenceRefs: parseJsonArray<CanonicalEvidenceRef>(row.evidence_refs_json),
    producedByJobId: row.produced_by_job_id,
    supersededByRecordId: row.superseded_by_record_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeRecord(record: MaterializationRecord): Record<string, unknown> {
  return {
    id: record.id,
    user_id: record.userId,
    conversation_id: record.conversationId,
    materialization_key: record.materializationKey,
    tool_name: record.toolName,
    pipeline_version: record.pipelineVersion,
    status: record.status,
    reuse_policy: record.reusePolicy,
    input_source_refs_json: JSON.stringify(record.inputSourceRefs),
    output_refs_json: JSON.stringify(record.outputRefs),
    evidence_refs_json: JSON.stringify(record.evidenceRefs),
    produced_by_job_id: record.producedByJobId,
    superseded_by_record_id: record.supersededByRecordId,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function canReuseForScope(
  record: MaterializationRecord,
  userId: string | null,
  conversationId: string | null,
): boolean {
  if (!isReusableMaterialization(record)) {
    return false;
  }

  switch (record.reusePolicy) {
    case "never":
      return false;
    case "same_conversation":
      return Boolean(conversationId) && record.conversationId === conversationId;
    case "same_user":
      return Boolean(userId) && record.userId === userId;
    case "global_if_public":
      return true;
  }
}

export class MaterializationDataMapper implements MaterializationRepository {
  constructor(private readonly db: Database.Database) {}

  async findById(id: string): Promise<MaterializationRecord | null> {
    const row = this.db
      .prepare(`SELECT * FROM materialization_records WHERE id = ?`)
      .get(id) as MaterializationRow | undefined;

    return row ? mapRow(row) : null;
  }

  async findByMaterializationKey(materializationKey: string): Promise<MaterializationRecord | null> {
    const row = this.db.prepare(
      `SELECT * FROM materialization_records
       WHERE materialization_key = ?
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`,
    ).get(materializationKey) as MaterializationRow | undefined;

    return row ? mapRow(row) : null;
  }

  async findByProducedJobId(jobId: string): Promise<MaterializationRecord | null> {
    const row = this.db.prepare(
      `SELECT * FROM materialization_records
       WHERE produced_by_job_id = ?
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`,
    ).get(jobId) as MaterializationRow | undefined;

    return row ? mapRow(row) : null;
  }

  async listByConversation(conversationId: string): Promise<readonly MaterializationRecord[]> {
    const rows = this.db.prepare(
      `SELECT * FROM materialization_records
       WHERE conversation_id = ?
       ORDER BY updated_at DESC, created_at DESC`,
    ).all(conversationId) as MaterializationRow[];

    return rows.map(mapRow);
  }

  async findLatestByOutputRef(
    kind: MaterializationRecord["outputRefs"][number]["kind"],
    id: string,
  ): Promise<MaterializationRecord | null> {
    const row = this.db.prepare(
      `SELECT mr.*
       FROM materialization_records mr
       JOIN json_each(mr.output_refs_json) output_ref
         ON json_extract(output_ref.value, '$.kind') = ?
        AND json_extract(output_ref.value, '$.id') = ?
       ORDER BY mr.updated_at DESC, mr.created_at DESC
       LIMIT 1`,
    ).get(kind, id) as MaterializationRow | undefined;

    return row ? mapRow(row) : null;
  }

  async findReusableSuccess(
    materializationKey: string,
    userId: string | null,
    conversationId: string | null,
  ): Promise<MaterializationRecord | null> {
    const rows = this.db.prepare(
      `SELECT * FROM materialization_records
       WHERE materialization_key = ?
       ORDER BY updated_at DESC, created_at DESC`,
    ).all(materializationKey) as MaterializationRow[];

    for (const row of rows) {
      const record = mapRow(row);
      if (canReuseForScope(record, userId, conversationId)) {
        return record;
      }
    }

    return null;
  }

  async upsert(record: MaterializationRecord): Promise<MaterializationRecord> {
    const nextRecord: MaterializationRecord = {
      ...record,
      id: record.id || `mat_${randomUUID()}`,
    };
    const serialized = serializeRecord(nextRecord);

    this.db.prepare(
      `INSERT INTO materialization_records (
        id,
        user_id,
        conversation_id,
        materialization_key,
        tool_name,
        pipeline_version,
        status,
        reuse_policy,
        input_source_refs_json,
        output_refs_json,
        evidence_refs_json,
        produced_by_job_id,
        superseded_by_record_id,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @user_id,
        @conversation_id,
        @materialization_key,
        @tool_name,
        @pipeline_version,
        @status,
        @reuse_policy,
        @input_source_refs_json,
        @output_refs_json,
        @evidence_refs_json,
        @produced_by_job_id,
        @superseded_by_record_id,
        @created_at,
        @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        conversation_id = excluded.conversation_id,
        materialization_key = excluded.materialization_key,
        tool_name = excluded.tool_name,
        pipeline_version = excluded.pipeline_version,
        status = excluded.status,
        reuse_policy = excluded.reuse_policy,
        input_source_refs_json = excluded.input_source_refs_json,
        output_refs_json = excluded.output_refs_json,
        evidence_refs_json = excluded.evidence_refs_json,
        produced_by_job_id = excluded.produced_by_job_id,
        superseded_by_record_id = excluded.superseded_by_record_id,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
    ).run(serialized);

    return (await this.findById(nextRecord.id)) as MaterializationRecord;
  }

  async markSuperseded(id: string, supersededByRecordId: string, updatedAt: string): Promise<MaterializationRecord | null> {
    this.db.prepare(
      `UPDATE materialization_records
       SET status = 'superseded',
           superseded_by_record_id = ?,
           updated_at = ?
       WHERE id = ?`,
    ).run(supersededByRecordId, updatedAt, id);

    return this.findById(id);
  }

  async transferOwnershipForConversations(input: {
    conversationIds: readonly string[];
    previousUserId: string;
    userId: string;
    transferredAt?: string;
  }): Promise<readonly MaterializationRecord[]> {
    const conversationIds = Array.from(new Set(input.conversationIds.map((id) => id.trim()).filter(Boolean)));
    if (conversationIds.length === 0) {
      return [];
    }

    const placeholders = conversationIds.map(() => "?").join(", ");
    const rows = this.db.prepare(
      `SELECT * FROM materialization_records
       WHERE conversation_id IN (${placeholders})
         AND (user_id IS NULL OR user_id IN (?, ?))
       ORDER BY created_at ASC, id ASC`,
    ).all(...conversationIds, input.previousUserId, input.userId) as MaterializationRow[];

    this.db.prepare(
      `UPDATE materialization_records
       SET user_id = ?,
           updated_at = ?
       WHERE conversation_id IN (${placeholders})
         AND (user_id IS NULL OR user_id = ?)`,
    ).run(input.userId, input.transferredAt ?? new Date().toISOString(), ...conversationIds, input.previousUserId);

    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => row.id);
    const idPlaceholders = ids.map(() => "?").join(", ");
    const transferredRows = this.db.prepare(
      `SELECT * FROM materialization_records
       WHERE id IN (${idPlaceholders})
       ORDER BY created_at ASC, id ASC`,
    ).all(...ids) as MaterializationRow[];

    return transferredRows.map(mapRow);
  }
}
