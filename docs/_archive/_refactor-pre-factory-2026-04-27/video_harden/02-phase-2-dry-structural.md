# Phase 2 — DRY / Structural Refactor

**Goal.** Eliminate the three highest-value duplication / god-object debts:

1. GraphSvg.tsx + graph-svg-markup.ts (~1,000 LOC each, ~100% duplicated logic).
2. Server + browser share no SVG utilities; regex parsing is re-implemented.
3. `useBrowserCapabilityRuntime.ts` is a 2,024-LOC god hook.

> **QA update (April 24, 2026).** Phase 0 and Phase 1 are complete and green;
> Phase 2 should be treated as a behavior-preserving refactor on top of those
> contracts, not as a cleanup of the older pre-hardening code.
>
> **Current codebase facts verified before this phase:**
>
> - `src/hooks/chat/useBrowserCapabilityRuntime.ts` is currently **2,024 LOC**.
>   It now owns Phase 0 repair-aware canonicalization, Phase 1 audio timeout,
>   browser-short explainer caption materialization, source rehydration, stale
>   browser-job recovery, and retargeting in-flight compose updates after an
>   assistant message is refreshed.
> - No extracted browser-runtime hooks exist yet. The only matching files are
>   `useBrowserCapabilityRuntime.ts` and `useBrowserCapabilityRuntime.test.tsx`.
> - `getGraphValidationIssue` still exists twice: once in
>   `src/lib/graphs/GraphSvg.tsx` and once in
>   `src/lib/graphs/graph-svg-markup.ts`.
> - SVG dimension parsing still exists in two forms: browser
>   `getSvgViewportMetrics` in `svg-rasterization.ts` and server
>   `parseSvgDimensions` in `compose-media-plan-materialization.ts`.
> - Phase 1 added `src/lib/media/browser-runtime/svg-rasterization.test.ts` and
>   the server-side `compose-media-plan-materialization.test.ts` already exists;
>   the shared SVG utility refactor must keep both suites green.
> - Full validation after Phase 1 is green: `npm run test` passed with 564 files
>   and 4,395 tests; `npm run qa:runtime-integrity` passed including production
>   build and evidence generation.
>
> **Contracts Phase 2 must preserve from previous phases:**
>
> - Phase 0 repair metadata is no longer deferred. `repairs` can surface from
>   browser, tool, and deferred compose paths. Any extracted compose
>   materialization module must keep `AssetReferenceRepair[]` flowing into
>   `CapabilityResultEnvelope.replaySnapshot.repairs` and related result
>   payloads.
> - Phase 1 failure codes are part of the user/admin contract:
>   `asset_too_large`, `ffmpeg_executor_timeout`, `audio_generation_timeout`,
>   and `source_rehydration_failed` must survive the split unchanged.
> - Browser runtime controller state is intentionally shared across transient
>   chat-surface remounts. Do **not** replace it with a purely component-local
>   `useRef(new Map())` unless an equivalent provider/singleton keeps in-flight
>   jobs alive and lets completion dispatch retarget refreshed messages.
> - Tests should continue avoiding broad fake timers in
>   `useBrowserCapabilityRuntime.test.tsx`; Phase 1 found targeted timeout
>   stubs safer for Testing Library/jsdom.
>
> **Pre-implementation QA findings for Phase 2:**
>
> 1. The graph snapshot requirement needs to distinguish **per-renderer output
>    preservation** from **cross-renderer byte identity**. `GraphSvg.tsx` JSX and
>    `graph-svg-markup.ts` string serialization may differ in attribute spelling
>    or React serialization details. Capture pre-refactor fixtures for both
>    renderers and assert each renderer preserves its own output byte-for-byte;
>    use a normalized semantic comparison only when comparing JSX output to raw
>    markup output directly.
> 2. Shared SVG utilities must be universal. A new `parseSvgDimensions` module
>    cannot depend on browser-only `DOMParser` or server-only `sharp`/`fs`. Use a
>    small string parser that preserves current `viewBox`, `width`, `height`,
>    `px`, malformed, and fallback behavior.
> 3. `svg-rasterization.ts` now has a hard Phase 1 byte cap via
>    `MAX_SVG_MARKUP_BYTES` and `SvgInputTooLargeError`. Moving dimension
>    parsing must not move or weaken the cap; `normalizeSvgForRasterization`
>    remains the choke point before `Blob`, `TextEncoder`, or image loading.
> 4. `useAssetResolutionIndex` should index not only transcript-local chart,
>    graph, and audio payloads, but also the canonicalization candidates built
>    from chat messages. This avoids re-scanning messages for the Phase 0 alias
>    repairs and the Phase 8/9 source rehydration paths now embedded in the
>    runtime hook.
> 5. `useComposeMediaMaterialization` should own the large sequence from plan
>    resolution through chart/graph/image materialization and FFmpeg execution,
>    but should accept injected browser functions (`fetch`, upload,
>    `renderMermaidChartToPngBlob`, `renderGraphToPngBlob`,
>    `burnCaptionIntoImageBlob`, `FfmpegBrowserExecutor`) so focused tests do
>    not need to render the full chat provider.
> 6. Runtime snapshot extraction must preserve the existing persisted storage
>    contract in `browser-runtime-state.ts`; old stale entries should still be
>    cleared and invalid plans should still fail locally rather than silently
>    enqueueing alias-based deferred work.

