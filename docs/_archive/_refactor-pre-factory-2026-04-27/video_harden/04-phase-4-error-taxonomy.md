# Phase 4 — Error Taxonomy

**Goal.** Replace blanket error wrapping with specific subclasses, add
bounded retry for transient audio-fetch failures, improve FFmpeg diagnostic
capture, and flag truncated content on envelopes.

> **QA update (April 25, 2026, closeout).** This document is no longer a pure forward
> plan. Parts of Phase 4 shipped during the later browser-runtime split, while
> other items below have now been closed in the current browser-runtime owners.
> Treat this file as a status ledger: verified current-state facts first,
> followed by the implementation shape that shipped.
>
> **Current codebase facts verified before this doc refresh:**
>
> - `src/hooks/chat/useBrowserCapabilityRuntime.ts` is now a thin orchestrator
>   that delegates to `browserCapabilityRuntimeCore.ts`,
>   `useComposeMediaMaterialization.ts`, `useBrowserJobOrchestration.ts`, and
>   `useRuntimeSnapshots.ts`. The original Phase 4 framing around a monolithic
>   god hook is stale.
> - Compose-media error handling is currently split across
>   `src/lib/media/compose-media-preflight.ts`,
>   `src/lib/media/compose-media-errors.ts`, and
>   `src/hooks/chat/composeMediaMaterializationCore.ts`, not a single
>   `src/lib/media/errors.ts` module.
> - The codebase already emits several specific failure codes for compose-media
>   execution and recovery, including `asset_not_found`, `asset_forbidden`,
>   `asset_kind_mismatch`, `asset_conversation_mismatch`,
>   `asset_metadata_missing`, `asset_lineage_mismatch`, `invalid_plan`,
>   `source_rehydration_failed`, `deferred_enqueue_failed`, and
>   `runtime_exception`.
> - Audio generation now retries transient failures in
>   `src/hooks/chat/browserCapabilityRuntimeCore.ts` with bounded exponential
>   backoff, per-attempt timeout enforcement, and `Retry-After` support for
>   HTTP `429` responses.
> - `src/lib/media/browser-runtime/ffmpeg.worker.ts` now captures structured
>   FFmpeg diagnostics as head+tail log buffers and sends them through
>   `FfmpegWorkerResponse` on both success and error.
> - `CapabilityResultEnvelope.replaySnapshot.diagnostics.truncations` is now
>   populated for graph-table clipping, caption-line clipping, and browser-side
>   Mermaid flowchart node caps; the compose-media card also surfaces a muted
>   truncation notice when those diagnostics are present.
> - Focused regression coverage already exists around the delivered slices:
>   `useComposeMediaMaterialization.test.tsx`,
>   `useBrowserCapabilityRuntime.test.tsx`,
>   `useBrowserJobOrchestration.test.tsx`, `useRuntimeSnapshots.test.tsx`,
>   `ffmpeg.worker.test.ts`, and `ffmpeg-browser-executor.test.ts`.

## 4.1 Compose-media error subclasses

### 4.1 Problem

The original Phase 4 problem statement is now partially obsolete. The current
runtime no longer routes all compose-media validation failures through one
blanket `InvalidComposeMediaAssetReadinessError`; instead it already separates
preflight validation (`compose-media-preflight.ts`), invalid-plan handling
(`compose-media-errors.ts`), and recovery/runtime orchestration
(`composeMediaMaterializationCore.ts`).

The remaining gap is narrower:

- readiness failures are specific, but not modeled as a full subclass family;
- storage/network/JSON/empty-body failures during governed source retrieval are
      still not fully normalized into one canonical error taxonomy;
- some browser-runtime failures still collapse to generic `runtime_exception`
      or plain `Error` messages.

### 4.1 Target design

If Phase 4 is resumed, design from the **current** ownership boundaries rather
than recreating the earlier monolith. The most natural anchor is now:

- `src/lib/media/compose-media-preflight.ts` for deterministic asset-readiness
      failures;
- `src/lib/media/compose-media-errors.ts` for shared compose-media error types;
- `src/hooks/chat/composeMediaMaterializationCore.ts` for browser/deferred
      orchestration mapping into user-visible `failureCode` / `failureStage`.

