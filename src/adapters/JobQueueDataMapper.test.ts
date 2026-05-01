import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { JobQueueDataMapper } from "@/adapters/JobQueueDataMapper";
import { ensureSchema } from "@/lib/db/schema";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedConversation(db: Database.Database): void {
  db.prepare(`INSERT INTO users (id, email, name) VALUES (?, ?, ?)`)
    .run("usr_origin", "origin@example.com", "Origin User");
  db.prepare(`
    INSERT INTO conversations (id, user_id, title, status, session_source)
    VALUES (?, ?, ?, ?, ?)
  `).run("conv_origin", "usr_origin", "Origin Conversation", "active", "authenticated");
}

describe("JobQueueDataMapper canonical job origin fields", () => {
  it("persists durable origin and tool invocation anchors on job creation", async () => {
    const db = createDb();
    seedConversation(db);
    const mapper = new JobQueueDataMapper(db);

    const created = await mapper.createJob({
      conversationId: "conv_origin",
      userId: "usr_origin",
      toolName: "generate_blog_image",
      requestPayload: { prompt: "A luminous library" },
      originMessageId: "msg_origin_1",
      originTurnId: "turn_origin_1",
      toolInvocationId: "toolu_origin_1",
    });

    const reloaded = await mapper.findJobById(created.id);

    expect(reloaded).toMatchObject({
      id: created.id,
      originMessageId: "msg_origin_1",
      originTurnId: "turn_origin_1",
      toolInvocationId: "toolu_origin_1",
    });
  });
});
