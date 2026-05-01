import type { ChatMessage } from "@/core/entities/chat-message";
import type { MessagePart } from "@/core/entities/message-parts";
import { isProviderCreditExhaustionMessage } from "@/lib/chat/stream-error-classification";

export const PROVIDER_CREDIT_EXHAUSTION_COOLDOWN_MS = 2 * 60 * 1000;

export interface ProviderCreditCircuitBreakerState {
  active: boolean;
  reason: string | null;
  retryAfterMs: number;
}

function isCreditExhaustionPart(part: MessagePart): part is MessagePart & { type: "generation_status" } {
  return part.type === "generation_status"
    && part.status === "interrupted"
    && isProviderCreditExhaustionMessage(part.reason);
}

function resolvePartTimestamp(message: ChatMessage, part: MessagePart & { type: "generation_status" }): number {
  const recordedAt = part.recordedAt ? Date.parse(part.recordedAt) : Number.NaN;
  if (Number.isFinite(recordedAt)) {
    return recordedAt;
  }

  return message.timestamp?.getTime() ?? 0;
}

export function getProviderCreditCircuitBreakerState(
  messages: readonly ChatMessage[],
  nowMs = Date.now(),
  cooldownMs = PROVIDER_CREDIT_EXHAUSTION_COOLDOWN_MS,
): ProviderCreditCircuitBreakerState {
  let latestReason: string | null = null;
  let latestTimestamp = 0;

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (!isCreditExhaustionPart(part)) {
        continue;
      }

      const timestamp = resolvePartTimestamp(message, part);
      if (timestamp >= latestTimestamp) {
        latestTimestamp = timestamp;
        latestReason = part.reason;
      }
    }
  }

  if (!latestReason || latestTimestamp <= 0) {
    return { active: false, reason: null, retryAfterMs: 0 };
  }

  const retryAfterMs = Math.max(0, cooldownMs - (nowMs - latestTimestamp));
  return {
    active: retryAfterMs > 0,
    reason: latestReason,
    retryAfterMs,
  };
}

export function formatProviderCreditCircuitBreakerMessage(state: ProviderCreditCircuitBreakerState): string {
  const seconds = Math.max(1, Math.ceil(state.retryAfterMs / 1000));
  return state.reason
    ? `${state.reason} New sends are paused for ${seconds} seconds to avoid duplicating failed turns.`
    : `Provider credits are exhausted. New sends are paused for ${seconds} seconds to avoid duplicating failed turns.`;
}