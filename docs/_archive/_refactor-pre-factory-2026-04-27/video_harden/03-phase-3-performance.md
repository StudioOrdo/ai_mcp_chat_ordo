# Phase 3 — Performance

**Goal.** Remove quadratic and over-reflow hot spots identified in audit.
Every item must be backed by a micro-benchmark test that locks the complexity
class (not raw wall-time, which is too machine-dependent).

> **QA refresh (April 25, 2026).** Phase 0 through Phase 2 are now closed and
> green, so Phase 3 should be read as a targeted performance follow-up on top
> of the already-landed canonicalization, browser-runtime, and structural
> refactor seams rather than as a broad cleanup pass.
>
> **Carry-forward facts verified against the current codebase before this QA
> pass:**
>
> - Phase 0 repair-aware canonicalization is already wired through the browser,
>   tool, and deferred compose paths. Phase 3 must not bypass
>   `canonicalizeMediaCompositionPlanWithRepairs(...)` or weaken the current
>   asset-candidate contract just to optimize a hot path.
> - Phase 1's browser-runtime hardening still holds: audio generation timeout
>   behavior is live and covered, SVG normalization remains guarded in
>   `svg-rasterization.ts`, and focused browser-runtime tests still avoid broad
>   fake timers.
> - Phase 2 structural work already landed the shared graph geometry seam, the
>   9-case per-renderer graph snapshot corpus, the shared SVG utility module,
>   the extracted browser-runtime wrappers, and the `useAssetResolutionIndex`
>   lookup seam. Phase 3 should reuse those seams, not reintroduce per-renderer
>   duplication or re-scan chat messages inline.
>
> **Current codebase facts verified during this QA pass:**
>
> - `src/lib/graphs/graph-geometry.ts` already builds a `bubbleRadiusLookup`
>   map and both `GraphSvg.tsx` and `graph-svg-markup.ts` now consume
>   `geometry.bubbleRadiusForPoint(point)` rather than walking `graph.data`
>   inline. This means the original `GraphSvg.tsx` `find(...)` hot spot is no
>   longer present as written.
> - Bubble lookup collision behavior is now **last write wins** and the graph
>   geometry suite includes an explicit duplicate-key assertion plus a lookup-
>   path scan lock.
> - `useAssetResolutionIndex` is already live in
>   `src/hooks/chat/useBrowserCapabilityRuntime.ts`, backed by `Map`s and
>   memoized on `messages` identity via `useMemo(() => buildAssetResolutionIndex(messages), [messages])`.
> - `src/lib/media/browser-runtime/mermaid-image-derivation.ts` now batches
>   theme token reads through a cache, invalidates on `data-theme` / `class`
>   mutations, degrades to per-render reads when `MutationObserver` is absent,
>   and tears observers down on `beforeunload` and HMR dispose.
> - The shared `uint8ArrayToBase64` helper now exists and is used by browser
>   SVG rasterization plus the remaining UI/e2e SVG export call sites.
> - Focused QA on the currently relevant Phase 3 suites is green:
>   `uint8-to-base64.test.ts`, `mermaid-image-derivation.test.ts`,
>   `svg-rasterization.test.ts`, `graph-geometry.test.tsx`, and
>   `useAssetResolutionIndex.test.tsx` passed 53/53 assertions.

## 3.1 Bubble-chart size lookup

### 3.1 Problem

[src/lib/graphs/GraphSvg.tsx](../../../src/lib/graphs/GraphSvg.tsx) lines
814–823: for each laid-out bubble point, `graph.data.find(...)` walks the full
array to read the `size` field. Rendering `N` bubbles is `O(N²)`.

### 3.1 Target design

Inside `computeGraphGeometry` (Phase 2.1), when `kind === "bubble"`, build
once:

```ts
const bubbleSizeByKey = new Map<string, number>();
for (const row of graph.data) {
  const key = `${row[xField]}|${row[yField]}|${row[seriesField] ?? ""}`;
  bubbleSizeByKey.set(key, Number(row[sizeField]) || 0);
}
```

Expose `bubbleSizeLookup(point) => number | undefined` on `GraphGeometry`.
Consumer uses `bubbleSizeLookup(point)` instead of `graph.data.find`.

