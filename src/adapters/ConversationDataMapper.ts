import type Database from "better-sqlite3";
import type { Conversation, ConversationSummary } from "@/core/entities/conversation";
import {
  createConversationRoutingSnapshot,
  isConversationLane,
} from "@/core/entities/conversation-routing";
import type {
  ConversationDeleteReason,
  ConversationListScope,
  ConversationRepository,
} from "@/core/use-cases/ConversationRepository";
import type { RoleName } from "@/core/entities/user";

export class ConversationDataMapper implements ConversationRepository {
  constructor(private db: Database.Database) {}

  async create(conv: {
    id: string;
    userId: string;
    title: string;
    status?: "active" | "archived";
    sessionSource?: string;
    referralId?: string;
    referralSource?: string;
    importedAt?: string | null;
    importSourceConversationId?: string | null;
    importedFromExportedAt?: string | null;
  }): Promise<Conversation> {
    const status = conv.status ?? "active";
    const sessionSource = conv.sessionSource ?? "unknown";
    const referralId = conv.referralId ?? null;
    const referralSource = conv.referralSource ?? null;
    const importedAt = conv.importedAt ?? null;
    const importSourceConversationId = conv.importSourceConversationId ?? null;
    const importedFromExportedAt = conv.importedFromExportedAt ?? null;
    this.db
      .prepare(
        `INSERT INTO conversations (
          id,
          user_id,
          title,
          status,
          session_source,
          referral_id,
          referral_source,
          imported_at,
          import_source_conversation_id,
          imported_from_exported_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        conv.id,
        conv.userId,
        conv.title,
        status,
        sessionSource,
        referralId,
        referralSource,
        importedAt,
        importSourceConversationId,
        importedFromExportedAt,
      );

    const row = this.db
      .prepare(`SELECT * FROM conversations WHERE id = ?`)
      .get(conv.id) as ConversationRow;

    return mapRow(row);
  }

  async listByUser(
    userId: string,
    options?: { scope?: ConversationListScope; limit?: number },
  ): Promise<ConversationSummary[]> {
    const scope = options?.scope;
    const limit = options?.limit ?? 100;
    const clauses = ["c.user_id = ?"];
    const params: unknown[] = [userId];

    if (scope === "active") {
      clauses.push("c.deleted_at IS NULL", "c.status = 'active'");
    } else if (scope === "archived") {
      clauses.push("c.deleted_at IS NULL", "c.status = 'archived'");
    } else if (scope === "deleted") {
      clauses.push("c.deleted_at IS NOT NULL");
    } else if (scope === "all") {
      // include all owned conversations, including deleted rows
    } else {
      clauses.push("c.deleted_at IS NULL");
    }

    params.push(limit);

    const rows = this.db
      .prepare(
        `SELECT c.id, c.title, c.updated_at, c.message_count, c.status, c.deleted_at, c.purge_after
         FROM conversations c
         WHERE ${clauses.join(" AND ")}
         ORDER BY CASE WHEN c.deleted_at IS NOT NULL THEN c.deleted_at ELSE c.updated_at END DESC
         LIMIT ?`,
      )
      .all(...params) as Array<{
      id: string;
      title: string;
      updated_at: string;
      message_count: number;
      status: "active" | "archived";
      deleted_at: string | null;
      purge_after: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      updatedAt: r.updated_at,
      messageCount: r.message_count,
      status: r.status,
      ...(r.deleted_at ? { deletedAt: r.deleted_at } : {}),
      ...(r.purge_after ? { purgeAfter: r.purge_after } : {}),
    }));
  }

  async findById(id: string): Promise<Conversation | null> {
    const row = this.db
      .prepare(`SELECT * FROM conversations WHERE id = ?`)
      .get(id) as ConversationRow | undefined;

    return row ? mapRow(row) : null;
  }

  async findActiveByUser(userId: string): Promise<Conversation | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM conversations
         WHERE user_id = ?
           AND status = 'active'
           AND deleted_at IS NULL
         ORDER BY updated_at DESC LIMIT 1`,
      )
      .get(userId) as ConversationRow | undefined;

    return row ? mapRow(row) : null;
  }

  async archiveByUser(userId: string): Promise<void> {
    this.db
      .prepare(
        `UPDATE conversations
         SET status = 'archived', updated_at = datetime('now')
         WHERE user_id = ?
           AND status = 'active'
           AND deleted_at IS NULL`,
      )
      .run(userId);
  }

