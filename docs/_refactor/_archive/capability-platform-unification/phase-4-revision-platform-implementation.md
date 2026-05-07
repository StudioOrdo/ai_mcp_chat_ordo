# Phase 4 Implementation Spec — Revision Platform Contract

## Objective

Turn Phase 4 of the platform roadmap into a code-facing implementation plan
that starts from the completed Phase 3 execution timeline seam and introduces
one canonical platform contract for revision.

This phase should not replace the current factory revision runtime. It should
lift the existing pause, refine, resume, and retry semantics into one platform
vocabulary that can express both advanced revision support and honest reduced
support levels.

The initial revision contract should be able to answer:

- can this execution be revised at all?
- what revision operations are supported?
- what revision state is active now?
- what transport should inspect or invoke those actions?
- what reduced-support fallback applies when only retry is available?

## Phase 3 Handoff

Phase 3 introduced one canonical execution inspection seam.

The handoff assumptions now in place are:

- `ExecutionTimeline` is the canonical execution inspection contract
- `ExecutionTimelineReader` is the canonical read-first inspection seam for
  jobs and work orders
- work-order inspection now exposes one canonical timeline, but revision
  actions are still owned by factory-specific services and routes
- retry-only job control still exists through job-local replay and action
  resolvers rather than a generalized platform revision contract

Phase 4 should preserve the same migration pattern used by the earlier phases:

- define one canonical contract first
- project existing production-proven behavior into that contract
- keep local subsystem owners as compatibility adapters during migration
- avoid inventing revision support that the runtime does not actually have

## Current Code Grounding

Revision behavior already exists, but it is not yet platform-owned.

Current advanced revision owners:

- `src/lib/factory/revision-control-service.ts` is the current advanced
  revision facade, but it is factory-specific through
  `FactoryRevisionControlService`
- `src/lib/factory/factory-revision-root.ts` composes the current factory
  revision services and exports the reference implementation for pause,
  refine, and resume flows
- `src/lib/factory/pause-work-order-service.ts` owns pause semantics,
  immediate vs requested pause behavior, and paused frontier persistence
- `src/lib/factory/asset-refinement-service.ts` owns advanced refinement
  semantics, including regenerate, replace-with-upload, and metadata-fix
  behavior
- `src/lib/factory/resume-work-order-service.ts` owns resume execution from a
  paused checkpoint or a selected earlier safe frontier
- `src/lib/factory/resume-frontier-planner.ts` owns the current paused
  frontier planning model and revision modes
- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`
  exposes the current transport surface for advanced revision inspection and
  actions

Current reduced-support revision owners:

- `src/lib/jobs/manual-replay.ts` owns retry and recovery eligibility for
  retry-only deferred jobs through `canManualReplayJob()` and
  `performManualJobReplay()`
- `src/lib/chat/JobActionResolvers.ts` maps current job inspection parts into
  cancel/retry action links, but that action vocabulary is job-specific rather
  than platform-level
- `src/app/api/jobs/[jobId]/route.ts` and `src/app/api/chat/jobs/[jobId]/route.ts`
  expose cancel and retry actions through job-specific HTTP transports

Current platform gap:

- `src/core/platform/execution/ExecutionTimeline.ts` exposes execution
  inspection but does not define revision entities, revision support levels,
  revision operations, or revision readers
- there is no `src/core/platform/revision/` module or equivalent canonical
  platform owner in the current codebase

## Current Problem Statement

Today the product has revision behavior, but not one platform revision model.

The current split is:

1. factory work orders support advanced revision through pause, refine, and
   resume, but only through factory-specific services and one admin route
2. deferred jobs support retry through job-local replay and job-local action
   policy, but not through a generalized reduced-support revision contract
3. execution inspection can now explain work through a unified timeline, but
   there is no corresponding platform layer that explains or invokes revision
   operations consistently
4. product transports still expose revision as separate subsystem verbs
   instead of one coherent revision vocabulary with support levels

This means the roadmap's Phase 4 claims are still aspirational. The codebase
has the reference behavior needed to build the contract, but it has not yet
been projected into a platform-owned model.

## Scope

### In Scope

- define canonical platform revision entities and support levels
- project current factory pause, refine, and resume behavior into the platform
  contract
- define reduced-support revision compatibility for retry-only job flows
- introduce a canonical read-first revision inspection seam
- introduce transport adapters that make revision inspection and actions more
  uniform
- add focused parity and migration tests for revision projection and adapters

### Out of Scope

- replacing the current factory revision runtime
- changing factory pause/refine/resume policy during the first platform slice
- inventing advanced revision support for deferred jobs or direct tools
- agent facade work
- user-experience simplification beyond the contract and transport alignment

## Canonical Files To Touch

### Existing Files

- `src/core/platform/execution/ExecutionTimeline.ts`
- `src/core/platform/execution/ExecutionTimelineReader.ts`
- `src/lib/factory/revision-control-service.ts`
- `src/lib/factory/factory-revision-root.ts`
- `src/lib/factory/pause-work-order-service.ts`
- `src/lib/factory/asset-refinement-service.ts`
- `src/lib/factory/resume-work-order-service.ts`
- `src/lib/factory/resume-frontier-planner.ts`
- `src/lib/jobs/manual-replay.ts`
- `src/lib/chat/JobActionResolvers.ts`
- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`
- `src/app/api/jobs/[jobId]/route.ts`
- `src/app/api/chat/jobs/[jobId]/route.ts`

