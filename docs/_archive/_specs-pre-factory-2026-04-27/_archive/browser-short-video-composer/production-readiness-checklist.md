# Browser Short Video Composer Production Readiness Checklist

**Status:** Canonical Progress Tracker
**Date:** 2026-04-20
**Purpose:** Track the clean-code, production-ready delivery path for the browser-short video composer in one place.

This is the canonical checklist for execution status, QA status, and release readiness.

## How To Use This File

Status markers:

- `[ ]` not started
- `[-]` in progress
- `[x]` complete
- `[!]` blocked or needs decision

Update rules:

1. Only mark a stage complete when its exit criteria and QA gate are both complete.
2. If implementation moves but QA is missing, leave the stage as `[-]`.
3. Record blockers directly in the stage that is blocked.
4. Treat this file as the single progress tracker for this feature track.

## Current Stage Summary

- Overall status: `[-] Active`
- Current stage: `[-] Stage 2 runtime-truth closure with Stage 3 contract alignment and Reliability Phase 7 and Phase 8 follow-through`
- Last updated by: `GitHub Copilot`
- Last updated date: `2026-04-20`

Current reality check:

- [x] The browser-short beat envelope is implemented at `1` to `5` image beats.
- [x] Prompt guidance has been updated to allow one-image-plus-audio browser-short explainers inside that envelope.
- [x] Burned-caption browser-short fallback to deferred server execution is covered by focused unit tests.
- [x] Focused unit coverage passed for the current beat-envelope and prompt-directive contract.
- [x] The live planner/browser eval is green on the managed Playwright path for a one-image `browser_short_explainer` request.
- [!] The latest passing live planner eval rendered via the server execution target, so browser-first live proof is still not complete.

## Reliability Phase Mapping

The final production-hardening stages in this checklist map directly to the cross-cutting reliability docs.

- Stage 6 maps to Phase 7: canonical asset identity and compose normalization.
- Stage 7 maps to Phase 8: storage-backed source rehydration and derivative continuity.
- Stage 8 maps to Phase 9: runtime resilience, worker availability, and deterministic fallback.
- Stage 9 maps to Phase 10: reliability operations, chaos coverage, and permanent gates.

Reference docs:

- `docs/_refactor/media/specs/media-composition-reliability-and-anti-drift/phase-7-canonical-asset-identity-and-compose-normalization.md`
- `docs/_refactor/media/specs/media-composition-reliability-and-anti-drift/phase-8-storage-backed-source-rehydration-and-derivative-continuity.md`
- `docs/_refactor/media/specs/media-composition-reliability-and-anti-drift/phase-9-runtime-resilience-worker-availability-and-deterministic-fallback.md`
- `docs/_refactor/media/specs/media-composition-reliability-and-anti-drift/phase-10-reliability-operations-chaos-coverage-and-permanent-gates.md`

## Global Release Conditions

Do not mark this feature production ready until all of the following are true.

- [ ] The browser-short product contract is locked and matches the shipped runtime behavior.
- [ ] The public tool and schema surface contain no dead or misleading branches.
- [ ] The browser happy path succeeds reliably inside the supported envelope.
- [ ] Truthful fallback behavior is implemented and verified for unsupported or capability-blocked cases.
- [ ] Subtitle behavior matches the public contract.
- [ ] Governed asset reuse and source lineage remain stable across compose, replay, and refresh.
- [ ] Runtime-integrity and release evidence cover the final failure matrix.

---

## Stage 0: Lock The Product Contract

**Goal:** Freeze the product definition before more implementation drift lands.

Implementation checklist:

- [x] Confirm `browser_short_explainer` as the primary production mode.
- [x] Confirm browser-first execution as the default operating model.
- [x] Confirm defaults-plus-overrides as the agent-facing contract.
- [x] Confirm first-release scope cuts for dead or unsupported options.
- [x] Resolve the contract mismatch between spec-level server fallback language and the current burned-caption browser-only runtime path.
- [ ] Publish the final canonical browser-short contract as implementation truth.

QA gate:

- [ ] Review the final contract against current runtime behavior.
- [ ] Verify the contract does not promise unsupported subtitle, fallback, or editing behavior.
- [ ] Verify all linked docs in this folder point to the same product shape.

Exit criteria:

- [ ] One approved browser-short contract exists.
- [ ] No spec document promises behavior the runtime explicitly rejects.

