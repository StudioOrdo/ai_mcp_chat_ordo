# Phase 5 — Clarity & Tests

**Goal.** Close the remaining clarity and coverage debt left after Phases 2-4
without reopening already-stable runtime seams. Phase 2 extracted shared graph
geometry, Phase 3 introduced Mermaid theme-cache behavior, and Phase 4 shipped
error taxonomy, truncation diagnostics, and FFmpeg log capture. Phase 5 is the
closeout layer: constants extraction, markup-surface dedupe, direct pure-helper
coverage, and explicit edge-branch tests.

> **Closeout update (April 25, 2026).** This phase is now implemented for the
> shipped scope. The remaining items below are intentionally deferred follow-on
> refactors, not blockers for Phase 5 completion.

## 5.1 Delivered state

Verified current codebase facts:

- `src/lib/graphs/graph-svg-markup.ts` now delegates directly to
  `GraphSvg.tsx` via `renderToStaticMarkup(...)`, so server markup and browser
  rendering share one renderer surface.
- Graph visual constants now live in
  `src/lib/graphs/graph-visual-constants.ts`, including dimensions, table/tick
  caps, bubble radii, and heatmap alpha ranges.
- SVG poll timing now lives in
  `src/lib/media/browser-runtime/rasterization-constants.ts`.
- FFmpeg log head/tail limits now live in
  `src/lib/media/browser-runtime/ffmpeg-worker-limits.ts`.
- Caption sizing, padding, line caps, overlay sizing, and stroke rules now live
  in `src/lib/media/browser-runtime/caption-burn-constants.ts`.
- FFmpeg argument construction now lives in the pure helper
  `src/lib/media/browser-runtime/ffmpeg-args.ts`, and the worker imports it.
- `burnCaptionIntoImageBlob(...)` now has focused unit coverage for success,
  draw order, image decode failure, missing canvas context, and `toBlob(...)`
  failure.
- Graph poll exhaustion now has direct coverage in
  `graph-image-derivation.poll.test.tsx` using the current error wording.
- `npm run lint` now chains the dedicated guard
  `scripts/check-media-clarity-constants.mjs` to keep the extracted constants
  from drifting back inline.

## 5.2 Acceptance

- [x] Graph width and height defaults are named constants.
- [x] SVG byte-limit and FFmpeg asset-size limit are named constants.
- [x] Graph poll-frame limit is extracted into a shared constants module.
- [x] FFmpeg log head/tail line limits are extracted into a shared constants module.
- [x] Caption burn sizing and truncation caps are extracted into a shared constants module.
- [x] A dedicated no-magic-numbers lint/meta script exists and is wired into `npm run lint`.
- [x] `graph-svg-markup.ts` no longer duplicates per-kind renderer branches.
- [x] Graph renderer snapshot parity is preserved after unifying the markup surface.
- [x] Sequential Mermaid tests can reset the initialization cache deterministically.
- [x] Theme-token cache reset is covered directly in `mermaid-image-derivation.test.ts`.
- [x] MutationObserver-absent fallback behavior is covered directly in `mermaid-image-derivation.test.ts`.
- [x] Caption-line truncation measurement has a dedicated unit test file.
- [x] `burnCaptionIntoImageBlob(...)` has dedicated unit coverage.
- [x] Draw order, image-load failure, and PNG-blob failure branches are covered directly.
- [x] `buildExecutionArgs(...)` lives outside the worker in a pure helper module.
- [x] The extracted helper has no `self`, DOM, or FFmpeg-instance references.
- [x] Each supported plan family has direct argument-shape coverage.
- [x] Graph render failures include graph kind and row count in error output.
- [x] Graph-table truncation is covered directly.
- [x] The explicit poll-timeout path is directly tested.
- [x] Poll frame count and delay are shared constants rather than inline literals.

## 5.3 Verification

Phase 5-specific validation now includes:

1. `npx vitest run src/lib/graphs/graph-geometry.test.tsx`
2. `npx vitest run src/lib/media/browser-runtime/ffmpeg.worker.test.ts`
3. `npx vitest run src/lib/media/browser-runtime/ffmpeg-browser-executor.test.ts`
4. `npx vitest run src/lib/media/browser-runtime/ffmpeg-args.test.ts`
5. `npx vitest run src/lib/media/browser-runtime/browser-short-caption-burn.test.ts`
6. `npx vitest run src/lib/media/browser-runtime/graph-image-derivation.test.tsx`
7. `npx vitest run src/lib/media/browser-runtime/graph-image-derivation.poll.test.tsx`
8. `npx vitest run src/lib/media/browser-runtime/mermaid-image-derivation.test.ts`
9. `npm run lint:clarity`

The graph snapshot suite was rerun after unifying `graph-svg-markup.ts` onto
`GraphSvg.tsx`, and parity was re-established before closing the slice.

## 5.4 Ownership carry-forward

Phase 5 stays intentionally narrow relative to prior phases:

- **Phase 2** remains the owner of shared graph geometry and the media-runtime
  structural split.
- **Phase 3** remains the owner of Mermaid theme caching; Phase 5 only adds the
  deterministic reset seam and coverage around it.
- **Phase 4** remains the owner of FFmpeg diagnostics, truncation diagnostics,
  and specific error taxonomy; Phase 5 only improves clarity and direct tests
  around those surfaces.

## 5.5 Residual follow-on work

These are not blockers for Phase 5 closeout:

- Split `GraphSvg.tsx` itself into per-kind shared renderer helpers if future
  maintenance pressure justifies it.
- Add a production-only assertion around Mermaid reset tree-shaking or no-op
  semantics if that becomes a packaging concern.
- Expand graph polling tests to include the fallback branch where the test ID is
  missing but a generic SVG still appears.

## 5.6 Blast radius

| File | Final Phase 5 status |
| ---- | -------------------- |
| `src/lib/graphs/graph-visual-constants.ts` | Owns graph dimensions, tick caps, table caps, bubble radii, and heatmap alpha constants |
| `src/lib/graphs/graph-geometry.ts` | Consumes shared graph visual constants |
| `src/lib/graphs/GraphSvg.tsx` | Remains the single renderer surface for browser and markup output |
| `src/lib/graphs/graph-svg-markup.ts` | Delegates directly to `GraphSvg.tsx` |
| `src/lib/media/browser-runtime/rasterization-constants.ts` | Owns SVG byte and poll timing constants |
| `src/lib/media/browser-runtime/ffmpeg-worker-limits.ts` | Owns asset-size and FFmpeg log limit constants |
| `src/lib/media/browser-runtime/caption-burn-constants.ts` | Owns caption-burn rendering constants |
| `src/lib/media/browser-runtime/browser-short-caption-burn.ts` | Uses shared constants and has direct unit coverage |
| `src/lib/media/browser-runtime/browser-short-caption-burn.test.ts` | Covers truncation plus burn-path success and failures |
| `src/lib/media/browser-runtime/ffmpeg-args.ts` | Owns pure FFmpeg CLI construction |
| `src/lib/media/browser-runtime/ffmpeg-args.test.ts` | Covers image-only, audio-only, concat, explainer, and empty-plan shapes |
| `src/lib/media/browser-runtime/ffmpeg.worker.ts` | Imports pure arg helpers and shared log limits |
| `src/lib/media/browser-runtime/graph-image-derivation.tsx` | Uses shared poll constants and emits descriptive timeout text |
| `src/lib/media/browser-runtime/graph-image-derivation.poll.test.tsx` | Covers explicit poll exhaustion |
| `scripts/check-media-clarity-constants.mjs` | Guards extracted constant ownership at lint time |

## 5.7 Gate

Phase 5 is complete for the intended shipped scope.
