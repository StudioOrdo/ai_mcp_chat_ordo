import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { ensureSchema } from "../lib/db/schema";
import { MaterializationDataMapper } from "./MaterializationDataMapper";

function createDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedUser(db: Database.Database, id = "usr_test") {
  db.prepare(
    `INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, 'Test')`,
  ).run(id, `${id}@test.com`);
  db.prepare(
    `INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'role_authenticated')`,
  ).run(id);
}

function seedConversation(db: Database.Database, id = "conv_test", userId = "usr_test") {
  db.prepare(
    `INSERT OR IGNORE INTO conversations (id, user_id, title) VALUES (?, ?, 'Test Conv')`,
  ).run(id, userId);
}

describe("MaterializationDataMapper", () => {
  let db: Database.Database;
  let mapper: MaterializationDataMapper;

  beforeEach(() => {
    db = createDb();
    seedUser(db);
    seedConversation(db);
    mapper = new MaterializationDataMapper(db);
  });

  it("returns the newest reusable record for the same user", async () => {
    await mapper.upsert({
      id: "mat_old",
      userId: "usr_test",
      conversationId: "conv_test",
      materializationKey: "compose_media:key_1",
      toolName: "compose_media",
      pipelineVersion: "compose_media:v1",
      status: "ready",
      reusePolicy: "same_user",
      inputSourceRefs: [],
      outputRefs: [{ kind: "asset", id: "asset_old", userId: "usr_test", conversationId: "conv_test" }],
      evidenceRefs: [],
      producedByJobId: null,
      supersededByRecordId: null,
      createdAt: "2026-04-13T12:00:00.000Z",
      updatedAt: "2026-04-13T12:00:00.000Z",
    });
    await mapper.upsert({
      id: "mat_new",
      userId: "usr_test",
      conversationId: "conv_test",
      materializationKey: "compose_media:key_1",
      toolName: "compose_media",
      pipelineVersion: "compose_media:v1",
      status: "ready",
      reusePolicy: "same_user",
      inputSourceRefs: [],
      outputRefs: [{ kind: "asset", id: "asset_new", userId: "usr_test", conversationId: "conv_test" }],
      evidenceRefs: [],
      producedByJobId: null,
      supersededByRecordId: null,
      createdAt: "2026-04-13T12:01:00.000Z",
      updatedAt: "2026-04-13T12:01:00.000Z",
    });

    const reusable = await mapper.findReusableSuccess("compose_media:key_1", "usr_test", "conv_test");

    expect(reusable?.id).toBe("mat_new");
    expect(reusable?.producedByJobId).toBeNull();
  });

  it("does not reuse records outside the allowed scope", async () => {
    seedUser(db, "usr_other");
    seedConversation(db, "conv_other", "usr_other");

    await mapper.upsert({
      id: "mat_foreign",
      userId: "usr_other",
      conversationId: "conv_other",
      materializationKey: "compose_media:key_1",
      toolName: "compose_media",
      pipelineVersion: "compose_media:v1",
      status: "ready",
      reusePolicy: "same_user",
      inputSourceRefs: [],
      outputRefs: [{ kind: "asset", id: "asset_foreign", userId: "usr_other", conversationId: "conv_other" }],
      evidenceRefs: [],
      producedByJobId: null,
      supersededByRecordId: null,
      createdAt: "2026-04-13T12:00:00.000Z",
      updatedAt: "2026-04-13T12:00:00.000Z",
    });

    const reusable = await mapper.findReusableSuccess("compose_media:key_1", "usr_test", "conv_test");

    expect(reusable).toBeNull();
  });

  it("lists materializations scoped to a conversation in newest-first order", async () => {
    seedConversation(db, "conv_other");

    await mapper.upsert({
      id: "mat_conv_old",
      userId: "usr_test",
      conversationId: "conv_test",
      materializationKey: "compose_media:key_1",
      toolName: "compose_media",
      pipelineVersion: "compose_media:v1",
      status: "ready",
      reusePolicy: "same_user",
      inputSourceRefs: [],
      outputRefs: [{ kind: "asset", id: "asset_old", userId: "usr_test", conversationId: "conv_test" }],
      evidenceRefs: [],
      producedByJobId: null,
      supersededByRecordId: null,
      createdAt: "2026-04-13T12:00:00.000Z",
      updatedAt: "2026-04-13T12:00:00.000Z",
    });
    await mapper.upsert({
      id: "mat_conv_new",
      userId: "usr_test",
      conversationId: "conv_test",
      materializationKey: "compose_media:key_2",
      toolName: "compose_media",
      pipelineVersion: "compose_media:v1",
      status: "ready",
      reusePolicy: "same_user",
      inputSourceRefs: [],
      outputRefs: [{ kind: "asset", id: "asset_new", userId: "usr_test", conversationId: "conv_test" }],
      evidenceRefs: [],
      producedByJobId: null,
      supersededByRecordId: null,
      createdAt: "2026-04-13T12:01:00.000Z",
      updatedAt: "2026-04-13T12:01:00.000Z",
    });
    await mapper.upsert({
      id: "mat_other_conv",
      userId: "usr_test",
      conversationId: "conv_other",
      materializationKey: "compose_media:key_3",
      toolName: "compose_media",
      pipelineVersion: "compose_media:v1",
      status: "ready",
      reusePolicy: "same_user",
      inputSourceRefs: [],
      outputRefs: [{ kind: "asset", id: "asset_other", userId: "usr_test", conversationId: "conv_other" }],
      evidenceRefs: [],
      producedByJobId: null,
      supersededByRecordId: null,
      createdAt: "2026-04-13T12:02:00.000Z",
      updatedAt: "2026-04-13T12:02:00.000Z",
    });

    const records = await mapper.listByConversation("conv_test");

    expect(records.map((record) => record.id)).toEqual(["mat_conv_new", "mat_conv_old"]);
  });

  it("transfers materializations for migrated conversations, including anonymous records", async () => {
    seedUser(db, "anon_seed");
    await mapper.upsert({
      id: "mat_anon",
      userId: "anon_seed",
      conversationId: "conv_test",
      materializationKey: "compose_media:key_anon",
      toolName: "compose_media",
      pipelineVersion: "compose_media:v1",
      status: "ready",
      reusePolicy: "same_user",
      inputSourceRefs: [],
      outputRefs: [{ kind: "asset", id: "asset_anon", userId: "anon_seed", conversationId: "conv_test" }],
      evidenceRefs: [],
      producedByJobId: null,
      supersededByRecordId: null,
      createdAt: "2026-04-13T12:00:00.000Z",
      updatedAt: "2026-04-13T12:00:00.000Z",
    });
    await mapper.upsert({
      id: "mat_unowned",
      userId: null,
      conversationId: "conv_test",
      materializationKey: "compose_media:key_unowned",
      toolName: "compose_media",
      pipelineVersion: "compose_media:v1",
      status: "ready",
      reusePolicy: "same_conversation",
      inputSourceRefs: [],
      outputRefs: [{ kind: "asset", id: "asset_unowned", userId: null, conversationId: "conv_test" }],
      evidenceRefs: [],
      producedByJobId: null,
      supersededByRecordId: null,
      createdAt: "2026-04-13T12:01:00.000Z",
      updatedAt: "2026-04-13T12:01:00.000Z",
    });

    const transferred = await mapper.transferOwnershipForConversations({
      conversationIds: ["conv_test"],
      previousUserId: "anon_seed",
      userId: "usr_test",
      transferredAt: "2026-04-30T10:00:00.000Z",
    });

    expect(transferred.map((record) => [record.id, record.userId, record.updatedAt])).toEqual([
      ["mat_anon", "usr_test", "2026-04-30T10:00:00.000Z"],
      ["mat_unowned", "usr_test", "2026-04-30T10:00:00.000Z"],
    ]);
  });
});
