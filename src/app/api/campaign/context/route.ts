import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { consumePendingCampaignCoach } from "@/lib/referrals/campaign-queue";
import { createCoachEnvelope } from "@/frameworks/ui/chat/plugins/system/coach-descriptor";
import type { CoachEnvelope } from "@/core/entities/coach";

/**
 * Phase 3 — campaign coach consumer.
 *
 * GET /api/campaign/context
 *   - Drains the authenticated user's pending campaign coach queue.
 *   - Returns one `CoachEnvelope` per queued coach payload.
 *   - Anonymous users receive an empty list (the anonymous campaign
 *     coach path lives on `/api/referral/visit`).
 *
 * The client (`useCampaignContext`) appends these to the chat as
 * `role: "system"` messages on the first render after the user picks a
 * preset. See F7 envelope contract.
 */

export interface CampaignContextItem {
  coach: CoachEnvelope;
}

export interface CampaignContextResponse {
  items: CampaignContextItem[];
}

export async function GET(): Promise<NextResponse<CampaignContextResponse>> {
  const user = await getSessionUser();
  if (!user || user.id === "usr_anonymous") {
    return NextResponse.json({ items: [] });
  }

  const payloads = await consumePendingCampaignCoach(user.id);
  const items: CampaignContextItem[] = payloads.map((payload) => ({
    coach: createCoachEnvelope(payload),
  }));

  return NextResponse.json({ items });
}
