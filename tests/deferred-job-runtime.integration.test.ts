import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobQueueDataMapper } from "@/adapters/JobQueueDataMapper";
import { MessageDataMapper } from "@/adapters/MessageDataMapper";
import { ensureSchema } from "@/lib/db/schema";

function createDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedConversation(db: Database.Database, userId = "usr_test", conversationId = "conv_jobs") {
  db.prepare("INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)")
    .run(userId, `${userId}@example.com`, userId);
  db.prepare(
    `INSERT INTO conversations (id, user_id, title, status, session_source)
     VALUES (?, ?, 'Jobs', 'active', 'authenticated')`,
  ).run(conversationId, userId);
}

describe("runDeferredJobRuntime", () => {
  let db: Database.Database;
  let repo: JobQueueDataMapper;
  let messageRepo: MessageDataMapper;

  beforeEach(() => {
    vi.resetModules();
    db = createDb();
    seedConversation(db);
    repo = new JobQueueDataMapper(db);
    messageRepo = new MessageDataMapper(db);
  });

  it("processes a queued job through the runtime loop in single-pass mode", async () => {
    await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "draft_content",
      requestPayload: { title: "Runtime proof" },
    });

    vi.doMock("@/lib/jobs/deferred-job-handlers", () => ({
      createDeferredJobHandlers: () => ({
        draft_content: async (_claimedJob: unknown, { reportProgress }: { reportProgress: (update: Record<string, unknown>) => Promise<void> }) => {
          await reportProgress({ progressPercent: 50, progressLabel: "Drafting" });
          return { postId: "blog_runtime" };
        },
      }),
      getDeferredJobRepository: () => repo,
    }));
    vi.doMock("@/lib/jobs/deferred-job-notifications", () => ({
      createDeferredJobNotificationDispatcher: () => undefined,
    }));

    const { runDeferredJobRuntime } = await import("@/lib/jobs/deferred-job-runtime");
    const summary = await runDeferredJobRuntime({
      workerId: "worker_runtime",
      pollIntervalMs: 0,
      singlePass: true,
    });

    expect(summary).toMatchObject({
      iterations: 1,
      processedCount: 1,
      reclaimedExpiredCount: 0,
      lastResult: expect.objectContaining({ outcome: "succeeded" }),
    });

    const [job] = await repo.listJobsByConversation("conv_jobs");
    expect(job).toMatchObject({
      status: "succeeded",
      resultPayload: { postId: "blog_runtime" },
    });

    const events = await repo.listConversationEvents("conv_jobs");
    expect(events.map((event) => event.eventType)).toEqual(["started", "progress", "result"]);

    const messages = await messageRepo.listByConversation("conv_jobs");
    expect(messages).toHaveLength(0);
  });
});
