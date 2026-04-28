import type Database from "better-sqlite3";
import type {
  SystemSetting,
  SystemSettingsRepository,
} from "@/core/ports/SystemSettingsRepository";

export class SystemSettingsDataMapper implements SystemSettingsRepository {
  constructor(private readonly db: Database.Database) {}

  async getAll(): Promise<SystemSetting[]> {
    const rows = this.db
      .prepare(
        "SELECT key, value_json, updated_at FROM system_settings ORDER BY key",
      )
      .all() as Array<{
      key: string;
      value_json: string;
      updated_at: string;
    }>;
    return rows.map((r) => ({
      key: r.key,
      valueJson: r.value_json,
      updatedAt: r.updated_at,
    }));
  }

  async get(key: string): Promise<SystemSetting | null> {
    return this.getSync(key);
  }

  getSync(key: string): SystemSetting | null {
    const row = this.db
      .prepare(
        "SELECT key, value_json, updated_at FROM system_settings WHERE key = ?",
      )
      .get(key) as
      | { key: string; value_json: string; updated_at: string }
      | undefined;
    return row
      ? { key: row.key, valueJson: row.value_json, updatedAt: row.updated_at }
      : null;
  }

  async set(key: string, valueJson: string): Promise<void> {
    this.setSync(key, valueJson);
  }

  setSync(key: string, valueJson: string): void {
    this.db
      .prepare(
        `INSERT INTO system_settings (key, value_json, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      )
      .run(key, valueJson);
  }

  async delete(key: string): Promise<void> {
    this.db
      .prepare("DELETE FROM system_settings WHERE key = ?")
      .run(key);
  }
}