### 3.1 Acceptance

- [x] `O(1)` lookup per point is implemented via the geometry-owned lookup map
   and covered by an explicit lookup-path scan lock.
- [x] Identical rendered output for existing bubble snapshots is covered by the
   Phase 2 graph renderer snapshot corpus.

### 3.1 Test

`src/lib/graphs/graph-geometry.test.ts` (extend):

1. **Correctness.** A 20-point bubble dataset — `bubbleSizeLookup(point)`
   returns the same values as the pre-refactor `find` walk.
2. **Complexity lock.** Instrument a counter in a test-only wrapper: count
   the total `find/filter` invocations made during `computeGraphGeometry` on
   a 1,000-point dataset. Assert count is `O(rows)`, not `O(rows × rows)`.
3. **Collision — same x,y,series.** Two rows share the key; last write wins;
   no throw. (Document this in the JSDoc.)

**Current QA status.** `graph-geometry.test.tsx` now includes the explicit
lookup-path scan lock and a duplicate-key `last write wins` assertion on the
bubble lookup map, while the Phase 2 snapshot corpus still covers output
stability.

## 3.2 Mermaid color batching

### 3.2 Problem

[src/lib/media/browser-runtime/mermaid-image-derivation.ts](../../../src/lib/media/browser-runtime/mermaid-image-derivation.ts)
`resolveColor` reads 13 CSS custom properties via
`getComputedStyle(root).getPropertyValue(name)`. Each call forces a style
recalculation; 13 calls = 13 reflows during every chart render.

### 3.2 Target design

Read once into a `Map<string, string>` in `ensureMermaidInitialized`.
`resolveColor` becomes `tokenCache.get(name) ?? fallback`.

```ts
const TOKEN_NAMES = [
  "--color-accent", "--color-accent-strong", ...,
] as const;

function readThemeTokens(): ReadonlyMap<string, string> {
  const style = getComputedStyle(document.documentElement);
  return new Map(TOKEN_NAMES.map(n => [n, style.getPropertyValue(n).trim()]));
}
```

Cache invalidates on theme change. Listen for
`document.documentElement.dataset.theme` mutations via
`MutationObserver` (scoped to `attributes`, filter
`["data-theme", "class"]`). Detach observer in a `destroy` hook during HMR.

### 3.2 Acceptance

- [x] `getComputedStyle` invoked **once** per chart render, or once total while
   the cache stays warm.
- [x] Theme flip re-reads tokens on next render.
- [x] No memory leak — observer disconnects on module teardown.

### 3.2 Tests

`src/lib/media/browser-runtime/mermaid-image-derivation.test.ts` (extend):

#### Positive

1. **Single reflow assertion.** Spy on `getComputedStyle`; render two
   mermaid charts; assert total call count ≤ 2 (one per render, or one
   total if cache is warm).
2. **Theme swap refresh.** Flip `data-theme`, render again; new token
   values reflected in output.

#### Negative

1. **Missing token → fallback.** `--color-accent` unset → fallback color
   applied without throw.

#### Edge

1. **JSDOM no `MutationObserver`.** Degrade gracefully to re-read per render.

**Current QA status.** `mermaid-image-derivation.test.ts` now covers warm-cache
`getComputedStyle` counts, theme invalidation, missing-token fallback, and the
no-`MutationObserver` degradation path. The underlying SVG normalization tests
remain green as a separate suite.

## 3.3 Base64 conversion

### 3.3 Problem

Several paths convert an `ArrayBuffer` to base64 via
`String.fromCharCode(...new Uint8Array(buf))` + `btoa`, which is `O(n)` in
memory but pathological for buffers > ~100 KB due to `apply` stack limits
**and** the string concatenation reallocates.

### 3.3 Target design

Shared helper `src/lib/encoding/uint8-to-base64.ts`:

```ts
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)),
    );
  }
  return btoa(binary);
}
```

Replace ad-hoc conversions at every call site (grep `btoa(String.fromCharCode`).

### 3.3 Acceptance

- [x] Output byte-identical to previous implementation for random 1 MB
   buffer.
- [x] No stack overflow on 10 MB buffer.
- [x] All prior call sites converted.

### 3.3 Tests

`src/lib/encoding/uint8-to-base64.test.ts` (new):

