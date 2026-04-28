import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureSchema } from "@/lib/db/schema";
import { createConversationInteractorMock } from "../../../tests/helpers/conversation-interactor-fixture";

const { getConversationInteractorMock, indexDocumentMock, getDbMock } = vi.hoisted(() => ({
  getConversationInteractorMock: vi.fn(),
  indexDocumentMock: vi.fn(),
  getDbMock: vi.fn(),
}));

vi.mock("./conversation-root", () => ({
  getConversationInteractor: () =>
    createConversationInteractorMock({
      get: getConversationInteractorMock,
    }),
}));

vi.mock("./tool-composition-root", () => ({
  getEmbeddingPipelineFactory: () => ({
    createForSource: () => ({
      indexDocument: indexDocumentMock,
    }),
  }),
}));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

import {
  getConversationSourceId,
  repairConversationOwnershipIndex,
  repairConvertedConversationOwnershipIndexes,
} from "./embed-conversation";

function createDb() {
  const db = new Database(":memory:");
  ensureSchema(db);
  return db;
}

describe("conversation ownership repair", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb();
    getDbMock.mockReturnValue(db);
    getConversationInteractorMock.mockReset();
    indexDocumentMock.mockReset();
  });

  it("deletes stale owner-prefixed embeddings and reindexes under the canonical owner", async () => {
    db.prepare(
      `INSERT INTO embeddings (
        id, source_type, source_id, chunk_index, chunk_level, heading,
        content, embedding_input, content_hash, model_version, embedding, metadata, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).run(
      "emb_old_1",
      "conversation",
      getConversationSourceId("anon_123", "conv_1"),
      0,
      "passage",
      null,
      "Old content",
      "Old content",
      "hash",
      "test-model",
      Buffer.from(new Float32Array([1, 0, 0]).buffer),
      JSON.stringify({
        sourceType: "conversation",
        conversationId: "conv_1",
        userId: "anon_123",
        role: "user",
        turnIndex: 0,
      }),
    );

    getConversationInteractorMock.mockResolvedValue({
      conversation: { id: "conv_1", userId: "usr_1" },
      messages: [
        { role: "user", content: "Hello", parts: [{ type: "text", text: "Hello" }] },
        { role: "assistant", content: "Hi", parts: [{ type: "text", text: "Hi" }] },
      ],
    });

    await repairConversationOwnershipIndex("conv_1", "usr_1", "anon_123");

    const staleRows = db
      .prepare(`SELECT COUNT(*) AS count FROM embeddings WHERE source_id = ?`)
      .get(getConversationSourceId("anon_123", "conv_1")) as { count: number };

    expect(staleRows.count).toBe(0);
    expect(indexDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "conversation",
        sourceId: getConversationSourceId("usr_1", "conv_1"),
      }),
    );
  });

  it("repairs all converted conversations from canonical SQL ownership", async () => {
    db.prepare(`INSERT OR IGNORE INTO users (id, email, name) VALUES ('usr_1', 'u1@test.com', 'User 1')`).run();
    db.prepare(`INSERT OR IGNORE INTO users (id, email, name) VALUES ('usr_2', 'u2@test.com', 'User 2')`).run();
    db.prepare(`INSERT INTO conversations (id, user_id, title, converted_from, status, session_source) VALUES ('conv_1', 'usr_1', 'Chat 1', 'anon_a', 'archived', 'authenticated')`).run();
    db.prepare(`INSERT INTO conversations (id, user_id, title, converted_from, status, session_source) VALUES ('conv_2', 'usr_2', 'Chat 2', 'anon_b', 'archived', 'authenticated')`).run();

    db.prepare(
      `INSERT INTO embeddings (
        id, source_type, source_id, chunk_index, chunk_level, heading,
        content, embedding_input, content_hash, model_version, embedding, metadata, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).run(
      "emb_old_1",
      "conversation",
      getConversationSourceId("anon_a", "conv_1"),
      0,
      "passage",
      null,
      "Old 1",
      "Old 1",
      "hash1",
      "test-model",
      Buffer.from(new Float32Array([1, 0, 0]).buffer),
      JSON.stringify({
        sourceType: "conversation",
        conversationId: "conv_1",
        userId: "anon_a",
        role: "user",
        turnIndex: 0,
      }),
    );
    db.prepare(
      `INSERT INTO embeddings (
        id, source_type, source_id, chunk_index, chunk_level, heading,
        content, embedding_input, content_hash, model_version, embedding, metadata, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).run(
      "emb_old_2",
      "conversation",
      getConversationSourceId("anon_b", "conv_2"),
      0,
      "passage",
      null,
      "Old 2",
      "Old 2",
      "hash2",
      "test-model",
      Buffer.from(new Float32Array([1, 0, 0]).buffer),
      JSON.stringify({
        sourceType: "conversation",
        conversationId: "conv_2",
        userId: "anon_b",
        role: "user",
        turnIndex: 0,
      }),
    );

    getConversationInteractorMock.mockImplementation(
      async (conversationId: string, userId: string) => ({
        conversation: { id: conversationId, userId },
        messages: [
          { role: "user", content: `Message for ${conversationId}`, parts: [{ type: "text", text: "Message" }] },
        ],
      }),
    );

    const result = await repairConvertedConversationOwnershipIndexes();

    expect(result.repaired).toBe(2);
    expect(indexDocumentMock).toHaveBeenCalledTimes(2);

    const staleA = db
      .prepare(`SELECT COUNT(*) AS count FROM embeddings WHERE source_id = ?`)
      .get(getConversationSourceId("anon_a", "conv_1")) as { count: number };
    const staleB = db
      .prepare(`SELECT COUNT(*) AS count FROM embeddings WHERE source_id = ?`)
      .get(getConversationSourceId("anon_b", "conv_2")) as { count: number };

    expect(staleA.count).toBeLessThanOrEqual(1);
    expect(staleB.count).toBeLessThanOrEqual(1);
  });
});