import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { ensureSchema } from "../lib/db/schema";
import { UserFileDataMapper } from "./UserFileDataMapper";

function requireValue<T>(value: T | null | undefined): T {
  expect(value).toBeTruthy();
  if (value == null) {
    throw new Error("Expected value to be present.");
  }
  return value;
}

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

describe("UserFileDataMapper", () => {
  let db: Database.Database;
  let mapper: UserFileDataMapper;

  beforeEach(() => {
    db = createDb();
    seedUser(db);
    seedConversation(db);
    mapper = new UserFileDataMapper(db);
  });

  it("create → findById lifecycle", async () => {
    const file = await mapper.create({
      id: "uf_001",
      userId: "usr_test",
      conversationId: "conv_1",
      status: "ready",
      contentHash: "abc123def456",
      fileType: "audio",
      fileName: "abc123def456.mp3",
      mimeType: "audio/mpeg",
      fileSize: 1024,
      metadata: {},
    });

    expect(file.id).toBe("uf_001");
    expect(file.userId).toBe("usr_test");
    expect(file.conversationId).toBe("conv_1");
    expect(file.contentHash).toBe("abc123def456");
    expect(file.fileType).toBe("audio");
    expect(file.fileName).toBe("abc123def456.mp3");
    expect(file.mimeType).toBe("audio/mpeg");
    expect(file.fileSize).toBe(1024);
    expect(file.metadata).toEqual({});
    expect(file.createdAt).toBeTruthy();

    const found = requireValue(await mapper.findById("uf_001"));
    expect(found.id).toBe("uf_001");
    expect(found.contentHash).toBe("abc123def456");
  });

  it("findById returns null for nonexistent id", async () => {
    const found = await mapper.findById("uf_nonexistent");
    expect(found).toBeNull();
  });

  it("findByHash returns matching file", async () => {
    await mapper.create({
      id: "uf_hash1",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "hashABC",
      fileType: "audio",
      fileName: "hashABC.mp3",
      mimeType: "audio/mpeg",
      fileSize: 512,
      metadata: {},
    });

    const found = requireValue(await mapper.findByHash("usr_test", "hashABC", "audio"));
    expect(found.id).toBe("uf_hash1");
  });

  it("findByHash distinguishes by fileType", async () => {
    await mapper.create({
      id: "uf_audio",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "sameHash",
      fileType: "audio",
      fileName: "sameHash.mp3",
      mimeType: "audio/mpeg",
      fileSize: 100,
      metadata: {},
    });

    const audioMatch = await mapper.findByHash("usr_test", "sameHash", "audio");
    expect(audioMatch).not.toBeNull();

    const chartMatch = await mapper.findByHash("usr_test", "sameHash", "chart");
    expect(chartMatch).toBeNull();
  });

  it("transfers conversation-scoped files from an anonymous identity to the signed-in owner", async () => {
    seedUser(db, "anon_seed");
    await mapper.create({
      id: "uf_anon",
      userId: "anon_seed",
      conversationId: "conv_1",
      status: "ready",
      contentHash: "hash_anon",
      fileType: "image",
      fileName: "hash_anon.png",
      mimeType: "image/png",
      fileSize: 512,
      metadata: {},
    });
    await mapper.create({
      id: "uf_existing",
      userId: "usr_test",
      conversationId: "conv_1",
      status: "ready",
      contentHash: "hash_existing",
      fileType: "image",
      fileName: "hash_existing.png",
      mimeType: "image/png",
      fileSize: 256,
      metadata: {},
    });

    const transferred = await mapper.transferOwnershipForConversations({
      conversationIds: ["conv_1", "conv_1"],
      previousUserId: "anon_seed",
      userId: "usr_test",
    });

    expect(transferred.map((file) => [file.id, file.userId])).toEqual([
      ["uf_anon", "usr_test"],
      ["uf_existing", "usr_test"],
    ]);
    await expect(mapper.findById("uf_anon")).resolves.toEqual(
      expect.objectContaining({ userId: "usr_test" }),
    );
  });

  it("findByHash distinguishes by userId", async () => {
    seedUser(db, "usr_other");
    await mapper.create({
      id: "uf_user1",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "sharedHash",
      fileType: "audio",
      fileName: "sharedHash.mp3",
      mimeType: "audio/mpeg",
      fileSize: 100,
      metadata: {},
    });

    const ownerMatch = await mapper.findByHash("usr_test", "sharedHash", "audio");
    expect(ownerMatch).not.toBeNull();

    const otherMatch = await mapper.findByHash("usr_other", "sharedHash", "audio");
    expect(otherMatch).toBeNull();
  });

  it("listByConversation returns files ordered by created_at ASC", async () => {
    await mapper.create({
      id: "uf_c1",
      userId: "usr_test",
      conversationId: "conv_1",
      status: "ready",
      contentHash: "h1",
      fileType: "audio",
      fileName: "h1.mp3",
      mimeType: "audio/mpeg",
      fileSize: 100,
      metadata: {},
    });
    await mapper.create({
      id: "uf_c2",
      userId: "usr_test",
      conversationId: "conv_1",
      status: "ready",
      contentHash: "h2",
      fileType: "chart",
      fileName: "h2.svg",
      mimeType: "image/svg+xml",
      fileSize: 200,
      metadata: {},
    });

    const files = await mapper.listByConversation("conv_1");
    expect(files.length).toBe(2);
    expect(files[0].id).toBe("uf_c1");
    expect(files[1].id).toBe("uf_c2");
  });

  it("listByUser returns files ordered by created_at DESC", async () => {
    await mapper.create({
      id: "uf_u1",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "h1",
      fileType: "audio",
      fileName: "h1.mp3",
      mimeType: "audio/mpeg",
      fileSize: 100,
      metadata: {},
    });
    // Force second file to have a later timestamp
    db.prepare(`UPDATE user_files SET created_at = '2099-01-01' WHERE id = 'uf_u1'`).run();
    await mapper.create({
      id: "uf_u2",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "h2",
      fileType: "audio",
      fileName: "h2.mp3",
      mimeType: "audio/mpeg",
      fileSize: 200,
      metadata: {},
    });

    const files = await mapper.listByUser("usr_test");
    expect(files.length).toBe(2);
    // DESC order: uf_u1 (2099) first, then uf_u2
    expect(files[0].id).toBe("uf_u1");
    expect(files[1].id).toBe("uf_u2");
  });

  it("delete removes the record", async () => {
    await mapper.create({
      id: "uf_del",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "hDel",
      fileType: "audio",
      fileName: "hDel.mp3",
      mimeType: "audio/mpeg",
      fileSize: 50,
      metadata: {},
    });

    const before = await mapper.findById("uf_del");
    expect(before).not.toBeNull();

    await mapper.delete("uf_del");

    const after = await mapper.findById("uf_del");
    expect(after).toBeNull();
  });

  it("supports null conversationId", async () => {
    const file = await mapper.create({
      id: "uf_null_conv",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "hNull",
      fileType: "document",
      fileName: "hNull.pdf",
      mimeType: "application/pdf",
      fileSize: 999,
      metadata: {},
    });

    expect(file.conversationId).toBeNull();
    expect(file.fileType).toBe("document");
  });

  it("listUnattachedCreatedBefore returns only stale unattached files that match the filters", async () => {
    seedUser(db, "usr_other");

    await mapper.create({
      id: "uf_stale_doc",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "stale-doc",
      fileType: "document",
      fileName: "stale-doc.txt",
      mimeType: "text/plain",
      fileSize: 10,
      metadata: {},
    });
    await mapper.create({
      id: "uf_recent_doc",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "recent-doc",
      fileType: "document",
      fileName: "recent-doc.txt",
      mimeType: "text/plain",
      fileSize: 10,
      metadata: {},
    });
    await mapper.create({
      id: "uf_stale_audio",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "stale-audio",
      fileType: "audio",
      fileName: "stale-audio.mp3",
      mimeType: "audio/mpeg",
      fileSize: 10,
      metadata: {},
    });
    await mapper.create({
      id: "uf_attached_doc",
      userId: "usr_test",
      conversationId: "conv_1",
      status: "ready",
      contentHash: "attached-doc",
      fileType: "document",
      fileName: "attached-doc.txt",
      mimeType: "text/plain",
      fileSize: 10,
      metadata: {},
    });
    await mapper.create({
      id: "uf_other_user",
      userId: "usr_other",
      conversationId: null,
      status: "ready",
      contentHash: "other-user",
      fileType: "document",
      fileName: "other-user.txt",
      mimeType: "text/plain",
      fileSize: 10,
      metadata: {},
    });

    db.prepare(
      `UPDATE user_files SET created_at = '2000-01-01 00:00:00' WHERE id IN ('uf_stale_doc', 'uf_stale_audio', 'uf_other_user')`,
    ).run();

    const staleDocs = await mapper.listUnattachedCreatedBefore(
      new Date("2026-03-15T00:00:00.000Z").toISOString(),
      { userId: "usr_test", fileType: "document" },
    );

    expect(staleDocs.map((file) => file.id)).toEqual(["uf_stale_doc"]);
  });

  it("round-trips typed media metadata through metadata_json", async () => {
    const file = await mapper.create({
      id: "uf_image_meta",
      userId: "usr_test",
      conversationId: "conv_1",
      status: "ready",
      contentHash: "img-hash",
      fileType: "image",
      fileName: "img-hash.png",
      mimeType: "image/png",
      fileSize: 2048,
      metadata: {
        assetKind: "image",
        source: "uploaded",
        width: 1200,
        height: 630,
        retentionClass: "conversation",
      },
    });

    expect(file.metadata).toEqual({
      assetKind: "image",
      source: "uploaded",
      width: 1200,
      height: 630,
      retentionClass: "conversation",
    });

    const storedRow = db
      .prepare(`SELECT metadata_json FROM user_files WHERE id = ?`)
      .get("uf_image_meta") as { metadata_json: string };

    expect(JSON.parse(storedRow.metadata_json)).toEqual(file.metadata);

    const loaded = requireValue(await mapper.findById("uf_image_meta"));
    expect(loaded.metadata).toEqual(file.metadata);
  });

  it("listForUser paginates with a created_at and id cursor tie-break", async () => {
    await mapper.create({
      id: "uf_page_c",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "page-c",
      fileType: "image",
      fileName: "page-c.png",
      mimeType: "image/png",
      fileSize: 300,
      metadata: { source: "uploaded", retentionClass: "ephemeral" },
    });
    await mapper.create({
      id: "uf_page_b",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "page-b",
      fileType: "audio",
      fileName: "page-b.mp3",
      mimeType: "audio/mpeg",
      fileSize: 200,
      metadata: { source: "generated", retentionClass: "ephemeral" },
    });
    await mapper.create({
      id: "uf_page_a",
      userId: "usr_test",
      conversationId: "conv_1",
      status: "ready",
      contentHash: "page-a",
      fileType: "video",
      fileName: "page-a.mp4",
      mimeType: "video/mp4",
      fileSize: 100,
      metadata: { source: "uploaded", retentionClass: "conversation" },
    });

    db.prepare(`UPDATE user_files SET created_at = '2026-04-01 00:00:00' WHERE id IN ('uf_page_a', 'uf_page_b', 'uf_page_c')`).run();

    const firstPage = await mapper.listForUser("usr_test", { limit: 2 });
    expect(firstPage.items.map((file) => file.id)).toEqual(["uf_page_c", "uf_page_b"]);
    expect(firstPage.nextCursor).toEqual({
      createdAt: "2026-04-01 00:00:00",
      id: "uf_page_b",
    });

    const secondPage = await mapper.listForUser("usr_test", {
      limit: 2,
      cursor: firstPage.nextCursor,
    });
    expect(secondPage.items.map((file) => file.id)).toEqual(["uf_page_a"]);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("listForUser applies typed filters without loading unrelated user files", async () => {
    seedUser(db, "usr_other");

    await mapper.create({
      id: "uf_filter_image",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "filter-image",
      fileType: "image",
      fileName: "roadmap-card.png",
      mimeType: "image/png",
      fileSize: 1024,
      metadata: { source: "uploaded", retentionClass: "ephemeral" },
    });
    await mapper.create({
      id: "uf_filter_video",
      userId: "usr_test",
      conversationId: "conv_1",
      status: "ready",
      contentHash: "filter-video",
      fileType: "video",
      fileName: "demo-video.mp4",
      mimeType: "video/mp4",
      fileSize: 2048,
      metadata: { source: "generated", retentionClass: "conversation" },
    });
    await mapper.create({
      id: "uf_filter_other_user",
      userId: "usr_other",
      conversationId: null,
      status: "ready",
      contentHash: "filter-other",
      fileType: "image",
      fileName: "roadmap-card.png",
      mimeType: "image/png",
      fileSize: 4096,
      metadata: { source: "uploaded", retentionClass: "ephemeral" },
    });

    const filtered = await mapper.listForUser("usr_test", {
      limit: 10,
      fileType: "image",
      source: "uploaded",
      retentionClass: "ephemeral",
      attached: false,
      search: "roadmap",
    });

    expect(filtered.items.map((file) => file.id)).toEqual(["uf_filter_image"]);
  });

  it("getUserStorageSummary returns totals and per-type breakdowns", async () => {
    await mapper.create({
      id: "uf_summary_image",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "summary-image",
      fileType: "image",
      fileName: "summary-image.png",
      mimeType: "image/png",
      fileSize: 1024,
      metadata: { source: "uploaded", retentionClass: "ephemeral" },
    });
    await mapper.create({
      id: "uf_summary_video",
      userId: "usr_test",
      conversationId: "conv_1",
      status: "ready",
      contentHash: "summary-video",
      fileType: "video",
      fileName: "summary-video.mp4",
      mimeType: "video/mp4",
      fileSize: 2048,
      metadata: { source: "generated", retentionClass: "conversation" },
    });

    const summary = await mapper.getUserStorageSummary("usr_test");

    expect(summary.totalFiles).toBe(2);
    expect(summary.totalBytes).toBe(3072);
    expect(summary.attachedFiles).toBe(1);
    expect(summary.attachedBytes).toBe(2048);
    expect(summary.unattachedFiles).toBe(1);
    expect(summary.unattachedBytes).toBe(1024);
    expect(summary.byType.image).toEqual({ files: 1, bytes: 1024 });
    expect(summary.byType.video).toEqual({ files: 1, bytes: 2048 });
    expect(summary.byType.audio).toEqual({ files: 0, bytes: 0 });
    expect(summary.byRetentionClass.ephemeral).toEqual({ files: 1, bytes: 1024 });
    expect(summary.byRetentionClass.conversation).toEqual({ files: 1, bytes: 2048 });
    expect(summary.bySource.uploaded).toEqual({ files: 1, bytes: 1024 });
    expect(summary.bySource.generated).toEqual({ files: 1, bytes: 2048 });
  });

  it("createBatchWithinQuota counts only net-new bytes and preserves caller order", async () => {
    await mapper.create({
      id: "uf_existing_batch",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "existing-batch",
      fileType: "document",
      fileName: "existing-batch.txt",
      mimeType: "text/plain",
      fileSize: 40,
      metadata: { source: "uploaded", retentionClass: "ephemeral" },
    });

    const createBatchWithinQuota = mapper.createBatchWithinQuota?.bind(mapper);
    expect(createBatchWithinQuota).toBeDefined();
    if (!createBatchWithinQuota) {
      throw new Error("Expected createBatchWithinQuota to be available.");
    }

    const result = await createBatchWithinQuota(
      [
        {
          id: "uf_duplicate_batch_attempt",
          userId: "usr_test",
          conversationId: null,
          status: "ready",
          contentHash: "existing-batch",
          fileType: "document",
          fileName: "existing-batch.txt",
          mimeType: "text/plain",
          fileSize: 40,
          metadata: { source: "uploaded", retentionClass: "ephemeral" },
        },
        {
          id: "uf_new_batch_attempt",
          userId: "usr_test",
          conversationId: null,
          status: "ready",
          contentHash: "new-batch",
          fileType: "document",
          fileName: "new-batch.txt",
          mimeType: "text/plain",
          fileSize: 25,
          metadata: { source: "uploaded", retentionClass: "ephemeral" },
        },
      ],
      {
        userId: "usr_test",
        quotaBytes: 100,
        hardBlockUploadsAtQuota: true,
      },
    );

    expect(result.quotaExceeded).toBe(false);
    expect(result.insertedBytes).toBe(25);
    expect(result.projectedTotalBytes).toBe(65);
    expect(result.files.map((file) => file.id)).toEqual(["uf_existing_batch", "uf_new_batch_attempt"]);
  });

  it("createBatchWithinQuota rejects the full batch atomically when hard quota would be exceeded", async () => {
    await mapper.create({
      id: "uf_quota_baseline",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "quota-baseline",
      fileType: "document",
      fileName: "quota-baseline.txt",
      mimeType: "text/plain",
      fileSize: 80,
      metadata: { source: "uploaded", retentionClass: "ephemeral" },
    });

    const createBatchWithinQuota = mapper.createBatchWithinQuota?.bind(mapper);
    expect(createBatchWithinQuota).toBeDefined();
    if (!createBatchWithinQuota) {
      throw new Error("Expected createBatchWithinQuota to be available.");
    }

    const result = await createBatchWithinQuota(
      [
        {
          id: "uf_quota_reject_1",
          userId: "usr_test",
          conversationId: null,
          status: "ready",
          contentHash: "quota-reject-1",
          fileType: "document",
          fileName: "quota-reject-1.txt",
          mimeType: "text/plain",
          fileSize: 15,
          metadata: { source: "uploaded", retentionClass: "ephemeral" },
        },
        {
          id: "uf_quota_reject_2",
          userId: "usr_test",
          conversationId: null,
          status: "ready",
          contentHash: "quota-reject-2",
          fileType: "document",
          fileName: "quota-reject-2.txt",
          mimeType: "text/plain",
          fileSize: 10,
          metadata: { source: "uploaded", retentionClass: "ephemeral" },
        },
      ],
      {
        userId: "usr_test",
        quotaBytes: 90,
        hardBlockUploadsAtQuota: true,
      },
    );

    expect(result).toEqual({
      files: [],
      insertedBytes: 25,
      projectedTotalBytes: 105,
      quotaExceeded: true,
    });
    expect(await mapper.findById("uf_quota_reject_1")).toBeNull();
    expect(await mapper.findById("uf_quota_reject_2")).toBeNull();
  });

  it("listForAdmin and countForAdmin support filtered inventory browsing", async () => {
    seedUser(db, "usr_other");

    await mapper.create({
      id: "uf_admin_1",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "admin-1",
      fileType: "document",
      fileName: "briefing.pdf",
      mimeType: "application/pdf",
      fileSize: 512,
      metadata: { retentionClass: "ephemeral" },
    });
    await mapper.create({
      id: "uf_admin_2",
      userId: "usr_other",
      conversationId: "conv_1",
      status: "ready",
      contentHash: "admin-2",
      fileType: "video",
      fileName: "briefing-video.mp4",
      mimeType: "video/mp4",
      fileSize: 4096,
      metadata: { source: "generated", retentionClass: "conversation" },
    });

    const total = await mapper.countForAdmin({ search: "briefing" });
    const rows = await mapper.listForAdmin({ search: "briefing", limit: 10, offset: 0 });
    const attachedOnly = await mapper.listForAdmin({ attached: true, limit: 10, offset: 0 });

    expect(total).toBe(2);
    expect(rows.map((file) => file.id)).toEqual(["uf_admin_2", "uf_admin_1"]);
    expect(attachedOnly.map((file) => file.id)).toEqual(["uf_admin_2"]);
  });

  it("getFleetStorageSummary and listLargestUsersByStorage aggregate across all users", async () => {
    seedUser(db, "usr_other");

    await mapper.create({
      id: "uf_fleet_1",
      userId: "usr_test",
      conversationId: null,
      status: "ready",
      contentHash: "fleet-1",
      fileType: "audio",
      fileName: "fleet-1.mp3",
      mimeType: "audio/mpeg",
      fileSize: 1000,
      metadata: { source: "uploaded", retentionClass: "ephemeral" },
    });
    await mapper.create({
      id: "uf_fleet_2",
      userId: "usr_other",
      conversationId: "conv_1",
      status: "ready",
      contentHash: "fleet-2",
      fileType: "video",
      fileName: "fleet-2.mp4",
      mimeType: "video/mp4",
      fileSize: 4000,
      metadata: { source: "generated", retentionClass: "conversation" },
    });
    await mapper.create({
      id: "uf_fleet_3",
      userId: "usr_other",
      conversationId: null,
      status: "ready",
      contentHash: "fleet-3",
      fileType: "video",
      fileName: "fleet-3.mp4",
      mimeType: "video/mp4",
      fileSize: 2000,
      metadata: { source: "generated", retentionClass: "ephemeral" },
    });

    const summary = await mapper.getFleetStorageSummary();
    const leaderboard = await mapper.listLargestUsersByStorage(10);

    expect(summary.totalUsers).toBe(2);
    expect(summary.totalFiles).toBe(3);
    expect(summary.totalBytes).toBe(7000);
    expect(summary.attachedFiles).toBe(1);
    expect(summary.unattachedFiles).toBe(2);
    expect(summary.byType.audio).toEqual({ files: 1, bytes: 1000 });
    expect(summary.byType.video).toEqual({ files: 2, bytes: 6000 });
    expect(summary.byRetentionClass.conversation).toEqual({ files: 1, bytes: 4000 });
    expect(summary.byRetentionClass.ephemeral).toEqual({ files: 2, bytes: 3000 });
    expect(summary.bySource.generated).toEqual({ files: 2, bytes: 6000 });
    expect(summary.bySource.uploaded).toEqual({ files: 1, bytes: 1000 });

    expect(leaderboard).toEqual([
      { userId: "usr_other", totalFiles: 2, totalBytes: 6000 },
      { userId: "usr_test", totalFiles: 1, totalBytes: 1000 },
    ]);
  });
});