### New Files

- `src/core/platform/revision/RevisionContract.ts`
- `src/core/platform/revision/RevisionProjector.ts`
- `src/core/platform/revision/RevisionReader.ts`
- `src/core/platform/revision/RevisionProjector.test.ts`
- `src/core/platform/revision/RevisionReader.test.ts`

The exact filenames can move slightly, but the ownership boundary should stay
the same.

## Target Revision Shape

Phase 4 should introduce a projection that answers these questions for every
revision-capable or retry-capable execution:

1. what execution is eligible for revision?
2. what revision support level does it have?
3. what operation kinds are supported?
4. what revision state is active now?
5. what transport or control boundary invokes those operations?
6. what next revision actions are honestly available?

This projection must be derived from existing subsystem behavior, not invented
inside routes or UI action builders.

## Grounded Phase 4 Assumptions

The roadmap is directionally right, but implementation should start from these
grounded assumptions:

- factory work orders are the reference implementation for advanced revision
  support and should remain so during the first platform slice
- `FactoryRevisionControlService` is already the narrowest current advanced
  revision facade and should be projected into the platform contract rather
  than bypassed
- retry-only job flows already have honest support boundaries through
  `manual-replay.ts` and should be represented as reduced support instead of
  being over-generalized into fake pause/refine/resume support
- the execution timeline layer should become a dependency of the revision
  reader, not a parallel competing surface
- the first platform slice should preserve factory-specific implementation
  detail while standardizing the shared vocabulary and transport shape
- unsupported revision kinds must be explicit in code and tests, not implied
  only in docs

## Initial Revision Rules

### Advanced Revision Support

Advanced revision support should be projected from the factory runtime.

Initial advanced-support inputs:

- `FactoryRevisionControlService`
- paused work-order state
- paused checkpoint and safe frontier planning
- refinement modes already defined by `resume-frontier-planner.ts`
- current factory revision route and execution timeline projection

Projection rules:

- preserve the current factory verbs `pause`, `refine`, and `resume` as the
  authoritative advanced revision actions in the first slice
- expose those actions through one platform vocabulary rather than requiring
  consumers to know factory-local service names
- keep frontier planning, refinement policy, and validation in the existing
  factory services during migration

### Reduced Revision Support

Reduced revision support should project retry-only job behavior honestly.

Initial reduced-support inputs:

- `manual-replay.ts`
- job retry/cancel action policy from `JobActionResolvers.ts`
- current job routes for cancel and retry

Projection rules:

- represent retry-only jobs as a reduced-support revision kind rather than as
  fully revision-capable executions
- do not fabricate pause, refine, or resume support for jobs that only support
  cancel and retry
- keep retry transport ownership in the current job routes until a canonical
  revision transport adapter exists

### Unsupported Revision Support

Executions without advanced or reduced revision support should still be
expressible by the contract.

Initial rule:

- unsupported revision cases should expose an explicit support level and no
  available actions
- direct synchronous tool executions remain unsupported until a real revision
  owner exists
- chat turns and observability remain out of scope for Phase 4 unless they
  gain concrete revision semantics first

## Implementation Slices

### Slice 1: Introduce Read-Only Revision Entities

Tasks:

- create canonical revision support-level, operation-kind, and revision-state
  entities
- define one contract that can represent advanced, reduced, and unsupported
  revision support
- do not yet migrate transports

Acceptance criteria:

- a canonical platform revision contract exists in code
- advanced, reduced, and unsupported support levels are explicit
- no existing subsystem revision owner is deleted

### Slice 2: Add Factory Revision Projection

Tasks:

- project current factory pause, refine, and resume support into the new
  contract
- expose paused frontier, available operations, and current reference
  transport for work orders
- keep current factory services unchanged while making inspection more uniform

Acceptance criteria:

- one projector can explain factory revision capability and state
- factory work orders remain the reference implementation for advanced support
- current factory revision behavior remains stable during migration

### Slice 3: Add Reduced-Support Job Projection

Tasks:

- project retry-only deferred jobs into reduced revision support
- map current job retry/cancel eligibility into the platform contract
- avoid implying advanced revision support where it does not exist

Acceptance criteria:

- the platform can explain retry-only job revision capability honestly
- reduced-support job revision is explicit in code and tests
- job retry behavior remains stable during migration

### Slice 4: Introduce Read-Only Revision Reader

Tasks:

- create `RevisionReader` as the canonical read surface for revision support
- support at minimum `work_order` and retry-capable `job` execution kinds in
  the first slice
- integrate with the execution timeline reader where practical

Acceptance criteria:

- one platform read surface exists for revision inspection
- advanced and reduced-support executions can be inspected through one reader
- local subsystem transports stop owning raw revision capability projection

### Slice 5: Add Transport Adapters

Tasks:

- adapt the current admin factory revision route over the new reader and
  operation contract where practical
- adapt job retry/cancel inspection surfaces to expose the same revision
  vocabulary where practical
- keep current authorization and mutation boundaries intact

Acceptance criteria:

- revision inspection and action surfaces become more uniform
- existing transport behavior remains stable during migration
- advanced and reduced-support revision cases use one platform vocabulary

### Slice 6: Add Contract And Migration Parity Coverage

Tasks:

- add focused projector tests for advanced and reduced-support revision
  behaviors
- add reader tests that verify parity against current factory and job
  transports
- document any intentionally remaining subsystem-owned behavior

Acceptance criteria:

- revision projection has explicit focused gates
- migration from subsystem-specific revision owners is parity-tested before raw
  projection logic is deleted
- the codebase, not only the roadmap, satisfies the definition of done below

## Ordered Implementation Checklist

This checklist turns the slices above into the concrete file-by-file work still
required to reach 100% completion.

### Step 0: Establish The Canonical Revision Contract Boundary

Current gap:

- no code exists yet under `src/core/platform/revision/`
- the Phase 4 revision contract only exists in roadmap and migration docs

Files to add:

- `src/core/platform/revision/RevisionContract.ts`
- `src/core/platform/revision/RevisionProjector.ts`
- `src/core/platform/revision/RevisionReader.ts`

Required work:

- define canonical revision support levels, revision states, revision
  operation kinds, and revision inspection records
- make advanced, reduced, and unsupported support levels first-class in the
  contract

Must be true before moving on:

- the codebase has one importable platform revision contract
- unsupported and reduced-support revision cases are modeled explicitly

### Step 1: Project Factory Revision Into The Platform Contract

Current gap:

- advanced revision behavior exists only through factory-local owners
- no platform projector currently explains pause, refine, and resume support

Files to add or update:

- `src/core/platform/revision/RevisionProjector.ts`
- `src/core/platform/revision/RevisionProjector.test.ts`
- `src/lib/factory/revision-control-service.ts`
- `src/lib/factory/factory-revision-root.ts`
- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`

Required work:

- add projector inputs for factory revision capability and current paused
  frontier state
- preserve current factory refinement modes and frontier planning semantics
  from the existing services
- expose the reference transport surface through the platform contract without
  moving mutation logic into the projector

Must be true before moving on:

- one canonical projector can explain advanced factory revision support
- factory remains the reference implementation for advanced support

### Step 2: Project Retry-Only Jobs Into Reduced Support

Current gap:

- retry-only jobs still expose revision semantics through job-local replay and
  action helpers only
- no reduced-support platform rule currently exists for retry-capable jobs

Files to add or update:

- `src/core/platform/revision/RevisionProjector.ts`
- `src/core/platform/revision/RevisionProjector.test.ts`
- `src/lib/jobs/manual-replay.ts`
- `src/lib/chat/JobActionResolvers.ts`
- `src/app/api/jobs/[jobId]/route.ts`
- `src/app/api/chat/jobs/[jobId]/route.ts`

Required work:

- map retry-only job support into the revision contract as reduced support
- keep retry and cancel eligibility grounded in current job-local owners
- avoid implying pause/refine/resume capability where it does not exist

Must be true before moving on:

- one canonical projector can explain retry-only job revision support honestly
- reduced-support semantics are explicit in code and tests

### Step 3: Introduce One Read Surface For Revision Inspection

Current gap:

- there is still no canonical `RevisionReader`
- factory and job transports still own their own revision capability shaping

Files to add or update:

- `src/core/platform/revision/RevisionReader.ts`
- `src/core/platform/revision/RevisionReader.test.ts`
- `src/core/platform/execution/ExecutionTimelineReader.ts`
- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`
- `src/app/api/jobs/[jobId]/route.ts`
- `src/app/api/chat/jobs/[jobId]/route.ts`

Required work:

