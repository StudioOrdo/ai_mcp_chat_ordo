import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensureSchema } from "@/lib/db/schema";

let db: Database.Database;

vi.mock("@/lib/db", () => ({
  getDb: () => db,
}));

import { searchAdminEntities } from "@/lib/admin/search/admin-search";

describe("searchAdminEntities", () => {
  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    ensureSchema(db);

    db.prepare(
      `INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)`
    ).run("usr_search", "alice@example.com", "Alice Operator", "2026-04-15T12:00:00.000Z");
  });

  it("returns user results through the full search union without requiring a users.updated_at column", async () => {
    const results = await searchAdminEntities("alice");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      entityType: "user",
      id: "usr_search",
      title: "Alice Operator",
      subtitle: "User — alice@example.com",
      href: "/admin/users/usr_search",
      matchField: "name",
      updatedAt: "2026-04-15T12:00:00.000Z",
    });
  });

  it("supports explicit all-user listing queries for admin user lookup", async () => {
    db.prepare(
      `INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)`
    ).run("usr_search_2", "keith@example.com", "Keith Williams", "2026-04-16T12:00:00.000Z");

    const results = await searchAdminEntities("*", { entityTypes: ["user"] });

    expect(results.map((result) => result.id)).toEqual(
      expect.arrayContaining(["usr_search_2", "usr_search"]),
    );
  });
});