  async archiveById(id: string): Promise<void> {
    this.db
      .prepare(
        `UPDATE conversations
         SET status = 'archived', updated_at = datetime('now')
         WHERE id = ?
           AND deleted_at IS NULL`,
      )
      .run(id);
  }

  async softDelete(
    id: string,
    actor: { userId: string; role: RoleName; reason: ConversationDeleteReason },
    policy: { purgeAfter: string },
  ): Promise<void> {
    void actor.role;
    this.db
      .prepare(
        `UPDATE conversations
         SET status = 'archived',
             deleted_at = datetime('now'),
             deleted_by_user_id = ?,
             delete_reason = ?,
             purge_after = ?,
             restored_at = NULL,
             updated_at = datetime('now')
         WHERE id = ?
           AND deleted_at IS NULL`,
      )
      .run(actor.userId, actor.reason, policy.purgeAfter, id);
  }

  async restoreDeleted(id: string, _actorUserId: string): Promise<void> {
    this.db
      .prepare(
        `UPDATE conversations
         SET deleted_at = NULL,
             deleted_by_user_id = NULL,
             delete_reason = NULL,
             purge_after = NULL,
             restored_at = datetime('now'),
             status = 'archived',
             updated_at = datetime('now')
         WHERE id = ?
           AND deleted_at IS NOT NULL`,
      )
      .run(id);
  }

