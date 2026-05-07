import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { BlogPostDataMapper } from "@/adapters/BlogPostDataMapper";
import { OfferDataMapper } from "@/adapters/OfferDataMapper";
import { TrackedLinkDataMapper } from "@/adapters/TrackedLinkDataMapper";
import { ForbiddenError, ValidationError } from "@/core/common/errors";
import { ensureSchema } from "@/lib/db/schema";
import { OfferService } from "@/lib/offers/offer-service";

import { TrackedLinkService } from "./tracked-link-service";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedUser(db: Database.Database, id: string) {
  db.prepare(`INSERT INTO users (id, email, name) VALUES (?, ?, ?)`).run(id, `${id}@example.com`, id);
}

describe("TrackedLinkService", () => {
  let db: Database.Database;
  let offerMapper: OfferDataMapper;
  let blogPostMapper: BlogPostDataMapper;
  let trackedMapper: TrackedLinkDataMapper;
  let offerService: OfferService;
  let service: TrackedLinkService;

  beforeEach(() => {
    db = createDb();
    offerMapper = new OfferDataMapper(db);
    blogPostMapper = new BlogPostDataMapper(db);
    trackedMapper = new TrackedLinkDataMapper(db);
    offerService = new OfferService(offerMapper, trackedMapper);
    seedUser(db, "usr_owner");
    seedUser(db, "usr_other");
    service = new TrackedLinkService(trackedMapper, offerMapper, blogPostMapper, (() => {
      const codes = ["DUPLICATE", "DUPLICATE", "UNIQUECODE"];
      let index = 0;
      return () => codes[index++] ?? `CODE_${index}`;
    })());
  });

  async function createPublishedOffer(ownerUserId = "usr_owner") {
    const draft = await offerService.createDraft(
      { userId: ownerUserId, role: "AUTHENTICATED" },
      {
        title: "Strategy Call",
        summary: "Turn messy work into a repeatable process.",
        promise: "A clear next step.",
        priceCents: 50_000,
        billingKind: "fixed",
        visibility: "public",
      },
    );
    return offerService.publishOffer({ userId: ownerUserId, role: "AUTHENTICATED" }, draft.id);
  }

  it("creates multiple active tracked links for a published public offer", async () => {
    const offer = await createPublishedOffer();
    await trackedMapper.create({
      code: "DUPLICATE",
      ownerUserId: "usr_owner",
      targetKind: "offer",
      targetId: offer.id,
      destinationUrl: "/offers/strategy-call?tl=DUPLICATE",
      label: "Existing QR",
      purpose: "offer",
    });

    const first = await service.createForOffer(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      { offerId: offer.id },
    );
    const second = await service.createForOffer(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      { offerId: offer.id, label: "Event handout" },
    );

    expect(first.code).toBe("UNIQUECODE");
    expect(first.destinationUrl).toBe(`/offers/${offer.slug}?tl=UNIQUECODE`);
    expect(second).toMatchObject({ targetKind: "offer", targetId: offer.id, label: "Event handout" });
    await expect(trackedMapper.listByTarget({
      ownerUserId: "usr_owner",
      targetKind: "offer",
      targetId: offer.id,
    })).resolves.toHaveLength(3);
  });

  it("blocks draft/private offers and cross-owner creation", async () => {
    const draft = await offerService.createDraft(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      { title: "Draft Offer", promise: "Later", visibility: "private" },
    );

    await expect(
      service.createForOffer({ userId: "usr_owner", role: "AUTHENTICATED" }, { offerId: draft.id }),
    ).rejects.toBeInstanceOf(ValidationError);

    const published = await createPublishedOffer();
    await expect(
      service.createForOffer({ userId: "usr_other", role: "AUTHENTICATED" }, { offerId: published.id }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("creates public URL links only for owned public routes", async () => {
    const link = await service.createForPublicUrl(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      {
        destinationUrl: "/feed/launch-note",
        label: "Launch note",
        purpose: "content",
      },
    );

    expect(link).toMatchObject({
      ownerUserId: "usr_owner",
      targetKind: "url",
      targetId: "/feed/launch-note",
      destinationUrl: "/feed/launch-note",
      label: "Launch note",
    });

    await expect(service.createForPublicUrl(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      {
        destinationUrl: "/business",
        label: "Internal route",
      },
    )).rejects.toBeInstanceOf(ValidationError);
  });

  it("creates tracked links for published owner content and blocks draft or cross-owner content", async () => {
    const draft = await blogPostMapper.create({
      slug: "founder-note",
      title: "Founder Note",
      description: "A public note once published.",
      content: "## Hello",
      createdByUserId: "usr_owner",
    });
    const published = await blogPostMapper.publishById(draft.id, "usr_owner");

    const link = await service.createForContentItem(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      { contentId: published.id },
    );

    expect(link).toMatchObject({
      targetKind: "content_item",
      targetId: published.id,
      destinationUrl: `/feed/${published.slug}?tl=${link.code}`,
      label: "Founder Note",
      purpose: "content",
    });

    const otherDraft = await blogPostMapper.create({
      slug: "other-note",
      title: "Other Note",
      description: "Private until published.",
      content: "draft",
      createdByUserId: "usr_other",
    });

    await expect(service.createForContentItem(
      { userId: "usr_other", role: "AUTHENTICATED" },
      { contentId: otherDraft.id },
    )).rejects.toBeInstanceOf(ValidationError);
    await expect(service.createForContentItem(
      { userId: "usr_other", role: "AUTHENTICATED" },
      { contentId: published.id },
    )).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("records visit, offer view, chat, signup, choice, and purchase attribution without duplicates", async () => {
    const offer = await createPublishedOffer();
    const link = await service.createForOffer(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      { offerId: offer.id },
    );
    db.prepare(
      `INSERT INTO conversations (id, user_id, title, status, created_at, updated_at)
       VALUES ('conv_1', 'usr_owner', 'Tracked chat', 'active', datetime('now'), datetime('now'))`,
    ).run();

    await service.recordPublicVisit({ code: link.code, anonymousVisitId: "visit_1" });
    await service.recordPublicVisit({ code: link.code, anonymousVisitId: "visit_1" });
    await service.recordOfferViewedByCode({ code: link.code, offerId: offer.id, anonymousVisitId: "visit_1" });
    await service.recordChatStarted({
      code: link.code,
      anonymousVisitId: "visit_1",
      conversationId: "conv_1",
      userId: "usr_owner",
    });
    await service.recordSignupForConversations({ conversationIds: ["conv_1"], userId: "usr_owner" });
    await offerService.recordOfferChoice({
      offerId: offer.id,
      conversationId: "conv_1",
      trackedLinkId: link.id,
    });
    await offerService.recordSimulatedPurchase({
      offerId: offer.id,
      conversationId: "conv_1",
      trackedLinkId: link.id,
    });

    const events = await trackedMapper.listEventsByTrackedLinkId(link.id);
    expect(events.map((event) => event.eventType)).toEqual([
      "visit",
      "offer_viewed",
      "chat_started",
      "signup",
      "offer_chosen",
      "purchase_simulated",
    ]);
    expect(events.filter((event) => event.eventType === "visit")).toHaveLength(1);

    const offerEvents = await offerService.listOfferEvents(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      offer.id,
    );
    expect(offerEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "viewed", trackedLinkId: link.id }),
      expect.objectContaining({ eventType: "chosen", trackedLinkId: link.id }),
      expect.objectContaining({ eventType: "purchase_simulated", trackedLinkId: link.id }),
    ]));
  });

  it("does not record public events for archived links", async () => {
    const offer = await createPublishedOffer();
    const link = await service.createForOffer(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      { offerId: offer.id },
    );

    await service.archive({ userId: "usr_owner", role: "AUTHENTICATED" }, link.id);

    await expect(service.recordPublicVisit({
      code: link.code,
      anonymousVisitId: "visit_archived",
    })).resolves.toEqual({ link: null, event: null });
    expect(await trackedMapper.listEventsByTrackedLinkId(link.id)).toEqual([]);
  });
});
