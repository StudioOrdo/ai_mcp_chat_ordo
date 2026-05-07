# Phase 5 — Revision Loops: Pause, Refine, Resume

## Objective

Implement revision loops on top of the shipped Phase 2 through Phase 4 runtime.
Phase 5 should let operators:

- pause or resume a work order without inventing a second lifecycle engine
- refine a single asset while preserving immutable lineage
- resume from the correct downstream stage frontier instead of replaying the
  whole DAG blindly
- support both regenerated and user-supplied replacement assets using existing
  repository and storage seams

The goal is not to mutate the DAG in place. The goal is to make the current
factory runtime support controlled human intervention without breaking the
orthogonal architecture established in Phases 2 through 4.

## Current Baseline

The shipped runtime already provides the most important Phase 5 primitives.

- `FactoryRepository` already persists work orders, stage runs, outputs,
  checkpoints, and events
- `ProductionOrchestrator` already:
  - pauses on terminal stage failure
  - creates durable checkpoints with `resumeFromStageKey`
  - resumes paused work orders by consuming the active checkpoint
  - skips already-succeeded stage runs and reruns only the next unresolved stage
- `FactoryOutputRecord` and `FactoryAsset.provenance.previousAssetId` already
  support immutable lineage via `supersedesEntityId`
- Phase 4 already proved the runtime can accept supplemental outputs and select
  the latest non-superseded assets and compositions deterministically

That means Phase 5 does not need to introduce a separate restore engine or a
mutable checkpoint snapshot model.

## Repo-Native Constraints

Phase 5 must follow the contracts already in the codebase.

### Do Not Assume Mutable DAG Nodes

The current repo does not store per-stage runtime state inside
`ProductionDAG.stages`. Runtime truth lives in:

- `WorkOrder.status`
- `WorkOrder.pausedState`
- `StageRunRecord`
- persisted outputs in `factory_outputs`
- persisted checkpoints in `factory_checkpoints`

Phase 5 must not introduce design drift such as:

- stage indices stored as the primary resume mechanism
- mutable `stage.status` or `stage.result` fields inside the DAG
- `workOrder.assets` maps or in-memory-only checkpoint snapshots
- a separate pause engine outside `ProductionOrchestrator`

### Reuse Existing Persistence Seams

Phase 5 should build on these current interfaces instead of bypassing them.

- `FactoryRepository.createCheckpoint(...)`
- `FactoryRepository.findLatestActiveCheckpoint(...)`
- `FactoryRepository.markCheckpointConsumed(...)`
- `FactoryRepository.appendOutput(...)`
- `FactoryRepository.listOutputsForWorkOrder(...)`
- `FactoryRepository.listStageRunsForWorkOrder(...)`
- `FactoryRepository.appendEvent(...)`

Revision loops should remain persistence-first. They should not depend on hidden
in-memory state surviving across requests or worker restarts.

### Reuse Existing Storage Seams for Uploads

If Phase 5 allows user-supplied replacement assets, it should reuse the current
user-file system rather than inventing a factory-only upload store.

The practical seam is the existing user-file repository exposed through
`RepositoryFactory` and related media helpers. Phase 5 should project uploaded
files into `FactoryAsset` outputs rather than duplicating the underlying file
storage model.

### Reuse Existing Output-Lineage Rules

Refined assets and compositions should be persisted as new outputs.

- the new output should point to the prior output via `supersedesEntityId`
- refined assets should also record `FactoryAsset.provenance.previousAssetId`
- downstream selectors should continue to resolve the latest non-superseded
  output rather than mutating old rows in place

This is the core design rule that keeps revision loops orthogonal to the
execution engine.

## What Phase 5 Actually Needs

Phase 5 should be split into four layers.

### Layer 1: Revision Control Policy

Introduce an operator-facing control layer that knows when a work order can be
paused, refined, or resumed.

Suggested responsibility split:

- `FactoryRevisionControlService`
  - validates whether a pause or resume request is legal
  - reads the current work order, checkpoint, outputs, and stage runs
  - delegates actual persistence work to narrower services
- `FactoryPauseRequestService`
  - handles user-requested pauses for running work orders
  - creates a pause request record or event if the system cannot safely pause
    mid-stage immediately
- `FactoryResumeService`
  - resumes an already-paused work order through the existing orchestrator path
  - applies revision-aware resume frontier overrides before orchestration begins

This layer should stay thin. It coordinates the runtime rather than duplicating
it.

### Layer 2: Asset Refinement Service

Introduce a dedicated refinement service that operates on immutable outputs.

Suggested shape:

```typescript
export interface AssetRefinementRequest {
  workOrderId: string;
  assetId: string;
  mode: "regenerate" | "replace_with_upload" | "metadata_fix";
  requestedBy: string;
  parameterOverrides?: Record<string, unknown>;
  userFileId?: string;
}

export interface AssetRefinementResult {
  previousAssetId: string;
  newAssetId: string;
  resumeFromStageKey: string;
}
```

Responsibilities:

- load the current active asset using output lineage, not stale ids
- validate that the work order is paused before allowing refinement
- create a new `FactoryAsset` output instead of mutating the old one
- persist lineage through `supersedesEntityId` and `previousAssetId`
- decide the safest downstream stage frontier to rerun

Non-responsibilities:

- do not mutate historical outputs
- do not directly resume orchestration inside the persistence method
- do not assume all refinements can skip recomposition

### Layer 3: Resume Frontier Planning

Phase 5 needs an explicit policy for where execution restarts after a
refinement.

Suggested service:

- `FactoryResumeFrontierPlanner`

Its job is to answer one question:

`What is the earliest stage that must rerun for this refined output to be safe?`

Initial repo-native rules:

1. No refinement, just resume a paused failure.
   Resume from the checkpoint's existing `resumeFromStageKey`.

2. Asset replaced or regenerated after composition already exists.
   Resume from `composition`.
   Rationale: the current composition references concrete asset ids, so a new
   composition output must be materialized before release can be trusted.

3. Metadata-only asset fixes that do not change rendered content.
   Conservative default: still resume from `composition` in the first
   implementation.
   Future optimization: allow `qa_asset` if the system can prove that
   recomposition is unnecessary.

4. Failure occurred before composition existed.
   Resume from the failed stage or its first downstream dependency, depending on
   what was refined.

5. User forces a later resume point.
   Reject the request unless the requested stage is at or earlier than the
   computed safe frontier.

The first implementation should prefer safety over cleverness.

### Layer 4: Revision History and Lineage Queries

Phase 5 should make revision history inspectable without overloading the base
work-order model.

There are two distinct concepts that must stay separate.

#### Same-Work-Order Revision Loop

This is the checkpoint/refine/resume path for a currently paused work order.

- same `workOrderId`
- same DAG
- additional outputs supersede earlier outputs
- additional stage runs and events are appended
- checkpoints show pause and resume history

#### New Work-Order Revision Branch

This is a new iteration launched from a prior work order or release.

- new `workOrderId`
- lineage preserved through `WorkOrder.previousWorkOrderIds`
- useful for post-release revisions or branching experiments

Phase 5 should document both, but the first implementation can prioritize the
same-work-order loop.

## Pause Semantics

The current orchestrator already pauses safely on terminal stage failure.
Phase 5 should add explicit user-requested pause semantics without pretending it
can take arbitrary mid-stage snapshots for free.

### Required Rule

Do not claim exact mid-stage pause snapshots unless the stage executors and job
 drivers actually support them.

The current repo can safely support these pause outcomes:

1. Already paused.
   Return the existing checkpoint and current pause state.

2. Running, but between stage boundaries.
   Persist a checkpoint and mark the work order paused immediately.

3. Running inside a long stage.
   Record a pause request and let the orchestrator honor it at the next safe
   boundary, or use cooperative abort if the specific executor supports it.

4. Terminal work order.
   Reject the pause request.

This avoids fake precision in the checkpoint model.

## Refinement Modes

Phase 5 should support three bounded refinement modes.

### Regenerate

Regenerate should reuse the same asset-generation handler seam that produced the
original asset kind.

Implementation contract:

- require the caller to supply the current `ProductBrief` context for the
  paused work order
- resolve the original asset-generation stage from
  `FactoryAsset.provenance.stageKey`
- reuse the production-root asset-generation handler for that asset kind
- preserve immutable lineage by appending a new asset output that supersedes the
  old one

Phase 5 does not need a separate regeneration engine. Reusing the production
handler keeps asset revision behavior aligned with the original execution path.

### Replace With Upload

Replacement uploads continue to reuse the existing user-file repository and are
projected into a new factory asset output.

### Metadata Fix

Metadata fixes stay immutable as well. Even when the change is logically small,
the new asset output supersedes the prior one rather than mutating historical
rows.

## Resume Overrides

Phase 5 supports two resume behaviors.

1. Safe default resume.
  Resume from the computed safe frontier.

2. Earlier explicit override.
  Allow the operator to choose an earlier stage than the safe frontier.
  This is broader than necessary, but still correct because the runtime can
  reopen that stage and all downstream dependents by resetting their durable
  `StageRunRecord.status` values to `"pending"`.

Later-than-safe overrides remain invalid.

## Explicit Pause Requests

Phase 5 adds explicit pause control without inventing fake mid-stage snapshots.

Implemented behaviors:

1. Already paused.
  Return the current checkpoint and paused frontier.

2. Planned or between-stage boundary.
  Pause immediately, create a checkpoint, and resume from the next runnable
  stage.

3. Running inside a stage.
  Persist a `revision_pause_requested` event. The orchestrator honors the
  request at the next stage boundary and emits `revision_pause_honored` when it
  creates the checkpoint.

4. Terminal work order.
  Reject the pause request.

This is the correct repo-native model because the persisted runtime does not
store resumable mid-stage snapshots.

## Implemented Phase 5 Runtime Slice

The Phase 5 core runtime is now closed around these services:

