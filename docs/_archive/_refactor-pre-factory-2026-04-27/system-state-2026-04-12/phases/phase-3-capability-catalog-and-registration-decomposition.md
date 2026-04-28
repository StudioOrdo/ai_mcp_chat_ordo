# Phase 3 — Capability Catalog And Registration Decomposition

> Status: Complete
> Loop State: Full 55-capability catalog-bound runtime surface verified
> Goal: Split capability metadata and reduce registration drift without breaking the catalog's role as the single policy source.
> Prerequisites: Phase 0 complete, Phase 1 complete, Phase 2 complete

## Phase Intent

Phases 0 through 2 froze the higher-churn runtime seams well enough that the next concentration risk was the capability layer itself. Phase 3 is now complete: presentation, browser, job, and runtime registration surfaces all derive from the composed catalog, [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts) still owns the public 55-entry surface and projection helpers, [../../../../src/core/capability-catalog/families](../../../../src/core/capability-catalog/families) holds every raw capability-definition family, and [../../../../src/lib/chat/tool-composition-root.ts](../../../../src/lib/chat/tool-composition-root.ts) assembles the 11 bundle registrars through one ordered table plus shared bundle-registration tables. Phase 3 reduced concentration and registration drift without pretending the catalog abstraction itself was a mistake.

The target is not a blind file split. The target is a composed public catalog surface backed by smaller family or facet modules, plus a narrower and better-validated registration seam for the full runtime surface. Presentation, browser, and job projection are already catalog-derived. Phase 3 should build on that success and bring the runtime registration surface fully onto the same standard.

## Source Anchors

- [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts)
- [../../../../src/core/capability-catalog/capability-definition.ts](../../../../src/core/capability-catalog/capability-definition.ts)
- [../../../../src/core/capability-catalog/families/affiliate-capabilities.ts](../../../../src/core/capability-catalog/families/affiliate-capabilities.ts)
- [../../../../src/core/capability-catalog/families/admin-capabilities.ts](../../../../src/core/capability-catalog/families/admin-capabilities.ts)
- [../../../../src/core/capability-catalog/families/blog-capabilities.ts](../../../../src/core/capability-catalog/families/blog-capabilities.ts)
- [../../../../src/core/capability-catalog/families/calculator-capabilities.ts](../../../../src/core/capability-catalog/families/calculator-capabilities.ts)
- [../../../../src/core/capability-catalog/families/conversation-capabilities.ts](../../../../src/core/capability-catalog/families/conversation-capabilities.ts)
- [../../../../src/core/capability-catalog/families/corpus-capabilities.ts](../../../../src/core/capability-catalog/families/corpus-capabilities.ts)
- [../../../../src/core/capability-catalog/families/job-capabilities.ts](../../../../src/core/capability-catalog/families/job-capabilities.ts)
- [../../../../src/core/capability-catalog/families/media-capabilities.ts](../../../../src/core/capability-catalog/families/media-capabilities.ts)
- [../../../../src/core/capability-catalog/families/navigation-capabilities.ts](../../../../src/core/capability-catalog/families/navigation-capabilities.ts)
- [../../../../src/core/capability-catalog/families/profile-capabilities.ts](../../../../src/core/capability-catalog/families/profile-capabilities.ts)
- [../../../../src/core/capability-catalog/families/shared.ts](../../../../src/core/capability-catalog/families/shared.ts)
- [../../../../src/core/capability-catalog/families/theme-capabilities.ts](../../../../src/core/capability-catalog/families/theme-capabilities.ts)
- [../../../../src/core/capability-catalog/runtime-tool-projection.ts](../../../../src/core/capability-catalog/runtime-tool-projection.ts)
- [../../../../src/core/capability-catalog/runtime-tool-binding.ts](../../../../src/core/capability-catalog/runtime-tool-binding.ts)
- [../../../../src/frameworks/ui/chat/registry/capability-presentation-registry.ts](../../../../src/frameworks/ui/chat/registry/capability-presentation-registry.ts)
- [../../../../src/frameworks/ui/chat/registry/default-tool-registry.ts](../../../../src/frameworks/ui/chat/registry/default-tool-registry.ts)
- [../../../../src/lib/media/browser-runtime/browser-capability-registry.ts](../../../../src/lib/media/browser-runtime/browser-capability-registry.ts)
- [../../../../src/lib/jobs/job-capability-registry.ts](../../../../src/lib/jobs/job-capability-registry.ts)
- [../../../../src/lib/chat/tool-composition-root.ts](../../../../src/lib/chat/tool-composition-root.ts)
- [../../../../src/lib/chat/tool-bundles/bundle-registration.ts](../../../../src/lib/chat/tool-bundles/bundle-registration.ts)
- [../../../../src/lib/chat/tool-bundles/admin-tools.ts](../../../../src/lib/chat/tool-bundles/admin-tools.ts)
- [../../../../src/lib/chat/tool-bundles/affiliate-tools.ts](../../../../src/lib/chat/tool-bundles/affiliate-tools.ts)
- [../../../../src/lib/chat/tool-bundles/blog-tools.ts](../../../../src/lib/chat/tool-bundles/blog-tools.ts)
- [../../../../src/lib/chat/tool-bundles/calculator-tools.ts](../../../../src/lib/chat/tool-bundles/calculator-tools.ts)
- [../../../../src/lib/chat/tool-bundles/conversation-tools.ts](../../../../src/lib/chat/tool-bundles/conversation-tools.ts)
- [../../../../src/lib/chat/tool-bundles/corpus-tools.ts](../../../../src/lib/chat/tool-bundles/corpus-tools.ts)
- [../../../../src/lib/chat/tool-bundles/job-tools.ts](../../../../src/lib/chat/tool-bundles/job-tools.ts)
- [../../../../src/lib/chat/tool-bundles/media-tools.ts](../../../../src/lib/chat/tool-bundles/media-tools.ts)
- [../../../../src/lib/chat/tool-bundles/navigation-tools.ts](../../../../src/lib/chat/tool-bundles/navigation-tools.ts)
- [../../../../src/lib/chat/tool-bundles/profile-tools.ts](../../../../src/lib/chat/tool-bundles/profile-tools.ts)
- [../../../../src/lib/chat/tool-bundles/theme-tools.ts](../../../../src/lib/chat/tool-bundles/theme-tools.ts)
- [../../../../src/lib/chat/registry-sync.test.ts](../../../../src/lib/chat/registry-sync.test.ts)
- [../../../../src/lib/chat/tool-composition-root.test.ts](../../../../src/lib/chat/tool-composition-root.test.ts)
- [../../../../src/core/capability-catalog/catalog-coverage.test.ts](../../../../src/core/capability-catalog/catalog-coverage.test.ts)
- [../../../../src/core/capability-catalog/registry-convergence.test.ts](../../../../src/core/capability-catalog/registry-convergence.test.ts)
- [../../../../src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts)
- [../../../../tests/full-registry-coverage.test.ts](../../../../tests/full-registry-coverage.test.ts)

