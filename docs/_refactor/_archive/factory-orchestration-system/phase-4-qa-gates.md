# Phase 4 — QA Gates: Asset, Composition, and Resolution Policy

## Objective

Implement the real QA policy layer on top of the shipped Phase 3 runtime.
Phase 4 should turn the current minimal `qa`, `qa_resolution`, and release guard
seams into a production-quality QA system that:

- evaluates generated assets against reusable QA checks
- evaluates the assembled composition separately from asset QA
- attempts only bounded, deterministic remediation
- preserves the existing orchestrator contract instead of creating a second
  runtime model
- pauses cleanly when QA still needs human judgment

The goal is not to invent a new orchestration engine. The goal is to make the
existing factory runtime capable of trustworthy release gating.

## Current Baseline

Phase 3 already shipped the runtime boundary that Phase 4 must extend:

- `DAGPlanner` creates `qa_asset`, `qa_page`, and `qa_resolution` stages
- `QAExecutor` currently produces minimal asset/page findings using the current
  `QAFinding` and `QAReport` entities
- `QAResolutionExecutor` merges the two QA reports into the final
  `qa_resolution` report
- `ReleaseExecutor` refuses to publish unless `qa_resolution.status === "passed"`
- `ProductionOrchestrator` already pauses on stage failure and emits job
  progress; it should stay the single lifecycle controller

That means Phase 4 should not introduce:

- a new work-order status like `qa_failed`
- a second progress or pause system outside the orchestrator
- a monolithic QA executor that collapses `qa_asset`, `qa_page`, and
  `qa_resolution` into one stage
- pseudo-types that diverge from the current entity contracts

## Repo-Native Design Constraints

Phase 4 must follow the code that already exists today.

### Existing entity contracts to reuse

- `QACriterion` is already defined in `src/core/entities/factory-constants.ts`
- `QAFinding` and `FactoryAsset.qaStatus` already exist in
  `src/core/entities/factory-asset.ts`
- `QAReport` and `AssetQAReport` already exist in
  `src/core/entities/qa-report.ts`
- `QAStageConfig` and `QAResolutionStageConfig` already exist in
  `src/core/entities/production-stage.ts`

Phase 4 should not add a second criterion enum or alternate finding/report type.

### Existing execution seams to reuse

- `StageExecutionContext` already resolves prior outputs by stage key
- `listAssets(context)` and `requireComposition(context)` already expose the
  two primary QA inputs
- `QAExecutor` is already the stage executor for both `qa_asset` and `qa_page`
- `QAResolutionExecutor` is already the place where the final release decision
  is normalized

Phase 4 should deepen those seams, not bypass them.

## Target Architecture

Phase 4 should break QA into three layers.

### Layer 1: Check definitions

Introduce explicit, composable QA check definitions that operate on the current
entity model.

Suggested shape:

```typescript
// File: src/lib/factory/qa-checks/types.ts

import type { Composition } from "@/core/entities/composition";
import type { QACriterion } from "@/core/entities/factory-constants";
import type { FactoryAsset, QAFinding } from "@/core/entities/factory-asset";
import type { ProductBrief } from "@/core/entities/product-brief";

export interface AssetQACheckContext {
  brief: ProductBrief;
  asset: FactoryAsset;
  siblingAssets: readonly FactoryAsset[];
}

export interface PageQACheckContext {
  brief: ProductBrief;
  composition: Composition;
  assets: readonly FactoryAsset[];
}

export interface AssetQACheck {
  readonly criterion: QACriterion;
  readonly supportedAssetKinds: readonly FactoryAsset["kind"][];
  run(context: AssetQACheckContext): Promise<readonly QAFinding[]>;
}

export interface PageQACheck {
  readonly criterion: QACriterion;
  run(context: PageQACheckContext): Promise<readonly QAFinding[]>;
}
```

This keeps the checks orthogonal:

- asset checks do not need to know about stage execution
- page checks do not need to know about repository writes
- remediation can interpret findings without owning check execution

### Layer 2: QA policy registry

Introduce a registry that maps the brief's requested QA criteria to concrete
checks.

Suggested responsibilities:

- list applicable asset checks for a given `FactoryAsset.kind`
- list applicable page checks for the current `ProductBrief`
- allow multiple checks for the same criterion when needed
- keep registration close to composition-root code, not inside entities

Suggested file split:

- `src/lib/factory/qa-checks/types.ts`
- `src/lib/factory/qa-check-registry.ts`
- `src/lib/factory/factory-qa-root.ts`

The registry should be dependency-injected into the executors. Avoid global
singletons with hidden service state.

### Layer 3: Stage executor policy

Keep the three current QA stages but give each of them a sharper job.

