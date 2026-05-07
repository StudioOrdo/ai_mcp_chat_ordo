# Phase 3 — Orchestration Engine: Planner, Runner, and Execution Seams

## Objective

Build the repo-native orchestration layer that turns a validated
`ProductBrief` into a persisted `ProductionDAG`, executes that DAG through
durable `StageRunRecord` updates, records stage outputs through
`FactoryRepository`, and emits progress into the existing deferred-job and chat
surfaces.

Phase 3 is the point where the factory stops being a type system plus storage
layer and becomes an executable runtime.

## Status

- Design: QA-updated and ready for implementation
- Dependencies: Phase 1 core entities and Phase 2 persistence backing
- Primary deliverable: an orchestration engine that uses the existing repo
  seams instead of inventing a parallel workflow model

## QA Findings That Changed This Spec

The original Phase 3 draft was not implementation-ready. It drifted from the
code that already exists in Phase 1 and Phase 2 in several important ways:

1. It mutated `ProductionStage` plan nodes with runtime status, timestamps,
   and results even though runtime state belongs in `StageRunRecord`.
2. It used field names and shapes that do not exist in the current entities,
   for example `asset_types`, `qa_criteria`, `dependsOn`, `timeout_ms`, and
   `query_used`.
3. It assumed repository methods such as `recordStageCompletion(...)` that do
   not exist in `FactoryRepository`.
4. It treated orchestration progress as an ad hoc callback problem instead of
   integrating with the existing deferred-job and chat progress model.
5. It blurred the Phase 3 and Phase 4 boundary by describing a full QA system
   before the QA gate registry and remediation policy have been designed.

This document corrects those issues and locks Phase 3 to the current repo
contracts.

## Phase Boundary

Phase 3 is responsible for:

- turning `ProductBrief` into a valid `ProductionDAG`
- creating and updating `WorkOrder` runtime state
- materializing `StageRunRecord` rows as the source of runtime execution truth
- delegating stage execution through explicit executor interfaces
- persisting stage outputs through `FactoryRepository.appendOutput(...)`
- appending execution events through `FactoryRepository.appendEvent(...)`
- translating orchestration progress into deferred-job progress updates
- pausing cleanly on failure so Phase 5 revision workflows can resume from
  durable checkpoints

Phase 3 is not responsible for:

- implementing the full QA criteria registry or remediation policy matrix
- building UI screens or HTTP APIs
- introducing a separate workflow engine, graph package, or event-sourcing
  subsystem
- hiding factory runtime state inside mutable plan nodes

## Core Design Decisions

### 1. The DAG is immutable plan data

`ProductionDAG` and `ProductionStage` remain planning artifacts. They describe
what should run and in what dependency order. They do not store runtime status,
timestamps, results, retries, or errors.

### 2. `StageRunRecord` is the runtime execution record

Every stage transition is expressed through a durable `StageRunRecord` written
through `FactoryRepository.upsertStageRun(...)`. This keeps the runtime model
aligned with Phase 1 and Phase 2 and avoids splitting truth between in-memory
state and persisted snapshots.

### 3. Outputs are persisted as first-class entities

Successful stage execution produces a typed output such as `ResearchPacket`,
`Draft`, `FactoryAsset`, `Composition`, `QAReport`, `Release`, or `Outcome`.
The orchestrator persists those outputs through
`FactoryRepository.appendOutput(...)` and stores only a `resultRef` on the
`StageRunRecord`.

### 4. Work-order progress is derived, not manually mirrored

The orchestrator updates `WorkOrder.status`, timestamps, revision,
`pausedState`, and execution log through the work-order aggregate, but
stage-level progress is still derived from `stageRuns` plus the current DAG.
This avoids stale duplicated stage status.

### 5. Sequential stages, optional within-wave parallelism

The execution engine remains sequential at the DAG wave level. A set of stages
may run in parallel only when all of these are true:

- every stage in the wave has all dependencies satisfied
- every stage is marked `parallelizable`
- `ProductBrief.executionPreferences.parallelizeAssets` is true
- the orchestrator can still deterministically persist completion and failure
  ordering

The design should optimize for correctness and recoverability before maximizing
concurrency.

## Implementation Surface

Phase 3 should introduce these runtime seams:

- `DAGPlanner`
  Purpose: turns `ProductBrief` into `ProductionDAG`
  Suggested location: `src/lib/factory/dag-planner.ts`
- `ProductionOrchestrator`
  Purpose: runs work orders against the DAG and repository
  Suggested location: `src/lib/factory/production-orchestrator.ts`
- `StageExecutorRegistry`
  Purpose: resolves executors by `StageKind`
  Suggested location: `src/lib/factory/stage-executor-registry.ts`
