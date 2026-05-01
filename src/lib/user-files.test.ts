import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import fs from "fs";

// Create a temp dir and override process.cwd BEFORE user-files.ts loads,
// so USER_FILES_ROOT resolves inside the temp directory.
const tmpBase = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _fs = require("fs") as typeof fs;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _path = require("path") as { join: (...parts: string[]) => string };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _os = require("os") as { tmpdir: () => string };
  const dir = _fs.mkdtempSync(_path.join(_os.tmpdir(), "ufs-test-"));
  const origCwd = process.cwd;
  process.cwd = () => dir;
  return { dir, origCwd };
});

import Database from "better-sqlite3";
import { ensureSchema } from "./db/schema";
import { UserFileDataMapper } from "../adapters/UserFileDataMapper";
import {
  binaryContentHash,
  CHAT_UPLOAD_REAPER_TTL_MINUTES,
  UserFileQuotaExceededError,
  UserFileSystem,
  contentHash,
  getUserFilePath,
} from "./user-files";

afterAll(() => {
  process.cwd = tmpBase.origCwd;
  fs.rmSync(tmpBase.dir, { recursive: true, force: true });
});

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
    `INSERT OR IGNORE INTO conversations (id, user_id, title, status, session_source)
     VALUES (?, ?, 'Test Conversation', 'active', 'authenticated')`,
  ).run(id, userId);
}

describe("contentHash", () => {
  it("returns a 32-char hex string", () => {
    const hash = contentHash("Hello world");
    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic", () => {
    expect(contentHash("test input")).toBe(contentHash("test input"));
  });

  it("produces different hashes for different inputs", () => {
    expect(contentHash("input A")).not.toBe(contentHash("input B"));
  });
});

