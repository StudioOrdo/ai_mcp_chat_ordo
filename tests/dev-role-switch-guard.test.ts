import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const getSessionUserMock = vi.fn();
const switchSessionUserRoleMock = vi.fn();
const clearMockSessionMock = vi.fn();
const resolveSessionAuthorizationRoleMock = vi.fn((user: { roles: string[] }) => user.roles[0]);

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
  switchSessionUserRole: switchSessionUserRoleMock,
  clearMockSession: clearMockSessionMock,
  resolveSessionAuthorizationRole: resolveSessionAuthorizationRoleMock,
}));

// Capture logEvent calls for audit-log assertions
const logEventMock = vi.fn();
const logFailureMock = vi.fn();
vi.mock("@/lib/observability/logger", () => ({
  logEvent: logEventMock,
  logFailure: logFailureMock,
}));

vi.mock("@/lib/observability/reason-codes", () => ({
  REASON_CODES: { UNKNOWN_ROUTE_ERROR: "UNKNOWN_ROUTE_ERROR" },
}));

// We control env config via this mock
const envConfigValues: Record<string, string | undefined> = {};
vi.mock("@/lib/config/env-config", () => ({
  getEnvConfig: () => envConfigValues,
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/switch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fakeUser(roles: string[], id = "user-1") {
  return { id, roles };
}

let POST: (req: Request) => Promise<Response>;

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Spec 12 — Dev Role-Switch Guard Hardening", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset env defaults
    envConfigValues.NODE_ENV = "production";

    switchSessionUserRoleMock.mockResolvedValue(undefined);
    clearMockSessionMock.mockResolvedValue(undefined);
    resolveSessionAuthorizationRoleMock.mockImplementation((user: { roles: string[] }) => user.roles[0]);

    // Dynamic import so mocks are in place
    const mod = await import("@/app/api/auth/switch/route");
    POST = mod.POST;
  });

  // --- Test 1 ---
  it("ADMIN user can switch role in production", async () => {
    getSessionUserMock.mockResolvedValue(fakeUser(["ADMIN"]));
    envConfigValues.NODE_ENV = "production";

    const res = await POST(makeRequest({ role: "STAFF" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activeRole).toBe("STAFF");
    expect(body.persisted).toBe(true);
    expect(switchSessionUserRoleMock).toHaveBeenCalledWith("user-1", "STAFF");
  });

  // --- Test 2 ---
  it("non-ADMIN user cannot switch role in production", async () => {
    getSessionUserMock.mockResolvedValue(fakeUser(["STAFF"]));
    envConfigValues.NODE_ENV = "production";

    const res = await POST(makeRequest({ role: "ADMIN" }));
    expect(res.status).toBe(403);
  });

  // --- Test 3 ---
  it("non-ADMIN user can switch in development", async () => {
    getSessionUserMock.mockResolvedValue(fakeUser(["STAFF"]));
    envConfigValues.NODE_ENV = "development";

    const res = await POST(makeRequest({ role: "ADMIN" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activeRole).toBe("ADMIN");
    expect(switchSessionUserRoleMock).toHaveBeenCalledWith("user-1", "ADMIN");
  });

  // --- Test 4 ---
  it("target role must be a valid role string", async () => {
    getSessionUserMock.mockResolvedValue(fakeUser(["ADMIN"]));

    const res = await POST(makeRequest({ role: "SUPERADMIN" }));
    expect(res.status).toBe(400);
  });

  // --- Test 5 ---
  it("target role is required", async () => {
    getSessionUserMock.mockResolvedValue(fakeUser(["ADMIN"]));

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  // --- Test 6 ---
  it("audit log is emitted on successful switch", async () => {
    getSessionUserMock.mockResolvedValue(fakeUser(["ADMIN"], "admin-42"));

    const res = await POST(makeRequest({ role: "STAFF" }));
    expect(res.status).toBe(200);

    expect(logEventMock).toHaveBeenCalledWith(
      "warn",
      "ROLE_SWITCH",
      expect.objectContaining({
        userId: "admin-42",
        targetRole: "STAFF",
      }),
    );
  });

  // --- Test 7 ---
  it("audit log is NOT emitted on rejected switch", async () => {
    getSessionUserMock.mockResolvedValue(fakeUser(["STAFF"]));
    envConfigValues.NODE_ENV = "production";

    const res = await POST(makeRequest({ role: "ADMIN" }));
    expect(res.status).toBe(403);

    // logEvent should NOT have been called with ROLE_SWITCH
    const roleSwitchCalls = logEventMock.mock.calls.filter(
      (args: unknown[]) => args[1] === "ROLE_SWITCH",
    );
    expect(roleSwitchCalls).toHaveLength(0);
  });

  // --- Test 8 ---
  it("accepts APPRENTICE as a valid target role", async () => {
    getSessionUserMock.mockResolvedValue(fakeUser(["ADMIN"]));

    const res = await POST(makeRequest({ role: "APPRENTICE" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.activeRole).toBe("APPRENTICE");
  });
});
