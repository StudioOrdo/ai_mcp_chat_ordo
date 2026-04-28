import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { ensureSchema } from "@/lib/db/schema";
import type { getReferralLedgerService } from "@/lib/referrals/referral-ledger";

type ReferralLedgerModule = Record<string, unknown> & {
  getReferralLedgerService: typeof getReferralLedgerService;
};

const authTestState = vi.hoisted(() => ({
  testDb: undefined as ReturnType<typeof Database> | undefined,
  cookieJar: new Map<string, string>(),
  failReferralLinkCount: 0,
}));

vi.mock("@/lib/db", () => ({
  getDb: () => authTestState.testDb,
}));

const { repairConversationOwnershipIndex } = vi.hoisted(() => ({
  repairConversationOwnershipIndex: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/chat/embed-conversation", () => ({
  repairConversationOwnershipIndex,
}));

vi.mock("@/lib/referrals/referral-ledger", async () => {
  const actual = await vi.importActual<ReferralLedgerModule>("@/lib/referrals/referral-ledger");

  return {
    ...actual,
    getReferralLedgerService: () => {
      const service = actual.getReferralLedgerService();
      return {
        ...service,
        async linkConversationToAuthenticatedUser(
          input: Parameters<typeof service.linkConversationToAuthenticatedUser>[0],
        ) {
          if (authTestState.failReferralLinkCount > 0) {
            authTestState.failReferralLinkCount -= 1;
            throw new Error("simulated referral linkage failure");
          }

          return service.linkConversationToAuthenticatedUser(input);
        },
      };
    },
  };
});

// Mock next/headers cookies
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const val = authTestState.cookieJar.get(name);
      return val ? { name, value: val } : undefined;
    },
    set: (name: string, value: string, options?: { maxAge?: number }) => {
      if (options?.maxAge === 0 || value === "") {
        authTestState.cookieJar.delete(name);
        return;
      }
      authTestState.cookieJar.set(name, value);
    },
    delete: (name: string) => {
      authTestState.cookieJar.delete(name);
    },
  }),
}));

// Import route handlers AFTER mocks are set up
import { POST as registerRoute } from "@/app/api/auth/register/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { GET as meRoute } from "@/app/api/auth/me/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { JobQueueDataMapper } from "@/adapters/JobQueueDataMapper";
import { getSessionUser } from "@/lib/auth";
import { _resetRepositorySingletons } from "@/adapters/RepositoryFactory";
import {
  createPublicFormMetadata,
  PUBLIC_FORM_HONEYPOT_FIELD_NAME,
  PUBLIC_FORM_STARTED_AT_FIELD_NAME,
  resetPublicFormProtectionState,
} from "@/lib/security/public-form-protection";

function jsonRequest(body: Record<string, unknown>, headers?: HeadersInit): Request {
  const publicFormMetadata = createPublicFormMetadata(Date.now() - 5_000);
  return new Request("http://localhost:3000/api/auth/test", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      [PUBLIC_FORM_HONEYPOT_FIELD_NAME]: publicFormMetadata.honeypotValue,
      [PUBLIC_FORM_STARTED_AT_FIELD_NAME]: publicFormMetadata.startedAt,
      ...body,
    }),
  });
}

