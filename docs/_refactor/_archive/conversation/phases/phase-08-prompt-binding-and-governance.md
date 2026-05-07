# Phase 08: Prompt Binding And Governance

Status: complete.

## Objective

Finish the durable prompt-governance slice on top of the prompt runtime we
already have so prompt-controlled decisions remain explainable after slot
changes, config edits, and replay.

The repo is no longer at zero for this phase.

It already has:

- a governed prompt runtime that builds effective prompt text, hash, slot refs,
  sections, and warnings
- a prompt control plane for governed mutable slots
- turn-level prompt provenance recording and replay for chat turns
- a `PromptBinding` domain entity and repository contract for durable binding
  ownership
- workspace snapshot support for `latestPromptBindingRef`

Phase 08 now has a clean binding model from prompt runtime results to durable
decisions such as memory projection, governed media planning, materialization
reuse, job execution, and later repair or migration work, backed by a concrete
adapter and recording flow.

Phase 08 was therefore not "invent prompt provenance." It was "promote prompt
runtime metadata from chat-turn audit data into durable decision bindings so
memory, jobs, and governed assets stop carrying untraceable prompt influence."

## Source Specs

- [../governance-identity-and-migration-spec.md](../governance-identity-and-migration-spec.md)
- [../domain-model-spec.md](../domain-model-spec.md)
- [../relationship-memory-and-search-spec.md](../relationship-memory-and-search-spec.md)
- [../jobs-assets-materialization-spec.md](../jobs-assets-materialization-spec.md)
- [phase-06-relationship-memory-projection.md](phase-06-relationship-memory-projection.md)
- [phase-05-asset-catalog-and-reusable-outputs.md](phase-05-asset-catalog-and-reusable-outputs.md)

## Collect

This was the implementation research checklist. Keep it as the maintenance map
for future prompt-binding changes.

Current grounded starting points:

- `src/lib/chat/prompt-runtime.ts`
- `src/lib/chat/policy.ts`
- `src/lib/chat/stream-route-handler.ts`
- `src/lib/prompts/prompt-control-plane-service.ts`
- `src/lib/prompts/prompt-provenance-service.ts`
- `src/lib/prompts/prompt-provenance-store.ts`
- `src/adapters/PromptProvenanceDataMapper.ts`
- `src/core/use-cases/PromptControlPlaneService.ts`
- `src/core/use-cases/SystemPromptBuilder.ts`
- `src/lib/media/server/compose-media-plan-materialization.ts`
- `src/core/use-cases/ConversationInteractor.ts`
- `src/lib/chat/stream-preparation.ts`

Collect and classify each surface as one of:

- prompt runtime source of truth
- control-plane governance surface
- turn-level provenance or replay surface
- durable decision point that should carry prompt binding
- compatibility wrapper or prompt-era drift

## Ground

Preserve the current codebase truths this phase built on.

### Prompt Runtime Already Exists As The Effective Prompt Seam

- `src/lib/chat/prompt-runtime.ts` already owns final prompt assembly for
  governed surfaces and returns `text`, `effectiveHash`, `slotRefs`,
  `sections`, and `warnings`.
- `createSystemPromptBuilder(...)` is now a compatibility builder over this
  runtime rather than a separate truth source.
- `stream-route-handler.ts` finalizes the prompt only after request-scoped tool
  selection so the tool manifest is part of the effective runtime result.

This means Phase 08 must not reintroduce prompt assembly logic inside routes,
materializers, or UI diagnostics.

### The Prompt Control Plane Already Governs Mutable Slots

- `src/lib/prompts/prompt-control-plane-service.ts` already enforces the slot
  model for `ALL/base` and per-runtime-role `role_directive` slots.
- Unsupported slots are intentionally rejected rather than silently accepted.
- Fallback-backed runtime slots and governed mutable slots are already separate
  concepts in the current service.

This means Phase 08 should extend binding and traceability on top of the
current slot inventory, not widen the mutable slot surface casually.

### Prompt Provenance Already Exists, But Only At Turn Scope

- `src/lib/prompts/prompt-provenance-service.ts` records compact prompt runtime
  metadata for chat turns.
- `src/adapters/PromptProvenanceDataMapper.ts` persists prompt provenance by
  conversation, user message, assistant message, hash, slot refs, sections,
  warnings, and replay context.
- `src/lib/prompts/prompt-provenance-store.ts` supports replay and drift
  diagnostics for prompt runtime reconstruction.

