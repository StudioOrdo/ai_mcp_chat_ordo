import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { ensureSchema } from "@/lib/db/schema";

import { TrackedLinkDataMapper } from "./TrackedLinkDataMapper";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedUser(db: Database.Database, id: string) {
  db.prepare(`INSERT INTO users (id, email, name) VALUES (?, ?, ?)`).run(id, `${id}@example.com`, id);
}

function seedOffer(db: Database.Database) {
  db.prepare(
    `INSERT INTO conversations (id, user_id, title, status, created_at, updated_at)
     VALUES ('conv_missing', 'usr_1', 'Tracked chat', 'active', datetime('now'), datetime('now'))`,
  ).run();
  db.prepare(
    `INSERT INTO offers (
       id, slug, owner_user_id, title, summary, description, audience, promise,
       price_cents, currency, billing_kind, status, visibility, cta_label,
       published_at
     ) VALUES (
       'offer_1', 'strategy-call', 'usr_1', 'Strategy Call', 'Summary',
       'Description', 'Solopreneurs', 'Promise', 50000, 'USD', 'fixed',
       'published', 'public', 'Start', datetime('now')
     )`,
  ).run();
}

describe("TrackedLinkDataMapper", () => {
  let db: Database.Database;
  let mapper: TrackedLinkDataMapper;

  beforeEach(() => {
    db = createDb();
    mapper = new TrackedLinkDataMapper(db);
    seedUser(db, "usr_1");
    seedOffer(db);
  });

  it("creates tracked links and aggregates event performance", async () => {
    const link = await mapper.create({
      code: "CODE_1",
      ownerUserId: "usr_1",
      targetKind: "offer",
      targetId: "offer_1",
      destinationUrl: "/offers/strategy-call?tl=CODE_1",
      label: "Strategy Call QR",
      purpose: "offer",
    });

    expect(link.id).toMatch(/^tl_/);
    expect(await mapper.findByCode("CODE_1")).toMatchObject({ id: link.id, targetKind: "offer" });

    await mapper.appendEvent({
      trackedLinkId: link.id,
      eventType: "visit",
      anonymousVisitId: "visit_1",
      offerId: "offer_1",
      idempotencyKey: "visit:visit_1",
    });
    await mapper.appendEvent({
      trackedLinkId: link.id,
      eventType: "chat_started",
      anonymousVisitId: "visit_1",
      conversationId: "conv_missing",
      offerId: "offer_1",
      idempotencyKey: "chat_started:conv_missing",
    });
    await mapper.appendEvent({
      trackedLinkId: link.id,
      eventType: "offer_chosen",
      offerId: "offer_1",
      idempotencyKey: "offer_chosen:offer_1:conv_missing",
    });

    const [withPerformance] = await mapper.listWithPerformanceByOwnerUserId("usr_1");
    expect(withPerformance).toMatchObject({
      link: { id: link.id },
      performance: {
        visits: 1,
        chats: 1,
        offerChoices: 1,
      },
    });
  });

  it("deduplicates events by tracked link and idempotency key", async () => {
    const link = await mapper.create({
      code: "CODE_2",
      ownerUserId: "usr_1",
      targetKind: "offer",
      targetId: "offer_1",
      destinationUrl: "/offers/strategy-call?tl=CODE_2",
      label: "Strategy Call QR",
      purpose: "offer",
    });

    const first = await mapper.appendEvent({
      trackedLinkId: link.id,
      eventType: "visit",
      anonymousVisitId: "visit_2",
      idempotencyKey: "visit:visit_2",
    });
    const second = await mapper.appendEvent({
      trackedLinkId: link.id,
      eventType: "visit",
      anonymousVisitId: "visit_2",
      idempotencyKey: "visit:visit_2",
    });

    expect(first.wasInserted).toBe(true);
    expect(second.wasInserted).toBe(false);
    expect(await mapper.listEventsByTrackedLinkId(link.id)).toHaveLength(1);
  });
});
