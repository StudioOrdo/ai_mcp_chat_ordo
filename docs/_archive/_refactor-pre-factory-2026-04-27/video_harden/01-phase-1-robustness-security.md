# Phase 1 — Robustness & Security

**Goal.** Close five operational-safety gaps identified in the Knuth/Fowler/
Martin audit. All changes are small (< 50 LOC each), additive, and hostile-
input focused.

> **Phase 0 context (April 2026).** Phase 0 (asset-resolution repair) shipped
> green and altered the touch points listed below. Read this before opening
> a Phase 1 PR.
>
> **Updated line anchors** (post-Phase-0 deltas):
> - `useBrowserCapabilityRuntime.ts` audio-fetch site is now **L1911**
>   (spec §4 originally cited L1905). The hook grew the new
>   `ComposeMediaPlanResolution.repairs` field and `…WithRepairs` import.
> - `ffmpeg.worker.ts` `writeFile` site is now **L353** (§2 cited L355) and
>   the success-only cleanup loop is **L400–L403** (§5 cited L405–L410).
>   No structural change — the file shrank by 2 lines elsewhere.
> - `ffmpeg-browser-executor.ts` signal-merge block is now **L103–L145**
>   (§3 cited L100–L125). Variable name is `combinedSignal` (L115). The
>   `combine` pattern Phase 1 §3.2 references is the existing
>   `addEventListener("abort", abort, { once: true })` shape at L134.
>
> **Phase 0 deferred work that Phase 1 should amortize.** Phase 0 widened
> the canonicalizer to return `repairs: readonly AssetReferenceRepair[]`
> and threaded it as far as `ComposeMediaPlanResolution`, but did **not**
> finish plumbing it onto `CapabilityResultEnvelope.replaySnapshot` or onto
> the tool / deferred-job result shapes. Phase 1 §2 (`failureCode:
> "asset_too_large"`) and §4 (`failureCode: "audio_generation_timeout"`)
> both widen the same envelope and the same dispatch sites:
>
> - `src/lib/media/browser-runtime/ffmpeg-browser-executor.ts` envelope
>   construction (around the `combinedSignal` block, L150–L220) — add
>   `replaySnapshot.repairs?: readonly AssetReferenceRepair[]` here while
>   adding `failureCode` for `asset_too_large`. One Zod-schema bump, two
>   wins.
> - `src/core/use-cases/tools/compose-media.tool.ts` and
>   `src/lib/jobs/compose-media-deferred-job.ts` already call
>   `canonicalizeMediaCompositionPlanWithRepairs(...).plan` — when Phase 1
>   adds new failure codes to their return shapes, also surface
>   `repairs?: AssetReferenceRepair[]` (omit when empty per Phase 0
>   convention: "absence means no repair was needed").
>
> **Phase 0 patterns to reuse**:
> 1. Constants live in dedicated files (Phase 1 §1 follows this with
>    `rasterization-constants.ts`).
> 2. New errors extend `Error` with stable `name`. Phase 0's
>    `InvalidMediaCompositionPlanAssetReferenceError` is the template.
> 3. Tests are appended to existing `describe` blocks rather than
>    replacing them. The Phase 0 canonicalizer file went from 27 → 47 tests
>    cleanly with this approach.
> 4. Optional return fields default to **absent** rather than `[]` /
>    `null` (smaller wire payloads, clearer "nothing to report" semantics).
> 5. Layered fallbacks behind a constant — Phase 0 specced a feature flag
>    for repair strategies; Phase 1 should mirror this for `MAX_*` caps
>    (rollback = bump constant to `Number.POSITIVE_INFINITY`).
>
> **Test-suite baseline (post-Phase-0)**: 4367 tests pass / 0 fail.
> Two pre-existing flakes are environment-only and unrelated:
> `compose-media-plan-materialization.test.ts` (Mermaid getBBox timeout)
> and `useGlobalChat.test.tsx` (SSE EventSource race) — both pass cleanly
> in isolation. Phase 1 work must not regress this number.

