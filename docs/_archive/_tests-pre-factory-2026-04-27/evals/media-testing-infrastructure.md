# Media Testing Infrastructure

**Last audited against codebase: 2026-04-27**

> All file references in this document have been verified to exist. Sections marked ⚠️ indicate corrections from the prior version where documentation diverged from reality.

## Purpose

This document describes the media-oriented testing infrastructure that already exists in Studio Ordo so new eval work can extend the current system rather than bypass it.

---

## Current Test Layers

### 1. Vitest unit and integration coverage

The Vitest suite is organized into four named projects via `vitest.workspace.ts`:

| Project | Glob | Environment |
|---|---|---|
| `unit` | `src/core/**/*.test.ts`, `src/adapters/**/*.test.ts` | node |
| `lib` | `src/lib/**/*.test.ts`, `mcp/**/*.test.ts` | node |
| `integration` | `tests/**/*.test.ts` | node |
| `ui` | `src/**/*.test.tsx`, `tests/**/*.test.tsx` | jsdom |

**Verified media-focused Vitest tests (all confirmed to exist):**

#### Tool layer
- `src/core/use-cases/tools/compose-media.tool.test.ts`
- `src/core/use-cases/tools/list-conversation-media-assets.tool.test.ts`
- `src/core/capability-catalog/runtime-tool-binding.test.ts` — includes `generate_audio` catalog routing
- `src/app/api/runtime/generate-audio/route.test.ts` — tests the audio API route (mocks the artifact service)

#### Media library layer
- `src/lib/media/compose-media-preflight.test.ts`
- `src/lib/media/compose-media-progress.test.ts`
- `src/lib/media/compose-media-source-rehydration.test.ts`
- `src/lib/media/media-asset-projection.test.ts`
- `src/lib/media/media-composition-asset-identity.test.ts`
- `src/lib/media/media-metadata.test.ts`
- `src/lib/media/media-operations.test.ts`
- `src/lib/media/media-upload-policy.test.ts`
- `src/lib/media/subtitle-timing.test.ts`
- `src/lib/media/user-media.test.ts`

#### Worker / server layer
- `src/lib/media/server/compose-media-mermaid-renderer.test.ts`
- `src/lib/media/server/compose-media-plan-materialization.test.ts`
- `src/lib/media/server/compose-media-worker-runtime.test.ts`
- `src/lib/media/server/media-worker-client.test.ts`
- `src/lib/media/server/media-worker-http.test.ts`

#### Job layer
- `src/lib/jobs/compose-media-deferred-job.test.ts`
  - ✅ tests job creation with queued status
  - ✅ tests deduplication (reuses active job)
  - ✅ tests rejection of invalid plans before touching the queue

#### Architecture audit
- `tests/media-architecture-audit.test.ts` — static source analysis (upload route, quota enforcement, media page shells)
- `tests/tts-route-hardening.test.ts` — TTS route input validation, timeout, and async file handling

---

### 2. Playwright browser-ui coverage

Playwright runs the browser-facing e2e layer from `tests/browser-ui/`.

**Verified media Playwright specs (all confirmed to exist):**

- `tests/browser-ui/media-compose-eval.spec.ts`
- `tests/browser-ui/media-compose-planner-eval.spec.ts`
- `tests/browser-ui/media-live-workflows.spec.ts`
- `tests/browser-ui/ffmpeg-browser-runtime.spec.ts`
- `tests/browser-ui/operations-media.spec.ts`
- `tests/browser-ui/admin-jobs.spec.ts`
- `tests/browser-ui/jobs-page.spec.ts`
- `tests/browser-ui/media-capacity-quotas.spec.ts`
- `tests/browser-ui/deferred-job-worker-live.spec.ts`
- `tests/browser-ui/deferred-blog-jobs.spec.ts`

Shared helper surface:
- `tests/browser-ui/helpers/media-eval.ts` ✅

---

### 3. Dedicated media e2e harness

The repo contains a purpose-built live harness at:
- `src/app/e2e/media-lab/MediaE2ELab.tsx` ✅

