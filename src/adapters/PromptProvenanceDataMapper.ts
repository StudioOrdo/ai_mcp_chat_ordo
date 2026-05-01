import type Database from "better-sqlite3";

import type { PromptRuntimeReplayContext } from "@/lib/chat/prompt-runtime";
import type {
  CompactSectionEntry,
  PromptTurnProvenanceRecord,
} from "@/lib/prompts/prompt-provenance-store";
import type { PromptSlotRef, PromptRuntimeWarning, PromptSurface } from "@/lib/chat/prompt-runtime";

interface CreatePromptTurnProvenanceInput {
  conversationId: string;
  userMessageId: string;
  assistantMessageId?: string | null;
  surface: PromptSurface;
  effectiveHash: string;
  slotRefs: PromptSlotRef[];
  sections: CompactSectionEntry[];
  warnings: PromptRuntimeWarning[];
  replayContext: PromptRuntimeReplayContext;
  recordedAt?: string;
}

interface PromptTurnProvenanceRow {
  id: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string | null;
  surface: PromptSurface;
  effectiveHash: string;
  slotRefsJson: string;
  sectionsJson: string;
  warningsJson: string;
  replayContextJson: string;
  recordedAt: string;
}

function mapRow(row: PromptTurnProvenanceRow): PromptTurnProvenanceRecord {
  return {
    id: row.id,
    conversationId: row.conversationId,
    userMessageId: row.userMessageId,
    assistantMessageId: row.assistantMessageId,
    surface: row.surface,
    effectiveHash: row.effectiveHash,
    slotRefs: JSON.parse(row.slotRefsJson),
    sections: JSON.parse(row.sectionsJson),
    warnings: JSON.parse(row.warningsJson),
    replayContext: JSON.parse(row.replayContextJson),
    recordedAt: row.recordedAt,
  };
}

export class PromptProvenanceDataMapper {
  constructor(private readonly db: Database.Database) {}

  async create(input: CreatePromptTurnProvenanceInput): Promise<PromptTurnProvenanceRecord> {
    const id = `pprov_${crypto.randomUUID()}`;
    const recordedAt = input.recordedAt ?? new Date().toISOString();

    this.db.prepare(
      `INSERT INTO prompt_provenance_records (
        id,
        conversation_id,
        user_message_id,
        assistant_message_id,
        surface,
        effective_hash,
        slot_refs_json,
        sections_json,
        warnings_json,
        replay_context_json,
        recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.conversationId,
      input.userMessageId,
      input.assistantMessageId ?? null,
      input.surface,
      input.effectiveHash,
      JSON.stringify(input.slotRefs),
      JSON.stringify(input.sections),
      JSON.stringify(input.warnings),
      JSON.stringify(input.replayContext),
      recordedAt,
    );

    return {
      id,
      conversationId: input.conversationId,
      userMessageId: input.userMessageId,
      assistantMessageId: input.assistantMessageId ?? null,
      surface: input.surface,
      effectiveHash: input.effectiveHash,
      slotRefs: input.slotRefs,
      sections: input.sections,
      warnings: input.warnings,
      replayContext: input.replayContext,
      recordedAt,
    };
  }

  async attachAssistantMessage(recordId: string, assistantMessageId: string): Promise<void> {
    this.db.prepare(
      `UPDATE prompt_provenance_records
       SET assistant_message_id = ?
       WHERE id = ?`,
    ).run(assistantMessageId, recordId);
  }

  async findById(id: string): Promise<PromptTurnProvenanceRecord | null> {
    const row = this.db.prepare(
      `SELECT
         id,
         conversation_id as conversationId,
         user_message_id as userMessageId,
         assistant_message_id as assistantMessageId,
         surface,
         effective_hash as effectiveHash,
         slot_refs_json as slotRefsJson,
         sections_json as sectionsJson,
         warnings_json as warningsJson,
         replay_context_json as replayContextJson,
         recorded_at as recordedAt
       FROM prompt_provenance_records
       WHERE id = ?
       LIMIT 1`,
    ).get(id) as PromptTurnProvenanceRow | undefined;

    return row ? mapRow(row) : null;
  }

  async findLatestByConversation(conversationId: string): Promise<PromptTurnProvenanceRecord | null> {
    const row = this.db.prepare(
      `SELECT
         id,
         conversation_id as conversationId,
         user_message_id as userMessageId,
         assistant_message_id as assistantMessageId,
         surface,
         effective_hash as effectiveHash,
         slot_refs_json as slotRefsJson,
         sections_json as sectionsJson,
         warnings_json as warningsJson,
         replay_context_json as replayContextJson,
         recorded_at as recordedAt
       FROM prompt_provenance_records
       WHERE conversation_id = ?
       ORDER BY recorded_at DESC, id DESC
       LIMIT 1`,
    ).get(conversationId) as PromptTurnProvenanceRow | undefined;

    return row ? mapRow(row) : null;
  }

  async findByConversationAndTurnId(
    conversationId: string,
    turnId: string,
  ): Promise<PromptTurnProvenanceRecord | null> {
    const row = this.db.prepare(
      `SELECT
         id,
         conversation_id as conversationId,
         user_message_id as userMessageId,
         assistant_message_id as assistantMessageId,
         surface,
         effective_hash as effectiveHash,
         slot_refs_json as slotRefsJson,
         sections_json as sectionsJson,
         warnings_json as warningsJson,
         replay_context_json as replayContextJson,
         recorded_at as recordedAt
       FROM prompt_provenance_records
       WHERE conversation_id = ?
         AND (user_message_id = ? OR assistant_message_id = ?)
       ORDER BY recorded_at DESC, id DESC
       LIMIT 1`,
    ).get(conversationId, turnId, turnId) as PromptTurnProvenanceRow | undefined;

    return row ? mapRow(row) : null;
  }

  async listByConversation(conversationId: string): Promise<PromptTurnProvenanceRecord[]> {
    const rows = this.db.prepare(
      `SELECT
         id,
         conversation_id as conversationId,
         user_message_id as userMessageId,
         assistant_message_id as assistantMessageId,
         surface,
         effective_hash as effectiveHash,
         slot_refs_json as slotRefsJson,
         sections_json as sectionsJson,
         warnings_json as warningsJson,
         replay_context_json as replayContextJson,
         recorded_at as recordedAt
       FROM prompt_provenance_records
       WHERE conversation_id = ?
       ORDER BY recorded_at ASC, id ASC`,
    ).all(conversationId) as PromptTurnProvenanceRow[];

    return rows.map(mapRow);
  }

  async countByConversations(conversationIds: readonly string[]): Promise<number> {
    const ids = Array.from(new Set(conversationIds.map((id) => id.trim()).filter(Boolean)));
    if (ids.length === 0) {
      return 0;
    }

    const placeholders = ids.map(() => "?").join(", ");
    const row = this.db.prepare(
      `SELECT COUNT(*) AS total
       FROM prompt_provenance_records
       WHERE conversation_id IN (${placeholders})`,
    ).get(...ids) as { total: number } | undefined;

    return row?.total ?? 0;
  }
}