#### `qa_asset`

Responsibilities:

- iterate over all `asset` outputs returned by `listAssets(context)`
- run applicable asset checks only
- produce an asset-scoped `QAReport`
- compute `passedCriteria`, `failedCriteria`, `recommendedFixes`, and
  `autoResolvableCount` from actual findings

Non-responsibilities:

- do not inspect composition-level concerns
- do not write remediated assets directly unless the runtime is explicitly
  extended to support supplemental outputs

#### `qa_page`

Responsibilities:

- inspect the `Composition` returned by `requireComposition(context)`
- run page-level checks only
- produce a page-scoped `QAReport`

Page checks should cover concerns like:

- missing or malformed `htmlContent`
- composition completeness against the draft and embedded assets
- target-channel policy checks
- overall tone and brand signals if analyzers exist
- performance heuristics based on embedded asset inventory and metadata

#### `qa_resolution`

Responsibilities:

- merge the `qa_asset` and `qa_page` reports
- decide whether findings are already acceptable, auto-fixable, or require
  human review
- produce the canonical final `QAReport` used by `ReleaseExecutor`

This is the right place for bounded remediation policy because it already owns
the final normalization step before release.

## Remediation Policy

Phase 4 needs remediation, but it must be bounded and explicit.

### Acceptable remediation outcomes

`qa_resolution` should normalize into one of these outcomes:

1. `passed`
   All checks passed, or auto-fixable findings were resolved and revalidated.

2. `needs_review`
   Findings remain that need human judgment or revision workflow follow-up.

3. hard stage failure
   The QA machinery itself failed transiently or structurally, and the stage
   should throw so the orchestrator can retry once or pause.

### What counts as auto-resolvable

Auto-resolvable findings should be intentionally narrow. Examples:

- missing generated alt text that can be synthesized deterministically
- performance warnings that can be resolved by safe metadata normalization
- composition markup completion that can be derived from already persisted data

Not auto-resolvable:

- factual accuracy disputes
- chart data mismatches
- tone or brand concerns requiring human judgment
- blurry or poor creative quality judgments
- any fix that requires a fresh generative call unless that path is explicitly
  modeled and bounded

### Required design rule

Do not add a custom QA pause branch to `ProductionOrchestrator`.

The orchestrator already knows how to:

- retry transient stage failures once
- pause on terminal stage failure
- create checkpoints
- report job progress

Phase 4 should express its policy through stage outputs and stage errors.

In practice this means:

- if `qa_resolution` finishes with unresolved review work, it returns a
  `QAReport` with `status: "needs_review"`
- `ReleaseExecutor` continues to block on `qa_resolution.status !== "passed"`
- that release-stage failure causes the orchestrator to pause in the existing
  runtime path

This keeps the lifecycle model orthogonal.

## Necessary Runtime Extension

The current stage-executor contract returns a single persisted output via
`StageExecutionResult`.

That is sufficient for Phase 3, but Phase 4 may need one of two explicit
options if remediation is allowed to persist fixed assets or a fixed
composition inside `qa_resolution`.

### Option A: bounded report-only remediation

Phase 4 can stay within the current contract if remediation only:

- computes recommendations
- marks findings as auto-resolvable or human-review
- does not persist corrected assets or compositions yet

This is the lowest-risk first implementation and is a good default.

### Option B: supplemental output persistence

If Phase 4 must actually persist corrected assets or compositions, add an
explicit runtime extension rather than hidden repository reach-through.

Recommended seam:

```typescript
export interface StageExecutionResult {
  entityKind: StageResultEntityKind;
  entity: FactoryOutputEntity;
  supersedesEntityId?: string;
  supplementalOutputs?: readonly {
    entityKind: StageResultEntityKind;
    entity: FactoryOutputEntity;
    supersedesEntityId?: string;
  }[];
}
```

If this extension is introduced, it should be justified in the Phase 4 code and
covered by focused orchestrator tests. Do not let executors call the repository
directly as an escape hatch.

## Recommended File Plan

Phase 4 should prefer this file layout.

### Core runtime additions

- `src/lib/factory/qa-checks/types.ts`
- `src/lib/factory/qa-check-registry.ts`
- `src/lib/factory/factory-qa-root.ts`
- `src/lib/factory/qa-checks/asset-accessibility-check.ts`
- `src/lib/factory/qa-checks/asset-performance-check.ts`
- `src/lib/factory/qa-checks/chart-accuracy-check.ts`
- `src/lib/factory/qa-checks/composition-completeness-check.ts`
- `src/lib/factory/qa-checks/composition-performance-check.ts`
- `src/lib/factory/qa-checks/composition-tone-check.ts`

### Existing files to deepen rather than replace

