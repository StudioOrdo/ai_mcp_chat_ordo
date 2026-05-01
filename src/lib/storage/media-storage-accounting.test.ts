import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { UserFileDataMapper } from "@/adapters/UserFileDataMapper";
import { ensureSchema } from "@/lib/db/schema";
import {
  getFleetMediaStorageAccount,
  reconcileMediaStorage,
  summarizeUserFilesForAccounting,
} from "./media-storage-accounting";

function createDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedUser(db: Database.Database, id = "usr_test") {
  db.prepare(
    `INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, 'Test')`,
  ).run(id, `${id}@test.com`);
  db.prepare(
    `INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'role_authenticated')`,
  ).run(id);
}

function seedConversation(db: Database.Database, id = "conv_1", userId = "usr_test") {
  db.prepare(
    `INSERT OR IGNORE INTO conversations (id, user_id, title) VALUES (?, ?, 'Test Conv')`,
  ).run(id, userId);
}

function writeDiskFile(rootPath: string, userId: string, fileName: string, byteLength: number): void {
  const diskPath = path.join(rootPath, userId, fileName);
  fs.mkdirSync(path.dirname(diskPath), { recursive: true });
  fs.writeFileSync(diskPath, Buffer.alloc(byteLength, 1));
}

describe("media-storage-accounting", () => {
  let db: Database.Database;
  let mapper: UserFileDataMapper;

  beforeEach(() => {
    db = createDb();
    seedUser(db);
    seedUser(db, "usr_other");
    seedConversation(db);
    seedConversation(db, "conv_other", "usr_other");
    mapper = new UserFileDataMapper(db);
  });

  it("builds a reusable fleet storage account with grouped totals and rankings", async () => {
    await mapper.create({
      id: "uf_accounting_1",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "accounting-1",
      fileType: "image",
      fileName: "accounting-1.png",
      mimeType: "image/png",
      fileSize: 1200,
      metadata: { source: "uploaded", retentionClass: "ephemeral" },
    });
    await mapper.create({
      id: "uf_accounting_2",
      userId: "usr_other",
      conversationId: "conv_other",
      status: "ready",
      contentHash: "accounting-2",
      fileType: "video",
      fileName: "accounting-2.mp4",
      mimeType: "video/mp4",
      fileSize: 5400,
      metadata: { source: "derived", retentionClass: "durable" },
    });

    const account = await getFleetMediaStorageAccount(mapper, {
      topUsersLimit: 2,
      topFileTypesLimit: 2,
    });

    expect(account.summary.totalFiles).toBe(2);
    expect(account.summary.totalBytes).toBe(6600);
    expect(account.summary.byRetentionClass.durable).toEqual({ files: 1, bytes: 5400 });
    expect(account.summary.bySource.derived).toEqual({ files: 1, bytes: 5400 });
    expect(account.topUsers).toEqual([
      { userId: "usr_other", totalFiles: 1, totalBytes: 5400 },
      { userId: "usr_test", totalFiles: 1, totalBytes: 1200 },
    ]);
    expect(account.topFileTypes).toEqual([
      { fileType: "video", files: 1, bytes: 5400 },
      { fileType: "image", files: 1, bytes: 1200 },
    ]);
  });

  it("reconciles database and disk totals when storage is aligned", async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "media-storage-"));

    await mapper.create({
      id: "uf_reconcile_1",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "reconcile-1",
      fileType: "audio",
      fileName: "reconcile-1.mp3",
      mimeType: "audio/mpeg",
      fileSize: 256,
      metadata: { source: "generated", retentionClass: "ephemeral" },
    });
    await mapper.create({
      id: "uf_reconcile_2",
      userId: "usr_other",
      conversationId: "conv_other",
      status: "ready",
      contentHash: "reconcile-2",
      fileType: "video",
      fileName: "reconcile-2.mp4",
      mimeType: "video/mp4",
      fileSize: 512,
      metadata: { source: "uploaded", retentionClass: "conversation" },
    });

    writeDiskFile(rootPath, "usr_test", "reconcile-1.mp3", 256);
    writeDiskFile(rootPath, "usr_other", "reconcile-2.mp4", 512);

    const report = await reconcileMediaStorage(mapper, { rootPath, topUsersLimit: 2 });

    expect(report.db.totalBytes).toBe(768);
    expect(report.disk.totalBytes).toBe(768);
    expect(report.delta).toEqual({ files: 0, bytes: 0 });
    expect(report.orphanCandidateTotals.unattachedFiles).toBe(1);
    expect(report.orphanCandidateTotals.missingOnDiskFiles).toBe(0);
    expect(report.orphanCandidateTotals.diskOnlyFiles).toBe(0);
  });

  it("reports missing and disk-only media files during reconciliation", async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "media-storage-drift-"));

    await mapper.create({
      id: "uf_drift_db_present",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "drift-present",
      fileType: "image",
      fileName: "drift-present.png",
      mimeType: "image/png",
      fileSize: 100,
      metadata: { source: "uploaded", retentionClass: "ephemeral" },
    });
    await mapper.create({
      id: "uf_drift_missing",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "drift-missing",
      fileType: "document",
      fileName: "drift-missing.pdf",
      mimeType: "application/pdf",
      fileSize: 300,
      metadata: {},
    });

    writeDiskFile(rootPath, "usr_test", "drift-present.png", 100);
    writeDiskFile(rootPath, "usr_extra", "orphan.bin", 80);

    const report = await reconcileMediaStorage(mapper, { rootPath, topUsersLimit: 2 });

    expect(report.delta).toEqual({ files: 0, bytes: -220 });
    expect(report.db.totalFiles).toBe(2);
    expect(report.disk.totalFiles).toBe(2);
    expect(report.orphanCandidateTotals.missingOnDiskFiles).toBe(1);
    expect(report.orphanCandidateTotals.missingOnDiskBytes).toBe(300);
    expect(report.orphanCandidateTotals.diskOnlyFiles).toBe(1);
    expect(report.orphanCandidateTotals.diskOnlyBytes).toBe(80);
  });

  it("can summarize loaded files through the canonical projection defaults", () => {
    const summary = summarizeUserFilesForAccounting([
      {
        id: "uf_projection_1",
        userId: "usr_test",
        conversationId: null,
        status: "ready",
        contentHash: "projection-1",
        fileType: "subtitle",
        fileName: "projection-1.vtt",
        mimeType: "text/vtt",
        fileSize: 90,
        metadata: {},
        createdAt: "2026-04-15T00:00:00.000Z",
      },
      {
        id: "uf_projection_2",
        userId: "usr_test",
        conversationId: "conv_1",
        status: "ready",
        contentHash: "projection-2",
        fileType: "document",
        fileName: "projection-2.pdf",
        mimeType: "application/pdf",
        fileSize: 110,
        metadata: { retentionClass: "durable" },
        createdAt: "2026-04-15T00:00:01.000Z",
      },
    ]);

    expect(summary.totalBytes).toBe(200);
    expect(summary.bySource.generated).toEqual({ files: 1, bytes: 90 });
    expect(summary.bySource.uploaded).toEqual({ files: 1, bytes: 110 });
    expect(summary.byRetentionClass.ephemeral).toEqual({ files: 1, bytes: 90 });
    expect(summary.byRetentionClass.durable).toEqual({ files: 1, bytes: 110 });
  });
});