## 2.1 Extract `computeGraphGeometry`

### 2.1 Problem

Both [src/lib/graphs/GraphSvg.tsx](../../../src/lib/graphs/GraphSvg.tsx) and
[src/lib/graphs/graph-svg-markup.ts](../../../src/lib/graphs/graph-svg-markup.ts)
re-implement:

- `toNumber`, `getCategoricalDomain`, `getContinuousDomain`, `buildTicks`,
  `buildSeriesPoints`, `getSeriesKeys`, `getColumns`, `formatValue`,
  per-kind margin math, per-point positioning.
- Magic widths `760 × 420`.
- Validation via `getGraphValidationIssue` (defined in **both** files).

### 2.1 Target Design

New module `src/lib/graphs/graph-geometry.ts` exports a pure layout model:

```ts
export interface GraphGeometry {
  readonly dimensions: { width: number; height: number };
  readonly margin: { top: number; right: number; bottom: number; left: number };
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly seriesKeys: readonly string[];
  readonly xScale: GraphScale;
  readonly yScale: GraphScale;
  readonly xTicks: readonly TickModel[];
  readonly yTicks: readonly TickModel[];
  readonly points: readonly LaidOutPoint[];
  readonly kind: GraphKind;
  readonly bubbleSizeLookup?: (point: LaidOutPoint) => number | undefined;
  readonly tableRows?: ReadonlyArray<ReadonlyArray<string | number>>;
  readonly heatmapCells?: ReadonlyArray<HeatmapCell>;
}

export function computeGraphGeometry(
  graph: GraphSpec,
  width?: number,
  height?: number,
): GraphGeometry;
```

`GraphSvg.tsx` becomes a pure renderer that consumes `GraphGeometry` and
produces JSX. `graph-svg-markup.ts` becomes a pure renderer that consumes
`GraphGeometry` and produces a string. Both call `computeGraphGeometry`; both
import `getGraphValidationIssue` from a new single-source
`graph-validation.ts`.

### 2.1 Acceptance Criteria

- [ ] Each renderer preserves its own current output byte-for-byte for a
   representative corpus (9 sample graph cases: bar, grouped-bar, stacked-bar,
   line, area, scatter, bubble, heatmap, table). Capture snapshots
   **before** refactor for `getGraphSvgMarkup` and the React static render
   path separately, then require both snapshots to pass unchanged after.
- [ ] `getGraphValidationIssue` exists in exactly one file.
- [ ] Net LOC reduction ≥ 600 lines.
- [ ] No new public API besides `computeGraphGeometry` + `GraphGeometry` types.

### 2.1 Tests

Test file: `src/lib/graphs/graph-geometry.test.ts` (new).

#### Geometry Positive

1. **Bar chart domain.** Categorical x, quantitative y — geometry contains
   expected `xScale.domain`, `yTicks.length === 5` by default.
