import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { OfferDataMapper } from "@/adapters/OfferDataMapper";
import { TrackedLinkDataMapper } from "@/adapters/TrackedLinkDataMapper";
import { AuthorizationError, ForbiddenError, ValidationError } from "@/core/common/errors";
import { ensureSchema } from "@/lib/db/schema";

import { OfferService } from "./offer-service";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedUser(db: Database.Database, id: string) {
  db.prepare(`INSERT INTO users (id, email, name) VALUES (?, ?, ?)`).run(id, `${id}@example.com`, id);
}

function seedConversationWithMessage(db: Database.Database) {
  db.prepare(
    `INSERT INTO conversations (id, user_id, title, status, created_at, updated_at, message_count, session_source, lane)
     VALUES ('conv_offer', 'usr_owner', 'Offer request', 'active', datetime('now'), datetime('now'), 1, 'authenticated', 'individual')`,
  ).run();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, parts)
     VALUES ('msg_offer_user', 'conv_offer', 'user', 'Create a strategy offer', '[]')`,
  ).run();
}

describe("OfferService", () => {
  let db: Database.Database;
  let mapper: OfferDataMapper;
  let service: OfferService;

  beforeEach(() => {
    db = createDb();
    mapper = new OfferDataMapper(db);
    service = new OfferService(mapper);
    seedUser(db, "usr_owner");
    seedUser(db, "usr_other");
    seedConversationWithMessage(db);
  });

  it("creates a durable draft from conversation provenance and publishes it", async () => {
    const draft = await service.createDraft(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      {
        title: "AI Workflow Strategy Call",
        summary: "Turn a messy AI workflow into a repeatable process.",
        audience: "Solopreneurs",
        promise: "A clear operating process.",
        priceCents: 50_000,
        billingKind: "fixed",
        visibility: "private",
        createdFromConversationId: "conv_offer",
        createdFromMessageId: "msg_offer_user",
      },
    );

    expect(draft.status).toBe("draft");
    expect(draft.visibility).toBe("private");
    expect(draft.createdFromConversationId).toBe("conv_offer");

    const createdEvents = await service.listOfferEvents({ userId: "usr_owner", role: "AUTHENTICATED" }, draft.id);
    expect(createdEvents).toEqual([
      expect.objectContaining({
        eventType: "created",
        conversationId: "conv_offer",
        messageId: "msg_offer_user",
        metadata: { source: "conversation" },
      }),
    ]);

    const published = await service.publishOffer({ userId: "usr_owner", role: "AUTHENTICATED" }, draft.id);
    expect(published).toMatchObject({ status: "published", visibility: "public" });
    expect(await service.listPublicOffers()).toEqual([expect.objectContaining({ id: draft.id })]);
  });

  it("supports free and contact-for-price publish paths without fabricated prices", async () => {
    const free = await service.createDraft(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      {
        title: "Free Fit Call",
        summary: "A short fit call.",
        promise: "Clarity on the next step.",
        billingKind: "free",
        visibility: "public",
      },
    );
    const contact = await service.createDraft(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      {
        title: "Custom Proposal",
        summary: "Custom pricing after discovery.",
        promise: "A scoped plan.",
        billingKind: "contact",
        visibility: "public",
      },
    );

    expect((await service.publishOffer({ userId: "usr_owner", role: "AUTHENTICATED" }, free.id)).priceCents).toBe(0);
    expect((await service.publishOffer({ userId: "usr_owner", role: "AUTHENTICATED" }, contact.id)).priceCents).toBeNull();
  });

  it("rejects unsafe offer management attempts", async () => {
    await expect(
      service.createDraft({ userId: "anon", role: "ANONYMOUS" }, { title: "Nope" }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const fixedWithoutPrice = await service.createDraft(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      {
        title: "Unpriced Fixed Offer",
        summary: "Needs a real price.",
        promise: "A result.",
        billingKind: "fixed",
      },
    );
    await expect(
      service.publishOffer({ userId: "usr_owner", role: "AUTHENTICATED" }, fixedWithoutPrice.id),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      service.updateOffer(
        { userId: "usr_other", role: "AUTHENTICATED" },
        { offerId: fixedWithoutPrice.id, title: "Hijacked" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("archives public offers and keeps them out of the public list", async () => {
    const draft = await service.createDraft(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      {
        title: "Archive Me",
        summary: "Temporary offer.",
        promise: "A temporary result.",
        priceCents: 12_500,
        billingKind: "fixed",
      },
    );
    await service.publishOffer({ userId: "usr_owner", role: "AUTHENTICATED" }, draft.id);
    expect(await service.listPublicOffers()).toHaveLength(1);

    const archived = await service.archiveOffer({ userId: "usr_owner", role: "AUTHENTICATED" }, draft.id);
    expect(archived).toMatchObject({ status: "archived", visibility: "private" });
    expect(await service.listPublicOffers()).toEqual([]);
  });

  it("deduplicates slugs and truncates long descriptions", async () => {
    const first = await service.createDraft(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      { title: "Strategy Call", description: "x".repeat(6_000) },
    );
    const second = await service.createDraft(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      { title: "Strategy Call" },
    );

    expect(first.slug).toBe("strategy-call");
    expect(first.description).toHaveLength(5_000);
    expect(second.slug).toBe("strategy-call-2");
  });

  it("records private send, choice, and simulated purchase events durably", async () => {
    const draft = await service.createDraft(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      {
        title: "Offer With Events",
        summary: "Event coverage.",
        promise: "Durable evidence.",
        priceCents: 25_000,
        billingKind: "fixed",
      },
    );

    await service.recordPrivateSend({ userId: "usr_owner", role: "AUTHENTICATED" }, draft.id, {
      personRef: "person:lead_1",
      metadata: { channel: "chat" },
    });
    await service.publishOffer({ userId: "usr_owner", role: "AUTHENTICATED" }, draft.id);
    await service.recordOfferChoice({ offerId: draft.id, conversationId: "conv_offer" });
    await service.recordSimulatedPurchase({ offerId: draft.id, personRef: "person:lead_1" });

    const events = await service.listOfferEvents({ userId: "usr_owner", role: "AUTHENTICATED" }, draft.id);
    expect(events.map((event) => event.eventType)).toEqual([
      "created",
      "sent_private",
      "published",
      "chosen",
      "purchase_simulated",
    ]);
  });

  it("mirrors tracked offer outcomes into tracked link events when attribution is present", async () => {
    const trackedMapper = new TrackedLinkDataMapper(db);
    service = new OfferService(mapper, trackedMapper);
    const draft = await service.createDraft(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      {
        title: "Tracked Offer",
        summary: "Tracked offer evidence.",
        promise: "Durable link attribution.",
        priceCents: 25_000,
        billingKind: "fixed",
      },
    );
    await service.publishOffer({ userId: "usr_owner", role: "AUTHENTICATED" }, draft.id);
    const link = await trackedMapper.create({
      code: "TRACKED1",
      ownerUserId: "usr_owner",
      targetKind: "offer",
      targetId: draft.id,
      destinationUrl: `/offers/${draft.slug}?tl=TRACKED1`,
      label: "Tracked Offer QR",
      purpose: "offer",
    });

    await service.recordOfferChoice({
      offerId: draft.id,
      conversationId: "conv_offer",
      trackedLinkId: link.id,
    });
    await service.recordSimulatedPurchase({
      offerId: draft.id,
      conversationId: "conv_offer",
      trackedLinkId: link.id,
    });

    await expect(trackedMapper.listEventsByTrackedLinkId(link.id)).resolves.toEqual([
      expect.objectContaining({ eventType: "offer_chosen", offerId: draft.id }),
      expect.objectContaining({ eventType: "purchase_simulated", offerId: draft.id }),
    ]);
  });
});
