# Execution Plan

Strategic ordering of the six phase specs into merge-sized pull requests.
Priority order is **user-visible correctness > safety > structure >
performance > polish**. Every PR must ship green on both `npm run test` and
`npm run qa:runtime-integrity`.

## Principles

1. **Behavior-preserving changes before structural ones.** Ship bug fixes
   (Phase 0) first so production unblocks independent of refactors.
2. **Snapshot before refactor.** Any PR that risks visual drift (Phase 2,
   Phase 5 renderer extraction) captures byte-level snapshots **in the same
   PR that introduces them** and then a second PR performs the extraction
   against those snapshots.
3. **Each PR has a failing-on-main reproduction test** (when fixing a bug).
4. **No PR exceeds ~500 changed LOC** excluding generated snapshots + tests.
5. **One experiment at a time.** Performance PRs do not ride with structural
   PRs.

## PR sequence

### PR1 — Phase 0.1–0.3 (canonicalizer repair layers)

**Scope.** Implements §2.1 (underscore normalization), §2.2 (UUID-fragment
fallback), §2.3 (kind-singleton repair), plus new
`canonicalizeMediaCompositionPlanWithRepairs` function and its tests.

**Gate requires.**
- Failing-on-main reproduction test for the exact screenshot error.
- 20 canonicalizer tests green.
- Full suite green.

**Risk.** Low — fully additive; strict path still exists as outer fallback.

### PR2 — Phase 0.4–0.5 (envelope repairs + prompt contract)

**Scope.** Surface `repairs` on envelope + UI chip; update compose_media tool
description with `availableAssets` enumeration sourced from
`list_conversation_media_assets`.

**Gate requires.**
- 2 envelope tests + 2 hook-orchestration tests green.
- Manual prompt smoke: request a compose with anchored asset list; model
  uses exact ids.

**Risk.** Low — envelope field is optional; prompt change is additive.

### PR3 — Phase 1 (robustness / security)

**Scope.** SVG size cap, FFmpeg asset size validation, executor watchdog,
audio-fetch timeout, worker cleanup on error.

**Gate requires.**
- 35+ new tests (see §§1–5 of Phase 1).
- Manual kill-switch drill: hang the runtime-audio endpoint locally and
  confirm the job times out, not hangs.

**Risk.** Medium — watchdog tuning may need a follow-up if genuine long
renders exist in production.

### PR4 — Phase 2.1 + 2.2 (geometry + shared SVG utilities)

**Scope.** Extract `computeGraphGeometry` + `graph-validation`; move SVG
utilities to `@/lib/svg-utilities`. Both `GraphSvg.tsx` and
`graph-svg-markup.ts` consume the new geometry.

**Gate requires.**
- 8-graph snapshot corpus captured **before** the refactor (first commit in
  PR) and unchanged after refactor (second commit).
- ≥ 600 LOC reduction.
- Bundle size delta ≤ +2% (measured via existing
  runtime-inventory report).

**Risk.** Medium — visual drift is blocking. Mitigated by the
snapshot-first discipline.

### PR5 — Phase 2.3 (hook split)

**Scope.** Extract `useBrowserJobOrchestration`,
`useAssetResolutionIndex`, `useComposeMediaMaterialization`,
`useRuntimeSnapshots`. Rewrite `useBrowserCapabilityRuntime` as composition.

**Gate requires.**
- All existing `useBrowserCapabilityRuntime.test.tsx` tests pass unchanged.
- Each new hook has ≥ 4 tests.
- Main hook ≤ 500 LOC.

**Risk.** High — largest PR. Merge at the start of a dev cycle, not before
a release.

### PR6 — Phase 3 (performance)

**Scope.** Bubble lookup, mermaid token batching, shared base64 helper,
asset-index complexity lock.

**Gate requires.**
- Complexity-assertion tests green.
- No visual regression (snapshot corpus from PR4).
- Lighthouse budget unchanged (`lighthouse-prod.json`).

**Risk.** Low — each item is a drop-in performance swap.

### PR7 — Phase 4 (error taxonomy)

