import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { ActivityReceiptDataMapper } from "@/adapters/ActivityReceiptDataMapper";
import { ensureSchema } from "@/lib/db/schema";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)")
    .run("usr_1", "user@example.com", "User");
  db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)")
    .run("usr_2", "other@example.com", "Other");
  return db;
}

describe("ActivityReceiptDataMapper", () => {
  it("creates the receipt schema with a user/source uniqueness contract", () => {
    const db = createDb();

    const columns = db.pragma("table_info(activity_receipts)") as Array<{ name: string }>;
    const indexes = db.pragma("index_list(activity_receipts)") as Array<{ name: string; unique: number }>;

    expect(columns.map((column) => column.name)).toEqual(expect.arrayContaining([
      "id",
      "user_id",
      "source_kind",
      "source_id",
      "read_at",
      "acknowledged_at",
      "dismissed_at",
      "pinned_at",
      "updated_at",
    ]));
    expect(indexes).toContainEqual(expect.objectContaining({
      name: "idx_activity_receipts_user_source",
      unique: 1,
    }));
  });

  it("upserts receipt state per user and source without duplicate rows", async () => {
    const db = createDb();
    const mapper = new ActivityReceiptDataMapper(db);

    await mapper.upsert(
      "usr_1",
      { sourceKind: "job", sourceId: "job_1" },
      { readAt: "2026-05-04T10:00:00.000Z" },
      "2026-05-04T10:00:00.000Z",
    );
    const updated = await mapper.upsert(
      "usr_1",
      { sourceKind: "job", sourceId: "job_1" },
      { acknowledgedAt: "2026-05-04T10:01:00.000Z", pinnedAt: "2026-05-04T10:01:00.000Z" },
      "2026-05-04T10:01:00.000Z",
    );

    expect(updated).toMatchObject({
      userId: "usr_1",
      sourceKind: "job",
      sourceId: "job_1",
      readAt: "2026-05-04T10:00:00.000Z",
      acknowledgedAt: "2026-05-04T10:01:00.000Z",
      pinnedAt: "2026-05-04T10:01:00.000Z",
      updatedAt: "2026-05-04T10:01:00.000Z",
    });
    expect(db.prepare("SELECT COUNT(*) AS count FROM activity_receipts").get())
      .toMatchObject({ count: 1 });
  });

  it("isolates receipts by user even when the source is the same", async () => {
    const db = createDb();
    const mapper = new ActivityReceiptDataMapper(db);

    await mapper.upsert(
      "usr_1",
      { sourceKind: "media_workflow", sourceId: "mwf_1" },
      { readAt: "2026-05-04T10:00:00.000Z" },
      "2026-05-04T10:00:00.000Z",
    );
    await mapper.upsert(
      "usr_2",
      { sourceKind: "media_workflow", sourceId: "mwf_1" },
      { dismissedAt: "2026-05-04T10:02:00.000Z" },
      "2026-05-04T10:02:00.000Z",
    );

    await expect(mapper.findByUserAndSource("usr_1", {
      sourceKind: "media_workflow",
      sourceId: "mwf_1",
    })).resolves.toMatchObject({ readAt: "2026-05-04T10:00:00.000Z", dismissedAt: null });
    await expect(mapper.findByUserAndSource("usr_2", {
      sourceKind: "media_workflow",
      sourceId: "mwf_1",
    })).resolves.toMatchObject({ readAt: null, dismissedAt: "2026-05-04T10:02:00.000Z" });
  });

  it("lists only requested source receipts", async () => {
    const db = createDb();
    const mapper = new ActivityReceiptDataMapper(db);

    await mapper.upsert("usr_1", { sourceKind: "job", sourceId: "job_1" }, { readAt: "r1" }, "r1");
    await mapper.upsert("usr_1", { sourceKind: "job", sourceId: "job_2" }, { readAt: "r2" }, "r2");

    await expect(mapper.listByUserAndSources("usr_1", [
      { sourceKind: "job", sourceId: "job_2" },
    ])).resolves.toEqual([
      expect.objectContaining({ sourceId: "job_2", readAt: "r2" }),
    ]);
    await expect(mapper.listByUserAndSources("usr_1", [])).resolves.toEqual([]);
  });

  it("rejects unknown source kinds and empty source ids", async () => {
    const db = createDb();
    const mapper = new ActivityReceiptDataMapper(db);

    await expect(mapper.upsert(
      "usr_1",
      { sourceKind: "unknown", sourceId: "x" } as never,
      { readAt: "now" },
    )).rejects.toThrow("Unknown activity source kind");
    await expect(mapper.upsert(
      "usr_1",
      { sourceKind: "job", sourceId: " " },
      { readAt: "now" },
    )).rejects.toThrow("Activity source id is required");
  });
});
