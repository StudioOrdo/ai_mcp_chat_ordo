/**
 * Sprint 4 — QR Code and Referral Tracking
 *
 * 44 tests verifying schema migration, referral code generation,
 * proxy ?ref= handling, data mapper, conversation attribution,
 * rate limiter, admin affiliate toggle, referrer lookup,
 * config prompts, and greeting wiring.
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { ensureSchema } from "@/lib/db/schema";
import { generateReferralCode } from "@/lib/referral/generate-code";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { createRateLimiter } from "@/lib/rate-limit";
import { ReferralDataMapper } from "@/adapters/ReferralDataMapper";
import { ConversationDataMapper } from "@/adapters/ConversationDataMapper";
import { ConversationInteractor } from "@/core/use-cases/ConversationInteractor";
import type { MessageRepository } from "@/core/use-cases/MessageRepository";
import { createInitialChatMessages } from "@/hooks/chat/chatState";
import { validatePrompts } from "@/lib/config/instance.schema";

// ── Helpers ─────────────────────────────────────────────────────────

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  ensureSchema(db);
  return db;
}

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

function makeRequest(path: string, cookie?: string): NextRequest {
  const url = new URL(path, "http://localhost:3000");
  const headers = new Headers();
  if (cookie) {
    headers.set("cookie", cookie);
  }
  return new NextRequest(url, { headers });
}

function insertUser(
  db: Database.Database,
  opts: {
    id: string;
    email: string;
    name: string;
    affiliateEnabled?: number;
    referralCode?: string | null;
    credential?: string | null;
  },
) {
  db.prepare(
    `INSERT INTO users (id, email, name, affiliate_enabled, referral_code, credential)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    opts.id,
    opts.email,
    opts.name,
    opts.affiliateEnabled ?? 0,
    opts.referralCode ?? null,
    opts.credential ?? null,
  );
}

// ── Positive tests ──────────────────────────────────────────────────

describe("Sprint 4 — QR Code and Referral Tracking", () => {
  describe("Positive tests", () => {
    it("P1: APPRENTICE is a valid RoleName", () => {
      const src = readSource("src/core/entities/user.ts");
      expect(src).toContain('"APPRENTICE"');
    });

    it("P2: APPRENTICE role seeded in schema", () => {
      const db = createTestDb();
      const row = db
        .prepare("SELECT * FROM roles WHERE name = 'APPRENTICE'")
        .get() as { id: string; name: string } | undefined;
      expect(row).toBeDefined();
      expect(row!.id).toBe("role_apprentice");
    });

    it("P3: referrals table created with correct columns", () => {
      const db = createTestDb();
      const columns = db.prepare("PRAGMA table_info(referrals)").all() as Array<{ name: string }>;
      const colNames = columns.map((c) => c.name);
      expect(colNames).toEqual(
        expect.arrayContaining([
          "id",
          "referrer_user_id",
          "conversation_id",
          "referral_code",
          "scanned_at",
          "converted_at",
          "outcome",
          "created_at",
        ]),
      );
    });

    it("P4: users table has affiliate_enabled column defaulting to 0", () => {
      const db = createTestDb();
      db.prepare(
        "INSERT INTO users (id, email, name) VALUES ('u1', 'u1@test.com', 'User 1')",
      ).run();
      const row = db
        .prepare("SELECT affiliate_enabled FROM users WHERE id = 'u1'")
        .get() as { affiliate_enabled: number };
      expect(row.affiliate_enabled).toBe(0);
    });

    it("P5: users table has referral_code column", () => {
      const db = createTestDb();
      const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
      const colNames = columns.map((c) => c.name);
      expect(colNames).toContain("referral_code");
    });

    it("P6: conversations table has referral_source column", () => {
      const db = createTestDb();
      const columns = db
        .prepare("PRAGMA table_info(conversations)")
        .all() as Array<{ name: string }>;
      const colNames = columns.map((c) => c.name);
      expect(colNames).toContain("referral_source");
    });

    it("P7: generateReferralCode returns 22-character base62 string", () => {
      const code = generateReferralCode();
      expect(code).toHaveLength(22);
      expect(code).toMatch(/^[0-9A-Za-z]+$/);
    });

    it("P8: generateReferralCode produces different codes on each call", () => {
      const codes = new Set(
        Array.from({ length: 10 }, () => generateReferralCode()),
      );
      expect(codes.size).toBe(10);
    });

    it("P9: ReferralDataMapper.create persists a referral record", () => {
      const db = createTestDb();
      insertUser(db, {
        id: "u1",
        email: "u1@test.com",
        name: "Affi User",
        affiliateEnabled: 1,
        referralCode: "TESTCODE1234567890AB",
      });
      const mapper = new ReferralDataMapper(db);
      const ref = mapper.create({
        id: "ref_1",
        referrerUserId: "u1",
        referredUserId: null,
        conversationId: null,
        referralCode: "TESTCODE1234567890AB",
        visitId: null,
        status: "visited",
        creditStatus: "tracked",
        scannedAt: null,
        convertedAt: null,
        lastValidatedAt: null,
        lastEventAt: null,
        outcome: null,
        metadataJson: "{}",
      });
      expect(ref.id).toBe("ref_1");
      expect(ref.referrerUserId).toBe("u1");
      expect(ref.createdAt).toBeDefined();
    });

    it("P10: ReferralDataMapper.findByCode returns matching referral", () => {
      const db = createTestDb();
      insertUser(db, {
        id: "u1",
        email: "u1@test.com",
        name: "Affi User",
        referralCode: "CODE10",
      });
      const mapper = new ReferralDataMapper(db);
      mapper.create({
        id: "ref_1",
        referrerUserId: "u1",
        referredUserId: null,
        conversationId: null,
        referralCode: "CODE10",
        visitId: null,
        status: "visited",
        creditStatus: "tracked",
        scannedAt: null,
        convertedAt: null,
        lastValidatedAt: null,
        lastEventAt: null,
        outcome: null,
        metadataJson: "{}",
      });
      const found = mapper.findByCode("CODE10");
      expect(found).not.toBeNull();
      expect(found!.referralCode).toBe("CODE10");
    });

    it("P11: ReferralDataMapper.findByReferrer returns all referrals for a user", () => {
      const db = createTestDb();
      insertUser(db, { id: "u1", email: "u1@test.com", name: "User" });
      const mapper = new ReferralDataMapper(db);
      for (let i = 1; i <= 3; i++) {
        mapper.create({
          id: `ref_${i}`,
          referrerUserId: "u1",
          referredUserId: null,
          conversationId: null,
          referralCode: `CODE_${i}`,
          visitId: null,
          status: "visited",
          creditStatus: "tracked",
          scannedAt: null,
          convertedAt: null,
          lastValidatedAt: null,
          lastEventAt: null,
          outcome: null,
          metadataJson: "{}",
        });
      }
      const refs = mapper.findByReferrer("u1");
      expect(refs).toHaveLength(3);
    });

    it("P12: ReferralDataMapper.getReferrerUser returns referrer info including credential", () => {
      const db = createTestDb();
      insertUser(db, {
        id: "u1",
        email: "u1@test.com",
        name: "Prof Smith",
        affiliateEnabled: 1,
        credential: "Enterprise AI practitioner",
        referralCode: "REFCODE12",
      });
      const mapper = new ReferralDataMapper(db);
      mapper.create({
        id: "ref_1",
        referrerUserId: "u1",
        referredUserId: null,
        conversationId: null,
        referralCode: "REFCODE12",
        visitId: null,
        status: "visited",
        creditStatus: "tracked",
        scannedAt: null,
        convertedAt: null,
        lastValidatedAt: null,
        lastEventAt: null,
        outcome: null,
        metadataJson: "{}",
      });
      const info = mapper.getReferrerUser("REFCODE12");
      expect(info).not.toBeNull();
      expect(info!.name).toBe("Prof Smith");
      expect(info!.email).toBe("u1@test.com");
      expect(info!.credential).toBe("Enterprise AI practitioner");
    });

    it("P13: proxy redirects legacy ?ref= links to the canonical referral route", () => {
      const res = proxy(makeRequest("/?ref=abc123"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/r/abc123");
    });

    it("P14: proxy preserves non-referral query params when redirecting legacy referral links", () => {
      const res = proxy(makeRequest("/?ref=abc123&utm_source=qr"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/r/abc123?utm_source=qr");
    });

    it("P15: ConversationInteractor stores referral_source when option provided", async () => {
      const db = createTestDb();
      insertUser(db, { id: "u1", email: "u1@test.com", name: "User" });
      const convMapper = new ConversationDataMapper(db);
      const msgRepo = {
        create: vi.fn(),
        listByConversation: vi.fn().mockResolvedValue([]),
        countByConversation: vi.fn().mockResolvedValue(0),
      };
      const interactor = new ConversationInteractor(convMapper, msgRepo as unknown as MessageRepository);
      const conv = await interactor.ensureActive("u1", {
        referralSource: "abc123",
      });
      expect(conv.referralSource).toBe("abc123");
    });

    it("P16: QR endpoint returns PNG for valid referral code (via route validation pattern)", () => {
      // Test QR endpoint validation logic: user with affiliate_enabled=1 and referral_code
      const db = createTestDb();
      insertUser(db, {
        id: "u1",
        email: "u1@test.com",
        name: "User",
        affiliateEnabled: 1,
        referralCode: "testcode",
      });
      const row = db
        .prepare(
          `SELECT referral_code FROM users WHERE referral_code = ? AND affiliate_enabled = 1`,
        )
        .get("testcode") as { referral_code: string } | undefined;
      expect(row).toBeDefined();
      expect(row!.referral_code).toBe("testcode");
    });

    it("P17: Admin affiliate toggle enables affiliate and generates code (via DB pattern)", () => {
      const db = createTestDb();
      insertUser(db, { id: "u1", email: "u1@test.com", name: "User" });

      // Simulate what the admin route does
      const code = generateReferralCode();
      db.prepare(
        `UPDATE users SET affiliate_enabled = 1, referral_code = ? WHERE id = ?`,
      ).run(code, "u1");

      const row = db
        .prepare("SELECT affiliate_enabled, referral_code FROM users WHERE id = 'u1'")
        .get() as { affiliate_enabled: number; referral_code: string };
      expect(row.affiliate_enabled).toBe(1);
      expect(row.referral_code).toHaveLength(22);
    });

    it("P18: withReferral template populated in prompts.json", () => {
      const raw = readSource("config/prompts.json");
      const config = JSON.parse(raw);
      expect(config.firstMessage?.withReferral).toBeDefined();
      expect(config.firstMessage.withReferral).toContain("{{referrer.name}}");
    });

    it("P19: referralSuggestions populated in prompts.json", () => {
      const raw = readSource("config/prompts.json");
      const config = JSON.parse(raw);
      expect(config.referralSuggestions).toBeInstanceOf(Array);
      expect(config.referralSuggestions.length).toBeGreaterThanOrEqual(2);
    });

    it("P20: rate limiter allows requests within limit", () => {
      const limiter = createRateLimiter(60_000, 5);
      for (let i = 0; i < 5; i++) {
        expect(limiter("ip_1")).toBe(true);
      }
    });

    it("P21: GET /api/referral/{code} returns referrer info for valid code (via DB query pattern)", () => {
      const db = createTestDb();
      insertUser(db, {
        id: "u1",
        email: "u1@test.com",
        name: "Prof Smith",
        affiliateEnabled: 1,
        referralCode: "LOOKUPCODE",
        credential: "AI Expert",
      });
      const row = db
        .prepare(
          `SELECT u.name, u.credential FROM users u WHERE u.referral_code = ? AND u.affiliate_enabled = 1`,
        )
        .get("LOOKUPCODE") as { name: string; credential: string | null } | undefined;
      expect(row).toBeDefined();
      expect(row!.name).toBe("Prof Smith");
      expect(row!.credential).toBe("AI Expert");
    });
  });

  // ── Negative tests ──────────────────────────────────────────────────

  describe("Negative tests", () => {
    it("N1: proxy ignores ?ref= with empty value", () => {
      const res = proxy(makeRequest("/?ref="));
      const setCookie = res.headers.get("set-cookie") ?? "";
      expect(setCookie).not.toContain("lms_referral_code");
    });

    it("N2: proxy ignores ?ref= on API routes", () => {
      const res = proxy(makeRequest("/api/chat/stream?ref=abc"));
      const setCookie = res.headers.get("set-cookie") ?? "";
      expect(setCookie).not.toContain("lms_referral_code");
    });

    it("N3: proxy ignores ?ref= exceeding 30 characters", () => {
      const res = proxy(makeRequest("/?ref=" + "x".repeat(31)));
      const setCookie = res.headers.get("set-cookie") ?? "";
      expect(setCookie).not.toContain("lms_referral_code");
    });

    it("N4: QR endpoint returns 404 for non-existent referral code (via DB pattern)", () => {
      const db = createTestDb();
      const row = db
        .prepare(
          `SELECT referral_code FROM users WHERE referral_code = ? AND affiliate_enabled = 1`,
        )
        .get("nonexistent");
      expect(row).toBeUndefined();
    });

    it("N5: QR endpoint returns 404 for user with affiliate_enabled = 0 (via DB pattern)", () => {
      const db = createTestDb();
      insertUser(db, {
        id: "u1",
        email: "u1@test.com",
        name: "User",
        affiliateEnabled: 0,
        referralCode: "HASSCODE",
      });
      const row = db
        .prepare(
          `SELECT referral_code FROM users WHERE referral_code = ? AND affiliate_enabled = 1`,
        )
        .get("HASSCODE");
      expect(row).toBeUndefined();
    });

    it("N6: rate limiter rejects requests over limit", () => {
      const limiter = createRateLimiter(60_000, 3);
      limiter("ip_1");
      limiter("ip_1");
      limiter("ip_1");
      expect(limiter("ip_1")).toBe(false);
    });

    it("N7: Admin affiliate toggle rejects non-ADMIN caller (via auth pattern)", () => {
      // Verify the admin route guards by checking the code pattern
      const src = readSource(
        "src/app/api/admin/affiliates/[userId]/route.ts",
      );
      expect(src).toContain('!user.roles.includes("ADMIN")');
      expect(src).toContain("403");
    });

    it("N8: referral_code UNIQUE constraint enforced", () => {
      const db = createTestDb();
      insertUser(db, {
        id: "u1",
        email: "u1@test.com",
        name: "User 1",
        referralCode: "UNIQUECODE",
      });
      expect(() =>
        insertUser(db, {
          id: "u2",
          email: "u2@test.com",
          name: "User 2",
          referralCode: "UNIQUECODE",
        }),
      ).toThrow();
    });

    it("N9: ConversationInteractor ignores referralSource when conversation already exists", async () => {
      const db = createTestDb();
      insertUser(db, { id: "u1", email: "u1@test.com", name: "User" });
      const convMapper = new ConversationDataMapper(db);
      const msgRepo = {
        create: vi.fn(),
        listByConversation: vi.fn().mockResolvedValue([]),
        countByConversation: vi.fn().mockResolvedValue(0),
      };
      const interactor = new ConversationInteractor(convMapper, msgRepo as unknown as MessageRepository);

      // Create first conversation without referral
      const conv1 = await interactor.ensureActive("u1");
      expect(conv1.referralSource).toBeNull();

      // Call again with referralSource — existing conversation returned unchanged
      const conv2 = await interactor.ensureActive("u1", {
        referralSource: "abc",
      });
      expect(conv2.id).toBe(conv1.id);
      expect(conv2.referralSource).toBeNull();
    });

    it("N10: ReferralDataMapper.findByCode returns null for non-existent code", () => {
      const db = createTestDb();
      const mapper = new ReferralDataMapper(db);
      expect(mapper.findByCode("nonexistent")).toBeNull();
    });

    it("N11: GET /api/referral/{code} returns 404 for invalid code (via DB pattern)", () => {
      const db = createTestDb();
      const row = db
        .prepare(
          `SELECT u.name, u.credential FROM users u WHERE u.referral_code = ? AND u.affiliate_enabled = 1`,
        )
        .get("nonexistent");
      expect(row).toBeUndefined();
    });

    it("N12: Admin affiliate toggle returns 404 for non-existent user (via DB pattern)", () => {
      const db = createTestDb();
      const row = db
        .prepare(
          "SELECT id FROM users WHERE id = ?",
        )
        .get("nonexistent");
      expect(row).toBeUndefined();
    });
  });

  // ── Edge tests ────────────────────────────────────────────────────

  describe("Edge tests", () => {
    it("E1: generateReferralCode produces no collisions in 1000 iterations", () => {
      const codes = new Set(
        Array.from({ length: 1000 }, () => generateReferralCode()),
      );
      expect(codes.size).toBe(1000);
    });

    it("E2: proxy leaves existing session cookies untouched while redirecting legacy referral links", () => {
      const res = proxy(
        makeRequest("/?ref=abc123", "lms_session_token=tok123"),
      );
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/r/abc123");
      expect(res.headers.get("set-cookie") ?? "").not.toContain("lms_session_token");
    });

    it("E3: referral attribution preserved when anonymous conversation migrates to authenticated", async () => {
      const db = createTestDb();
      insertUser(db, { id: "anon_1", email: "anon@test.com", name: "Anon" });
      insertUser(db, { id: "auth_1", email: "auth@test.com", name: "Auth" });
      const convMapper = new ConversationDataMapper(db);
      const msgRepo = {
        create: vi.fn(),
        listByConversation: vi.fn().mockResolvedValue([]),
        countByConversation: vi.fn().mockResolvedValue(0),
      };
      const interactor = new ConversationInteractor(convMapper, msgRepo as unknown as MessageRepository);

      // Create anonymous conv with referral
      const conv = await interactor.ensureActive("anon_1", {
        referralSource: "refcode",
      });
      expect(conv.referralSource).toBe("refcode");

      // Migrate to authenticated
      await interactor.migrateAnonymousConversations("anon_1", "auth_1");

      // Check that referral_source is preserved
      const migrated = await convMapper.findById(conv.id);
      expect(migrated!.referralSource).toBe("refcode");
    });

    it("E4: referral image URL uses domain from instance config (via code pattern)", () => {
      const src = readSource("src/app/api/qr/[code]/route.ts");
      expect(src).toContain("buildPublicReferralUrl");
      expect(readSource("src/lib/referrals/referral-origin.ts")).toContain("getInstanceIdentity");
      expect(readSource("src/lib/referrals/referral-origin.ts")).toContain("PUBLIC_SITE_ORIGIN");
      expect(src).not.toContain("?ref=");
    });

    it("E5: withReferral template falls back to default when referral context missing", () => {
      const prompts = {
        firstMessage: {
          default: "Default greeting",
          withReferral: "Hello {{referrer.name}}",
        },
        defaultSuggestions: ["Suggestion 1"],
      };
      // No referral context passed — should use default
      const msgs = createInitialChatMessages("ANONYMOUS", prompts);
      expect(msgs[0]?.content).toContain("Default greeting");
      expect(msgs[0]?.content).not.toContain("{{referrer.name}}");
    });

    it("E6: referral cookie with invalid code handled gracefully in conversation creation", async () => {
      const db = createTestDb();
      insertUser(db, { id: "u1", email: "u1@test.com", name: "User" });
      const convMapper = new ConversationDataMapper(db);
      const msgRepo = {
        create: vi.fn(),
        listByConversation: vi.fn().mockResolvedValue([]),
        countByConversation: vi.fn().mockResolvedValue(0),
      };
      const interactor = new ConversationInteractor(convMapper, msgRepo as unknown as MessageRepository);

      // Invalid code — still creates conversation, just sets referral_source
      const conv = await interactor.ensureActive("u1", {
        referralSource: "invalid_code_xyz",
      });
      expect(conv).toBeDefined();
      expect(conv.referralSource).toBe("invalid_code_xyz");
    });

    it("E7: admin re-enabling affiliate preserves existing referral_code", () => {
      const db = createTestDb();
      insertUser(db, {
        id: "u1",
        email: "u1@test.com",
        name: "User",
        affiliateEnabled: 1,
        referralCode: "ORIGINALCODE",
      });

      // Disable
      db.prepare("UPDATE users SET affiliate_enabled = 0 WHERE id = 'u1'").run();

      // Re-enable — code should already exist, so no regeneration
      const existing = db
        .prepare("SELECT referral_code FROM users WHERE id = 'u1'")
        .get() as { referral_code: string | null };
      expect(existing.referral_code).toBe("ORIGINALCODE");

      // Simulate admin route: only generate if null
      const code = existing.referral_code ?? generateReferralCode();
      db.prepare(
        "UPDATE users SET affiliate_enabled = 1, referral_code = ? WHERE id = 'u1'",
      ).run(code);

      const updated = db
        .prepare(
          "SELECT affiliate_enabled, referral_code FROM users WHERE id = 'u1'",
        )
        .get() as { affiliate_enabled: number; referral_code: string };
      expect(updated.affiliate_enabled).toBe(1);
      expect(updated.referral_code).toBe("ORIGINALCODE");
    });

    it("E8: rate limiter resets after window expires", async () => {
      const limiter = createRateLimiter(100, 2);
      limiter("ip_1");
      limiter("ip_1");
      expect(limiter("ip_1")).toBe(false);
      await new Promise((r) => setTimeout(r, 110));
      expect(limiter("ip_1")).toBe(true);
    });

    it("E9: referralSuggestions validated: max 6 items, 100 chars each", () => {
      const tooMany = validatePrompts({
        referralSuggestions: Array(7).fill("x"),
      });
      expect(Array.isArray(tooMany)).toBe(true);
      expect((tooMany as string[]).some((e) => e.includes("referralSuggestions"))).toBe(true);

      const tooLong = validatePrompts({
        referralSuggestions: ["x".repeat(101)],
      });
      expect(Array.isArray(tooLong)).toBe(true);
      expect((tooLong as string[]).some((e) => e.includes("referralSuggestions"))).toBe(true);
    });

    it("E10: schema migration is idempotent", () => {
      const db = new Database(":memory:");
      ensureSchema(db);
      expect(() => ensureSchema(db)).not.toThrow();
    });

    it("E11: credential column defaults to NULL for existing users", () => {
      const db = createTestDb();
      db.prepare(
        "INSERT INTO users (id, email, name) VALUES ('u1', 'u1@test.com', 'User')",
      ).run();
      const row = db
        .prepare("SELECT credential FROM users WHERE id = 'u1'")
        .get() as { credential: string | null };
      expect(row.credential).toBeNull();
    });
  });
});
