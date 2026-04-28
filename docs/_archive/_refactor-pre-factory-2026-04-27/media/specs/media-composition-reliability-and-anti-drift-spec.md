# Media Composition Reliability And Anti-Drift Spec

**Status:** Draft Spec — Ready For Execution
**Date:** 2026-04-16
**Scope:** Resolve media-composition truthfulness, asset-readiness, fallback-recovery, and execution-target drift without violating the current capability-catalog, governed-asset, deferred-job, and browser-runtime architecture.
**Primary Goal:** Make media generation and composition reliable, truthful, and test-backed across browser, native-process, deferred-worker, and replay flows.

---

## 1. Program Statement

Recent incident review exposed a reliability class that is broader than one failed video render.

The current system has the right primitives:

- governed `user_files` persistence
- catalog-backed capability registration
- browser-managed media generation
- browser FFmpeg composition
- planner-declared `native_process` media execution
- deferred worker media execution
- runtime audit logs

The failure sits in orchestration and truth contracts between those primitives.

Confirmed issue groups:

1. assistant completion language can outrun durable artifact truth
2. fresh generated assets can remain `client_fetch_pending` while later composition proceeds anyway
3. browser fallback is described as automatic but the browser runtime currently stops at reroute signaling instead of guaranteed deferred enqueue
4. execution-target defaults and tests can drift from one another, making runtime choice harder to reason about
5. asset continuity is stronger in code than in user-facing conversation guarantees, so later turns can still select stale or missing media state
6. observability is strong for server-owned runtimes but incomplete at the asset-lifecycle boundary that matters most for media truth

This spec exists to repair those issues as one architecture-aligned reliability program rather than as isolated prompt, UI, or worker patches.

---

## 2. Verified Current Architecture

The requirements below are grounded in the live codebase and current active documentation.

### 2.1 Runtime Ownership

- The host TypeScript runtime remains the owner of policy, RBAC, conversation state, job state, rendering, and governed artifact identity.
- The media pack is already the next concrete non-host runtime family and currently spans `browser_wasm`, `native_process`, `deferred_job`, and compatibility `host_ts` routing.
- `generate_audio` is already recorded as the next production-owned `remote_service` candidate after `compose_media`.

Authoritative sources:

