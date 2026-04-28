import type { CapabilityResultEnvelope } from "./capability-result";

/**
 * Lifecycle events represent customer-facing milestones that deserve a
 * distinct visual contract in chat: install continuation, onboarding,
 * role promotion, tier upgrade, capability unlocks.
 *
 * These are rendered by `LifecycleCard` under `src/frameworks/ui/chat/plugins/system`.
 * They ride on `role: "system"` messages via `ChatMessageMetadata.lifecycle`.
 */
export type LifecycleVariant =
  | "installed"
  | "onboarded"
  | "role_changed"
  | "tier_upgraded"
  | "capability_unlocked";

export interface LifecyclePayload {
  variant: LifecycleVariant;
  /** ISO-8601 timestamp for when the lifecycle event occurred. */
  occurredAt: string;
  /** Optional actor label (e.g. "Admin", "System") shown in the card caption. */
  actor?: string;
  /** Optional free-text detail (e.g. "Promoted to APPRENTICE"). */
  detail?: string;
}

export type LifecycleEnvelope = CapabilityResultEnvelope<LifecyclePayload>;

export const LIFECYCLE_EVENT_TOOL_NAME = "lifecycle_event";
