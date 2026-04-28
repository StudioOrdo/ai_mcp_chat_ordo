# Phase 2 — Provider Runtime Unification

> Status: Complete
> Loop State: Exit criteria verified
> Goal: Unify provider-attempt policy and observability across stream and direct-turn chat without flattening transport-specific execution semantics.
> Prerequisites: Phase 0 complete, Phase 1 complete

## Phase Intent

Phase 1 made the stream path explicit enough that provider behavior no longer needs to hide inside one giant transport class. This phase now targets the remaining duplication between direct-turn and stream provider execution, but the objective is not a fake abstraction that pretends both transports are the same. The real target is one canonical provider-attempt runtime for model selection, retry budget, retry delay, error classification, and provider event emission, while stream keeps the transport-owned behavior that direct-turn does not have: abort composition, delta callbacks, inline tool rounds, and post-round timeout handling.

## Source Anchors

- [../../../../src/lib/chat/provider-policy.ts](../../../../src/lib/chat/provider-policy.ts)
- [../../../../src/lib/chat/provider-runtime.ts](../../../../src/lib/chat/provider-runtime.ts)
- [../../../../src/lib/chat/chat-turn.ts](../../../../src/lib/chat/chat-turn.ts)
- [../../../../src/lib/chat/anthropic-client.ts](../../../../src/lib/chat/anthropic-client.ts)
- [../../../../src/lib/chat/orchestrator.ts](../../../../src/lib/chat/orchestrator.ts)
- [../../../../src/lib/chat/anthropic-stream.ts](../../../../src/lib/chat/anthropic-stream.ts)
- [../../../../src/app/api/chat/route.ts](../../../../src/app/api/chat/route.ts)
- [../../../../tests/chat/provider-parity.test.ts](../../../../tests/chat/provider-parity.test.ts)
- [../../../../tests/chat/provider-runtime.test.ts](../../../../tests/chat/provider-runtime.test.ts)
- [../../../../src/lib/chat/provider-policy.test.ts](../../../../src/lib/chat/provider-policy.test.ts)
- [../../../../src/lib/chat/provider-instrumentation.test.ts](../../../../src/lib/chat/provider-instrumentation.test.ts)
- [../../../../src/lib/chat/chat-turn.test.ts](../../../../src/lib/chat/chat-turn.test.ts)
- [../../../../tests/chat/anthropic-stream.test.ts](../../../../tests/chat/anthropic-stream.test.ts)
- [../../../../tests/chat/chat-route.test.ts](../../../../tests/chat/chat-route.test.ts)

## Refreshed Current State

### Canonical Provider Policy Already Exists

- [../../../../src/lib/chat/provider-policy.ts](../../../../src/lib/chat/provider-policy.ts) is already the canonical source for timeout, retry-attempt count, retry delay, model-candidate resolution, provider event emission, and provider error classification.
- Both direct-turn and stream already import that module. Phase 2 should build on that shared truth instead of inventing another policy source.
- [../../../../src/lib/chat/provider-runtime.ts](../../../../src/lib/chat/provider-runtime.ts) now owns the shared provider-attempt execution seam through `runWithResilience(...)`, while [../../../../src/lib/chat/provider-policy.ts](../../../../src/lib/chat/provider-policy.ts) remains the canonical source for policy values, event schema, and error classification.
- [../../../../src/lib/chat/provider-instrumentation.test.ts](../../../../src/lib/chat/provider-instrumentation.test.ts) proves the provider event contract already spans seven surfaces: `stream`, `direct_turn`, `summarization`, `image_generation`, `tts`, `blog_production`, and `web_search`. Phase 2 should preserve that event contract while keeping the chat refactor scoped to the two chat transports.
- The prompt-runtime seam is already stabilized from earlier work: stream now finalizes prompt text after tool selection, and direct-turn already injects the tool manifest before `buildResult()`. Provider-runtime unification should treat final prompt text as an input, not reopen prompt assembly.

### Direct-Turn Path Today

1. [../../../../src/app/api/chat/route.ts](../../../../src/app/api/chat/route.ts) validates the request and delegates to `executeDirectChatTurn(...)`.
2. [../../../../src/lib/chat/chat-turn.ts](../../../../src/lib/chat/chat-turn.ts) builds prompt runtime, injects the direct-turn tool manifest, resolves provider policy, and constructs a provider with `createAnthropicProvider(...)`.
3. [../../../../src/lib/chat/anthropic-client.ts](../../../../src/lib/chat/anthropic-client.ts) now delegates model fallback, retry handling, delay scheduling, provider event emission, and error classification to the shared runtime while retaining direct-turn-specific timeout and error-normalization rules.
4. [../../../../src/lib/chat/orchestrator.ts](../../../../src/lib/chat/orchestrator.ts) owns direct-turn tool rounds above the provider boundary.