- `src/lib/factory/stage-executors/qa-executor.ts`
- `src/lib/factory/stage-executors/qa-resolution-executor.ts`
- `src/lib/factory/factory-production-root.ts`
- optionally `src/lib/factory/production-orchestrator.ts` only if the executor
  result contract must be extended for supplemental outputs

### Tests

- `tests/factory/qa-check-registry.test.ts`
- `tests/factory/qa-checks.test.ts`
- `tests/factory/qa-executors.test.ts`
- `tests/factory/qa-resolution-remediation.test.ts`
- expand `tests/factory/production-orchestrator.test.ts` only when runtime
  contract changes are required

## Positive, Negative, and Edge Coverage

Phase 4 is not complete without explicit coverage for all three classes.

### Positive cases

- all assets have no findings and page checks pass
- asset warnings exist but no blocking findings, resulting in
  `qa_asset.status === "needs_review"` and final `qa_resolution.status === "passed"`
  only when policy explicitly allows warnings to ship
- page findings are auto-fixable, remediation succeeds, and revalidation passes
- merged asset and page reports preserve deduplicated passed and failed
  criteria

### Negative cases

- chart accuracy check emits an error and blocks final release
- accessibility check emits blocking findings and `qa_resolution` stays
  `needs_review`
- remediation service throws a structural error and the stage fails, allowing
  orchestrator retry and pause behavior to handle it
- unsupported registry configuration leaves a requested criterion without a
  check and fails closed instead of silently passing

### Edge cases

- zero assets for a page-only brief
- multiple assets of the same kind with only one failing
- duplicate findings across asset and page reports
- warning-only findings with no suggested fix
- findings with suggested fixes but no safe deterministic remediation path
- composition with missing `htmlContent` but otherwise valid sections
- partial remediation success where one fix applies and another remains manual
- final merged report where `autoResolvableCount < totalFindings` and at least
  one blocking finding remains

### Regression expectations

Phase 4 should preserve these existing Phase 3 guarantees:

- `ReleaseExecutor` still blocks unless `qa_resolution` passed
- orchestrator retry and pause semantics stay unchanged
- deferred-job progress remains emitted from the orchestrator, not from a new
  side channel
- `produce_product` remains catalog-bound and worker-compatible

## Test Matrix

Minimum required test slices before Phase 4 can be called complete:

1. registry tests
   - criterion registration
   - duplicate registration rejection or deterministic override policy
   - criterion-to-asset and page applicability filtering

2. individual check tests
   - positive and negative cases for each shipped check
   - deterministic handling of malformed asset metadata

3. `qa-executor` tests
   - `qa_asset` runs only asset checks
   - `qa_page` runs only page checks
   - `passedCriteria`, `failedCriteria`, `recommendedFixes`, and
     `autoResolvableCount` are computed correctly

4. `qa-resolution` tests
   - merge behavior
   - deduplication behavior
   - remediation policy behavior
   - blocking vs non-blocking outcome normalization

5. orchestrator integration tests
   - release stays blocked when final QA is unresolved
   - transient QA runtime failure still retries once
   - terminal QA policy outcome still results in pause and checkpoint behavior

6. deferred-job and runtime tests
   - `produce_product` still reports progress correctly when the QA stages are
     exercised through the worker path

## Anti-Goals

Phase 4 should explicitly avoid:

- creating a new `qa_failed` work-order status
- adding repository writes directly inside QA checks
- letting check implementations depend on stage keys or job infrastructure
- auto-regenerating arbitrary assets without a bounded, deterministic policy
- silently downgrading missing checks into passing results
- coupling QA policy to UI rendering or chat presentation

## Definition of Done

Phase 4 is complete when:

- the current `qa_asset`, `qa_page`, and `qa_resolution` stages execute using
  real check registries and services
- the implementation reuses the existing `QACriterion`, `QAFinding`, and
  `QAReport` entities instead of defining parallel models
- bounded remediation policy is explicit and covered by tests
- release remains blocked until final QA passes
- unresolved QA leads to the existing pause and checkpoint runtime path rather
  than a new lifecycle branch
- positive, negative, and edge coverage exists for checks, stage executors,
  resolution logic, and worker and runtime flow
- no dead code or speculative abstraction is introduced that Phase 5 would need
  to unwind

## Recommended Implementation Order

1. Introduce check interfaces and the registry.
2. Implement a small initial check set with deterministic inputs.
3. Upgrade `QAExecutor` to use the registry for both asset and page modes.
4. Upgrade `QAResolutionExecutor` to own merge and bounded remediation policy.
5. Extend the executor and orchestrator contract only if remediation must
   persist supplemental outputs.
6. Add focused tests before widening the implementation surface.
