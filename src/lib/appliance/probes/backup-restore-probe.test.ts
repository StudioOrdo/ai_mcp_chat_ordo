import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { ensureSchema } from "@/lib/db/schema";
import { createBackupRestoreProbe } from "./backup-restore-probe";
import type { ApplianceHealthContext } from "../health-types";

const context = {
  generatedAt: "2026-05-02T00:00:00.000Z",
  timeoutMs: 750,
  profile: {} as ApplianceHealthContext["profile"],
  dataBoundary: {} as ApplianceHealthContext["dataBoundary"],
} satisfies ApplianceHealthContext;

describe("backup restore health probe", () => {
  it("reports disabled executor explicitly", async () => {
    const probe = createBackupRestoreProbe({
      env: { DISABLE_BACKUP_EXECUTOR: "1" },
    });

    const result = await probe.run(context);
    expect(result).toMatchObject({
      component: "backup_restore",
      status: "disabled",
      metadata: {
        executorDisabled: true,
      },
    });
  });

  it("reports unavailable executor binary", async () => {
    const probe = createBackupRestoreProbe({
      env: { ORDO_BACKUP_EXECUTOR_PATH: "/missing/ordo-backup" },
      fileExists: () => false,
    });

    const result = await probe.run(context);
    expect(result).toMatchObject({
      status: "degraded",
      metadata: {
        executorAvailable: false,
      },
    });
  });

  it("reports configured executor command state", async () => {
    const db = new Database(":memory:");
    ensureSchema(db);
    db.prepare(
      `INSERT INTO system_commands (id, target, command, status, payload_json, requested_from)
       VALUES ('cmd_1', 'rust_daemon', 'backup.create', 'failed', '{}', 'test')`,
    ).run();
    const probe = createBackupRestoreProbe({
      env: { ORDO_BACKUP_EXECUTOR_PATH: "/bin/ordo-backup" },
      fileExists: () => true,
      getDatabase: () => db,
    });

    const result = await probe.run(context);
    expect(result).toMatchObject({
      status: "degraded",
      metadata: {
        failedCommands: 1,
        executorAvailable: true,
      },
    });
    db.close();
  });

  it("ignores pre-governance rust daemon commands when reporting command state", async () => {
    const db = new Database(":memory:");
    ensureSchema(db);
    db.prepare(
      `INSERT INTO system_commands (id, target, command, status, payload_json, requested_from)
       VALUES ('legacy_cmd_1', 'rust_daemon', 'backup', 'running', '{}', 'test')`,
    ).run();
    const probe = createBackupRestoreProbe({
      env: { ORDO_BACKUP_EXECUTOR_PATH: "/bin/ordo-backup" },
      fileExists: () => true,
      getDatabase: () => db,
    });

    const result = await probe.run(context);
    expect(result).toMatchObject({
      status: "healthy",
      metadata: {
        pendingCommands: 0,
        runningCommands: 0,
        failedCommands: 0,
      },
    });
    db.close();
  });
});
