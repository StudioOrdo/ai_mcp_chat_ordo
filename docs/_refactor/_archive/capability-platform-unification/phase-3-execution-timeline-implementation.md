# Phase 3 Implementation Spec — Execution Timeline Projection

## Objective

Turn Phase 3 of the platform roadmap into a code-facing implementation plan
that starts from the completed Phase 1 and Phase 2 seams and introduces one
canonical execution timeline projection for inspection.

This phase should not replace current persistence models. It should introduce a
read-first platform seam that projects current execution state from the
production-proven job and factory systems into one queryable and renderable
timeline model.

The initial timeline should be able to answer:

- what ran
- what is running now
- what failed
- what artifacts were produced
- what checkpoint or revision state exists
- what next actions are honestly available

## Phase 1 and Phase 2 Handoff

Phase 1 introduced one canonical runtime seam for capabilities.

Phase 2 introduced one canonical knowledge seam and one canonical discovery
seam.

Phase 3 should preserve that pattern by introducing one canonical inspection
seam for execution rather than continuing to expose subsystem-specific read
models as the default inspection surface.

The handoff assumptions now in place are:

- `CapabilityRuntime` is the canonical runtime projection for capabilities
- `KnowledgeAccessService` is the canonical grounded retrieval seam
- `DiscoverySearchService` is the canonical discovery seam
- execution inspection is still split across job snapshots, job history,
  work-order inspection payloads, stage-run queries, and revision routes

## Current Code Grounding

Execution inspection is already strong in multiple subsystems, but ownership is
split across parallel read models.

Current job inspection owners:

- `src/lib/jobs/job-publication.ts` is the canonical orchestration seam for
  renderable job status publication through `buildJobPublication()`
- `src/lib/jobs/job-read-model.ts` owns synthetic event fallback and the
  canonical `JobStatusSnapshot` construction path through
  `buildJobStatusSnapshot()`
- `src/lib/jobs/job-status-query.ts` exposes repository-backed snapshot readers
  for single jobs, conversation jobs, and user jobs
- `src/lib/jobs/job-event-history.ts` maps durable job events into
  renderable history entries
- `src/core/use-cases/tools/deferred-job-status.tool.ts` exposes agent-facing
  job inspection tools over `JobStatusQuery`
- `src/app/api/jobs/[jobId]/route.ts` exposes signed-in per-job inspection and
  retry/cancel actions for current product surfaces

Current factory inspection owners:

- `src/core/entities/work-order.ts` owns `ExecutionLogEntry[]`, pause state,
  stage-run progress derivation, and revision lineage on `WorkOrder`
- `src/lib/factory/production-orchestrator.ts` appends work-order execution
  log entries and durable factory events while coordinating retries,
  checkpoints, pauses, resumes, and stage failures
- `src/adapters/FactoryDataMapper.ts` persists and reloads work orders,
  stage runs, outputs, checkpoints, and ordered work-order event streams
- `src/lib/factory/factory-revision-root.ts` composes pause/refine/resume
  services around the current work-order repository and orchestrator
- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`
  exposes the current operator inspection surface by returning the raw work
  order, active checkpoint, stage runs, outputs, and events together

Current tool-execution inspection owners:

- `src/core/entities/capability-result.ts` defines
  `CapabilityResultEnvelope`, progress phases, replay snapshots, and artifact
  references for tool results
- synchronous tool execution does not yet have one durable timeline store that
  matches the job and factory event models
- direct tool execution should therefore enter Phase 3 through an explicit
  adapter rule rather than a fabricated durable history model

Current chat-turn and observability owners:

- `src/lib/chat/chat-turn.ts` owns direct-turn execution entry for
  non-deferred chat requests
- `src/lib/chat/stream-execution.ts` owns streamed chat lifecycle handling,
  deferred-job enqueue bridging, and generation interruption/stoppage events
- `src/lib/observability/events.ts` owns the current subscribe/emit surface for
  log and route-metric observability events
- chat runtime and observability already emit useful execution-adjacent
  signals, but they do not yet expose one stable persisted timeline model

## Current Problem Statement

Today the system can explain execution, but it does so through multiple local
inspection surfaces:

1. jobs expose snapshots and histories through job-specific publication and
   query helpers
2. factory work orders expose raw work-order inspection payloads with separate
   checkpoint, output, event, and stage-run lists
3. tool execution exposes progress, replay, and artifacts inside result
   envelopes, but not yet through one canonical timeline reader
4. operator routes and agent tools must know which subsystem produced the work
   before they can inspect it correctly

This makes Phase 5 impossible to finish cleanly unless Phase 3 first collapses
execution inspection into one platform surface.

## Scope

### In Scope

- define canonical execution timeline entities and readers
- introduce read-only timeline projection for jobs and factory work orders
- define the Phase 3 adapter rule for direct tool execution inspection
- define the Phase 3 compatibility rule for `chat_turn` and observability
  inputs
- expose artifact, checkpoint, failure, and next-action information through
  the timeline
- add focused parity and migration tests for timeline projection

### Out of Scope

- replacing job or factory persistence models
- revision action generalization beyond inspection support levels
- agent facade work
- persistence consolidation of execution stores
- forcing direct synchronous tools into a fake durable event model

## Canonical Files To Touch

### Existing Files

- `src/lib/jobs/job-publication.ts`
- `src/lib/jobs/job-read-model.ts`
- `src/lib/jobs/job-event-history.ts`
- `src/lib/jobs/job-status-query.ts`
- `src/core/use-cases/tools/deferred-job-status.tool.ts`
- `src/app/api/jobs/[jobId]/route.ts`
- `src/core/entities/work-order.ts`
- `src/lib/factory/production-orchestrator.ts`
- `src/adapters/FactoryDataMapper.ts`
- `src/lib/factory/factory-revision-root.ts`
- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`
- `src/core/entities/capability-result.ts`

### New Files

- `src/core/platform/execution/ExecutionTimeline.ts`
- `src/core/platform/execution/ExecutionTimelineProjector.ts`
- `src/core/platform/execution/ExecutionTimelineReader.ts`
- `src/core/platform/execution/ExecutionTimelineProjector.test.ts`
- `src/core/platform/execution/ExecutionTimelineReader.test.ts`

The exact filenames can move slightly, but the ownership boundary should stay
the same.

## Target Timeline Shape

Phase 3 should introduce a projection that answers these questions for every
inspectable execution:

1. what execution is this?
2. what kind of execution produced it?
3. what lifecycle state is it in now?
4. what happened over time?
5. what artifacts, outputs, or checkpoints exist?
6. what revision or retry actions are honestly available?

This projection must be derived from existing subsystem state, not manually
re-authored in operator routes or agent tools.

## Grounded Phase 3 Assumptions

The roadmap and contracts are directionally right, but implementation should
start from these grounded assumptions:

- `buildJobPublication()` and `buildJobStatusSnapshot()` are already the
  canonical job inspection orchestration seams and should remain dependencies
  of the first timeline projector slices rather than being bypassed
- `WorkOrder.executionLog`, `StageRunRecord[]`, factory events, outputs, and
  checkpoints already contain enough information to project a useful factory
  timeline without changing the orchestrator first
- the admin factory revision route is the clearest current operator inspection
  surface and should become an adapter over timeline readers instead of staying
  a raw multi-query aggregator forever
- `JobStatusQuery` is the current narrow agent/operator read seam for jobs and
  should become a dependency of the timeline reader during migration rather
  than being replaced outright in the first slice
- current job next-action affordances are already derived through
  `manual-replay.ts`, `job-action-executor.ts`, and `JobActionResolvers.ts`,
  so Phase 3 should project those affordances rather than re-inventing retry,
  cancel, or post-success action policy inside the timeline layer
- direct synchronous tool execution does not yet have a durable event stream
  equivalent to jobs or work orders, so the first Phase 3 implementation must
  represent tool execution honestly using available result-envelope,
  replay-snapshot, and progress metadata only where an execution reference
  already exists
- `chat_turn` and observability remain part of the platform contract, but the
  first executable slices should treat them as explicit reduced-support inputs:
  accepted by the contract, documented as deferred for full projection, and
  tested as unsupported or limited until stable persisted readers exist
- revision support levels should be surfaced by the timeline, but the
  generalized revision contract itself belongs to Phase 4

## Initial Projection Rules

### Jobs

Job timelines should be projected from current durable job state plus event
history.

Initial job source inputs:

- `JobRequest`
- latest renderable event or synthetic event fallback
- durable ordered `JobEvent[]` history when available
- result-envelope, replay-snapshot, checkpoint, and failure metadata already
  present in job state or event payloads