- `StageExecutor` contract
  Purpose: provides a uniform execution API for all stage kinds
  Suggested location: `src/lib/factory/stage-executors/types.ts`
- concrete executors
  Purpose: research, draft, asset generation, composition, release, plus Phase
  4 QA hooks
  Suggested location: `src/lib/factory/stage-executors/`
- `ProduceProductDeferredJobHandler`
  Purpose: bridges the orchestrator into the job queue
  Suggested location: `src/lib/factory/produce-product-deferred-job.ts`

## Planner Design

### Planner Responsibilities

`DAGPlanner` must:

- validate that the incoming brief has enough information to produce a DAG
- create a stable stage sequence using the Phase 1 `ProductionStage` shape
- insert one asset-generation stage per requested `ProductBrief.assetKinds`
  entry
- honor `ProductBrief.executionPreferences.parallelizeAssets`
- preserve deterministic stage keys so retries and resume logic can target
  exact stages
- emit a fully valid `ProductionDAG` with `schemaVersion: 1`

### Required stage shape

Planner output must use the current entity contract:

- `key`, not `id`
- `kind`, not `type`
- `dependencyKeys`, not `dependsOn`
- `timeoutMs`, not `timeout_ms`
- `config.assetKind`, not `config.asset_type`
- `autoParallelize`, not `auto_parallelize`

### Baseline DAG structure

For an initial multi-asset publish flow, the planner should generate these
logical stages in order:

1. `research`
2. `draft`
3. one `asset_generation` stage per requested asset kind
4. `composition`
5. `qa_asset`
6. `qa_page`
7. `qa_resolution`
8. `release`

`outcome` should not be in the synchronous batch path by default. If Phase 3
includes it at all, it should be modeled as a follow-up observation stage after
release rather than something that blocks publication.

### Stage-key policy

Stage keys must be deterministic and human-readable. Recommended pattern:

- `research`
- `draft`
- `asset_chart_primary`
- `asset_audio_primary`
- `composition`
- `qa_asset`
- `qa_page`
- `qa_resolution`
- `release`

Do not use unstable numeric-only suffixes when the brief contents can produce a
better key. Resume, retry, and debugging all get harder when stage keys are
opaque.

### Timeout policy

Timeouts should be stage-kind defaults with optional planner overrides:

- research: modest timeout
- draft: moderate timeout
- asset generation: asset-kind-specific timeout
- composition: moderate timeout
- QA: moderate timeout
- release: moderate timeout

The planner should centralize those defaults in one place so tests can assert
them without reaching into executor internals.

### Planner negative and edge cases

Planner tests must cover:

- brief with duplicate asset kinds rejected or normalized according to the
  entity contract
- brief with one asset kind
- brief with many asset kinds up to `executionPreferences.maxAssetCount`
- brief with `parallelizeAssets: false` still generating correct dependencies
- empty asset-kind list rejected before planning
- stage-key uniqueness
- dependency graph validity and cycle absence
- release channels propagated from `ProductBrief.targetChannels`
- QA criteria propagated from `ProductBrief.qaCriteria`

## Orchestrator Design

### Orchestrator Responsibilities

`ProductionOrchestrator` must:

- load the latest `WorkOrder` and current DAG from `FactoryRepository`
- determine the next runnable stage wave from the DAG plus current `stageRuns`
- persist stage-run transitions before and after execution
- append stage outputs through `appendOutput(...)`
- append execution events through `appendEvent(...)`
- update the aggregate `WorkOrder` status and execution log through
  `updateWorkOrder(...)`
- create a checkpoint when orchestration pauses on failure or policy-based
  interruption
- translate internal execution state into deferred-job progress updates

### Runtime model

The orchestrator should treat a work order as the aggregate root and derive
current stage state from:

- `workOrder.currentDag`
- `workOrder.stageRuns`
- persisted outputs
- active checkpoint state when present

It should not mutate stage definitions to track execution.

### Recommended execution loop

1. Load the latest `WorkOrder` from the repository.
2. Resolve the next runnable stage or runnable wave.
3. Create or update the `StageRunRecord` to `running` with incremented
   `attemptCount` and `startedAt`.
4. Append a factory event noting the stage start.
5. Execute the stage through the resolved executor with timeout and abort
   support.
6. Persist the stage output via `appendOutput(...)`.
7. Update the `StageRunRecord` to `succeeded` with `resultRef` and
   `completedAt`.
8. Append a factory event noting success.
9. Update the `WorkOrder` aggregate and derived progress snapshot.
10. Continue until all required stages succeed or a failure policy pauses the
    work order.

### Failure handling

The orchestrator must distinguish at least four failure classes:

1. executor validation failure
2. transient dependency or provider failure
3. timeout or cancellation
4. invariant violation or persistence failure

Failure policy for Phase 3:

- one automatic retry only when the brief allows
  `executionPreferences.autoRetryOnFailure`
- no retry for invariant violations or obviously deterministic bad input
- pause the work order after retry budget exhaustion
- persist a checkpoint with `resumeFromStageKey`
- persist failure details on the `StageRunRecord` and in
  `WorkOrder.executionLog`

### Concurrency policy

If Phase 3 ships with parallel asset execution, it must do so only for a single
dependency wave. The orchestrator must not start later stages until the full
wave is terminal. Mixed success and failure inside a wave must pause the work
order instead of partially advancing to composition.

If implementation complexity or recovery semantics become unclear, ship
sequential execution first and leave the parallel wave runner behind an internal
seam. A correct sequential orchestrator is acceptable Phase 3 scope; a
half-recoverable parallel engine is not.

### Idempotency and resume expectations

The orchestrator must be able to re-enter a persisted work order without
corrupting state.

Required protections:

- do not create a second running stage record for the same `stageKey`
- do not append duplicate success outputs for an already-succeeded terminal
  stage
- detect and reject resume attempts against missing or consumed checkpoints
- re-load repository state after writes when making control-flow decisions
- treat repository state as durable truth, not stale in-memory aggregates

## Stage Executor Contract

All stage executors should implement a uniform contract. Phase 3 should prefer
a small, typed interface rather than a permissive `unknown` API.

Recommended shape:

```ts
export interface StageExecutionContext {
  workOrder: WorkOrder;
  brief: ProductBrief;
  stage: ProductionStage;
  priorStageRuns: readonly StageRunRecord[];
  resolvedInputs: {
    outputsByStageKey: ReadonlyMap<string, FactoryOutputRecord[]>;
  };
  abortSignal?: AbortSignal;
  emitProgress?: (payload: Record<string, unknown>) => Promise<void>;
}

export interface StageExecutionResult {
  entityKind: StageResultEntityKind;
  entity: FactoryOutputEntity;
  supersedesEntityId?: string;
  executionDetails?: Record<string, unknown>;
}

export interface StageExecutor {
  readonly kind: StageKind;
  execute(context: StageExecutionContext): Promise<StageExecutionResult>;
}
```

Key rules:

- executors return typed entities, not ad hoc blobs
- the orchestrator, not the executor, is responsible for writing
  `StageRunRecord`
- executor progress should flow through a provided callback so the orchestrator
  can fan it out to factory events and deferred-job progress updates
- executor lookup should happen through a registry keyed by `StageKind`

## Executor Responsibilities

### Research executor

- input: `ProductBrief`
- output: `ResearchPacket`
- responsibility: gather source material, normalize claims, capture provenance
- must not directly write repository rows outside the orchestrator-managed
  output path

### Draft executor

- input: brief plus research output
- output: `Draft`
- responsibility: produce structured narrative content grounded in the research
  packet

### Asset-generation executor

- input: brief, draft, stage asset config
- output: `FactoryAsset`
- responsibility: route by `config.assetKind` to chart, audio, video, image, or
  other asset generators already present in the repo
- edge case: if a requested asset kind has no generator, fail deterministically
  before composition

### Composition executor

- input: draft plus all required asset outputs
- output: `Composition`
- responsibility: assemble the final multi-asset surface and preserve asset
  membership ordering
- edge case: missing required asset output must fail before emitting a
  composition

### QA executors

Phase 3 should define the seams for `qa` and `qa_resolution` stage kinds, but
detailed criteria evaluation and remediation policy belong to Phase 4.

That means Phase 3 may do one of two valid things:

1. include the stage kinds and executor interfaces now, with placeholder
   implementations deferred
2. include the stage kinds in the planner only once Phase 4 lands, if partial
   QA stages would create dead code in the meantime

Whichever path is chosen, the Phase 3 implementation must not force a fake QA
model that Phase 4 will need to rip out.

### Release executor

- input: composition, approved QA state, brief target channels
- output: `Release`
- responsibility: create the versioned publish artifact and capture release
  metadata
- edge case: release must not succeed if required QA gates are still unresolved

## Deferred-Job Integration

Phase 3 should integrate through the existing job infrastructure rather than
inventing a factory-only runner.

### Handler responsibilities

`ProduceProductDeferredJobHandler` should:

1. parse and validate the incoming production request into a `ProductBrief`
2. create the initial `WorkOrder`
3. generate and persist the DAG through `saveProductionDAG(...)`
4. run the orchestrator with the current job context and abort signal
5. map factory progress into the job progress phases surfaced by the existing
   jobs APIs
6. return a compact final result keyed by canonical entity ids rather than a
   large mutable in-memory object

### Progress integration

Do not invent a factory-specific streaming mechanism for Phase 3. Reuse the
repo's existing progress model:

