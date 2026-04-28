# Phase 1 — Chat Pipeline Decomposition

> Status: Complete
> Loop State: Exit criteria verified
> Goal: Split the stream chat path into explicit intake, preparation, execution, and completion stages so the route becomes composition-only and `ChatStreamPipeline` stops concentrating unrelated behavior.
> Prerequisites: Phase 0 complete

## Phase Intent

This phase targets the biggest remaining runtime concentration point. The line-count guard on the route currently passes, but the actual responsibilities are still split awkwardly: the route assembles builder state, tool narrowing, prompt provenance, and execution context, while `ChatStreamPipeline` still owns almost every other step from validation through lifecycle persistence.

## Source Anchors

- [../../../../src/lib/chat/stream-pipeline.ts](../../../../src/lib/chat/stream-pipeline.ts#L386)
- [../../../../src/app/api/chat/stream/route.ts](../../../../src/app/api/chat/stream/route.ts#L19)
- [../../../../src/lib/chat/conversation-root.ts](../../../../src/lib/chat/conversation-root.ts#L92)
- [../../../../src/lib/chat/message-attachments.ts](../../../../src/lib/chat/message-attachments.ts#L68)

## Refreshed Current State

### Route Composition Path

The current `POST` flow in [../../../../src/app/api/chat/stream/route.ts](../../../../src/app/api/chat/stream/route.ts#L19) is not route-thin in the architectural sense, even though it is short.

1. Route resolves session and request parsing through `pipeline.resolveSession` and `pipeline.validateAndParse`.
2. Route still creates the system prompt builder, loads user preferences, gets tool composition, derives `latestUserText`, and builds `latestUserContent` through [../../../../src/lib/chat/message-attachments.ts](../../../../src/lib/chat/message-attachments.ts#L68).
3. Route calls pipeline methods for conversation ownership, active-stream rejection, attachment assignment, user message persistence, slash-command short-circuit, stream-context preparation, math short-circuit, deferred-tool wrapping, and final stream response.
4. Route then resumes orchestration work itself by computing request-scoped tool selection, final prompt runtime, prompt provenance recording, and tool execution context before delegating back into `pipeline.createStreamResponse`.

The net result is a split composition root: the route owns part of preparation while `ChatStreamPipeline` owns the rest plus execution and completion.

### Method-Level Responsibility Map

| Method | Current responsibility | Coupling assessment |
| --- | --- | --- |
| `resolveSession` | Session lookup, role selection, anonymous resolution, inbound claim hooks | Legitimate runtime entry seam |
| `validateAndParse` | Schema validation, current-page normalization, attachment parsing, task-origin normalization | Extractable intake logic |
| `ensureConversation` | Canonical conversation selection, referral cookie resolution, validated visit ledger attachment | Runtime service boundary |
| `rejectIfActiveStreamExists` | Active-stream conflict guard | Legitimate guard, small and stable |
| `assignAttachments` | Attachment ownership check and conversation assignment | Extractable intake/preparation logic |
| `persistUserMessage` | User-message persistence plus `MessageLimitError` normalization | Extractable intake/preparation logic |
| `prepareStreamContext` | History fetch, routing analysis, routing persistence, context window build, prompt assembly, provenance logging | Overloaded; strongest preparation extraction target |
| `prepareFallbackContext` | Request-only fallback context, guard prompt, prompt assembly, fallback provenance logging | Should live beside primary preparation path |
| `maybeHandleSlashCommand` | Slash resolution, short-circuit assistant persistence, SSE short-circuit response | Separate command short-circuit policy |
| `checkMathShortCircuit` | Math detection, direct-turn handoff, prompt provenance capture, assistant persistence, SSE short-circuit response | Separate model-avoidance policy |
| `createDeferredToolExecutor` | Deferred-tool queue wrapping, dedupe lookup, queued-event materialization | Distinct execution-support concern |
| `createStreamResponse` | Active-stream registration, request abort forwarding, multimodal last-message rewrite, provider callbacks, SSE framing, deferred-job event expansion, assistant persistence, summarization, session-resolution recording, lifecycle completion, cleanup | Still a god-method even after route slimming |

### Coupled By Necessity Versus By History

Coupled by necessity today:

- Active-stream registration, request abort forwarding, and stream cleanup remain tightly coupled to the actual provider stream lifecycle.
- Completion persistence is still coupled to the in-memory `assistantText` and `assistantParts` accumulated during provider callbacks.
- SSE event ordering for `stream_id`, `conversation_id`, deltas, tool events, and lifecycle events must stay centralized somewhere explicit.

Coupled by history today:

- Prompt preparation mixes persisted-history access, routing analysis, guard injection, prompt-runtime build, and provenance logging in a single method.
- Multimodal message conversion lives inside `createStreamResponse`, even though it is preparation work.
- Slash-command and math short-circuit policy live in the same class as the normal stream transport.
- The route and pipeline share preparation ownership instead of exposing a single coherent preparation contract.

### Supporting Runtime Boundaries

- [../../../../src/lib/chat/conversation-root.ts](../../../../src/lib/chat/conversation-root.ts#L92) already exposes a request-scoped runtime bundle of `interactor`, `routingAnalyzer`, and `summarizationInteractor`; Phase 1 should reuse this instead of inventing another service locator.
- [../../../../src/lib/chat/message-attachments.ts](../../../../src/lib/chat/message-attachments.ts#L68) remains a small pure helper; keep attachment context formatting out of new orchestration services.

## Drift Traps

- Mechanical file splitting with no real ownership change.
- Recreating the same god-object behind a new facade or coordinator.
- Moving only route code and leaving `createStreamResponse` as an untouched concentration point.
- Extracting helpers without preserving the current SSE ordering and lifecycle recording guarantees.

## Pre-Implementation QA Gate

- [x] Refresh current method-level responsibility map for `stream-pipeline.ts`.
- [x] Record the exact route composition path in `route.ts`.
- [x] Record current tests that protect stream setup, execution, and finalization.
- [x] Define extraction checkpoints before changing code.

## Verified Current QA Baseline

### Protected Test Surface

- [../../../../tests/stream-pipeline.test.ts](../../../../tests/stream-pipeline.test.ts) freezes the public method inventory, intake validation, active-stream conflict handling, attachment assignment, context-window guard behavior, slash-command short-circuits, abort propagation, cleanup, and the route thinness line-count guard.
- [../../../../tests/stream-pipeline.prompt-runtime-seam.test.ts](../../../../tests/stream-pipeline.prompt-runtime-seam.test.ts) freezes request-time prompt assembly sections for the pipeline preparation seam.
- [../../../../tests/chat/chat-stream-route.test.ts](../../../../tests/chat/chat-stream-route.test.ts) covers context blocking, referral attribution, routing persistence and fallback, task-origin normalization, attachment persistence, admin tool narrowing, current-page forwarding, SSE ordering, persistence failure handling, and deferred-job stream events.
- [../../../../tests/chat/chat-stream-route.prompt-runtime-seam.test.ts](../../../../tests/chat/chat-stream-route.prompt-runtime-seam.test.ts) covers the end-to-end prompt-runtime seam through the real route composition path.
- [../../../../src/adapters/ChatStreamAdapter.test.ts](../../../../src/adapters/ChatStreamAdapter.test.ts) covers final buffered SSE parsing without a trailing newline.

### Baseline Results Captured At Phase Start

- `npm exec vitest run tests/stream-pipeline.test.ts tests/stream-pipeline.prompt-runtime-seam.test.ts tests/chat/chat-stream-route.test.ts tests/chat/chat-stream-route.prompt-runtime-seam.test.ts src/adapters/ChatStreamAdapter.test.ts`
  Result: 5 files passed, 55 tests passed.
- `npm exec eslint src/lib/chat/stream-pipeline.ts src/app/api/chat/stream/route.ts src/lib/chat/conversation-root.ts src/lib/chat/message-attachments.ts`
  Result: clean, no output.

### Post-Implementation Verification

- `npm exec vitest run tests/stream-pipeline.test.ts tests/stream-pipeline.prompt-runtime-seam.test.ts tests/chat/chat-stream-route.test.ts tests/chat/chat-stream-route.prompt-runtime-seam.test.ts src/adapters/ChatStreamAdapter.test.ts`
   Result: 5 files passed, 57 tests passed.
- `npm exec eslint src/lib/chat/stream-pipeline.ts src/lib/chat/stream-route-handler.ts src/lib/chat/stream-intake.ts src/lib/chat/stream-preparation.ts src/lib/chat/stream-short-circuits.ts src/lib/chat/stream-execution.ts src/lib/chat/stream-response-helpers.ts src/app/api/chat/stream/route.ts tests/stream-pipeline.test.ts`
   Result: clean, no output.

## Suggested Verification Commands

```bash
npm exec vitest run tests/stream-pipeline.test.ts tests/stream-pipeline.prompt-runtime-seam.test.ts tests/chat/chat-stream-route.test.ts tests/chat/chat-stream-route.prompt-runtime-seam.test.ts src/adapters/ChatStreamAdapter.test.ts
npm exec eslint src/lib/chat/stream-pipeline.ts src/app/api/chat/stream/route.ts src/lib/chat/conversation-root.ts src/lib/chat/message-attachments.ts
```

## Expected Evidence Artifacts

- A method-level responsibility map for `stream-pipeline.ts` captured in this packet before extraction starts.
- A before-and-after route composition summary showing what moved out of `stream-pipeline.ts`, what moved out of `route.ts`, and what intentionally remained coupled to the live stream.
- Targeted test output proving intake, prompt assembly, transport, and completion behavior stayed stable through extraction.
- A short ownership list for each newly extracted service so Phase 2 does not inherit another disguised god-object.

## Detailed Implementation Plan

1. Extract a stream intake service.
   Scope: request validation, normalized body parsing, conversation selection, attachment ownership assignment, user-message persistence, and early short-circuit decisions that do not require provider streaming.
   Checkpoint: `validateAndParse`, `ensureConversation`, `assignAttachments`, and `persistUserMessage` no longer live on the transport-heavy class.

2. Extract a stream preparation service.
   Scope: `prepareStreamContext`, `prepareFallbackContext`, multimodal message preparation, routing analysis, context-window guard injection, task-origin handoff, and prompt-runtime assembly inputs.
   Checkpoint: the route should stop hand-assembling half of the preparation state, and the preparation seam should expose one explicit output contract.

3. Extract short-circuit handlers as separate policy units.
   Scope: slash-command and math short-circuit paths.
   Checkpoint: short-circuit policy stops sharing a class with the normal stream executor, while existing short-circuit SSE responses remain unchanged.

4. Extract stream execution and completion boundaries.
   Scope: active-stream registration, abort forwarding, provider callback wiring, SSE event emission, deferred-job result expansion, assistant persistence, summarization kick-off, session-resolution recording, lifecycle event recording, and cleanup.
   Checkpoint: `createStreamResponse` shrinks to explicit transport coordination or splits into execution and completion services with a narrow shared state object.

5. Reduce the route to composition-only.
   Scope: the route should instantiate or acquire dependencies, call explicit stage services in order, and return either a short-circuit response or the stream response without doing mid-flight business logic itself.
   Checkpoint: the structural line-count test still passes, but more importantly the route stops owning builder finalization, prompt provenance recording, and execution-context assembly directly.

## Extraction Checkpoints To Enforce

1. Do not start by splitting files. Start by naming stable stage contracts and moving call sites to those contracts.
2. After each extraction, rerun the five-file verification bundle before moving to the next stage.
3. If a new service needs both provider callback state and persistence state, document the shared contract explicitly instead of passing broad service bags.
4. If the route still needs to know internal stage details after extraction, the boundary is not yet clean enough.

## Scope Guardrails

- Do not change provider policy in this phase.
- Do not change capability registration in this phase.
- Do not widen the route again just to compensate for partial extraction.
- Do not move prompt-runtime contracts; only move who assembles and carries them.

## Implementation Record

- Date: 2026-04-12
- Files changed: `src/app/api/chat/stream/route.ts`, `src/lib/chat/stream-pipeline.ts`, `src/lib/chat/stream-route-handler.ts`, `src/lib/chat/stream-intake.ts`, `src/lib/chat/stream-preparation.ts`, `src/lib/chat/stream-short-circuits.ts`, `src/lib/chat/stream-execution.ts`, `src/lib/chat/stream-response-helpers.ts`, `tests/stream-pipeline.test.ts`
- Summary of what landed: Extracted the route orchestration into `stream-route-handler.ts`, reduced `route.ts` to composition-only, converted `ChatStreamPipeline` into a compatibility facade, and moved intake, preparation, short-circuit, and execution ownership into explicit stage modules.
- Deviations from the detailed plan: The compatibility facade remains in `ChatStreamPipeline` so existing tests and call sites keep the same public surface while Phase 2 starts from cleaner stage boundaries.

## Post-Implementation QA

- [x] Run targeted stream pipeline tests.
- [x] Run changed-file diagnostics.
- [x] Confirm the route now reads as composition.
- [x] Confirm no extracted service silently owns unrelated work.

## Exit Criteria

- `stream-pipeline.ts` no longer owns intake, preparation, short-circuit policy, transport, and completion directly.
- The route reads as composition, not orchestration.
- Extracted services have explicit responsibility boundaries and named contracts.
- The five-file Phase 1 verification bundle stays green through the final extraction set.

## Handoff

- What the next loop should now assume: the stream route now composes through `stream-route-handler.ts`, and `ChatStreamPipeline` is a facade over explicit intake, preparation, short-circuit, and execution modules.
- What remains unresolved: provider duplication between direct-turn and stream paths remains intentionally untouched for Phase 2.
- What docs need updating: refresh the Phase 2 packet against the extracted stage boundaries before starting provider-runtime unification.