An expanded shared error module may still be useful, but it should extend the
existing compose-media error surface instead of replacing it wholesale.

Possible follow-on hierarchy:

```ts
export class ComposeMediaError extends Error {
  readonly assetId: string;
  readonly cause?: unknown;
  constructor(message: string, assetId: string, cause?: unknown) { ... }
}
export class ComposeMediaNetworkError extends ComposeMediaError { ... }
export class ComposeMediaCorsError extends ComposeMediaError { ... }
export class ComposeMediaJsonParseError extends ComposeMediaError { ... }
export class ComposeMediaNotFoundError extends ComposeMediaError { ... }
export class ComposeMediaEmptyAssetError extends ComposeMediaError { ... }
export class ComposeMediaRenderError extends ComposeMediaError { ... }
```

Every new call site that currently throws a plain `Error` during governed
source retrieval or materialization should categorize into a specific subtype.
The orchestrator should then catch `ComposeMediaError` at the top and map to a
user-friendly failure message plus a precise `failureCode` on the envelope.

Current failure codes already in use and needing preservation:

- `asset_not_found`
- `asset_forbidden`
- `asset_kind_mismatch`
- `asset_conversation_mismatch`
- `asset_metadata_missing`
- `asset_lineage_mismatch`
- `invalid_plan`
- `source_rehydration_failed`
- `deferred_enqueue_failed`
- `runtime_exception`
- `asset_too_large` (Phase 1)
- `audio_generation_timeout` (browser audio runtime)

Proposed additional codes if the subtype work is completed:

- `network_unreachable`
- `cors_blocked`
- `asset_malformed_json`
- `asset_empty`
- `render_failed`

### 4.1 Acceptance

- [x] Compose-media plan/readiness handling no longer depends on a single
      blanket readiness error.
- [x] Specific preflight failure codes now exist for missing, forbidden,
      mismatched-kind, conversation-mismatched, metadata-missing, and
      lineage-mismatched assets.
- [x] `invalid_plan` and `source_rehydration_failed` are preserved as explicit
      contracts in shared compose-media error helpers.
- [x] Each failure code has exactly one canonical compose-media mapping point.
- [x] Envelope `failureCode` is closed over one enumerated schema across
      browser runtime, deferred enqueue, and worker transport.
- [x] User-facing messages are kind-appropriate for transport/JSON/empty-body
      retrieval failures rather than generic `Error` text.
- [x] All remaining plain retrieval/materialization errors are upgraded to a
      specific subclass family instead of `runtime_exception`.

### 4.1 Tests

Current relevant tests:

- `src/hooks/chat/useComposeMediaMaterialization.test.tsx`
- `src/hooks/chat/useBrowserCapabilityRuntime.test.tsx`
- `src/lib/media/server/compose-media-worker-runtime.test.ts`

Still-useful additions if the subtype work resumes:

`src/lib/media/errors.test.ts` (new or folded into existing compose-media
error tests):

1. **Hierarchy.** Every subclass `instanceof ComposeMediaError`.
2. **Serialization.** `{ name, message, assetId, failureCode }` survive
   `JSON.parse(JSON.stringify(err))` via a `toJSON` method.

`src/hooks/chat/useBrowserCapabilityRuntime.test.tsx` (extend):

1. **Network failure maps to `network_unreachable`.** `fetch` rejects with
   `TypeError` ("Failed to fetch") → envelope `failureCode`.
2. **CORS failure maps to `cors_blocked`.** Response has
   `type: "opaque"` or `.ok === false && .status === 0`.
3. **404 maps to `asset_not_found`.**
4. **Empty body maps to `asset_empty`.**
5. **JSON parse failure maps to `asset_malformed_json`.**
6. **Render failure maps to `render_failed`.**

## 4.2 Audio-fetch retry with backoff

### 4.2 Problem

Audio fetch (`/api/runtime/generate-audio`) has no retry. A transient 503
surfaces as user-visible failure.

**Current QA status:** delivered. The current implementation in
`browserCapabilityRuntimeCore.ts` retries transient network/`5xx`/`429`
audio-generation failures, preserves the existing timeout contract, and uses
specific failure codes for timeout, rejection, rate limiting, and network
unreachability.

