import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { BlogPostDataMapper } from "@/adapters/BlogPostDataMapper";
import { BlogAssetDataMapper } from "@/adapters/BlogAssetDataMapper";
import { JobQueueDataMapper } from "@/adapters/JobQueueDataMapper";
import { MessageDataMapper } from "@/adapters/MessageDataMapper";
import { executePublishContent, parsePublishContentInput } from "@/core/use-cases/tools/admin-content.tool";
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
     VALUES (?, ?, 'Blog publish queue', 'active', 'authenticated')`,
  ).run("conv_publish", "usr_admin");
}

describe("deferred blog publish flow", () => {
  let db: Database.Database;
  let jobRepo: JobQueueDataMapper;
  let messageRepo: MessageDataMapper;
  let blogRepo: BlogPostDataMapper;
  let assetRepo: BlogAssetDataMapper;

  beforeEach(() => {
    db = createDb();
    seedConversation(db);
    jobRepo = new JobQueueDataMapper(db);
    messageRepo = new MessageDataMapper(db);
    blogRepo = new BlogPostDataMapper(db);
    assetRepo = new BlogAssetDataMapper(db);
  });

  it("publishes a draft blog post through the shared worker and exposes it in published listings", async () => {
    const draft = await blogRepo.create({
      slug: "queued-publish-post",
      title: "Queued Publish Post",
      description: "Draft queued for publish.",
      content: "## Ready\n\nThis draft is ready to publish.",
      createdByUserId: "usr_admin",
    });

    const job = await jobRepo.createJob({
      conversationId: "conv_publish",
      userId: "usr_admin",
      toolName: "publish_content",
      requestPayload: { post_id: draft.id },
    });

    await jobRepo.appendEvent({
      jobId: job.id,
      conversationId: "conv_publish",
      eventType: "queued",
      payload: { toolName: "publish_content" },
    });

    const worker = new DeferredJobWorker(jobRepo, {
      publish_content: async (claimedJob) => executePublishContent(
        blogRepo,
        parsePublishContentInput(claimedJob.requestPayload),
        {
          userId: claimedJob.userId ?? "unknown",
          role: "ADMIN",
          conversationId: claimedJob.conversationId,
        },
        assetRepo,
      ),
    });

    const result = await worker.runNext({
      workerId: "worker_publish",
      now: new Date("2026-03-25T03:00:00.000Z"),
    });

    expect(result.outcome).toBe("succeeded");

    const published = await blogRepo.findById(draft.id);
    expect(published).toMatchObject({
      id: draft.id,
      status: "published",
      publishedByUserId: "usr_admin",
    });

    const publicPosts = await blogRepo.listPublished();
    expect(publicPosts.map((post) => post.slug)).toContain("queued-publish-post");

    const publicLookup = await blogRepo.findBySlug("queued-publish-post");
    expect(publicLookup?.status).toBe("published");

    const messages = await messageRepo.listByConversation("conv_publish");
    expect(messages).toHaveLength(0);

    const events = await jobRepo.listConversationEvents("conv_publish");
    expect(events.map((event) => event.eventType)).toEqual(["queued", "started", "result"]);
  });

  it("publishes a linked hero asset when the post is published", async () => {
    const draft = await blogRepo.create({
      slug: "queued-publish-with-image",
      title: "Queued Publish With Image",
      description: "Draft queued with hero image.",
      content: "## Ready\n\nThis draft has hero media.",
      createdByUserId: "usr_admin",
    });
    const asset = await assetRepo.create({
      postId: draft.id,
      kind: "hero",
      storagePath: "2026/queued-publish-with-image/hero.png",
      mimeType: "image/png",
      altText: "Queued hero image.",
      visibility: "draft",
      createdByUserId: "usr_admin",
    });
    await blogRepo.setHeroImageAsset(draft.id, asset.id);

    await executePublishContent(
      blogRepo,
      { post_id: draft.id },
      { userId: "usr_admin", role: "ADMIN", conversationId: "conv_publish" },
      assetRepo,
    );

    expect((await assetRepo.findById(asset.id))?.visibility).toBe("published");
  });
});
