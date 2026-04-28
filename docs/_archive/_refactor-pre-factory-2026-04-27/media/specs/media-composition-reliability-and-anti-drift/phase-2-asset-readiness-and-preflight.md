# Phase 2: Asset Readiness And Composition Preflight

**Status:** Implemented After Phase 0 Canonicalization And Phase 1 Truth-Bound Presentation  
**Objective:** Make asset readiness, governed-asset selection, and composition preflight consume the existing canonical runtime model so composition cannot start, reroute, or be described as successful against unresolved, stale, invalid, or unauthorized assets.

---

## 1. Why This Phase Exists

The original incident was not only a presentation failure.

The system could also move into composition while the requested source assets were still in one of these states:

1. still being generated locally
2. not yet persisted into governed storage
3. represented only by optimistic tool payloads
4. silently substitutable with older conversation assets

Phase 0 established the canonical lifecycle vocabulary and normalization seam. Phase 1 made cards and assistant prose consume that truth instead of inventing their own status model. Phase 2 is the runtime contract beneath both of those phases: it decides when composition is actually allowed to begin, which assets are eligible, and what failure stage must be surfaced when that gate fails.

This phase is complete only when composition start is bound to governed, policy-valid, runtime-current assets rather than optimistic intent.

---

## 2. Verified Current Architecture

Phase 2 must strengthen the seams that already exist in code today.

### 2.1 Phase 0 Canonical Lifecycle Already Exists

The codebase already has one canonical runtime normalization seam for media state:

1. conceptual lifecycle and failure stages are typed in [src/core/entities/media-runtime-state.ts](../../../../../src/core/entities/media-runtime-state.ts#L1)
2. browser, deferred, and persisted runtime state normalize through [src/lib/media/browser-runtime/media-runtime-normalization.ts](../../../../../src/lib/media/browser-runtime/media-runtime-normalization.ts#L1)
3. transcript-visible browser snapshots are built in [src/lib/media/browser-runtime/job-snapshots.ts](../../../../../src/lib/media/browser-runtime/job-snapshots.ts#L1)
4. deferred job publication reuses the same normalization contract in [src/lib/jobs/job-status.ts](../../../../../src/lib/jobs/job-status.ts#L1)

Phase 2 must express readiness and preflight through that same lifecycle vocabulary. It is non-compliant to introduce a second readiness enum or a card-only notion of asset validity.

### 2.2 Composition Still Starts From An Optimistic Tool Payload

`compose_media` still begins as an optimistic start signal rather than a proven artifact:

1. [src/core/use-cases/tools/compose-media.tool.ts](../../../../../src/core/use-cases/tools/compose-media.tool.ts#L1) returns `generationStatus: "client_fetch_pending"`
2. the browser runtime then stages the plan and rewrites the tool result into canonical `job_status` snapshots in [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L520)
3. browser composition currently materializes chart clips before execution in `materializeComposeMediaPlan()` and then runs `validatePlanConstraints()` before FFmpeg execution

That means the correct place for Phase 2 is the browser-runtime staging and preflight seam, plus the worker-side mirror path. The doc must not pretend preflight begins inside the presenter or card layer.

### 2.3 Fresh Asset Resolution Already Exists For Some Media Types

The repo already contains a partial readiness model:

1. `generate_audio` can start as `client_fetch_pending` and later resolve into a governed asset via `withResolvedAudioAsset()` in [src/lib/media/browser-runtime/job-snapshots.ts](../../../../../src/lib/media/browser-runtime/job-snapshots.ts#L393)
2. chart clips are materialized into governed image assets before composition inside [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L225)
3. browser-generated chart and graph outputs can be persisted through `uploadBrowserRuntimeAsset()` in [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L280)
4. conversation-owned reusable assets are projected through [src/lib/media/media-asset-projection.ts](../../../../../src/lib/media/media-asset-projection.ts#L1) and exposed by [src/core/use-cases/tools/list-conversation-media-assets.tool.ts](../../../../../src/core/use-cases/tools/list-conversation-media-assets.tool.ts#L1)

Phase 2 should unify those existing behaviors into one explicit readiness contract instead of adding a new parallel orchestration path.

### 2.4 Current Validation Is Structural, Not Full Readiness Validation

The current plan validation seam is necessary but not sufficient:

1. [src/lib/media/ffmpeg/media-composition-plan.ts](../../../../../src/lib/media/ffmpeg/media-composition-plan.ts#L1) validates clip structure, supported kinds, profile constraints, and basic plan shape
2. browser composition uses that seam and reports failures as `failureStage: "composition_preflight"` in [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L576)
3. deferred composition also validates plan constraints in [src/lib/jobs/compose-media-deferred-job.ts](../../../../../src/lib/jobs/compose-media-deferred-job.ts#L1)

What remains missing is a canonical readiness check that answers questions structure validation cannot answer:

1. does every referenced asset actually exist?
2. does it belong to the active user and conversation or satisfy explicit policy?
3. does the stored asset kind match the clip kind?
4. if the user just asked for fresh audio or a fresh graph, are we binding to that requested lineage instead of opportunistically reusing an older asset?

### 2.5 Worker-Side Ownership Checks Already Exist But Need To Become A Contract

The deferred worker already does one important part of readiness:

1. [src/lib/media/server/compose-media-worker-runtime.ts](../../../../../src/lib/media/server/compose-media-worker-runtime.ts#L1) resolves every referenced asset ID from governed storage
2. it rejects assets that do not belong to the current user by resolving them to `null` disk paths

That is a real authorization boundary. Phase 2 must preserve it and extend it into explicit preflight semantics rather than treating it as an incidental implementation detail.

### 2.6 Phase 1 Presentation Rules Depend On Phase 2 Truth

Phase 1 is already explicit that presentation must not outrun readiness truth.

Phase 2 therefore must emit canonical failure and waiting states that Phase 1 can present honestly:

1. unresolved fresh asset states should remain pending or blocked, not silently upgraded to success
2. preflight rejections must surface as `composition_preflight` or `asset_generation` failures, not generic render errors
3. deferred reroute may only be described as active after a real enqueue, not after a local fallback intention alone

---

## 3. Phase 2 Scope

This phase governs all runtime decisions required before composition may execute against media assets:

1. governed asset discovery and projection for reusable conversation media
2. fresh-asset resolution for same-turn generation followed by composition
3. clip-kind and authorization validation against governed storage
4. preflight failure classification for browser and deferred execution paths
5. lineage-safe binding between user intent and the actual assets supplied to a composition plan

This phase does not create a new presentation model. It provides the runtime truth that Phase 1 must render.

---

## 4. Phase 2 Invariants

The following rules are mandatory.

1. Composition may not begin against an asset reference that is unresolved, unauthorized, or structurally incompatible with its clip kind.
2. Governing asset identity remains the `user_files` asset ID, not a transient browser object URL or an inferred transcript payload.
3. `list_conversation_media_assets` remains the canonical reusable-asset discovery surface for previously persisted conversation media.
4. Fresh same-turn generation must bind composition to the requested asset lineage or fail explicitly; it may not silently select an older asset just because one exists.
5. Structural plan validation and asset-readiness validation are separate concerns. Both must pass before composition starts.
6. Browser and deferred execution paths must apply materially the same readiness rules, even if their code paths differ.
7. Preflight failures must surface through canonical lifecycle and failure-stage metadata so Phase 1 can present them truthfully.
8. Presenter and card layers remain read-only consumers of readiness truth and may not infer asset validity from prompt intent or prior transcript language.

---

## 5. Canonical Readiness Contract

Phase 2 should define one reusable readiness evaluation that both browser and deferred composition paths consume.

### 5.1 Required Inputs

The canonical readiness evaluation must be able to inspect:

1. the normalized `MediaCompositionPlan`
2. governed asset metadata projected from `user_files`
3. current user and conversation context
4. any same-turn fresh-generation intent or job lineage available from transcript/runtime state

### 5.2 Required Decisions

For each clip in a composition plan, readiness must answer all of the following:

1. does the referenced governed asset exist?
2. is the asset authorized for the current user?
3. is the asset in-policy for the current conversation, or otherwise explicitly allowed?
4. does the projected asset kind match the required clip kind after any permitted chart or graph materialization?
5. is the asset durable enough for composition, rather than still being represented only by an optimistic pending payload?
6. if a fresh asset was requested in the same turn, does this chosen asset match that fresh request rather than an older reusable asset?

### 5.3 Required Outcomes

The readiness check must return one of these conceptual outcomes:

1. ready: all referenced assets are governed, authorized, kind-correct, and eligible for composition
2. waiting_for_asset_generation: a fresh requested source asset is still pending durable persistence
3. blocked_preflight: a governed asset exists but fails kind, ownership, conversation, or policy validation
4. failed_preflight: readiness could not be satisfied and composition must terminate explicitly

These are conceptual outcomes, not permission to create a second runtime enum. They must normalize into the Phase 0 lifecycle and failure-stage model.

---

## 6. Fresh-Asset Binding Rules

The highest-risk drift case is same-turn generation immediately followed by composition.

### 6.1 Required Behavior

When a user asks for fresh audio, chart, or graph generation and then immediate composition:

1. composition must bind to the newly requested artifact lineage
2. a pending `client_fetch_pending` source asset must remain pending until it resolves into a governed asset ID
3. if the fresh asset never resolves, composition must wait, reroute, or fail explicitly
4. if the user explicitly selected an older reusable asset, that selection may be honored, but the system must not describe it as the just-generated asset

### 6.2 Existing Code That Must Inform The Implementation

1. `generate_audio` already transitions from pending payload to governed asset through `withResolvedAudioAsset()` in [src/lib/media/browser-runtime/job-snapshots.ts](../../../../../src/lib/media/browser-runtime/job-snapshots.ts#L393)
2. chart clips are already materialized into fresh governed images before composition in [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L253)
3. reusable older assets are already discoverable through [src/core/use-cases/tools/list-conversation-media-assets.tool.ts](../../../../../src/core/use-cases/tools/list-conversation-media-assets.tool.ts#L1)

Phase 2 should therefore reuse transcript/job lineage plus governed asset projection, not invent an unrelated “latest asset” heuristic.

### 6.3 Forbidden Behavior

1. choosing the newest reusable audio asset in the conversation just because the requested fresh audio is still pending
2. treating a `client_fetch_pending` payload as composition-ready only because its future shape is predictable
3. conflating “same asset kind” with “same user-intended asset”

---

## 7. Clip And Asset Validation Rules

Phase 2 must make explicit what is already partially enforced and what is still missing.

### 7.1 Structural Validation

Structural validation remains the responsibility of [src/lib/media/ffmpeg/media-composition-plan.ts](../../../../../src/lib/media/ffmpeg/media-composition-plan.ts#L1).

That seam should continue to reject at least:

1. empty plans
2. unsupported subtitle or waveform combinations
3. invalid resolution constraints
4. invalid clip kinds such as chart or graph visual clips that were not materialized into images first
5. audio clips whose declared kind is not `audio`

### 7.2 Asset-Readiness Validation

A separate readiness seam must reject at least:

1. governed asset IDs that do not exist
2. asset IDs that resolve to another user’s file
3. asset kinds in storage that do not match the clip contract
4. asset references that are outside the active conversation without explicit policy support
5. same-turn fresh asset requests whose durable asset has not yet resolved
6. non-governed URLs or card-only payloads masquerading as reusable composition inputs

### 7.3 Failure Classification

When readiness fails, the surfaced metadata must preserve the real stage:

1. `asset_generation` when the requested source asset failed before becoming durable
2. `composition_preflight` when plan validation or governed-asset readiness blocks composition before execution
3. `local_execution` only after preflight succeeded and browser execution actually started
4. `deferred_execution` only after the deferred worker began remote composition

This distinction matters because Phase 1 now renders those stages directly.

---

## 8. Current Code Findings And Explicit Gaps

This section records what the repo already satisfies and where Phase 2 still needs concrete tightening.

### 8.1 Already Satisfied Or Mostly Satisfied

1. the canonical lifecycle and failure-stage model already exists from Phase 0
2. browser runtime snapshots already normalize pending and resolved audio into canonical transcript-visible states
3. chart and graph clips are materialized into governed image assets before browser composition
4. reusable conversation media discovery already exists and is backed by governed `user_files`
5. the deferred worker already enforces a user-ownership boundary when resolving asset IDs
6. browser and deferred paths already both reuse `validatePlanConstraints()` for structural plan validation
7. browser and deferred preflight now both consume a shared governed-asset readiness evaluator before execution
8. explicit clip source lineage can now be enforced through clip `sourceAssetId` plus governed `derivativeOfAssetId` metadata
9. browser preflight failures already surface as `failureStage: "composition_preflight"`

### 8.2 Gaps Phase 2 Should Close

No known correctness gaps remain in the implemented Phase 2 readiness and preflight path within the current architecture.

---

## 9. Required Deliverables

### 9.1 Canonical Asset-Readiness Evaluation

Implement or formalize one reusable readiness evaluation that can be consumed by both browser and deferred composition paths.

Required checks:

1. governed asset exists
2. asset is authorized for the current user
3. asset is in-policy for the current conversation or explicitly allowed otherwise
4. projected stored kind matches the clip requirement
5. required durable metadata is available for execution
6. same-turn fresh asset requests bind to the intended durable asset lineage

Implementation note:

1. this may live in a new helper, but it must be built from existing projection and runtime seams rather than bypassing them

### 9.2 Fresh-Asset Binding Contract

Codify how composition binds to fresh same-turn generated assets.

Required behavior:

1. pending fresh audio remains pending until `withResolvedAudioAsset()` or equivalent resolution produces a governed asset ID
2. chart or graph inputs that require materialization must resolve to fresh governed image assets before execution begins
3. older conversation assets may only be used when they are the explicit selected input, not as silent fallback
4. transcript-visible snapshots must preserve enough lineage or selection truth for Phase 1 to explain what happened honestly

### 9.3 Browser And Deferred Preflight Parity

Both execution paths must enforce materially equivalent readiness rules.

Required behavior:

1. browser preflight rejects invalid assets before FFmpeg execution starts
2. deferred execution repeats or confirms readiness rather than assuming browser checks already happened
3. worker-side authorization and asset-resolution failures surface as typed preflight failures, not just low-level missing-path errors
4. fallback and recovery paths must not bypass readiness checks when resuming or rerouting a plan

### 9.4 Failure And Waiting-State Publication

Readiness outcomes must publish canonical lifecycle and failure truth.

Required behavior:

1. waiting on fresh asset generation remains a pending state, not a successful composition state
2. readiness rejection surfaces `composition_preflight` or `asset_generation` as appropriate
3. failure codes should distinguish invalid asset ID, unauthorized asset, asset-kind mismatch, unresolved fresh asset, and lineage mismatch when available
4. result envelopes and job snapshots must preserve that metadata through replay and deferred publication

---

## 10. Candidate File Changes

Update:

- [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L1)
- [src/lib/media/browser-runtime/job-snapshots.ts](../../../../../src/lib/media/browser-runtime/job-snapshots.ts#L1)
- [src/lib/media/browser-runtime/media-runtime-normalization.ts](../../../../../src/lib/media/browser-runtime/media-runtime-normalization.ts#L1)
- [src/lib/media/ffmpeg/media-composition-plan.ts](../../../../../src/lib/media/ffmpeg/media-composition-plan.ts#L1)
- [src/lib/media/server/compose-media-worker-runtime.ts](../../../../../src/lib/media/server/compose-media-worker-runtime.ts#L1)
- [src/core/use-cases/tools/list-conversation-media-assets.tool.ts](../../../../../src/core/use-cases/tools/list-conversation-media-assets.tool.ts#L1)
- [src/lib/media/media-asset-projection.ts](../../../../../src/lib/media/media-asset-projection.ts#L1)
- [src/core/entities/media-composition.ts](../../../../../src/core/entities/media-composition.ts#L1)
- [src/lib/jobs/compose-media-deferred-job.ts](../../../../../src/lib/jobs/compose-media-deferred-job.ts#L1)
- [src/lib/jobs/job-status.ts](../../../../../src/lib/jobs/job-status.ts#L1)

Add, if needed:

- `src/lib/media/asset-readiness.ts`
- `src/lib/media/asset-readiness.test.ts`
- `src/lib/media/compose-media-preflight.ts`
- `src/lib/media/compose-media-preflight.test.ts`

The new files are optional. If the existing seams can absorb the contract cleanly, that is preferred.

---

## 11. Verification Requirements

### 11.1 Positive Tests

1. fresh graph plus fresh audio composes only after both assets are durable governed assets
2. existing durable audio plus fresh chart image composes successfully with the exact selected asset IDs
3. `list_conversation_media_assets` returns the durable governed assets that composition can actually reuse
4. deferred worker preflight accepts the same valid asset set the browser path accepted

### 11.2 Negative Tests

1. pending fresh audio cannot be silently replaced by an older cached audio asset
2. invalid governed asset ID fails preflight before composition execution starts
3. cross-user asset ID fails closed in the deferred worker and surfaces a typed readiness failure
4. stored asset kind mismatch fails preflight before FFmpeg execution begins
5. non-governed external URLs or optimistic payload-only handles are rejected as reusable composition inputs

### 11.3 Edge Tests

1. same-turn multiple audio generations do not bind the wrong asset to composition
2. duplicate assets with similar labels or metadata still resolve by explicit governed asset ID
3. imported or replayed assets with normalized IDs remain composable after projection
4. fallback or reroute paths do not bypass asset-readiness validation when resuming execution

---

## 12. Exit Criteria

1. composition cannot begin against unresolved, unauthorized, or kind-invalid assets
2. silent stale-asset substitution is impossible without explicit user selection
3. browser and deferred execution paths apply materially equivalent readiness gates
4. readiness failures are explicit, typed, and normalized into the Phase 0 lifecycle and failure-stage model
5. Phase 1 presentation can describe all readiness outcomes truthfully without adding inference logic of its own