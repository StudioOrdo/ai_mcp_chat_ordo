# Media Traceability Map

**Last audited against codebase: 2026-04-27**

> File existence and test coverage have been verified by direct codebase inspection. Corrections from the prior version are marked ⚠️.

## Purpose

This document maps the rows in `media-combination-matrix.md` to the tests that currently justify each status.

Use it for two purposes:

1. verify that a row marked `Covered` is backed by a real executable spec
2. turn `Partial` and `Missing` rows into an implementation backlog without re-researching the repo

## Status Rules

| Status | Meaning |
|---|---|
| `Covered` | at least one executable test exercises the row in the intended layer |
| `Partial` | adjacent or indirect evidence exists, but not the exact end-to-end scenario claimed |
| `Missing` | no current test directly or indirectly exercises the row |

---

## Dimension A: Visual input type

| Key | Status | Existing evidence | Notes |
|---|---|---|---|
| `generated_image` | Covered | `tests/browser-ui/media-compose-eval.spec.ts`, `tests/browser-ui/media-live-workflows.spec.ts` | Workflow 1 covers generated image plus real TTS and validates playable, audible output. |
| `uploaded_image` | Covered | `tests/browser-ui/media-compose-eval.spec.ts`, `tests/browser-ui/media-live-workflows.spec.ts`, `tests/browser-ui/media-compose-planner-eval.spec.ts` | Workflow 2 covers uploaded still image. Planner eval covers attached image through the real chat/composer path. |
| `chart_rasterized` | Covered | `tests/browser-ui/media-live-workflows.spec.ts` | Workflow 3 verifies chart surface renders to a final video artifact. |
| `graph_rasterized` | Covered | `tests/browser-ui/media-live-workflows.spec.ts` | Workflow 4 verifies graph surface renders to a final video artifact. |
| `uploaded_video_pair` | Covered | `tests/browser-ui/media-compose-eval.spec.ts`, `tests/browser-ui/media-live-workflows.spec.ts` | Workflow 6 uploads two MP4 inputs and validates the concatenated output. |
| `prior_output_video` | Covered | `tests/browser-ui/media-live-workflows.spec.ts` | Workflow 5 reuses prior workflow outputs before validating the resulting artifact set. |
| `mixed_asset_reuse` | Partial | `src/lib/media/media-composition-asset-identity.test.ts`, `tests/browser-ui/media-compose-planner-eval.spec.ts` | Asset aliasing and governed lookup are covered at unit level. No browser test reuses prior chart, graph, and audio artifacts across turns in one golden path. |
| `blog_image_output` | Missing | none | `tests/browser-ui/deferred-blog-jobs.spec.ts` proves blog images are produced but no test feeds a `blogasset_*` ID back into `compose_media`. ⚠️ **This is now confirmed to be an active bug vector** — `validatePlanConstraints` does not reject `blogasset_*` IDs in audio clips. |

---

## Dimension B: Audio input type

| Key | Status | Existing evidence | Notes |
|---|---|---|---|
| `tts_generated` | Covered | `tests/browser-ui/media-compose-eval.spec.ts`, `tests/browser-ui/media-live-workflows.spec.ts` | Golden-path specs validate audible audio tracks for real composed outputs. |
| `uploaded_audio` | Partial | `tests/browser-ui/media-compose-planner-eval.spec.ts` | Planner eval uploads narration audio and asserts composed result, but this is planner-specific, not a broad matrix row. |
| `audio_none_expected` | Missing | none | No test intentionally composes a silent output and verifies absence of an audio track as the expected contract. |
| `tts_failed_then_retry` | Missing | none | `integrity-audio-recovery-deterministic` eval covers response behavior after TTS failure but is not a media-specific browser scenario for TTS → retry → compose. |
| `pending_audio_truthful` | Partial | `tests/browser-ui/ffmpeg-browser-runtime.spec.ts`, `tests/browser-ui/media-compose-planner-eval.spec.ts` | Browser-runtime verifies `client_fetch_pending` behavior. No explicit assertion that pending audio state is surfaced truthfully before compose completes. |

---

## Dimension C: Composition route

| Key | Status | Existing evidence | Notes |
|---|---|---|---|
| `browser_wasm_success` | Covered | `tests/browser-ui/media-compose-eval.spec.ts`, `tests/browser-ui/media-live-workflows.spec.ts` | Existing media lab specs validate the browser path end-to-end with playable artifacts and debug bundles. |
| `browser_wasm_fallback_to_deferred` | Covered | `tests/browser-ui/ffmpeg-browser-runtime.spec.ts` | Explicitly verifies fallback enqueues deferred recovery and rewrites card to queued server state. |
| `deferred_direct` | Missing | none | Current coverage proves generic deferred jobs and browser-triggered fallback, but not a first-class media scenario that starts directly on the deferred route without a browser attempt. |
| `native_process_target` | Partial | `src/lib/media/server/compose-media-worker-runtime.test.ts`, `src/lib/media/server/media-worker-http.test.ts` | Server-side remote pipeline is validated at Vitest level. No browser e2e proves runtime target selection and native execution together. ⚠️ **The media worker HTTP server is now auto-started by `dev.mjs`, but this is untested.** |