Projection rules:

- preserve the current renderable vs audit-only event distinction used by
  `buildJobPublication()`
- do not treat audit-only events as timeline milestones when a renderable event
  or synthetic state projection should represent the lifecycle instead
- keep current failure classification and recovery-mode semantics visible
  rather than inferring new taxonomy in the timeline layer
- derive job next actions from the current action owners instead of re-encoding
  policy locally:
  `manual-replay.ts` for cancel/retry eligibility,
  `job-action-executor.ts` for server-side control boundaries, and
  `JobActionResolvers.ts` for post-success UI action affordances

### Factory Work Orders

Factory timelines should be projected from current work-order state plus the
current durable stage-run, event, output, and checkpoint records.

Initial factory source inputs:

- `WorkOrder`
- `StageRunRecord[]`
- factory event stream from `FactoryDataMapper.listEventsForWorkOrder()`
- active checkpoint from `findLatestActiveCheckpoint()`
- active outputs from `listOutputsForWorkOrder()`

Projection rules:

- preserve the current work-order lifecycle semantics around paused vs running
  vs succeeded states
- surface both the summarized `executionLog` and the durable factory events,
  but keep one canonical projection owner responsible for choosing the timeline
  events to expose
- use durable factory events as the canonical source when an equivalent durable
  event exists for the same lifecycle moment, and use `executionLog` as a
  fallback summary source for lifecycle moments that are not otherwise present
  in the durable event stream
- when `executionLog` and durable events overlap, the projector should prefer
  durable event payload detail and avoid duplicating both representations as
  separate user-visible timeline entries
- expose checkpoint and resume frontier information without prematurely
  generalizing refine/resume actions beyond honest support levels

### Chat Turns And Observability

`chat_turn` and observability remain part of the platform contract in Phase 3,
but they need an explicit rollout rule.

Initial rule:

- the contract should continue to reserve support for `executionKind:
  "chat_turn"`
- the first implementation slices may return explicit unsupported or
  limited-support timeline responses for chat-turn and observability-backed
  inspection until a stable persisted reader is introduced
- chat runtime lifecycle signals from `chat-turn.ts` and
  `stream-execution.ts`, and observability signals from
  `observability/events.ts`, should be treated as future projection inputs, not
  silently dropped from the platform model
- tests and docs must call out this reduced support level honestly so the Phase
  3 implementation does not contradict the broader contract

### Direct Tool Execution

Direct tool execution should be represented through an explicit adapter rule in
Phase 3.

Initial rule:

- if a tool execution already produces a stable execution reference plus a
  `CapabilityResultEnvelope` with progress, artifacts, or replay metadata, the
  timeline may project a limited `executionKind: "tool"` view from those
  fields
- if no stable execution reference or durable progress exists, Phase 3 should
  not invent a fake timeline history; the execution should remain unsupported
  by the first reader slices and be called out honestly in tests and docs

## Implementation Slices

### Slice 1: Introduce Read-Only ExecutionTimeline Entities

Tasks:

- create canonical `ExecutionTimeline` and `ExecutionTimelineEvent` platform
  entities
- define projector input types for jobs, work orders, and limited tool
  execution adapters
- do not yet migrate operator or agent readers

Acceptance criteria:

- a canonical timeline contract exists in code
- job/work-order/tool adapter support levels are explicit
- no existing inspection surface is deleted

### Slice 2: Add Job Timeline Projection

Tasks:

- project job snapshots and durable event history into the timeline contract
- reuse current publication/read-model logic instead of rebuilding job status
  semantics from raw rows
- expose job artifacts, failure reasons, retry state, and checkpoint metadata
  through the projected timeline

Acceptance criteria:

- one projector can explain current job lifecycle state and history
- audit-only vs renderable job event behavior remains stable
- existing job snapshot consumers remain behaviorally stable during migration

### Slice 3: Add Factory Work-Order Timeline Projection

Tasks:

- project `WorkOrder`, stage runs, factory events, outputs, and checkpoints
  into the timeline contract
- surface paused state, resume checkpoint, active stage, and asset/output
  records through one projected view
- keep current factory revision services unchanged while making inspection more
  uniform

Acceptance criteria:

- one projector can explain current factory lifecycle state and major events
- artifact, checkpoint, and failure information is visible from the projected
  timeline
- the timeline is honest about the current revision frontier and available next
  actions