### Stream Path Today

1. [../../../../src/lib/chat/anthropic-stream.ts](../../../../src/lib/chat/anthropic-stream.ts) now uses `runWithResilience(...)` for model fallback, retry delay, provider event emission, and last-error handling.
2. Stream still owns abort composition, timeout conversion, delta callbacks, inline tool rounds, and the intentional post-successful-round timeout rule.
3. Phase 1 extraction kept the stream route narrow enough that this runtime unification landed without reopening prompt assembly or route orchestration.

### Canonical Versus Transport-Specific Behavior

| Behavior | Current owner | Should Phase 2 unify it? | Reason |
| --- | --- | --- | --- |
| Model candidate ordering | `provider-policy.ts` plus both transport loops | Yes | One canonical model-selection path should govern both chat transports. |
| Retry-attempt budget and delay schedule | `provider-policy.ts` plus both transport loops | Yes | Parity tests already freeze the same retry budget expectations across both transports. |
| Provider event schema and error classification | `provider-policy.ts` plus both transport loops | Yes | The event contract is already canonical; the execution loop should stop duplicating how it is applied. |
| Direct-turn timeout wrapping | `anthropic-client.ts` | Partly | Timeout classification should stay shared, but direct-turn still intentionally fails fast on same-payload timeouts. |
| Stream abort composition and delta callbacks | `anthropic-stream.ts` | No | These are transport-owned streaming concerns, not provider-policy concerns. |
| Tool-round orchestration | `orchestrator.ts` and `anthropic-stream.ts` | No | Direct-turn and stream execute tool rounds at different layers and should stay explicit. |
| Post-first-round stream timeout failure | `anthropic-stream.ts` | No | This is an intentional transport rule already protected by parity tests. |

### Phase Closure

- Direct-turn and stream now share one provider-attempt runtime for model selection, retry budget, delay scheduling, event emission, and error classification.
- [../../../../tests/chat/chat-route.test.ts](../../../../tests/chat/chat-route.test.ts) now covers direct-turn success and provider-failure behavior in addition to validation failures.
- [../../../../tests/chat/chat-timeout-and-corruption.test.ts](../../../../tests/chat/chat-timeout-and-corruption.test.ts) remains green against the migrated stream path, preserving the intentional post-successful-round timeout rule.

## Drift Traps

- Over-unifying stream-specific cancellation or round-completion semantics just to make the code look symmetrical.
- Reopening prompt-runtime or tool-manifest assembly even though that seam was already stabilized in the previous phase.
- Introducing a new provider abstraction that only wraps existing duplication instead of deleting the duplicate loops.
- Flattening the intentional first-round timeout difference that [../../../../tests/chat/provider-parity.test.ts](../../../../tests/chat/provider-parity.test.ts) already documents.
- Widening this phase to non-chat surfaces such as summarization, image generation, TTS, or blog production before the chat provider seam is clean.

## Pre-Implementation QA Gate

- [x] Refresh current stream and direct-turn provider paths.
- [x] Record canonical versus transport-specific runtime differences.
- [x] Confirm parity tests still freeze the cross-path seam.
- [x] Capture a focused provider-runtime baseline before implementation.
- [x] Record the current `/api/chat` route coverage gap.

## Verified Current QA Baseline

### Protected Test Surface

- [../../../../src/lib/chat/provider-policy.test.ts](../../../../src/lib/chat/provider-policy.test.ts) freezes policy resolution, error classification, and import-level drift away from the canonical provider-policy module.
- [../../../../src/lib/chat/provider-instrumentation.test.ts](../../../../src/lib/chat/provider-instrumentation.test.ts) freezes the provider event contract across all declared `ProviderSurface` values and proves the current `ProviderRuntime` facade is instantiable.
- [../../../../src/lib/chat/chat-turn.test.ts](../../../../src/lib/chat/chat-turn.test.ts) covers direct-turn prompt assembly, tool-manifest injection, tool-context prompt provenance, and provider attempt instrumentation.
- [../../../../tests/chat/anthropic-stream.test.ts](../../../../tests/chat/anthropic-stream.test.ts) covers abort propagation, model fallback, transient retry recovery, and the post-successful-round timeout rule that must remain transport-specific.
- [../../../../tests/chat/provider-parity.test.ts](../../../../tests/chat/provider-parity.test.ts) freezes model fallback parity, retry-budget parity, and the intentional first-round timeout difference between stream and direct-turn.
- [../../../../tests/chat/provider-runtime.test.ts](../../../../tests/chat/provider-runtime.test.ts) exercises the shared attempt runner directly so fallback, retry, mapped failure, exhaustion, and no-model behavior are validated without transport mocks.
- [../../../../tests/chat/chat-route.test.ts](../../../../tests/chat/chat-route.test.ts) covers direct-turn validation, success, and provider-failure behavior.
- [../../../../tests/chat/chat-timeout-and-corruption.test.ts](../../../../tests/chat/chat-timeout-and-corruption.test.ts) verifies the fail-fast timeout rule after a successful tool round and protects against the original retry-amplification regression.