## Refreshed Current State

### The Catalog Is Already The Policy Source

- [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts) still defines the public 55-entry catalog surface and owns `projectPresentationDescriptor(...)`, `projectJobCapability(...)`, `projectBrowserCapability(...)`, and `getCatalogDefinition(...)` near its tail.
- Four structural extraction slices have landed: raw admin, affiliate, blog, calculator, conversation, corpus, job, media, navigation, profile, and theme definitions now live in [../../../../src/core/capability-catalog/families/admin-capabilities.ts](../../../../src/core/capability-catalog/families/admin-capabilities.ts), [../../../../src/core/capability-catalog/families/affiliate-capabilities.ts](../../../../src/core/capability-catalog/families/affiliate-capabilities.ts), [../../../../src/core/capability-catalog/families/blog-capabilities.ts](../../../../src/core/capability-catalog/families/blog-capabilities.ts), [../../../../src/core/capability-catalog/families/calculator-capabilities.ts](../../../../src/core/capability-catalog/families/calculator-capabilities.ts), [../../../../src/core/capability-catalog/families/conversation-capabilities.ts](../../../../src/core/capability-catalog/families/conversation-capabilities.ts), [../../../../src/core/capability-catalog/families/corpus-capabilities.ts](../../../../src/core/capability-catalog/families/corpus-capabilities.ts), [../../../../src/core/capability-catalog/families/job-capabilities.ts](../../../../src/core/capability-catalog/families/job-capabilities.ts), [../../../../src/core/capability-catalog/families/media-capabilities.ts](../../../../src/core/capability-catalog/families/media-capabilities.ts), [../../../../src/core/capability-catalog/families/navigation-capabilities.ts](../../../../src/core/capability-catalog/families/navigation-capabilities.ts), [../../../../src/core/capability-catalog/families/profile-capabilities.ts](../../../../src/core/capability-catalog/families/profile-capabilities.ts), and [../../../../src/core/capability-catalog/families/theme-capabilities.ts](../../../../src/core/capability-catalog/families/theme-capabilities.ts), with shared role and retry policy constants in [../../../../src/core/capability-catalog/families/shared.ts](../../../../src/core/capability-catalog/families/shared.ts).
- [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts) is now a pure composition-and-projection layer rather than a mixed composition file with remaining inline raw capability blocks.
- [../../../../src/core/capability-catalog/capability-definition.ts](../../../../src/core/capability-catalog/capability-definition.ts) already models the decomposition target at the type level. The definition is broken into facets for core identity, runtime, presentation, prompt hints, MCP export intent, schema, executor binding, and validation binding.
- [../../../../src/frameworks/ui/chat/registry/capability-presentation-registry.ts](../../../../src/frameworks/ui/chat/registry/capability-presentation-registry.ts), [../../../../src/lib/media/browser-runtime/browser-capability-registry.ts](../../../../src/lib/media/browser-runtime/browser-capability-registry.ts), and [../../../../src/lib/jobs/job-capability-registry.ts](../../../../src/lib/jobs/job-capability-registry.ts) already derive their metadata from the catalog. Phase 3 should not reopen those wins unless a structural extraction requires a small import adjustment.