### Slice 4: Introduce Read-Only Timeline Reader

Tasks:

- create `ExecutionTimelineReader` as the canonical read surface
- support at minimum `job` and `work_order` execution kinds in the first slice
- keep current job and factory inspection routes as initial adapters over the
  new reader where practical

Acceptance criteria:

- one platform read surface exists for job and work-order inspection
- reader adapters do not regress current operator or agent behavior
- subsystem-specific inspection routes stop owning raw projection logic

### Slice 5: Add Limited Tool-Execution Projection Support

Tasks:

- define the limited Phase 3 adapter rule for direct tool execution inspection
- project result-envelope progress, replay, and artifacts only when a stable
  execution reference exists
- make unsupported direct-tool cases explicit instead of silently fabricating
  history

Acceptance criteria:

- direct tool execution support is explicit and honest
- supported tool executions can expose artifacts/progress through the timeline
- unsupported tool executions are represented clearly in code and tests

### Slice 6: Add Explicit Reduced-Support Coverage For Chat Turns And Observability

Tasks:

- preserve `chat_turn` in the canonical execution timeline contract
- define explicit unsupported or limited-support reader behavior for chat-turn
  and observability-backed inspection in the first rollout
- document the follow-on requirement for stable persisted readers before full
  chat-turn or observability timeline support is claimed

Acceptance criteria:

- the implementation does not silently narrow the contract relative to the
  package docs
- unsupported or reduced-support execution kinds are explicit in code and tests
- the Phase 3 reader stays honest about what it can and cannot inspect yet

### Slice 7: Add Contract And Migration Parity Coverage

Tasks:

- add focused projector tests for jobs and work orders
- add reader tests that verify adapter parity for current job and factory
  inspection surfaces
- document the intentional remaining raw ownership boundaries, especially for
  unsupported direct-tool histories

Acceptance criteria:

- timeline projection has explicit focused gates
- migration from job/factory-specific readers is parity-tested before raw
  projection logic is deleted
- deletion decisions are backed by tests, not confidence alone

## Implementation Closeout

Phase 3 is now implemented in code and validated against the grounded scope in
this spec.

Completed outcomes:

- canonical execution inspection types now live in
  `src/core/platform/execution/ExecutionTimeline.ts`
- canonical projection now lives in
  `src/core/platform/execution/ExecutionTimelineProjector.ts`
- canonical read-first inspection now lives in
  `src/core/platform/execution/ExecutionTimelineReader.ts`
- `RepositoryFactory.getExecutionTimelineReader()` is the canonical runtime
  entry point, and `getJobStatusQuery()` / `createJobStatusQuery()` now act as
  compatibility adapters over the reader instead of owning a separate job-only
  inspection implementation
- job inspection routes now read through the canonical reader:
  `src/app/api/jobs/[jobId]/route.ts`,
  `src/app/api/jobs/[jobId]/events/route.ts`,
  `src/app/api/jobs/route.ts`,
  `src/app/api/chat/jobs/[jobId]/route.ts`, and
  `src/app/api/chat/jobs/route.ts`
- factory revision inspection now reads through the canonical reader in
  `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`
- direct tool execution support is explicit through limited `tool` timeline
  projection when a stable `CapabilityResultEnvelope` exists
- `chat_turn` and observability remain explicit in the contract and return
  honest reduced-support / unsupported timeline responses until persisted
  readers exist
- factory execution inspection now uses a consistent chronological output
  ordering contract, which fixed refined-asset recomposition and release
  continuity during resume flows

Completed slices:

- Slice 1: canonical timeline contract and support-level types added
- Slice 2: job projection implemented with renderable-event filtering,
  checkpoint visibility, artifact visibility, and next-action projection
- Slice 3: factory projection implemented with durable-event precedence over
  `executionLog`, checkpoint visibility, artifact visibility, and revision
  frontier actions
- Slice 4: canonical reader implemented and adopted by the main operator and
  chat inspection routes
- Slice 5: limited direct-tool timeline projection implemented
- Slice 6: explicit reduced-support handling implemented for `chat_turn` and
  observability inputs
- Slice 7: parity and regression coverage added for the projector, reader,
  migrated routes, and factory resume/refinement behavior

## Coding Rules For This Phase

1. Do not replace job or factory persistence in Phase 3.
2. Do not let operator routes become canonical timeline projectors.
3. Do not fabricate durable tool histories that the system does not actually
   store.