### Final Focused Verification

- `npm exec vitest run tests/chat/provider-runtime.test.ts src/lib/chat/provider-policy.test.ts src/lib/chat/provider-instrumentation.test.ts src/lib/chat/chat-turn.test.ts tests/chat/anthropic-stream.test.ts tests/chat/provider-parity.test.ts tests/chat/chat-route.test.ts tests/chat/chat-timeout-and-corruption.test.ts`
	Result: 8 files passed, 90 tests passed.
- `npm run lint -- src/lib/chat/provider-runtime.ts src/lib/chat/anthropic-client.ts src/lib/chat/anthropic-stream.ts src/lib/chat/provider-instrumentation.test.ts src/lib/chat/provider-policy.test.ts src/lib/chat/chat-turn.test.ts tests/chat/provider-runtime.test.ts tests/chat/chat-route.test.ts tests/chat/chat-timeout-and-corruption.test.ts`
	Result: clean, no output.

## Suggested Verification Commands

```bash
npm exec vitest run tests/chat/provider-runtime.test.ts src/lib/chat/provider-policy.test.ts src/lib/chat/provider-instrumentation.test.ts src/lib/chat/chat-turn.test.ts tests/chat/anthropic-stream.test.ts tests/chat/provider-parity.test.ts tests/chat/chat-route.test.ts tests/chat/chat-timeout-and-corruption.test.ts
npm run lint -- src/lib/chat/provider-runtime.ts src/lib/chat/anthropic-client.ts src/lib/chat/anthropic-stream.ts src/lib/chat/provider-instrumentation.test.ts src/lib/chat/provider-policy.test.ts src/lib/chat/chat-turn.test.ts tests/chat/provider-runtime.test.ts tests/chat/chat-route.test.ts tests/chat/chat-timeout-and-corruption.test.ts
```

## Expected Evidence Artifacts

- A written behavior matrix that distinguishes canonical provider-attempt rules from transport-owned stream or direct-turn semantics.
- Targeted parity output proving both transports still share model fallback, retry budget, and event classification while preserving the intentional timeout difference.
- A concrete shared runtime seam in [../../../../src/lib/chat/provider-runtime.ts](../../../../src/lib/chat/provider-runtime.ts) or an intentionally equivalent replacement, with both chat transports adopted onto it.
- A dedicated shared-runtime test surface in [../../../../tests/chat/provider-runtime.test.ts](../../../../tests/chat/provider-runtime.test.ts) that validates attempt-runner control flow without full stream or route mocks.
- Added direct-turn route coverage that exercises provider behavior beyond basic validation-only request failures.

## Detailed Implementation Plan

1. Promote `provider-runtime.ts` from thin facade to shared provider-attempt runner.
	Scope: model iteration, retry iteration, delay scheduling, provider event emission, error classification, and last-error handling with a transport-supplied attempt callback.
	Checkpoint: direct-turn and stream stop owning independent nested model or retry loops.

2. Move direct-turn provider execution onto the shared runtime.
	Scope: adapt [../../../../src/lib/chat/anthropic-client.ts](../../../../src/lib/chat/anthropic-client.ts) so it becomes a thin transport adapter that supplies the direct-turn request executor and explicit fail-fast timeout rule.
	Checkpoint: `createMessageWithModelFallback(...)` no longer owns its own model loop and retry loop.

3. Move stream provider execution onto the same runtime without collapsing stream transport ownership.
	Scope: keep abort composition, delta callbacks, tool rounds, and post-first-round timeout handling inside [../../../../src/lib/chat/anthropic-stream.ts](../../../../src/lib/chat/anthropic-stream.ts), but delegate model fallback, retry delay, and provider event bookkeeping to the shared runtime.
	Checkpoint: stream still owns streaming semantics, but not duplicate attempt-policy bookkeeping.