### Runtime Registration Is Catalog-Bound Across The Full Surface

- [../../../../src/core/capability-catalog/runtime-tool-binding.ts](../../../../src/core/capability-catalog/runtime-tool-binding.ts) now binds all 55 runtime tools through `CATALOG_BOUND_TOOL_NAMES`, and that list is derived from capabilities that declare both runtime-binding facets instead of being maintained as a separate manual constant.
- `getCatalogBoundToolNamesForBundle(...)` now groups the full surface by `executorBinding.bundleId` across admin, affiliate, blog, calculator, conversation, corpus, job, media, navigation, profile, and theme.
- [../../../../src/core/capability-catalog/runtime-tool-projection.ts](../../../../src/core/capability-catalog/runtime-tool-projection.ts) now projects runtime descriptors from catalog-owned schema only, and [../../../../src/core/capability-catalog/catalog-input-schemas.ts](../../../../src/core/capability-catalog/catalog-input-schemas.ts) keeps the remaining shared schema literals in a pure-data module so runtime binding does not reintroduce initialization cycles through tool-module imports.
- [../../../../src/lib/chat/tool-composition-root.ts](../../../../src/lib/chat/tool-composition-root.ts) still derives bundle sequencing from one ordered registrar table, and [../../../../src/lib/chat/tool-bundles/bundle-registration.ts](../../../../src/lib/chat/tool-bundles/bundle-registration.ts) still provides the shared seam that keeps `toolNames` and registration order aligned.
- [../../../../src/lib/chat/tool-bundles/admin-tools.ts](../../../../src/lib/chat/tool-bundles/admin-tools.ts), [../../../../src/lib/chat/tool-bundles/affiliate-tools.ts](../../../../src/lib/chat/tool-bundles/affiliate-tools.ts), [../../../../src/lib/chat/tool-bundles/blog-tools.ts](../../../../src/lib/chat/tool-bundles/blog-tools.ts), [../../../../src/lib/chat/tool-bundles/calculator-tools.ts](../../../../src/lib/chat/tool-bundles/calculator-tools.ts), [../../../../src/lib/chat/tool-bundles/conversation-tools.ts](../../../../src/lib/chat/tool-bundles/conversation-tools.ts), [../../../../src/lib/chat/tool-bundles/corpus-tools.ts](../../../../src/lib/chat/tool-bundles/corpus-tools.ts), [../../../../src/lib/chat/tool-bundles/job-tools.ts](../../../../src/lib/chat/tool-bundles/job-tools.ts), [../../../../src/lib/chat/tool-bundles/navigation-tools.ts](../../../../src/lib/chat/tool-bundles/navigation-tools.ts), [../../../../src/lib/chat/tool-bundles/profile-tools.ts](../../../../src/lib/chat/tool-bundles/profile-tools.ts), and [../../../../src/lib/chat/tool-bundles/theme-tools.ts](../../../../src/lib/chat/tool-bundles/theme-tools.ts) now project catalog-bound descriptors directly inside their shared registration tables, while [../../../../src/lib/chat/tool-bundles/media-tools.ts](../../../../src/lib/chat/tool-bundles/media-tools.ts) continues to register its single bound tool bundle-wide through the shared helper.
- A grep pass over [../../../../src/lib/chat/tool-bundles](../../../../src/lib/chat/tool-bundles) still shows no bundle-local explicit `registry.register(...)` calls outside the shared helper in [../../../../src/lib/chat/tool-bundles/bundle-registration.ts](../../../../src/lib/chat/tool-bundles/bundle-registration.ts).
- That means the catalog now governs names, runtime-binding metadata, bundle ownership, and descriptor projection across the entire tool set while bundle-local dependency construction stays explicit inside the registration definitions.

### Validation Already Exists, But It Protects Different Seams

