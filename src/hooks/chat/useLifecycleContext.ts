"use client";

import { useEffect, useRef, type Dispatch } from "react";

import type { RoleName } from "@/core/entities/user";
import { MessageFactory } from "@/core/entities/MessageFactory";
import type { ChatMessage } from "@/core/entities/chat-message";
import type { ChatAction } from "@/hooks/chat/chatState";
import type { LifecycleContextResponse } from "@/app/api/lifecycle/context/route";

/**
 * Phase 2 — conversation-first lifecycle consumer.
 *
 * Mirrors `useReferralContext`: runs once before the first assistant turn
 * for authenticated users, fetches `GET /api/lifecycle/context`, and
 * appends system messages for each pending event (a lifecycle card plus,
 * when a template exists, a coach card).
 *
 * Anonymous sessions skip the fetch entirely. Failures are swallowed so
 * the chat surface continues to render.
 */
export function useLifecycleContext(
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

    fetch("/api/lifecycle/context")
      .then((r) => (r.ok ? (r.json() as Promise<LifecycleContextResponse>) : null))
      .then((data) => {
        if (!data || !Array.isArray(data.items) || data.items.length === 0) return;
        const messages: ChatMessage[] = [];
        for (const item of data.items) {
          messages.push(
            MessageFactory.createSystemMessage({ lifecycle: item.lifecycle }),
          );
          if (item.coach) {
            messages.push(
              MessageFactory.createSystemMessage({ coach: item.coach }),
            );
          }
        }
        if (messages.length > 0) {
          dispatch({ type: "APPEND_MESSAGES", messages });
        }
      })
      .catch(() => {
        /* best-effort: lifecycle context is non-critical */
      });
  }, [canResolve, initialRole, dispatch]);
}
