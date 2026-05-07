import { describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { ensureSchema } from "@/lib/db/schema";
import { BackupPolicyDataMapper } from "@/adapters/BackupPolicyDataMapper";
import { BackupSnapshotDataMapper } from "@/adapters/BackupSnapshotDataMapper";
import { BackupSystemCommandDataMapper } from "@/adapters/BackupSystemCommandDataMapper";
import { BackupRestoreAuditDataMapper } from "@/adapters/BackupRestoreAuditDataMapper";
import { RestorePlanDataMapper } from "@/adapters/RestorePlanDataMapper";
import { BackupScheduledCommandService } from "./backup-scheduled-command-service";
import { BackupScheduleService } from "./backup-schedule-service";
import { BackupPolicyService } from "./backup-policy-service";
import { BackupScheduleReconciler } from "./backup-schedule-reconciler";
import { BackupRetentionService, type BackupArchiveStore } from "./backup-retention-service";
import { ResourcePressureService } from "@/lib/appliance/resources/resource-pressure-service";
import { DEFAULT_APPLIANCE_RESOURCE_POLICY } from "@/lib/appliance/resources/appliance-resource-policy";

function harness() {
  const db = new Database(":memory:");
  ensureSchema(db);
  const policy = new BackupPolicyDataMapper(db);
  const snapshots = new BackupSnapshotDataMapper(db);
  const commands = new BackupSystemCommandDataMapper(db);
  const audit = new BackupRestoreAuditDataMapper(db);
  const plans = new RestorePlanDataMapper(db);
  return { db, policy, snapshots, commands, audit, plans };
}

describe("backup automatic schedule services", () => {
  it("updates policy without clearing existing latest backup metadata", async () => {
    const h = harness();
    await h.policy.getOrCreateDefaultPolicy();
    const existing = await h.snapshots.createPending({ kind: "manual", createdByUserId: null });
    await h.policy.updateDefaultPolicy({
      enabled: true,
      interval: "daily",
      retentionCount: 7,
      latestSuccessfulBackupId: existing.id,
      lastScheduledAt: "2026-05-01T00:00:00.000Z",
      nextScheduledAt: "2026-05-02T00:00:00.000Z",
      updatedByUserId: null,
    });
    const service = new BackupPolicyService({
      policy: h.policy,
      audit: h.audit,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
    });

    const updated = await service.updatePolicy({
      enabled: true,
      interval: "weekly",
      retentionCount: 14,
    }, { userId: null, role: "ADMIN", requestedFrom: "test" });

    expect(updated.latestSuccessfulBackupId).toBe(existing.id);
    expect(updated.lastScheduledAt).toBe("2026-05-01T00:00:00.000Z");
    expect(updated.interval).toBe("weekly");
    h.db.close();
  });

  it("enqueues one due scheduled backup and blocks a duplicate while command is pending", async () => {
    const h = harness();
    await h.policy.getOrCreateDefaultPolicy();
    await h.policy.updateDefaultPolicy({
      enabled: true,
      interval: "daily",
      retentionCount: 7,
      latestSuccessfulBackupId: null,
      lastScheduledAt: null,
      nextScheduledAt: "2026-05-02T00:00:00.000Z",
      updatedByUserId: null,
    });
    const scheduler = new BackupScheduleService({
      policy: h.policy,
      commands: h.commands,
      plans: h.plans,
      scheduledCommands: new BackupScheduledCommandService({
        db: h.db,
        now: () => new Date("2026-05-02T12:00:00.000Z"),
      }),
      audit: h.audit,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
      isExecutorAvailable: () => true,
    });

    const first = await scheduler.runOnce();
    const second = await scheduler.runOnce();

    expect(first.result?.snapshot.kind).toBe("scheduled");
    expect(first.result?.command.payload.kind).toBe("scheduled");
    expect(second.decision.action).toBe("blocked");
    expect(await h.commands.listRecentBackupRestore(10)).toHaveLength(1);
    h.db.close();
  });

  it("blocks scheduled backup before command creation when capacity is unsafe", async () => {
    const h = harness();
    await h.policy.getOrCreateDefaultPolicy();
    await h.policy.updateDefaultPolicy({
      enabled: true,
      interval: "daily",
      retentionCount: 7,
      latestSuccessfulBackupId: null,
      lastScheduledAt: null,
      nextScheduledAt: "2026-05-02T00:00:00.000Z",
      updatedByUserId: null,
    });
    const scheduler = new BackupScheduleService({
      policy: h.policy,
      commands: h.commands,
      plans: h.plans,
      scheduledCommands: new BackupScheduledCommandService({
        db: h.db,
        now: () => new Date("2026-05-02T12:00:00.000Z"),
      }),
      audit: h.audit,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
      isExecutorAvailable: () => true,
      resources: new ResourcePressureService({
        getPolicy: () => ({
          ...DEFAULT_APPLIANCE_RESOURCE_POLICY,
          dataFreeWarnBytes: 200,
          dataFreeWarnPercent: 20,
          dataFreeBlockBytes: 100,
          dataFreeBlockPercent: 10,
        }),
        getCapacity: async () => ({
          status: "available",
          checkedAt: "2026-05-02T12:00:00.000Z",
          rootPath: "/app/.data",
          totalBytes: 1000,
          freeBytes: 50,
          usedBytes: 950,
          percentUsed: 95,
        }),
      }),
    });

    const result = await scheduler.runOnce();

    expect(result.decision.action).toBe("blocked");
    if (result.decision.action !== "blocked") {
      throw new Error("Expected blocked schedule decision.");
    }
    expect(result.decision.reason).toMatch(/scheduled backup/i);
    expect(await h.commands.listRecentBackupRestore(10)).toHaveLength(0);
    expect(await h.snapshots.listRecent(10)).toHaveLength(0);
    h.db.close();
  });

  it("reconciles a Rust-completed scheduled backup and runs retention through the archive store", async () => {
    const h = harness();
    await h.policy.getOrCreateDefaultPolicy();
    const oldSnapshot = await h.snapshots.createPending({ kind: "scheduled", createdByUserId: null });
    await h.snapshots.markSucceeded({
      id: oldSnapshot.id,
      archivePath: "/tmp/ordo/backups/old.zip",
      archiveHash: `sha256:${"a".repeat(64)}`,
      archiveSizeBytes: 10,
      manifestSchemaVersion: "1",
      appVersion: "0.1.0",
    });
    h.db.prepare(`UPDATE backup_snapshots SET validated_at = ? WHERE id = ?`).run("2026-05-01T12:00:00.000Z", oldSnapshot.id);
    const newSnapshot = await h.snapshots.createPending({ kind: "scheduled", createdByUserId: null });
    await h.snapshots.markSucceeded({
      id: newSnapshot.id,
      archivePath: "/tmp/ordo/backups/new.zip",
      archiveHash: `sha256:${"b".repeat(64)}`,
      archiveSizeBytes: 12,
      manifestSchemaVersion: "1",
      appVersion: "0.1.0",
    });
    h.db.prepare(`UPDATE backup_snapshots SET validated_at = ? WHERE id = ?`).run("2026-05-02T12:00:00.000Z", newSnapshot.id);
    await h.commands.enqueue({
      target: "rust_daemon",
      command: "backup.create",
      status: "succeeded",
      payload: {
        kind: "scheduled",
        requestedAt: "2026-05-02T12:00:00.000Z",
        snapshotId: newSnapshot.id,
        appVersion: "0.1.0",
        sourceRuntimeProfileId: "test",
        dataBoundary: {
          dataDir: "/tmp/ordo",
          sqlitePath: "/tmp/ordo/local.db",
          blogAssetRoot: "/tmp/ordo/blog-assets",
          userFileRoot: "/tmp/ordo/user-files",
        },
      },
      requestedByUserId: null,
      requestedByRole: null,
      requestedFrom: "backup_scheduler",
    });
    await h.policy.updateDefaultPolicy({
      enabled: true,
      interval: "daily",
      retentionCount: 1,
      latestSuccessfulBackupId: null,
      lastScheduledAt: "2026-05-02T12:00:00.000Z",
      nextScheduledAt: "2026-05-03T12:00:00.000Z",
      updatedByUserId: null,
    });
    const archiveStore: BackupArchiveStore = { deleteArchive: vi.fn(async () => undefined) };
    const reconciler = new BackupScheduleReconciler({
      policy: h.policy,
      commands: h.commands,
      snapshots: h.snapshots,
      audit: h.audit,
      retention: new BackupRetentionService({ snapshots: h.snapshots, audit: h.audit, archiveStore }),
    });

    const result = await reconciler.reconcile();
    const updated = await h.policy.getOrCreateDefaultPolicy();

    expect(result.promotedSnapshotId).toBe(newSnapshot.id);
    expect(updated.latestSuccessfulBackupId).toBe(newSnapshot.id);
    expect(archiveStore.deleteArchive).toHaveBeenCalledWith("/tmp/ordo/backups/old.zip");
    expect((await h.snapshots.findById(oldSnapshot.id))?.status).toBe("deleted");
    h.db.close();
  });
});