- [../../../../src/core/capability-catalog/catalog-coverage.test.ts](../../../../src/core/capability-catalog/catalog-coverage.test.ts) proves every bundle tool has a catalog entry and every catalog entry appears in bundle descriptors.
- [../../../../src/core/capability-catalog/registry-convergence.test.ts](../../../../src/core/capability-catalog/registry-convergence.test.ts) proves presentation, browser, and job registries are catalog-derived and no longer use their previous manual descriptor helpers.
- [../../../../src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts) freezes the full 55-capability runtime-binding surface, proves the converted bundles no longer use the old bundle-local factory registrations, and asserts the current bundle-id grouping across every bound family.
- [../../../../src/lib/chat/registry-sync.test.ts](../../../../src/lib/chat/registry-sync.test.ts) checks ToolRegistry alignment with presentation and browser registries for the non-corpus surface and freezes `compose_media` cross-registry parity.
- [../../../../src/lib/chat/tool-composition-root.test.ts](../../../../src/lib/chat/tool-composition-root.test.ts) freezes runtime manifest counts and ordering, which makes composition-root churn visible even before route or model code is involved.

### Focused Baseline Is Green After Contract Cleanup

- The earlier focused baseline passed 7 of 8 files and 121 of 131 tests, with [../../../../tests/full-registry-coverage.test.ts](../../../../tests/full-registry-coverage.test.ts) carrying the only red contract.
- That renderer-surface contract is now explicit and green again: fallback-rendered tools can still have catalog-derived presentation descriptors, and [../../../../src/frameworks/ui/chat/registry/capability-presentation-registry.ts](../../../../src/frameworks/ui/chat/registry/capability-presentation-registry.ts) now keeps the legacy `navigate` alias while exposing only canonical descriptor rows from the descriptor list.
- [../../../../src/frameworks/ui/chat/registry/default-tool-registry.ts](../../../../src/frameworks/ui/chat/registry/default-tool-registry.ts) now documents the intended split between descriptor presence and custom renderer presence.
- The focused Phase 3 verification bundle now passes 11 of 11 files and 156 of 156 tests across catalog, registry, browser, job, and renderer coverage suites.

### Minimal Safe Incremental Splits

- The safest first split was not every family. It was the subset that already had runtime binding facets and bundle-level adoption: admin, blog, corpus, and media.
- The next safe slices were low-runtime-risk metadata that still shrank the monolith meaningfully: navigation, conversation, profile, calculator, and theme. The first widening pass promoted the dependency-light internal tools in calculator, navigation, and theme into the binding layer, and the second widening pass added registry-backed and preference-backed tools that still reused existing bundle-local dependencies.
- The final widening sweep added executor and validator facets across the remaining admin, affiliate, blog, calculator, conversation, corpus, job, profile, and theme capabilities; extended the binding deps contract to cover profile, analytics, job, vector-store, blog-production, and journal-editorial seams; and the cleanup pass finished the remaining catalog-owned schema work so runtime binding no longer depends on descriptor-level schema fallback.
- With all 56 capabilities now bound and all 11 bundles registered through catalog-bound descriptors or the shared bundle-wide helper, Phase 3 no longer has a remaining manual-registration boundary.
- The public surface should stay composed. Whether the project chooses `catalog/index.ts` plus family modules or keeps `catalog.ts` as the aggregator, callers should continue importing one stable `CAPABILITY_CATALOG` surface and the existing projection helpers.

## Drift Traps

- Splitting [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts) into many files without reducing runtime-registration duplication.
- Replacing one central definition file with multiple partial copies that each repeat labels, roles, or execution metadata.
- Treating the already-green presentation, browser, and job projections as proof that runtime registration cannot drift.
- Widening this phase into prompt-runtime, request-scoped tool routing, or execution-target abstraction before the catalog and registration seam itself is tighter.
- Reopening the now-green renderer-surface contract in [../../../../tests/full-registry-coverage.test.ts](../../../../tests/full-registry-coverage.test.ts) without a deliberate product decision about descriptor presence versus fallback rendering.

## Pre-Implementation QA Gate

- [x] Refresh current catalog size and concentration.
- [x] Refresh current manual registration touchpoints.
- [x] Refresh existing catalog and registry drift coverage.
- [x] Capture a focused Phase 3 baseline.
- [x] Define the minimal safe first split of the catalog.

## Verified Current QA Baseline

### Protected Test Surface

