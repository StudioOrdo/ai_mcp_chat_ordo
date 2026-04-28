/**
 * Campaign coach variants — the non-lifecycle coach sequences introduced in
 * Phase 3. They pair with the referral/campaign growth surface rather than
 * a lifecycle milestone.
 *
 * Kept in a dedicated union (rather than reusing `LifecycleVariant`) so the
 * lifecycle queue, lifecycle card, and lifecycle context route stay typed
 * to lifecycle-only variants and cannot accidentally surface a campaign
 * coach as a lifecycle card.
 */
export type CampaignVariant =
  /** First chat render after an anonymous visitor arrives via a signed referral link. */
  | "campaign_introduction"
  /** Authenticated user picked a campaign preset in the referrals workspace. */
  | "campaign_picked";

export const CAMPAIGN_VARIANTS: readonly CampaignVariant[] = [
  "campaign_introduction",
  "campaign_picked",
] as const;

export function isCampaignVariant(value: unknown): value is CampaignVariant {
  return (
    typeof value === "string"
    && (CAMPAIGN_VARIANTS as readonly string[]).includes(value)
  );
}
