import type Database from "better-sqlite3";

import type { PromptBinding } from "@/core/entities/prompt-binding";
import type { PromptBindingRepository } from "@/core/use-cases/PromptBindingRepository";

interface PromptBindingRow {
  id: string;
  userId: string;
  conversationId: string | null;
  surface: PromptBinding["surface"];
  targetKind: PromptBinding["targetKind"];
  targetId: string;
  sourcePromptBindingId: string | null;
  effectiveHash: string;
  slotRefsJson: string;
  overlayRefsJson: string;
  requestRefsJson: string;
  decisionSourceRefsJson: string;
  evidenceRefsJson: string;
  createdAt: string;
}

function mapRow(row: PromptBindingRow): PromptBinding {
  return {
    id: row.id,
    userId: row.userId,
    conversationId: row.conversationId,
    surface: row.surface,
    targetKind: row.targetKind,
    targetId: row.targetId,
    sourcePromptBindingId: row.sourcePromptBindingId,
    effectiveHash: row.effectiveHash,
    slotRefs: JSON.parse(row.slotRefsJson),
    overlayRefs: JSON.parse(row.overlayRefsJson),
    requestRefs: JSON.parse(row.requestRefsJson),
    decisionSourceRefs: JSON.parse(row.decisionSourceRefsJson),
    evidenceRefs: JSON.parse(row.evidenceRefsJson),
    createdAt: row.createdAt,
  };
}

export class PromptBindingDataMapper implements PromptBindingRepository {
  constructor(private readonly db: Database.Database) {}

  async record(binding: PromptBinding): Promise<PromptBinding> {
    this.db.prepare(
      `INSERT INTO prompt_bindings (
        id,
        user_id,
        conversation_id,
        surface,
        target_kind,
        target_id,
        source_prompt_binding_id,
        effective_hash,
        slot_refs_json,
        overlay_refs_json,
        request_refs_json,
        decision_source_refs_json,
        evidence_refs_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        conversation_id = excluded.conversation_id,
        surface = excluded.surface,
        target_kind = excluded.target_kind,
        target_id = excluded.target_id,
        source_prompt_binding_id = excluded.source_prompt_binding_id,
        effective_hash = excluded.effective_hash,
        slot_refs_json = excluded.slot_refs_json,
        overlay_refs_json = excluded.overlay_refs_json,
        request_refs_json = excluded.request_refs_json,
        decision_source_refs_json = excluded.decision_source_refs_json,
        evidence_refs_json = excluded.evidence_refs_json,
        created_at = excluded.created_at`
    ).run(
      binding.id,
      binding.userId,
      binding.conversationId,
      binding.surface,
      binding.targetKind,
      binding.targetId,
      binding.sourcePromptBindingId,
      binding.effectiveHash,
      JSON.stringify(binding.slotRefs),
      JSON.stringify(binding.overlayRefs),
      JSON.stringify(binding.requestRefs ?? []),
      JSON.stringify(binding.decisionSourceRefs),
      JSON.stringify(binding.evidenceRefs),
      binding.createdAt,
    );

    return binding;
  }

  async findById(id: string): Promise<PromptBinding | null> {
    const row = this.db.prepare(
      `SELECT
         id,
         user_id as userId,
         conversation_id as conversationId,
         surface,
        target_kind as targetKind,
        target_id as targetId,
        source_prompt_binding_id as sourcePromptBindingId,
         effective_hash as effectiveHash,
         slot_refs_json as slotRefsJson,
         overlay_refs_json as overlayRefsJson,
         request_refs_json as requestRefsJson,
         decision_source_refs_json as decisionSourceRefsJson,
         evidence_refs_json as evidenceRefsJson,
         created_at as createdAt
       FROM prompt_bindings
       WHERE id = ?
       LIMIT 1`,
    ).get(id) as PromptBindingRow | undefined;

    return row ? mapRow(row) : null;
  }

