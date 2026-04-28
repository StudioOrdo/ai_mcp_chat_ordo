# Phase 0: Foundation And Canonical State Model

**Objective:** Establish one canonical state model for media generation and composition before changing behavior.

---

## Why This Phase Exists

The current failure mode is partly caused by state ambiguity. Different layers understand media progress differently:

- tool payloads can be pending
- browser runtime snapshots can be queued or running
- cards can imply availability
- assistant prose can imply completion
- deferred jobs can exist or not exist independently of the above

Phase 0 creates one shared vocabulary and one enforced set of transitions so later phases are reducing ambiguity instead of moving it around.

This phase must align to the existing system authorities rather than invent a parallel runtime model. Today, the codebase already has three real state surfaces:

1. browser capability execution statuses in [src/core/entities/browser-capability.ts](../../../../../src/core/entities/browser-capability.ts#L1)
2. transcript-visible job snapshot statuses in [src/core/entities/job.ts](../../../../../src/core/entities/job.ts#L1) and [src/core/entities/message-parts.ts](../../../../../src/core/entities/message-parts.ts#L15)
3. persisted in-browser recovery state in [src/lib/media/browser-runtime/browser-runtime-state.ts](../../../../../src/lib/media/browser-runtime/browser-runtime-state.ts#L1)

Phase 0 is complete only if it unifies those surfaces through one mapping and normalization strategy. It is non-compliant to introduce a second standalone string enum that duplicates those contracts.

---

## Scope

1. Define canonical media lifecycle states for generated assets and composed outputs.
2. Define which fields are required for each state.
3. Define valid transitions between states.
4. Define which runtime layer is allowed to mutate which parts of the state.
5. Remove or deprecate ambiguous status combinations where feasible.
6. Define a single mapping between browser execution status, transcript-visible job status, and persisted recovery state.
7. Normalize legacy and partial payloads centrally instead of leaving fallback inference in presenter or hook code.

---

## Required Deliverables

### 0.1 Canonical Lifecycle Model

Introduce or formalize a lifecycle model that covers at minimum these conceptual phases:

1. `pending_local_generation`
2. `durable_asset_available`
3. `compose_queued_local`
4. `compose_running_local`
5. `compose_fallback_required`
6. `compose_queued_deferred`
7. `compose_running_deferred`
8. `compose_succeeded`
9. `compose_failed_terminal`

These are conceptual phases, not a replacement runtime enum.

Implementation requirement:

1. reuse the existing browser execution authority in [src/core/entities/browser-capability.ts](../../../../../src/core/entities/browser-capability.ts#L1)
2. reuse the existing transcript-visible job status authority in [src/core/entities/job.ts](../../../../../src/core/entities/job.ts#L1)
3. reuse the persisted recovery authority in [src/lib/media/browser-runtime/browser-runtime-state.ts](../../../../../src/lib/media/browser-runtime/browser-runtime-state.ts#L1)
4. add a typed normalization or state-machine layer that maps these existing authorities into the conceptual phases above

This can be represented as discriminated unions, typed status helpers, or equivalent strongly-checked structures. It must not remain an informal combination of string fields across unrelated files, and it must not create a dead-code enum that no production path actually consumes.

Required mapping coverage:

1. `BrowserCapabilityExecutionStatus`
2. `JobStatusMessagePart.status`
3. `PersistedBrowserRuntimeStatus`
4. terminal success envelopes from browser and deferred execution
5. terminal failure metadata including failure code, stage, and recovery outcome

### 0.2 State Mutation Authority

Document and enforce who can mutate what:

1. tool executors may create initial pending payloads
2. browser runtime may advance local states and request fallback
3. `/api/chat/jobs` may create deferred states
4. deferred worker may produce terminal success or failure
5. presenter and card layers may not invent state transitions

Required code-level ownership boundaries:

1. `executeComposeMedia()` and `GenerateAudioCommand.execute()` may emit initial pending payloads, but not terminal completion claims
2. `buildBrowserRuntimeJobStatusPart()` is the canonical browser-to-transcript snapshot constructor and must not be bypassed by ad hoc snapshot objects
3. browser recovery planning in [src/lib/media/browser-runtime/browser-capability-runtime.ts](../../../../../src/lib/media/browser-runtime/browser-capability-runtime.ts#L1) may request fallback or interruption states, but Phase 0 must define how those requests normalize into transcript-safe job status parts
4. persisted browser recovery entries in [src/lib/media/browser-runtime/browser-runtime-state.ts](../../../../../src/lib/media/browser-runtime/browser-runtime-state.ts#L1) must remain minimal recovery state, not a second artifact-truth store
5. presenter and card layers are read-only consumers of normalized state

### 0.3 Canonical Envelope Requirements

For each terminal success state, require:

1. `primaryAssetId`
2. artifact list with durable governed handle
3. artifact kind and mime type
4. source route metadata

For each terminal failure state, require:

1. explicit failure reason code
2. failure stage
3. recovery attempted or not attempted

Normalization requirement:

1. all transcript-visible media success or failure states must flow through a canonical envelope or normalized snapshot shape before reaching presentation code
2. legacy payloads and partial historic message data must normalize centrally in one seam instead of scattering fallback logic through cards, presenters, and hooks

### 0.4 Persistence And Recovery Contract

Phase 0 must define exactly how local runtime persistence relates to canonical state.

Required behavior:

1. persisted browser runtime entries remain limited to resumable local execution metadata such as job ID, tool name, conversation ID, and queued or running status
2. persisted browser runtime entries must never be treated as proof of success, durable artifact existence, or final user-visible completion
3. on rehydration, persisted entries must be normalized into explicit reconcile, resume, or cleanup actions through the browser runtime planner
4. cleanup rules for terminal snapshots and stale persisted entries must be documented and test-backed

### 0.5 Legacy Normalization Contract

Because the current system already has historical messages and mixed payload shapes, Phase 0 must document how older data is normalized.

Required behavior:

1. historical `tool_result` payloads with no terminal envelope must normalize into pending or legacy-safe states
2. historical successful snapshots with durable artifact metadata must normalize into terminal success without presenter inference
3. normalization must be pure and deterministic so replay, refresh, and portability paths see the same state interpretation

---

## Candidate File Changes

Update:

- [src/core/entities/browser-capability.ts](../../../../../src/core/entities/browser-capability.ts#L1)
- [src/core/entities/job.ts](../../../../../src/core/entities/job.ts#L1)
- [src/core/entities/message-parts.ts](../../../../../src/core/entities/message-parts.ts#L15)
- [src/lib/media/browser-runtime/job-snapshots.ts](../../../../../src/lib/media/browser-runtime/job-snapshots.ts#L1)
- [src/lib/media/browser-runtime/browser-capability-runtime.ts](../../../../../src/lib/media/browser-runtime/browser-capability-runtime.ts#L1)
- [src/lib/media/browser-runtime/browser-runtime-state.ts](../../../../../src/lib/media/browser-runtime/browser-runtime-state.ts#L1)
- [src/core/use-cases/tools/compose-media.tool.ts](../../../../../src/core/use-cases/tools/compose-media.tool.ts#L1)
- [src/core/use-cases/tools/UiTools.ts](../../../../../src/core/use-cases/tools/UiTools.ts#L90)

Add, if needed:

- `src/core/entities/media-runtime-state.ts`
- `src/lib/media/browser-runtime/media-runtime-state-machine.ts`
- `src/lib/media/browser-runtime/media-runtime-normalization.ts`
- `src/lib/media/browser-runtime/media-runtime-normalization.test.ts`

---

## Positive Tests

1. Valid state transitions advance exactly as expected from pending to success.
2. Browser-originated successful composition produces a terminal success state with canonical artifact metadata.
3. Deferred-originated successful composition produces the same terminal success contract.
4. Existing browser execution statuses normalize deterministically into transcript-visible job states and conceptual lifecycle phases.
5. Persisted queued or running local entries rehydrate into explicit planner decisions without implying terminal success.

## Negative Tests

1. Presenter code cannot mark pending payloads as terminal success.
2. Local runtime cannot transition directly from pending to success without durable artifact metadata.
3. Deferred enqueue cannot skip directly to succeeded without worker output.
4. A new ad hoc status string introduced outside the canonical normalization seam fails type or test checks.
5. Persisted browser runtime entries cannot by themselves produce terminal success state.

## Edge Tests

1. Rehydrated browser state from storage remains valid after page reload.
2. Historical messages missing newer fields normalize into explicit legacy-compatible states rather than ad hoc fallback logic.
3. Duplicate transition attempts are idempotent.
4. Mixed old `tool_result` payloads and newer `job_status` snapshots normalize to the same user-visible state.
5. Stale persisted queued or running entries are cleaned up predictably when terminal snapshots already exist.

---

## Exit Criteria

1. One lifecycle vocabulary exists and is test-backed.
2. State ownership is explicit in code and docs.
3. Ambiguous combinations that previously allowed truth drift are either removed or normalized centrally.
4. The lifecycle model is explicitly mapped onto existing browser execution, transcript job-status, and persisted recovery contracts.
5. No new unused or duplicate status enum is introduced just to satisfy documentation language.