### 4.2 Target design

Exponential backoff: 3 attempts, delays 2s / 4s / 8s. Only retry on:

- Network error (no HTTP response),
- HTTP 5xx,
- HTTP 429 (respect `Retry-After` header if present, clamped to ≤ 30s).

**Never retry** on 4xx (except 429), 3xx, or success.

Abort-aware: if `signal.aborted`, stop retrying and surface `AbortError`.

### 4.2 Acceptance

- [x] Timeout remains bounded by `AUDIO_FETCH_TIMEOUT_MS = 60_000`.
- [x] 503 → retries twice → succeeds on third → single success envelope.
- [x] 401/400-class rejection → no retry → immediate specific failure classification.
- [x] `Retry-After: 5` honored (delay overridden).
- [x] Abort mid-backoff stops without scheduling the next fetch attempt.

### 4.2 Tests

`src/hooks/chat/useBrowserCapabilityRuntime.test.tsx` (extend):

1. **503 then 200** — succeeds with two `fetch` calls.
2. **503, 503, 503** — fails as `network_unreachable` after 3 attempts.
3. **400 never retries** — single `fetch` call; failure code specific.
4. **429 with Retry-After** — honors 5s delay (mock fake timers).
5. **429 without Retry-After** — falls back to exponential schedule.
6. **Abort during first backoff** — fails as AbortError; no second fetch.
7. **Timeout (Phase 1 §4) interacts with retry** — each attempt has its
   own timeout; total bounded by 3 × timeout + backoff sum.

## 4.3 FFmpeg log head + tail capture

### 4.3 Problem

[src/lib/media/browser-runtime/ffmpeg.worker.ts](../../../src/lib/media/browser-runtime/ffmpeg.worker.ts)
`MAX_LOG_LINES = 40` but only keeps the **tail**. Crashes whose signature is
in the prologue (e.g. codec init errors) lose context.

**Current QA status:** delivered. The worker now emits structured FFmpeg log
diagnostics on both success and error, and the browser executor projects those
logs into replay diagnostics for successful compositions while preserving them
on failed executor results.

### 4.3 Target design

Keep two ring buffers: `HEAD = 40`, `TAIL = 40`. Emit them on both success
and error as:

```ts
{
  logs: {
    head: string[];   // first 40 lines
    tail: string[];   // last 40 lines
    totalLines: number;
    truncated: boolean;  // true if totalLines > HEAD + TAIL
  }
}
```

Truncation indicator allows operators to know how much was lost.

### 4.3 Acceptance

- [x] Run a composition emitting 200 log lines; envelope carries head+tail
      of 40 each plus `totalLines: 200, truncated: true`.
- [x] Run emitting 10 lines; head has 10, tail empty, truncated false.
- [x] On error, head + tail are populated and reach the envelope or failed executor result.

### 4.3 Tests

`src/lib/media/browser-runtime/ffmpeg.worker.test.ts` (extend):

1. **200 lines.** Head length 40; tail length 40; totalLines 200; truncated.
2. **50 lines.** Head 40; tail 10; non-overlapping; truncated true.
3. **10 lines.** Head 10; tail 0; truncated false.
4. **Error emits logs.** Simulated FFmpeg throw after 30 log lines; envelope
   includes head (≤30) and tail (same since < HEAD+TAIL).

## 4.4 Truncation flags on envelope

### 4.4 Problem

Several surfaces silently clip content:

- Tables `.slice(0, 6)` x `.slice(0, 6)` in graph renderers.
- Caption text wraps / truncates at N lines per beat in caption burn.
- Mermaid charts truncate excessive node counts.

Users don't know their full data wasn't rendered.

**Current QA status:** delivered. `CapabilityResultEnvelope.replaySnapshot`
now carries truncation diagnostics for graph tables, caption burn, and
browser-side Mermaid flowchart node clipping, and the media card renders a
muted notice when those diagnostics exist.

### 4.4 Target design

Add to `CapabilityResultEnvelope.replaySnapshot`:

```ts
diagnostics?: {
  truncations?: Array<{
    surface: "graph_table" | "caption_lines" | "mermaid_nodes";
    original: number;
    rendered: number;
  }>;
};
```

