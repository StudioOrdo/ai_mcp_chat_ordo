# Phase 0 — Guardrails And Parity Gates

> Status: Complete
> Loop State: Exit criteria verified
> Goal: Establish baseline QA, parity tests, and startup validation before structural refactor work begins.
> Prerequisites: None

## Phase Intent

This phase exists to make later refactor work trustworthy. It should reduce false confidence by freezing current diagnostics, adding parity checks for the highest-risk seams, and making missing runtime contracts visible before deeper architecture changes land.

## Source Anchors To Refresh

- [../../../../src/lib/chat/orchestrator.ts](../../../../src/lib/chat/orchestrator.ts#L6)
- [../../../../src/app/api/chat/stream/route.ts](../../../../src/app/api/chat/stream/route.ts#L19)
- [../../../../src/lib/chat/prompt-runtime.ts](../../../../src/lib/chat/prompt-runtime.ts#L199)
- [../../../../src/lib/jobs/job-capability-registry.ts](../../../../src/lib/jobs/job-capability-registry.ts#L80)
- [../../../../src/lib/jobs/deferred-job-handlers.ts](../../../../src/lib/jobs/deferred-job-handlers.ts#L53)
- [../../../../tests/chat-performance-a11y.test.tsx](../../../../tests/chat-performance-a11y.test.tsx#L163)

## Current-State Questions

- Where do stream and direct-turn behavior still diverge in practice?
- Which prompt surfaces are currently active and testable?
- Are all registered job capabilities backed by handlers today?
- What changed-file diagnostics or baseline failures already exist?

## Drift Traps

- Adding tests that only mirror mocks rather than runtime behavior.
- Fixing a visible type error without freezing the surrounding contract.
- Treating one passing test file as proof that a seam is stable.

## Pre-Implementation QA Gate

- [x] Capture current diagnostics for provider, prompt, and job files.
- [x] Record the exact current failures or gaps in provider parity.
- [x] Record prompt-surface coverage gaps.
- [x] Record capability-to-handler coverage gaps.
- [x] Write the exact verification commands for this phase.

## Verified Current State

### Current Code Notes

- [../../../../src/lib/chat/orchestrator.ts](../../../../src/lib/chat/orchestrator.ts#L1) is still a direct-turn-only tool loop. It owns repeated provider calls, tool execution, conversation mutation, and tool-round limits without sharing an explicit runtime contract with the streaming path.
- [../../../../src/app/api/chat/stream/route.ts](../../../../src/app/api/chat/stream/route.ts#L1) is much richer than the direct-turn path. It resolves session state, validates request bodies, enriches prompt state, persists user messages, handles slash commands and math short-circuits, records prompt provenance, creates a deferred tool executor, and finally hands off to `createStreamResponse()`.
- [../../../../src/lib/chat/prompt-runtime.ts](../../../../src/lib/chat/prompt-runtime.ts#L199) already provides a strong governed prompt seam: it resolves base and role-directive slots, appends request-time sections such as tool manifest, page context, summary, context guard, trusted referral, routing, and task-origin handoff, then emits `text`, `effectiveHash`, `slotRefs`, `sections`, and `warnings`.
- [../../../../src/lib/jobs/job-capability-registry.ts](../../../../src/lib/jobs/job-capability-registry.ts#L1) no longer hand-defines job metadata. All 10 deferred job entries are projected from `CAPABILITY_CATALOG` through `projectJobCapability()`, and the canonical retry split is now restored there: bounded automatic retry remains on the idempotent editorial jobs, while `qa_blog_article`, `resolve_blog_article_qa`, `generate_blog_image_prompt`, and `produce_blog_article` are back to `manual_only`.
- [../../../../src/lib/jobs/deferred-job-handlers.ts](../../../../src/lib/jobs/deferred-job-handlers.ts#L1) still manually binds the same 10 handler names to concrete implementations. The highest-risk seam is not missing coverage but keeping the catalog-derived registry and manual handler map semantically aligned.
- [../../../../tests/chat-performance-a11y.test.tsx](../../../../tests/chat-performance-a11y.test.tsx#L163) is currently clean in editor diagnostics. The line that had previously surfaced in diagnostics now sits in an accessibility assertion block rather than an active type failure.

### Current QA Notes

- Current editor diagnostics on the phase anchors are clean. No problems were reported for `orchestrator.ts`, `stream/route.ts`, `prompt-runtime.ts`, `job-capability-registry.ts`, `deferred-job-handlers.ts`, or `chat-performance-a11y.test.tsx`.
- Existing Phase 0 guardrails are better than the roadmap originally assumed. [../../../../src/lib/jobs/job-capability-registry.test.ts](../../../../src/lib/jobs/job-capability-registry.test.ts#L1) already proves that live deferred handler names and `JOB_CAPABILITY_REGISTRY` entries match exactly.
- The provider seam now has a dedicated parity slice. [../../../../tests/chat/provider-parity.test.ts](../../../../tests/chat/provider-parity.test.ts#L1) freezes shared model fallback and transient retry behavior across `anthropic-client.ts` and `anthropic-stream.ts`, and it also locks the documented intentional first-round timeout difference between stream and direct-turn.
- Prompt coverage now has one explicit cross-surface contract suite. [../../../../tests/prompt-surface-contract.test.ts](../../../../tests/prompt-surface-contract.test.ts#L1) freezes governed slot provenance and intentional section differences across `chat_stream`, `direct_turn`, and `live_eval`, while [../../../../tests/prompt-runtime.test.ts](../../../../tests/prompt-runtime.test.ts#L1), [../../../../tests/stream-pipeline.prompt-runtime-seam.test.ts](../../../../tests/stream-pipeline.prompt-runtime-seam.test.ts#L1), [../../../../tests/chat/chat-stream-route.prompt-runtime-seam.test.ts](../../../../tests/chat/chat-stream-route.prompt-runtime-seam.test.ts#L1), [../../../../src/lib/chat/chat-turn.test.ts](../../../../src/lib/chat/chat-turn.test.ts#L1), and [../../../../tests/evals/eval-live-runner.test.ts](../../../../tests/evals/eval-live-runner.test.ts#L1) keep the adopter paths covered.
- Focused provider and job baseline command: `npm exec vitest run src/core/capability-catalog/catalog.test.ts src/lib/jobs/job-capability-registry.test.ts tests/anthropic-client.test.ts tests/chat/anthropic-stream.test.ts tests/chat/provider-parity.test.ts`.
- Result of that baseline: 5 files passed and 53 tests passed. The previous `produce_blog_article` retry-policy drift is resolved by restoring the catalog-level `manual_only` policy for the non-idempotent editorial orchestration and QA/post-processing jobs.
- Rebaselining the provider guardrails also exposed stale expectations in [../../../../tests/chat/anthropic-stream.test.ts](../../../../tests/chat/anthropic-stream.test.ts#L1). The current stream path normalizes aborts into `ChatProviderError` and emits the newer timeout message shape, so the tests were updated to match the shipped contract.
- Startup validation now exists in the worker runtime where it adds real value. [../../../../src/lib/jobs/runtime-contracts.ts](../../../../src/lib/jobs/runtime-contracts.ts#L1) and [../../../../src/lib/jobs/deferred-job-handlers.ts](../../../../src/lib/jobs/deferred-job-handlers.ts#L1) fail fast if deferred handler names drift from the catalog-derived `JOB_CAPABILITY_REGISTRY` contract during handler construction. The broader presentation/browser/catalog convergence checks remain test-only rather than app-boot behavior.
- Full Phase 0 verification command: `npm exec vitest run src/core/capability-catalog/catalog.test.ts src/lib/jobs/job-capability-registry.test.ts src/lib/jobs/runtime-contracts.test.ts src/lib/jobs/deferred-job-runtime.test.ts tests/anthropic-client.test.ts tests/chat/anthropic-stream.test.ts tests/chat/provider-parity.test.ts tests/prompt-runtime.test.ts tests/prompt-surface-contract.test.ts tests/stream-pipeline.prompt-runtime-seam.test.ts tests/chat/chat-stream-route.prompt-runtime-seam.test.ts src/lib/chat/chat-turn.test.ts tests/evals/eval-live-runner.test.ts`.
- Result of that full verification: 13 files passed and 91 tests passed.

## Suggested Verification Commands

```bash
npm exec vitest run src/core/capability-catalog/catalog.test.ts src/lib/jobs/job-capability-registry.test.ts tests/anthropic-client.test.ts tests/chat/anthropic-stream.test.ts tests/chat/provider-parity.test.ts
npm exec vitest run src/lib/jobs/runtime-contracts.test.ts src/lib/jobs/deferred-job-runtime.test.ts src/lib/jobs/job-capability-registry.test.ts
npm exec vitest run tests/prompt-runtime.test.ts tests/prompt-surface-contract.test.ts tests/stream-pipeline.prompt-runtime-seam.test.ts tests/chat/chat-stream-route.prompt-runtime-seam.test.ts src/lib/chat/chat-turn.test.ts tests/evals/eval-live-runner.test.ts
npm exec eslint src/lib/chat/orchestrator.ts src/app/api/chat/stream/route.ts src/lib/chat/prompt-runtime.ts src/lib/jobs/job-capability-registry.ts src/lib/jobs/deferred-job-handlers.ts tests/chat-performance-a11y.test.tsx
```

## Expected Evidence Artifacts

- This packet updated with current diagnostics, baseline command output, and the canonical list of Phase 0 guardrail tests.
- A decision record for the resolved editorial retry split: bounded automatic retry stays on the safe idempotent jobs, while `qa_blog_article`, `resolve_blog_article_qa`, `generate_blog_image_prompt`, and `produce_blog_article` stay `manual_only`.
- A direct-turn versus stream provider-parity slice that fails when shared fallback or transient retry behavior drifts, while preserving the intentional first-round timeout difference.
- A narrow startup validator for deferred-job handler and capability parity that fails closed during worker startup, rather than relying only on CI.
- A prompt-surface contract slice that makes governed sections, fallback warnings, and effective-hash behavior explicit across supported surfaces.

## Detailed Implementation Plan

1. Freeze the current anchor diagnostics and keep the focused Vitest command above as the minimum Phase 0 baseline.
2. Add a direct-turn versus stream provider-parity slice that compares retry, timeout, model-fallback, and tool-round behavior using the existing chat route and stream route test harnesses rather than fresh one-off mocks.
3. Expand prompt-runtime coverage into one explicit contract slice that spans the currently exercised surfaces: `chat_stream`, direct-turn, and `live_eval`, with assertions around `effectiveHash`, section ordering, fallback warnings, and route-time overlays.
4. Resolve the `produce_blog_article` retry-policy drift by deciding whether the catalog or the old test expectation is canonical, then update both the contract test and the packet so later phases do not inherit silent ambiguity.
5. Keep capability-to-handler alignment guarded by tests, and only add startup validation if the existing registry test cannot protect the runtime seam well enough.
6. Treat any reintroduced diagnostics in the phase anchors as blocking until they are either fixed or deliberately quarantined in this packet.

## Scope Guardrails

- Do not refactor runtime structure yet.
- Do not broaden this phase into catalog or platform cleanup.
- Do not change retry policy, prompt assembly, or provider behavior just to make tests green without first deciding the canonical contract.

## Implementation Record

- Date: 2026-04-12
- Files changed: `src/core/capability-catalog/catalog.ts`, `src/core/capability-catalog/catalog.test.ts`, `src/lib/jobs/job-capability-registry.test.ts`, `src/lib/jobs/runtime-contracts.ts`, `src/lib/jobs/runtime-contracts.test.ts`, `src/lib/jobs/deferred-job-handlers.ts`, `tests/chat/anthropic-stream.test.ts`, `tests/chat/provider-parity.test.ts`, `tests/prompt-surface-contract.test.ts`
- Summary of what landed: restored the canonical `manual_only` retry policy for the non-idempotent editorial orchestration and QA/post-processing jobs at the catalog layer; added a dedicated provider parity test slice across direct-turn and stream provider paths; rebaselined stale stream-provider expectations to the current `ChatProviderError` contract and timeout message; added narrow deferred-job startup validation that fails fast when handler names drift from the canonical worker contract; added an explicit prompt-surface contract suite that freezes governed slot provenance and intentional request-section differences across `chat_stream`, `direct_turn`, and `live_eval`.
- Deviations from the detailed plan: the provider parity slice landed at the provider-function layer instead of route-level harnesses because the transport contract is owned more directly by `anthropic-client.ts` and `anthropic-stream.ts`, and that level let the test freeze both shared behavior and the documented intentional timeout divergence without duplicating route scaffolding. Startup validation also landed narrowly at worker handler construction instead of broad app boot, because that catches the expensive drift without forcing the full Next runtime graph to initialize just to run convergence checks.

## Post-Implementation QA

- [x] Run targeted parity tests.
- [x] Run changed-file diagnostics.
- [x] Confirm the `produce_blog_article` retry-policy drift is either resolved or explicitly rebaselined.
- [x] Confirm future phases now have reliable guardrails.

## Exit Criteria

- Stream and direct-turn provider behavior has a parity test.
- Prompt-runtime parity across supported surfaces is validated.
- Capability-to-handler coverage is validated.
- Baseline blocking diagnostics are resolved or explicitly quarantined.

## Handoff

- What the next phase should now assume: direct-turn and stream provider fallback and transient retry behavior are frozen by tests, prompt-runtime parity across `chat_stream`, `direct_turn`, and `live_eval` is frozen by tests, the manual-only editorial orchestration/QA retry split is canonical at the catalog source of truth, and deferred-job worker startup fails fast on handler/capability drift.
- What remains unresolved: broad app-boot convergence validation remains intentionally test-only unless a real startup drift escapes the worker fail-fast guard.
- What docs need updating: [../status-board.md](../status-board.md) whenever the loop state changes, plus [../README.md](../README.md) and [../../refactor-roadmap.md](../../refactor-roadmap.md) if Phase 0 scope shifts again.