- [src/core/capability-catalog/capability-ownership.ts](../../../../src/core/capability-catalog/capability-ownership.ts#L1)
- [docs/_refactor/system-state-2026-04-12/subsystems/execution-targets.md](../../system-state-2026-04-12/subsystems/execution-targets.md#L1)

### 2.2 Capability Contracts

- `compose_media` is a catalog capability with browser, job, and native-process execution surfaces.
- `compose_media` is not allowed to accept fabricated asset IDs; it requires governed handles.
- `list_conversation_media_assets` is the canonical host-owned discovery surface for reusable conversation media assets.

Authoritative sources:

- [src/core/capability-catalog/families/media-capabilities.ts](../../../../src/core/capability-catalog/families/media-capabilities.ts#L1)
- [src/lib/chat/tool-bundles/media-tools.ts](../../../../src/lib/chat/tool-bundles/media-tools.ts#L1)

### 2.3 Browser Runtime Contract

- Fresh `generate_audio` tool execution can legitimately return `generationStatus: "client_fetch_pending"` before a durable asset exists.
- `compose_media` tool execution also returns `generationStatus: "client_fetch_pending"`; the returned payload is a start signal, not a completed artifact.
- The browser runtime is responsible for reconciling pending tool results into durable `job_status` snapshots with canonical artifact envelopes.

Authoritative sources:

- [src/core/use-cases/tools/UiTools.ts](../../../../src/core/use-cases/tools/UiTools.ts#L90)
- [src/core/use-cases/tools/compose-media.tool.ts](../../../../src/core/use-cases/tools/compose-media.tool.ts#L1)
- [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L1)
- [src/lib/media/browser-runtime/job-snapshots.ts](../../../../src/lib/media/browser-runtime/job-snapshots.ts#L1)

### 2.4 Durable Artifact Contracts

- Browser WASM composition uploads final output and returns a canonical artifact envelope containing `primaryAssetId`.
- Deferred remote composition persists final video into `user_files` and returns canonical artifact metadata.
- Charts and graphs are already uploaded into governed storage when browser runtime persistence succeeds.

Authoritative sources:

- [src/lib/media/browser-runtime/ffmpeg-browser-executor.ts](../../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.ts#L130)
- [src/lib/media/server/compose-media-worker-runtime.ts](../../../../src/lib/media/server/compose-media-worker-runtime.ts#L1)
- [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L220)

### 2.5 Observability Contracts

- Server-owned runtime categories already write JSONL logs to `.runtime-logs/`.
- `browser_wasm` remains a known gap in server-owned audit logging and must be covered through explicit browser diagnostics and transcript/job reconciliation.

Authoritative sources:

- [docs/_refactor/system-state-2026-04-12/runtime-e2e-inventory-and-logging.md](../../system-state-2026-04-12/runtime-e2e-inventory-and-logging.md#L1)

---

## 3. Problem Definition

### 3.1 Reliability Failures To Eliminate

1. A media response may claim completion before a durable governed artifact exists.
2. A newly requested chart, graph, or audio asset may be pending while composition silently substitutes an older asset.
3. A browser media run may fail or be interrupted without guaranteed server recovery.
4. Execution-target tests may disagree about the intended default route for a capability.
5. Replay, refresh, or interruption may preserve enough state to mark failure but not enough to complete recovery.

### 3.2 Architectural Anti-Goals

This program must not:

1. bypass the capability catalog with media-specific hidden execution rules
2. create a parallel asset-governance system outside `user_files`
3. move policy, RBAC, or artifact ownership out of the host runtime
4. rely on prompt etiquette where a runtime-enforced contract should exist
5. solve truthfulness by muting errors instead of exposing explicit terminal state

---

## 4. Architecture Invariants

These invariants are mandatory. Any implementation that violates them is non-compliant.

1. The capability catalog remains the authoritative definition for execution surfaces, prompt hints, presentation, and job facets.
2. `user_files` remains the canonical source of durable governed media asset identity.
3. `resultEnvelope.payload` and `resultEnvelope.artifacts` remain the canonical transcript-safe surface for reusable media state.
4. The browser runtime may accelerate execution, but it may not invent separate artifact identity or completion semantics.
5. Deferred server fallback must reuse the existing `/api/chat/jobs` and `compose-media-deferred-job` path rather than introducing a second media queue.
6. Cards and assistant prose must consume canonical runtime state; they must not become alternate authorities for completion.
7. Execution-target defaults must be defined in one authority and covered by tests that agree with that authority.
8. Release evidence and runtime-integrity checks must remain the final drift gate.

---

## 5. Functional Requirements

### 5.1 Truth-Bound Completion Requirement

The assistant must not describe a media artifact as completed, playable, or available unless a canonical artifact envelope exists with a durable asset reference.

Required behavior:

1. `client_fetch_pending` must be described as pending, not complete.
2. `compose_media` may say composition has started, but not that the player will appear or that a finished video exists, unless a final artifact is present.
3. Completion language is allowed only when the latest canonical result contains a usable video artifact or `primaryAssetId`.

Affected areas:

- [src/adapters/ChatPresenter.ts](../../../../src/adapters/ChatPresenter.ts#L1)
- [src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx](../../../../src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx)
- [src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx](../../../../src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx#L1)

### 5.2 Asset-Readiness Requirement

`compose_media` must not begin against optimistic intent alone. Phase 2 now treats asset readiness as a canonical runtime contract layered on top of the Phase 0 lifecycle model and consumed by the Phase 1 presentation rules: browser staging, deferred execution, and replay must all distinguish governed durable assets from pending `client_fetch_pending` placeholders, must bind same-turn fresh generation to the requested artifact lineage rather than opportunistically reusing older conversation assets, and must surface readiness failures through canonical stages like `asset_generation` or `composition_preflight` instead of generic render failure language.

Required behavior:

1. If a fresh `generate_audio` result has `assetId = null` and `generationStatus = client_fetch_pending`, composition must wait, reroute, or fail explicitly.
2. Silent substitution of an older cached asset is prohibited unless the user explicitly selected that asset.
3. Chart and graph materialization, reusable conversation-asset discovery, and fresh audio resolution must all flow through the same governed-asset readiness contract.
4. Composition preflight must reject clip plans that reference unresolved, unauthorized, kind-invalid, or non-existent governed assets.

Affected areas:

- [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L220)
- [src/lib/media/browser-runtime/job-snapshots.ts](../../../../src/lib/media/browser-runtime/job-snapshots.ts#L1)
- [src/lib/media/media-asset-projection.ts](../../../../src/lib/media/media-asset-projection.ts#L1)
- [src/core/use-cases/tools/list-conversation-media-assets.tool.ts](../../../../src/core/use-cases/tools/list-conversation-media-assets.tool.ts#L1)
- [src/lib/media/server/compose-media-worker-runtime.ts](../../../../src/lib/media/server/compose-media-worker-runtime.ts#L1)
- [src/core/entities/media-composition.ts](../../../../src/core/entities/media-composition.ts#L1)

### 5.3 Automatic Recovery Requirement

If browser composition cannot complete, the system must either recover automatically through deferred server execution or end in an explicit, truthful terminal failure. Phase 0 already supplied the lifecycle and failure-stage vocabulary for that handoff, Phase 1 already requires presentation to distinguish `compose_fallback_required` from true deferred execution states, and Phase 2 already ensures the plan being recovered is asset-ready and governed. Phase 3 therefore does not need a new runtime model; it needs the missing operational bridge from browser reroute detection into the existing deferred-job path.

Required behavior:

1. `fallback_required` for `compose_media` must enqueue `/api/chat/jobs` automatically unless policy explicitly blocks it.
2. Interrupted browser runtime entries recovered from persisted client state must either resume or enqueue deferred recovery.
3. Reroute status without a real server enqueue is non-compliant.
4. Deferred enqueue must remain idempotent through the existing `compose_media:${plan.id}` dedupe key.

Affected areas:

- [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L400)
- [src/app/api/chat/jobs/route.ts](../../../../src/app/api/chat/jobs/route.ts#L77)
- [src/lib/jobs/compose-media-deferred-job.ts](../../../../src/lib/jobs/compose-media-deferred-job.ts#L1)

### 5.4 Execution-Target Clarity Requirement

Default execution planning for each capability must have one authoritative truth in code and one agreeing test posture.

Required behavior:

1. `getDefaultExecutionPlanningForCapability()` is the source of truth for pack-owned default targets.
2. Default-aware planner tests, runtime-binding tests, and subsystem docs must agree on the effective default route for `admin_web_search`, `compose_media`, and `generate_audio` after pack-owned planning context is merged into the lower-level planner.
3. Any capability-specific override must be explicit in code, not inferred from runtime side effects.

Affected areas:

- [src/core/capability-catalog/capability-ownership.ts](../../../../src/core/capability-catalog/capability-ownership.ts#L1)
- [src/core/capability-catalog/execution-planning-policy.ts](../../../../src/core/capability-catalog/execution-planning-policy.ts#L1)
- [src/lib/capabilities/execution-targets.ts](../../../../src/lib/capabilities/execution-targets.ts#L1)
- [src/core/capability-catalog/runtime-tool-binding.ts](../../../../src/core/capability-catalog/runtime-tool-binding.ts#L1)

### 5.5 Asset Continuity Requirement

Generated media must remain discoverable and reusable across later turns, refreshes, and portability paths.

Required behavior:

1. `list_conversation_media_assets` must surface the current durable asset set for the conversation.
2. Transcript-safe media payloads must preserve `assetId`, `assetKind`, `mimeType`, `source`, and `retentionClass` when available.
3. Replay and import flows must not degrade previously durable media into non-reusable card-only state.

Affected areas:

- [src/lib/chat/conversation-portability.ts](../../../../src/lib/chat/conversation-portability.ts#L1)
- [src/lib/media/media-asset-projection.ts](../../../../src/lib/media/media-asset-projection.ts#L1)
- [src/core/use-cases/ConversationInteractor.test.ts](../../../../src/core/use-cases/ConversationInteractor.test.ts#L1)

### 5.6 Observability Requirement

Every media failure class must leave enough evidence to reconstruct what happened without transcript guesswork.

Required behavior:

1. Server-owned fallback enqueue, deferred execution, and terminal results must produce durable runtime-audit entries.
2. Browser-only failures must create explicit transcript/job snapshots that include reason, stage, and recovery action.
3. Composition failure telemetry must distinguish: unresolved asset, local runtime interruption, fallback enqueue failure, worker execution failure, playback readiness timeout, and durable upload failure.

---

## 6. Compliance Requirements

### 6.1 Code Organization Compliance

1. New behavior must extend existing seams instead of creating duplicate orchestration layers.
2. Asset readiness and fallback logic belong in the browser-runtime and deferred-job layers, not in prompt text or card-only components.
3. Presentation logic must remain consumers of runtime state and may not hardcode completion assumptions.
4. Test fixtures for media tools must use canonical capability names and result-envelope shapes.

### 6.2 Documentation Compliance

The following docs must stay synchronized with the final implementation:

- [docs/_refactor/system-state-2026-04-12/subsystems/execution-targets.md](../../system-state-2026-04-12/subsystems/execution-targets.md#L1)
- [docs/_refactor/system-state-2026-04-12/runtime-e2e-inventory-and-logging.md](../../system-state-2026-04-12/runtime-e2e-inventory-and-logging.md#L1)
- [docs/_refactor/system-state-2026-04-12/phases/phase-9-canonicalization-closeout-and-runtime-promotion.md](../../system-state-2026-04-12/phases/phase-9-canonicalization-closeout-and-runtime-promotion.md#L1)

### 6.3 Release-Gate Compliance

No implementation is complete until:

1. focused tests pass
2. runtime-integrity evidence stays green
3. build stays green
4. architecture docs are updated if any contract meaning changed

---

## 7. Required Test Strategy

This program now needs the Phase 3 test matrix to distinguish between coverage that is already real in the repo and proof that is still missing for the remaining browser-to-deferred recovery gap.

### 7.1 Current Verified Coverage

#### C1. Browser-local composition and truthful fallback signaling

Currently proved by the existing suites:

1. browser-local `compose_media` success paths produce canonical video artifacts and `primaryAssetId`
2. chart and graph materialization are staged through governed assets before browser composition
3. browser-local `fallback_required` is surfaced truthfully as `compose_fallback_required`, not misreported as deferred execution

Current coverage:

- [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx#L1)
- [tests/browser-ui/ffmpeg-browser-runtime.spec.ts](../../../../tests/browser-ui/ffmpeg-browser-runtime.spec.ts)

#### C2. Deferred enqueue route and dedupe exist in isolation

Currently proved by the existing suites:

1. `/api/chat/jobs` accepts canonical `compose_media` enqueue requests
2. deferred enqueue uses `compose_media:${plan.id}` as the dedupe key
3. deduplicated enqueue returns the existing active job cleanly

Current coverage:

- [src/app/api/chat/jobs/route.test.ts](../../../../src/app/api/chat/jobs/route.test.ts)
- [src/lib/jobs/compose-media-deferred-job.test.ts](../../../../src/lib/jobs/compose-media-deferred-job.test.ts)

#### C3. Startup reconciliation and browser admission-control signaling exist

Currently proved by the existing suites:

1. stale persisted browser work is reconciled into explicit `fallback_required` or `interrupted` outcomes according to descriptor policy
2. local queue saturation overflows with explicit reroute or failure signaling rather than silent abandonment

Current coverage:

- [src/lib/media/browser-runtime/browser-capability-runtime.test.ts](../../../../src/lib/media/browser-runtime/browser-capability-runtime.test.ts)

#### C4. Deferred execution and execution-target parity remain grounded

Currently proved by the existing suites:

1. deferred compose handlers publish canonical progress and terminal envelopes
2. deferred worker execution persists governed video outputs and returns canonical `deferred_remote` envelopes
3. default-aware execution planning now resolves pack-owned route defaults through a shared merge seam before planner dispatch
4. execution-target ordering, effective defaults, and override behavior remain aligned for `compose_media`, `admin_web_search`, and `generate_audio`

Current coverage:

- [src/lib/jobs/deferred-job-runtime.test.ts](../../../../src/lib/jobs/deferred-job-runtime.test.ts)
- [src/lib/media/server/compose-media-worker-runtime.test.ts](../../../../src/lib/media/server/compose-media-worker-runtime.test.ts)
- [src/lib/capabilities/execution-targets.test.ts](../../../../src/lib/capabilities/execution-targets.test.ts#L1)
- [src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts#L1)
- [src/core/capability-catalog/capability-ownership.test.ts](../../../../src/core/capability-catalog/capability-ownership.test.ts#L1)

### 7.2 Phase 3 Recovery Proofs Now In Repo

#### R1. Automatic browser-to-deferred handoff is implemented and covered

The repo now proves real recovery rather than advisory reroute signaling only.

Verified behavior:

1. browser FFmpeg fallback triggers a real POST to `/api/chat/jobs`
2. the enqueue creates or reuses exactly one deferred job for `compose_media:${plan.id}`
3. transcript state advances from browser reroute signaling into deferred queued state only after enqueue succeeds

Current coverage:

- [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx#L1)
- [src/app/api/chat/jobs/route.test.ts](../../../../src/app/api/chat/jobs/route.test.ts)
- [src/lib/jobs/compose-media-deferred-job.test.ts](../../../../src/lib/jobs/compose-media-deferred-job.test.ts)
- [tests/browser-ui/ffmpeg-browser-runtime.spec.ts](../../../../tests/browser-ui/ffmpeg-browser-runtime.spec.ts)

#### R2. Startup recovery and overflow now promote into real deferred recovery

The repo now proves that stale persisted compose work and overflowed compose work reuse the same enqueue contract rather than ending at signaling-only snapshots.

Verified behavior:

1. persisted `compose_media` entries enqueue deferred recovery when local continuation is not proven
2. duplicate work does not start during reconciliation because recovery reuses the existing dedupe key and recovery helper
3. persisted browser state is cleaned up only after the recovery outcome becomes durable enough for the deferred path to take over

Current coverage:

- [src/lib/media/browser-runtime/browser-capability-runtime.test.ts](../../../../src/lib/media/browser-runtime/browser-capability-runtime.test.ts)
- [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx#L1)

#### R3. Deferred enqueue failure is now a first-class tested failure stage

The browser recovery path now attempts enqueue and distinguishes enqueue failure from local execution failure.

Verified behavior:

1. queue-route failure produces an explicit recovery failure
2. failure metadata distinguishes deferred enqueue failure from local execution failure
3. the transcript does not strand a reroute-needed state with no next step when enqueue fails

Current coverage:

- [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx#L1)

#### R4. Synthetic-to-real job continuity is covered at the focused surface level

The repo now proves that deferred recovery becomes the active authority rather than leaving duplicate browser-local progress behind.

Verified behavior:

1. no duplicate active progress entries remain after deferred recovery takes over
2. progress surfaces distinguish local reroute-needed state from real deferred queue state
3. deferred queued state supersedes the synthetic browser attempt in the progress strip

Current coverage:

- [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx#L1)
- [tests/browser-ui/chat-progress-strip.spec.ts](../../../../tests/browser-ui/chat-progress-strip.spec.ts)

### 7.3 Edge-Case Coverage Posture

#### E1. Queue saturation is currently covered

Current proof:

1. local queue limits are enforced
2. overflow yields explicit reroute or failure signaling according to browser capability policy

Current coverage:

- [src/lib/media/browser-runtime/browser-capability-runtime.test.ts](../../../../src/lib/media/browser-runtime/browser-capability-runtime.test.ts)

#### E2. Playback verification success is covered more strongly than playback timeout failure

Current proof:

1. browser-local success waits for playable video readiness before final success is published

Remaining gap:

1. timeout or failure during playback verification should have a dedicated focused assertion if Phase 3 touches that path

Current coverage:

- [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx#L1)

#### E3. Refresh-driven compose recovery is now covered in focused runtime tests

Current proof:

1. refresh reconciliation no longer stops at stale-work closure; it promotes stale `compose_media` work into deferred recovery when local continuation is not proven

#### E4. Intensive route parity beyond browser and deferred remains broader confidence work

Current proof:

1. browser-local compose and deferred worker compose are both exercised in focused suites

Current posture:

1. native-process media execution parity is still useful, but it is no longer the blocking proof for Phase 3 because the browser-fallback-to-deferred handoff now has focused browser coverage

---

## 8. Intensive E2E Requirements

The intensive confidence layer should now be read in two parts: what already exists and what remains optional confidence work after Phase 3 recovery landed.

### 8.1 Existing Browser Confidence Suites

The repo already has live browser suites that exercise meaningful media behavior:

1. [tests/browser-ui/ffmpeg-browser-runtime.spec.ts](../../../../tests/browser-ui/ffmpeg-browser-runtime.spec.ts) covers browser capability probing, surfaced browser-runtime states, and fallback-required rendering in a real browser
2. [tests/browser-ui/media-live-workflows.spec.ts](../../../../tests/browser-ui/media-live-workflows.spec.ts) covers governed artifact creation and playable media outputs across the live media lab workflows

### 8.2 Current Intensive Phase 3 Recovery Posture

Phase 3 now has focused browser proof for the real browser-to-deferred enqueue handoff. A heavier live run that also captures runtime-log evidence remains optional confidence work rather than a blocking implementation gap.

Useful follow-on confidence targets:

1. reroute reason from the browser path plus runtime-log evidence in one run
2. dedupe behavior when the same plan is already active under a live server path
3. deferred job lineage and progress continuity under a full worker-backed execution run

### 8.3 Native Process And Remote Audio Remain Broader Program Confidence Work

Those runs are still useful to the overall anti-drift program, but they are no longer blocking proof for an open browser-recovery gap. They now sit as follow-on confidence work after Phase 4 tightened default-aware planning and focused route-parity coverage.

---

## 9. Candidate File-Level Work

The Phase 3 implementation stayed within the existing browser-runtime, deferred-job, and transcript reconciliation seams.

### 9.1 High-Probability Production Code Changes

- [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L1)
- [src/lib/media/browser-runtime/browser-capability-runtime.ts](../../../../src/lib/media/browser-runtime/browser-capability-runtime.ts#L1)
- [src/lib/media/browser-runtime/browser-runtime-state.ts](../../../../src/lib/media/browser-runtime/browser-runtime-state.ts#L1)
- [src/app/api/chat/jobs/route.ts](../../../../src/app/api/chat/jobs/route.ts#L77)
- [src/lib/jobs/compose-media-deferred-job.ts](../../../../src/lib/jobs/compose-media-deferred-job.ts#L1)
- [src/hooks/chat/useChatJobEvents.ts](../../../../src/hooks/chat/useChatJobEvents.ts#L1)
- [src/lib/jobs/job-status.ts](../../../../src/lib/jobs/job-status.ts#L1)

### 9.2 High-Probability Test Changes

- [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx#L1)
- [src/lib/media/browser-runtime/browser-capability-runtime.test.ts](../../../../src/lib/media/browser-runtime/browser-capability-runtime.test.ts)
- [src/app/api/chat/jobs/route.test.ts](../../../../src/app/api/chat/jobs/route.test.ts)
- [src/lib/jobs/compose-media-deferred-job.test.ts](../../../../src/lib/jobs/compose-media-deferred-job.test.ts#L1)
- [src/lib/jobs/deferred-job-runtime.test.ts](../../../../src/lib/jobs/deferred-job-runtime.test.ts)
- [src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts#L1)
- [src/lib/capabilities/execution-targets.test.ts](../../../../src/lib/capabilities/execution-targets.test.ts#L1)
- [src/core/capability-catalog/capability-ownership.test.ts](../../../../src/core/capability-catalog/capability-ownership.test.ts#L1)
- [tests/browser-ui/ffmpeg-browser-runtime.spec.ts](../../../../tests/browser-ui/ffmpeg-browser-runtime.spec.ts)
- [tests/browser-ui/chat-progress-strip.spec.ts](../../../../tests/browser-ui/chat-progress-strip.spec.ts)

### 9.3 Candidate New Tests Only If Existing Suites Become Too Broad

- `src/lib/media/browser-runtime/compose-media-recovery.test.ts`
- `tests/browser-ui/media-compose-fallback-to-deferred.spec.ts`

---

## 10. Verification Commands

Recommended focused Phase 3 audit bundle:

```bash
npm exec vitest run \
  src/hooks/chat/useBrowserCapabilityRuntime.test.tsx \
  src/lib/media/browser-runtime/browser-capability-runtime.test.ts \
  src/app/api/chat/jobs/route.test.ts \
  src/lib/jobs/compose-media-deferred-job.test.ts \
  src/lib/jobs/deferred-job-runtime.test.ts \
  src/lib/media/server/compose-media-worker-runtime.test.ts \
  src/core/capability-catalog/runtime-tool-binding.test.ts \
  src/lib/capabilities/execution-targets.test.ts \
  src/core/capability-catalog/capability-ownership.test.ts
```

Recommended browser confidence bundle:

```bash
npm exec playwright test \
  tests/browser-ui/ffmpeg-browser-runtime.spec.ts \
  tests/browser-ui/media-live-workflows.spec.ts \
  tests/browser-ui/chat-progress-strip.spec.ts

npm run qa:runtime-integrity
npm run build
```

---

## 11. Acceptance Criteria

This spec is complete only when all of the following are true.

1. The assistant cannot claim a completed media artifact without a canonical durable artifact reference.
2. Fresh unresolved audio cannot be silently replaced by an older audio asset.
3. Browser `compose_media` fallback automatically enqueues deferred recovery or fails explicitly with no ambiguity.
4. Execution-target defaults for affected capabilities are defined once and tested consistently.
5. Positive, negative, and edge-case tests exist across unit, integration, browser, and intensive E2E layers.
6. Runtime logs and transcript/job snapshots are sufficient to reconstruct failure without transcript guesswork.
7. The implementation remains aligned with the current capability-catalog and governed-asset architecture rather than creating parallel media logic.

---

## 12. Non-Goals

1. Replace the capability catalog with a media-specific runtime registry.
2. Introduce arbitrary FFmpeg CLI access from the model.
3. Move artifact governance out of `user_files`.
4. Re-architect the entire execution-target system beyond the requirements needed to make the current media workflow truthful and reliable.
5. Treat doc or prompt wording alone as an adequate fix for execution-truth defects.

---

## 13. Execution Program

This specification is decomposed into the phased implementation program in:

- [docs/_refactor/media/specs/media-composition-reliability-and-anti-drift/README.md](./media-composition-reliability-and-anti-drift/README.md)
