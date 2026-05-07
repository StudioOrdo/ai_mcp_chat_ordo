/**
 * ProviderRuntime — shared provider-attempt execution helpers.
 *
 * The provider-policy module remains the canonical source of truth for
 * resilience values, provider lifecycle event shapes, and error
 * classification. This module adds the shared attempt runner that transport
 * adapters can use so model fallback, retry scheduling, and event emission do
 * not have to be reimplemented per caller.
 */

import {
  classifyProviderError,
  delay,
  emitProviderEvent,
  resolveProviderPolicy,
  type ProviderResiliencePolicy,
  type ProviderAttemptEvent,
  type ProviderSurface,
} from "./provider-policy";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ProviderRuntime {
  /** Resolve the canonical provider resilience policy from selected provider config. */
  resolvePolicy(surface?: ProviderSurface): ProviderResiliencePolicy;

  /** Emit a structured provider lifecycle event. */
  emitEvent(event: ProviderAttemptEvent): void;

  /** Classify an error for observability reporting. */
  classifyError(error: unknown): ProviderAttemptEvent["errorClassification"];

  /**
   * Run a provider-backed operation against the configured model candidates
   * with shared retry, fallback, and event-emission behavior.
   */
  runWithResilience<T>(options: ProviderAttemptRunnerOptions<T>): Promise<T>;
}

export interface ProviderAttemptContext {
  surface: ProviderSurface;
  model: string;
  attempt: number;
  policy: ProviderResiliencePolicy;
}

export interface ProviderAttemptFailureContext extends ProviderAttemptContext {
  error: unknown;
  durationMs: number;
  errorClassification: ProviderAttemptEvent["errorClassification"];
}

export type ProviderAttemptAction =
  | { type: "next-model" }
  | { type: "retry" }
  | { type: "throw"; error: Error };

export interface ProviderAttemptRunnerOptions<T> {
  surface: ProviderSurface;
  policy?: ProviderResiliencePolicy;
  runAttempt: (context: ProviderAttemptContext) => Promise<T>;
  handleError: (
    context: ProviderAttemptFailureContext,
  ) => ProviderAttemptAction;
  onExhausted: (lastError: unknown) => Error;
  onNoModels?: () => Error;
}

// ---------------------------------------------------------------------------
// Default implementation — delegates to provider-policy.ts functions
// ---------------------------------------------------------------------------

/**
 * Create the default ProviderRuntime backed by the shared provider-policy
 * functions and selected provider configuration.
 */
export function createProviderRuntime(): ProviderRuntime {
  return {
    resolvePolicy: () => resolveProviderPolicy(),
    emitEvent: emitProviderEvent,
    classifyError: classifyProviderError,
    async runWithResilience<T>({
      surface,
      policy = resolveProviderPolicy(),
      runAttempt,
      handleError,
      onExhausted,
      onNoModels,
    }: ProviderAttemptRunnerOptions<T>): Promise<T> {
      if (policy.modelCandidates.length === 0) {
        throw onNoModels?.() ?? new Error("No valid provider model configured.");
      }

      let lastError: unknown;

      for (const model of policy.modelCandidates) {
        for (let attempt = 1; attempt <= policy.retryAttempts; attempt += 1) {
          const startedAt = Date.now();
          emitProviderEvent({
            kind: "attempt_start",
            provider: policy.provider,
            surface,
            model,
            attempt,
          });

          try {
            const result = await runAttempt({
              surface,
              model,
              attempt,
              policy,
            });

            emitProviderEvent({
              kind: "attempt_success",
              provider: policy.provider,
              surface,
              model,
              attempt,
              durationMs: Date.now() - startedAt,
            });
            return result;
          } catch (error) {
            const durationMs = Date.now() - startedAt;
            const errorClassification = classifyProviderError(error);
            const action = handleError({
              surface,
              model,
              attempt,
              policy,
              error,
              durationMs,
              errorClassification,
            });

            if (action.type === "next-model") {
              lastError = error;
              emitProviderEvent({
                kind: "model_fallback",
                provider: policy.provider,
                surface,
                model,
                attempt,
                durationMs,
                error: error instanceof Error ? error.message : undefined,
                errorClassification,
              });
              break;
            }

            if (action.type === "retry") {
              lastError = error;
              emitProviderEvent({
                kind: "attempt_retry",
                provider: policy.provider,
                surface,
                model,
                attempt,
                durationMs,
                error: error instanceof Error ? error.message : undefined,
                errorClassification,
              });
              await delay(policy.retryDelayMs * attempt);
              continue;
            }

            emitProviderEvent({
              kind: "attempt_failure",
              provider: policy.provider,
              surface,
              model,
              attempt,
              durationMs,
              error:
                action.error instanceof Error ? action.error.message : undefined,
              errorClassification,
            });
            throw action.error;
          }
        }
      }

      if (lastError) {
        throw onExhausted(lastError);
      }

      throw onNoModels?.() ?? new Error("No valid provider model configured.");
    },
  };
}