> **Pre-implementation QA notes (April 2026).** Findings from verifying
> every spec claim against the current codebase. Read before opening a PR.
>
> **§1 SVG cap site — protect the public entry, not just the regex pass.**
> The cap must guard `rasterizeSvgMarkupToPngBlob` (the public entry) OR
> apply at the top of `normalizeSvgForRasterization`. Reason: the same
> markup is later passed to `loadSvgIntoImage` which allocates `new
> Blob([svgMarkup])` AND `new TextEncoder().encode(svgMarkup)` for the
> data-URL fallback ([svg-rasterization.ts:117–145](../../../src/lib/media/browser-runtime/svg-rasterization.ts)).
> A 100 MB SVG bypassing the regex cap would still copy through those
> allocations. Recommendation: gate inside `normalizeSvgForRasterization`
> as currently specced — it is the choke point both paths funnel through.
>
> **§2 has TWO `writeFile` sites for fetched asset data, not one.**
> [ffmpeg.worker.ts](../../../src/lib/media/browser-runtime/ffmpeg.worker.ts):
> - Visual loop: L344 (`fetchFile(visualAssetUrls[…])` → `writeFile`).
> - Audio loop: L353 (`fetchFile(audioAssetUrls[…])` → `writeFile`).
> - L362 `writeFile("concat.txt", …)` is locally generated; **no cap
>   needed** there.
>
> Both asset loops must be wrapped. Cleanest: extract a
> `stageAssetFile(ff, url, inputFileName, stagedFiles)` helper that
> bundles fetch + size-check + writeFile + push, used twice. Keeps the
> cap consistent.
>
> **§2.2 `Content-Length` pre-check requires replacing `fetchFile`.**
> `fetchFile` (from `@ffmpeg/util`, imported at
> [ffmpeg.worker.ts:4](../../../src/lib/media/browser-runtime/ffmpeg.worker.ts))
> is a black-box helper that internally fetches and buffers; it does not
> expose response headers. To honor the spec's pre-fetch abort, the
> worker must call native `fetch(url, { signal })` directly, inspect
> `response.headers.get("content-length")`, and `await
> response.arrayBuffer()` only if under cap. This loses `fetchFile`'s
> built-in data-URL / blob-URL / file-URL normalization — worth
> re-implementing inline (asset URLs in the worker are always
> `/api/user-files/…` paths today, so a plain `fetch` is sufficient).
>
> Acceptable degradation: keep `fetchFile` and rely on **post-buffer**
> size check only (drop §2.3.3 "Content-Length declares 600 MB" criterion
> down to a soft preference). Decide before implementation.
>
> **§3 watchdog — no combine helper exists yet.** Current code at
> [ffmpeg-browser-executor.ts:115](../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.ts)
> is single-source: `const combinedSignal = signal ?? abortController.signal`.
> The merge for watchdog needs a real two-signal abort listener (listen on
> both, abort local on either, propagate `reason`). The spec's "existing
> combine pattern" wording is **not** literally present — there is no
> existing helper to extend. Either (a) write a small
> `combineAbortSignals(...signals)` helper or (b) attach two
> `addEventListener("abort", …)` calls inline.
>
> **§3.4.7 `AbortSignal.timeout` JSDOM fallback** is likely unnecessary.
> Vitest's bundled jsdom (24+) supports `AbortSignal.timeout`. Confirm
> with `typeof AbortSignal.timeout === "function"` in a quick test before
> writing fallback code; remove §3.4.7 if unneeded.
>
> **§4 timeout error must be distinguished from manual abort.** The
> existing `.catch` at
> [useBrowserCapabilityRuntime.ts:1957](../../../src/hooks/chat/useBrowserCapabilityRuntime.ts)
> short-circuits when `controller.signal.aborted` is true — silently
> dropping any reason. With `AbortSignal.timeout` merged in, a timeout
> ALSO sets `aborted=true` so the silent drop swallows it. Fix: inspect
> `controller.signal.reason` (or `error.name === "TimeoutError"`) before
> the early return; only return silently for genuine user aborts.
>
> **§5 `ff = null` reset has cold-start cost.** Resetting the module
> singleton forces `getFfmpeg()` (typically ~200 ms WASM re-init). The
> spec already accepts this in §7 risk register. Alternative: instead of
> nulling, run `safeDeleteFile` for every entry in `ff.readdir("/")`
> minus stable system paths. Riskier but ~0 ms. Default to the spec's
> reset path — it's correctness-first.
>
> **No existing test files** for `svg-rasterization` or `ffmpeg.worker`
> — confirmed via file search. Both are net-new test files (matches
> spec §1.4 / §2.4 / §5.4).
>
> **No environment configuration for caps.** Spec proposes hard-coded
> constants. Per Phase 0 pattern ("layered fallbacks behind a constant"),
> Phase 1 should expose `process.env.NEXT_PUBLIC_MAX_FFMPEG_ASSET_BYTES`
> override read once at module load — enables emergency lift without
> redeploy. Not in the original spec; recommend adding to §7 rollback.