That harness currently exercises six concrete workflows:

1. generated image + generated TTS → composed video
2. uploaded image + generated TTS → composed video
3. rasterized Mermaid chart + generated TTS → composed video
4. rasterized graph + generated TTS → composed video
5. concat of workflows 1-4 → combined video
6. uploaded MP4 clips → concatenated video

The harness produces artifact manifests, screenshot bundles, browser diagnostics, downloaded output videos, ffprobe output, audio volume measurements, and playback assertions.

---

### 4. Recovery and job orchestration coverage

Covered today:
- browser fallback from `compose_media` to deferred enqueue (`ffmpeg-browser-runtime.spec.ts`)
- terminal job rendering for failed media states (`admin-jobs.spec.ts`)
- admin retry/cancel visibility by job status (`admin-jobs.spec.ts`)
- live deferred worker completion surfaced in the browser (`deferred-job-worker-live.spec.ts`)
- status continuity after reload and missed live updates for **blog** jobs (`deferred-blog-jobs.spec.ts`)

> ⚠️ **Correction from prior version:** Reload continuity and missed-SSE recovery are covered for *blog* jobs only, not for media jobs specifically.

---

### 5. Eval and release-gate infrastructure

Current components (all verified to exist):
- `scripts/run-live-eval.ts`
- `scripts/run-runtime-integrity-qa.ts`
- `src/lib/evals/scenarios.ts`
- `src/lib/evals/runner.ts`
- `src/lib/evals/live-runner.ts`

**Media-adjacent eval scenario registered today:** `integrity-audio-recovery-deterministic`

This scenario covers: audio failure detection, fallback transcript visibility, and recovery guidance. It does **not** cover compose_media job behavior, asset ID discipline, or deferred pipeline wiring.

> ⚠️ **Correction from prior version:** No `compose_media`, `generate_chart`, or `generate_graph` deterministic eval scenarios exist in the current catalog. The eval system is well-established but media-pipeline scenarios are not yet first-class citizens.

---

## Verified Strengths

The current infrastructure is stronger than a typical app-level media test stack because it already validates:

- real uploads and governed asset persistence
- actual video artifact creation and download
- browser playback readiness
- audio presence through FFmpeg tooling
- browser-runtime fallback to deferred jobs
- transcript/job-state continuity contracts (for blog jobs)
- `compose-media-deferred-job.test.ts` covers plan deduplication

---

## Confirmed Gaps (as of 2026-04-27)

The following are **not** covered by any test and are confirmed missing via codebase audit:

| Gap | Impact | Source |
|---|---|---|
| `admin_web_search` eager `UserFileRepository` crash regression | Caused live failure | Discovered in `conv_f5dd9a19` |
| job card sequence ordering (retrograde state bug) | UI shows wrong state | `SystemJobCard.test.tsx` has no sequence sort tests |
| `validatePlanConstraints` does not reject `blogasset_*` / `job_*` IDs in audio clips | LLM hallucination goes unchecked | Line 61 only checks `kind`, not `assetId` prefix |
| Media worker server not asserted in `dev.mjs` | Worker silently absent in dev | No test covers `scripts/dev.mjs` |
| `generate_audio` deferred queue entry (integration) | Tool can silently fail inline | `route.test.ts` mocks the service; no queue integration test |
| Direct deferred-only compose (no browser attempt) | Route untested | Confirmed missing from traceability map |
| Media job reload/missed-SSE recovery | Continuity gap vs. blog jobs | Confirmed missing from traceability map |
| `blog_image_output` reuse in `compose_media` | Asset type confusion | Confirmed missing from traceability map |

---

## Implication For Next Work

New media eval work should not replace the current harnesses. It should:

1. add the confirmed-missing regression tests from `conv_f5dd9a19` session (see `pipeline-regression-plan.md`)
2. formalize existing harnesses into a matrix-driven coverage program
3. add media-specific deterministic eval scenarios to the scenario catalog
4. integrate media scenarios into runtime integrity and release evidence
5. close the media/blog parity gap for reload and missed-SSE recovery