---

## Dimension D: Recovery interaction

| Key | Status | Existing evidence | Notes |
|---|---|---|---|
| `retry_from_admin_jobs` | Partial | `tests/browser-ui/admin-jobs.spec.ts` | Admin jobs UI proves retry controls are exposed for failed jobs, but seeded jobs are blog/content jobs rather than real media jobs. |
| `cancel_from_admin_jobs` | Partial | `tests/browser-ui/admin-jobs.spec.ts` | Admin jobs UI proves cancel controls are exposed, but not yet against a real media composition job. |
| `reload_resume` | Missing | none | Reload continuity is well-covered for deferred *blog* jobs (`deferred-blog-jobs.spec.ts`). No equivalent for media jobs. |
| `missed_sse_snapshot_recovery` | Missing | none | Adjacent coverage elsewhere, but no media-specific missed-event recovery spec. |
| `dedupe_same_plan` | Partial | `src/lib/jobs/compose-media-deferred-job.test.ts` | ⚠️ **Correction from prior version:** Deduplication IS tested at the Vitest level (the test `"reuses an existing active compose_media job"`). It is NOT tested at the browser/UI level. Status updated from Missing → Partial. |

---

## Dimension E: Output contract

| Key | Status | Existing evidence | Notes |
|---|---|---|---|
| `playable_video` | Covered | `tests/browser-ui/media-compose-eval.spec.ts`, `tests/browser-ui/media-compose-planner-eval.spec.ts` | Existing specs assert the rendered video element becomes playable and advances time. |
| `audible_audio_present` | Covered | `tests/browser-ui/media-compose-eval.spec.ts`, `tests/browser-ui/media-live-workflows.spec.ts` | Existing specs probe the downloaded media and reject silent audio tracks. |
| `manifest_written` | Covered | `tests/browser-ui/media-compose-eval.spec.ts`, `tests/browser-ui/media-live-workflows.spec.ts` | Specs persist debug summaries and manifest output in artifact directories. |
| `canonical_asset_identity` | Covered | `src/lib/media/media-composition-asset-identity.test.ts`, `src/lib/media/server/compose-media-worker-runtime.test.ts` | Canonical asset aliasing and final governed output IDs both asserted. |
| `continuity_reusable_asset` | Partial | `src/lib/media/media-composition-asset-identity.test.ts`, `tests/browser-ui/media-compose-planner-eval.spec.ts` | Governed media handles survive transcript boundaries, but full browser-level reuse loop is still missing. |

---

## New Gap: Pipeline Regression Bugs (from `conv_f5dd9a19`)

These gaps were **not** in the prior traceability map. They are confirmed missing after live session analysis:

| Bug | Gap | Evidence location |
|---|---|---|
| Retrograde job state rendering | No `sequence`-based sort test in `SystemJobCard.test.tsx` | Searched `src/frameworks/ui/chat/plugins/system/` |
| `admin_web_search` eager UFS crash | No test for `createExecutor({})` not throwing | Searched `runtime-tool-binding.test.ts` |
| `validatePlanConstraints` allows `blogasset_*` in audio clips | Lines 61–63 only check `kind`, not `assetId` prefix | `src/lib/media/ffmpeg/media-composition-plan.ts:61` |
| Media worker not started by `dev.mjs` | No static assertion in any test | Searched `tests/media-architecture-audit.test.ts` |
| `generate_audio` queue entry (integration) | `route.test.ts` mocks service; no real queue test | `src/app/api/runtime/generate-audio/route.test.ts` |

See `pipeline-regression-plan.md` for the implementation plan for these gaps.

---

## Backlog Ordered By Leverage

1. **Add pipeline regression tests** from `pipeline-regression-plan.md` — closes five confirmed gaps from live failure
2. Add one browser spec for real media-job retry and cancel from the admin jobs UI (clears two `Partial` recovery rows)
3. Add one browser spec for reload and missed-SSE recovery of an in-flight media job (closes continuity parity gap vs. blog jobs)
4. Add one browser spec for direct deferred-only media composition (upgrades `deferred_direct`)
5. Add one cross-turn reuse spec that composes from previously generated chart/graph/audio using governed handles

## Recommendation

When the matrix status changes, update this file in the same PR. The matrix states the claim; this file shows the evidence.
