"use client";

import { useEffect, useRef, type Dispatch } from "react";

import type { RoleName } from "@/core/entities/user";
import { MessageFactory } from "@/core/entities/MessageFactory";
import type { ChatMessage } from "@/core/entities/chat-message";
import type { ChatAction } from "@/hooks/chat/chatState";
import type { CampaignContextResponse } from "@/app/api/campaign/context/route";

/**
 * Phase 3 — campaign coach consumer.
 *
 * Mirrors `useLifecycleContext`: runs once before the first assistant turn
 * for authenticated users, fetches `GET /api/campaign/context`, and
 * appends a `role: "system"` message for each pending coach payload.
 *
 * Anonymous sessions skip the fetch entirely — the anonymous campaign
 * path rides on `useReferralContext` because it shares the referral
 * visit fetch.
 *
 * Failures are swallowed so the chat surface keeps rendering.
 */
export function useCampaignContext(
  initialRole: RoleName,
  dispatch: Dispatch<ChatAction>,
  canResolve = true,
): void {
  const resolved = useRef(false);

  useEffect(() => {
    if (resolved.current) return;
    if (!canResolve) return;
    if (initialRole === "ANONYMOUS") return;
    resolved.current = true;

    fetch("/api/campaign/context")
      .then((r) => (r.ok ? (r.json() as Promise<CampaignContextResponse>) : null))
      .then((data) => {
        if (!data || !Array.isArray(data.items) || data.items.length === 0) return;
        const messages: ChatMessage[] = data.items.map((item) =>
          MessageFactory.createSystemMessage({ coach: item.coach }),
        );
        if (messages.length > 0) {
          dispatch({ type: "APPEND_MESSAGES", messages });
        }
      })
      .catch(() => {
        /* best-effort: campaign context is non-critical */
      });
  }, [canResolve, initialRole, dispatch]);
}