This is necessary but insufficient. A turn-level provenance row does not by
itself tell us which durable memory record, asset derivative, or governed job
decision it influenced.

### Prompt Binding Domain Groundwork Already Exists

- `src/core/entities/prompt-binding.ts` already defines the durable
  `PromptBinding` shape, including surfaces such as `memory_projection`,
  `materialization_decision`, and `workspace_projection`.
- `src/core/use-cases/PromptBindingRepository.ts` already defines a durable
  reader/writer contract for prompt bindings.
- `src/core/platform/conversation-workspace/WorkspaceSnapshotReader.ts` and
  `WorkspaceSnapshotProjector.ts` already accept prompt bindings and project
  `latestPromptBindingRef` into the workspace snapshot.

This means Phase 08 did not start from a blank prompt-binding model. The
completed slice backs the contract with a concrete adapter and records bindings
at the durable decision points it was designed for.

### Durable Decision Points Already Exist Outside The Prompt Layer

- Phase 06 gives us canonical relationship-memory projection and supersession
  seams through repository/projector/service layers.
- `src/lib/media/server/compose-media-plan-materialization.ts` makes governed
  asset rehydration and derivative creation decisions for server composition.
- `src/lib/chat/stream-preparation.ts` and `stream-route-handler.ts` already
  assemble request-time context that can influence later durable actions.
- Media continuity handoff, governed asset discovery, and composition recovery
  now carry real reusable asset identity across turns.

These are the current owning abstractions where prompt binding needs to land.
Recording prompt metadata later in the UI or only on the original user turn is
not enough.

### Prompt Binding Now Owns Durable Decision Traceability

- The repo has a concrete `PromptBindingDataMapper` implementing
  `PromptBindingRepository`.
- Workspace snapshots carry `latestPromptBindingRef` from production
  prompt-binding reads.
- Prompt provenance remains keyed to chat turns, while prompt bindings attach
  compact prompt influence to durable memory, materialization, and job targets.
- Drift diagnostics can enumerate durable targets derived from a prompt binding.

These are the compatibility seams Phase 08 closed.

## Decide

These were the first durable binding targets selected before widening prompt
governance.

### 1. Relationship Memory Projection Binding

Purpose:

- explain which effective prompt runtime influenced a canonical memory record
  or supersession decision
- support replay and repair when prompt behavior changes
- keep memory records auditable without storing full prompt text by default

Primary owners:

- `RelationshipMemoryProjectionService`
- `RelationshipMemoryProjector`
- `RelationshipMemoryRepository`

### 2. Governed Media Planning And Materialization Binding

Purpose:

- explain which prompt runtime influenced governed compose decisions,
  derivative selection, and reuse versus regeneration outcomes
- preserve traceability for assets that survive beyond the originating turn
- support failure analysis for source rehydration and composition preflight

Primary owners:

- request-scoped stream execution path
- compose-media planning/materialization services
- governed asset and job persistence surfaces

### 3. Durable Job Planning Binding

Purpose:

- record which prompt runtime planned or authorized an asset-producing or other
  durable deferred job request
- keep queued execution explainable when slots change after enqueue time

Primary owners:

- stream route planning path
- deferred job persistence and execution metadata

Rejected approaches must include:

- storing full prompt text for every durable event by default
- recording only slot version strings without effective hash or section shape
- treating turn-level provenance rows as sufficient durable decision binding
- binding prompt metadata in the UI after records are already persisted
- letting durable decision records depend directly on prompt-control-plane
  internals rather than a compact binding contract

## Spec QA

Prompt binding must capture, for each bound durable decision:

- surface
- effective hash
- slot refs
- section refs or overlay/request refs that materially affected the decision
- recorded timestamp
- conversation and user ownership
- durable target type and durable target id
- replay or repair compatibility metadata when later rebuilds are required

Spec QA answers:

- section payloads are not retained in durable prompt bindings by default;
  mutable slot influence is represented by slot refs and the top-level
  effective hash, overlay/request influence is represented by compact refs and
  content hashes, and full prompt text remains turn-level audit data
- bindings attach through the `prompt_bindings` sidecar table; durable targets
  carry or receive compact binding refs rather than embedding prompt-runtime
  implementation details
- drift diagnostics escalate from prompt change to affected durable records by
  traversing root bindings and `source_prompt_binding_id` lineage to memory,
  job, and materialization targets
- Phase 09 treats prompt bindings, prompt provenance, and
  `source_prompt_binding_id` lineage as explicit migration, archive, privacy,
  and repair surfaces

