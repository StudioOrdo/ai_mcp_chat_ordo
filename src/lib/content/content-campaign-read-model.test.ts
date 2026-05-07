import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { BlogAssetDataMapper } from "@/adapters/BlogAssetDataMapper";
import { BlogPostArtifactDataMapper } from "@/adapters/BlogPostArtifactDataMapper";
import { BlogPostDataMapper } from "@/adapters/BlogPostDataMapper";
import { OfferDataMapper } from "@/adapters/OfferDataMapper";
import { TrackedLinkDataMapper } from "@/adapters/TrackedLinkDataMapper";
import { ensureSchema } from "@/lib/db/schema";

import { ContentCampaignReadModel } from "./content-campaign-read-model";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedUser(db: Database.Database, id: string) {
  db.prepare(`INSERT INTO users (id, email, name) VALUES (?, ?, ?)`).run(id, `${id}@example.com`, id);
}

describe("ContentCampaignReadModel", () => {
  let db: Database.Database;
  let posts: BlogPostDataMapper;
  let assets: BlogAssetDataMapper;
  let artifacts: BlogPostArtifactDataMapper;
  let offers: OfferDataMapper;
  let trackedLinks: TrackedLinkDataMapper;
  let model: ContentCampaignReadModel;

  beforeEach(() => {
    db = createDb();
    seedUser(db, "usr_owner");
    seedUser(db, "usr_other");
    posts = new BlogPostDataMapper(db);
    assets = new BlogAssetDataMapper(db);
    artifacts = new BlogPostArtifactDataMapper(db);
    offers = new OfferDataMapper(db);
    trackedLinks = new TrackedLinkDataMapper(db);
    model = new ContentCampaignReadModel({ posts, assets, artifacts, offers, trackedLinks });
  });

  it("loads published content with tracked link performance and provenance counts", async () => {
    const draft = await posts.create({
      slug: "launch-note",
      title: "Launch Note",
      description: "A public update about the launch.",
      content: "## Launch",
      createdByUserId: "usr_owner",
    });
    const post = await posts.publishById(draft.id, "usr_owner");
    const hero = await assets.create({
      postId: post.id,
      kind: "hero",
      storagePath: "hero.png",
      mimeType: "image/png",
      width: 1200,
      height: 675,
      altText: "Launch hero",
      visibility: "published",
      selectionState: "selected",
      createdByUserId: "usr_owner",
    });
    await posts.setHeroImageAsset(post.id, hero.id);
    await artifacts.create({
      postId: post.id,
      artifactType: "article_qa_report",
      payload: { passed: true, jobId: "job_content_1", workflowId: "mwf_content_1" },
      createdByUserId: "usr_owner",
    });
    const link = await trackedLinks.create({
      code: "LAUNCH1",
      ownerUserId: "usr_owner",
      targetKind: "content_item",
      targetId: post.id,
      destinationUrl: `/feed/${post.slug}?tl=LAUNCH1`,
      label: "Launch QR",
      purpose: "content",
    });
    await trackedLinks.appendEvent({
      trackedLinkId: link.id,
      eventType: "visit",
      anonymousVisitId: "visit_1",
    });
    db.prepare(
      `INSERT INTO conversations (id, user_id, title, status, created_at, updated_at)
       VALUES ('conv_1', 'usr_owner', 'Tracked content chat', 'active', datetime('now'), datetime('now'))`,
    ).run();
    await trackedLinks.appendEvent({
      trackedLinkId: link.id,
      eventType: "chat_started",
      anonymousVisitId: "visit_1",
      conversationId: "conv_1",
      userId: "usr_owner",
    });

    const items = await model.listOwnerContentItems("usr_owner");

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      post: expect.objectContaining({ id: post.id }),
      heroAsset: expect.objectContaining({ id: hero.id }),
      publicHref: "/feed/launch-note",
      isPublic: true,
      performance: expect.objectContaining({
        links: 1,
        visits: 1,
        chats: 1,
      }),
    });
    expect(items[0].artifacts).toHaveLength(1);
    expect(items[0].artifacts[0].payload).toMatchObject({
      jobId: "job_content_1",
      workflowId: "mwf_content_1",
    });
  });

  it("keeps draft content out of the public feed and does not fabricate metrics", async () => {
    await posts.create({
      slug: "draft-note",
      title: "Draft Note",
      description: "Draft only.",
      content: "draft",
      createdByUserId: "usr_owner",
    });

    await expect(model.listPublicFeedItems()).resolves.toEqual([]);
    const items = await model.listOwnerContentItems("usr_owner");
    expect(items[0].isPublic).toBe(false);
    expect(items[0].performance).toMatchObject({
      links: 0,
      visits: 0,
      chats: 0,
      signups: 0,
    });
  });

  it("groups multiple content links and public offers into one campaign read model", async () => {
    const first = await posts.publishById((await posts.create({
      slug: "first",
      title: "First",
      description: "First post.",
      content: "first",
      createdByUserId: "usr_owner",
    })).id, "usr_owner");
    const second = await posts.publishById((await posts.create({
      slug: "second",
      title: "Second",
      description: "Second post.",
      content: "second",
      createdByUserId: "usr_owner",
    })).id, "usr_owner");
    const linkOne = await trackedLinks.create({
      code: "FIRST",
      ownerUserId: "usr_owner",
      targetKind: "content_item",
      targetId: first.id,
      destinationUrl: "/feed/first?tl=FIRST",
      label: "First link",
      purpose: "content",
    });
    const linkTwo = await trackedLinks.create({
      code: "SECOND",
      ownerUserId: "usr_owner",
      targetKind: "content_item",
      targetId: second.id,
      destinationUrl: "/feed/second?tl=SECOND",
      label: "Second link",
      purpose: "content",
    });
    await trackedLinks.appendEvent({ trackedLinkId: linkOne.id, eventType: "visit", anonymousVisitId: "v1" });
    await trackedLinks.appendEvent({ trackedLinkId: linkTwo.id, eventType: "visit", anonymousVisitId: "v2" });
    await offers.create({
      slug: "launch-offer",
      ownerUserId: "usr_owner",
      title: "Launch Offer",
      summary: "A launch package.",
      description: "A launch package.",
      audience: "Solopreneurs",
      promise: "Launch cleaner.",
      priceCents: 50000,
      currency: "USD",
      billingKind: "fixed",
      estimatedMinutes: null,
      status: "published",
      visibility: "public",
      ctaLabel: "Start a conversation",
    });

    const campaign = await model.loadOwnerCampaign("usr_owner");

    expect(campaign).toMatchObject({
      id: "content-performance",
      items: expect.arrayContaining([
        expect.objectContaining({ post: expect.objectContaining({ id: first.id }) }),
        expect.objectContaining({ post: expect.objectContaining({ id: second.id }) }),
      ]),
      offers: [expect.objectContaining({ title: "Launch Offer" })],
      performance: expect.objectContaining({
        links: 2,
        visits: 2,
      }),
    });
  });

  it("rejects another user's content metrics through owner-scoped loading", async () => {
    const other = await posts.publishById((await posts.create({
      slug: "other",
      title: "Other",
      description: "Other post.",
      content: "other",
      createdByUserId: "usr_other",
    })).id, "usr_other");

    await expect(model.loadOwnerContentItem("usr_owner", other.id)).resolves.toBeNull();
    await expect(model.listOwnerContentItems("usr_owner")).resolves.toEqual([]);
  });
});