1. **Empty input** → `""`.
2. **Small input** equals reference `Buffer.from(bytes).toString("base64")`.
3. **1 MB random** equals reference.
4. **10 MB random** completes without throw; equals reference.
5. **Boundary.** Exactly `CHUNK` (0x8000) bytes — correct handling at boundary.

**Current QA status.** `uint8-to-base64.ts` and its focused test file are now
in repo, the 1 MB and 10 MB reference checks are green, and the remaining SVG
export call sites have been converted to the shared helper.

## 3.4 Asset index (replaces linear payload scans)

### 3.4 Problem

`useBrowserCapabilityRuntime.ts` calls `findChartPayloadByAssetId` +
`findGraphPayloadByAssetId` + `findAudioPayloadByAssetId` per-clip per-
materialization — each a linear scan of `messages[].capabilityResult.*`. For
a plan with `K` clips and conversation with `M` tool results, this is
`O(K·M)`.

### 3.4 Target design

Implemented in Phase 2.3 as `useAssetResolutionIndex`. This phase just
verifies performance.

### 3.4 Acceptance

- [x] `getChartPayloadByAssetId` is `O(1)` via `Map` lookup in
   `buildAssetResolutionIndex(...)`.
- [x] Index rebuild on messages change is memoized via `useMemo` on messages
   identity.

### 3.4 Test

`src/hooks/chat/useAssetResolutionIndex.test.tsx`:

1. **Complexity lock.** Harness builds 500 messages, calls `getChartPayload`
   for 100 assetIds; assert total Map lookups reported via a test-only
   instrumentation hook.
2. **Rebuild only when messages change.** Same messages array identity →
   index not rebuilt (spy on builder fn).

**Current QA status.** `useAssetResolutionIndex.test.tsx` now includes a
lookup-count assertion over 100 asset resolutions and a hook-level memoization
proof that stable `messages` identity preserves the index object.

## 3.5 Blast radius

| File | Change |
| ---- | ------ |
| `src/lib/graphs/graph-geometry.ts` | Add `bubbleSizeLookup` (Phase 2 file) |
| `src/lib/graphs/GraphSvg.tsx` | Replace `find` with lookup |
| `src/lib/graphs/graph-svg-markup.ts` | Replace `find` with lookup |
| `src/lib/media/browser-runtime/mermaid-image-derivation.ts` | Batched token read + observer |
| `src/lib/encoding/uint8-to-base64.ts` | New |
| `src/lib/encoding/uint8-to-base64.test.ts` | New |
| grep & replace `btoa(String.fromCharCode` call sites | Use shared helper |

~7 files.

## 3.6 Benchmark policy

Perf tests assert **complexity**, not wall-time. Each assertion uses a
counter or spy and checks
`callsActual ≤ expectedBigO(input) * 1.2` (20% slack for implementation
overhead). This keeps tests stable across machines and CI variability.

## 3.7 Risks & rollback

| Risk | Mitigation |
| ---- | ---------- |
| Mermaid observer leaks | Disconnect in a module-scope `beforeunload` + HMR dispose; covered by tests |
| Bubble lookup key collision | Documented "last row wins"; chartspec authors already disallow exact duplicates |
| Base64 helper produces different output | Byte-identical test vs `Buffer.from(...).toString("base64")` |

Each change is a pure swap of one function for a faster equivalent; rollback
= revert the individual file.

## 3.8 Current QA Verdict

As of April 25, 2026, Phase 3 is **satisfied**.

- The graph bubble lookup seam is live, duplicate-key behavior is documented by
   test as `last write wins`, and the lookup path no longer falls back to
   repeated linear scans.
- Mermaid browser-runtime initialization now batches theme-token reads,
   invalidates on theme mutations, and tears observers down on unload/HMR while
   retaining a graceful no-`MutationObserver` fallback.
- The shared `uint8ArrayToBase64` helper is live, validated against reference
   output at small, 1 MB, chunk-boundary, and 10 MB inputs, and adopted at the
   remaining SVG export call sites.
- The explicit focused validation bundle for this phase is green: 53/53 tests
   passed across the helper, mermaid, rasterization, graph geometry, and asset
   resolution suites.

Phase 3 can now be treated as complete.
