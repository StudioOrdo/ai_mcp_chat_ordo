import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { ensureSchema } from "@/lib/db/schema";
import { ConversationDataMapper } from "./ConversationDataMapper";
import { PromptBindingDataMapper } from "./PromptBindingDataMapper";

function createDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

async function seedConversation(db: Database.Database) {
  db.prepare(`INSERT INTO users (id, email, name) VALUES ('usr_prompt_binding', 'binding@example.com', 'Binding Tester')`).run();
  const conversations = new ConversationDataMapper(db);
  await conversations.create({
    id: "conv_prompt_binding",
    userId: "usr_prompt_binding",
    title: "Prompt binding",
  });
}

describe("PromptBindingDataMapper", () => {
  let db: Database.Database;
  let mapper: PromptBindingDataMapper;

  beforeEach(async () => {
    db = createDb();
    await seedConversation(db);
    mapper = new PromptBindingDataMapper(db);
  });

  it("records and lists prompt bindings by conversation", async () => {
    const created = await mapper.record({
      id: "pb_1",
      userId: "usr_prompt_binding",
      conversationId: "conv_prompt_binding",
      surface: "chat_stream",
      targetKind: "message",
      targetId: "msg_prompt_binding_1",
      sourcePromptBindingId: null,
      effectiveHash: "hash_prompt_binding_1",
      slotRefs: [
        {
          slotId: "sp_base_1",
          version: 3,
          effectiveHash: null,
        },
      ],
      overlayRefs: [
        {
          overlayId: "identity_name_overlay",
          label: "identity_name_overlay",
          effectiveHash: "overlay_hash_1",
        },
      ],
      requestRefs: [
        {
          requestId: "task_origin_handoff",
          label: "task_origin_handoff",
          sourceKind: "request",
          effectiveHash: "request_hash_1",
        },
      ],
      decisionSourceRefs: [
        {
          sourceKind: "conversation",
          sourceId: "conv_prompt_binding",
          userId: "usr_prompt_binding",
          conversationId: "conv_prompt_binding",
        },
      ],
      evidenceRefs: [
        {
          source: {
            sourceKind: "prompt_provenance",
            sourceId: "pprov_1",
            userId: "usr_prompt_binding",
            conversationId: "conv_prompt_binding",
          },
          observedAt: "2026-04-29T12:00:00.000Z",
          summary: "Prompt runtime captured for the turn.",
        },
      ],
      createdAt: "2026-04-29T12:00:00.000Z",
    });

    const listed = await mapper.listByConversation("conv_prompt_binding");
    const found = await mapper.findById("pb_1");
    const byTarget = await mapper.findByTarget("message", "msg_prompt_binding_1");

    expect(created.id).toBe("pb_1");
    expect(listed).toEqual([created]);
    expect(found).toEqual(created);
    expect(byTarget).toEqual(created);
  });

  it("lists derived bindings by source binding id", async () => {
    await mapper.record({
      id: "pb_root",
      userId: "usr_prompt_binding",
      conversationId: "conv_prompt_binding",
      surface: "chat_stream",
      targetKind: "message",
      targetId: "msg_prompt_binding_root",
      sourcePromptBindingId: null,
      effectiveHash: "hash_prompt_binding_root",
      slotRefs: [],
      overlayRefs: [],
      requestRefs: [],
      decisionSourceRefs: [],
      evidenceRefs: [],
      createdAt: "2026-04-29T12:00:00.000Z",
    });
    await mapper.record({
      id: "pb_job",
      userId: "usr_prompt_binding",
      conversationId: "conv_prompt_binding",
      surface: "job_execution",
      targetKind: "job",
      targetId: "job_prompt_binding_1",
      sourcePromptBindingId: "pb_root",
      effectiveHash: "hash_prompt_binding_root",
      slotRefs: [],
      overlayRefs: [],
      requestRefs: [],
      decisionSourceRefs: [],
      evidenceRefs: [],
      createdAt: "2026-04-29T12:01:00.000Z",
    });

    expect(await mapper.listBySourcePromptBinding("pb_root")).toEqual([
      expect.objectContaining({ id: "pb_job", sourcePromptBindingId: "pb_root" }),
    ]);
  });

  it("keeps historical bindings for the same target and returns the latest target binding", async () => {
    const earlier = await mapper.record({
      id: "pb_history_1",
      userId: "usr_prompt_binding",
      conversationId: "conv_prompt_binding",
      surface: "memory_projection",
      targetKind: "relationship_memory",
      targetId: "mem_prompt_binding_1",
      sourcePromptBindingId: null,
      effectiveHash: "hash_earlier",
      slotRefs: [],
      overlayRefs: [],
      requestRefs: [],
      decisionSourceRefs: [],
      evidenceRefs: [],
      createdAt: "2026-04-29T12:00:00.000Z",
    });
    const later = await mapper.record({
      ...earlier,
      id: "pb_history_2",
      effectiveHash: "hash_later",
      createdAt: "2026-04-29T12:05:00.000Z",
    });

    expect(await mapper.findByTarget("relationship_memory", "mem_prompt_binding_1")).toEqual(later);
    expect(await mapper.listByConversation("conv_prompt_binding")).toEqual([later, earlier]);
  });

  it("transfers prompt bindings for migrated conversations", async () => {
    db.prepare(`INSERT INTO users (id, email, name) VALUES ('anon_seed', 'anon-binding@example.com', 'Anon')`).run();
    await mapper.record({
      id: "pb_anon",
      userId: "anon_seed",
      conversationId: "conv_prompt_binding",
      surface: "chat_stream",
      targetKind: "message",
      targetId: "msg_anon_binding",
      sourcePromptBindingId: null,
      effectiveHash: "hash_anon",
      slotRefs: [],
      overlayRefs: [],
      requestRefs: [],
      decisionSourceRefs: [],
      evidenceRefs: [],
      createdAt: "2026-04-29T12:00:00.000Z",
    });

    const transferred = await mapper.transferOwnershipForConversations({
      conversationIds: ["conv_prompt_binding"],
      previousUserId: "anon_seed",
      userId: "usr_prompt_binding",
    });

    expect(transferred).toEqual([
      expect.objectContaining({ id: "pb_anon", userId: "usr_prompt_binding" }),
    ]);
    await expect(mapper.findById("pb_anon")).resolves.toEqual(
      expect.objectContaining({ userId: "usr_prompt_binding" }),
    );
  });
});
