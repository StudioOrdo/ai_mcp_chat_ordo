# Media Combination Matrix

**Last audited against codebase: 2026-04-27**

## Purpose

This matrix defines the minimum scenario space needed to claim comprehensive end-to-end media coverage.

The current repo already covers several combinations through the media lab and browser-runtime specs. This matrix formalizes what is covered, what is partial, and what is still missing.

---

## Dimension A: Visual input type

| Key | Description | Current status |
|---|---|---|
| `generated_image` | image produced by live image generation route | Covered |
| `uploaded_image` | user-uploaded still image | Covered |
| `chart_rasterized` | Mermaid chart rendered and rasterized to governed image | Covered |
| `graph_rasterized` | graph renderer output rasterized to governed image | Covered |
| `uploaded_video_pair` | two uploaded MP4 clips concatenated | Covered |
| `prior_output_video` | prior generated workflow outputs reused as inputs | Covered |
| `mixed_asset_reuse` | cross-turn reuse of prior chart/graph/audio artifacts in a new compose flow | Partial |
| `blog_image_output` | generated blog image reused in media composition | Missing ⚠️ **Active bug vector** — `validatePlanConstraints` does not reject `blogasset_*` IDs in audio clips |

---

## Dimension B: Audio input type

| Key | Description | Current status |
|---|---|---|
| `tts_generated` | generated narration from the TTS route | Covered |
| `uploaded_audio` | user-uploaded narration track | Partial |
| `audio_none_expected` | intentionally silent composition | Missing |
| `tts_failed_then_retry` | TTS generation fails, user retries, then compose succeeds | Missing |
| `pending_audio_truthful` | `client_fetch_pending` audio is handled truthfully before compose | Partial |

---

## Dimension C: Composition route

| Key | Description | Current status |
|---|---|---|
| `browser_wasm_success` | browser FFmpeg completes and uploads artifact | Covered |
| `browser_wasm_fallback_to_deferred` | browser path reroutes to deferred job | Covered |
| `deferred_direct` | direct deferred composition path without browser success first | Missing |
| `native_process_target` | native/server media target chosen and validated | Partial |

---

## Dimension D: Recovery interaction

| Key | Description | Current status |
|---|---|---|
| `retry_from_admin_jobs` | failed media job retried from admin jobs detail page | Partial |
| `cancel_from_admin_jobs` | running media job canceled from admin jobs detail page | Partial |
| `reload_resume` | active media job survives reload with coherent state | Missing |
| `missed_sse_snapshot_recovery` | completed media job recovered after event loss | Missing |
| `dedupe_same_plan` | repeated submit of same composition request reuses job | Partial ⚠️ **Correction** — deduplication is tested at Vitest level (`compose-media-deferred-job.test.ts`) but not at browser level |

---

## Dimension E: Output contract

| Key | Description | Current status |
|---|---|---|
| `playable_video` | video renders and advances currentTime | Covered |
| `audible_audio_present` | audio track exists and is non-silent | Covered |
| `manifest_written` | artifact manifest and debug summary written | Covered |
| `canonical_asset_identity` | final asset id and URI are governed/canonical | Covered |
| `continuity_reusable_asset` | later surfaces can reuse generated artifact by governed handle | Partial |

---

## Minimum Required Scenarios

### Group 1: Golden paths

1. generated image + generated TTS + browser_wasm_success
2. uploaded image + generated TTS + browser_wasm_success
3. chart_rasterized + generated TTS + browser_wasm_success
4. graph_rasterized + generated TTS + browser_wasm_success
5. prior_output_video concat + browser_wasm_success
6. uploaded_video_pair concat + browser_wasm_success
7. chat planner attachment flow → browser_wasm_success

### Group 2: Recovery paths

1. compose_media browser_wasm unavailable → fallback_to_deferred → succeeded
2. media job failed → retry_from_admin_jobs → succeeded
3. media job running → cancel_from_admin_jobs → canceled terminal state
4. active media job → reload_resume → state continuity preserved
5. completed media job after missed live event → snapshot recovery preserved

### Group 3: Continuity paths

1. generated chart reused in later compose_media request
2. generated graph reused in later compose_media request
3. generated audio reused in later compose_media request
4. generated blog image reused in later compose_media request (must use `uf_` handle, not raw `blogasset_` ID in audio clips)

---

## Pairwise Strategy

A full cross-product is too expensive for routine CI. Recommended strategy:

1. run all Group 1 golden paths on every mainline media release gate
2. run all Group 2 recovery paths on every runtime-integrity media gate
3. run Group 3 continuity paths nightly or before release
4. maintain pairwise coverage across visual input, audio input, route, and recovery dimensions

---

## Known Gaps

The biggest uncovered combinations today are:

1. **Asset ID discipline** — `validatePlanConstraints` does not reject `blogasset_*` or `job_*` IDs in audio clips. This caused live failures in `conv_f5dd9a19` and is unguarded by any test.
2. **Uploaded audio as first-class composition source** — the planner path covers it but not the broader matrix.
3. **Media-specific retry and cancel** — admin jobs UI tests use blog jobs as seeds, not real media jobs.
4. **Reload and missed-SSE recovery for media** — this parity gap vs. blog jobs is the biggest continuity risk.
5. **Direct deferred-only media composition** — no test starts on the deferred route without a browser attempt.
6. **Job card sequence ordering** — retrograde state display (`failed → queued → failed`) is untested and caused visible UX confusion in live sessions.