import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SystemEventDataMapper } from "@/adapters/SystemEventDataMapper";
import { ensureSchema } from "@/lib/db/schema";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)")
    .run("usr_evt_owner", "system-owner@example.test", "Owner");
  db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)")
    .run("usr_evt_other", "system-other@example.test", "Other");
  db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)")
    .run("usr_evt_admin", "system-admin@example.test", "Admin");
  return db;
}

describe("SystemEventDataMapper", () => {
  it("creates the durable event schema with global sequence indexes", () => {
    const db = createDb();

    const columns = db.pragma("table_info(system_events)") as Array<{ name: string; pk: number }>;
    const indexes = db.pragma("index_list(system_events)") as Array<{ name: string; unique: number }>;

    expect(columns.map((column) => column.name)).toEqual(expect.arrayContaining([
      "sequence",
      "id",
      "event_type",
      "occurred_at",
      "actor_user_id",
      "owner_user_id",
      "object_kind",
      "object_id",
      "object_label",
      "section_ids_json",
      "visibility",
      "summary",
      "source_refs_json",
      "payload_json",
      "created_at",
    ]));
    expect(columns.find((column) => column.name === "sequence")).toMatchObject({ pk: 1 });
    expect(indexes.map((index) => index.name)).toEqual(expect.arrayContaining([
      "idx_system_events_visibility_sequence",
      "idx_system_events_owner_sequence",
      "idx_system_events_object_sequence",
      "idx_system_events_type_sequence",
    ]));
  });

  it("appends events in global sequence order with sections and source refs", async () => {
    const mapper = new SystemEventDataMapper(createDb());

    const first = await mapper.append({
      id: "evt_first",
      type: "message.created",
      occurredAt: "2026-05-07T10:00:00.000Z",
      actorUserId: "usr_evt_owner",
      ownerUserId: "usr_evt_owner",
      objectRef: { kind: "conversation", id: "conv_1", label: "Conversation" },
      sectionIds: ["conversations", "today"],
      visibility: "owner",
      summary: "Message created.",
      sourceRefs: [{ sourceKind: "message", sourceId: "msg_1", label: "Message" }],
      payload: { messageId: "msg_1" },
    }, "2026-05-07T10:00:01.000Z");
    const second = await mapper.append({
      id: "evt_second",
      type: "studio.work.completed",
      ownerUserId: "usr_evt_owner",
      objectRef: { kind: "media_workflow", id: "mwf_1" },
      sectionIds: ["studio", "today"],
      visibility: "owner",
      summary: "Work completed.",
      sourceRefs: [{ sourceKind: "media_workflow", sourceId: "mwf_1", href: "/studio?object=mwf_1" }],
    }, "2026-05-07T10:01:00.000Z");

    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
    expect(first.sectionIds).toEqual(["conversations", "today"]);
    expect(first.sourceRefs).toEqual([{ sourceKind: "message", sourceId: "msg_1", label: "Message" }]);
    expect(first.payload).toEqual({ messageId: "msg_1" });
    await expect(mapper.listVisible({
      viewer: { userId: "usr_evt_owner", role: "OWNER" },
    })).resolves.toEqual([first, second]);
  });

  it("enforces owner, public, and admin visibility", async () => {
    const mapper = new SystemEventDataMapper(createDb());
    const publicEvent = await mapper.append({
      id: "evt_public",
      type: "offer.public.updated",
      sectionIds: ["offers"],
      visibility: "public",
      summary: "Public offer updated.",
    });
    const ownerEvent = await mapper.append({
      id: "evt_owner",
      type: "person.updated",
      ownerUserId: "usr_evt_owner",
      sectionIds: ["people"],
      visibility: "owner",
      summary: "Person updated.",
    });
    const otherOwnerEvent = await mapper.append({
      id: "evt_other_owner",
      type: "person.updated",
      ownerUserId: "usr_evt_other",
      sectionIds: ["people"],
      visibility: "owner",
      summary: "Other person updated.",
    });
    const adminEvent = await mapper.append({
      id: "evt_admin",
      type: "backup.completed",
      sectionIds: ["system"],
      visibility: "admin",
      summary: "Backup completed.",
    });

    await expect(mapper.listVisible({ viewer: null })).resolves.toEqual([publicEvent]);
    await expect(mapper.listVisible({
      viewer: { userId: "usr_evt_owner", role: "OWNER" },
    })).resolves.toEqual([publicEvent, ownerEvent]);
    await expect(mapper.listVisible({
      viewer: { userId: "usr_evt_other", role: "OWNER" },
    })).resolves.toEqual([publicEvent, otherOwnerEvent]);
    await expect(mapper.listVisible({
      viewer: { userId: "usr_evt_admin", role: "ADMIN" },
    })).resolves.toEqual([publicEvent, ownerEvent, otherOwnerEvent, adminEvent]);
  });

  it("filters visible events by sequence, section, object, and limit", async () => {
    const mapper = new SystemEventDataMapper(createDb());
    await mapper.append({
      id: "evt_1",
      type: "today.created",
      ownerUserId: "usr_evt_owner",
      objectRef: { kind: "activity", id: "act_1" },
      sectionIds: ["today"],
      visibility: "owner",
      summary: "Today item.",
    });
    const studio = await mapper.append({
      id: "evt_2",
      type: "studio.created",
      ownerUserId: "usr_evt_owner",
      objectRef: { kind: "media_workflow", id: "mwf_1" },
      sectionIds: ["studio", "today"],
      visibility: "owner",
      summary: "Studio item.",
    });
    await mapper.append({
      id: "evt_3",
      type: "studio.created",
      ownerUserId: "usr_evt_owner",
      objectRef: { kind: "media_workflow", id: "mwf_2" },
      sectionIds: ["studio"],
      visibility: "owner",
      summary: "Second Studio item.",
    });

    await expect(mapper.listVisible({
      viewer: { userId: "usr_evt_owner", role: "OWNER" },
      afterSequence: 1,
      sectionId: "studio",
      limit: 1,
    })).resolves.toEqual([studio]);

    await expect(mapper.listVisible({
      viewer: { userId: "usr_evt_owner", role: "OWNER" },
      objectRef: { kind: "media_workflow", id: "mwf_1" },
    })).resolves.toEqual([studio]);
  });

  it("finds the latest visible event for freshness checks", async () => {
    const mapper = new SystemEventDataMapper(createDb());
    await mapper.append({
      id: "evt_public",
      type: "offer.public.updated",
      sectionIds: ["offers"],
      visibility: "public",
      summary: "Public offer updated.",
    });
    const ownerEvent = await mapper.append({
      id: "evt_owner_latest",
      type: "studio.work.updated",
      ownerUserId: "usr_evt_owner",
      objectRef: { kind: "media_workflow", id: "mwf_1" },
      sectionIds: ["studio"],
      visibility: "owner",
      summary: "Owner work changed.",
    });
    await mapper.append({
      id: "evt_other_hidden",
      type: "studio.work.updated",
      ownerUserId: "usr_evt_other",
      objectRef: { kind: "media_workflow", id: "mwf_2" },
      sectionIds: ["studio"],
      visibility: "owner",
      summary: "Other owner work changed.",
    });

    await expect(mapper.findLatestVisible({
      viewer: { userId: "usr_evt_owner", role: "OWNER" },
      sectionId: "studio",
    })).resolves.toEqual(ownerEvent);
    await expect(mapper.findLatestVisible({
      viewer: null,
      sectionId: "studio",
    })).resolves.toBeNull();
  });

  it("rejects invalid events before writing them", async () => {
    const db = createDb();
    const mapper = new SystemEventDataMapper(db);

    await expect(mapper.append({
      type: " ",
      sectionIds: ["today"],
      visibility: "public",
      summary: "Bad.",
    })).rejects.toThrow("type is required");
    await expect(mapper.append({
      type: "person.updated",
      sectionIds: ["people"],
      visibility: "owner",
      summary: "Missing owner.",
    })).rejects.toThrow("ownerUserId is required");
    await expect(mapper.append({
      type: "person.updated",
      ownerUserId: "usr_evt_owner",
      sectionIds: [],
      visibility: "owner",
      summary: "Missing section.",
    })).rejects.toThrow("sectionIds must include at least one item");

    expect(db.prepare("SELECT COUNT(*) AS count FROM system_events").get()).toMatchObject({ count: 0 });
  });
});
