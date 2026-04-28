/**
 * Auth mock helpers.
 *
 * IMPORTANT: `vi.mock()` calls are hoisted by vitest — they must remain in
 * each test file. This helper simplifies the mock *return value*, not the
 * mock declaration itself.
 *
 * Usage:
 * ```ts
 * import { createGetSessionUserMock } from "@/__test-utils__";
 *
 * const getSessionUserMock = createGetSessionUserMock("ADMIN");
 * 
 * ```
 */
import { vi } from "vitest";
import type { RoleName } from "@/core/entities/user";
import { createMockUser } from "./fixtures";

/**
 * Create a pre-configured `getSessionUser` mock that resolves to a user
 * with the given role. The returned mock is a `vi.fn()` — tests can
 * call `.mockResolvedValue()` / `.mockResolvedValueOnce()` to override
 * per-case.
 */
export function createGetSessionUserMock(role: RoleName = "ADMIN") {
  return vi.fn().mockResolvedValue(createMockUser(role));
}
