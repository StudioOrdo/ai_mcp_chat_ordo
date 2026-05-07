import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SystemEventDataMapper } from "@/adapters/SystemEventDataMapper";
import { UserInboxDataMapper } from "@/adapters/UserInboxDataMapper";
import { ensureSchema } from "@/lib/db/schema";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)")
    .run("usr_inbox_owner", "inbox-owner@example.test", "Owner");
  db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)")
    .run("usr_inbox_other", "inbox-other@example.test", "Other");
  db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)")
    .run("usr_inbox_admin", "inbox-admin@example.test", "Admin");
  return db;
}

async function seedEvents(db: Database.Database) {
  const events = new SystemEventDataMapper(db);
  const publicEvent = await events.append({
    id: "evt_public_offer",
    type: "offer.public.updated",
    sectionIds: ["offers"],
    visibility: "public",
    summary: "Public offer changed.",
    sourceRefs: [{ sourceKind: "offer", sourceId: "offer_public", href: "/offers/public" }],
  }, "2026-05-07T10:00:00.000Z");
  const ownerToday = await events.append({
    id: "evt_owner_today",
    type: "today.decision.created",
    ownerUserId: "usr_inbox_owner",
    objectRef: { kind: "person", id: "person_1", label: "Ava Thompson" },
    sectionIds: ["today", "people"],
    visibility: "owner",
    summary: "Decision created.",
    sourceRefs: [{ sourceKind: "conversation", sourceId: "conv_1", label: "Conversation" }],
  }, "2026-05-07T10:01:00.000Z");
  const otherOwner = await events.append({
    id: "evt_other_owner",
    type: "today.decision.created",
    ownerUserId: "usr_inbox_other",
    sectionIds: ["today"],
    visibility: "owner",
    summary: "Other owner decision.",
  }, "2026-05-07T10:02:00.000Z");
  const adminEvent = await events.append({
    id: "evt_admin_backup",
    type: "backup.completed",
    sectionIds: ["system"],
    visibility: "admin",
    summary: "Backup completed.",
  }, "2026-05-07T10:03:00.000Z");

  return { publicEvent, ownerToday, otherOwner, adminEvent };
}

