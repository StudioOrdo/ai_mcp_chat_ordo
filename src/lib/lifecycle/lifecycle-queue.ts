import { getUserPreferencesDataMapper } from "@/adapters/RepositoryFactory";
import type { LifecyclePayload, LifecycleVariant } from "@/core/entities/lifecycle";

const PENDING_KEY = "pending_lifecycle_events";
const MAX_QUEUE_LENGTH = 8;

function isLifecyclePayload(value: unknown): value is LifecyclePayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const variant = record.variant;
  const validVariant: LifecycleVariant[] = [
    "installed",
    "onboarded",
    "role_changed",
    "tier_upgraded",
    "capability_unlocked",
  ];
  return (
    typeof variant === "string" &&
    (validVariant as string[]).includes(variant) &&
    typeof record.occurredAt === "string"
  );
}

function parseQueue(raw: string | undefined | null): LifecyclePayload[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLifecyclePayload);
  } catch {
    return [];
  }
}

/**
 * Append a lifecycle event to the target user's pending queue. The queue is
 * drained by `consumePendingLifecycleEvents()` on the next opportunity the
 * client renders lifecycle cards.
 *
 * Best-effort: failures are swallowed so server actions continue successfully
 * even if the preferences store is unavailable.
 */
export async function queuePendingLifecycleEvent(
  userId: string,
  payload: LifecyclePayload,
): Promise<void> {
  if (!userId || userId === "usr_anonymous") return;
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
 * Returns the current pending queue without mutating it. Useful for
 * visibility/tests.
 */
export async function peekPendingLifecycleEvents(
  userId: string,
): Promise<LifecyclePayload[]> {
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
 * Drains the pending queue for a user. Returns the events that were pending
 * and clears the storage slot. Consumers are Phase 2's conversation-first
 * onboarding; Phase 1 emits and tests the queue but does not wire a live
 * consumer into the chat surface.
 */
export async function consumePendingLifecycleEvents(
  userId: string,
): Promise<LifecyclePayload[]> {
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