- make the reader the canonical read-first owner for advanced and reduced
  revision inspection
- keep current routes as compatibility adapters while moving revision shaping
  into the new reader
- avoid changing authorization or mutation behavior while migrating read paths

Must be true before moving on:

- revision support can be inspected through one canonical reader
- current transports no longer construct their own raw revision capability
  payloads

### Step 4: Add More Uniform Transport Surfaces

Current gap:

- advanced revision actions are only exposed through the admin factory route
- retry-only actions are only exposed through job-local action and route
  semantics

Files to add or update:

- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`
- `src/app/api/jobs/[jobId]/route.ts`
- `src/app/api/chat/jobs/[jobId]/route.ts`
- transport tests for the touched routes

Required work:

- expose the platform revision vocabulary through the existing routes where
  practical
- keep factory mutation ownership in factory services and job retry ownership
  in job replay owners during the first adapter slice

Must be true before moving on:

- revision inspection and action surfaces are materially more uniform
- advanced and reduced-support cases no longer feel like unrelated subsystem
  verbs at the transport boundary

### Step 5: Close Parity And Regression Gates Before Claiming Completion

Current gap:

- no Phase 4 projector tests or reader tests exist yet
- parity between current factory revision and future platform revision owners
  is still unproven

Files to add or update:

- `src/core/platform/revision/RevisionProjector.test.ts`
- `src/core/platform/revision/RevisionReader.test.ts`
- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.test.ts`
- `src/app/api/jobs/[jobId]/route.test.ts`
- `src/app/api/chat/jobs/[jobId]/route.test.ts`
- focused factory revision tests
- focused manual replay tests

Required work:

- add focused tests for advanced factory revision support, reduced-support job
  revision, reader behavior, and transport parity
- keep current route behavior stable while internals become reader-backed

Exit criteria:

- every Phase 4 slice has executable validation
- adapter parity is proven before legacy raw projection logic is deleted
- the codebase, not only the roadmap, satisfies the definition of done below

## Coding Rules For This Phase

1. Do not replace the current factory revision runtime in the first platform
   slice.
2. Do not claim advanced revision support for retry-only jobs.
3. Do not let product routes become canonical revision projectors.
4. Do not invent revision actions for tools or chat turns that do not have a
   real runtime owner.
5. Prefer read-only adapters during migration over transport rewrites.

## Review Checklist

- one canonical revision contract exists in code
- advanced factory revision is projected without changing current factory
  mutation behavior
- retry-only job support is represented honestly as reduced support
- transports use one revision vocabulary where practical
- unsupported revision cases are explicit in code and tests
- migration from factory/job-specific owners is parity-tested before any raw
  ownership is deleted

## Implementation Closeout

Phase 4 is now implemented in code and validated against the grounded scope in
this spec.

Completed outcomes:

- canonical revision contract and support-level types now live in
  `src/core/platform/revision/RevisionContract.ts`
- canonical revision projection now lives in
  `src/core/platform/revision/RevisionProjector.ts`
- canonical read-first revision inspection now lives in
  `src/core/platform/revision/RevisionReader.ts`
- `RepositoryFactory.getRevisionReader()` is now the canonical runtime entry
  point for revision inspection
- factory revision inspection now reads through the canonical reader in
  `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`
- member and chat job inspection routes now expose canonical revision payloads
  through `src/app/api/jobs/[jobId]/route.ts` and
  `src/app/api/chat/jobs/[jobId]/route.ts`
- job retry/cancel action projection now shares one canonical owner through
  `projectJobRevisionActions()` with `JobActionResolvers.ts` acting as a UI
  adapter over that platform projection
- unsupported execution kinds now return explicit unsupported revision
  inspection through the canonical reader rather than remaining implicit in
  docs only

Completed slices:

- Slice 1: canonical revision contract and support-level types added
- Slice 2: advanced factory revision projection implemented over current
  pause/refine/resume runtime owners
- Slice 3: reduced-support job revision projection implemented over current
  retry/cancel job owners
- Slice 4: canonical reader implemented and adopted by the main factory, chat,
  and member inspection routes
- Slice 5: transport inspection surfaces now expose one canonical revision
  payload while preserving current mutation boundaries
- Slice 6: parity and regression coverage added for the projector, reader,
  migrated routes, and shared action projection

Representative validation command:

- `npm run test -- src/core/platform/revision/RevisionProjector.test.ts src/core/platform/revision/RevisionReader.test.ts src/lib/chat/JobActionResolvers.test.ts 'src/app/api/jobs/[jobId]/route.test.ts' 'src/app/api/chat/jobs/[jobId]/route.test.ts' 'src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.test.ts'`

Validation status:

- focused Phase 4 validation passed: 6 files, 22 tests, 22 passed, 0 failed
