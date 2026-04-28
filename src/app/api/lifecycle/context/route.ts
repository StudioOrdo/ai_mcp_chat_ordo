import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import {
  consumePendingLifecycleEvents,
} from "@/lib/lifecycle/lifecycle-queue";
import { createLifecycleEnvelope } from "@/frameworks/ui/chat/plugins/system/lifecycle-descriptor";
import { createCoachEnvelope } from "@/frameworks/ui/chat/plugins/system/coach-descriptor";
import { buildCoachPayloadForLifecycle } from "@/lib/lifecycle/coach-templates";
import type { LifecycleEnvelope } from "@/core/entities/lifecycle";
import type { CoachEnvelope } from "@/core/entities/coach";

/**
 * Phase 2 — conversation-first onboarding consumer.
 *
 * GET /api/lifecycle/context
 *   - Drains the authenticated user's pending lifecycle queue.
 *   - For each pending event, returns a pair of envelopes:
 *       * a lifecycle envelope (the event itself)
 *       * a coach envelope with a template sequence (may be null)
 *   - Anonymous users receive an empty list.
 *
 * The client (`useLifecycleContext`) appends these to the chat as
 * `role: "system"` messages on the first turn. See F7 contract.
 */

export interface LifecycleContextItem {
  lifecycle: LifecycleEnvelope;
  coach: CoachEnvelope | null;
}

export interface LifecycleContextResponse {
  items: LifecycleContextItem[];
}

export async function GET(): Promise<NextResponse<LifecycleContextResponse>> {
  const user = await getSessionUser();
  if (!user || user.id === "usr_anonymous") {
    return NextResponse.json({ items: [] });
  }

  const events = await consumePendingLifecycleEvents(user.id);

  const items: LifecycleContextItem[] = events.map((event) => {
    const lifecycle = createLifecycleEnvelope(event);
    const coachPayload = buildCoachPayloadForLifecycle(event);
    const coach = coachPayload ? createCoachEnvelope(coachPayload) : null;
    return { lifecycle, coach };
  });

  return NextResponse.json({ items });
}
