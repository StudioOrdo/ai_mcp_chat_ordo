import { getUserPreferencesDataMapper } from "@/adapters/RepositoryFactory";
import type { UserTier } from "@/core/entities/user";
import { ACCOUNT_TIER_PREFERENCE_KEY } from "@/lib/access/content-access";
import { queuePendingLifecycleEvent } from "./lifecycle-queue";

/**
 * Canonical write path for a user's `account_tier` preference. Persists the
 * new tier AND emits a `tier_upgraded` lifecycle event when the value
 * actually changes, so any admin/billing surface that mutates tier picks up
 * the coach sequence automatically.
 *
 * The `set_preference` chat tool continues to refuse `account_tier` writes;
 * this helper is the opposite side of that pin (server-side, authenticated
 * admin/billing code only).
 *
 * Returns `true` if the tier changed, `false` if the value was already set
 * to the requested tier (no event queued in that case).
 */
export async function setAccountTier(
  userId: string,
  nextTier: UserTier,
  options: { actor?: string; detail?: string } = {},
): Promise<boolean> {
  if (!userId || userId === "usr_anonymous") return false;
  const prefs = getUserPreferencesDataMapper();
  const existing = await prefs.get(userId, ACCOUNT_TIER_PREFERENCE_KEY);
  if (existing?.value === nextTier) return false;
  await prefs.set(userId, ACCOUNT_TIER_PREFERENCE_KEY, nextTier);
  await queuePendingLifecycleEvent(userId, {
    variant: "tier_upgraded",
    occurredAt: new Date().toISOString(),
    actor: options.actor ?? "Admin",
    detail:
      options.detail ??
      (nextTier === "premium"
        ? "Account upgraded to premium."
        : "Account tier updated."),
  });
  return true;
}