- [../../../../src/core/capability-catalog/catalog.test.ts](../../../../src/core/capability-catalog/catalog.test.ts) covers catalog facets and projection helpers.
- [../../../../src/core/capability-catalog/catalog-coverage.test.ts](../../../../src/core/capability-catalog/catalog-coverage.test.ts) freezes bundle-to-catalog name parity.
- [../../../../src/core/capability-catalog/registry-convergence.test.ts](../../../../src/core/capability-catalog/registry-convergence.test.ts) freezes presentation, browser, and job registry derivation from the catalog.
- [../../../../src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts) protects the full 55-capability runtime-binding surface and its bundle-local factory removals.
- [../../../../src/lib/chat/registry-sync.test.ts](../../../../src/lib/chat/registry-sync.test.ts) protects cross-registry alignment at the ToolRegistry layer.
- [../../../../src/lib/chat/tool-composition-root.test.ts](../../../../src/lib/chat/tool-composition-root.test.ts) protects manifest counts, ordering, and deterministic composition-root rebuilds.
- [../../../../src/lib/chat/tool-capability-routing.test.ts](../../../../src/lib/chat/tool-capability-routing.test.ts) freezes current request-scoped admin lane narrowing so Phase 3 does not accidentally reopen that seam.
- [../../../../tests/full-registry-coverage.test.ts](../../../../tests/full-registry-coverage.test.ts) now acts as a renderer-surface contract test for fallback-rendered defaults without assuming descriptor absence for every non-chat tool.

### Focused Baseline Verification

- Historical baseline before the contract cleanup:
  - `npm exec vitest run src/core/capability-catalog/catalog.test.ts src/core/capability-catalog/catalog-coverage.test.ts src/core/capability-catalog/registry-convergence.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/lib/chat/registry-sync.test.ts tests/full-registry-coverage.test.ts src/lib/chat/tool-composition-root.test.ts src/lib/chat/tool-capability-routing.test.ts`
  - Result: 7 files passed, 1 file failed. 121 tests passed, 10 tests failed, 131 total.
- Current focused verification after the contract cleanup, bundle-id registration derivation, composition-root registrar-table refactor, full catalog family extraction, and the full runtime-binding sweep:
  - `npm exec vitest run src/core/capability-catalog/catalog.test.ts src/core/capability-catalog/catalog-coverage.test.ts src/core/capability-catalog/registry-convergence.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/lib/chat/registry-sync.test.ts src/lib/chat/tool-composition-root.test.ts src/lib/chat/tool-capability-routing.test.ts src/lib/media/browser-runtime/browser-capability-registry.test.ts src/lib/jobs/job-capability-registry.test.ts src/frameworks/ui/chat/registry/capability-presentation-registry.test.ts tests/full-registry-coverage.test.ts`
  - Result: 11 files passed. 156 tests passed. 156 total.
- Broader catalog regression after the schema-hardening cleanup:
  - `npm exec vitest run src/core/capability-catalog/*.test.ts src/lib/chat/registry-sync.test.ts`
  - Result: 13 files passed. 188 tests passed. 188 total.

## Suggested Verification Commands

```bash
npm exec vitest run src/core/capability-catalog/catalog.test.ts src/core/capability-catalog/catalog-coverage.test.ts src/core/capability-catalog/registry-convergence.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/lib/chat/registry-sync.test.ts src/lib/chat/tool-composition-root.test.ts src/lib/chat/tool-capability-routing.test.ts src/lib/media/browser-runtime/browser-capability-registry.test.ts src/lib/jobs/job-capability-registry.test.ts src/frameworks/ui/chat/registry/capability-presentation-registry.test.ts tests/full-registry-coverage.test.ts
npm run lint -- src/core/capability-catalog/catalog.ts src/core/capability-catalog/capability-definition.ts src/core/capability-catalog/families/admin-capabilities.ts src/core/capability-catalog/families/affiliate-capabilities.ts src/core/capability-catalog/families/blog-capabilities.ts src/core/capability-catalog/families/calculator-capabilities.ts src/core/capability-catalog/families/conversation-capabilities.ts src/core/capability-catalog/families/corpus-capabilities.ts src/core/capability-catalog/families/job-capabilities.ts src/core/capability-catalog/families/media-capabilities.ts src/core/capability-catalog/families/navigation-capabilities.ts src/core/capability-catalog/families/profile-capabilities.ts src/core/capability-catalog/families/shared.ts src/core/capability-catalog/families/theme-capabilities.ts src/core/capability-catalog/runtime-tool-projection.ts src/core/capability-catalog/runtime-tool-binding.ts src/frameworks/ui/chat/registry/capability-presentation-registry.ts src/frameworks/ui/chat/registry/default-tool-registry.ts src/lib/chat/tool-composition-root.ts src/lib/chat/tool-bundles/admin-tools.ts src/lib/chat/tool-bundles/affiliate-tools.ts src/lib/chat/tool-bundles/bundle-registration.ts src/lib/chat/tool-bundles/calculator-tools.ts src/lib/chat/tool-bundles/conversation-tools.ts src/lib/chat/tool-bundles/corpus-tools.ts src/lib/chat/tool-bundles/job-tools.ts src/lib/chat/tool-bundles/navigation-tools.ts src/lib/chat/tool-bundles/profile-tools.ts src/lib/chat/tool-bundles/theme-tools.ts src/lib/chat/registry-sync.test.ts tests/full-registry-coverage.test.ts
```

