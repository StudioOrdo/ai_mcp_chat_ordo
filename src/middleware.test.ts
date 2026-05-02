import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

function makeRequest(path: string, cookie?: string): NextRequest {
  const url = new URL(path, "http://localhost:3000");
  const headers = new Headers();
  if (cookie) {
    headers.set("cookie", cookie);
  }
  return new NextRequest(url, { headers });
}

describe("Edge proxy", () => {
  it("passes public auth routes without cookie", () => {
    const res = proxy(makeRequest("/api/auth/register"));
    expect(res.status).toBe(200);

    const res2 = proxy(makeRequest("/api/auth/login"));
    expect(res2.status).toBe(200);
  });

  it("passes chat routes without cookie (ANONYMOUS access)", () => {
    const res = proxy(makeRequest("/api/chat/stream"));
    expect(res.status).toBe(200);
  });

  it("passes health routes without cookie", () => {
    const res = proxy(makeRequest("/api/health/live"));
    expect(res.status).toBe(200);
  });

  it("returns 401 for /api/auth/me without cookie", async () => {
    const res = proxy(makeRequest("/api/auth/me"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Authentication required");
  });

  it("returns 401 for /api/auth/logout without cookie", async () => {
    const res = proxy(makeRequest("/api/auth/logout"));
    expect(res.status).toBe(401);
  });

  it("returns 401 for /api/auth/switch without cookie", async () => {
    const res = proxy(makeRequest("/api/auth/switch"));
    expect(res.status).toBe(401);
  });

  it("returns 401 for /api/conversations without cookie", async () => {
    const res = proxy(makeRequest("/api/conversations"));
    expect(res.status).toBe(401);
  });

  it("passes active conversation restore routes without cookie", () => {
    const activeRes = proxy(makeRequest("/api/conversations/active"));
    expect(activeRes.status).toBe(200);

    const archiveRes = proxy(makeRequest("/api/conversations/active/archive"));
    expect(archiveRes.status).toBe(200);
  });

  it("returns 401 for conversation detail routes without cookie", async () => {
    const res = proxy(makeRequest("/api/conversations/conv_123"));
    expect(res.status).toBe(401);
  });

  it("passes protected routes when cookie is present", () => {
    const res = proxy(makeRequest("/api/auth/me", "lms_session_token=some-token"));
    expect(res.status).toBe(200);
  });

  it("redirects first-boot page routes to install without the install cookie", () => {
    const res = proxy(makeRequest("/login"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/install");
  });

  it("passes page routes after the browser has the install cookie", () => {
    const res = proxy(makeRequest("/login", "ordo_installed=1"));
    expect(res.status).toBe(200);
  });
});
