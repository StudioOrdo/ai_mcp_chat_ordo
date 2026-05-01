import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { BlogPostDataMapper } from "@/adapters/BlogPostDataMapper";
import { JobQueueDataMapper } from "@/adapters/JobQueueDataMapper";
import { MessageDataMapper } from "@/adapters/MessageDataMapper";
import { executeDraftContent, parseDraftContentInput } from "@/core/use-cases/tools/admin-content.tool";
import { ensureSchema } from "@/lib/db/schema";
import { DeferredJobWorker } from "@/lib/jobs/deferred-job-worker";

function createDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedConversation(db: Database.Database) {
  db.prepare(`INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)`)
    .run("usr_admin", "admin@example.com", "Admin");
  db.prepare(
    `INSERT INTO conversations (id, user_id, title, status, session_source)
     VALUES (?, ?, 'Blog queue', 'active', 'authenticated')`,
  ).run("conv_blog", "usr_admin");
}

describe("deferred blog job flow", () => {
  let db: Database.Database;
  let jobRepo: JobQueueDataMapper;
  let messageRepo: MessageDataMapper;
  let blogRepo: BlogPostDataMapper;

  beforeEach(() => {
    db = createDb();
    seedConversation(db);
    jobRepo = new JobQueueDataMapper(db);
    messageRepo = new MessageDataMapper(db);
    blogRepo = new BlogPostDataMapper(db);
  });

  it("enqueues a blog draft job and completes it through the shared worker", async () => {
    const job = await jobRepo.createJob({
      conversationId: "conv_blog",
      userId: "usr_admin",
      toolName: "draft_content",
      requestPayload: {
        title: "Deferred Queue Post",
        content: "## Queue architecture\n\nThis post describes the deferred blog flow.",
      },
    });

    await jobRepo.appendEvent({
      jobId: job.id,
      conversationId: "conv_blog",
      eventType: "queued",
      payload: { toolName: "draft_content" },
    });

    const worker = new DeferredJobWorker(jobRepo, {
      draft_content: async (claimedJob) => executeDraftContent(
        blogRepo,
        parseDraftContentInput(claimedJob.requestPayload),
        {
          userId: claimedJob.userId ?? "unknown",
          role: "ADMIN",
          conversationId: claimedJob.conversationId,
        },
      ),
    });

    const result = await worker.runNext({
      workerId: "worker_blog",
      now: new Date("2026-03-25T03:00:00.000Z"),
    });

    expect(result.outcome).toBe("succeeded");

    const post = await blogRepo.findBySlug("deferred-queue-post");
    expect(post).toMatchObject({
      status: "draft",
      title: "Deferred Queue Post",
    });

    const messages = await messageRepo.listByConversation("conv_blog");
    expect(messages).toHaveLength(0);

    const events = await jobRepo.listConversationEvents("conv_blog");
    expect(events.map((event) => event.eventType)).toEqual(["queued", "started", "result"]);
  });
});
