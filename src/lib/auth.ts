import { cookies } from "next/headers";
import { getDb } from "./db";
import { getUserDataMapper } from "../adapters/RepositoryFactory";
import { SessionDataMapper } from "../adapters/SessionDataMapper";
import { BcryptHasher } from "../adapters/BcryptHasher";
import { RegisterUserInteractor } from "../core/use-cases/RegisterUserInteractor";
import { AuthenticateUserInteractor } from "../core/use-cases/AuthenticateUserInteractor";
import { ValidateSessionInteractor } from "../core/use-cases/ValidateSessionInteractor";
import { VALID_ROLE_IDS } from "../core/use-cases/UserAdminInteractor";
import { LoggingDecorator } from "../core/common/LoggingDecorator";
import type { RoleName, User as SessionUser } from "../core/entities/user";
import type { AuthResult } from "../core/use-cases/RegisterUserInteractor";

export type { RoleName, SessionUser, AuthResult };

// ── Composition root: wire interactors to concrete adapters ──

function getAuthInteractors() {
  // getDb() approved: raw SQL query — see data-access-canary.test.ts (Sprint 9)
  const db = getDb();
  const userRepo = getUserDataMapper();
  const sessionRepo = new SessionDataMapper(db);
  const hasher = new BcryptHasher();

  return {
    register: new LoggingDecorator(
      new RegisterUserInteractor(userRepo, hasher, sessionRepo),
      "RegisterUser",
    ),
    authenticate: new LoggingDecorator(
      new AuthenticateUserInteractor(userRepo, hasher, sessionRepo),
      "AuthenticateUser",
    ),
    validateSession: new LoggingDecorator(
      new ValidateSessionInteractor(sessionRepo, userRepo),
      "ValidateSession",
    ),
    sessionRepo,
  };
}

// ── New auth convenience functions ──

export async function register(input: {
  email: string;
  password: string;
  name: string;
}): Promise<AuthResult> {
  const { register: interactor } = getAuthInteractors();
  return interactor.execute(input);
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const { authenticate } = getAuthInteractors();
  return authenticate.execute(input);
}

export async function logout(sessionToken: string): Promise<void> {
  const { sessionRepo } = getAuthInteractors();
  await sessionRepo.delete(sessionToken);
}

export async function validateSession(
  token: string,
): Promise<SessionUser> {
  const { validateSession: interactor, sessionRepo } = getAuthInteractors();
  const user = await interactor.execute({ token });

  // Opportunistic expired-session prune (~1% of requests)
  if (Math.random() < 0.01) {
    sessionRepo.deleteExpired().catch(() => {});
  }

  return user;
}

// ── Session cookie constants ──

const SESSION_COOKIE_NAME = "lms_session_token";
const MOCK_SESSION_COOKIE_NAME = "lms_mock_session_role";

const ANONYMOUS_USER: SessionUser = {
  id: "usr_anonymous",
  email: "anonymous@example.com",
  name: "Anonymous User",
  roles: ["ANONYMOUS"],
};

function tryDeleteCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  name: string,
) {
  try {
    cookieStore.delete(name);
  } catch {
    // `getSessionUser()` also runs in read-only request contexts like layouts.
  }
}

function clearStaleAuthCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
  tryDeleteCookie(cookieStore, SESSION_COOKIE_NAME);
  tryDeleteCookie(cookieStore, MOCK_SESSION_COOKIE_NAME);
}

/**
 * Resolves the current user from the session.
 * 1. Try real session token (lms_session_token cookie → ValidateSessionInteractor)
 * 2. Clear any stale legacy mock-role cookie
 * 3. Default to ANONYMOUS
 */
export async function getSessionUser(): Promise<SessionUser> {
  const cookieStore = await cookies();

  // 1. Try real session token first
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken) {
    try {
      const realUser = await validateSession(sessionToken);
      tryDeleteCookie(cookieStore, MOCK_SESSION_COOKIE_NAME);

      return { ...realUser, realRoles: realUser.roles, simulatedRole: null };
    } catch {
      clearStaleAuthCookies(cookieStore);
      return ANONYMOUS_USER;
    }
  }

  if (cookieStore.get(MOCK_SESSION_COOKIE_NAME)?.value) {
    tryDeleteCookie(cookieStore, MOCK_SESSION_COOKIE_NAME);
  }

  // 3. Default to ANONYMOUS
  return ANONYMOUS_USER;
}

export async function clearMockSession() {
  const cookieStore = await cookies();
  tryDeleteCookie(cookieStore, MOCK_SESSION_COOKIE_NAME);
}

/**
 * Updates the role that is actually persisted on the signed-in account.
 *
 * Local testing depends on prompt assembly, tool manifests, operation audit
 * roles, and admin surfaces all seeing the same role. A cookie overlay creates
 * a split-brain session, so role switching is intentionally DB-backed.
 */
export async function switchSessionUserRole(userId: string, role: RoleName): Promise<void> {
  const roleId = VALID_ROLE_IDS[role];
  if (!roleId) {
    throw new Error(`Invalid role: ${role}`);
  }

  await getUserDataMapper().updateRole(userId, roleId);
}

const ROLE_AUTHORITY_ORDER: RoleName[] = [
  "ADMIN",
  "STAFF",
  "APPRENTICE",
  "AUTHENTICATED",
  "ANONYMOUS",
];

/**
 * Selects the role used for server-side authorization.
 *
 * The role switcher now persists to user_roles, so real database roles are the
 * canonical source. `realRoles` is retained for older call sites that pass both
 * fields during a request, but it should mirror `roles`.
 */
export function resolveSessionAuthorizationRole(
  user: Pick<SessionUser, "roles" | "realRoles">,
): RoleName {
  const realRoles = user.realRoles?.length ? user.realRoles : [];
  const candidateRoles = realRoles.length > 0
    ? [...realRoles, ...user.roles]
    : user.roles;

  return ROLE_AUTHORITY_ORDER.find((role) => candidateRoles.includes(role))
    ?? user.roles[0]
    ?? "ANONYMOUS";
}

export function sessionHasRole(
  user: Pick<SessionUser, "roles" | "realRoles">,
  allowedRoles: RoleName[],
): boolean {
  const roles = new Set([...(user.realRoles ?? []), ...user.roles]);
  return allowedRoles.some((role) => roles.has(role));
}

/**
 * Helper to block access if the user lacks the required RBAC role.
 */
export async function requireRole(allowedRoles: RoleName[]) {
  const user = await getSessionUser();
  const hasAccess = sessionHasRole(user, allowedRoles);

  if (!hasAccess) {
    throw new Error(
      `Unauthorized. Requires one of: ${allowedRoles.join(", ")}`,
    );
  }
}