2. **Line chart points.** Time-series data yields `points[]` in chronological
   order with correct pixel mapping.
3. **Bubble with lookup.** `bubbleSizeLookup` is `O(1)` per call (see Phase 3).
4. **Heatmap cells.** 3×3 matrix yields 9 cells with normalized opacities.
5. **Table truncation.** 20-row table yields first 6 rows (current cap);
   geometry signals `truncated: true`.
6. **Explicit width/height.** Passing `width=1920, height=1080` produces
   correct margin-adjusted inner dimensions.

#### Geometry Negative

1. **Validation failure propagates.** `computeGraphGeometry` throws the
   existing validation error message for missing encodings.

#### Snapshot Equivalence

1. **9 canonical graph cases preserve renderer output.** For each graph case,
   assert that React-side `<GraphSvg>` static output matches its pre-refactor
   fixture and `getGraphSvgMarkup` matches its pre-refactor fixture. If a
   direct JSX-vs-string comparison is useful, normalize attribute casing and
   serialization first; direct byte identity across the two renderers is not a
   reliable contract.

### 2.1 Risks

- **Visual drift.** Capture snapshots of current `getGraphSvgMarkup` and
   React static output for the 9 graph cases **before** the refactor. After
   refactor, each renderer's own snapshots must be byte-identical. Any delta is
   a blocking regression unless explicitly reviewed as intentional visual drift.
- **Memo regression.** `GraphSvg` currently re-computes geometry every render.
  Wrap `computeGraphGeometry` in `useMemo(() => …, [graph, width, height])`.

## 2.2 Move shared SVG utilities to `@/lib/svg-utilities`

### 2.2 Problem

- `getSvgViewportMetrics` in
  [svg-rasterization.ts](../../../src/lib/media/browser-runtime/svg-rasterization.ts)
  duplicates `parseSvgDimensions` in
  [compose-media-plan-materialization.ts](../../../src/lib/media/server/compose-media-plan-materialization.ts).
- Size constants (`DEFAULT_MIN_WIDTH = 1200`, `MIN_HEIGHT = 700`,
  `FALLBACK_WIDTH = 960`, `FALLBACK_HEIGHT = 640`) live nowhere central.

### 2.2 Target Design

New `src/lib/svg-utilities/index.ts` exports:

```ts
export interface SvgDimensions { width: number; height: number; }
export function parseSvgDimensions(markup: string): SvgDimensions;
export const DEFAULT_RASTERIZATION_MIN_WIDTH = 1200;
export const DEFAULT_RASTERIZATION_MIN_HEIGHT = 700;
export const SVG_FALLBACK_WIDTH = 960;
export const SVG_FALLBACK_HEIGHT = 640;
```

Both browser and server modules import from it.

Keep the module platform-neutral: no `DOMParser`, no `sharp`, no `fs`, no
browser globals. The browser rasterizer can still call the shared parser after
`normalizeSvgForRasterization`; the server materializer can call it before
`sharp` resize. Phase 1's SVG byte cap stays in
`normalizeSvgForRasterization`, not in the shared parser.

### 2.2 Acceptance Criteria

- [ ] `parseSvgDimensions` defined exactly once.
- [ ] Existing behavior preserved for every input currently tested in both
      modules' test suites.
- [ ] Browser bundle does not inadvertently pull in server-only deps.
- [ ] `SvgInputTooLargeError` / `MAX_SVG_MARKUP_BYTES` behavior is unchanged
   and still guarded by `svg-rasterization.test.ts`.
- [ ] Server materialization still scales graph/chart SVGs with the same
   fallback dimensions and `MIN_RENDER_WIDTH` behavior.

### 2.2 Tests

New test `src/lib/svg-utilities/parse-svg-dimensions.test.ts`:

1. `<svg viewBox="0 0 400 300">` → `{ 400, 300 }`.
2. `<svg width="200px" height="100px">` → `{ 200, 100 }`.
3. `<svg width="200" height="100">` → `{ 200, 100 }`.
4. No dims → fallback `{ 960, 640 }`.
5. Malformed SVG → fallback, no throw.
6. viewBox with non-numeric values → fallback.