## 1. SVG input size cap

### 1.1 Problem

`normalizeSvgForRasterization` in
[src/lib/media/browser-runtime/svg-rasterization.ts](../../../src/lib/media/browser-runtime/svg-rasterization.ts)
runs two regex passes over user-influenced SVG markup (mermaid output is
derived from LLM-supplied chart code). A 10 MB SVG with deeply nested
`<foreignObject>` children has pathological backtracking potential.

### 1.2 Target design

Add a constant
`MAX_SVG_MARKUP_BYTES = 5_000_000` (5 MB) in a new
`rasterization-constants.ts` and throw `SvgInputTooLargeError` when
`svgMarkup.length > MAX_SVG_MARKUP_BYTES` at the top of
`normalizeSvgForRasterization`. Include the observed size in the error.

### 1.3 Acceptance criteria

- [ ] 5 MB SVG throws `SvgInputTooLargeError` with observed byte size.
- [ ] 4.99 MB SVG normalizes as before.
- [ ] Error extends `Error`, has a stable `name`, and surfaces the size.
- [ ] `rasterizeSvgMarkupToPngBlob` propagates the throw (not caught).

### 1.4 Tests

Test file: `src/lib/media/browser-runtime/svg-rasterization.test.ts` (new).

**Positive**
1. **Small SVG passes.** 1 KB input normalizes and produces expected output.
2. **Boundary accepted.** Exactly `MAX_SVG_MARKUP_BYTES - 1` passes.
3. **Boundary rejected.** Exactly `MAX_SVG_MARKUP_BYTES + 1` throws with the
   observed size in the message.

**Negative**
4. **Huge SVG rejected before regex runs.** Construct a 10 MB SVG with a
   regex-pathological `<foreignObject>` nesting. Confirm `throw` occurs under
   a 50 ms timeout budget (prove it short-circuits before backtracking).
5. **Error type.** `err instanceof SvgInputTooLargeError` is true.

**Edge**
6. **Unicode byte vs character count.** A 3 MB character string with emoji
   whose `TextEncoder.encode` byte length exceeds the cap. Verify the cap
   is applied to **byte length**, not char length (prevents under-counting).

## 2. FFmpeg asset size validation

### 2.1 Problem

[src/lib/media/browser-runtime/ffmpeg.worker.ts](../../../src/lib/media/browser-runtime/ffmpeg.worker.ts)
lines 344 (visual loop) and 353 (audio loop) write fetched bytes into the
WASM filesystem with no upper bound. A plan referencing a 2 GB video
crashes the tab. The locally-generated `concat.txt` at line 362 is
bounded by `plan.visualClips.length ≤ 5` and does not need a cap.

### 2.2 Target design

Before `ff.writeFile`, inspect `data.byteLength`; reject assets over
`MAX_FFMPEG_ASSET_BYTES = 500_000_000` (500 MB) with
`FfmpegAssetTooLargeError`. On rejection, post
`{ type: "ERROR", error, failureCode: "asset_too_large" }` back to the
executor and run the cleanup loop (§5 below).

Additionally, if the asset URL response includes `Content-Length` > cap, abort
the fetch **before** buffering. Use `AbortController` and inspect
`response.headers.get("content-length")` on the streaming response.

### 2.3 Acceptance criteria

- [ ] A 501 MB asset is rejected before `writeFile`.
- [ ] A 499 MB asset proceeds.
- [ ] When `Content-Length` declares 600 MB, fetch aborts without buffering.
- [ ] `stagedFiles` cleanup runs on this failure path.
- [ ] UI receives `failureCode: "asset_too_large"`.

### 2.4 Tests

Test file: `src/lib/media/browser-runtime/ffmpeg.worker.test.ts` (new; mocks
`@ffmpeg/ffmpeg` and `fetchFile`).

**Positive**
1. **Normal asset under cap.** Composition proceeds; `writeFile` called once
   per clip.
2. **499 MB visual clip.** Proceeds.

**Negative**
3. **501 MB visual clip** rejected post-fetch (if content-length missing).
4. **600 MB Content-Length header** rejected pre-fetch (no body read).
5. **Error routed correctly.** Worker posts `ERROR` with
   `failureCode: "asset_too_large"`.
6. **Cleanup runs on rejection.** `safeDeleteFile` called for any files
   staged before the oversized one.