4. Do not move revision action policy into the timeline projector.
5. Prefer read-only adapters during migration over inspection-surface rewrites.

## Review Checklist

Every Phase 3 PR should answer yes to all of these:

1. Does this strengthen one canonical execution inspection owner?
2. Does this reduce duplicate projection logic instead of moving it around?
3. Are unsupported execution or revision states explicit in the contract?
4. Is focused validation present for the migrated slice?
5. Did this preserve current job and factory runtime behavior while improving
   inspection?

## Focused Validation Targets

Phase 3 should close slices with focused validation for:

- timeline projector tests for jobs
- timeline projector tests for work orders
- timeline reader parity tests for current job and factory surfaces
- adapter tests for current inspection routes and tools
- reduced-support tests for chat-turn and observability timeline inputs

Representative current files that should stay in the validation orbit:

- `src/lib/jobs/job-publication.ts`
- `src/lib/jobs/job-read-model.ts`
- `src/lib/jobs/job-event-history.ts`
- `src/lib/jobs/job-status-query.ts`
- `src/lib/jobs/manual-replay.ts`
- `src/lib/jobs/job-action-executor.ts`
- `src/core/use-cases/tools/deferred-job-status.tool.ts`
- `src/lib/chat/JobActionResolvers.ts`
- `src/lib/chat/chat-turn.ts`
- `src/lib/chat/stream-execution.ts`
- `src/core/entities/work-order.ts`
- `src/lib/factory/production-orchestrator.ts`
- `src/adapters/FactoryDataMapper.ts`
- `src/lib/observability/events.ts`
- `src/app/api/jobs/[jobId]/route.ts`
- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`

Representative current regression suites that should remain in scope:

- `src/lib/jobs/job-publication.test.ts`
- `src/lib/jobs/job-read-model.test.ts`
- `src/lib/jobs/job-status.test.ts`
- `src/lib/jobs/deferred-job-worker.test.ts`
- `src/lib/chat/JobActionResolvers.test.ts`
- `tests/factory/production-orchestrator.test.ts`
- `tests/factory/revision-control-service.test.ts`
- `src/adapters/FactoryDataMapper.test.ts`
- `src/app/api/jobs/[jobId]/route.test.ts`
- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.test.ts`

The initial service-backed slices should also add explicit parity coverage for:

- job timeline projection from durable events plus synthetic-event fallback
- job next-action projection parity against current cancel/retry/action owners
- work-order timeline projection from execution logs, stage runs, checkpoints,
  and outputs
- merge precedence between `executionLog` and durable factory events
- artifact and next-action visibility in the projected timeline
- honest unsupported-state handling for direct synchronous tool execution
- honest reduced-support handling for `chat_turn` and observability-backed
  inputs until stable readers exist

No Phase 3 slice should be closed using doc-only or diff-only validation.

## Definition Of Done

Phase 3 is complete only when:

- `ExecutionTimeline` exists as a canonical execution inspection contract
- job and work-order timelines can be read through one canonical reader
- artifacts, checkpoints, failures, and next actions are visible from the
  projected timeline when the source system supports them
- `chat_turn` remains explicit in the contract, and any reduced-support Phase 3
  handling is represented honestly rather than silently omitted
- operator and agent inspection surfaces can depend on the timeline reader
  instead of subsystem-specific raw projection logic where practical
- unsupported direct-tool timeline cases remain explicit rather than hidden
- execution inspection is materially more uniform without changing current job
  or factory execution behavior

## Initial Implementation Status

Phase 3 is implemented in the codebase.

Implemented runtime highlights:

- one canonical execution contract exists under `src/core/platform/execution/`
- one canonical reader backs job and work-order inspection
- the primary operator and chat inspection routes are reader-backed
- direct-tool inspection is explicit and limited rather than fabricated
- `chat_turn` and observability remain explicit with honest reduced-support
  handling

Validation closeout:

- focused core validation passed:
  `src/core/platform/execution/ExecutionTimelineProjector.test.ts` and
  `src/core/platform/execution/ExecutionTimelineReader.test.ts`
- focused inspection-route validation passed:
  job, chat-job, job-history, job-list, chat-job-list, and factory revision
  route tests
- broader Phase 3 regression passed:
  14 targeted files, 69 tests passed, 0 failed
