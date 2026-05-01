import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { ensureSchema } from "@/lib/db/schema";
import { ConversationDataMapper } from "./ConversationDataMapper";
import { PromptProvenanceDataMapper } from "./PromptProvenanceDataMapper";

function createDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

async function seedConversation(db: Database.Database) {
  db.prepare(`INSERT INTO users (id, email, name) VALUES ('usr_prompt', 'prompt@example.com', 'Prompt Tester')`).run();
  const conversations = new ConversationDataMapper(db);
  await conversations.create({
    id: "conv_prompt",
    userId: "usr_prompt",
    title: "Prompt provenance",
  });
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, parts, token_estimate, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "msg_user_turn",
    "conv_prompt",
    "user",
    "Help audit the prompt provenance.",
    JSON.stringify([{ type: "text", text: "Help audit the prompt provenance." }]),
    8,
    "2026-04-02T10:00:00.000Z",
  );
}

describe("PromptProvenanceDataMapper", () => {
  let db: Database.Database;
  let mapper: PromptProvenanceDataMapper;

  beforeEach(async () => {
    db = createDb();
    await seedConversation(db);
    mapper = new PromptProvenanceDataMapper(db);
  });

  it("creates and lists durable prompt turn provenance records", async () => {
    const created = await mapper.create({
      conversationId: "conv_prompt",
      userMessageId: "msg_user_turn",
      surface: "chat_stream",
      effectiveHash: "hash_prompt_1",
      slotRefs: [
        {
          role: "ALL",
          promptType: "base",
          source: "db",
          promptId: "prompt_base_1",
          version: 4,
        },
      ],
      sections: [
        {
          key: "identity",
          sourceKind: "slot",
          priority: 10,
          includedInText: true,
          slotKey: "ALL/base",
        },
        {
          key: "media_continuity_handoff",
          sourceKind: "request",
          priority: 88,
          includedInText: true,
          payload: {
            assets: [
              { assetId: "uf_chart_1", kind: "chart", derivativeOfAssetId: "chart_test_001" },
            ],
          },
        },
      ],
      warnings: [],
      replayContext: {
        surface: "chat_stream",
        role: "ADMIN",
        currentPathname: "/admin/conversations/conv_prompt",
      },
      recordedAt: "2026-04-02T10:00:05.000Z",
    });

    const listed = await mapper.listByConversation("conv_prompt");

    expect(created.id).toMatch(/^pprov_/);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual(created);
    expect(listed[0].sections[1]).toEqual({
      key: "media_continuity_handoff",
      sourceKind: "request",
      priority: 88,
      includedInText: true,
      payload: {
        assets: [
          { assetId: "uf_chart_1", kind: "chart", derivativeOfAssetId: "chart_test_001" },
        ],
      },
    });
  });

  it("links assistant messages and resolves turns by either user or assistant message id", async () => {
    const created = await mapper.create({
      conversationId: "conv_prompt",
      userMessageId: "msg_user_turn",
      surface: "chat_stream",
      effectiveHash: "hash_prompt_2",
      slotRefs: [],
      sections: [],
      warnings: [],
      replayContext: {
        surface: "chat_stream",
        role: "ADMIN",
      },
    });

    db.prepare(
      `INSERT INTO messages (id, conversation_id, role, content, parts, token_estimate, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "msg_assistant_turn",
      "conv_prompt",
      "assistant",
      "Here is the audit.",
      JSON.stringify([{ type: "text", text: "Here is the audit." }]),
      6,
      "2026-04-02T10:00:10.000Z",
    );

    await mapper.attachAssistantMessage(created.id, "msg_assistant_turn");

    const byUserTurn = await mapper.findByConversationAndTurnId("conv_prompt", "msg_user_turn");
    const byAssistantTurn = await mapper.findByConversationAndTurnId("conv_prompt", "msg_assistant_turn");
    const latest = await mapper.findLatestByConversation("conv_prompt");

    expect(byUserTurn?.assistantMessageId).toBe("msg_assistant_turn");
    expect(byAssistantTurn?.id).toBe(created.id);
    expect(latest?.id).toBe(created.id);
  });

  it("counts prompt provenance records across migrated conversations", async () => {
    await mapper.create({
      conversationId: "conv_prompt",
      userMessageId: "msg_user_turn",
      surface: "chat_stream",
      effectiveHash: "hash_prompt_3",
      slotRefs: [],
      sections: [],
      warnings: [],
      replayContext: { surface: "chat_stream", role: "ADMIN" },
    });

    await expect(mapper.countByConversations(["conv_prompt", "conv_missing"])).resolves.toBe(1);
    await expect(mapper.countByConversations([])).resolves.toBe(0);
  });
});