## Build

Delivered:

- a durable prompt-binding contract separate from turn-only provenance
- a recorder API for binding prompt runtime metadata to durable outcomes
- a concrete repository adapter implementing the existing prompt-binding
  contract
- integration with relationship memory projection
- integration with governed media planning and materialization decisions
- integration with durable job execution binding
- diagnostics that report prompt drift against bound durable records
- tests for prompt-binding refs on memory and asset-producing flows

### Target Architecture

The clean shape for Phase 08 should separate prompt runtime truth from durable
binding and from operator diagnostics.

- `PromptRuntime` remains the sole source of effective prompt assembly truth
- control-plane services remain responsible only for governed slot mutation,
  activation, fallback awareness, and admin read/write surfaces
- turn provenance remains a chat audit surface
- durable prompt binding is a separate application service that consumes a
  `PromptRuntimeResult` plus a durable decision target descriptor
- durable domains such as relationship memory projection and governed media
  materialization receive compact binding refs, not raw prompt text
- drift and replay diagnostics compare current runtime reconstruction against
  stored compact bindings and identify affected durable targets

### Retrieval Surface Refs

Phase 07 split retrieval into relationship memory, transcript recall, corpus
grounding, and product discovery. Phase 08 records those influences through
`decisionSourceRefs` and `evidenceRefs` rather than by storing retrieved payload
text in prompt bindings.

- relationship continuity uses `relationship_memory` source refs
- transcript recall uses `message`, `conversation`, or `embedding_source`
  source refs, depending on the retrieved transcript artifact
- corpus grounding uses the corpus-backed evidence/source ref emitted by the
  grounding service when available
- product discovery uses route/admin/corpus discovery refs only as discovery
  evidence, not as grounded knowledge or continuity memory
- prompt bindings keep the product surface explicit enough for diagnostics
  without collapsing retrieval products back into one generic search contract

Completed components:

- durable adapter implementing `PromptBindingRepository`
- prompt-binding application service
- domain-specific integration adapters for relationship memory and governed
  media flows
- prompt-binding drift diagnostics that can enumerate affected durable targets

### Specific Architectural Patterns Required

This phase should explicitly use these patterns.

#### Application Service Pattern

Prompt binding is recorded through one application service that accepts
prompt runtime results and durable decision descriptors. Routes, projectors,
and materializers should not all invent their own recording flow.

#### Sidecar / Association Pattern

Prompt binding metadata lives in a dedicated sidecar or association model
instead of bloating memory rows, asset rows, or job rows with prompt-runtime
implementation detail.

#### Repository Pattern

Durable prompt bindings persist through a dedicated repository contract,
not via ad hoc SQL in each decision point.

#### Strategy Pattern

Durable targets use compact retention rules at the recorder boundary:

- slot sections are represented by slot id, version, and compact content hash
- overlay sections are represented by overlay id, label, and compact content
  hash
- request and override sections are represented by request id, source kind, and
  compact content hash
- durable targets provide domain evidence refs; prompt bindings do not retain
  full section payload text by default

#### Anti-Corruption Layer Pattern

Durable domains depend on a compact prompt-binding DTO, not on raw
`PromptRuntimeResult`, control-plane services, or admin slot models.

## What Phase 08 Removed

This phase removed or stopped extending these prompt-era seams:

- the assumption that turn-level prompt provenance is enough to explain durable
  outcomes
- the mismatch where workspace/read-model contracts expose prompt binding refs
  but no production recorder populates them
- any new durable decision that relies only on free-form logs or prompt hash
  strings without a binding target contract
- any drift diagnostic that can report prompt mismatches but cannot identify
  the affected memory, asset, or job records
- any domain code that reads prompt-control-plane slot state directly when a
  compact prompt-binding ref should be passed in
- any pressure to store full prompt text in durable business records by default

## Implementation Sequence

1. Defined the compact durable prompt-binding contract and repository.
2. Attached the first binding slice to relationship memory projection.
3. Attached the second binding slice to governed media planning and
   materialization.
4. Added durable job execution binding.
5. Added drift diagnostics that enumerate affected durable targets instead of
   only reporting runtime mismatch.
6. Updated Phase 09 ownership, migration, and deletion rules to include prompt
   bindings explicitly.

## Phase QA

The privacy and retention rule for each stored binding field is locked:

- full prompt text remains audit-only and opt-in through turn provenance
- durable prompt bindings store compact slot, overlay, request, decision source,
  evidence, target, and lineage refs