describe("Auth API routes — full lifecycle", () => {
  beforeEach(() => {
    _resetRepositorySingletons();
    authTestState.testDb = new Database(":memory:");
    ensureSchema(authTestState.testDb);
    authTestState.cookieJar = new Map();
    authTestState.failReferralLinkCount = 0;
    repairConversationOwnershipIndex.mockClear();
    resetPublicFormProtectionState();
  });

  function getTestDb() {
    if (!authTestState.testDb) {
      throw new Error("Test database has not been initialized.");
    }

    return authTestState.testDb;
  }

  function seedAnonymousConversation(sessionId = "anon_seed") {
    const anonUserId = `anon_${sessionId}`;
    getTestDb()
      .prepare(`INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)`)
      .run(anonUserId, `${anonUserId}@anonymous.local`, "Anonymous");
    getTestDb()
      .prepare(`INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'role_anonymous')`)
      .run(anonUserId);
    getTestDb()
      .prepare(`INSERT INTO conversations (id, user_id, title, status, session_source) VALUES (?, ?, ?, 'archived', 'anonymous_cookie')`)
      .run("conv_anon", anonUserId, "Anonymous chat");
    return anonUserId;
  }

  function seedCanonicalReferralForConversation(conversationId = "conv_anon") {
    getTestDb()
      .prepare(
        `INSERT OR IGNORE INTO users (
           id,
           email,
           name,
           affiliate_enabled,
           referral_code,
           credential
         ) VALUES (?, ?, ?, 1, ?, ?)`,
      )
      .run("usr_affiliate", "affiliate@test.com", "Ada Lovelace", "mentor-42", "Founder");
    getTestDb()
      .prepare(
        `INSERT INTO referrals (
           id,
           referrer_user_id,
           conversation_id,
           referral_code,
           visit_id,
           status,
           credit_status,
           scanned_at,
           last_validated_at,
           last_event_at,
           metadata_json
         ) VALUES (?, ?, ?, ?, ?, 'engaged', 'tracked', ?, ?, ?, ?)`,
      )
      .run(
        "ref_anon",
        "usr_affiliate",
        conversationId,
        "mentor-42",
        "visit_anon",
        "2026-04-01T10:00:00.000Z",
        "2026-04-01T10:00:00.000Z",
        "2026-04-01T10:00:00.000Z",
        JSON.stringify({ referrerName: "Ada Lovelace", referrerCredential: "Founder" }),
      );
    getTestDb()
      .prepare(`UPDATE conversations SET referral_id = ?, referral_source = ? WHERE id = ?`)
      .run("ref_anon", "mentor-42", conversationId);
  }

  async function seedAnonymousJob(anonUserId: string, conversationId = "conv_anon") {
    const repo = new JobQueueDataMapper(getTestDb());
    const job = await repo.createJob({
      conversationId,
      userId: anonUserId,
      toolName: "draft_content",
      initiatorType: "anonymous_session",
      requestPayload: { title: "Migrated anonymous job" },
    });

    await repo.appendEvent({
      jobId: job.id,
      conversationId,
      eventType: "queued",
    });

    return { repo, job };
  }

  it("register → login → me → logout → me(401)", async () => {
    // 1. Register
    const regRes = await registerRoute(
      jsonRequest({ email: "test@example.com", password: "password123", name: "Test User" }),
    );
    expect(regRes.status).toBe(201);
    const regBody = await regRes.json();
    expect(regBody.user.email).toBe("test@example.com");
    expect(regBody.user.name).toBe("Test User");
    expect(regBody.user.roles).toContain("AUTHENTICATED");

    // Cookie should have been set
    const sessionToken = authTestState.cookieJar.get("lms_session_token");
    expect(sessionToken).toBeTruthy();

    // 2. Validate session via /me
    const meRes = await meRoute();
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.user.email).toBe("test@example.com");

    // 3. Logout
    const logoutRes = await logoutRoute();
    expect(logoutRes.status).toBe(200);
    expect(authTestState.cookieJar.has("lms_session_token")).toBe(false);

    // 4. /me should now return 401
    const meRes2 = await meRoute();
    expect(meRes2.status).toBe(401);

    // 5. Login with the registered credentials
    authTestState.cookieJar.clear();
    const loginRes = await loginRoute(
      jsonRequest({ email: "test@example.com", password: "password123" }),
    );
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.user.email).toBe("test@example.com");
    expect(authTestState.cookieJar.get("lms_session_token")).toBeTruthy();

    authTestState.testDb?.close();
  });

  it("register with invalid email returns 400", async () => {
    const res = await registerRoute(
      jsonRequest({ email: "not-an-email", password: "password123", name: "Test" }),
    );
    expect(res.status).toBe(400);

    authTestState.testDb?.close();
  });

  it("register with short password returns 400", async () => {
    const res = await registerRoute(
      jsonRequest({ email: "a@b.com", password: "short", name: "Test" }),
    );
    expect(res.status).toBe(400);

    authTestState.testDb?.close();
  });

  it("register with missing fields returns 400", async () => {
    const res = await registerRoute(
      jsonRequest({ email: "a@b.com" }),
    );
    expect(res.status).toBe(400);

    authTestState.testDb?.close();
  });

  it("duplicate registration returns 409", async () => {
    await registerRoute(
      jsonRequest({ email: "dup@test.com", password: "password123", name: "First" }),
    );
    const res = await registerRoute(
      jsonRequest({ email: "dup@test.com", password: "password456", name: "Second" }),
    );
    expect(res.status).toBe(409);

    authTestState.testDb?.close();
  });

  it("login with wrong password returns 401", async () => {
    await registerRoute(
      jsonRequest({ email: "user@test.com", password: "correct-pass", name: "User" }),
    );
    authTestState.cookieJar.clear();
    const res = await loginRoute(
      jsonRequest({ email: "user@test.com", password: "wrong-pass" }),
    );
    expect(res.status).toBe(401);

    authTestState.testDb?.close();
  });

  it("login with nonexistent email returns 401", async () => {
    const res = await loginRoute(
      jsonRequest({ email: "nobody@test.com", password: "password123" }),
    );
    expect(res.status).toBe(401);

    authTestState.testDb?.close();
  });

  it("rejects login honeypot submissions", async () => {
    await registerRoute(
      jsonRequest({ email: "honeypot-login@test.com", password: "password123", name: "Honey Pot" }),
    );
    authTestState.cookieJar.clear();

    const res = await loginRoute(
      jsonRequest({
        email: "honeypot-login@test.com",
        password: "password123",
        [PUBLIC_FORM_HONEYPOT_FIELD_NAME]: "https://spam.invalid",
      }, { "x-forwarded-for": "203.0.113.20" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Unable to process request.");
    expect(authTestState.cookieJar.has("lms_session_token")).toBe(false);

    authTestState.testDb?.close();
  });

  it("rate limits repeated login attempts from the same client", async () => {
    await registerRoute(
      jsonRequest({ email: "ratelimit-login@test.com", password: "password123", name: "Rate Limit" }),
    );
    authTestState.cookieJar.clear();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const res = await loginRoute(
        jsonRequest(
          { email: "ratelimit-login@test.com", password: "wrong-password" },
          { "x-forwarded-for": "203.0.113.21" },
        ),
      );
      expect(res.status).toBe(401);
    }

    const limitedRes = await loginRoute(
      jsonRequest(
        { email: "ratelimit-login@test.com", password: "wrong-password" },
        { "x-forwarded-for": "203.0.113.21" },
      ),
    );
    const limitedBody = await limitedRes.json();

    expect(limitedRes.status).toBe(429);
    expect(limitedBody.error).toBe("Too many attempts. Please wait a moment and try again.");
    expect(limitedRes.headers.get("Retry-After")).toMatch(/^\d+$/);

    authTestState.testDb?.close();
  });

  it("rejects registration honeypot submissions", async () => {
    const res = await registerRoute(
      jsonRequest({
        email: "honeypot-register@test.com",
        password: "password123",
        name: "Honey Pot",
        [PUBLIC_FORM_HONEYPOT_FIELD_NAME]: "https://spam.invalid",
      }, { "x-forwarded-for": "203.0.113.22" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Unable to process request.");

    const userCount = getTestDb()
      .prepare(`SELECT COUNT(*) as count FROM users WHERE email = 'honeypot-register@test.com'`)
      .get() as { count: number };
    expect(userCount.count).toBe(0);

    authTestState.testDb?.close();
  });

  it("requires a realistic dwell time for registration submissions", async () => {
    const res = await registerRoute(
      jsonRequest({
        email: "fast-register@test.com",
        password: "password123",
        name: "Fast Register",
        [PUBLIC_FORM_STARTED_AT_FIELD_NAME]: String(Date.now()),
      }, { "x-forwarded-for": "203.0.113.23" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Please wait a moment and try again.");

    authTestState.testDb?.close();
  });

  it("rate limits repeated registration attempts from the same client", async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const res = await registerRoute(
        jsonRequest(
          { email: "ratelimit-register@test.com", password: "password123", name: "Rate Limit" },
          { "x-forwarded-for": "203.0.113.24" },
        ),
      );

      expect([201, 409]).toContain(res.status);
    }

    const limitedRes = await registerRoute(
      jsonRequest(
        { email: "ratelimit-register@test.com", password: "password123", name: "Rate Limit" },
        { "x-forwarded-for": "203.0.113.24" },
      ),
    );
    const limitedBody = await limitedRes.json();

    expect(limitedRes.status).toBe(429);
    expect(limitedBody.error).toBe("Too many attempts. Please wait a moment and try again.");
    expect(limitedRes.headers.get("Retry-After")).toMatch(/^\d+$/);

    authTestState.testDb?.close();
  });

  it("repairs migrated anonymous conversation indexes during registration", async () => {
    const anonSessionId = "anon_seed";
    const anonUserId = seedAnonymousConversation(anonSessionId);
    authTestState.cookieJar.set("lms_anon_session", anonSessionId);

    const res = await registerRoute(
      jsonRequest({ email: "migrate@test.com", password: "password123", name: "Migrated User" }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(repairConversationOwnershipIndex).toHaveBeenCalledWith(
      "conv_anon",
      body.user.id,
      anonUserId,
    );
    expect(authTestState.cookieJar.has("lms_anon_session")).toBe(false);

    authTestState.testDb?.close();
  });

  it("migrates anonymous jobs during registration and records ownership transfer audit events", async () => {
    const anonSessionId = "anon_jobs_seed";
    const anonUserId = seedAnonymousConversation(anonSessionId);
    const { repo, job } = await seedAnonymousJob(anonUserId);
    authTestState.cookieJar.set("lms_anon_session", anonSessionId);

    const res = await registerRoute(
      jsonRequest({ email: "migrate-jobs@test.com", password: "password123", name: "Migrated Jobs User" }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.migratedConversations).toBe(1);

    const migratedJob = await repo.findJobById(job.id);
    const events = await repo.listEventsForJob(job.id);

    expect(migratedJob?.userId).toBe(body.user.id);
    expect(events.at(-1)).toMatchObject({
      eventType: "ownership_transferred",
      payload: expect.objectContaining({
        previousUserId: anonUserId,
        nextUserId: body.user.id,
        source: "registration",
      }),
    });

    authTestState.testDb?.close();
  });

  it("preserves canonical referral linkage during registration migration", async () => {
    const anonSessionId = "anon_seed";
    seedAnonymousConversation(anonSessionId);
    seedCanonicalReferralForConversation();
    authTestState.cookieJar.set("lms_anon_session", anonSessionId);

    const res = await registerRoute(
      jsonRequest({ email: "ref-reg@test.com", password: "password123", name: "Referral User" }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);

    const referral = getTestDb()
      .prepare(`SELECT referred_user_id, status FROM referrals WHERE id = 'ref_anon'`)
      .get() as { referred_user_id: string | null; status: string };
    expect(referral.referred_user_id).toBe(body.user.id);
    expect(referral.status).toBe("registered");

    const event = getTestDb()
      .prepare(`SELECT event_type FROM referral_events WHERE referral_id = 'ref_anon' AND event_type = 'registered'`)
      .get() as { event_type: string } | undefined;
    expect(event?.event_type).toBe("registered");

    authTestState.testDb?.close();
  });

  it("repairs migrated anonymous conversation indexes during login", async () => {
    const regRes = await registerRoute(
      jsonRequest({ email: "login-migrate@test.com", password: "password123", name: "Returning User" }),
    );
    const regBody = await regRes.json();

    const anonSessionId = "anon_login_seed";
    const anonUserId = seedAnonymousConversation(anonSessionId);
    authTestState.cookieJar.clear();
    authTestState.cookieJar.set("lms_anon_session", anonSessionId);

    const res = await loginRoute(
      jsonRequest({ email: "login-migrate@test.com", password: "password123" }),
    );

    expect(res.status).toBe(200);
    expect(repairConversationOwnershipIndex).toHaveBeenCalledWith(
      "conv_anon",
      regBody.user.id,
      anonUserId,
    );
    expect(authTestState.cookieJar.has("lms_anon_session")).toBe(false);

    authTestState.testDb?.close();
  });

  it("preserves canonical referral linkage during login migration", async () => {
    const regRes = await registerRoute(
      jsonRequest({ email: "ref-login@test.com", password: "password123", name: "Returning User" }),
    );
    const regBody = await regRes.json();

    const anonSessionId = "anon_login_seed";
    seedAnonymousConversation(anonSessionId);
    seedCanonicalReferralForConversation();
    authTestState.cookieJar.clear();
    authTestState.cookieJar.set("lms_anon_session", anonSessionId);

    const res = await loginRoute(
      jsonRequest({ email: "ref-login@test.com", password: "password123" }),
    );

    expect(res.status).toBe(200);

    const referral = getTestDb()
      .prepare(`SELECT referred_user_id, status FROM referrals WHERE id = 'ref_anon'`)
      .get() as { referred_user_id: string | null; status: string };
    expect(referral.referred_user_id).toBe(regBody.user.id);
    expect(referral.status).toBe("engaged");

    const event = getTestDb()
      .prepare(`SELECT event_type FROM referral_events WHERE referral_id = 'ref_anon' AND event_type = 'user_linked'`)
      .get() as { event_type: string } | undefined;
    expect(event?.event_type).toBe("user_linked");

    authTestState.testDb?.close();
  });

  it("preserves the anonymous retry path when referral linkage fails during login migration", async () => {
    const regRes = await registerRoute(
      jsonRequest({ email: "retry-login@test.com", password: "password123", name: "Returning User" }),
    );
    const regBody = await regRes.json();

    const anonSessionId = "anon_retry_login";
    const anonUserId = seedAnonymousConversation(anonSessionId);
    seedCanonicalReferralForConversation();
    authTestState.cookieJar.clear();
    authTestState.cookieJar.set("lms_anon_session", anonSessionId);
    authTestState.failReferralLinkCount = 1;

    const failedRes = await loginRoute(
      jsonRequest({ email: "retry-login@test.com", password: "password123" }),
    );

    expect(failedRes.status).toBe(500);
    expect(authTestState.cookieJar.has("lms_session_token")).toBe(false);
    expect(authTestState.cookieJar.get("lms_anon_session")).toBe(anonSessionId);

    const migratedConversation = getTestDb()
      .prepare(`SELECT user_id, converted_from FROM conversations WHERE id = 'conv_anon'`)
      .get() as { user_id: string; converted_from: string | null };
    expect(migratedConversation.user_id).toBe(regBody.user.id);
    expect(migratedConversation.converted_from).toBe(anonUserId);

    const retryRes = await loginRoute(
      jsonRequest({ email: "retry-login@test.com", password: "password123" }),
    );

    expect(retryRes.status).toBe(200);
    expect(authTestState.cookieJar.has("lms_session_token")).toBe(true);
    expect(authTestState.cookieJar.has("lms_anon_session")).toBe(false);

    const referral = getTestDb()
      .prepare(`SELECT referred_user_id FROM referrals WHERE id = 'ref_anon'`)
      .get() as { referred_user_id: string | null };
    expect(referral.referred_user_id).toBe(regBody.user.id);

    const event = getTestDb()
      .prepare(`SELECT event_type FROM referral_events WHERE referral_id = 'ref_anon' AND event_type = 'user_linked'`)
      .get() as { event_type: string } | undefined;
    expect(event?.event_type).toBe("user_linked");

    authTestState.testDb?.close();
  });

  it("treats a mock-role cookie alone as anonymous", async () => {
    authTestState.cookieJar.set("lms_mock_session_role", "ADMIN");

    const user = await getSessionUser();

    expect(user.roles).toEqual(["ANONYMOUS"]);
    expect(authTestState.cookieJar.has("lms_mock_session_role")).toBe(false);

    authTestState.testDb?.close();
  });

  it("keeps role simulation as an overlay on a validated real session", async () => {
    const regRes = await registerRoute(
      jsonRequest({ email: "overlay@test.com", password: "password123", name: "Overlay User" }),
    );
    const regBody = await regRes.json();
    authTestState.cookieJar.set("lms_mock_session_role", "ADMIN");

    const user = await getSessionUser();

    expect(user.id).toBe(regBody.user.id);
    expect(user.roles).toEqual(["ADMIN"]);

    authTestState.testDb?.close();
  });

  it("clears stale session and mock cookies when session validation fails", async () => {
    await registerRoute(
      jsonRequest({ email: "stale@test.com", password: "password123", name: "Stale User" }),
    );

    authTestState.cookieJar.set("lms_session_token", "invalid-session-token");
    authTestState.cookieJar.set("lms_mock_session_role", "ADMIN");

    const user = await getSessionUser();

    expect(user.roles).toEqual(["ANONYMOUS"]);
    expect(authTestState.cookieJar.has("lms_session_token")).toBe(false);
    expect(authTestState.cookieJar.has("lms_mock_session_role")).toBe(false);

    authTestState.testDb?.close();
  });
});