**Edge**
7. **Cap exactly 500 MB.** Proceeds (strict greater-than comparison).
8. **Missing Content-Length with small body.** Fallback to post-buffer check;
   proceeds.
9. **Missing Content-Length with huge body.** Fallback to post-buffer check;
   rejects with observed size.

## 3. FFmpeg executor watchdog

### 3.1 Problem

[src/lib/media/browser-runtime/ffmpeg-browser-executor.ts](../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.ts)
lines 103–145 combine the caller's `AbortSignal` with a local `AbortController`
but have no timeout. If the worker hangs, the promise never settles.

### 3.2 Target design

Compute a watchdog timeout from the plan:
`FFMPEG_MIN_WATCHDOG_MS = 30_000`, `FFMPEG_WATCHDOG_PER_SECOND_MS = 4_000`.
`timeoutMs = max(MIN, totalPlanSeconds * PER_SECOND)` where
`totalPlanSeconds = sum(visualClips.duration ?? 0) + sum(audioClips.duration ?? 0)`.

Create `AbortSignal.timeout(timeoutMs)` and merge it with the caller's signal
using the existing combine pattern (no `AbortSignal.any` — keep compat with
older runtimes).

On timeout: post `{ type: "TERMINATE" }` to the worker, resolve via the abort
path, and include the timeout value + plan id in the error.

### 3.3 Acceptance criteria

- [ ] A plan estimated at 10s produces a watchdog ≥ 40s.
- [ ] Worker that never responds resolves via timeout within
      `timeoutMs + 200ms`.
- [ ] Worker that responds in time is unaffected.
- [ ] External abort still wins over timeout.

### 3.4 Tests

Test file: `src/lib/media/browser-runtime/ffmpeg-browser-executor.test.ts`
(extend).

**Positive**
1. **Success under budget.** Worker resolves before watchdog; executor
   returns normally.
2. **Watchdog scales with plan.** 30s plan yields ≥ 120s budget; 1s plan
   yields 30s (the minimum).

**Negative**
3. **Hanging worker.** Worker never posts anything; executor rejects with
   `FfmpegExecutorTimeoutError` after `timeoutMs` (tolerate 200 ms slack).
4. **External abort precedes timeout.** Caller aborts at `timeoutMs / 2`;
   rejection is `AbortError`, not `TimeoutError`.
5. **Timeout after worker already succeeded.** No double-settle; success
   value preserved.

**Edge**
6. **Zero-duration plan.** Watchdog falls back to `MIN` budget.
7. **`AbortSignal.timeout` unavailable (JSDOM older runtime).** Fall back to
   `setTimeout` with manual `AbortController.abort`.

## 4. Audio generation fetch timeout

### 4.1 Problem

[src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../src/hooks/chat/useBrowserCapabilityRuntime.ts)
line 1911 issues `void fetch("/api/runtime/generate-audio", …)` with the
candidate's `AbortController.signal` but no timeout. A hung server keeps the
controller alive indefinitely.

### 4.2 Target design

Combine `controller.signal` with `AbortSignal.timeout(AUDIO_FETCH_TIMEOUT_MS)`
where `AUDIO_FETCH_TIMEOUT_MS = 60_000`. On timeout, the `.catch` branch
already runs; ensure the failure message distinguishes
`AudioGenerationTimeoutError` from other failures.

### 4.3 Acceptance criteria

- [ ] Fetch aborts within `AUDIO_FETCH_TIMEOUT_MS + 200ms` of a hung server.
- [ ] Failure code surfaced to UI is `audio_generation_timeout`, not the
      generic server error code.
- [ ] Manual abort (user cancels job) still produces `AbortError`, not
      timeout error.

### 4.4 Tests

Test file: `src/hooks/chat/useBrowserCapabilityRuntime.test.tsx` (extend).

**Positive**
1. **Fast response.** Fetch resolves in 1s; no timeout.

**Negative**
2. **Hung server.** Fetch never resolves; after 60s, job status is
   `failed` with `failureCode: "audio_generation_timeout"`.
3. **Manual cancel first.** User cancels at 30s; status is `canceled`,
   not timeout.

**Edge**
4. **Timeout and abort race.** Both fire within ~10 ms of each other;
   whichever wins is acceptable; no unhandled rejection.

## 5. FFmpeg worker cleanup on error

### 5.1 Problem