## Stage 1: Remove Dead And Misleading Surface Area

**Goal:** Make the public feature surface look exactly like the product that is being shipped.

Implementation checklist:

- [x] Remove `waveformPolicy` from the active plan entity.
- [x] Narrow subtitle policy to the supported release modes.
- [ ] Remove remaining compatibility-only branches that are not part of the browser-short release path.
- [ ] Clean up old fixtures, docs, and prompts that still reference removed contract fields.
- [ ] Audit schema, prompts, tests, and replay snapshots for stale media options.

QA gate:

- [ ] Search the repo for removed contract fields and confirm only intentional compatibility seams remain.
- [ ] Verify browser UI proof tests no longer use stale fixture fields.
- [ ] Verify prompt guidance and tool descriptions align with the reduced contract.

Exit criteria:

- [ ] No dead public media fields remain in the release surface.
- [ ] Tests and docs reflect the current contract rather than historical behavior.

## Stage 2: Make Browser Routing And Fallback Truthful

**Goal:** Ensure supported work stays on the client and unsupported work fails or reroutes honestly.

Implementation checklist:

- [x] Enforce a narrow browser-short execution envelope.
- [x] Keep the browser happy path optimized for short explainers.
- [x] Classify worker health failures into specific operational categories.
- [x] Add deterministic server fallback for worker-unreachable and worker-unhealthy cases where parity exists.
- [x] Decide and implement the burned-caption fallback rule for `browser_short_explainer`.
- [ ] Make browser capability failures, oversized plans, and unsupported plans surface truthful final states.
- [ ] Ensure fallback decisions preserve structured failure metadata end to end.

Active note:

- The next implementation slice still starts here, but it has narrowed again: the contract-level one-image browser-short mismatch is fixed, burned-caption reroute is test-backed, and the live planner eval is green. The remaining high-value gap is truthful live execution-target selection and end-to-end failure surfacing under real runtime conditions.

QA gate:

- [ ] Unit test browser routing thresholds.
- [ ] Unit test capability-blocked fallback behavior.
- [ ] Integration test worker-unreachable fallback.
- [ ] Integration test worker-unhealthy fallback.
- [ ] Integration test the burned-caption browser-short path in both browser-available and browser-unavailable conditions.
- [ ] Verify user-visible status, failure codes, and progress updates remain truthful.

Exit criteria:

- [ ] Browser routing and runtime behavior match the written contract.
- [ ] Fallback behavior is deterministic, truthful, and test-backed.

## Stage 3: Standardize The Browser-Short Composition Model

**Goal:** Make the core product path explicit instead of relying on generic clip-mixing assumptions.

Implementation checklist:

- [x] Enforce the current 1 to 5 visual beat envelope for `browser_short_explainer`.
- [x] Enforce one narration track.
- [x] Enforce the current narrow browser-short plan constraints.
- [ ] Decide whether the current `visualClips` plus `beatOrder` model is sufficient or replace it with a first-class storyboard model.
- [ ] Finalize the canonical beat types for title, hook, lesson card, chart, graph, and takeaway.
- [ ] Ensure the plan surface expresses the intended browser-short composition model clearly.

QA gate:

- [ ] Validate that agent intent can produce a finished browser-short plan without manual asset wrangling.
- [ ] Validate that the plan model stays stable through replay and refresh.
- [ ] Validate that asset ordering, pacing, and narration constraints behave predictably.

Exit criteria:

- [ ] The core composition model is explicit, documented, and stable.
- [ ] The common path no longer depends on ambiguous generic-editing assumptions.

Active note:

- Stage 3 is no longer blocked on the old `3 to 5` beat contract. The remaining Stage 3 work is composition-model clarity, not planner acceptance of single-image browser-short requests.

## Stage 4: Standardize Visual Card Rendering

**Goal:** Make charts, graphs, and title cards video-safe, legible, and reusable.

Implementation checklist:

- [x] Materialize chart and graph sources into stable visual assets before composition.
- [ ] Define one visual card design contract for title cards, chart cards, and graph cards.
- [ ] Standardize safe areas, typography, spacing, footer treatment, and subtitle-safe regions.
- [ ] Ensure the browser composer consumes prepared visual cards rather than renderer-specific raw formats.
- [ ] Verify branded cards are readable in vertical mobile playback.

QA gate:

- [ ] Browser proof test chart-card composition.
- [ ] Browser proof test graph-card composition.
- [ ] Browser proof test title-card readability.
- [ ] Visual regression or screenshot evidence exists for the final card contract.

Exit criteria:

- [ ] All supported visual beats use one stable card system.
- [ ] Visual legibility is proven for the target mobile playback shape.

## Stage 5: Implement Burned Subtitles Properly

**Goal:** Make burned subtitles a complete supported feature rather than a partial promise.

Implementation checklist:

- [x] Support burned subtitle policy in the active browser-short path.
- [ ] Decide whether release 1 subtitle behavior is text-overlay-per-beat or narration-timed caption cues.
- [ ] If narration-timed captions are required, implement subtitle timing generation in the active pipeline.
- [ ] Ensure server fallback, if supported, preserves the same subtitle contract.
- [ ] Remove any public subtitle claims that exceed the shipped implementation.

QA gate:

- [ ] Unit test subtitle text derivation rules.
- [ ] Integration test browser subtitle rendering.
- [ ] If server fallback remains allowed, integration test subtitle parity between browser and server paths.
- [ ] Verify subtitle readability on mobile-sized output.

Exit criteria:

- [ ] Subtitle behavior is deterministic and clearly documented.
- [ ] The public subtitle contract exactly matches shipped behavior.

## Stage 6: Reliability Phase 7, Canonical Asset Identity And Compose Normalization

**Goal:** Ensure every executable or queued compose plan converges on governed canonical asset IDs before execution begins.

Implementation checklist:

- [x] Canonicalize governed asset identity for compose plans.
- [x] Reject unresolved or invalid asset references with explicit failures.
- [ ] Ensure browser execution startup consumes only canonical plan state.
- [ ] Ensure deferred enqueue consumes only canonical plan state.
- [ ] Ensure replay and recovery never reconstruct unresolved placeholder handles as execution truth.
- [ ] Ensure transcript-visible snapshots expose governed asset identity as the authoritative compose reference.

QA gate:

- [ ] Test asset reuse from the same conversation.
- [ ] Test asset reuse from a prior conversation with governed identity.
- [ ] Test invalid alias or placeholder references fail with `invalid_plan` or equivalent explicit failures.
- [ ] Test browser recovery uses canonical clip IDs rather than original placeholder handles.
- [ ] Test deferred reroute receives canonical clip IDs even when the original compose message was drafted from provisional references.

Exit criteria:

- [ ] No executable or queued compose plan can be observed with unresolved placeholder clip references.
- [ ] Browser recovery and deferred enqueue both consume the same canonicalized plan shape.

## Stage 7: Reliability Phase 8, Storage-Backed Source Rehydration And Derivative Continuity

**Goal:** Make governed source storage the primary authority for chart and graph rehydration in both browser and server paths.

Implementation checklist:

- [x] Rehydrate governed chart and graph sources from storage-backed records.
- [x] Preserve derivative lineage checks for recomposition.
- [x] Preserve structured source-rehydration and preflight failures through deferred execution.
- [ ] Ensure transcript payload lookup is only a non-authoritative compatibility path.
- [ ] Align browser and server derivation around the same source retrieval and lineage contract.
- [ ] Verify recovery and recomposition do not depend on transcript-local source payloads when governed source exists.

QA gate:

- [ ] Test browser chart recovery from governed source storage without transcript-local tool payloads.
- [ ] Test browser graph recovery from governed source storage without transcript-local tool payloads.
- [ ] Test browser and server derivation preserve equivalent lineage metadata.
- [ ] Test governed source retrieval failures remain distinct from transcript-local lookup failures.
- [ ] Test imported governed source assets can be rediscovered and rederived without transcript title matching.

Exit criteria:

- [ ] Chart and graph recomposition no longer require transcript-local source lookup when governed source assets exist.
- [ ] Browser and server derivation both operate from the same governed-source authority model.

## Stage 8: Reliability Phase 9, Runtime Resilience, Worker Availability, And Deterministic Fallback

**Goal:** Make execution-target availability explicit and ensure reroute paths degrade deterministically instead of failing opaquely.

Implementation checklist:

