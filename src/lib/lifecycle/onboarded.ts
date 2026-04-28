import { getUserPreferencesDataMapper } from "@/adapters/RepositoryFactory";
import { queuePendingLifecycleEvent } from "./lifecycle-queue";

/**
 * User preference key marking the moment a user completed their first
 * authenticated sign-in. Presence of this preference suppresses repeat
 * emission of the `onboarded` lifecycle event.
 */
export const ONBOARDED_AT_PREFERENCE_KEY = "onboarded_at";

function isAnonymous(userId: string): boolean {
  return !userId || userId === "usr_anonymous";
}

/**
 * Emit a one-shot `onboarded` lifecycle event for the given user if they
 * have never been marked onboarded before. Sets `onboarded_at` first so
 * concurrent emissions cannot double-queue.
 *
 * Best-effort: failures are swallowed so this never breaks an auth flow.
 */
export async function ensureOnboardedEmission(userId: string): Promise<void> {
  if (isAnonymous(userId)) return;
  try {
    const prefs = getUserPreferencesDataMapper();
    const existing = await prefs.get(userId, ONBOARDED_AT_PREFERENCE_KEY);
    if (existing?.value) return;
    const now = new Date().toISOString();
    await prefs.set(userId, ONBOARDED_AT_PREFERENCE_KEY, now);
    await queuePendingLifecycleEvent(userId, {
      variant: "onboarded",
      occurredAt: now,
      actor: "System",
      detail: "Account setup finished.",
    });
  } catch {
    // Best-effort only — never break login.
  }
}

/**
 * Mark a user as already onboarded without queueing a coach sequence. Used
 * by the install flow so the admin who just provisioned the workspace only
 * sees the `installed` lifecycle card (not a duplicate `onboarded` one on
 * their first login).
 */
export async function markOnboardedWithoutEmission(
  userId: string,
): Promise<void> {
  if (isAnonymous(userId)) return;
  try {
    const prefs = getUserPreferencesDataMapper();
    const existing = await prefs.get(userId, ONBOARDED_AT_PREFERENCE_KEY);
    if (existing?.value) return;
    await prefs.set(
      userId,
      ONBOARDED_AT_PREFERENCE_KEY,
      new Date().toISOString(),
    );
  } catch {
    // Best-effort only.
  }
}