UI renders a muted chip when any truncation fired: "Some data was truncated
(hover to see)".

### 4.4 Acceptance

- [x] Graph with 8 rows renders 6 rows **and** emits
      `{ surface: "graph_table", original: 8, rendered: 6 }`.
- [x] Caption with >3 wrapped lines emits entry.
- [x] No truncations → field absent (not `[]`) for economy.

### 4.4 Tests

1. **Graph 8-row truncation.** Envelope has expected entry.
2. **Graph 6-row at limit.** No entry.
3. **Caption 3-beat within limit.** No entry.
4. **Caption 5-beat exceeds limit.** Entry present.
5. **Combined.** Both truncations in one composition → two entries.
6. **Deterministic order.** `truncations` sorted by `surface` for snapshot
   stability.

## 4.5 Blast radius

| File | Change |
| ---- | ------ |
| `src/lib/media/compose-media-preflight.ts` | Existing preflight failure taxonomy; preserve and extend rather than replace |
| `src/lib/media/compose-media-errors.ts` | Existing shared compose-media errors (`invalid_plan`, `source_rehydration_failed`) |
| `src/hooks/chat/composeMediaMaterializationCore.ts` | Primary Phase 4 orchestration surface for failure-code mapping |
| `src/hooks/chat/browserCapabilityRuntimeCore.ts` | Audio generation retry/backoff and failure classification |
| `src/hooks/chat/useBrowserCapabilityRuntime.ts` | Thin orchestration wrapper only; no longer the main implementation surface |
| `src/hooks/chat/useBrowserCapabilityRuntime.test.tsx` | +10 tests |
| `src/lib/media/browser-runtime/ffmpeg.worker.ts` | Dual-ring buffer |
| `src/lib/media/browser-runtime/ffmpeg.worker.test.ts` | +4 log-capture tests |
| `src/lib/media/browser-runtime/ffmpeg-browser-executor.ts` | Pipe FFmpeg and truncation diagnostics into replay snapshots |
| `src/lib/graphs/graph-geometry.ts` | Report `truncated` count on table |
| `src/lib/media/browser-runtime/caption-burn.ts` | Report truncation count |

Current delivered portion spans more than the original estimate because the
browser-runtime split introduced dedicated orchestration modules. Phase 4 now
closes inside those owner files rather than an older monolithic hook.

## 4.6 Risks & rollback

| Risk | Mitigation |
| ---- | ---------- |
| Retry amplifies upstream outage | Bounded at 3 attempts + circuit-breaker-ready (not in this phase) |
| Head+tail logs leak user data | Logs already captured; scope is unchanged; truncation only affects count |
| UI chip distracts users | Chip is muted, tooltip-only, dismissible |
| Error subclass rename breaks external consumers | `InvalidComposeMediaAssetReadinessError` kept as deprecated alias of `ComposeMediaError` for one release |

Rollback: revert error-subclass swaps per call site; retry helper is a
separate function, easy to bypass by swapping back to single `fetch`.

## 4.7 Current QA verdict

- **Delivered:** browser-runtime orchestration split; explicit compose-media
      preflight failure codes; shared compose-media subclass taxonomy for
      retrieval/materialization failures; bounded audio retry/backoff;
      FFmpeg head+tail diagnostics; truncation diagnostics on result envelopes.
- **Status:** focused Phase 4 validation is green across compose-media,
      browser-runtime, FFmpeg, truncation-helper, and media-card suites.
- **Recommended merge-gate tests for future changes near this surface:**
      `src/hooks/chat/useComposeMediaMaterialization.test.tsx`,
      `src/hooks/chat/useBrowserCapabilityRuntime.test.tsx`,
      `src/hooks/chat/useBrowserJobOrchestration.test.tsx`,
      `src/hooks/chat/useRuntimeSnapshots.test.tsx`,
      `src/lib/media/browser-runtime/ffmpeg.worker.test.ts`, and
      `src/lib/media/browser-runtime/ffmpeg-browser-executor.test.ts`, plus
      the truncation/helper suites under `src/lib/media/browser-runtime/` and
      `src/frameworks/ui/chat/plugins/custom/MediaRenderCard.test.tsx`.
