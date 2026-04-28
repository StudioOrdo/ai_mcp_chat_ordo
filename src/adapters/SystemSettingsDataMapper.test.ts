import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { SystemSettingsDataMapper } from "./SystemSettingsDataMapper";

describe("SystemSettingsDataMapper", () => {
  let db: Database.Database;
  let mapper: SystemSettingsDataMapper;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    mapper = new SystemSettingsDataMapper(db);
  });

  afterEach(() => {
    db.close();
  });

  it("can set and get a sync value", () => {
    mapper.setSync("TEST_KEY", JSON.stringify("my_value"));
    const result = mapper.getSync("TEST_KEY");
    expect(result).not.toBeNull();
    expect(result?.key).toBe("TEST_KEY");
    expect(result?.valueJson).toBe(JSON.stringify("my_value"));
  });

  it("returns null for non-existent sync key", () => {
    const result = mapper.getSync("NON_EXISTENT");
    expect(result).toBeNull();
  });

  it("can set and get an async value", async () => {
    await mapper.set("ASYNC_KEY", JSON.stringify("async_val"));
    const result = await mapper.get("ASYNC_KEY");
    expect(result?.valueJson).toBe(JSON.stringify("async_val"));
  });

  it("can retrieve all values", async () => {
    mapper.setSync("KEY_A", JSON.stringify("A"));
    mapper.setSync("KEY_B", JSON.stringify("B"));

    const all = await mapper.getAll();
    expect(all.length).toBe(2);
    expect(all[0].key).toBe("KEY_A");
    expect(all[1].key).toBe("KEY_B");
  });

  it("can delete a value", async () => {
    mapper.setSync("DELETE_ME", JSON.stringify("x"));
    await mapper.delete("DELETE_ME");
    const result = mapper.getSync("DELETE_ME");
    expect(result).toBeNull();
  });
});