## 2.3 Split `useBrowserCapabilityRuntime`

### 2.3 Problem

[src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../src/hooks/chat/useBrowserCapabilityRuntime.ts)
is 2,024 LOC with multiple `useEffect`s, type predicates, module-level
controller maps, and chart/graph/audio/compose orchestration all inline. It's
untestable as units.

### 2.3 Target Design

Four sibling hooks, each < 400 LOC:

```ts
// 1) Controllers + job lifecycle (preserves cross-remount runtime state)
function useBrowserJobOrchestration(): {
  register(jobId, controller): void;
  unregister(jobId): void;
  isCompleted(jobId): boolean;
  abortAll(): void;
};

// 2) Fast indexed lookup across chat messages (Phase 3.4 groundwork)
function useAssetResolutionIndex(messages): {
  getChartPayloadByAssetId(id): ChartPayload | null;
  getGraphPayloadByAssetId(id): GraphPayload | null;
  getAudioPayloadByAssetId(id): AudioPayload | null;
  listCandidates(): MediaCompositionAssetIdentityCandidate[];
};

// 3) Single compose_media job materialization
function useComposeMediaMaterialization(deps): {
  materialize(candidate, signal): Promise<CapabilityResultEnvelope>;
};

// 4) Snapshot persistence for replay
function useRuntimeSnapshots(conversationId): {
  persist(jobId, snapshot): void;
  restore(jobId): RuntimeSnapshot | null;
};
```

The top-level `useBrowserCapabilityRuntime` composes these four and is
< 500 LOC.

Current runtime responsibilities are broader than the original draft. The
split must keep these behaviors intact:

- repair-aware plan resolution using
   `canonicalizeMediaCompositionPlanWithRepairs`;
- browser-short explainer caption burning and narration-derived overrides;
- governed chart/graph source rehydration from `/api/user-files/<assetId>`;
- deferred recovery and invalid-plan failure-code preservation;
- retargeting in-flight browser updates when the assistant message id/index
   changes after persistence refresh;
- audio generation timeout handling with `audio_generation_timeout`.

Prefer extraction into pure helpers plus hooks where possible. If a unit does
not need React state/effects, make it a plain module first and wrap it from the
composing hook.

### 2.3 Acceptance Criteria

- [ ] `useBrowserCapabilityRuntime.ts` ≤ 500 LOC.
- [ ] Every existing test in `useBrowserCapabilityRuntime.test.tsx` passes
      unchanged (behavior preservation).
- [ ] Each extracted hook has its own test file with ≥ 4 tests.
- [ ] In-flight browser jobs survive transient chat-surface remounts exactly as
   they do now. The module-level controller Maps may be replaced only by an
   equivalent provider/singleton store. A purely component-local ref is not
   acceptable unless the provider lives above all remounting surfaces.
- [ ] `resetBrowserCapabilityRuntimeStateForTests` is either preserved as a
   thin test helper over the new store or replaced with an explicit test
   provider cleanup API.
- [ ] Existing Phase 0/1 failure codes and optional `repairs` propagation are
   unchanged.

### 2.3 Tests Per Extracted Hook

#### useBrowserJobOrchestration

New test file.

Positive

1. **Register + unregister.** Controller tracked, then removed; abort signal
   fires when caller aborts.
2. **Completion marker.** `isCompleted(jobId)` returns true after
   `unregister` was called following success.
3. **Remount persistence.** Recreating the hook/store during a transient
   chat-surface remount does not abort or forget active jobs.

Negative

1. **Double-register.** Second register for same jobId aborts the first.

Edge

1. **`abortAll`.** Aborts every live controller; subsequent
   `register` still works.

#### useAssetResolutionIndex

New test file.

Positive

1. **Chart lookup by assetId.** Given 3 chart tool results, returns the
   matching payload in O(1).
2. **Cross-kind lookup.** Given mixed messages, each `get*` returns only
   matching kind.
3. **Candidate listing.** `listCandidates` returns deduped candidates with
   aliases (delegates to existing identity helpers).
