import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { ensureSchema } from "./schema";
import { resolveApplianceSqlitePath } from "@/lib/appliance/data-boundary";

let dbInstance: Database.Database | null = null;

function resolveDbPath(): string {
  return resolveApplianceSqlitePath();
}

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = resolveDbPath();
  const dataDir = path.dirname(dbPath);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Open the DB file
  dbInstance = new Database(dbPath);

  // Enforce declared foreign keys for runtime and appliance integrity.
  dbInstance.pragma("foreign_keys = ON");

  // Enable WAL mode for better concurrency performance
  dbInstance.pragma("journal_mode = WAL");

  // Wait up to 5s on lock contention before returning SQLITE_BUSY
  dbInstance.pragma("busy_timeout = 5000");

  // Create tables and seed mock data if first boot
  ensureSchema(dbInstance);

  return dbInstance;
}

export function withDb<T>(
  fn: (db: Database.Database) => Promise<T>,
): Promise<T>;
export function withDb<T>(fn: (db: Database.Database) => T): T;
export function withDb<T>(
  fn: (db: Database.Database) => T | Promise<T>,
): T | Promise<T> {
  const db = getDb();
  let result: T | Promise<T>;
  try {
    result = fn(db);
  } catch (err) {
    // In our connection-pooled model, we don't close the shared instance on error
    throw err;
  }
  return result;
}

export function ensureDbSchema(): void {
  getDb();
}

export function closeDbConnection(): void {
  if (!dbInstance) {
    return;
  }
  dbInstance.close();
  dbInstance = null;
}