  async purge(
    id: string,
    actor: Parameters<ConversationRepository["purge"]>[1],
  ): Promise<void> {
    const row = this.db
      .prepare(`SELECT * FROM conversations WHERE id = ?`)
      .get(id) as ConversationRow | undefined;

    if (!row) {
      return;
    }

    const purgeConversation = this.db.transaction((conversationRow: ConversationRow) => {
      const conversationFileCount = this.db
        .prepare(`SELECT COUNT(*) AS total FROM user_files WHERE conversation_id = ?`)
        .get(conversationRow.id) as { total: number } | undefined;

      if (actor.reason === "privacy_request") {
        this.db.prepare(`DELETE FROM user_files WHERE conversation_id = ?`).run(conversationRow.id);
      }

      this.db
        .prepare(
          `INSERT INTO conversation_purge_audits (
            id,
            conversation_id,
            actor_user_id,
            actor_role,
            purge_reason,
            metadata_json
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          crypto.randomUUID().replace(/-/g, ""),
          conversationRow.id,
          actor.userId,
          actor.role,
          actor.reason,
          JSON.stringify({
            userId: conversationRow.user_id,
            title: conversationRow.title,
            sessionSource: conversationRow.session_source,
            messageCount: conversationRow.message_count,
            deletedAt: conversationRow.deleted_at,
            deletedByUserId: conversationRow.deleted_by_user_id,
            deleteReason: conversationRow.delete_reason,
            purgeAfter: conversationRow.purge_after,
            importedAt: conversationRow.imported_at,
            importSourceConversationId: conversationRow.import_source_conversation_id,
            importedFromExportedAt: conversationRow.imported_from_exported_at,
            conversationFilePolicy: actor.reason === "privacy_request" ? "deleted" : "detached_by_fk",
            conversationFileCount: conversationFileCount?.total ?? 0,
          }),
        );

      this.db.prepare(`DELETE FROM conversations WHERE id = ?`).run(conversationRow.id);
    });

    purgeConversation(row);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare(`DELETE FROM conversations WHERE id = ?`).run(id);
  }

  async updateTitle(id: string, title: string): Promise<void> {
    this.db
      .prepare(`UPDATE conversations SET title = ? WHERE id = ?`)
      .run(title, id);
  }

  async touch(id: string): Promise<void> {
    this.db
      .prepare(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`)
      .run(id);
  }

  async incrementMessageCount(id: string): Promise<void> {
    this.db
      .prepare(`UPDATE conversations SET message_count = message_count + 1 WHERE id = ?`)
      .run(id);
  }

  async setFirstMessageAt(id: string, timestamp: string): Promise<void> {
    this.db
      .prepare(`UPDATE conversations SET first_message_at = ? WHERE id = ? AND first_message_at IS NULL`)
      .run(timestamp, id);
  }

  async recordMessageAppended(id: string, timestamp: string): Promise<void> {
    this.db
      .prepare(
        `UPDATE conversations
         SET message_count = message_count + 1,
             first_message_at = COALESCE(first_message_at, ?),
             updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(timestamp, id);
  }

  async recordUserMessageAppendedWithEvent(
    id: string,
    timestamp: string,
    metadata: { role: "user"; token_estimate: number },
  ): Promise<void> {
    const recordAppend = this.db.transaction((conversationId: string, createdAt: string, eventMetadata: string) => {
      this.db
        .prepare(
          `UPDATE conversations
           SET message_count = message_count + 1,
               first_message_at = COALESCE(first_message_at, ?),
               updated_at = datetime('now')
           WHERE id = ?`,
        )
        .run(createdAt, conversationId);

      this.db
        .prepare(
          `INSERT INTO conversation_events (id, conversation_id, event_type, metadata)
           VALUES (?, ?, 'message_sent', ?)`,
        )
        .run(crypto.randomUUID().replace(/-/g, ""), conversationId, eventMetadata);
    });

    recordAppend(id, timestamp, JSON.stringify(metadata));
  }

  async setLastToolUsed(id: string, toolName: string): Promise<void> {
    this.db
      .prepare(`UPDATE conversations SET last_tool_used = ? WHERE id = ?`)
      .run(toolName, id);
  }

  async setConvertedFrom(id: string, anonUserId: string): Promise<void> {
    this.db
      .prepare(`UPDATE conversations SET converted_from = ? WHERE id = ?`)
      .run(anonUserId, id);
  }

  async setReferralSource(id: string, referralSource: string): Promise<void> {
    this.db
      .prepare(`UPDATE conversations SET referral_source = ? WHERE id = ?`)
      .run(referralSource, id);
  }

  async setReferralAttribution(id: string, referralId: string, referralSource: string): Promise<void> {
    this.db
      .prepare(
        `UPDATE conversations
         SET referral_id = COALESCE(referral_id, ?),
             referral_source = CASE
               WHEN referral_id IS NULL OR referral_id = ? THEN ?
               ELSE referral_source
             END
         WHERE id = ?`,
      )
      .run(referralId, referralId, referralSource, id);
  }

  async updateRoutingSnapshot(
    id: string,
    snapshot: Parameters<ConversationRepository["updateRoutingSnapshot"]>[1],
  ): Promise<void> {
    this.db
      .prepare(
        `UPDATE conversations
         SET lane = ?,
             lane_confidence = ?,
             recommended_next_step = ?,
             detected_need_summary = ?,
             lane_last_analyzed_at = ?
         WHERE id = ?`,
      )
      .run(
        snapshot.lane,
        snapshot.confidence,
        snapshot.recommendedNextStep,
        snapshot.detectedNeedSummary,
        snapshot.lastAnalyzedAt,
        id,
      );
  }

  // ── Admin methods (D4.7) ───────────────────────────────────────────

  async listForAdmin(filters: {
    status?: string;
    lane?: string;
    sessionSource?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Conversation[]> {
    const clauses: string[] = [filters.status === "deleted" ? "c.deleted_at IS NOT NULL" : "c.deleted_at IS NULL"];
    const params: unknown[] = [];

    if (filters.status && filters.status !== "deleted") {
      clauses.push("c.status = ?");
      params.push(filters.status);
    }
    if (filters.lane) {
      clauses.push("c.lane = ?");
      params.push(filters.lane);
    }
    if (filters.sessionSource) {
      clauses.push("c.session_source = ?");
      params.push(filters.sessionSource);
    }

    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;
    params.push(limit, offset);

    const rows = this.db
      .prepare(
        `SELECT * FROM conversations c
         WHERE ${clauses.join(" AND ")}
         ORDER BY c.updated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params) as ConversationRow[];

    return rows.map(mapRow);
  }

  async countForAdmin(filters: {
    status?: string;
    lane?: string;
    sessionSource?: string;
  } = {}): Promise<number> {
    const clauses: string[] = [filters.status === "deleted" ? "deleted_at IS NOT NULL" : "deleted_at IS NULL"];
    const params: unknown[] = [];

    if (filters.status && filters.status !== "deleted") {
      clauses.push("status = ?");
      params.push(filters.status);
    }
    if (filters.lane) {
      clauses.push("lane = ?");
      params.push(filters.lane);
    }
    if (filters.sessionSource) {
      clauses.push("session_source = ?");
      params.push(filters.sessionSource);
    }

    const row = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM conversations WHERE ${clauses.join(" AND ")}`,
      )
      .get(...params) as { count: number };

    return row.count;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const rows = this.db
      .prepare(
        `SELECT CASE WHEN deleted_at IS NOT NULL THEN 'deleted' ELSE status END as status,
                COUNT(*) as count
         FROM conversations
         GROUP BY CASE WHEN deleted_at IS NOT NULL THEN 'deleted' ELSE status END`,
      )
      .all() as Array<{ status: string; count: number }>;

    const result: Record<string, number> = {};
    for (const r of rows) result[r.status] = r.count;
    return result;
  }

  async countByLane(): Promise<Record<string, number>> {
    const rows = this.db
      .prepare(`SELECT lane, COUNT(*) as count FROM conversations GROUP BY lane`)
      .all() as Array<{ lane: string; count: number }>;

    const result: Record<string, number> = {};
    for (const r of rows) result[r.lane] = r.count;
    return result;
  }

  async setConversationMode(id: string, mode: "ai" | "human"): Promise<void> {
    this.db
      .prepare(`UPDATE conversations SET conversation_mode = ? WHERE id = ?`)
      .run(mode, id);
  }

  async transferOwnership(fromUserId: string, toUserId: string): Promise<string[]> {
    const rows = this.db
      .prepare(`SELECT id FROM conversations WHERE user_id = ?`)
      .all(fromUserId) as Array<{ id: string }>;

    if (rows.length > 0) {
      this.db
        .prepare(
          `UPDATE conversations SET user_id = ?, converted_from = ? WHERE user_id = ?`,
        )
        .run(toUserId, fromUserId, fromUserId);
    }

    return rows.map((r) => r.id);
  }

  async findIdsByUserAndConvertedFrom(userId: string, anonUserId: string): Promise<string[]> {
    const rows = this.db
      .prepare(`SELECT id FROM conversations WHERE user_id = ? AND converted_from = ?`)
      .all(userId, anonUserId) as Array<{ id: string }>;

    return rows.map((row) => row.id);
  }

  async listPurgeEligible(beforeIso: string, limit = 100): Promise<Conversation[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM conversations
         WHERE deleted_at IS NOT NULL
           AND purge_after IS NOT NULL
           AND purge_after <= ?
         ORDER BY purge_after ASC
         LIMIT ?`,
      )
      .all(beforeIso, limit) as ConversationRow[];

    return rows.map(mapRow);
  }

  async listAnonymousConversations(limit = 500): Promise<Conversation[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM conversations
         WHERE user_id LIKE 'anon_%'
         ORDER BY user_id ASC, updated_at DESC
         LIMIT ?`,
      )
      .all(limit) as ConversationRow[];

    return rows.map(mapRow);
  }
}

type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  converted_from: string | null;
  message_count: number;
  first_message_at: string | null;
  last_tool_used: string | null;
  session_source: string;
  prompt_version: number | null;
  lane: string;
  lane_confidence: number | null;
  recommended_next_step: string | null;
  detected_need_summary: string | null;
  lane_last_analyzed_at: string | null;
  referral_id: string | null;
  referral_source: string | null;
  deleted_at: string | null;
  deleted_by_user_id: string | null;
  delete_reason: "user_removed" | "admin_removed" | "privacy_request" | "retention_policy" | null;
  purge_after: string | null;
  restored_at: string | null;
  imported_at: string | null;
  import_source_conversation_id: string | null;
  imported_from_exported_at: string | null;
};

function mapRow(row: ConversationRow): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    status: row.status as "active" | "archived",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    convertedFrom: row.converted_from,
    messageCount: row.message_count,
    firstMessageAt: row.first_message_at,
    lastToolUsed: row.last_tool_used,
    sessionSource: row.session_source,
    promptVersion: row.prompt_version,
    routingSnapshot: createConversationRoutingSnapshot({
      lane: isConversationLane(row.lane) ? row.lane : "uncertain",
      confidence: row.lane_confidence,
      recommendedNextStep: row.recommended_next_step,
      detectedNeedSummary: row.detected_need_summary,
      lastAnalyzedAt: row.lane_last_analyzed_at,
    }),
    referralId: row.referral_id,
    referralSource: row.referral_source,
    ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
    ...(row.deleted_by_user_id ? { deletedByUserId: row.deleted_by_user_id } : {}),
    ...(row.delete_reason ? { deleteReason: row.delete_reason } : {}),
    ...(row.purge_after ? { purgeAfter: row.purge_after } : {}),
    ...(row.restored_at ? { restoredAt: row.restored_at } : {}),
    ...(row.imported_at ? { importedAt: row.imported_at } : {}),
    ...(row.import_source_conversation_id ? { importSourceConversationId: row.import_source_conversation_id } : {}),
    ...(row.imported_from_exported_at ? { importedFromExportedAt: row.imported_from_exported_at } : {}),
  };
}