- deferred job progress updates for durable user-visible status
- factory events for orchestration-local audit trail
- existing chat and jobs endpoints as the transport surfaces

If chat needs a factory-specific presenter later, that belongs in a follow-up
slice, not inside the core orchestrator.

## Persistence Contract Usage

The orchestrator should use Phase 2 exactly as implemented today:

- `createWorkOrder(...)`
- `updateWorkOrder(...)`
- `saveProductionDAG(...)`
- `findWorkOrderById(...)`
- `upsertStageRun(...)`
- `appendOutput(...)`
- `createCheckpoint(...)`
- `markCheckpointConsumed(...)`
- `appendEvent(...)`

Avoid adding orchestration-specific repository shortcuts until implementation
proves a real gap. The current contract is intentionally low-level and
explicit.

## Testing Matrix

Phase 3 tests must be split by responsibility.

### Planner unit tests

- correct stage sequence for one asset kind
- correct stage sequence for multiple asset kinds
- deterministic stage keys
- valid dependencies and no cycles
- timeout defaults by stage kind
- release channels and QA criteria propagated into stage configs

### Orchestrator unit tests

- starts the first runnable stage correctly
- advances to the next stage after success
- writes `StageRunRecord` running then succeeded states
- appends output with correct `entityKind` and `stageRunId`
- pauses and checkpoints on failure
- retries exactly once when policy allows it
- does not retry invariant failures
- resumes correctly from persisted state
- does not duplicate terminal outputs on re-entry

### Executor tests

- each executor validates required prior outputs
- asset executor routes to the correct generator by `assetKind`
- composition preserves asset ordering and membership
- release refuses unresolved QA state

### Integration tests

- deferred job creates work order, saves DAG, runs orchestrator, and emits
  progress
- progress mapping remains monotonic and never exceeds 100 percent
- abort signal cancels execution cleanly and records terminal state
- persisted work order reloads with current stage runs and checkpoint state
  after orchestration activity

### Negative and edge cases

- missing executor for a planned stage kind
- duplicate stage key in planner output
- stage depends on missing output despite succeeded dependency stage
- repository write succeeds for output but fails for work-order update
- checkpoint creation fails after stage failure
- resumed work order points at a stage key no longer present in the DAG
- parallel asset wave where one stage succeeds and one stage fails

## Files to Create

- `src/lib/factory/dag-planner.ts`
  Build valid `ProductionDAG` instances from `ProductBrief`
- `src/lib/factory/production-orchestrator.ts`
  Run work orders through persisted stage transitions
- `src/lib/factory/stage-executor-registry.ts`
  Resolve executors by `StageKind`
- `src/lib/factory/stage-executors/types.ts`
  Shared executor contracts
- `src/lib/factory/stage-executors/research-executor.ts`
  Research output generation
- `src/lib/factory/stage-executors/draft-executor.ts`
  Draft generation
- `src/lib/factory/stage-executors/asset-generation-executor.ts`
  Asset routing and generation
- `src/lib/factory/stage-executors/composition-executor.ts`
  Composition assembly
- `src/lib/factory/stage-executors/release-executor.ts`
  Publish and release materialization
- `src/lib/factory/produce-product-deferred-job.ts`
  Deferred-job bridge for the factory
- `tests/factory/dag-planner.test.ts`
  Planner-focused tests
- `tests/factory/production-orchestrator.test.ts`
  Orchestrator-focused tests
- `tests/factory/produce-product-deferred-job.test.ts`
  Deferred-job integration tests

## Anti-Goals

Phase 3 should explicitly avoid:

- mutating `ProductionStage` with runtime fields
- duplicating stage results inside both the work order and a separate event
  store
- building a second progress system parallel to deferred jobs
- coupling the orchestrator directly to UI response formatting
- forcing Phase 4 QA behavior to exist before the QA system design is complete

## Definition of Done

Phase 3 is complete when:

- a valid `ProductBrief` can be turned into a valid persisted `ProductionDAG`
- a work order can execute through persisted `StageRunRecord` updates
- successful stages persist typed outputs via
  `FactoryRepository.appendOutput(...)`
- failures pause the work order and create a checkpoint
- progress is visible through the existing job-progress surfaces
- the runtime is invokable through the catalog-derived deferred `produce_product`
  tool so the worker and job registry use the same execution path
- focused unit and integration tests cover positive, negative, and edge-case
  paths
- no dead code or parallel runtime model has been introduced that Phase 4 will
  have to undo

## Next Steps

1. Implement the planner and orchestrator seams with sequential execution first
   unless parallel wave support remains simple and recoverable.
2. Add the minimal executor set needed for the happy path: research, draft,
   asset generation, composition, and release.
3. Leave detailed QA gate execution and remediation policy to Phase 4 while
   preserving clean stage-kind seams for it.
