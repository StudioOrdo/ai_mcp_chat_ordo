/**
 * Response assertion helpers for API route tests.
 *
 * Reduces the common 2-line idiom:
 * ```ts
 * expect(response.status).toBe(200);
 * const body = await response.json();
 * ```
 * To:
 * ```ts
 * const body = await expectJsonResponse(response, 200);
 * ```
 */
import { expect } from "vitest";

/**
 * Assert response status and parse + return the JSON body.
 *
 * ```ts
 * const body = await expectJsonResponse(response, 200);
 * expect(body.deal.id).toBe("deal_1");
 * ```
 */
export async function expectJsonResponse(response: Response, status: number) {
  expect(response.status).toBe(status);
  return response.json();
}

/**
 * Assert response status without parsing body (for error/empty responses).
 *
 * ```ts
 * expectStatus(response, 401);
 * ```
 */
export function expectStatus(response: Response, status: number) {
  expect(response.status).toBe(status);
}