describe("UserInboxDataMapper", () => {
  it("creates durable section cursor and inbox item tables", () => {
    const db = createDb();

    const cursorColumns = db.pragma("table_info(user_section_cursors)") as Array<{ name: string }>;
    const inboxColumns = db.pragma("table_info(user_inbox_items)") as Array<{ name: string }>;
    const inboxIndexes = db.pragma("index_list(user_inbox_items)") as Array<{ name: string; unique: number }>;

    expect(cursorColumns.map((column) => column.name)).toEqual(expect.arrayContaining([
      "user_id",
      "section_id",
      "last_read_sequence",
      "updated_at",
    ]));
    expect(inboxColumns.map((column) => column.name)).toEqual(expect.arrayContaining([
      "id",
      "user_id",
      "system_event_id",
      "system_event_sequence",
      "section_id",
      "item_key",
      "read_at",
      "dismissed_at",
    ]));
    expect(inboxIndexes).toContainEqual(expect.objectContaining({
      name: "idx_user_inbox_items_user_event_section",
      unique: 1,
    }));
  });

  it("materializes visible system events into per-user section inbox rows", async () => {
    const db = createDb();
    const { publicEvent, ownerToday } = await seedEvents(db);
    const inbox = new UserInboxDataMapper(db);

    const items = await inbox.materializeVisibleEventsForUser({
      userId: "usr_inbox_owner",
      role: "OWNER",
    });

    expect(items.map((item) => ({
      eventId: item.systemEventId,
      sectionId: item.sectionId,
      sequence: item.systemEventSequence,
    }))).toEqual([
      { eventId: publicEvent.id, sectionId: "offers", sequence: publicEvent.sequence },
      { eventId: ownerToday.id, sectionId: "today", sequence: ownerToday.sequence },
      { eventId: ownerToday.id, sectionId: "people", sequence: ownerToday.sequence },
    ]);
    expect(items.find((item) => item.sectionId === "today")).toMatchObject({
      summary: "Decision created.",
      objectRef: { kind: "person", id: "person_1", label: "Ava Thompson" },
      sourceRefs: [{ sourceKind: "conversation", sourceId: "conv_1", label: "Conversation" }],
      isRead: false,
    });

    await inbox.materializeVisibleEventsForUser({ userId: "usr_inbox_owner", role: "OWNER" });
    expect(db.prepare("SELECT COUNT(*) AS count FROM user_inbox_items").get())
      .toMatchObject({ count: 3 });
  });

  it("enforces owner, public, and admin access boundaries", async () => {
    const db = createDb();
    await seedEvents(db);
    const inbox = new UserInboxDataMapper(db);

    await inbox.materializeVisibleEventsForUser({ userId: "usr_inbox_owner", role: "OWNER" });
    await inbox.materializeVisibleEventsForUser({ userId: "usr_inbox_admin", role: "ADMIN" });

    await expect(inbox.listForUser({
      userId: "usr_inbox_owner",
      viewer: { userId: "usr_inbox_owner", role: "OWNER" },
    })).resolves.toHaveLength(3);
    await expect(inbox.listForUser({
      userId: "usr_inbox_owner",
      viewer: { userId: "usr_inbox_other", role: "OWNER" },
    })).rejects.toThrow("Viewer cannot read another user's inbox");
    await expect(inbox.listForUser({
      userId: "usr_inbox_owner",
      viewer: { role: "ANONYMOUS" },
    })).rejects.toThrow("Authenticated user is required");

    const adminInbox = await inbox.listForUser({
      userId: "usr_inbox_admin",
      viewer: { userId: "usr_inbox_admin", role: "ADMIN" },
    });
    expect(adminInbox.map((item) => item.systemEventId)).toEqual([
      "evt_public_offer",
      "evt_admin_backup",
    ]);
  });

  it("tracks unread counts and section read cursors without marking unrelated sections read", async () => {
    const db = createDb();
    const { ownerToday } = await seedEvents(db);
    const inbox = new UserInboxDataMapper(db);
    await inbox.materializeVisibleEventsForUser({ userId: "usr_inbox_owner", role: "OWNER" });

    await expect(inbox.getUnreadCounts("usr_inbox_owner", {
      userId: "usr_inbox_owner",
      role: "OWNER",
    })).resolves.toEqual([
      { sectionId: "offers", unreadCount: 1 },
      { sectionId: "people", unreadCount: 1 },
      { sectionId: "today", unreadCount: 1 },
    ]);

    const cursor = await inbox.markSectionRead({
      userId: "usr_inbox_owner",
      sectionId: "today",
      throughSequence: ownerToday.sequence,
    }, "2026-05-07T10:05:00.000Z");

    expect(cursor).toMatchObject({
      userId: "usr_inbox_owner",
      sectionId: "today",
      lastReadSequence: ownerToday.sequence,
    });
    await expect(inbox.getUnreadCounts("usr_inbox_owner", {
      userId: "usr_inbox_owner",
      role: "OWNER",
    })).resolves.toEqual([
      { sectionId: "offers", unreadCount: 1 },
      { sectionId: "people", unreadCount: 1 },
    ]);

    await inbox.markSectionRead({
      userId: "usr_inbox_owner",
      sectionId: "today",
      throughSequence: 1,
    });
    await expect(inbox.findSectionCursor("usr_inbox_owner", "today")).resolves.toMatchObject({
      lastReadSequence: ownerToday.sequence,
    });
  });

  it("supports item read and dismissed states without affecting other user inboxes", async () => {
    const db = createDb();
    await seedEvents(db);
    const inbox = new UserInboxDataMapper(db);
    await inbox.materializeVisibleEventsForUser({ userId: "usr_inbox_owner", role: "OWNER" });
    await inbox.materializeVisibleEventsForUser({ userId: "usr_inbox_other", role: "OWNER" });
    const [ownerOffer] = await inbox.listForUser({
      userId: "usr_inbox_owner",
      viewer: { userId: "usr_inbox_owner", role: "OWNER" },
      sectionId: "offers",
    });
    const [otherOffer] = await inbox.listForUser({
      userId: "usr_inbox_other",
      viewer: { userId: "usr_inbox_other", role: "OWNER" },
      sectionId: "offers",
    });

    await inbox.markItemRead("usr_inbox_owner", ownerOffer.id, "2026-05-07T10:06:00.000Z");
    const dismissed = await inbox.dismissItem("usr_inbox_owner", ownerOffer.id, "2026-05-07T10:07:00.000Z");

    expect(dismissed).toMatchObject({
      id: ownerOffer.id,
      readAt: "2026-05-07T10:06:00.000Z",
      dismissedAt: "2026-05-07T10:07:00.000Z",
      isRead: true,
      isDismissed: true,
    });
    await expect(inbox.listForUser({
      userId: "usr_inbox_owner",
      viewer: { userId: "usr_inbox_owner", role: "OWNER" },
      sectionId: "offers",
    })).resolves.toEqual([]);
    await expect(inbox.listForUser({
      userId: "usr_inbox_owner",
      viewer: { userId: "usr_inbox_owner", role: "OWNER" },
      sectionId: "offers",
      includeDismissed: true,
    })).resolves.toEqual([expect.objectContaining({ id: ownerOffer.id, isDismissed: true })]);
    await expect(inbox.listForUser({
      userId: "usr_inbox_other",
      viewer: { userId: "usr_inbox_other", role: "OWNER" },
      sectionId: "offers",
    })).resolves.toEqual([expect.objectContaining({ id: otherOffer.id, isDismissed: false })]);
  });
});