  async findByTarget(targetKind: PromptBinding["targetKind"], targetId: string): Promise<PromptBinding | null> {
    const row = this.db.prepare(
      `SELECT
         id,
         user_id as userId,
         conversation_id as conversationId,
         surface,
         target_kind as targetKind,
         target_id as targetId,
         source_prompt_binding_id as sourcePromptBindingId,
         effective_hash as effectiveHash,
         slot_refs_json as slotRefsJson,
         overlay_refs_json as overlayRefsJson,
         request_refs_json as requestRefsJson,
         decision_source_refs_json as decisionSourceRefsJson,
         evidence_refs_json as evidenceRefsJson,
         created_at as createdAt
       FROM prompt_bindings
       WHERE target_kind = ?
         AND target_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    ).get(targetKind, targetId) as PromptBindingRow | undefined;

    return row ? mapRow(row) : null;
  }

  async listByConversation(conversationId: string, options?: { limit?: number }): Promise<PromptBinding[]> {
    const requestedLimit = options?.limit ?? 50;
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.floor(requestedLimit)
      : 50;

    const rows = this.db.prepare(
      `SELECT
         id,
         user_id as userId,
         conversation_id as conversationId,
         surface,
        target_kind as targetKind,
        target_id as targetId,
        source_prompt_binding_id as sourcePromptBindingId,
         effective_hash as effectiveHash,
         slot_refs_json as slotRefsJson,
         overlay_refs_json as overlayRefsJson,
         request_refs_json as requestRefsJson,
         decision_source_refs_json as decisionSourceRefsJson,
         evidence_refs_json as evidenceRefsJson,
         created_at as createdAt
       FROM prompt_bindings
       WHERE conversation_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    ).all(conversationId, limit) as PromptBindingRow[];

    return rows.map(mapRow);
  }

  async listBySourcePromptBinding(sourcePromptBindingId: string, options?: { limit?: number }): Promise<PromptBinding[]> {
    const requestedLimit = options?.limit ?? 50;
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.floor(requestedLimit)
      : 50;

    const rows = this.db.prepare(
      `SELECT
         id,
         user_id as userId,
         conversation_id as conversationId,
         surface,
         target_kind as targetKind,
         target_id as targetId,
         source_prompt_binding_id as sourcePromptBindingId,
         effective_hash as effectiveHash,
         slot_refs_json as slotRefsJson,
         overlay_refs_json as overlayRefsJson,
         request_refs_json as requestRefsJson,
         decision_source_refs_json as decisionSourceRefsJson,
         evidence_refs_json as evidenceRefsJson,
         created_at as createdAt
       FROM prompt_bindings
       WHERE source_prompt_binding_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    ).all(sourcePromptBindingId, limit) as PromptBindingRow[];

    return rows.map(mapRow);
  }

  async transferOwnershipForConversations(input: {
    conversationIds: readonly string[];
    previousUserId: string;
    userId: string;
  }): Promise<PromptBinding[]> {
    const conversationIds = Array.from(new Set(input.conversationIds.map((id) => id.trim()).filter(Boolean)));
    if (conversationIds.length === 0) {
      return [];
    }

    const placeholders = conversationIds.map(() => "?").join(", ");
    const rows = this.db.prepare(
      `SELECT
         id,
         user_id as userId,
         conversation_id as conversationId,
         surface,
         target_kind as targetKind,
         target_id as targetId,
         source_prompt_binding_id as sourcePromptBindingId,
         effective_hash as effectiveHash,
         slot_refs_json as slotRefsJson,
         overlay_refs_json as overlayRefsJson,
         request_refs_json as requestRefsJson,
         decision_source_refs_json as decisionSourceRefsJson,
         evidence_refs_json as evidenceRefsJson,
         created_at as createdAt
       FROM prompt_bindings
       WHERE conversation_id IN (${placeholders})
         AND user_id IN (?, ?)
       ORDER BY created_at ASC, id ASC`,
    ).all(...conversationIds, input.previousUserId, input.userId) as PromptBindingRow[];

    this.db.prepare(
      `UPDATE prompt_bindings
       SET user_id = ?
       WHERE conversation_id IN (${placeholders})
         AND user_id = ?`,
    ).run(input.userId, ...conversationIds, input.previousUserId);

    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => row.id);
    const idPlaceholders = ids.map(() => "?").join(", ");
    const transferredRows = this.db.prepare(
      `SELECT
         id,
         user_id as userId,
         conversation_id as conversationId,
         surface,
         target_kind as targetKind,
         target_id as targetId,
         source_prompt_binding_id as sourcePromptBindingId,
         effective_hash as effectiveHash,
         slot_refs_json as slotRefsJson,
         overlay_refs_json as overlayRefsJson,
         request_refs_json as requestRefsJson,
         decision_source_refs_json as decisionSourceRefsJson,
         evidence_refs_json as evidenceRefsJson,
         created_at as createdAt
       FROM prompt_bindings
       WHERE id IN (${idPlaceholders})
       ORDER BY created_at ASC, id ASC`,
    ).all(...ids) as PromptBindingRow[];

    return transferredRows.map(mapRow);
  }
}
