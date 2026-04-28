# Phase 7: Canonical Asset Identity And Compose Normalization

**Status:** Planned Expansion After Phase 0 Through 6 And April 17 Reliability Findings  
**Objective:** Ensure that every `compose_media` plan, recovery path, and transcript-visible snapshot converges on governed canonical asset IDs before execution can begin, so placeholder handles and card-local aliases never become execution truth.

---

## 1. Why This Phase Exists

Phase 0 through 6 established truthful lifecycle semantics, governed readiness, automatic fallback, runtime parity, observability, and release gates. Those phases materially improved the architecture, but the April 17 incident proved one drift seam still survives:

1. `compose_media` payloads can still carry placeholder clip handles such as semantic aliases or card-local identifiers
2. browser recovery later reuses those original payloads as if they were canonical execution truth
3. the real governed assets already exist in storage, but the runtime can no longer correlate the placeholder handles back to them deterministically

That means the system can still fail even when the media source asset is present, valid, and owned by the current conversation. This is not an execution-target bug first. It is an identity-contract bug.

Phase 7 exists to eliminate that class entirely.

By the end of this phase:

1. governed `uf_*`-style asset IDs are the only legal clip references by the time a compose plan becomes executable
2. placeholder handles are treated as pre-canonical draft references only
3. recovery, reroute, export/import replay, and later composition all observe the same canonical plan identity

---

## 2. Verified Gap After Phase 6

The incident review demonstrated that the current codebase can still violate the intended contract.

### 2.1 Compose Tool Output Is Still Payload-Preserving Instead Of Canonicalizing

