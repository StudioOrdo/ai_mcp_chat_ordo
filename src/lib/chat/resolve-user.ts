import { cookies } from "next/headers";
import { getSessionUser, resolveSessionAuthorizationRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

const ANON_SESSION_COOKIE = "lms_anon_session";

/**
 * Ensures an anonymous user row exists in the users table so that FK
 * constraints on conversations.user_id are satisfied.
 */
function ensureAnonUser(userId: string): void {
  // getDb() approved: raw SQL query — see data-access-canary.test.ts (Sprint 9)
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)`,
  ).run(userId, `${userId}@anonymous.local`, "Anonymous");
  db.prepare(
    `INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'role_anonymous')`,
  ).run(userId);
}

/**
 * Resolves the user ID for conversation ownership.
 * - Authenticated users: returns their real user.id
 * - Anonymous users: returns "anon_{uuid}" from a stable cookie
 */
export async function resolveUserId(): Promise<{
  userId: string;
  isAnonymous: boolean;
}> {
  const user = await getSessionUser();
  const isAnonymous = resolveSessionAuthorizationRole(user) === "ANONYMOUS";

  if (!isAnonymous) {
    return { userId: user.id, isAnonymous: false };
  }

  const cookieStore = await cookies();
  const existing = cookieStore.get(ANON_SESSION_COOKIE)?.value;

  if (existing) {
    const userId = `anon_${existing}`;
    ensureAnonUser(userId);
    return { userId, isAnonymous: true };
  }

  const uuid = crypto.randomUUID();
  cookieStore.set(ANON_SESSION_COOKIE, uuid, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  const userId = `anon_${uuid}`;
  ensureAnonUser(userId);
  return { userId, isAnonymous: true };
}

/**
 * Reads the anonymous session cookie value (without the "anon_" prefix).
 * Returns null if no anonymous session exists.
 */
export async function getAnonSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ANON_SESSION_COOKIE)?.value ?? null;
}

/**
 * Clears the anonymous session cookie (called after migration to authenticated).
 */
export async function clearAnonSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ANON_SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}