4. **Repair candidates.** `listCandidates` includes enough alias/title/source
   metadata for Phase 0 underscore, UUID-fragment, and kind-singleton repairs.

Negative

1. **Missing asset returns null.** No throw.

Edge

1. **Empty messages.** All getters return `null`; candidates `[]`.
1. **Index rebuilds on messages change.** Update messages, new asset
   retrievable; old asset no longer retrievable.

#### useComposeMediaMaterialization

New test file.

1. **Happy path.** Calls into FFmpeg executor; returns success envelope.
2. **Canonicalization repair propagates.** Envelope carries `repairs` when
   Phase 0 fired.
3. **Source rehydration.** A chart/graph clip with only a governed asset id
   fetches source from storage before rasterization.
4. **Browser-short explainer.** Burned-caption mode materializes image beats
   and preserves `sourceAssetId` lineage.
5. **Abort mid-materialization.** Returns a canceled envelope; does not
   throw.
6. **Timeout/failure preservation.** `asset_too_large`,
   `ffmpeg_executor_timeout`, `audio_generation_timeout`, and
   `source_rehydration_failed` keep their existing failure-code surfaces.

#### useRuntimeSnapshots

New test file.

1. **Persist + restore round-trip.** Snapshot survives across a re-render.
2. **Keyed by jobId.** Different jobs don't collide.
3. **Cleared on conversation change.** Switching conversationId purges.
4. **Invalid stale plan.** Restored stale compose state with unresolved aliases
   fails locally with `invalid_plan`; it does not silently enqueue deferred
   work.

### 2.3 Risks

- **Hook order churn** is the classic React gotcha. Each extracted hook must
  be unconditionally called in the composing hook (no conditional `use*`).
- **Shared state migration.** The module-level `ACTIVE_BROWSER_RUNTIME_CONTROLLERS`
   Map is currently test-resettable and intentionally survives transient chat
   surface remounts. Replace it only with a provider/singleton store with the
   same lifetime; do not move it into a remount-prone component-local ref.

### Rollback

Keep both the new hook files and the original file in the same PR. If the
split destabilizes, revert is a single `git revert`.

## 3. Blast radius summary

| File | Change |
| ---- | ------ |
| `src/lib/graphs/graph-geometry.ts` | New ~350 LOC |
| `src/lib/graphs/graph-validation.ts` | New ~50 LOC (single source for `getGraphValidationIssue`) |
| `src/lib/graphs/GraphSvg.tsx` | Strip geometry, consume `GraphGeometry` (-500 LOC) |
| `src/lib/graphs/graph-svg-markup.ts` | Strip geometry, consume `GraphGeometry` (-500 LOC) |
| `src/lib/graphs/graph-geometry.test.ts` | New ~200 LOC |
| `src/lib/svg-utilities/index.ts` | New ~60 LOC |
| `src/lib/svg-utilities/parse-svg-dimensions.test.ts` | New |
| `src/lib/media/browser-runtime/svg-rasterization.ts` | Import from shared module |
| `src/lib/media/server/compose-media-plan-materialization.ts` | Import from shared module |
| `src/hooks/chat/useBrowserJobOrchestration.ts` | New ~200 LOC |
| `src/hooks/chat/useAssetResolutionIndex.ts` | New ~200 LOC |
| `src/hooks/chat/useComposeMediaMaterialization.ts` | New ~350 LOC |
| `src/hooks/chat/useRuntimeSnapshots.ts` | New ~120 LOC |
| `src/hooks/chat/useBrowserCapabilityRuntime.ts` | Rewrite as composition (-1500 LOC) |

Net: ~ –1,200 LOC; four new testable hooks + shared layout/geometry model.

## 4. Gate

- Visual snapshot corpus (9 graph cases) preserves each renderer's own
   byte-identical pre/post output.
- `npm run test` at 0 regressions.
- `npm run qa:runtime-integrity` at exit 0.
- Manual smoke: compose a landscape video in localhost, inspect the
  resulting PNG frames for the chart beat to confirm no visual drift.