## Expected Evidence Artifacts

- A family or facet split map showing which definitions moved out of [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts) and which public exports stayed stable.
- A registration ownership note showing which catalog-bound tools are derived by bundle ID and which bundles still have explicit legacy manual registration.
- Focused convergence output proving catalog projections, runtime binding, and ToolRegistry composition still align after the split.
- An explicit contract note or updated test proving the intended behavior for non-chat defaults in [../../../../tests/full-registry-coverage.test.ts](../../../../tests/full-registry-coverage.test.ts).

## Detailed Implementation Plan

1. Clarify the renderer-surface contract before moving files.
  Scope: decide whether the formerly failing non-chat defaults should keep catalog-derived presentation descriptors and fallback renderers, or whether the default tool registry should exclude them again. Update [../../../../tests/full-registry-coverage.test.ts](../../../../tests/full-registry-coverage.test.ts) to reflect the chosen contract before using it as a Phase 3 exit gate.
  Checkpoint: the focused baseline no longer carries an unexplained red test.

2. Split raw capability definitions by family while preserving one public catalog surface.
  Scope: move the raw definition objects into family-aligned modules, with the safest first slices being admin, blog, corpus, media, then navigation, conversation, and profile. Keep one composed export surface for `CAPABILITY_CATALOG`, `getCatalogDefinition(...)`, and the projection helpers so current callers do not need a broad import migration.
  Checkpoint: [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts) becomes a composition layer rather than the place that stores nearly every raw capability definition inline.

3. Derive catalog-bound registration from the existing binding facets.
  Scope: use `executorBinding.bundleId` and the existing binding metadata to make the runtime surface discoverable without manually repeating its membership across multiple bundle files. Keep dependency injection explicit, but narrow the amount of hand-maintained tool-name duplication.
  Checkpoint: the runtime-binding surface no longer depends on a separately curated mapping that can drift from the catalog.

4. Reduce registration drift in controlled slices until every bundle is catalog-bound.
  Scope: keep the composition-root registrar table as the single source of bundle sequencing, widen binding support in dependency-shaped slices, and finish any remaining catalog-owned schema work needed for descriptor projection.
  Checkpoint: the manual registration surface disappears and runtime descriptor projection no longer depends on fallback schema behavior.

5. Tighten validation around the new composition shape.
  Scope: keep [../../../../src/core/capability-catalog/catalog-coverage.test.ts](../../../../src/core/capability-catalog/catalog-coverage.test.ts), [../../../../src/core/capability-catalog/registry-convergence.test.ts](../../../../src/core/capability-catalog/registry-convergence.test.ts), [../../../../src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts), [../../../../src/lib/chat/registry-sync.test.ts](../../../../src/lib/chat/registry-sync.test.ts), and [../../../../src/lib/chat/tool-composition-root.test.ts](../../../../src/lib/chat/tool-composition-root.test.ts) green while adding any new split-map or bundle-derivation assertions the refactor needs.
  Checkpoint: Phase 3 exits with one coherent validation story for catalog coverage, projection convergence, runtime binding, and composition-root behavior.

## Extraction Checkpoints To Enforce

1. Keep one stable public catalog export surface even if the raw definitions move behind it.
2. Do not move projection logic into many family files unless doing so clearly reduces coupling.
3. If [../../../../src/lib/chat/tool-composition-root.ts](../../../../src/lib/chat/tool-composition-root.ts) grows more conditional registration logic during the refactor, the design is moving in the wrong direction; keep bundle sequencing declarative and move any future complexity toward bundle-local seams or catalog-owned binding facets.
4. When widening runtime binding to all 56 capabilities, require the first controlled slices to stay green and keep shared schema extraction in pure-data catalog modules so descriptor projection never depends on tool-module import side effects.

## Scope Guardrails

- Do not reopen Phase 2 provider-runtime work.
- Do not widen this phase into prompt assembly, request-scoped tool routing, or execution-target abstraction.
- Do not migrate every tool family at once.
- Do not change public tool names or user-facing contracts unless a current test or packet note explicitly records the reason.

## Implementation Record