- [x] Classify worker health failures into explicit operational categories.
- [x] Add deterministic server fallback for worker-unreachable and worker-unhealthy cases where parity exists.
- [ ] Expose execution-target availability in diagnostics and operator-facing health surfaces.
- [ ] Define and document the deterministic route chain for `compose_media`.
- [x] Decide and implement the burned-caption fallback rule for `browser_short_explainer` so the runtime contract is explicit.
- [ ] Ensure in-process and worker-backed server execution preserve the same canonical result and failure semantics.

QA gate:

- [ ] Test a down worker produces `worker_unreachable` or equivalent instead of opaque transport failure.
- [ ] Test a healthy worker path still returns canonical deferred results.
- [ ] Test in-process fallback preserves envelope, artifact, and failure semantics when enabled.
- [ ] Test browser reroute chooses the correct next route based on actual target availability.
- [ ] Verify diagnostics and evidence expose current worker posture and failure class truthfully.

Exit criteria:

- [ ] No media reroute path fails with opaque transport-only messaging when a more specific failure class is available.
- [ ] Execution-target availability is visible in diagnostics and test evidence.
- [ ] Worker unavailability no longer creates an avoidable single point of failure for composition recovery.

## Stage 9: Reliability Phase 10, Reliability Operations, Chaos Coverage, And Permanent Gates

**Goal:** Turn the Phase 7 through 9 contracts into permanent scenario-driven gates, runbooks, and anti-drift rules.

Implementation checklist:

- [ ] Expand the runtime-integrity matrix to explicitly cover the browser-short production contract.
- [ ] Add explicit evidence for unresolved placeholder asset IDs.
- [ ] Add explicit evidence for governed source present but transcript-local tool result absent.
- [ ] Add explicit evidence for browser interruption before completion.
- [ ] Add explicit evidence for worker unavailable during reroute.
- [ ] Add explicit evidence for canonical worker execution failure.
- [ ] Add explicit evidence for derivative lineage mismatch.
- [ ] Add explicit evidence for imported governed media reused in later composition.
- [ ] Add explicit evidence for startup reconciliation after refresh during active media work.
- [ ] Add or update runbooks for identity failure, source rehydration failure, worker availability failure, and execution failure.
- [ ] Add anti-drift contribution rules for future media changes.

QA gate:

- [ ] Failure-injection tests cover every required Phase 10 scenario.
- [ ] Runtime-integrity evidence records those scenarios explicitly.
- [ ] Release gating fails when any reliability scenario regresses.
- [ ] Operator guidance, tests, and release evidence use the same scenario vocabulary.

Exit criteria:

- [ ] Media reliability failures are blocked by permanent gates rather than rediscovered in production-like usage.
- [ ] Operator guidance, automated tests, and release evidence all describe the same reliability model.
- [ ] Future media changes have an anti-drift checklist anchored in real observed failure modes.

## Cross-Cutting Maintainability Track

**Goal:** Reduce orchestration sprawl without changing the production contract.

Implementation checklist:

- [ ] Break apart `useBrowserCapabilityRuntime.ts` into smaller planning, materialization, fallback, and finalization units.
- [ ] Extract shared card-shell logic where chart and graph handling duplicate the same behavior.
- [ ] Normalize result payloads and replay snapshots across media generation and composition paths.
- [ ] Reduce ad hoc state reconstruction in browser runtime consumers.

QA gate:

- [ ] Unit test extracted orchestration helpers.
- [ ] Verify refactor does not change visible progress or failure semantics.
- [ ] Verify replay, refresh, and deferred completion still hydrate the same final state.

Exit criteria:

- [ ] Browser media orchestration is modular and easier to reason about.
- [ ] The refactor does not introduce behavior drift.

---

## Open Blockers To Track Here

- [!] Browser proof fixtures still include some legacy contract drift and should be cleaned up before final release signoff.
- [!] The latest live planner eval proves planner-to-video completion, but it currently exercises the server execution target rather than proving browser-first execution in the same scenario.

## Next Work Session

Start the next work session with this workstream:

1. stabilize truthful browser-short routing and fallback semantics, especially for burned-caption capability-blocked cases
2. prove the intended execution-target selection for live one-image `browser_short_explainer` runs and capture that evidence explicitly
3. update this checklist from observed evidence after that target-selection proof, not from intended behavior

## Recommended Update Cadence

Update this file when any of the following happens.

1. A stage changes from `[ ]` to `[-]` or from `[-]` to `[x]`.
2. A blocker is discovered or resolved.
3. A QA gate starts passing or failing.
4. The written product contract changes.
5. Release evidence is added or updated.