/**
 * Shared provider resilience and observability policy.
 *
 * This module is the single source of truth for timeout, retry, model-fallback,
 * and error-classification logic.  All model-backed surfaces import from here.
 *
 * Sprint 4 — Shared Chat Provider Policy And Direct-Turn Alignment
 * Sprint 7 — Extended to non-chat surfaces (summarization, image, TTS, blog, web search)
 */

import { ProviderConfigService } from "@/lib/ai/providers/provider-config-service";
import type {
  CapabilityProviderId,
  IntelligenceProviderId,
  ResolvedIntelligenceProviderConfig,
} from "@/lib/ai/providers/types";
import { logEvent } from "@/lib/observability/logger";

// ---------------------------------------------------------------------------
// Policy resolution
// ---------------------------------------------------------------------------

export interface ProviderResiliencePolicy {
  provider: IntelligenceProviderId;
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  modelCandidates: string[];
}

/**
 * Resolve the canonical provider resilience policy from selected provider config.
 *
 * Every model-backed surface should call this once per request instead of
 * reading env vars directly.  This ensures timeout, retry, and model-fallback
 * values are always consistent across all provider paths.
 */
export function resolveProviderPolicy(
  config: ResolvedIntelligenceProviderConfig = ProviderConfigService.resolveSelectedIntelligenceProviderConfig(),
): ProviderResiliencePolicy {
  return {
    provider: config.provider.value,
    timeoutMs: config.timeoutMs.value,
    retryAttempts: config.retryAttempts.value,
    retryDelayMs: config.retryDelayMs.value,
    modelCandidates: config.modelCandidates,
  };
}

// ---------------------------------------------------------------------------
// Error classification — one canonical source
// ---------------------------------------------------------------------------

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected provider error.";
}

export function isModelNotFoundError(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();
  return message.includes("not_found_error") || message.includes("model:");
}

export function isTimeoutError(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();
  return message.includes("timed out") || message.includes("timeout");
}

export function isTransientProviderError(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();
  return (
    message.includes("timed out")
    || message.includes("timeout")
    || message.includes("rate limit")
    || message.includes("429")
    || message.includes("500")
    || message.includes("502")
    || message.includes("503")
    || message.includes("network")
    || message.includes("fetch failed")
    || message.includes("temporarily unavailable")
  );
}

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

// ---------------------------------------------------------------------------
// Provider observability — one coherent event contract
// ---------------------------------------------------------------------------

export type ProviderEventKind =
  | "attempt_start"
  | "attempt_success"
  | "attempt_retry"
  | "attempt_failure"
  | "model_fallback";

/**
 * All model-backed surfaces that emit provider lifecycle events.
 *
 * Sprint 4: stream, direct_turn
 * Sprint 7: summarization, image_generation, tts, blog_production, web_search
 */
export type ProviderSurface =
  | "stream"
  | "direct_turn"
  | "summarization"
  | "image_generation"
  | "tts"
  | "blog_production"
  | "web_search";

export interface ProviderAttemptEvent {
  kind: ProviderEventKind;
  provider: IntelligenceProviderId | Exclude<CapabilityProviderId, "disabled">;
  surface: ProviderSurface;
  model: string;
  attempt: number;
  durationMs?: number;
  error?: string;
  errorClassification?: "transient" | "model_not_found" | "timeout" | "abort" | "fatal";
}

/**
 * Emit a structured provider lifecycle event.
 *
 * All model-backed surfaces call this so provider attempts, retries,
 * model fallbacks, and failures are observable through one consistent shape.
 */
export function emitProviderEvent(event: ProviderAttemptEvent): void {
  logEvent(
    event.kind === "attempt_failure" ? "error" : event.kind === "attempt_retry" || event.kind === "model_fallback" ? "warn" : "info",
    `provider.${event.kind}`,
    {
      provider: event.provider,
      surface: event.surface,
      model: event.model,
      attempt: event.attempt,
      ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
      ...(event.error ? { error: event.error } : {}),
      ...(event.errorClassification ? { errorClassification: event.errorClassification } : {}),
    },
  );
}

/**
 * Classify an error for observability reporting.
 */
export function classifyProviderError(error: unknown): ProviderAttemptEvent["errorClassification"] {
  if (error instanceof Error && (error.name === "AbortError" || error.message.toLowerCase().includes("abort"))) {
    return "abort";
  }
  if (isModelNotFoundError(error)) return "model_not_found";
  if (isTimeoutError(error)) return "timeout";
  if (isTransientProviderError(error)) return "transient";
  return "fatal";
}