- Date: 2026-04-12
- Files changed:
  - [./phase-3-capability-catalog-and-registration-decomposition.md](./phase-3-capability-catalog-and-registration-decomposition.md)
  - [../../../../src/frameworks/ui/chat/registry/capability-presentation-registry.ts](../../../../src/frameworks/ui/chat/registry/capability-presentation-registry.ts)
  - [../../../../src/frameworks/ui/chat/registry/capability-presentation-registry.test.ts](../../../../src/frameworks/ui/chat/registry/capability-presentation-registry.test.ts)
  - [../../../../src/frameworks/ui/chat/registry/default-tool-registry.ts](../../../../src/frameworks/ui/chat/registry/default-tool-registry.ts)
  - [../../../../tests/full-registry-coverage.test.ts](../../../../tests/full-registry-coverage.test.ts)
  - [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts)
  - [../../../../src/core/capability-catalog/runtime-tool-binding.ts](../../../../src/core/capability-catalog/runtime-tool-binding.ts)
  - [../../../../src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts)
  - [../../../../src/core/capability-catalog/families/admin-capabilities.ts](../../../../src/core/capability-catalog/families/admin-capabilities.ts)
  - [../../../../src/core/capability-catalog/families/affiliate-capabilities.ts](../../../../src/core/capability-catalog/families/affiliate-capabilities.ts)
  - [../../../../src/core/capability-catalog/families/blog-capabilities.ts](../../../../src/core/capability-catalog/families/blog-capabilities.ts)
  - [../../../../src/core/capability-catalog/families/calculator-capabilities.ts](../../../../src/core/capability-catalog/families/calculator-capabilities.ts)
  - [../../../../src/core/capability-catalog/families/conversation-capabilities.ts](../../../../src/core/capability-catalog/families/conversation-capabilities.ts)
  - [../../../../src/core/capability-catalog/families/corpus-capabilities.ts](../../../../src/core/capability-catalog/families/corpus-capabilities.ts)
  - [../../../../src/core/capability-catalog/families/job-capabilities.ts](../../../../src/core/capability-catalog/families/job-capabilities.ts)
  - [../../../../src/core/capability-catalog/families/media-capabilities.ts](../../../../src/core/capability-catalog/families/media-capabilities.ts)
  - [../../../../src/core/capability-catalog/families/navigation-capabilities.ts](../../../../src/core/capability-catalog/families/navigation-capabilities.ts)
  - [../../../../src/core/capability-catalog/families/profile-capabilities.ts](../../../../src/core/capability-catalog/families/profile-capabilities.ts)
  - [../../../../src/core/capability-catalog/families/shared.ts](../../../../src/core/capability-catalog/families/shared.ts)
  - [../../../../src/core/capability-catalog/families/theme-capabilities.ts](../../../../src/core/capability-catalog/families/theme-capabilities.ts)
  - [../../../../src/lib/chat/tool-composition-root.ts](../../../../src/lib/chat/tool-composition-root.ts)
  - [../../../../src/lib/chat/tool-bundles/admin-tools.ts](../../../../src/lib/chat/tool-bundles/admin-tools.ts)
  - [../../../../src/lib/chat/tool-bundles/affiliate-tools.ts](../../../../src/lib/chat/tool-bundles/affiliate-tools.ts)
  - [../../../../src/lib/chat/tool-bundles/blog-tools.ts](../../../../src/lib/chat/tool-bundles/blog-tools.ts)
  - [../../../../src/lib/chat/tool-bundles/bundle-registration.ts](../../../../src/lib/chat/tool-bundles/bundle-registration.ts)
  - [../../../../src/lib/chat/tool-bundles/calculator-tools.ts](../../../../src/lib/chat/tool-bundles/calculator-tools.ts)
  - [../../../../src/lib/chat/tool-bundles/conversation-tools.ts](../../../../src/lib/chat/tool-bundles/conversation-tools.ts)
  - [../../../../src/lib/chat/tool-bundles/corpus-tools.ts](../../../../src/lib/chat/tool-bundles/corpus-tools.ts)
  - [../../../../src/lib/chat/tool-bundles/job-tools.ts](../../../../src/lib/chat/tool-bundles/job-tools.ts)
  - [../../../../src/lib/chat/tool-bundles/media-tools.ts](../../../../src/lib/chat/tool-bundles/media-tools.ts)
  - [../../../../src/lib/chat/tool-bundles/navigation-tools.ts](../../../../src/lib/chat/tool-bundles/navigation-tools.ts)
  - [../../../../src/lib/chat/tool-bundles/profile-tools.ts](../../../../src/lib/chat/tool-bundles/profile-tools.ts)
  - [../../../../src/lib/chat/tool-bundles/theme-tools.ts](../../../../src/lib/chat/tool-bundles/theme-tools.ts)
  - [./status-board.md](./status-board.md)
  - [../refactor-roadmap.md](../refactor-roadmap.md)
