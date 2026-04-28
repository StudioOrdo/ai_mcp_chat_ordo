# Phase 1: Truth-Bound Presentation

**Status:** Revised After Phase 0 Canonicalization And Phase 2 Readiness Wiring  
**Objective:** Make assistant prose, transcript-visible job snapshots, and media cards strict consumers of canonical runtime truth, including asset-readiness truth inherited from Phase 2.

---

## 1. Why This Phase Exists

The original incident was not only a renderer failure. It was a truth failure.

Users could be shown language or UI that implied a completed, playable media result while the actual runtime state was one of the following:

1. a fresh asset was still unresolved
2. composition had only started locally
3. browser fallback had been requested but not yet completed server-side
4. no durable governed artifact existed yet

Phase 0 established the canonical lifecycle vocabulary and normalization seam. Phase 2 tightened the underlying asset-readiness contract so composition cannot honestly be described as complete when prerequisite assets are still unresolved. Phase 1 is where those two foundations become user-visible truth rules.

This phase is complete only when the presentation layer becomes incapable of outrunning runtime reality.

---

## 2. Verified Current Architecture

The Phase 1 implementation must align with the code that already exists today.

### 2.1 Canonical Runtime Truth Already Exists

The codebase now has a canonical media lifecycle model and normalization seam:

1. conceptual lifecycle and failure stages are typed in [src/core/entities/media-runtime-state.ts](../../../../../src/core/entities/media-runtime-state.ts#L1)
2. browser, deferred, and persisted runtime authorities are normalized in [src/lib/media/browser-runtime/media-runtime-normalization.ts](../../../../../src/lib/media/browser-runtime/media-runtime-normalization.ts#L1)
3. browser-originated transcript snapshots are constructed in [src/lib/media/browser-runtime/job-snapshots.ts](../../../../../src/lib/media/browser-runtime/job-snapshots.ts#L1)
4. deferred job publication now emits the same lifecycle and failure metadata in [src/lib/jobs/job-status.ts](../../../../../src/lib/jobs/job-status.ts#L1)
5. deferred envelopes and replay paths preserve that metadata in [src/lib/jobs/deferred-job-result.ts](../../../../../src/lib/jobs/deferred-job-result.ts#L1), [src/adapters/chat/EventParserStrategy.ts](../../../../../src/adapters/chat/EventParserStrategy.ts#L1), and [src/lib/chat/conversation-portability.ts](../../../../../src/lib/chat/conversation-portability.ts#L1)

Phase 1 must consume those authorities. It is non-compliant for presenter or card code to invent a parallel media status model.

### 2.2 Presenter And Registry Flow

The current transcript-to-UI flow already has the correct broad shape:

1. [src/adapters/ChatPresenter.ts](../../../../../src/adapters/ChatPresenter.ts#L883) prioritizes `job_status` parts and projects result envelopes for tool rendering
2. deferred job snapshots embedded inside tool results are normalized through `extractJobStatusSnapshots()` before rendering
3. the default tool registry routes `compose_media` into [src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx](../../../../../src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx#L1) through the `media_render` card kind in [src/frameworks/ui/chat/registry/default-tool-registry.ts](../../../../../src/frameworks/ui/chat/registry/default-tool-registry.ts#L1)

That means the system already has a natural presentation seam. Phase 1 should strengthen it, not replace it.

### 2.3 Current Media Card Reality

The existing cards are uneven:

1. [src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx](../../../../../src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx#L121) is already mostly truth-bound because it renders from the projected result envelope, shows a placeholder when no video artifact exists, and only enables playback controls after the browser confirms readiness
2. [src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx](../../../../../src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx#L51) still relies on the raw `generate_audio` payload shape and `generationStatus`, rather than a fully normalized media-runtime view model

Phase 1 must treat that difference as an explicit implementation gap. The doc cannot pretend the card layer is already uniformly normalized.

### 2.4 Phase 2 Changes Presentation Must Honor

Phase 2 is not just a backend preflight concern. It changes what the UI is allowed to claim.

Presentation must now respect these truths:

1. if a fresh requested asset is still unresolved, the correct user-facing state is waiting or blocked, not success
2. if composition is paused behind asset readiness, the UI must say so explicitly rather than implying rendering progress on a finished artifact
3. if readiness fails closed, the surfaced reason must identify the correct stage such as `asset_generation` or `composition_preflight`
4. if browser execution requests fallback, the UI may describe rerouting or server recovery, but not completion

---

## 3. Phase 1 Scope

This phase governs all user-visible presentation surfaces for media generation and composition:

1. assistant prose that references media completion or availability
2. transcript-visible `job_status` cards and inline summaries
3. tool-specific media cards for `compose_media` and `generate_audio`
4. replay, refresh, and portability rendering of historical media state

This phase does not create new orchestration behavior by itself. It constrains what the presentation layer may say and render based on canonical runtime truth.

---

## 4. Presentation Invariants

The following rules are mandatory.

1. No success language is allowed without durable governed artifact truth.
2. No playable media UI is allowed unless the result envelope exposes a usable artifact reference and the client-side player has reached a ready state.
3. `client_fetch_pending` and any lifecycle state derived from unresolved fresh assets must render as pending or blocked, never ready.
4. `compose_fallback_required` is a recovery state, not a success state.
5. `compose_queued_deferred` and `compose_running_deferred` must be rendered as server-side continuation states, not browser-local continuation states.
6. Presenter and card code may format canonical state for humans, but may not infer completion from intent, tool name, clip count, route, or optimistic assumptions.
7. Historical or partial payloads must normalize into safe degraded states rather than letting cards guess.

---

## 5. Canonical Truth Contract By Lifecycle Phase

Phase 1 must render the canonical lifecycle vocabulary from Phase 0 and the readiness constraints from Phase 2 with bounded user-facing meaning.

### 5.1 Generation States

#### `pending_local_generation`

Meaning:

1. a requested asset is still being produced or fetched into durable storage
2. no durable reusable asset is available yet

Presentation requirements:

1. allowed copy: waiting for audio, generating audio, preparing asset, fetching generated asset
2. forbidden copy: ready, completed, playable, attached, available for composition
3. audio cards must show pending generation explicitly when `assetId` is still null

#### `durable_asset_available`

Meaning:

1. a governed durable asset now exists
2. composition has not necessarily started

Presentation requirements:

1. allowed copy: audio ready, asset available, ready for composition
2. forbidden copy: final video ready unless `compose_succeeded` is also true for the latest compose operation

### 5.2 Composition States

#### `compose_queued_local`

Meaning:

1. local browser composition has been accepted and queued
2. no final artifact truth exists yet

Presentation requirements:

1. render as queued local processing
2. do not show a final player

#### `compose_running_local`

Meaning:

1. local browser composition is actively running
2. progress may be shown if canonical progress exists

Presentation requirements:

1. render progress honestly from envelope progress or normalized job progress
2. do not imply upload completion, playback readiness, or final artifact availability

#### `compose_fallback_required`

Meaning:

1. local execution could not complete as intended
2. fallback or recovery is required
3. server execution is not yet proven complete

Presentation requirements:

1. allowed copy: switching to server recovery, rerouting composition, local render could not finish
2. forbidden copy: queued on server unless a real deferred enqueue has occurred and the lifecycle moved to `compose_queued_deferred`
3. if failure metadata exists, surface the correct bounded reason

#### `compose_queued_deferred`

Meaning:

1. deferred server execution is now the active authority
2. the handoff succeeded, but rendering has not completed

Presentation requirements:

1. render as queued on server or queued for deferred processing
2. do not render as a browser-local queue state

#### `compose_running_deferred`

Meaning:

1. server-side composition is in flight
2. completion is still pending

Presentation requirements:

1. allowed copy: rendering on server, processing on server, finishing composition remotely
2. forbidden copy: your video is ready

#### `compose_succeeded`

Meaning:

1. a final durable artifact exists
2. transcript-visible artifact metadata is present

Presentation requirements:

1. success copy is allowed only in this state
2. cards may render a player only when an actual video artifact reference exists
3. playback controls must remain gated until the browser confirms the player can load the artifact

#### `compose_failed_terminal`

Meaning:

1. composition ended in a truthful terminal failure
2. the surfaced failure should identify the right stage and class when known

Presentation requirements:

1. show explicit failure state, not a silent placeholder
2. prefer bounded reasons over generic failure prose
3. expose the route or stage only when it clarifies the failure without fabricating certainty

### 5.3 Failure Stage Mapping

When failure metadata exists, presentation should map it to human language without losing the underlying truth.

Required examples:

1. `asset_generation`: waiting for or failed to finalize a requested source asset
2. `composition_preflight`: asset readiness or clip validation blocked composition
3. `local_execution`: browser-side composition failed or was interrupted
4. `playback_verification`: output existed but playback readiness verification did not complete cleanly
5. `deferred_enqueue`: reroute was needed but the server job could not be queued
6. `deferred_execution`: the server job ran and failed remotely
7. `recovery`: a rehydration or continuation path could not recover safely

The presentation layer may humanize these values, but it must not collapse distinct stages into generic success-or-failure wording when the precise truth is available.

---

## 6. Required Deliverables

### 6.1 Presenter Guardrails

The presenter layer must enforce all media truth rules before cards or prose render.

Required behavior:

1. treat `job_status` parts and normalized result envelopes as the primary presentation authority
2. preserve lifecycle, failure code, and failure stage through replay and embedded deferred-status payloads
3. never let assistant prose imply completion when the latest canonical media state is pending, queued, running, or fallback-required
4. ensure empty assistant text still renders truthful media job-status cards when that is the only reliable output

### 6.2 Card Contract Cleanup

Media cards must render from a normalized view model derived from canonical runtime state, not from ad hoc payload inference.

Required normalized presentation states:

1. waiting for fresh asset generation
2. asset durable and reusable
3. local compose queued or running
4. fallback required
5. deferred compose queued or running
6. success with durable artifact
7. terminal failure with bounded reason

Implementation note:

1. `MediaRenderCard` is already close to this contract because it reads the result envelope directly
2. `AudioPlayerCard` is not yet there and should be moved toward the same normalized state model rather than continuing to depend on raw payload shape alone

### 6.3 Phase 2 Readiness Visibility

Asset-readiness truth must be visible in the UI.

Required behavior:

1. if composition is blocked on a fresh asset, the surfaced state must say waiting for asset readiness or equivalent
2. if preflight rejects a plan, the card or transcript summary must identify that as a readiness or validation failure, not a generic render failure
3. if an older reusable asset was explicitly selected and is valid, the UI may say composition is using an existing asset, but it must not imply a fresh asset completed when it did not

### 6.4 Replay And Portability Safety

Historical state must remain truthful after refresh, replay, or import.

Required behavior:

1. historical success states with durable artifacts still render as success
2. partial historical payloads normalize into safe degraded pending or unknown states
3. imported or replayed deferred job snapshots preserve lifecycle and failure metadata instead of regressing to generic queued or running language

---

## 7. Current Code Findings And Explicit Gaps

This section documents what the code already satisfies and what still needs tightening.

### 7.1 Already Satisfied Or Mostly Satisfied

1. canonical lifecycle and failure metadata now exist for both browser and deferred media states
2. `compose_media` job-status rendering already flows through a canonical result envelope into `MediaRenderCard`
3. `MediaRenderCard` refuses to show a video player when no video artifact is present
4. `MediaRenderCard` hides playback controls until `onLoadedData` or `onCanPlay` fires, which is aligned with truthful playback readiness
5. presenter flow already prefers transcript-visible job snapshots over raw optimistic tool output when snapshots are available

### 7.2 Gaps Phase 1 Should Close

1. `AudioPlayerCard` still treats raw payload shape as its primary truth source and should be aligned with the canonical media-runtime model
2. media presentation still lacks one explicit shared view-model layer for lifecycle-to-copy mapping, so truth semantics remain spread across presenter, card summary fields, and individual component logic
3. failure-stage-specific copy is not yet standardized across all media surfaces
4. the doc and tests should explicitly protect the distinction between `compose_fallback_required` and `compose_queued_deferred`, because those states now have different canonical meanings

---

## 8. Candidate File Changes

Update:

- [src/adapters/ChatPresenter.ts](../../../../../src/adapters/ChatPresenter.ts#L1)
- [src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx](../../../../../src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx#L1)
- [src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx](../../../../../src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx#L1)
- [src/frameworks/ui/chat/registry/default-tool-registry.ts](../../../../../src/frameworks/ui/chat/registry/default-tool-registry.ts#L1)
- [src/lib/media/browser-runtime/media-runtime-normalization.ts](../../../../../src/lib/media/browser-runtime/media-runtime-normalization.ts#L1)
- [src/lib/media/browser-runtime/job-snapshots.ts](../../../../../src/lib/media/browser-runtime/job-snapshots.ts#L1)
- [src/lib/jobs/job-status.ts](../../../../../src/lib/jobs/job-status.ts#L1)
- [src/lib/jobs/deferred-job-result.ts](../../../../../src/lib/jobs/deferred-job-result.ts#L1)
- [src/adapters/chat/EventParserStrategy.ts](../../../../../src/adapters/chat/EventParserStrategy.ts#L1)
- [src/lib/chat/conversation-portability.ts](../../../../../src/lib/chat/conversation-portability.ts#L1)

Add, if needed:

- `src/frameworks/ui/chat/plugins/custom/media-runtime-presentation.ts`
- `src/frameworks/ui/chat/plugins/custom/media-runtime-presentation.test.ts`
- `src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.test.tsx`
- `src/frameworks/ui/chat/plugins/custom/MediaRenderCard.test.tsx`
- `src/adapters/ChatPresenter.test.ts`

---

## 9. Verification Requirements

### 9.1 Positive Tests

1. `compose_succeeded` renders completion copy only when a durable video artifact exists
2. deferred queued and running states render queue or progress language rather than success language
3. fresh audio with `assetId = null` and pending generation renders as waiting for a durable asset
4. replayed successful conversations still render a usable player when the artifact envelope is intact

### 9.2 Negative Tests

1. `client_fetch_pending` never renders as ready media
2. `compose_fallback_required` never renders as already queued on the server unless the lifecycle has actually advanced to `compose_queued_deferred`
3. card components do not infer completion solely from tool name, requested clip count, route, or the existence of a non-terminal payload
4. missing artifact readiness data does not produce a playable card
5. a deferred failure with `failureStage = deferred_execution` does not collapse into generic browser failure language

### 9.3 Edge Tests

1. historical partial payloads normalize into safe degraded states without false success flashes
2. refresh or rehydration preserves in-progress copy rather than flipping between local and deferred semantics incorrectly
3. imported conversation snapshots preserve lifecycle and failure metadata across portability boundaries
4. playback verification delays keep controls hidden without making the card look terminally failed when the artifact is still loading

---

## 10. Exit Criteria

1. User-visible media completion claims are impossible without durable artifact truth.
2. The presenter and card layers consume canonical normalized media state rather than scattered raw inference.
3. Phase 2 asset-readiness truth is visible in media presentation and blocks false completion language.
4. Local, fallback-required, deferred, success, and terminal-failure media states render with clearly distinct semantics.
5. Replay, refresh, and portability preserve those semantics.
6. Presenter and UI tests fail immediately if any surface starts outrunning canonical runtime truth again.
