# Video Pipeline Hardening — Refactor Spec Index

**Scope.** End-to-end hardening of the browser-and-server media composition pipeline:
chart rasterization, graph rasterization, caption burn, TTS audio, FFmpeg WASM
composition, media-plan canonicalization, and the orchestrating
`useBrowserCapabilityRuntime` hook.

**Motivation.** Two in-production failures and an internal
Knuth/Fowler/Martin audit converged on the same underlying debts:

1. A strict-match media-plan canonicalizer with no recovery layer produced a
   user-visible `Compose media plan contains unresolved asset references` error
   when the LLM invented asset ID names it had seen in prose.
2. Two parallel SVG→PNG paths (mermaid, graph) drifted; one lacked error
   boundaries and was only fixed recently via `svg-rasterization.ts`.
3. Duplicated ~1,000 LOC graph rendering across `GraphSvg.tsx` and
   `graph-svg-markup.ts`.
4. One 2,100-LOC god hook (`useBrowserCapabilityRuntime`) with linear scans,
   missing timeouts, and error-type conflation.
5. Hard-coded magic numbers across caption burn, chart/graph dimensions,
   FFmpeg log tails, and TTS byte caps.

**Deliverable shape.** One spec per phase under this folder, each containing:

- **Context + problem statement** (grounded in exact file paths + line numbers).
- **Target design** (with API signatures).
- **Acceptance criteria** (measurable, binary).
- **Positive, negative, and edge-case test cases** (ready to translate into
  Vitest).
- **Risk register + rollback plan**.
- **Estimated blast radius** (number of files touched).

**Phase documents.**

| # | Phase | File | Theme |
| - | ----- | ---- | ----- |
| 0 | Asset resolution repair | [00-phase-0-asset-resolution-repair.md](00-phase-0-asset-resolution-repair.md) | Fix the production `unresolved asset references` bug; add LLM-drift tolerance; enrich tool prompt. |
| 1 | Robustness & security | [01-phase-1-robustness-security.md](01-phase-1-robustness-security.md) | SVG size cap, FFmpeg asset size validation, executor watchdog, audio fetch timeout, worker cleanup on error. |
| 2 | DRY / structural refactor | [02-phase-2-dry-structural.md](02-phase-2-dry-structural.md) | Extract `computeGraphGeometry`, move shared SVG utils, split the god hook. |
| 3 | Performance | [03-phase-3-performance.md](03-phase-3-performance.md) | Bubble-chart lookup map, batched mermaid color reads, O(n²) base64 fix, asset index. |
| 4 | Error taxonomy | [04-phase-4-error-taxonomy.md](04-phase-4-error-taxonomy.md) | Specific error subclasses, audio fetch retry, FFmpeg head+tail logs, truncation envelopes. |
| 5 | Clarity & tests | [05-phase-5-clarity-and-tests.md](05-phase-5-clarity-and-tests.md) | Closeout ledger for constants extraction, markup-surface dedupe, Mermaid test reset, caption-burn coverage, FFmpeg arg seams, and graph poll coverage. |

**Execution plan.** See [execution-plan.md](execution-plan.md) for the
ordering, PR slicing, acceptance gates, and risk-weighted rollout.

**Ground rules (all phases).**

1. Every PR preserves `npm run test` (currently 4,349 tests) and
   `npm run qa:runtime-integrity` at exit 0.
2. No phase adds a public API without a test asserting its contract.
3. No phase introduces new magic numbers — anything hard-coded goes into a
   dedicated constants file with a one-sentence justification comment.
4. Every bug fix ships with a regression test that fails on `main` and passes
   after the fix.
5. Each phase's spec is the single source of truth for its acceptance
   criteria; the executing PR must link to it.

**Out of scope (for now).**

- Migrating compose_media off WASM (browser) or `@resvg/resvg-js` (server).
- Adding new video effects (transitions, filters).
- Changing the governed-asset storage contract.
- Replacing mermaid with a different chart engine.
