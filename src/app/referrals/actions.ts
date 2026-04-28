"use server";

import { getSessionUser } from "@/lib/auth";
import {
  buildCampaignPresetCoachPayload,
  buildCampaignPresetCoachPayloadFromCorpus,
  getCampaignPreset,
  isCampaignPresetKey,
} from "@/lib/referrals/campaign-presets";
import { queuePendingCampaignCoach } from "@/lib/referrals/campaign-queue";
import { getCorpusRepository } from "@/adapters/RepositoryFactory";

export interface SelectCampaignPresetResult {
  ok: boolean;
  error?: "anonymous" | "unknown_preset" | "unavailable";
}

/**
 * Phase 3 — authenticated user picks a referral campaign preset.
 *
 * Queues a `variant: "campaign_picked"` coach payload onto the user's
 * pending campaign coach queue. The payload is drained and rendered by
 * `useCampaignContext` on the next chat open.
 *
 * The action never mutates anything the user can observe outside chat:
 * no tier flips, no corpus writes, no analytics side-effects beyond the
 * existing AffiliateAnalyticsService instrumentation already owned by
 * the referrals surface.
 */
export async function selectCampaignPresetAction(
  presetKey: string,
): Promise<SelectCampaignPresetResult> {
  const user = await getSessionUser();
  if (!user || user.id === "usr_anonymous" || user.roles.includes("ANONYMOUS")) {
    return { ok: false, error: "anonymous" };
  }

  if (!isCampaignPresetKey(presetKey)) {
    return { ok: false, error: "unknown_preset" };
  }

  const preset = getCampaignPreset(presetKey);
  if (!preset) {
    return { ok: false, error: "unknown_preset" };
  }

  try {
    // Phase 4: prefer the retrieval-backed builder so the "Read the
    // full guide" action is appended when a `class: "guide"` corpus
    // entry exists at `preset.corpusSlug`. Falls back to the templated
    // Phase 3 payload on any repository error.
    let payload;
    try {
      const corpusRepository = getCorpusRepository();
      payload = await buildCampaignPresetCoachPayloadFromCorpus(
        preset,
        corpusRepository,
      );
    } catch {
      payload = buildCampaignPresetCoachPayload(preset);
    }
    await queuePendingCampaignCoach(user.id, payload);
    return { ok: true };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
