import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { ensureSchema } from "@/lib/db/schema";

import { RelationshipMemoryDataMapper } from "./RelationshipMemoryDataMapper";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedConversation(db: Database.Database): void {
  db.prepare(`INSERT OR IGNORE INTO roles (id, name) VALUES ('role_authenticated', 'authenticated')`).run();
  db.prepare(`INSERT OR IGNORE INTO users (id, email, name) VALUES ('usr_test', 'test@example.com', 'Test User')`).run();
  db.prepare(`INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('usr_test', 'role_authenticated')`).run();
  db.prepare(`INSERT OR IGNORE INTO conversations (id, user_id, title) VALUES ('conv_1', 'usr_test', 'Phase 6')`).run();
}

describe("RelationshipMemoryDataMapper", () => {
  let db: Database.Database;
  let mapper: RelationshipMemoryDataMapper;

  beforeEach(() => {
    db = createDb();
    seedConversation(db);
    mapper = new RelationshipMemoryDataMapper(db);
  });

  it("persists, reads, and supersedes relationship memory records", async () => {
    await mapper.upsert({
      id: "mem_goal_1",
      userId: "usr_test",
      conversationId: "conv_1",
      memoryType: "goal",
      summary: "Goal: launch the new offer",
      evidenceRefs: [],
      status: "active",
      confidence: 0.86,
      createdAt: "2026-04-29T10:00:00.000Z",
      updatedAt: "2026-04-29T10:00:00.000Z",
    });

    expect(await mapper.findById("mem_goal_1")).toEqual(
      expect.objectContaining({ summary: "Goal: launch the new offer", status: "active" }),
    );
    expect(await mapper.listActiveByConversation("conv_1")).toEqual([
      expect.objectContaining({ id: "mem_goal_1" }),
    ]);

    await mapper.upsert({
      id: "mem_goal_2",
      userId: "usr_test",
      conversationId: "conv_1",
      memoryType: "goal",
      summary: "Goal: launch the new offer this week",
      evidenceRefs: [],
      status: "active",
      confidence: 0.9,
      createdAt: "2026-04-29T10:05:00.000Z",
      updatedAt: "2026-04-29T10:05:00.000Z",
    });
    await mapper.markSuperseded("mem_goal_1", "mem_goal_2", "2026-04-29T10:05:00.000Z");

    const active = await mapper.listActiveByConversation("conv_1");
    expect(active).toEqual([
      expect.objectContaining({ id: "mem_goal_2", status: "active" }),
    ]);
    expect(await mapper.listActiveByUser("usr_test", { limit: 10 })).toEqual([
      expect.objectContaining({ id: "mem_goal_2" }),
    ]);
  });

  it("transfers relationship memory records to the signed-in owner", async () => {
    db.prepare(`INSERT OR IGNORE INTO users (id, email, name) VALUES ('anon_seed', 'anon@example.com', 'Anon')`).run();
    await mapper.upsert({
      id: "mem_anon",
      userId: "anon_seed",
      conversationId: "conv_1",
      memoryType: "preference",
      summary: "Prefers concise planning",
      evidenceRefs: [],
      status: "active",
      confidence: 0.8,
      createdAt: "2026-04-29T10:00:00.000Z",
      updatedAt: "2026-04-29T10:00:00.000Z",
    });

    const transferred = await mapper.transferOwnershipForConversations({
      conversationIds: ["conv_1"],
      previousUserId: "anon_seed",
      userId: "usr_test",
      transferredAt: "2026-04-30T10:00:00.000Z",
    });

    expect(transferred).toEqual([
      expect.objectContaining({
        id: "mem_anon",
        userId: "usr_test",
        updatedAt: "2026-04-30T10:00:00.000Z",
      }),
    ]);
  });
});