- Summary of what landed:
  - Clarified the renderer-surface contract so fallback-rendered tools can keep catalog-derived descriptors, and preserved the legacy `navigate` alias while keeping descriptor listings canonical.
  - Derived the original five-tool runtime-binding pilot from catalog-owned binding facets and `executorBinding.bundleId`, so the affected bundle files no longer repeat tool-name membership.
  - Replaced inline registrar calls in [../../../../src/lib/chat/tool-composition-root.ts](../../../../src/lib/chat/tool-composition-root.ts) with one ordered registrar table so bundle sequencing and bundle metadata now share a single composition-root source.
  - Extracted the remaining affiliate and job capability definitions so [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts) is now a pure composition-and-projection layer over the existing 55-entry public catalog.
  - Added [../../../../src/lib/chat/tool-bundles/bundle-registration.ts](../../../../src/lib/chat/tool-bundles/bundle-registration.ts), extended it to support appended catalog-bound tool names, and moved all 11 bundles, including blog, onto shared registration tables so those bundles derive `toolNames` and registration order from one source.
  - Widened the runtime-binding pilot to `calculator`, `get_current_page`, `list_available_pages`, `navigate_to_page`, and `set_theme`, filled the missing schema facets those tools needed for catalog-owned descriptor projection, and aligned `get_current_page` plus `set_theme` runtime validation with their actual runtime contracts.
  - Widened the runtime-binding pilot again to `adjust_ui`, `admin_search`, `inspect_runtime_context`, and `set_preference`, extended the binding deps contract to cover the existing registry and user-preferences seams, filled the missing schema facet for `adjust_ui`, and aligned `set_preference` metadata with its runtime category.
  - Added executor and validator facets for the remaining 41 capabilities across admin, affiliate, blog, calculator, conversation, corpus, job, profile, and theme; extended the binding deps contract to cover profile, analytics, job, vector-store, blog-production, and journal-editorial seams; and converted the remaining bundle registrations to `projectCatalogBoundToolDescriptor(...)`.
  - Preserved the 55-entry catalog surface, kept calculator in the composed catalog after the earlier restore, finished the catalog-owned schema cleanup through a pure-data `catalog-input-schemas.ts` module, and revalidated the focused and broader Phase 3 bundles green at 156 of 156 tests and 188 of 188 tests.
- Deviations from the detailed plan:
  - The final slice widened runtime binding across the full 55-capability surface once the earlier controlled slices were green, and the later cleanup pass removed the temporary schema fallback so descriptor projection is now fully catalog-owned.

## Post-Implementation QA

- [x] Run the focused Phase 3 catalog and composition bundle.
- [x] Run changed-file diagnostics.
- [x] Confirm the public catalog surface stayed stable while raw definitions moved out of one giant source file.
- [x] Confirm the catalog-bound registration surface is more derived and less manually repeated.
- [x] Confirm the renderer-surface contract for non-chat defaults is explicit and test-backed.

## Exit Criteria

- No single source file carries the full raw capability-definition universe.
- The public catalog surface remains stable and still projects presentation, browser, job, and runtime-binding metadata coherently.
- The runtime surface is registered through a lower-drift composition path and projects descriptors from catalog-owned schema.
- The focused Phase 3 validation bundle is green, including the renderer-surface contract for fallback-rendered defaults.

## Handoff

- What the next loop should now assume:
  - [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts) is still the public metadata source for 56 capabilities, but all raw capability definitions now compose in from [../../../../src/core/capability-catalog/families](../../../../src/core/capability-catalog/families) instead of living inline.
  - Presentation, browser, and job registries already derive from the catalog.
  - The renderer-surface contract is settled: fallback-rendered tools may still have presentation descriptors, and the `navigate` lookup alias remains supported.
  - Runtime binding exists and is real for all 56 capabilities, and that surface is grouped by `executorBinding.bundleId` even when a bundle projects catalog-bound descriptors inline inside its shared registration table or registers bundle-wide through the shared helper.
  - Catalog-owned schema is now required for capability definitions, and [../../../../src/core/capability-catalog/catalog-input-schemas.ts](../../../../src/core/capability-catalog/catalog-input-schemas.ts) must remain a pure-data module so schema extraction does not reintroduce tool-init dependency cycles.
  - [../../../../src/lib/chat/tool-composition-root.ts](../../../../src/lib/chat/tool-composition-root.ts) now owns bundle sequencing through one ordered registrar table, and all 11 bundles now derive registration order from shared registration tables.
- What remains unresolved:
  - No open Phase 3 runtime-binding or schema-ownership blockers remain.
- What docs need updating:
  - Keep this packet, [./status-board.md](./status-board.md), and [../refactor-roadmap.md](../refactor-roadmap.md) aligned in the same patch as each subsequent Phase 3 slice.