- `FactoryPauseWorkOrderService`
- `AssetRefinementService`
- `FactoryResumeFrontierPlanner`
- `ResumeWorkOrderService`
- `FactoryRevisionControlService`

Together they provide:

- explicit operator pause requests
- immutable asset refinement for regenerate, replacement-upload, and metadata
  fix flows
- earlier-or-equal safe resume frontier selection
- same-work-order revision loops on top of the existing orchestrator and
  checkpoint model

Phase 5 deliberately keeps the delivery surface thin. The shipped app surface is
an admin revision route at
`src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`, which
wraps the revision root for:

- `GET` revision-history queries over the current work order, checkpoint, stage
  runs, outputs, and events
- `POST` pause requests
- `POST` single-asset refinement requests for regenerate, replace-with-upload,
  and metadata-fix flows
- `POST` resume requests with validated `ProductBrief` input

That route keeps orchestration policy in the revision services rather than
duplicating workflow logic inside the transport layer.

Use the existing asset-generation logic with parameter overrides.

- preserves asset kind
- creates a new `FactoryAsset`
- resets QA state for the new asset
- retains lineage to the old asset

### Replace With Upload

Use the existing user-file system and project the uploaded file back into a new
`FactoryAsset`.

- the user file remains the source of truth for storage
- the factory output remains the source of truth for orchestration lineage
- the new asset should record enough metadata to trace back to the uploaded file

### Metadata-Only Fix

Use this for safe, deterministic corrections such as:

- alt text
- captions
- accessibility summaries
- brand approval flags

This mode should not silently become a generative re-run.

## Negative and Edge Cases to Explicitly Cover

Phase 5 must not ship without tests for these cases.

### Positive Cases

- resume a paused work order with no refinement and rerun the failed stage
- regenerate one asset and resume from `composition`
- upload a replacement asset and resume from `composition`
- metadata-only asset correction preserves lineage and resumes successfully
- repeated pause -> refine -> resume cycles on the same work order remain
  deterministic

### Negative Cases

- pause a terminal work order
- refine an asset while the work order is still running
- refine an asset that is not the current active output
- resume without an active checkpoint
- resume with a user-requested stage later than the safe frontier
- upload a replacement file whose media type does not match the target asset kind
- try to supersede an asset from another work order

### Edge Cases

- multiple refinements of the same asset before resume
- a paused work order with multiple checkpoints where only the latest active one
  should control resume
- refinement after Phase 4 remediation already superseded the original asset
- refinement while the failed stage itself was an asset-generation stage
- refinement of an asset not currently embedded in the latest composition
- resume after a checkpoint was already consumed by another worker
- race between user pause request and a stage finishing normally

## Suggested Implementation Files

The names can vary, but the responsibility split should stay narrow.

- `src/lib/factory/factory-revision-root.ts`
  - composition root for revision services
- `src/lib/factory/revision-control-service.ts`
  - validates pause, refine, and resume commands
- `src/lib/factory/asset-refinement-service.ts`
  - regenerates or replaces a single asset immutably
- `src/lib/factory/resume-frontier-planner.ts`
  - computes the earliest safe rerun stage
- `src/lib/factory/resume-work-order-service.ts`
  - consumes checkpoints and resumes through `ProductionOrchestrator`
- `src/lib/factory/revision-history-service.ts`
  - queries checkpoints, superseded outputs, and parent work orders

The shipped admin route wraps these services directly and keeps all pause,
refine, and resume orchestration logic in the existing revision root.

## Test Matrix

Phase 5 should add coverage in four layers.

### Unit Tests

- frontier planner rules
- asset refinement lineage rules
- pause request validation
- resume validation and checkpoint consumption behavior

### Repository Tests

- multiple checkpoints with one active checkpoint
- superseded asset chains and latest active asset selection
- uploaded replacement assets linked to the same work order correctly

### Orchestrator Integration Tests

- paused failure -> refine asset -> resume -> succeed
- paused QA gate -> upload replacement asset -> recomposition -> release
- repeated refinement of the same asset before final resume

### Deferred-Job and Runtime Tests

- `produce_product` surfaces paused revision-loop failures clearly
- resume path preserves job progress semantics
- worker retries do not consume checkpoints incorrectly

### App Route Tests

- admin-only access to revision controls
- revision-history reads through the shipped route handler
- request validation for invalid actions and missing regenerate briefs
- route-driven pause -> refine -> resume flows against real revision services
- replacement-upload and regenerate flows through the app transport

## Definition of Done

Phase 5 is complete only when all of the following are true.

- user-requested pause and resume semantics are implemented against the current
  orchestrator instead of beside it
- single-asset refinement persists immutable lineage using the existing output
  model
- resume frontier planning is explicit and covered by tests
- replacement uploads reuse the current user-file system
- same-work-order revision loops and cross-work-order lineage are documented
  clearly
- end-to-end pause -> refine -> resume coverage passes through the shipped admin
  route surface
- no Phase 5 code relies on mutable DAG stage state or undocumented in-memory
  checkpoint snapshots

At that point the system is ready for Phase 6 UI work without forcing another
architecture rewrite.
