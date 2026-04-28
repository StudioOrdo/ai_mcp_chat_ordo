import { getUserPreferencesDataMapper } from "@/adapters/RepositoryFactory";
import { isCampaignVariant } from "@/core/entities/campaign";
import type { CoachPayload } from "@/core/entities/coach";

const PENDING_KEY = "pending_campaign_coach";
const MAX_QUEUE_LENGTH = 4;

function isCampaignCoachPayload(value: unknown): value is CoachPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.title === "string"
    && typeof record.currentStep === "number"
    && Array.isArray(record.steps)
    && Array.isArray(record.actions)
    && isCampaignVariant(record.variant)
  );
}

function parseQueue(raw: string | undefined | null): CoachPayload[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCampaignCoachPayload);
  } catch {
    return [];
  }
}

/**
 * Append a campaign coach payload to the target user's pending queue.
 * Mirrors `queuePendingLifecycleEvent` but stores fully-built
 * `CoachPayload`s rather than lifecycle events, because campaign coach
 * shape is not one-to-one with a lifecycle variant.
 *
 * Best-effort: failures are swallowed so server actions do not fail when
 * the preferences store is unavailable.
 */
export async function queuePendingCampaignCoach(
  userId: string,
  payload: CoachPayload,
): Promise<void> {
  if (!userId || userId === "usr_anonymous") return;
  if (!isCampaignVariant(payload.variant)) return;
  try {
    const prefs = getUserPreferencesDataMapper();
    const existing = await prefs.get(userId, PENDING_KEY);
    const queue = parseQueue(existing?.value ?? null);
    queue.push(payload);
    const trimmed = queue.slice(-MAX_QUEUE_LENGTH);
    await prefs.set(userId, PENDING_KEY, JSON.stringify(trimmed));
  } catch {
    // Best-effort only.
  }
}

/**
 * Return the current pending queue without mutating it. Used by tests
 * and by surfaces that want to peek before consuming.
 */
export async function peekPendingCampaignCoach(
  userId: string,
): Promise<CoachPayload[]> {
  if (!userId || userId === "usr_anonymous") return [];
  try {
    const prefs = getUserPreferencesDataMapper();
    const existing = await prefs.get(userId, PENDING_KEY);
    return parseQueue(existing?.value ?? null);
  } catch {
    return [];
  }
}

/**
 * Drain the queue for `userId` and return every queued campaign coach
 * payload. Called by `GET /api/campaign/context` on the first chat
 * render after the user picks a preset.
 */
export async function consumePendingCampaignCoach(
  userId: string,
): Promise<CoachPayload[]> {
  if (!userId || userId === "usr_anonymous") return [];
  try {
    const prefs = getUserPreferencesDataMapper();
    const existing = await prefs.get(userId, PENDING_KEY);
    const queue = parseQueue(existing?.value ?? null);
    if (queue.length > 0) {
      await prefs.delete(userId, PENDING_KEY);
    }
    return queue;
  } catch {
    return [];
  }
}