Current tool execution in [src/core/use-cases/tools/compose-media.tool.ts](../../../../../src/core/use-cases/tools/compose-media.tool.ts#L1) echoes the incoming plan back to the caller.

That is compliant only if the input plan is already canonical. The observed failure proved that assumption is unsafe.

### 2.2 Browser Recovery Reuses Original Compose Payloads

Browser recovery currently reconstructs the plan in [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L629) by normalizing the original `candidate.args.plan` or `candidate.payload`.

That means any placeholder handle that slipped into the original compose payload survives into:

1. browser-local retry
2. browser-to-deferred reroute
3. transcript-visible failure analysis

### 2.3 Tests Already Imply The Correct Contract

The interaction tests in [src/core/use-cases/ConversationInteractor.test.ts](../../../../../src/core/use-cases/ConversationInteractor.test.ts#L820) already prove the architecture wants `compose_media` to operate on governed asset IDs such as `uf_chart_1` and `uf_audio_1`.

Phase 7 makes that implicit contract explicit and mandatory at runtime.

---

## 3. Phase 7 Scope

This phase governs canonical identity before execution, not renderer behavior and not worker transport.

Specifically, this phase governs:

1. plan-time canonicalization of clip asset references
2. deterministic mapping from provisional media references to governed asset IDs
3. transcript and browser snapshot rewriting so later recovery observes canonical asset IDs
4. explicit rejection of unresolved placeholder handles before execution and before reroute
5. portability and replay preservation of canonical clip identity

This phase does not replace Phase 2 readiness, Phase 3 recovery, Phase 8 governed-source rehydration, or Phase 9 worker resilience. It creates the identity contract those later phases depend on.

---

## 4. Phase 7 Invariants

1. A `compose_media` plan that can be executed or queued must contain only governed canonical asset IDs in `visualClips` and `audioClips`.
2. Placeholder references, semantic aliases, card-local handles, and draft-only identifiers are allowed only before canonicalization.
3. Canonicalization must happen before browser execution starts, before deferred enqueue occurs, and before recovery logic stores durable state.
4. Recovery may not depend on reconstructing unresolved placeholder IDs from transcript context.
5. Canonicalization must preserve lineage through `sourceAssetId` rather than mutating away provenance.
6. If canonicalization cannot prove an asset reference, execution must fail explicitly with a canonical invalid-plan class rather than continuing optimistically.
7. Portability, replay, import, and rediscovery must preserve canonical governed IDs where those IDs remain valid for the target conversation.

---

## 5. Canonical Phase 7 Contract

### 5.1 Draft Versus Canonical Plan States

Phase 7 must make the distinction explicit:

1. draft compose plan: may contain provisional references while the system is still binding tool outputs and governed uploads
2. canonical compose plan: every clip has a governed asset ID and is eligible for readiness validation, execution, fallback, and portability

Only the canonical form may cross execution boundaries.

### 5.2 Canonicalization Authority

The system must have one explicit canonicalization seam that can:

1. inspect compose clip references
2. resolve them against governed media artifacts already known to the conversation
3. rewrite them into canonical `assetId` values
4. preserve `kind` and `sourceAssetId` semantics
5. fail deterministically if no governed mapping exists

It is non-compliant to scatter this logic across cards, ad hoc hook branches, or planner-specific helpers.

### 5.3 Required Canonicalization Inputs

The canonicalizer may use only authority-bearing inputs:

1. governed media asset descriptors
2. structured tool result payloads that already include persisted asset IDs
3. later-turn discovery surfaces such as `list_conversation_media_assets`
4. import/rebind mappings that preserve governed identity

It must not rely on plain text title matching or optimistic card-local labels.

### 5.4 Required Failure Contract

If a plan cannot be canonicalized, the failure must be explicit and typed.

Required properties:

1. the failure occurs before execution route selection becomes authoritative
2. the failure clearly states which clip reference could not be canonicalized
3. browser recovery and deferred enqueue both surface the same invalid-plan class
4. the transcript never claims a reroute or composition attempt succeeded when the plan never became canonical

---

## 6. Deliverables

### 6.1 Canonical Compose Plan Resolver

Add one shared canonicalization layer that can be called from:

1. `compose_media` input execution
2. browser runtime execution startup
3. deferred enqueue
4. startup recovery and replay reconciliation

Candidate seams:

- [src/core/use-cases/tools/compose-media.tool.ts](../../../../../src/core/use-cases/tools/compose-media.tool.ts#L1)
- [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L629)
- [src/lib/jobs/compose-media-deferred-job.ts](../../../../../src/lib/jobs/compose-media-deferred-job.ts#L1)
- [src/lib/media/ffmpeg/media-composition-plan.ts](../../../../../src/lib/media/ffmpeg/media-composition-plan.ts#L1)

### 6.2 Transcript Rewriting To Canonical Asset IDs

When chart, graph, audio, or similar browser-runtime assets are persisted after generation, the transcript-visible payloads must expose the persisted governed asset ID as the authoritative identity that later composition should use.

Candidate seams:

- [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L527)
- [src/lib/media/browser-runtime/job-snapshots.ts](../../../../../src/lib/media/browser-runtime/job-snapshots.ts#L1)

### 6.3 Strict Invalid-Plan Rejection

Add explicit invalid-plan handling so unresolved placeholder handles cannot silently flow into:

1. browser FFmpeg execution
2. deferred reroute requests
3. recovery snapshots after refresh

### 6.4 Import And Replay Identity Preservation

Ensure portability and replay continue to preserve canonical IDs so imported media can be recomposed without title lookup or heuristic rebinding.

Candidate seams:

- [src/lib/chat/conversation-portability.ts](../../../../../src/lib/chat/conversation-portability.ts#L1)
- [src/core/use-cases/ConversationInteractor.ts](../../../../../src/core/use-cases/ConversationInteractor.ts#L1)

---

## 7. Required Tests

1. A compose plan with placeholder asset handles is canonicalized to governed `uf_*` asset IDs before execution.
2. A compose plan with unresolved handles fails explicitly before browser execution or deferred enqueue.
3. Browser recovery uses canonicalized clip IDs rather than original placeholder handles.
4. Deferred reroute receives canonical clip IDs even when the original compose message was drafted from provisional references.
5. Imported and replayed governed media can still form a valid canonical compose plan without transcript title matching.

Candidate tests:

- [src/core/use-cases/ConversationInteractor.test.ts](../../../../../src/core/use-cases/ConversationInteractor.test.ts#L820)
- [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx#L1)
- [src/lib/jobs/compose-media-deferred-job.test.ts](../../../../../src/lib/jobs/compose-media-deferred-job.test.ts#L1)

---

## 8. Exit Criteria

1. No executable or queued `compose_media` plan can be observed with unresolved placeholder clip references.
2. Browser recovery and deferred enqueue both consume the same canonicalized plan shape.
3. Incident reconstruction can distinguish identity-binding failure from readiness failure and execution-target failure.
4. The runtime no longer depends on card-local placeholder IDs surviving into later turns.