[src/lib/media/browser-runtime/ffmpeg.worker.ts](../../../src/lib/media/browser-runtime/ffmpeg.worker.ts)
lines 400–403 run `safeDeleteFile` only on the success path. If the
composition throws mid-run, staged files persist in the WASM filesystem. The
worker is a singleton per tab, so leaked files accumulate across jobs.

### 5.2 Target design

Wrap the compose body in `try/finally`; run the cleanup loop in `finally`.
Additionally, on any error path, **reset** `ffmpeg = null` so the next job
gets a fresh FS. (Graceful because `getFfmpeg()` already handles null-check.)

### 5.3 Acceptance criteria

- [ ] On `ERROR` post, `safeDeleteFile` has been called for every entry in
      `stagedFiles` plus the output file.
- [ ] On `SUCCESS`, behavior is unchanged.
- [ ] The next composition after an error sees no leaked files
      (asserted by probing `ff.readdir("/")` before staging).

### 5.4 Tests

Test file: `src/lib/media/browser-runtime/ffmpeg.worker.test.ts` (extend the
file created in §2.4).

**Positive**
1. **Success path cleanup unchanged.** All staged files deleted; output
   deleted.
2. **Error mid-stage cleanup.** First `writeFile` of a three-clip plan
   throws; cleanup deletes the clips already staged; output never created.
3. **Subsequent job is clean.** Run two compositions in sequence; the
   second finds an empty WASM FS.

**Negative**
4. **Double-error on cleanup.** `safeDeleteFile` itself throws during
   cleanup; the original error still reaches `postMessage`.
5. **Reset path.** After an error, `ff` is reset to null; next
   `getFfmpeg()` creates a new instance.

**Edge**
6. **Abort during staging.** External abort fires between clip 2 and clip 3
   `writeFile`; cleanup still runs for clips 1–2.

## 6. Blast radius

| File | Change |
| ---- | ------ |
| `src/lib/media/browser-runtime/rasterization-constants.ts` | New — size cap constant |
| `src/lib/media/browser-runtime/svg-rasterization.ts` | Size check + `SvgInputTooLargeError` |
| `src/lib/media/browser-runtime/svg-rasterization.test.ts` | New — 6 tests |
| `src/lib/media/browser-runtime/ffmpeg.worker.ts` | Size validation + `try/finally` cleanup + reset |
| `src/lib/media/browser-runtime/ffmpeg.worker.test.ts` | New — 12 tests across §2 and §5 |
| `src/lib/media/browser-runtime/ffmpeg-browser-executor.ts` | Watchdog merge + `FfmpegExecutorTimeoutError`; **also** add deferred Phase 0 `replaySnapshot.repairs?` field on the envelope (one schema bump for `failureCode` widening + repairs) |
| `src/lib/media/browser-runtime/ffmpeg-browser-executor.test.ts` | +7 tests (§3) + 2 envelope tests carried over from Phase 0 §2.4.1 |
| `src/hooks/chat/useBrowserCapabilityRuntime.ts` | Timeout merge on audio fetch; thread `resolution.repairs` into envelope at the two call sites already widened by Phase 0 (L1034, L1458) |
| `src/hooks/chat/useBrowserCapabilityRuntime.test.tsx` | +4 tests (§4) + 2 orchestration tests carried over from Phase 0 §2.4.1 |
| `src/core/use-cases/tools/compose-media.tool.ts` | Surface optional `repairs` on tool result (Phase 0 deferred) when widening for new failure codes |
| `src/lib/jobs/compose-media-deferred-job.ts` | Attach optional `repairs` to `DeferredJobResultPayload` (Phase 0 deferred) when widening for new failure codes |

~9 core Phase-1 files + 3 Phase-0-carryover touch points (all amortized into
the same envelope-schema bump). All additive. No deletions.

## 7. Risks & rollback

| Risk | Mitigation |
| ---- | ---------- |
| Watchdog too aggressive — kills slow-but-legitimate jobs | `FFMPEG_WATCHDOG_PER_SECOND_MS` tunable; add dev-flag override |
| 500 MB cap cuts off legitimate pro-tier media | Cap is a constant; future per-tier lifting is trivial |
| Audio timeout racing cancellation introduces ordering surprise | Covered by test §4.4.4 (race tolerance) |
| Worker reset on error churns FFmpeg re-load (~200ms) | Accept — error cases are rare; correctness > cold-start perf |

Each change is behind a constant in a dedicated file — rollback = change
constant to `Number.POSITIVE_INFINITY`.
