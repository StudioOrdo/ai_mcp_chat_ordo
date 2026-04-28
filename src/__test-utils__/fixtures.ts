/**
 * Shared entity builders for tests.
 *
 * Every builder returns a fully-valid entity with sensible defaults.
 * Pass `Partial<T>` overrides to customize specific fields without
 * hand-constructing entire objects in every test file.
 */
import type { User, RoleName } from "@/core/entities/user";

// ---------------------------------------------------------------------------
// User fixtures
// ---------------------------------------------------------------------------

const ROLE_DEFAULTS: Record<RoleName, { id: string; email: string; name: string }> = {
  ANONYMOUS:     { id: "anon_1",  email: "anon@example.com",  name: "Anon"  },
  AUTHENTICATED: { id: "usr_1",   email: "user@example.com",  name: "User"  },
  APPRENTICE:    { id: "appr_1",  email: "apprentice@example.com", name: "Apprentice" },
  STAFF:         { id: "staff_1", email: "staff@example.com", name: "Staff" },
  ADMIN:         { id: "admin_1", email: "admin@example.com", name: "Admin" },
};

/**
 * Build a mock `User` for the given role, merging any overrides.
 *
 * ```ts
 * createMockUser();                          // AUTHENTICATED by default
 * createMockUser("ADMIN");                   // admin with standard defaults
 * createMockUser("STAFF", { id: "custom" }); // staff with a custom id
 * ```
 */
export function createMockUser(role: RoleName = "AUTHENTICATED", overrides?: Partial<User>): User {
  const defaults = ROLE_DEFAULTS[role];
  return {
    id: defaults.id,
    email: defaults.email,
    name: defaults.name,
    roles: [role],
    ...overrides,
  };
}

/** Convenience: admin user with optional overrides. */
export function createAdminUser(overrides?: Partial<User>): User {
  return createMockUser("ADMIN", overrides);
}

/** Convenience: authenticated user with optional overrides. */
export function createAuthenticatedUser(overrides?: Partial<User>): User {
  return createMockUser("AUTHENTICATED", overrides);
}

/** Convenience: anonymous user with optional overrides. */
export function createAnonymousUser(overrides?: Partial<User>): User {
  return createMockUser("ANONYMOUS", overrides);
}

/** Convenience: staff user with optional overrides. */
export function createStaffUser(overrides?: Partial<User>): User {
  return createMockUser("STAFF", overrides);
}

/** Convenience: apprentice user with optional overrides. */
export function createApprenticeUser(overrides?: Partial<User>): User {
  return createMockUser("APPRENTICE", overrides);
}
