import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { checkOrigin } from "@/lib/security/origin-check";

function makeRequest(
  method: string,
  opts: { origin?: string; host?: string; forwardedHost?: string; forwardedProto?: string } = {},
): NextRequest {
  const url = new URL("/api/chat/stream", "http://localhost:3000");
  const headers = new Headers();
  if (opts.host) headers.set("host", opts.host);
  if (opts.origin) headers.set("origin", opts.origin);
  if (opts.forwardedHost) headers.set("x-forwarded-host", opts.forwardedHost);
  if (opts.forwardedProto) headers.set("x-forwarded-proto", opts.forwardedProto);
  return new NextRequest(url, { method, headers });
}

afterEach(() => {
  delete process.env.ALLOWED_ORIGINS;
  delete process.env.ORDO_HOSTED_MODE;
  delete process.env.ORDO_PUBLIC_ORIGIN;
  delete process.env.TRUST_PROXY_HEADERS;
});

describe("Spec 11: CSRF Origin Check", () => {
  it("GET requests bypass origin check", () => {
    const req = makeRequest("GET", { origin: "https://evil.com", host: "example.com" });
    expect(checkOrigin(req)).toBeNull();
  });

  it("POST with matching origin passes", () => {
    const req = makeRequest("POST", { origin: "https://example.com", host: "example.com" });
    expect(checkOrigin(req)).toBeNull();
  });

  it("POST with mismatched origin is rejected", async () => {
    const req = makeRequest("POST", { origin: "https://evil.com", host: "example.com" });
    const res = checkOrigin(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toBe("Origin not allowed");
  });

  it("POST without origin header passes", () => {
    const req = makeRequest("POST", { host: "example.com" });
    expect(checkOrigin(req)).toBeNull();
  });

  it("ALLOWED_ORIGINS env var adds extra allowed origins", () => {
    process.env.ALLOWED_ORIGINS = "https://cdn.example.com";
    const req = makeRequest("POST", { origin: "https://cdn.example.com", host: "example.com" });
    expect(checkOrigin(req)).toBeNull();
  });

  it("PUT, PATCH, DELETE are all checked", () => {
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const req = makeRequest(method, { origin: "https://evil.com", host: "example.com" });
      const res = checkOrigin(req);
      expect(res, `${method} should reject mismatched origin`).not.toBeNull();
      expect(res!.status).toBe(403);
    }
  });

  it("Origin matching is exact (no substring match)", () => {
    const req = makeRequest("POST", { origin: "https://example.com.evil.com", host: "example.com" });
    const res = checkOrigin(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("HTTP origin allowed for local dev", () => {
    const req = makeRequest("POST", { origin: "http://localhost:3000", host: "localhost:3000" });
    expect(checkOrigin(req)).toBeNull();
  });

  it("hosted mode accepts the canonical public origin", () => {
    process.env.ORDO_HOSTED_MODE = "reverse_proxy";
    process.env.ORDO_PUBLIC_ORIGIN = "https://tenant.example.com";
    const req = makeRequest("POST", { origin: "https://tenant.example.com", host: "internal.local" });
    expect(checkOrigin(req)).toBeNull();
  });

  it("hosted mode rejects arbitrary Host matches", async () => {
    process.env.ORDO_HOSTED_MODE = "reverse_proxy";
    process.env.ORDO_PUBLIC_ORIGIN = "https://tenant.example.com";
    const req = makeRequest("POST", { origin: "https://internal.local", host: "internal.local" });

    const res = checkOrigin(req);

    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("hosted mode does not trust spoofed forwarded host for CSRF", async () => {
    process.env.ORDO_HOSTED_MODE = "reverse_proxy";
    process.env.ORDO_PUBLIC_ORIGIN = "https://tenant.example.com";
    process.env.TRUST_PROXY_HEADERS = "1";
    const req = makeRequest("POST", {
      origin: "https://evil.example.com",
      host: "internal.local",
      forwardedHost: "evil.example.com",
      forwardedProto: "https",
    });

    const res = checkOrigin(req);

    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("hosted canonical origin still passes when optional ALLOWED_ORIGINS has a malformed value", () => {
    process.env.ORDO_HOSTED_MODE = "reverse_proxy";
    process.env.ORDO_PUBLIC_ORIGIN = "https://tenant.example.com";
    process.env.ALLOWED_ORIGINS = "not-a-url";
    const req = makeRequest("POST", { origin: "https://tenant.example.com", host: "internal.local" });

    expect(checkOrigin(req)).toBeNull();
  });
});
