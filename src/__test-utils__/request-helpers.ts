/**
 * NextRequest / Request construction helpers for API route tests.
 *
 * Absorbs the patterns from tests/helpers/workflow-route-fixture.ts and
 * tests/helpers/request.ts into a single typed module.
 */
import { NextRequest } from "next/server";

/**
 * Build a NextRequest suitable for API route handler tests.
 *
 * ```ts
 * const req = createRouteRequest("/api/profile", "GET");
 * const req = createRouteRequest("/api/chat/jobs", "POST", { text: "hello" });
 * ```
 */
export function createRouteRequest(
  url: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: unknown,
  headers?: HeadersInit,
): NextRequest {
  const parsed = url.startsWith("http") ? new URL(url) : new URL(url, "http://localhost:3000");
  return new NextRequest(parsed, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Build a route params object matching Next.js App Router convention.
 * Next.js 15 params are wrapped in a Promise.
 *
 * ```ts
 * createRouteParams("post_123")              // { params: Promise<{ id: "post_123" }> }
 * createRouteParams({ jobId: "job_1" })      // { params: Promise<{ jobId: "job_1" }> }
 * createRouteParams({ leadId: "lead_1" })    // { params: Promise<{ leadId: "lead_1" }> }
 * ```
 */
export function createRouteParams(input: string): { params: Promise<{ id: string }> };
export function createRouteParams<TParams extends Record<string, string>>(input: TParams): { params: Promise<TParams> };
export function createRouteParams(input: string | Record<string, string>) {
  const params = typeof input === "string" ? { id: input } : input;
  return { params: Promise.resolve(params) };
}

/**
 * Build a plain Request with a JSON body (non-NextRequest variant).
 * Some older tests use `Request` instead of `NextRequest`.
 */
export function createJsonRequest(url: string, payload: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
