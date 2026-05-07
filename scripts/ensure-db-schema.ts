import { ensureDbSchema, closeDbConnection } from "../src/lib/db";

try {
  ensureDbSchema();
  closeDbConnection();
} catch (error) {
  console.error("Failed to initialize database schema:", error);
  process.exit(1);
}