describe("UserFileSystem", () => {
  let db: Database.Database;
  let ufs: UserFileSystem;

  beforeEach(() => {
    db = createDb();
    seedUser(db);
    const repo = new UserFileDataMapper(db);
    ufs = new UserFileSystem(repo);
  });

  it("store() writes file to disk and creates DB record", async () => {
    const data = Buffer.from("fake mp3 data");
    const file = await ufs.store({
      userId: "usr_test",
      conversationId: null,
      input: "Hello world",
      fileType: "audio",
      mimeType: "audio/mpeg",
      extension: "mp3",
      data,
    });

    expect(file.id).toMatch(/^uf_/);
    expect(file.userId).toBe("usr_test");
    expect(file.fileType).toBe("audio");
    expect(file.mimeType).toBe("audio/mpeg");
    expect(file.fileSize).toBe(data.length);
    expect(file.contentHash).toBe(contentHash("Hello world"));
    expect(file.fileName).toBe(`${contentHash("Hello world")}.mp3`);
    expect(file.metadata).toEqual({});

    // Verify file exists on disk
    const diskPath = getUserFilePath("usr_test", file.fileName);
    expect(fs.existsSync(diskPath)).toBe(true);
    expect(fs.readFileSync(diskPath).toString()).toBe("fake mp3 data");
  });

  it("lookup() returns cached file when it exists", async () => {
    const data = Buffer.from("cached audio");
    await ufs.store({
      userId: "usr_test",
      conversationId: null,
      input: "Lookup test",
      fileType: "audio",
      mimeType: "audio/mpeg",
      extension: "mp3",
      data,
    });

    const result = await ufs.lookup("usr_test", "Lookup test", "audio");
    expect(result).not.toBeNull();
    expect(result?.file.contentHash).toBe(contentHash("Lookup test"));
    expect(fs.existsSync(result?.diskPath ?? "")).toBe(true);
  });

  it("lookup() returns null for cache miss", async () => {
    const result = await ufs.lookup("usr_test", "No such content", "audio");
    expect(result).toBeNull();
  });

  it("lookup() cleans up DB record if file was deleted from disk", async () => {
    const data = Buffer.from("will be deleted");
    const file = await ufs.store({
      userId: "usr_test",
      conversationId: null,
      input: "Orphan test",
      fileType: "audio",
      mimeType: "audio/mpeg",
      extension: "mp3",
      data,
    });

    // Delete the file from disk
    const diskPath = getUserFilePath("usr_test", file.fileName);
    fs.unlinkSync(diskPath);

    // lookup should return null and clean up DB
    const result = await ufs.lookup("usr_test", "Orphan test", "audio");
    expect(result).toBeNull();

    // DB record should be gone
    const dbCheck = db
      .prepare(`SELECT * FROM user_files WHERE id = ?`)
      .get(file.id);
    expect(dbCheck).toBeUndefined();
  });

  it("getById() returns file when it exists", async () => {
    const data = Buffer.from("getById test");
    const stored = await ufs.store({
      userId: "usr_test",
      conversationId: null,
      input: "GetById",
      fileType: "audio",
      mimeType: "audio/mpeg",
      extension: "mp3",
      data,
    });

    const result = await ufs.getById(stored.id);
    expect(result).not.toBeNull();
    expect(result?.file.id).toBe(stored.id);
  });

  it("getById() returns null for unknown id", async () => {
    const result = await ufs.getById("uf_nonexistent");
    expect(result).toBeNull();
  });

  it("getById() cleans up orphaned DB record", async () => {
    const data = Buffer.from("orphan getById");
    const stored = await ufs.store({
      userId: "usr_test",
      conversationId: null,
      input: "Orphan GetById",
      fileType: "audio",
      mimeType: "audio/mpeg",
      extension: "mp3",
      data,
    });

    // Delete disk file
    const diskPath = getUserFilePath("usr_test", stored.fileName);
    fs.unlinkSync(diskPath);

    const result = await ufs.getById(stored.id);
    expect(result).toBeNull();
  });

  it("same content produces same hash (dedup key)", async () => {
    const data1 = Buffer.from("audio bytes v1");
    const file1 = await ufs.store({
      userId: "usr_test",
      conversationId: null,
      input: "Same text",
      fileType: "audio",
      mimeType: "audio/mpeg",
      extension: "mp3",
      data: data1,
    });

    // Lookup should hit the first stored file
    const cached = await ufs.lookup("usr_test", "Same text", "audio");
    expect(cached).not.toBeNull();
    expect(cached?.file.id).toBe(file1.id);
  });

  it("promotes an existing unattached generated asset instead of creating a duplicate row", async () => {
    seedConversation(db);

    const first = await ufs.store({
      userId: "usr_test",
      conversationId: null,
      input: "Promote me",
      fileType: "audio",
      mimeType: "audio/mpeg",
      extension: "mp3",
      data: Buffer.from("first version"),
      metadata: { source: "generated", retentionClass: "ephemeral" },
    });

    const second = await ufs.store({
      userId: "usr_test",
      conversationId: "conv_1",
      input: "Promote me",
      fileType: "audio",
      mimeType: "audio/mpeg",
      extension: "mp3",
      data: Buffer.from("second version"),
      metadata: { source: "generated", retentionClass: "conversation" },
    });

    expect(second.id).toBe(first.id);
    expect(second.conversationId).toBe("conv_1");
    expect(second.metadata.retentionClass).toBe("conversation");

    const rowCount = db
      .prepare(`SELECT COUNT(*) as count FROM user_files WHERE user_id = ? AND content_hash = ? AND file_type = 'audio'`)
      .get("usr_test", contentHash("Promote me")) as { count: number };
    expect(rowCount.count).toBe(1);
  });

  it("reuses an existing conversation-owned generated asset for later identical unattached writes", async () => {
    seedConversation(db);

    const first = await ufs.store({
      userId: "usr_test",
      conversationId: "conv_1",
      input: "Conversation-owned",
      fileType: "audio",
      mimeType: "audio/mpeg",
      extension: "mp3",
      data: Buffer.from("conversation bytes"),
      metadata: { source: "generated", retentionClass: "conversation" },
    });

    const second = await ufs.store({
      userId: "usr_test",
      conversationId: null,
      input: "Conversation-owned",
      fileType: "audio",
      mimeType: "audio/mpeg",
      extension: "mp3",
      data: Buffer.from("ephemeral bytes"),
      metadata: { source: "generated", retentionClass: "ephemeral" },
    });

    expect(second.id).toBe(first.id);
    expect(second.conversationId).toBe("conv_1");

    const rowCount = db
      .prepare(`SELECT COUNT(*) as count FROM user_files WHERE user_id = ? AND content_hash = ? AND file_type = 'audio'`)
      .get("usr_test", contentHash("Conversation-owned")) as { count: number };
    expect(rowCount.count).toBe(1);
  });

  it("deleteIfUnattached() removes unattached file records and disk content", async () => {
    const data = Buffer.from("temporary file");
    const stored = await ufs.storeBinary({
      userId: "usr_test",
      conversationId: null,
      fileType: "document",
      mimeType: "text/plain",
      extension: "txt",
      data,
    });

    const deleted = await ufs.deleteIfUnattached(stored.id, "usr_test");

    expect(deleted).toBe(true);
    expect(fs.existsSync(getUserFilePath("usr_test", stored.fileName))).toBe(false);
    expect(await ufs.getById(stored.id)).toBeNull();
  });

  it("deleteIfUnattached() preserves files already linked to a conversation", async () => {
    seedConversation(db);

    const data = Buffer.from("linked file");
    const stored = await ufs.storeBinary({
      userId: "usr_test",
      conversationId: "conv_1",
      fileType: "document",
      mimeType: "text/plain",
      extension: "txt",
      data,
    });

    const deleted = await ufs.deleteIfUnattached(stored.id, "usr_test");

    expect(deleted).toBe(false);
    expect(await ufs.getById(stored.id)).not.toBeNull();
  });

  it("storeBinaryBatchWithinQuota() persists a full batch atomically under quota", async () => {
    const result = await ufs.storeBinaryBatchWithinQuota({
      userId: "usr_test",
      conversationId: null,
      quotaPolicy: {
        defaultUserQuotaBytes: 100,
        hardBlockUploadsAtQuota: true,
        warnAtPercent: 80,
      },
      files: [
        {
          fileType: "document",
          mimeType: "text/plain",
          extension: "txt",
          data: Buffer.from("hello"),
          metadata: { source: "uploaded", retentionClass: "ephemeral" },
        },
        {
          fileType: "image",
          mimeType: "image/png",
          extension: "png",
          data: Buffer.from("world!!"),
          metadata: { source: "uploaded", retentionClass: "ephemeral", assetKind: "image" },
        },
      ],
    });

    expect(result.files).toHaveLength(2);
    expect(result.incomingBytes).toBe(12);
    expect(result.quota.usedBytes).toBe(12);
    expect(result.quota.status).toBe("normal");
    const [firstStoredFile, secondStoredFile] = result.files;
    expect(firstStoredFile).toBeDefined();
    expect(secondStoredFile).toBeDefined();
    if (!firstStoredFile || !secondStoredFile) {
      throw new Error("Expected the stored batch to contain two files.");
    }
    expect(await ufs.getById(firstStoredFile.id)).not.toBeNull();
    expect(await ufs.getById(secondStoredFile.id)).not.toBeNull();
  });

  it("storeBinaryBatchWithinQuota() rejects the whole batch and removes new disk files when hard quota would be crossed", async () => {
    await ufs.storeBinary({
      userId: "usr_test",
      conversationId: null,
      fileType: "document",
      mimeType: "text/plain",
      extension: "txt",
      data: Buffer.alloc(80, 1),
      metadata: { source: "uploaded", retentionClass: "ephemeral" },
    });

    const firstRejectedData = Buffer.from("123456789012345");
    const secondRejectedData = Buffer.from("1234567890");

    await expect(
      ufs.storeBinaryBatchWithinQuota({
        userId: "usr_test",
        conversationId: null,
        quotaPolicy: {
          defaultUserQuotaBytes: 90,
          hardBlockUploadsAtQuota: true,
          warnAtPercent: 80,
        },
        files: [
          {
            fileType: "document",
            mimeType: "text/plain",
            extension: "txt",
            data: firstRejectedData,
            metadata: { source: "uploaded", retentionClass: "ephemeral" },
          },
          {
            fileType: "document",
            mimeType: "text/plain",
            extension: "txt",
            data: secondRejectedData,
            metadata: { source: "uploaded", retentionClass: "ephemeral" },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UserFileQuotaExceededError);

    const files = await db.prepare(`SELECT id FROM user_files WHERE user_id = ?`).all("usr_test") as Array<{ id: string }>;
    expect(files).toHaveLength(1);
    expect(fs.existsSync(getUserFilePath("usr_test", `${binaryContentHash(firstRejectedData)}.txt`))).toBe(false);
    expect(fs.existsSync(getUserFilePath("usr_test", `${binaryContentHash(secondRejectedData)}.txt`))).toBe(false);
  });

  it("reapUnattachedFiles() removes only stale unattached files that match the requested type", async () => {
    seedConversation(db);

    const staleDocument = await ufs.storeBinary({
      userId: "usr_test",
      conversationId: null,
      fileType: "document",
      mimeType: "text/plain",
      extension: "txt",
      data: Buffer.from("stale document"),
    });
    const recentDocument = await ufs.storeBinary({
      userId: "usr_test",
      conversationId: null,
      fileType: "document",
      mimeType: "text/plain",
      extension: "txt",
      data: Buffer.from("recent document"),
    });
    const staleAudio = await ufs.store({
      userId: "usr_test",
      conversationId: null,
      input: "stale audio",
      fileType: "audio",
      mimeType: "audio/mpeg",
      extension: "mp3",
      data: Buffer.from("audio bytes"),
    });
    const attachedDocument = await ufs.storeBinary({
      userId: "usr_test",
      conversationId: "conv_1",
      fileType: "document",
      mimeType: "text/plain",
      extension: "txt",
      data: Buffer.from("attached document"),
    });

    db.prepare(
      `UPDATE user_files SET created_at = '2000-01-01 00:00:00' WHERE id IN (?, ?)`,
    ).run(staleDocument.id, staleAudio.id);

    const deletedIds = await ufs.reapUnattachedFiles({
      olderThanMinutes: CHAT_UPLOAD_REAPER_TTL_MINUTES,
      userId: "usr_test",
      fileType: "document",
    });

    expect(deletedIds).toEqual([staleDocument.id]);
    expect(await ufs.getById(staleDocument.id)).toBeNull();
    expect(await ufs.getById(recentDocument.id)).not.toBeNull();
    expect(await ufs.getById(staleAudio.id)).not.toBeNull();
    expect(await ufs.getById(attachedDocument.id)).not.toBeNull();
    expect(fs.existsSync(getUserFilePath("usr_test", staleDocument.fileName))).toBe(false);
  });

  it("persists typed media metadata with stored files", async () => {
    seedConversation(db);

    const stored = await ufs.storeBinary({
      userId: "usr_test",
      conversationId: "conv_1",
      fileType: "image",
      mimeType: "image/png",
      extension: "png",
      data: Buffer.from("png bytes"),
      metadata: {
        assetKind: "image",
        source: "uploaded",
        width: 1200,
        height: 630,
        retentionClass: "conversation",
      },
    });

    expect(stored.metadata).toEqual({
      assetKind: "image",
      source: "uploaded",
      width: 1200,
      height: 630,
      retentionClass: "conversation",
    });

    const loaded = await ufs.getById(stored.id);
    expect(loaded?.file.metadata).toEqual(stored.metadata);
  });

  it("allocatePending() creates a pending DB record that store() later upserts to ready", async () => {
    seedConversation(db);

    const pending = await ufs.allocatePending({
      userId: "usr_test",
      conversationId: "conv_1",
      fileType: "audio",
      metadata: {
        assetKind: "audio",
        source: "generated",
        retentionClass: "conversation",
      },
    });

    expect(pending.id).toMatch(/^uf_/);
    
    // DB record should be pending
    const dbRecord = db.prepare(`SELECT status FROM user_files WHERE id = ?`).get(pending.id) as { status: string };
    expect(dbRecord.status).toBe("pending");

    // Overwrite with store()
    const stored = await ufs.store({
      id: pending.id,
      userId: "usr_test",
      conversationId: "conv_1",
      input: "test audio",
      fileType: "audio",
      mimeType: "audio/mpeg",
      extension: "mp3",
      data: Buffer.from("audio bytes"),
    });

    expect(stored.id).toBe(pending.id);

    // DB record should now be ready
    const updatedRecord = db.prepare(`SELECT status FROM user_files WHERE id = ?`).get(pending.id) as { status: string };
    expect(updatedRecord.status).toBe("ready");

    const loaded = await ufs.getById(pending.id);
    expect(loaded?.file.status).toBe("ready");
    expect(loaded?.file.contentHash).toBe(contentHash("test audio"));
  });
});
