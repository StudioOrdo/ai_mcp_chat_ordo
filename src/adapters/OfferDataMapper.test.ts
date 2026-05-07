import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { ensureSchema } from "@/lib/db/schema";

import { OfferDataMapper } from "./OfferDataMapper";

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
     VALUES ('conv_offer', 'usr_1', 'Offer request', 'active', datetime('now'), datetime('now'), 1, 'authenticated', 'individual')`,
  ).run();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, parts)
     VALUES ('msg_offer_user', 'conv_offer', 'user', 'Create an offer', '[]')`,
  ).run();
}

describe("OfferDataMapper", () => {
  let db: Database.Database;
  let mapper: OfferDataMapper;

  beforeEach(() => {
    db = createDb();
    mapper = new OfferDataMapper(db);
    seedUser(db, "usr_1");
    seedUser(db, "usr_2");
    seedConversationWithMessage(db);
  });

  it("creates, reads, updates, and lists durable offers", async () => {
    const created = await mapper.create({
      slug: "strategy-call",
      ownerUserId: "usr_1",
      title: "Strategy Call",
      summary: "Clarify the next offer.",
      description: "A focused strategy session.",
      audience: "Solopreneurs",
      promise: "A repeatable next step.",
      priceCents: 50_000,
      currency: "USD",
      billingKind: "fixed",
      estimatedMinutes: 90,
      status: "draft",
      visibility: "private",
      ctaLabel: "Start a conversation",
      createdFromConversationId: "conv_offer",
      createdFromMessageId: "msg_offer_user",
    });

    expect(created.id).toMatch(/^offer_/);
    expect(created.status).toBe("draft");
    expect(created.createdFromConversationId).toBe("conv_offer");
    expect(await mapper.findBySlug("strategy-call")).toMatchObject({ id: created.id });

    const published = await mapper.update(created.id, {
      status: "published",
      visibility: "public",
      publishedAt: "2026-05-05T12:00:00.000Z",
    });

    expect(published).toMatchObject({
      id: created.id,
      status: "published",
      visibility: "public",
      publishedAt: "2026-05-05T12:00:00.000Z",
    });
    expect(await mapper.listByOwnerUserId("usr_1")).toHaveLength(1);
    expect(await mapper.listPublishedPublic()).toEqual([expect.objectContaining({ id: created.id })]);
  });

  it("persists offer event metadata and filters archived public offers", async () => {
    const offer = await mapper.create({
      slug: "private-proposal",
      ownerUserId: "usr_1",
      title: "Private Proposal",
      summary: "Custom scope.",
      description: "Custom scope.",
      audience: "A selected buyer",
      promise: "Clear delivery plan.",
      priceCents: null,
      currency: "USD",
      billingKind: "contact",
      estimatedMinutes: null,
      status: "published",
      visibility: "public",
      ctaLabel: "Start a conversation",
      createdFromConversationId: null,
      createdFromMessageId: null,
    });

    await mapper.update(offer.id, {
      publishedAt: "2026-05-05T12:00:00.000Z",
    });

    const event = await mapper.createEvent({
      offerId: offer.id,
      eventType: "sent_private",
      actorUserId: "usr_1",
      personRef: "person:lead_1",
      conversationId: "conv_offer",
      messageId: "msg_offer_user",
      metadata: { channel: "chat", note: "sent from owner review" },
    });

    expect(event.id).toMatch(/^offer_evt_/);
    expect(event.metadata).toEqual({ channel: "chat", note: "sent from owner review" });
    expect(await mapper.listEventsByOfferId(offer.id)).toEqual([
      expect.objectContaining({ eventType: "sent_private", personRef: "person:lead_1" }),
    ]);

    expect(await mapper.listPublishedPublic()).toHaveLength(1);
    await mapper.update(offer.id, { status: "archived", visibility: "private", archivedAt: "2026-05-05T13:00:00.000Z" });
    expect(await mapper.listPublishedPublic()).toEqual([]);
  });
});