**Scope.** `ComposeMediaError` subclasses, audio-fetch retry with backoff,
FFmpeg head+tail logs, truncation diagnostics on envelope.

**Gate requires.**
- 20+ new tests across §§1–4.
- Deprecation alias for `InvalidComposeMediaAssetReadinessError` present.
- Manual smoke: induce a 503 locally; confirm retry + eventual success.

**Risk.** Medium — retry interacts with the Phase-1 timeout; tested in
Phase 4 §2 test 7.

### PR8 — Phase 5 (clarity + tests)

**Scope.** Constants files, per-kind renderer extraction (snapshot-first),
`__resetMermaidForTests`, caption-burn tests, `buildExecutionArgs`
extraction, graph polling tests, magic-number lint.

**Gate requires.**
- Renderer extraction byte-identical to Phase-4 snapshots.
- Caption-burn coverage ≥ 90%.
- `ffmpeg-args` coverage ≥ 95%.
- `scripts/validate-no-magic-numbers.mjs` green.

**Risk.** Low — mostly additive tests + constant extraction.

## Aggregate gates (every PR)

1. `npm run lint` exits 0.
2. `npm run test` exits 0 with ≥ current test count + new tests from PR.
3. `npm run qa:runtime-integrity` exits 0.
4. `npm run build` exits 0.
5. No net increase in open TODO / FIXME comments.
6. `docs/_refactor/video_harden/` spec for the PR linked in the PR body.

## Release checkpoints

After PR2 (end of Phase 0): production bug fixed, ship a patch release.

After PR3 (end of Phase 1): safety hardening in place, ship a patch release.

After PR5 (end of Phase 2): structural refactor landed, ship a minor release
with visual-regression sign-off from design.

After PR7 (end of Phase 4): error contract updated; release notes call out
new `failureCode` values for operators.

After PR8 (end of Phase 5): close-out. Run the full Knuth/Fowler/Martin
audit checklist again; archive this folder under `docs/_refactor/_archive/`.

## Risk register (cross-PR)

| Risk | Owner | Mitigation |
| ---- | ----- | ---------- |
| Canonicalizer kind-singleton repair masks a real bug | Runtime | Dev-only env flag to disable §2.3; envelope logs every repair |
| 8-graph snapshot corpus insufficient | Visual | Expand to 20 before PR4; design review |
| Hook split destabilizes compose flow | Runtime | PR5 lands at start of cycle; feature-flag route not used — revert via git |
| Retry amplifies outage | Runtime | 3-attempt cap + bounded total wait; circuit breaker left for future phase |
| Watchdog kills legit long renders | Runtime | PER_SECOND constant tunable without code deploy (env) |

## Metrics to watch post-merge

- Compose-media job error rate broken down by new `failureCode` enum.
- Count of envelopes with `repairs.length > 0` (Phase 0 effectiveness).
- Count of envelopes with `diagnostics.truncations.length > 0` (Phase 4
  signal).
- FFmpeg watchdog timeout count per 1k jobs (Phase 1 tuning signal).
- Audio fetch retry count per 1k jobs (upstream-health signal).

## Rollback playbook

Each PR is revertable without cross-PR dependency except:
- PR2 depends on PR1 (envelope field sourced from PR1's return type).
- PR6 depends on PR4 (`bubbleSizeLookup` defined in `graph-geometry.ts`).
- PR8 depends on PR4 (renderer extraction operates on the extracted
  geometry).

If PR4 must be reverted, PR6 and PR8 revert with it as a group.

## Exit criteria (end of initiative)

- Zero reports of "Compose media plan contains unresolved asset references"
  in the week following PR2.
- Graph and chart rasterization share a single `svg-rasterization.ts` path
  (already true; Phase 2 extends the sharing to geometry).
- `useBrowserCapabilityRuntime.ts` ≤ 500 LOC.
- Every media failure path produces a typed error with an enumerated
  `failureCode`.
- Test count ≥ 4,349 + 80 new tests (minimum).
- `npm run qa:runtime-integrity` green continuously across all PRs.