- request and overlay refs retain hashes, not raw content

## Implementation QA

Required validation, now covered by the focused Phase 08 regression slice:

- unit tests for the binding recorder and repository
- integration tests for memory binding and governed media binding
- drift diagnostic tests against rebuilt runtime results
- privacy/retention review for stored section payloads
- no silent regression in existing prompt runtime, control-plane, or prompt
  provenance tests

## Update

After completion, update Phase 09 so identity migration, archive, deletion,
and repair flows explicitly preserve or remove prompt-binding ownership data
alongside conversations, assets, jobs, and memory records.

## Implementation Notes

Phase 08 implementation is complete.

Delivered components:

- `src/adapters/PromptBindingDataMapper.ts` now implements the existing
  `PromptBindingRepository` contract with durable target lookup,
  conversation-scoped reads, and source-binding lineage reads.
- `src/adapters/RepositoryFactory.ts` now exposes
  `getPromptBindingRepository()` as the runtime composition seam.
- `src/lib/prompts/prompt-binding-service.ts` now acts as the Phase 08
  application service for compact durable binding recording and
  source-derived child bindings. Bindings are historical rows; target lookups
  return the latest binding for a durable target without overwriting older
  prompt-influence records.
- `src/lib/chat/stream-route-handler.ts` now records the root `chat_stream`
  binding against the persisted user message and passes `promptBindingId`
  forward into downstream durable execution.
- `src/core/platform/relationship-memory/RelationshipMemoryProjectionService.ts`
  now records `memory_projection` bindings for projected relationship-memory
  records when a source prompt binding is present.
- `src/lib/jobs/enqueue-deferred-tool-job.ts` now records `job_execution`
  bindings for fresh deferred jobs.
- `src/lib/jobs/compose-media-deferred-job.ts`,
  `src/lib/jobs/materialization-registration.ts`, and
  `src/app/api/chat/jobs/route.ts` now record `materialization_decision`
  bindings for exact reuse and durable materialization registration.
- `src/lib/prompts/prompt-provenance-service.ts` and
  `src/app/admin/conversations/[id]/page.tsx` now enumerate affected durable
  targets so prompt drift diagnostics can point to concrete memory, job, and
  materialization records.
- `src/core/platform/conversation-workspace/WorkspaceSnapshotProjector.ts` and
  `src/core/platform/conversation-workspace/WorkspaceSnapshotReader.ts` now
  receive real production prompt-binding refs instead of an unpopulated
  placeholder contract.

Privacy and retention boundary now locked by implementation:

- durable prompt bindings store compact ownership, target, effective hash,
  slot refs, compact overlay refs, compact request refs, decision source refs,
  and evidence refs
- turn-level prompt provenance remains the chat-turn audit surface
- full prompt text is not stored on durable memory, job, or asset records by
  default

Validated closeout:

- focused Phase 08 regression slice passes: 15 files, 64 tests
- validated bundle:
  - `src/adapters/PromptBindingDataMapper.test.ts`
  - `src/lib/prompts/prompt-binding-service.test.ts`
  - `src/lib/prompts/prompt-provenance-service.test.ts`
  - `src/lib/prompts/prompt-provenance.test.ts`
  - `tests/prompt-control-plane.service.test.ts`
  - `tests/prompt-control-plane-equivalence.test.ts`
  - `src/core/use-cases/ConversationInteractor.relationship-memory.test.ts`
  - `src/lib/jobs/enqueue-deferred-tool-job.test.ts`
  - `src/lib/jobs/compose-media-deferred-job.test.ts`
  - `src/lib/jobs/materialization-registration.test.ts`
  - `src/app/api/chat/jobs/route.test.ts`
  - `src/app/api/chat/stream/route.test.ts`
  - `tests/chat/chat-stream-route.prompt-runtime-seam.test.ts`
  - `src/core/platform/conversation-workspace/WorkspaceSnapshotReader.test.ts`
  - `tests/conversation/phase-01-canonical-domain-contracts.test.ts`

Removal status:

- the repo no longer relies on turn-level provenance alone to explain durable
  memory, job, or materialization outcomes
- the workspace prompt-binding ref seam is now populated by real recording
  flows
- drift diagnostics can now enumerate affected durable targets instead of only
  reporting prompt-runtime mismatch
- Phase 09 has already been updated to treat prompt bindings and prompt
  provenance as explicit migration, privacy, and repair surfaces
