import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { ensureSchema } from "../lib/db/schema";
import { ConversationDataMapper } from "./ConversationDataMapper";
import { MessageDataMapper } from "./MessageDataMapper";
import { createConversationRoutingSnapshot } from "../core/entities/conversation-routing";

function requireValue<T>(value: T | null | undefined): T {
  expect(value).toBeTruthy();
  if (value == null) {
    throw new Error("Expected value to be present.");
  }
  return value;
}

function createDb() {
  const db = new Database(":memory:");
  // Enable foreign keys (needed for CASCADE)
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedUser(db: Database.Database) {
  db.prepare(
    `INSERT OR IGNORE INTO users (id, email, name) VALUES ('usr_test', 'test@test.com', 'Test')`,
  ).run();
  db.prepare(
    `INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('usr_test', 'role_authenticated')`,
  ).run();
}

describe("ConversationDataMapper", () => {
  let db: Database.Database;
  let mapper: ConversationDataMapper;

  beforeEach(() => {
    db = createDb();
    seedUser(db);
    mapper = new ConversationDataMapper(db);
  });

  it("create → findById lifecycle", async () => {
    const conv = await mapper.create({ id: "conv_1", userId: "usr_test", title: "Hello" });
    expect(conv.id).toBe("conv_1");
    expect(conv.userId).toBe("usr_test");
    expect(conv.title).toBe("Hello");
    expect(conv.routingSnapshot).toEqual(createConversationRoutingSnapshot());

    const found = requireValue(await mapper.findById("conv_1"));
    expect(found.title).toBe("Hello");
    expect(found.routingSnapshot).toEqual(createConversationRoutingSnapshot());
  });

  it("persists canonical referral linkage alongside the debug referral source", async () => {
    const conv = await mapper.create({
      id: "conv_ref",
      userId: "usr_test",
      title: "Referral",
      referralId: "ref_1",
      referralSource: "mentor-42",
    });

    expect(conv.referralId).toBe("ref_1");
    expect(conv.referralSource).toBe("mentor-42");

    const found = requireValue(await mapper.findById("conv_ref"));
    expect(found.referralId).toBe("ref_1");
    expect(found.referralSource).toBe("mentor-42");
  });

  it("persists imported-conversation metadata", async () => {
    await mapper.create({
      id: "conv_imported",
      userId: "usr_test",
      title: "Imported thread",
      status: "archived",
      importedAt: "2026-04-08T12:00:00.000Z",
      importSourceConversationId: "conv_source",
      importedFromExportedAt: "2026-04-08T11:00:00.000Z",
    });

    const found = requireValue(await mapper.findById("conv_imported"));
    expect(found.importedAt).toBe("2026-04-08T12:00:00.000Z");
    expect(found.importSourceConversationId).toBe("conv_source");
    expect(found.importedFromExportedAt).toBe("2026-04-08T11:00:00.000Z");
  });

  it("replaces stale debug referral_source values when canonical attribution is attached", async () => {
    await mapper.create({
      id: "conv_stale_ref",
      userId: "usr_test",
      title: "Referral",
      referralSource: "raw-unvalidated-code",
    });

    await mapper.setReferralAttribution("conv_stale_ref", "ref_1", "mentor-42");

    const found = requireValue(await mapper.findById("conv_stale_ref"));
    expect(found.referralId).toBe("ref_1");
    expect(found.referralSource).toBe("mentor-42");
  });

  it("listByUser returns summaries with messageCount ordered by updated_at desc", async () => {
    await mapper.create({ id: "conv_a", userId: "usr_test", title: "First" });
    await mapper.create({ id: "conv_b", userId: "usr_test", title: "Second" });

    // Add messages to conv_a and increment denormalized count
    const msgMapper = new MessageDataMapper(db);
    await msgMapper.create({ conversationId: "conv_a", role: "user", content: "hi", parts: [] });
    await mapper.incrementMessageCount("conv_a");
    await msgMapper.create({ conversationId: "conv_a", role: "assistant", content: "hello", parts: [] });
    await mapper.incrementMessageCount("conv_a");

    // Manually set updated_at so ordering is deterministic (datetime('now') may be same second)
    db.prepare(`UPDATE conversations SET updated_at = '2099-01-01 00:00:00' WHERE id = 'conv_a'`).run();

    const list = await mapper.listByUser("usr_test");
    expect(list.length).toBe(2);
    // conv_a has later updated_at → should be first
    expect(list[0].id).toBe("conv_a");
    expect(list[0].messageCount).toBe(2);
    expect(list[1].id).toBe("conv_b");
    expect(list[1].messageCount).toBe(0);
  });

  it("listByUser excludes soft-deleted conversations by default", async () => {
    await mapper.create({ id: "conv_visible", userId: "usr_test", title: "Visible" });
    await mapper.create({ id: "conv_deleted", userId: "usr_test", title: "Deleted" });

    await mapper.softDelete(
      "conv_deleted",
      { userId: "usr_test", role: "AUTHENTICATED", reason: "user_removed" },
      { purgeAfter: "2026-05-01T00:00:00.000Z" },
    );

    const list = await mapper.listByUser("usr_test");
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("conv_visible");
  });

  it("listByUser can return only deleted conversations", async () => {
    await mapper.create({ id: "conv_visible", userId: "usr_test", title: "Visible" });
    await mapper.create({ id: "conv_deleted", userId: "usr_test", title: "Deleted" });

    await mapper.softDelete(
      "conv_deleted",
      { userId: "usr_test", role: "AUTHENTICATED", reason: "user_removed" },
      { purgeAfter: "2026-05-01T00:00:00.000Z" },
    );

    const list = await mapper.listByUser("usr_test", { scope: "deleted" });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("conv_deleted");
    expect(list[0].deletedAt).toBeTruthy();
    expect(list[0].purgeAfter).toBe("2026-05-01T00:00:00.000Z");
  });

  it("delete removes conversation", async () => {
    await mapper.create({ id: "conv_del", userId: "usr_test", title: "Delete me" });
    await mapper.delete("conv_del");
    const found = await mapper.findById("conv_del");
    expect(found).toBeNull();
  });

  it("delete cascades to messages", async () => {
    await mapper.create({ id: "conv_cas", userId: "usr_test", title: "Cascade" });
    const msgMapper = new MessageDataMapper(db);
    await msgMapper.create({ conversationId: "conv_cas", role: "user", content: "test", parts: [] });
    expect(await msgMapper.countByConversation("conv_cas")).toBe(1);

    await mapper.delete("conv_cas");
    expect(await msgMapper.countByConversation("conv_cas")).toBe(0);
  });

  it("softDelete marks the conversation as deleted without cascading messages", async () => {
    await mapper.create({ id: "conv_soft", userId: "usr_test", title: "Soft delete" });
    const msgMapper = new MessageDataMapper(db);
    await msgMapper.create({ conversationId: "conv_soft", role: "user", content: "test", parts: [] });

    await mapper.softDelete(
      "conv_soft",
      { userId: "usr_test", role: "AUTHENTICATED", reason: "user_removed" },
      { purgeAfter: "2026-05-01T00:00:00.000Z" },
    );

    const found = requireValue(await mapper.findById("conv_soft"));
    expect(found.deletedAt).toBeTruthy();
    expect(found.deleteReason).toBe("user_removed");
    expect(found.purgeAfter).toBe("2026-05-01T00:00:00.000Z");
    expect(found.status).toBe("archived");
    expect(await msgMapper.countByConversation("conv_soft")).toBe(1);
  });

  it("restoreDeleted clears tombstone metadata and keeps the conversation archived", async () => {
    await mapper.create({ id: "conv_restore", userId: "usr_test", title: "Restore me" });
    await mapper.softDelete(
      "conv_restore",
      { userId: "usr_test", role: "AUTHENTICATED", reason: "user_removed" },
      { purgeAfter: "2026-05-01T00:00:00.000Z" },
    );

    await mapper.restoreDeleted("conv_restore", "usr_test");

    const found = requireValue(await mapper.findById("conv_restore"));
    expect(found.deletedAt).toBeUndefined();
    expect(found.deleteReason).toBeUndefined();
    expect(found.purgeAfter).toBeUndefined();
    expect(found.status).toBe("archived");
    expect(found.restoredAt).toBeTruthy();
  });

  it("purge removes the conversation and preserves a minimal audit record", async () => {
    await mapper.create({ id: "conv_purge", userId: "usr_test", title: "Purge me", status: "archived" });
    const msgMapper = new MessageDataMapper(db);
    await msgMapper.create({ conversationId: "conv_purge", role: "user", content: "test", parts: [] });
    await mapper.softDelete(
      "conv_purge",
      { userId: "usr_test", role: "AUTHENTICATED", reason: "user_removed" },
      { purgeAfter: "2026-05-01T00:00:00.000Z" },
    );

    await mapper.purge("conv_purge", { userId: "admin_1", role: "SYSTEM", reason: "retention_policy" });

    expect(await mapper.findById("conv_purge")).toBeNull();
    expect(await msgMapper.countByConversation("conv_purge")).toBe(0);

    const auditRow = db
      .prepare(`SELECT purge_reason, metadata_json FROM conversation_purge_audits WHERE conversation_id = ?`)
      .get("conv_purge") as { purge_reason: string; metadata_json: string };

    expect(auditRow.purge_reason).toBe("retention_policy");
    expect(JSON.parse(auditRow.metadata_json)).toEqual(
      expect.objectContaining({
        title: "Purge me",
        userId: "usr_test",
        deleteReason: "user_removed",
      }),
    );
  });

  it("privacy purge deletes conversation-attached files and cascades canonical continuity records", async () => {
    await mapper.create({ id: "conv_privacy", userId: "usr_test", title: "Privacy purge", status: "archived" });
    db.prepare(
      `INSERT INTO messages (id, conversation_id, role, content, parts, token_estimate, created_at)
       VALUES ('msg_privacy', 'conv_privacy', 'user', 'purge this', '[]', 2, '2026-04-30T10:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO user_files (id, user_id, conversation_id, content_hash, file_type, status, file_name, mime_type, file_size, metadata_json)
       VALUES ('uf_privacy', 'usr_test', 'conv_privacy', 'hash_privacy', 'image', 'ready', 'privacy.png', 'image/png', 100, '{}')`,
    ).run();
    db.prepare(
      `INSERT INTO relationship_memory_records (id, user_id, conversation_id, memory_type, summary, evidence_refs_json, status, confidence, created_at, updated_at)
       VALUES ('mem_privacy', 'usr_test', 'conv_privacy', 'goal', 'Private memory', '[]', 'active', 0.9, '2026-04-30T10:00:00.000Z', '2026-04-30T10:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO prompt_provenance_records (
         id, conversation_id, user_message_id, assistant_message_id, surface, effective_hash,
         slot_refs_json, sections_json, warnings_json, replay_context_json, recorded_at
       ) VALUES (
         'pprov_privacy', 'conv_privacy', 'msg_privacy', NULL, 'chat_stream', 'hash_prompt',
         '[]', '[]', '[]', '{}', '2026-04-30T10:00:00.000Z'
       )`,
    ).run();
    db.prepare(
      `INSERT INTO prompt_bindings (
         id, user_id, conversation_id, surface, target_kind, target_id, effective_hash,
         slot_refs_json, overlay_refs_json, decision_source_refs_json, evidence_refs_json, created_at
       ) VALUES (
         'pb_privacy', 'usr_test', 'conv_privacy', 'chat_stream', 'message', 'msg_privacy', 'hash_binding',
         '[]', '[]', '[]', '[]', '2026-04-30T10:00:00.000Z'
       )`,
    ).run();
    db.prepare(
      `INSERT INTO materialization_records (
         id, user_id, conversation_id, materialization_key, tool_name, pipeline_version, status, reuse_policy,
         input_source_refs_json, output_refs_json, evidence_refs_json, produced_by_job_id, superseded_by_record_id,
         created_at, updated_at
       ) VALUES (
         'mat_privacy', 'usr_test', 'conv_privacy', 'compose_media:key_privacy', 'compose_media', 'v1',
         'ready', 'same_conversation', '[]', '[]', '[]', NULL, NULL,
         '2026-04-30T10:00:00.000Z', '2026-04-30T10:00:00.000Z'
       )`,
    ).run();
    db.prepare(
      `INSERT INTO identity_migration_events (
         id, source_user_id, target_user_id, migrated_conversation_ids_json, status, current_stage, created_at
       ) VALUES (
         'idmig_privacy', 'usr_test', 'usr_test', '["conv_privacy"]', 'completed', 'completed', '2026-04-30T10:00:00.000Z'
       )`,
    ).run();

    await mapper.purge("conv_privacy", { userId: "admin_1", role: "ADMIN", reason: "privacy_request" });

    expect(await mapper.findById("conv_privacy")).toBeNull();
    expect(db.prepare(`SELECT COUNT(*) AS total FROM user_files WHERE id = 'uf_privacy'`).get()).toEqual({ total: 0 });
    expect(db.prepare(`SELECT COUNT(*) AS total FROM messages WHERE conversation_id = 'conv_privacy'`).get()).toEqual({ total: 0 });
    expect(db.prepare(`SELECT COUNT(*) AS total FROM relationship_memory_records WHERE conversation_id = 'conv_privacy'`).get()).toEqual({ total: 0 });
    expect(db.prepare(`SELECT COUNT(*) AS total FROM prompt_provenance_records WHERE conversation_id = 'conv_privacy'`).get()).toEqual({ total: 0 });
    expect(db.prepare(`SELECT COUNT(*) AS total FROM prompt_bindings WHERE conversation_id = 'conv_privacy'`).get()).toEqual({ total: 0 });
    expect(db.prepare(`SELECT COUNT(*) AS total FROM materialization_records WHERE conversation_id = 'conv_privacy'`).get()).toEqual({ total: 0 });
    expect(db.prepare(`SELECT COUNT(*) AS total FROM identity_migration_events WHERE id = 'idmig_privacy'`).get()).toEqual({ total: 1 });

    const auditRow = db
      .prepare(`SELECT purge_reason, metadata_json FROM conversation_purge_audits WHERE conversation_id = ?`)
      .get("conv_privacy") as { purge_reason: string; metadata_json: string };
    expect(auditRow.purge_reason).toBe("privacy_request");
    expect(JSON.parse(auditRow.metadata_json)).toEqual(
      expect.objectContaining({
        conversationFilePolicy: "deleted",
        conversationFileCount: 1,
      }),
    );
  });

  it("lists purge-eligible conversations by purge_after", async () => {
    await mapper.create({ id: "conv_keep", userId: "usr_test", title: "Keep" });
    await mapper.create({ id: "conv_due", userId: "usr_test", title: "Due" });

    await mapper.softDelete(
      "conv_due",
      { userId: "usr_test", role: "AUTHENTICATED", reason: "user_removed" },
      { purgeAfter: "2026-04-01T00:00:00.000Z" },
    );

    const eligible = await mapper.listPurgeEligible("2026-04-08T00:00:00.000Z");
    expect(eligible.map((conversation) => conversation.id)).toEqual(["conv_due"]);
  });

  it("lists anonymous conversations ordered by recent activity within each owner", async () => {
    db.prepare(
      `INSERT OR IGNORE INTO users (id, email, name) VALUES ('anon_alpha', 'anon_alpha@anonymous.local', 'Anonymous')`,
    ).run();
    db.prepare(
      `INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('anon_alpha', 'role_anonymous')`,
    ).run();
    await mapper.create({ id: "conv_old", userId: "anon_alpha", title: "Old" });
    await mapper.create({ id: "conv_new", userId: "anon_alpha", title: "New" });
    db.prepare(`UPDATE conversations SET updated_at = '2026-04-01T00:00:00.000Z' WHERE id = 'conv_old'`).run();
    db.prepare(`UPDATE conversations SET updated_at = '2026-04-08T00:00:00.000Z' WHERE id = 'conv_new'`).run();

    const conversations = await mapper.listAnonymousConversations();
    expect(conversations.map((conversation) => conversation.id).slice(0, 2)).toEqual(["conv_new", "conv_old"]);
  });

  it("updateTitle changes title", async () => {
    await mapper.create({ id: "conv_t", userId: "usr_test", title: "" });
    await mapper.updateTitle("conv_t", "New Title");
    const found = requireValue(await mapper.findById("conv_t"));
    expect(found.title).toBe("New Title");
  });

  it("findById returns null for nonexistent", async () => {
    const found = await mapper.findById("nonexistent");
    expect(found).toBeNull();
  });

  it("findActiveByUser returns the active conversation", async () => {
    await mapper.create({ id: "conv_active", userId: "usr_test", title: "Active" });
    await mapper.create({ id: "conv_archived", userId: "usr_test", title: "Archived", status: "archived" });

    const active = requireValue(await mapper.findActiveByUser("usr_test"));
    expect(active.id).toBe("conv_active");
    expect(active.status).toBe("active");
  });

  it("findActiveByUser returns null when no active conversation", async () => {
    await mapper.create({ id: "conv_arch", userId: "usr_test", title: "Archived", status: "archived" });
    const active = await mapper.findActiveByUser("usr_test");
    expect(active).toBeNull();
  });

  it("archiveByUser sets active conversations to archived", async () => {
    await mapper.create({ id: "conv_1", userId: "usr_test", title: "Active" });
    await mapper.archiveByUser("usr_test");

    const found = requireValue(await mapper.findById("conv_1"));
    expect(found.status).toBe("archived");
  });

  it("transferOwnership moves conversations and returns affected IDs", async () => {
    // Seed a second "anonymous" user so FK doesn't complain
    await mapper.create({ id: "conv_anon", userId: "usr_test", title: "Anon Chat" });
    // Transfer from usr_test to usr_test (same user for simplicity — logic is the same)
    db.prepare(`INSERT OR IGNORE INTO users (id, email, name) VALUES ('usr_new', 'new@test.com', 'New')`).run();
    const ids = await mapper.transferOwnership("usr_test", "usr_new");
    expect(ids).toEqual(["conv_anon"]);

    const found = requireValue(await mapper.findById("conv_anon"));
    expect(found.userId).toBe("usr_new");
    expect(found.convertedFrom).toBe("usr_test");
  });

  it("updateRoutingSnapshot round-trips lane state", async () => {
    await mapper.create({ id: "conv_lane", userId: "usr_test", title: "Lane test" });

    await mapper.updateRoutingSnapshot(
      "conv_lane",
      createConversationRoutingSnapshot({
        lane: "individual",
        confidence: 0.72,
        recommendedNextStep: "Recommend operator training",
        detectedNeedSummary: "Solo operator needs guided implementation.",
        lastAnalyzedAt: "2026-03-18T15:00:00.000Z",
      }),
    );

    const found = requireValue(await mapper.findById("conv_lane"));
    expect(found.routingSnapshot).toEqual(
      createConversationRoutingSnapshot({
        lane: "individual",
        confidence: 0.72,
        recommendedNextStep: "Recommend operator training",
        detectedNeedSummary: "Solo operator needs guided implementation.",
        lastAnalyzedAt: "2026-03-18T15:00:00.000Z",
      }),
    );
  });

  it("records user append metadata and message_sent event in one transaction", async () => {
    await mapper.create({ id: "conv_evt_tx", userId: "usr_test", title: "Tx" });

    await mapper.recordUserMessageAppendedWithEvent(
      "conv_evt_tx",
      "2026-03-23T23:00:00.000Z",
      { role: "user", token_estimate: 12 },
    );

    const conversation = requireValue(await mapper.findById("conv_evt_tx"));
    expect(conversation.messageCount).toBe(1);
    expect(conversation.firstMessageAt).toBe("2026-03-23T23:00:00.000Z");

    const eventRow = db
      .prepare(`SELECT event_type, metadata FROM conversation_events WHERE conversation_id = ?`)
      .get("conv_evt_tx") as { event_type: string; metadata: string };

    expect(eventRow.event_type).toBe("message_sent");
    expect(JSON.parse(eventRow.metadata)).toEqual({ role: "user", token_estimate: 12 });
  });
});

describe("MessageDataMapper", () => {
  let db: Database.Database;
  let mapper: MessageDataMapper;

  beforeEach(() => {
    db = createDb();
    seedUser(db);
    // Create a conversation for messages
    const convMapper = new ConversationDataMapper(db);
    convMapper.create({ id: "conv_msg", userId: "usr_test", title: "Test" });
    mapper = new MessageDataMapper(db);
  });

  it("create → listByConversation lifecycle", async () => {
    const msg = await mapper.create({
      conversationId: "conv_msg",
      role: "user",
      content: "Hello world",
      parts: [{ type: "text", text: "Hello world" }],
    });
    expect(msg.id).toMatch(/^msg_/);
    expect(msg.content).toBe("Hello world");
    expect(msg.parts).toEqual([{ type: "text", text: "Hello world" }]);
    expect(msg.createdAt).toBeTruthy();

    const list = await mapper.listByConversation("conv_msg");
    expect(list.length).toBe(1);
    expect(list[0].content).toBe("Hello world");
    expect(list[0].createdAt).toBe(msg.createdAt);
  });

  it("parts JSON round-trip with tool_call and tool_result", async () => {
    const parts = [
      { type: "text" as const, text: "Let me search" },
      { type: "tool_call" as const, name: "search_corpus", args: { query: "design" } },
      { type: "tool_result" as const, name: "search_corpus", result: [{ title: "Design Book" }] },
      { type: "text" as const, text: "I found it" },
    ];

    await mapper.create({
      conversationId: "conv_msg",
      role: "assistant",
      content: "Let me search I found it",
      parts,
    });

    const list = await mapper.listByConversation("conv_msg");
    expect(list[0].parts).toEqual(parts);
  });

  it("listByConversation is ordered by created_at ASC", async () => {
    await mapper.create({ conversationId: "conv_msg", role: "user", content: "first", parts: [] });
    await mapper.create({ conversationId: "conv_msg", role: "assistant", content: "second", parts: [] });
    await mapper.create({ conversationId: "conv_msg", role: "user", content: "third", parts: [] });

    const list = await mapper.listByConversation("conv_msg");
    expect(list.map((m) => m.content)).toEqual(["first", "second", "third"]);
  });

  it("countByConversation returns correct count", async () => {
    expect(await mapper.countByConversation("conv_msg")).toBe(0);
    await mapper.create({ conversationId: "conv_msg", role: "user", content: "a", parts: [] });
    await mapper.create({ conversationId: "conv_msg", role: "assistant", content: "b", parts: [] });
    expect(await mapper.countByConversation("conv_msg")).toBe(2);
  });

  it("createWithinConversationLimit inserts only while the conversation is below the limit", async () => {
    const first = await mapper.createWithinConversationLimit(
      { conversationId: "conv_msg", role: "user", content: "a", parts: [] },
      1,
    );
    const second = await mapper.createWithinConversationLimit(
      { conversationId: "conv_msg", role: "assistant", content: "b", parts: [] },
      1,
    );

    expect(first).toBeTruthy();
    expect(second).toBeNull();
    expect(await mapper.countByConversation("conv_msg")).toBe(1);
  });

  it("updates content and parts for an existing message", async () => {
    const created = await mapper.create({
      conversationId: "conv_msg",
      role: "assistant",
      content: "",
      parts: [{ type: "job_status", jobId: "job_1", toolName: "draft_content", label: "Draft Content", status: "queued" }],
    });

    const updated = await mapper.update(created.id, {
      content: "",
      parts: [{
        type: "job_status",
        jobId: "job_1",
        toolName: "draft_content",
        label: "Draft Content",
        status: "succeeded",
        summary: "Draft is ready.",
      }],
    });

    expect(updated.parts).toEqual([{
      type: "job_status",
      jobId: "job_1",
      toolName: "draft_content",
      label: "Draft Content",
      status: "succeeded",
      summary: "Draft is ready.",
    }]);
  });
});
