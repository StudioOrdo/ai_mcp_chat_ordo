import { ensureDbSchema } from "@/lib/db";
import {
  createProbeResult,
  type ApplianceHealthProbe,
} from "@/lib/appliance/health-types";

export type SqliteHealthChecker = () => void | Promise<void>;

export interface SqliteProbeOptions {
  check?: SqliteHealthChecker;
}

export function createSqliteProbe(options: SqliteProbeOptions = {}): ApplianceHealthProbe {
  const check = options.check ?? ensureDbSchema;

  return {
    component: "sqlite",
    async run(context) {
      try {
        await check();
        return createProbeResult({
          component: "sqlite",
          impact: "required",
          status: "healthy",
          checkedAt: context.generatedAt,
          summary: "SQLite schema is reachable.",
          metadata: {
            sqlitePath: context.dataBoundary.sqlitePath,
            sqliteInsideDataDir: context.dataBoundary.sqliteInsideDataDir,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "SQLite schema check failed.";
        return createProbeResult({
          component: "sqlite",
          impact: "required",
          status: "blocked",
          checkedAt: context.generatedAt,
          summary: message,
          remediation: "Verify DATA_DIR is writable and the SQLite database can be opened.",
          metadata: {
            sqlitePath: context.dataBoundary.sqlitePath,
            sqliteInsideDataDir: context.dataBoundary.sqliteInsideDataDir,
          },
          warnings: [message],
        });
      }
    },
  };
}

