import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationDataMapper } from "@/adapters/ConversationDataMapper";
import { ensureSchema } from "@/lib/db/schema";
import { JobQueueDataMapper } from "@/adapters/JobQueueDataMapper";
import { MessageDataMapper } from "@/adapters/MessageDataMapper";
import { DeferredJobWorker } from "@/lib/jobs/deferred-job-worker";
import { DeferredJobConversationProjector } from "@/lib/jobs/deferred-job-conversation-projector";

function createDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedConversation(db: Database.Database, userId = "usr_test", conversationId = "conv_jobs") {
  db.prepare(`INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)`)
    .run(userId, `${userId}@example.com`, userId);
  db.prepare(
    `INSERT INTO conversations (id, user_id, title, status, session_source)
     VALUES (?, ?, 'Jobs', 'active', 'authenticated')`,
  ).run(conversationId, userId);
}

describe("DeferredJobWorker", () => {
  let db: Database.Database;
  let repo: JobQueueDataMapper;
  let projector: DeferredJobConversationProjector;
  let messageRepo: MessageDataMapper;

  beforeEach(() => {
    db = createDb();
    seedConversation(db);
    repo = new JobQueueDataMapper(db);
    messageRepo = new MessageDataMapper(db);
    projector = new DeferredJobConversationProjector(
      new ConversationDataMapper(db),
      messageRepo,
    );
  });

  it("processes a queued job, emits started/progress/result events, and marks it succeeded", async () => {
    const job = await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "draft_content",
      requestPayload: { title: "Worker" },
    });

    const worker = new DeferredJobWorker(repo, {
      draft_content: async (claimedJob, { reportProgress }) => {
        expect(claimedJob.id).toBe(job.id);
        await reportProgress({ progressPercent: 50, progressLabel: "Drafting" });
        return { postId: "blog_123" };
      },
    }, projector);

    const result = await worker.runNext({
      workerId: "worker_1",
      now: new Date("2026-03-25T03:00:00.000Z"),
      leaseDurationMs: 60_000,
    });

    expect(result.outcome).toBe("succeeded");
    expect(result.result).toEqual({ postId: "blog_123" });

    const persisted = await repo.findJobById(job.id);
    expect(persisted?.status).toBe("succeeded");
    expect(persisted?.resultPayload).toEqual({ postId: "blog_123" });
    expect(persisted?.claimedBy).toBeNull();

    const events = await repo.listConversationEvents("conv_jobs");
    expect(events.map((event) => event.eventType)).toEqual(["started", "progress", "result"]);

    const messages = await messageRepo.listByConversation("conv_jobs");
    expect(messages).toHaveLength(1);
    expect(messages[0]?.parts).toEqual([
      expect.objectContaining({
        type: "job_status",
        jobId: job.id,
        status: "succeeded",
      }),
    ]);
  });

  it("renews the lease window when healthy progress is reported", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T03:00:00.000Z"));

    const job = await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "draft_content",
      requestPayload: { title: "Lease renewal" },
    });

    const worker = new DeferredJobWorker(repo, {
      draft_content: async (_claimedJob, { reportProgress }) => {
        vi.setSystemTime(new Date("2026-03-25T03:00:45.000Z"));
        await reportProgress({ progressPercent: 40, progressLabel: "Drafting" });
        return { postId: "blog_lease" };
      },
    }, projector);

    await worker.runNext({
      workerId: "worker_lease",
      now: new Date("2026-03-25T03:00:00.000Z"),
      leaseDurationMs: 30_000,
    });

    const events = await repo.listConversationEvents("conv_jobs");
    expect(events.map((event) => event.eventType)).toEqual(["started", "progress", "result"]);
    expect(events[0]?.payload).toMatchObject({ leaseExpiresAt: "2026-03-25T03:00:30.000Z" });

    const progressLease = (await repo.findJobById(job.id))?.updatedAt;
    expect(progressLease).toBeTruthy();

    vi.useRealTimers();
  });

  it("persists phased progress metadata while keeping compatibility fields populated", async () => {
    const job = await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "produce_blog_article",
      requestPayload: { brief: "Launch" },
    });

    const worker = new DeferredJobWorker(repo, {
      produce_blog_article: async (_claimedJob, { reportProgress }) => {
        await reportProgress({
          activePhaseKey: "qa_blog_article",
          phases: [
            { key: "compose_blog_article", label: "Composing article", status: "succeeded" },
            { key: "qa_blog_article", label: "Reviewing article", status: "active", percent: 60 },
            { key: "resolve_blog_article_qa", label: "Resolving QA findings", status: "pending" },
          ],
        });
        return { postId: "blog_123" };
      },
    }, projector);

    await worker.runNext({
      workerId: "worker_1",
      now: new Date("2026-03-25T03:00:00.000Z"),
      leaseDurationMs: 60_000,
    });

    const persisted = await repo.findJobById(job.id);
    expect(persisted).toMatchObject({
      progressLabel: "Reviewing article",
      progressPercent: 42,
    });

    const events = await repo.listConversationEvents("conv_jobs");
    expect(events[1]?.payload).toMatchObject({
      activePhaseKey: "qa_blog_article",
      progressLabel: "Reviewing article",
      progressPercent: 42,
      phases: expect.arrayContaining([
        expect.objectContaining({ key: "compose_blog_article", status: "succeeded" }),
        expect.objectContaining({ key: "qa_blog_article", status: "active", percent: 60 }),
      ]),
    });
  });

  it("requeues expired running jobs before claiming the next available queued job", async () => {
    const expired = await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "draft_content",
      requestPayload: { title: "Expired" },
    });
    await repo.updateJobStatus(expired.id, {
      status: "running",
      claimedBy: "worker_old",
      leaseExpiresAt: "2026-03-25T02:00:00.000Z",
      incrementAttemptCount: true,
    });

    const fresh = await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "generate_image",
      priority: 50,
      requestPayload: { prompt: "Fresh" },
    });

    const worker = new DeferredJobWorker(repo, {
      draft_content: async () => ({ ok: true }),
      generate_image: async () => ({ assetId: "asset_1" }),
    }, projector);

    const result = await worker.runNext({
      workerId: "worker_new",
      now: new Date("2026-03-25T03:00:00.000Z"),
    });

    expect(result.reclaimedExpiredCount).toBe(1);
    expect(result.job?.id).toBe(fresh.id);

    const reclaimedExpired = await repo.findJobById(expired.id);
    expect(reclaimedExpired?.status).toBe("queued");
    expect(reclaimedExpired?.claimedBy).toBeNull();

    const reclaimedFresh = await repo.findJobById(fresh.id);
    expect(reclaimedFresh?.status).toBe("succeeded");
  });

  it("recovers an expired claimed publish job after a worker restart and completes it", async () => {
    const expired = await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "publish_content",
      requestPayload: { post_id: "post_123" },
    });
    await repo.updateJobStatus(expired.id, {
      status: "running",
      claimedBy: "worker_crashed",
      leaseExpiresAt: "2026-03-25T02:00:00.000Z",
      incrementAttemptCount: true,
    });

    const worker = new DeferredJobWorker(repo, {
      publish_content: async () => ({
        id: "post_123",
        slug: "queued-publish-post",
        title: "Queued Publish Post",
        status: "published",
        publishedAt: "2026-03-25T03:00:02.000Z",
      }),
    }, projector);

    const result = await worker.runNext({
      workerId: "worker_restarted",
      now: new Date("2026-03-25T03:00:00.000Z"),
    });

    expect(result.outcome).toBe("succeeded");
    expect(result.reclaimedExpiredCount).toBe(1);
    expect(result.job?.id).toBe(expired.id);

    const persisted = await repo.findJobById(expired.id);
    expect(persisted?.status).toBe("succeeded");
    expect(persisted?.attemptCount).toBe(2);
    expect(persisted?.claimedBy).toBeNull();

    const events = await repo.listConversationEvents("conv_jobs");
    expect(events.map((event) => event.eventType)).toEqual(["lease_recovered", "started", "result"]);

    const messages = await messageRepo.listByConversation("conv_jobs");
    expect(messages).toHaveLength(1);
    expect(messages[0]?.parts).toEqual([
      expect.objectContaining({
        type: "job_status",
        jobId: expired.id,
        status: "succeeded",
      }),
    ]);
  });

  it("marks the job failed when no handler is registered", async () => {
    const job = await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "missing_handler",
      requestPayload: {},
    });

    const worker = new DeferredJobWorker(repo, {}, projector);
    const result = await worker.runNext({ workerId: "worker_1" });

    expect(result.outcome).toBe("failed");
    expect(result.errorMessage).toContain("No deferred job handler");

    const persisted = await repo.findJobById(job.id);
    expect(persisted?.status).toBe("failed");
  });

  it("marks the job failed when the handler throws", async () => {
    const job = await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "produce_blog_article",
      requestPayload: {},
    });

    const worker = new DeferredJobWorker(repo, {
      produce_blog_article: vi.fn(async () => {
        throw new Error("provider offline");
      }),
    }, projector);

    const result = await worker.runNext({ workerId: "worker_1" });

    expect(result.outcome).toBe("failed");
    expect(result.errorMessage).toBe("provider offline");

    const persisted = await repo.findJobById(job.id);
    expect(persisted?.status).toBe("failed");

    const events = await repo.listConversationEvents("conv_jobs");
    expect(events.at(-1)?.eventType).toBe("failed");
  });

  it("schedules an automatic retry for transient editorial failures", async () => {
    const job = await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "publish_content",
      requestPayload: { post_id: "post_1" },
    });

    const worker = new DeferredJobWorker(repo, {
      publish_content: vi.fn(async () => {
        throw new Error("provider timeout");
      }),
    }, projector);

    const result = await worker.runNext({
      workerId: "worker_retry",
      now: new Date("2026-03-25T03:00:00.000Z"),
    });

    expect(result.outcome).toBe("scheduled_retry");
    expect(result.errorMessage).toBe("provider timeout");

    const persisted = await repo.findJobById(job.id);
    expect(persisted).toMatchObject({
      id: job.id,
      status: "queued",
      failureClass: "transient",
      nextRetryAt: "2026-03-25T03:00:03.000Z",
      attemptCount: 1,
      claimedBy: null,
    });

    const events = await repo.listConversationEvents("conv_jobs");
    expect(events.map((event) => event.eventType)).toEqual(["started", "retry_scheduled"]);
    expect(events[1]?.payload).toMatchObject({
      failureClass: "transient",
      nextRetryAt: "2026-03-25T03:00:03.000Z",
      maxAttempts: 3,
    });
  });

  it("schedules an automatic retry for SQLite lock contention", async () => {
    const job = await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "compose_media",
      requestPayload: { plan: { id: "plan_locked" } },
    });

    const worker = new DeferredJobWorker(repo, {
      compose_media: vi.fn(async () => {
        throw new Error("database is locked");
      }),
    }, projector);

    const result = await worker.runNext({
      workerId: "worker_lock_retry",
      now: new Date("2026-04-27T03:20:39.000Z"),
    });

    expect(result.outcome).toBe("scheduled_retry");
    expect(result.errorMessage).toBe("database is locked");

    const persisted = await repo.findJobById(job.id);
    expect(persisted).toMatchObject({
      id: job.id,
      status: "queued",
      failureClass: "transient",
      attemptCount: 1,
      claimedBy: null,
    });
    expect(persisted?.nextRetryAt).not.toBeNull();

    const events = await repo.listConversationEvents("conv_jobs");
    expect(events.map((event) => event.eventType)).toEqual(["started", "retry_scheduled"]);
    expect(events[1]?.payload).toMatchObject({
      errorMessage: "database is locked",
      failureClass: "transient",
    });
  });

  it("fails with exhaustion metadata after automatic retries are spent", async () => {
    const job = await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "publish_content",
      requestPayload: { post_id: "post_1" },
    });
    await repo.updateJobStatus(job.id, { status: "queued", incrementAttemptCount: true });
    await repo.updateJobStatus(job.id, { status: "queued", incrementAttemptCount: true });

    const worker = new DeferredJobWorker(repo, {
      publish_content: vi.fn(async () => {
        throw new Error("temporary upstream failure");
      }),
    }, projector);

    const result = await worker.runNext({
      workerId: "worker_exhausted",
      now: new Date("2026-03-25T03:00:00.000Z"),
    });

    expect(result.outcome).toBe("failed");

    const persisted = await repo.findJobById(job.id);
    expect(persisted).toMatchObject({
      id: job.id,
      status: "failed",
      failureClass: "transient",
      nextRetryAt: null,
      attemptCount: 3,
    });

    const events = await repo.listConversationEvents("conv_jobs");
    expect(events.map((event) => event.eventType)).toEqual(["started", "failed", "retry_exhausted"]);
    expect(events[2]?.payload).toMatchObject({
      failureClass: "transient",
      attemptCount: 3,
      maxAttempts: 3,
    });
  });

  it("waits until the scheduled retry time before claiming the queued job again", async () => {
    const delayedJob = await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "publish_content",
      nextRetryAt: "2026-03-25T03:00:05.000Z",
      requestPayload: { post_id: "post_delayed" },
    });
    const readyJob = await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "generate_image",
      requestPayload: { prompt: "Ready now" },
    });

    const worker = new DeferredJobWorker(repo, {
      publish_content: async () => ({ ok: "delayed" }),
      generate_image: async () => ({ ok: "ready" }),
    }, projector);

    const firstResult = await worker.runNext({
      workerId: "worker_schedule",
      now: new Date("2026-03-25T03:00:00.000Z"),
    });
    expect(firstResult.job?.id).toBe(readyJob.id);

    const secondResult = await worker.runNext({
      workerId: "worker_schedule",
      now: new Date("2026-03-25T03:00:06.000Z"),
    });
    expect(secondResult.job?.id).toBe(delayedJob.id);
  });

  it("returns idle when no queued jobs are available", async () => {
    const worker = new DeferredJobWorker(repo, {}, projector);
    const result = await worker.runNext({ workerId: "worker_1" });

    expect(result.outcome).toBe("idle");
    expect(result.job).toBeNull();
  });

  it("does not overwrite a canceled running job with a late success result", async () => {
    const job = await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "draft_content",
      requestPayload: {},
    });

    const worker = new DeferredJobWorker(repo, {
      draft_content: async () => {
        await repo.cancelJob(job.id, "2026-03-25T03:00:01.000Z");
        return { postId: "blog_123" };
      },
    }, projector);

    const result = await worker.runNext({ workerId: "worker_1" });

    expect(result.outcome).toBe("canceled");

    const persisted = await repo.findJobById(job.id);
    expect(persisted?.status).toBe("canceled");
    expect(persisted?.resultPayload).toBeNull();
  });

  it("aborts a running handler when the job is canceled mid-flight", async () => {
    const job = await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "produce_blog_article",
      requestPayload: {},
    });

    let handlerSignal: AbortSignal | null = null;

    const worker = new DeferredJobWorker(repo, {
      produce_blog_article: async (_claimedJob, { abortSignal }) => {
        handlerSignal = abortSignal;

        await new Promise<void>((resolve, reject) => {
          abortSignal.addEventListener("abort", () => {
            const error = new Error("deferred_job_canceled");
            error.name = "AbortError";
            reject(error);
          }, { once: true });

          setTimeout(resolve, 2_000);
        });

        return { postId: "blog_123" };
      },
    }, projector);

    const run = worker.runNext({ workerId: "worker_cancel" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await repo.cancelJob(job.id, "2026-03-25T03:00:01.000Z");

    const result = await run;

    expect((handlerSignal as AbortSignal | null)?.aborted).toBe(true);
    expect(result.outcome).toBe("canceled");

    const persisted = await repo.findJobById(job.id);
    expect(persisted?.status).toBe("canceled");
  });

  it("appends notification_sent after terminal delivery succeeds", async () => {
    await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "draft_content",
      requestPayload: { title: "Worker" },
    });

    const worker = new DeferredJobWorker(
      repo,
      {
        draft_content: async () => ({ postId: "blog_123" }),
      },
      projector,
      {
        notify: vi.fn(async () => ({
          status: "sent" as const,
          attemptedCount: 1,
          deliveredCount: 1,
          failedCount: 0,
        })),
      },
    );

    const result = await worker.runNext({ workerId: "worker_1" });

    expect(result.outcome).toBe("succeeded");

    const events = await repo.listConversationEvents("conv_jobs");
    expect(events.map((event) => event.eventType)).toEqual(["started", "result", "notification_sent"]);
    expect(events.at(-1)?.payload).toMatchObject({
      terminalEventType: "result",
      deliveredCount: 1,
      failedCount: 0,
    });
  });

  it("appends notification_failed after a terminal notification delivery attempt fails", async () => {
    await repo.createJob({
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "draft_content",
      requestPayload: { title: "Worker" },
    });

    const worker = new DeferredJobWorker(
      repo,
      {
        draft_content: async () => ({ postId: "blog_123" }),
      },
      projector,
      {
        notify: vi.fn(async () => ({
          status: "failed" as const,
          reason: "delivery_error" as const,
          attemptedCount: 2,
          failedCount: 2,
          lastErrorMessage: "push endpoint unavailable",
          lastErrorStatusCode: 503,
        })),
      },
    );

    const result = await worker.runNext({ workerId: "worker_1" });

    expect(result.outcome).toBe("succeeded");

    const events = await repo.listConversationEvents("conv_jobs");
    expect(events.map((event) => event.eventType)).toEqual(["started", "result", "notification_failed"]);
    expect(events.at(-1)?.payload).toMatchObject({
      terminalEventType: "result",
      attemptedCount: 2,
      failedCount: 2,
      reason: "delivery_error",
      errorMessage: "push endpoint unavailable",
      statusCode: 503,
    });
  });
});