4. Tighten parity and route-level coverage around the new seam.
	Scope: extend [../../../../tests/chat/provider-parity.test.ts](../../../../tests/chat/provider-parity.test.ts) as needed, add a dedicated shared-runtime execution test surface if the new seam is non-trivial, and grow [../../../../tests/chat/chat-route.test.ts](../../../../tests/chat/chat-route.test.ts) beyond input validation.
	Checkpoint: the intentional timeout difference remains explicit and test-backed instead of being an accidental artifact.

## Extraction Checkpoints To Enforce

1. Start by naming the attempt-level runtime contract before moving helpers between files.
2. If stream still emits provider events directly after adoption, the shared runtime boundary is probably too shallow.
3. If the shared runtime starts needing SSE callback wiring, tool-result formatting, or round-state mutation, the abstraction has gone too far.
4. Keep non-chat provider callers on the shared event contract, but do not sweep summarization, image generation, TTS, or blog production into this phase unless a tiny shared type alignment is required.

## Scope Guardrails

- Do not reopen prompt-runtime finalization or route preparation seams from Phase 1.
- Do not merge stream SSE semantics and direct-turn orchestration into one fake transport layer.
- Do not change capability policy or tool registration in this phase.
- Do not widen the refactor to non-chat provider callers unless shared type stability requires a minimal edit.

## Implementation Record

- Date: 2026-04-12
- Files changed:
	- [../../../../src/lib/chat/provider-runtime.ts](../../../../src/lib/chat/provider-runtime.ts)
	- [../../../../src/lib/chat/anthropic-client.ts](../../../../src/lib/chat/anthropic-client.ts)
	- [../../../../src/lib/chat/anthropic-stream.ts](../../../../src/lib/chat/anthropic-stream.ts)
	- [../../../../src/lib/chat/provider-instrumentation.test.ts](../../../../src/lib/chat/provider-instrumentation.test.ts)
	- [../../../../src/lib/chat/provider-policy.test.ts](../../../../src/lib/chat/provider-policy.test.ts)
	- [../../../../src/lib/chat/chat-turn.test.ts](../../../../src/lib/chat/chat-turn.test.ts)
	- [../../../../tests/chat/provider-runtime.test.ts](../../../../tests/chat/provider-runtime.test.ts)
	- [../../../../tests/chat/chat-route.test.ts](../../../../tests/chat/chat-route.test.ts)
	- [../../../../tests/chat/chat-timeout-and-corruption.test.ts](../../../../tests/chat/chat-timeout-and-corruption.test.ts)
- Summary of what landed:
	- `provider-runtime.ts` now owns the shared attempt runner through `runWithResilience(...)`.
	- Direct-turn and stream both delegate model fallback, retry bookkeeping, delay scheduling, provider event emission, and error classification to that runtime.
	- [../../../../tests/chat/provider-runtime.test.ts](../../../../tests/chat/provider-runtime.test.ts) now validates the shared attempt runner directly, independent of transport behavior.
	- Stream retained its transport-owned abort composition, delta callbacks, inline tool rounds, and fatal post-successful-round timeout rule.
	- `/api/chat` route coverage now exercises success and provider-failure behavior.
- Deviations from the detailed plan:
	- The focused verification bundle was widened to include both [../../../../tests/chat/provider-runtime.test.ts](../../../../tests/chat/provider-runtime.test.ts) and [../../../../tests/chat/chat-timeout-and-corruption.test.ts](../../../../tests/chat/chat-timeout-and-corruption.test.ts) so the shared attempt runner and the stream-specific timeout rule are each protected at their own seam.

## Post-Implementation QA

- [x] Run provider runtime and chat parity tests.
- [x] Run changed-file diagnostics.
- [x] Confirm stream and direct-turn now share one provider-attempt runtime.
- [x] Confirm intentional transport differences are still explicit and documented.

## Exit Criteria

- Stream and direct-turn share one provider-attempt runtime for model fallback, retry budget, delay schedule, provider event emission, and error classification.
- Intentional transport differences remain explicit, narrow, and test-backed.
- Direct-turn route coverage no longer relies only on validation-only tests for provider behavior confidence.

## Handoff

- What the next loop should now assume: [../../../../src/lib/chat/provider-runtime.ts](../../../../src/lib/chat/provider-runtime.ts) is the shared attempt-level seam for both chat transports, while [../../../../src/lib/chat/provider-policy.ts](../../../../src/lib/chat/provider-policy.ts) remains the canonical policy and observability source.
- What remains unresolved: non-chat provider callers still use the shared policy and event contract directly; Phase 2 intentionally did not widen runtime unification beyond the two chat transports.
- What docs need updating: the phase packet, parent roadmap, and status board were refreshed in the same patch as the final verification evidence.
