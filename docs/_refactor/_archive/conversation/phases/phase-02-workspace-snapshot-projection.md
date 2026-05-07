# Phase 02: Workspace Snapshot Projection

## Objective

Create the first canonical `WorkspaceSnapshot` projection from durable state.

The projection should describe the current customer relationship without using
the transcript as the operational control plane.

## Source Specs

- [../domain-model-spec.md](../domain-model-spec.md)
- [../target-architecture.md](../target-architecture.md)
- [../restore-and-experience-spec.md](../restore-and-experience-spec.md)
- [../business-workflow-context-spec.md](../business-workflow-context-spec.md)
- [phase-01-canonical-domain-contracts.md](phase-01-canonical-domain-contracts.md)
- [phase-02a-business-workflow-context-projection.md](phase-02a-business-workflow-context-projection.md)
- [phase-02b-operator-transition-and-trust-distribution-projection.md](phase-02b-operator-transition-and-trust-distribution-projection.md)

## Phase 01 Handoff

Phase 01 introduced pure contracts and ports only. Phase 02 should build on
those names instead of inventing a new restore shape.

Use these contracts directly:

- `WorkspaceSnapshot`, `WorkspaceJobRef`, `WorkspaceAssetRef`, and helpers from
  `src/core/entities/conversation-workspace.ts`
- shared refs from `src/core/entities/conversation-continuity.ts`
- `BusinessWorkflowContext` refs from
  `src/core/entities/business-workflow-context.ts`
- `RelationshipMemoryRecord` refs from
  `src/core/entities/relationship-memory.ts`
- `PromptBinding` refs from `src/core/entities/prompt-binding.ts`

Use these ports as the first boundary:

- `WorkspaceSnapshotReader`, `WorkspaceSnapshotWriter`, and
  `WorkspaceSnapshotRepository` from
  `src/core/use-cases/WorkspaceSnapshotRepository.ts`
- `BusinessWorkflowContextReader` from
  `src/core/use-cases/BusinessWorkflowContextRepository.ts`
- `RelationshipMemoryReader` from
  `src/core/use-cases/RelationshipMemoryRepository.ts`
- `PromptBindingReader` from `src/core/use-cases/PromptBindingRepository.ts`

Do not add a new workspace table at the start of Phase 02. The first projection
should be rebuildable over existing durable rows unless implementation evidence
proves persistence is necessary.

## Current Implementation Status

The Phase 02 workspace projection is now implemented as a rebuildable read
model.

Grounded facts from the current repo:

- `src/core/entities/conversation-workspace.ts` defines `WorkspaceSnapshot` and
  helpers
- `src/core/use-cases/WorkspaceSnapshotRepository.ts` defines the reader/writer
  ports
- `src/core/platform/conversation-workspace/WorkspaceSnapshotProjector.ts`
  provides the pure projection
- `src/core/platform/conversation-workspace/WorkspaceSnapshotReader.ts`
  provides the repository-backed reader
- `getWorkspaceSnapshotReader()` is now wired in
  `src/adapters/RepositoryFactory.ts`

Phase 02 remains rebuildable and still does not introduce a new workspace table.

## Current Codebase Grounding

Phase 02 should extend the existing read-model/projector architecture, not patch
homepage restore directly.

Current grounded state:

- Phase 02 projector/reader implementation now exists under
  `src/core/platform/conversation-workspace/`
- Phase 02A business workflow reader is implemented and wired in
  `RepositoryFactory`
- Phase 02B trust distribution and operator transition readers are implemented
  and wired in `RepositoryFactory`
- `RelationshipMemoryReader` and `PromptBindingReader` ports exist, but there is
  no concrete platform implementation or factory wiring for them yet

### Durable Sources Available Now

| Source | Current API | Phase 02 use | Boundary |
| --- | --- | --- | --- |
| Active conversation | `ConversationRepository.findActiveByUser(userId)` and `ConversationDataMapper.findActiveByUser` | Owns workspace identity, owner, title, status, routing snapshot, message count, and updated timestamp. | Do not call `ConversationInteractor.getActiveForUser` because it also loads messages. |
| Conversation by id | `ConversationRepository.findById(id)` | Supports `findByConversationId` on `WorkspaceSnapshotReader`. | Must verify user ownership when exposed through user-scoped readers. |
| Active jobs | `JobQueueRepository.listJobsByConversation(conversationId, { statuses: getActiveJobStatuses() })` | Owns `activeJobRefs`; current active statuses are only `queued` and `running`. | Do not include `succeeded`, `failed`, `canceled`, or `dead_letter` in `activeJobRefs`. |
| Job status constants | `getActiveJobStatuses()` in `src/lib/jobs/job-read-model.ts` | Single source for active-work status filtering. | Do not duplicate active-status arrays in projectors or routes. |
| Durable files | `UserFileRepository.listByConversation(conversationId)` | Owns first `importantAssetRefs` candidate source. | Do not scan `MessagePart`, `tool_result`, `job_status`, or imported transcript JSON for assets. |
| Asset projection helpers | `projectUserFileToConversationMediaAssetCandidate` in `src/lib/media/media-asset-projection.ts` | Converts durable `UserFile` rows into compact asset candidates. | Use compact refs only; do not copy full user-file metadata into `WorkspaceSnapshot`. |
| Routing snapshot | `Conversation.routingSnapshot` / `ConversationRoutingSnapshot` | Can provide first `currentObjective` and `recommendedNextStep` fallback from `detectedNeedSummary` and `recommendedNextStep`. | Routing snapshot is supporting context, not a business workflow substitute. |
| Business workflow | `getBusinessWorkflowContextReader()` in `src/adapters/RepositoryFactory.ts` and `BusinessWorkflowContextReader` | Phase 02 can set `workflowContextRef` and `relatedBusinessRefs` when reader data exists. | Do not reimplement Phase 02A rules inside the workspace projector. |
| Operator transition | `getOperatorTransitionReader()` in `src/adapters/RepositoryFactory.ts` and `OperatorTransitionReader` | Phase 02 can set `operatorTransitionRef` when reader data exists. | Do not infer operator state from transcript narration or homepage UI. |
| Trust distribution | `getTrustDistributionReader()` in `src/adapters/RepositoryFactory.ts` and `TrustDistributionReader` | Phase 02 can set `trustDistributionRef` when reader data exists. | Do not reconstruct referral or QR state from tool cards or route output. |
| Relationship memory | `RelationshipMemoryReader` port only | Phase 02 can set `latestMemoryRef` when a concrete reader is later wired; for now this remains null. | Do not build memory extraction in this phase. |
| Prompt binding | `PromptBindingReader` port only | Phase 02 can set `latestPromptBindingRef` when a concrete reader is later wired; for now this remains null. | Do not record new prompt bindings in this phase. |

### Existing Patterns To Copy

- Copy the `ExecutionTimeline` pattern: a stable read contract, pure projector,
  repository-backed reader, and factory function.
- Copy `RepositoryBackedExecutionTimelineReader`: readers may compose ports and
  projectors, but projection functions stay pure.
- Copy `ExecutionTimelineProjector`: projection input should be explicit and
  already loaded; no SQL, no fetch, no route state, no React state.
- Copy the current process-cached reader wiring style in
  `src/adapters/RepositoryFactory.ts`: concrete services and data mappers are
  assembled at the framework boundary, not in the projector or reader contract.
- Copy `conversation-root.ts` only as a composition-root pattern. It may wire a
  concrete reader later, but Phase 02 core/platform code must not call `getDb()`.

### Current Traps To Avoid

- `ConversationInteractor.getActiveForUser` is convenient but transcript-heavy;
  it returns messages and is not the correct source for workspace projection.
- `ConversationInteractor.collectAssetIdsFromParts` exists for import
  compatibility only. It must not become workspace asset discovery.
- `job-read-model.ts` imports `JobStatusMessagePart` because it serves current
  transcript rendering. Phase 02 should use its active status helper, not its
  message-part snapshot shape.
- `chatConversationApi.ts` and `useChatRestore.ts` are current restore clients;
  Phase 02 should not change them. Phase 03 owns restore endpoint/client cutover.
- `task-origin-handoff.ts` contains `conversation-workspace:*` labels, but that
  is not a workspace snapshot implementation. Do not mistake task-origin labels
  for a canonical restore read model.

## Collect

Research existing projection and read-model patterns:

- conversation active lookup
- job read models
- asset projection helpers
- business workflow context helpers
- summary and routing snapshot logic
- platform interaction facade patterns

Likely starting points:

- `src/core/use-cases/ConversationInteractor.ts`
- `src/lib/jobs/job-read-model.ts`
- `src/lib/jobs/job-status-query.ts`
- `src/lib/media/media-asset-projection.ts`
- `src/lib/chat/task-origin-handoff.ts`
- `src/hooks/chat/useCurrentPageMemento.ts`
- `src/core/platform/facade/PlatformInteractionFacade.ts`
- `src/lib/chat/context-window.ts`
- `src/core/entities/conversation-workspace.ts`
- `src/core/use-cases/WorkspaceSnapshotRepository.ts`

## Decide

Decide the first projection source order:

1. active conversation row
2. durable active jobs
3. durable asset refs
4. business workflow context refs
5. existing summaries or routing snapshots
6. recent transcript metadata only as supporting evidence

Decide whether this phase persists snapshots or provides a rebuildable read
model backed by existing tables first.

Default decision after Phase 01: start with a rebuildable read model and a
repository-backed reader. Persist snapshots only if Phase 02 evidence proves
rebuild cost, transactional consistency, or repair requirements need storage.

Default implementation shape:

- `src/core/platform/conversation-workspace/WorkspaceSnapshotProjector.ts`
- `src/core/platform/conversation-workspace/WorkspaceSnapshotReader.ts`
- `src/core/platform/conversation-workspace/WorkspaceSnapshotProjector.test.ts`
- `src/core/platform/conversation-workspace/WorkspaceSnapshotReader.test.ts`
- optional `tests/conversation/phase-02-workspace-snapshot-projection.test.ts`
  for cross-file architecture and evidence canaries

The reader should implement `WorkspaceSnapshotReader` from
`src/core/use-cases/WorkspaceSnapshotRepository.ts`.

The reader should depend on ports, not data mappers:

- `ConversationRepository`
- `JobQueueRepository`
- `UserFileRepository`
- optional `BusinessWorkflowContextReader`
- optional `OperatorTransitionReader`
- optional `TrustDistributionReader`
- optional `RelationshipMemoryReader`
- optional `PromptBindingReader`

The projector should accept an already-loaded input object and return
`WorkspaceSnapshot`. It should not perform repository calls.

Rejected approaches must include:

- scanning old tool calls to infer active work
- treating succeeded jobs as active work
- deriving asset truth from message JSON
- duplicating full lead, deal, referral, lifecycle, or notification payloads in
  the snapshot
- using `ConversationInteractor.getActiveForUser` as the workspace reader
- importing `MessageRepository`, `MessagePart`, `ChatMessage`, hooks, routes, or
  browser runtime modules into workspace projection code
- adding a `WorkspaceSnapshotDataMapper` or new table before rebuildability is
  proven insufficient
- changing `/api/conversations/active`, `chatConversationApi.ts`, or
  `useChatRestore.ts` in Phase 02

## Clean Architecture, SOLID, And GoF Rules

Phase 02 is the first projection phase. It must prove that canonical state can
be assembled without smuggling operational authority through transcript history.

### Clean Architecture Rules

- `WorkspaceSnapshotProjector` belongs in `src/core/platform`, imports only
  domain entities and pure helpers, and contains no repository, SQL, fetch,
  React, Next.js, browser, or filesystem dependencies.
- `WorkspaceSnapshotReader` belongs in `src/core/platform`, depends on ports,
  and implements the `WorkspaceSnapshotReader` interface from Phase 01.
- Any concrete DB wiring belongs in a composition root such as
  `conversation-root.ts` or `RepositoryFactory`, not in the projector or reader
  contract.
- The workspace reader may consume Phase 02A and Phase 02B readers through their
  ports, but it must not import profile services, referral analytics services,
  route handlers, or transcript restore clients directly.
- The read model may use `src/lib/media/media-asset-projection.ts` and
  `src/lib/jobs/job-read-model.ts` only as existing pure/helper surfaces; it may
  not import transcript renderer helpers.
- Routes and hooks remain consumers in later phases, not projection owners.

### SOLID Rules

- Single Responsibility: the projector maps loaded durable state to
  `WorkspaceSnapshot`; it does not query databases, mutate records, or decide
  restore UI behavior.
- Open/Closed: later phases can add workflow, memory, prompt, operator, and
  trust refs by extending projection input, not by rewriting job/asset logic.
- Liskov Substitution: `WorkspaceSnapshotReader` must be testable with fake
  repositories and replaceable later by a persisted adapter without changing
  callers.
- Interface Segregation: Phase 02 should consume only reader/query methods it
  needs. Do not pass a broad interactor when narrow repository ports exist.
- Dependency Inversion: platform projection code depends on ports and entities;
  concrete `DataMapper` classes stay behind composition roots.

### GoF Patterns To Use Deliberately

- Repository: `ConversationRepository`, `JobQueueRepository`, and
  `UserFileRepository` provide durable state boundaries.
- Data Mapper: existing mappers adapt SQLite to repository ports; no new mapper
  unless persistence is proven necessary.
- Projector: pure `WorkspaceSnapshotProjector` maps durable records into a read
  model.
- Factory / Composition Root: expose a small `createWorkspaceSnapshotReader(...)`
  factory, mirroring `createExecutionTimelineReader(...)`.
- Abstract Factory / Composition Root: add `getWorkspaceSnapshotReader()` only
  after the projection-backed reader exists, and have it compose conversation,
  jobs, files, workflow, operator, trust, and optional memory/prompt readers at
  the boundary.
- Strategy: keep status mapping and asset candidate selection as small pure
  functions so Phase 05 can replace asset ranking without route churn.
- Null Object / Empty Projection: missing optional Phase 02A/06/08 data should
  become null refs or empty arrays, not partial fake objects.
- Facade: do not introduce a full restore facade in Phase 02. Phase 03 owns the
  restore read model/facade that composes workspace plus transcript slice.

## Spec QA

The snapshot contract must answer:

- current objective, if known
- recommended next step, if known
- open loops, if known
- active job refs
- important asset refs
- workflow context ref and compact related business refs
- latest memory or summary ref, if available

It is acceptable for some fields to be null in the first projection, but the
ownership boundary must be correct.

## Ground

Before coding, identify exact current sources for:

- active conversation ownership
- active job filtering
- recent durable assets
- workflow context ownership and related business refs
- current summary/routing data
- timestamp and status update rules

Update this file if the codebase now has newer platform projection helpers.

Concrete grounding map:

| Projection field | Current source | First rule |
| --- | --- | --- |
| `id` | deterministic projection id such as `workspace:${conversation.id}` | Stable across rebuilds. |
| `userId` | `Conversation.userId` | Reject mismatched ownership in user-scoped reads. |
| `conversationId` | `Conversation.id` | Never join only by conversation id in route-facing code without user ownership. |
| `status` | `Conversation.status` plus `deletedAt` | Deleted conversation maps to `deleted`; active/archived otherwise. |
| `title` | `Conversation.title` | Empty title may remain empty; title generation is not Phase 02. |
| `currentObjective` | `Conversation.routingSnapshot.detectedNeedSummary` | Null when unknown; do not summarize transcript. |
| `recommendedNextStep` | `Conversation.routingSnapshot.recommendedNextStep` | Null when unknown; Phase 02A can override later. |
| `openLoops` | none yet | Empty array until workflow/memory phases supply durable refs. |
| `activeJobRefs` | `JobQueueRepository.listJobsByConversation(..., { statuses: getActiveJobStatuses() })` | Include only queued/running jobs. |
| `importantAssetRefs` | `UserFileRepository.listByConversation` plus media asset projection helper | Include compact file refs; no message scan. |
| `workflowContextRef` | optional `BusinessWorkflowContextReader.findByConversationId` | Null until Phase 02A data exists. |
| `operatorTransitionRef` | optional `OperatorTransitionReader.findByConversationId` | Null when no Phase 02B projection exists for the conversation. |
| `trustDistributionRef` | optional `TrustDistributionReader.findByConversationId` | Null when no Phase 02B projection exists for the conversation. |
| `relatedBusinessRefs` | optional `BusinessWorkflowContext.relatedRefs` | Empty array in first Phase 02 projection unless workflow reader supplies compact refs. |
| `latestMemoryRef` | optional `RelationshipMemoryReader.listActiveByConversation` | Use latest active memory id if available; do not extract memory. |
| `latestPromptBindingRef` | optional `PromptBindingReader.listByConversation` | Use latest binding id if available; do not record new binding. |
| `updatedAt` | max of conversation, active jobs, and important assets | Deterministic max timestamp helper, not `new Date()` in projector. |

Suggested projection input:

```typescript
export interface WorkspaceSnapshotProjectionInput {
  conversation: Conversation;
  activeJobs: readonly JobRequest[];
  assetCandidates: readonly ConversationMediaAssetCandidate[];
  workflowContext?: BusinessWorkflowContext | null;
  operatorTransitionId?: string | null;
  trustDistributionId?: string | null;
  activeMemory?: readonly RelationshipMemoryRecord[];
  promptBindings?: readonly PromptBinding[];
}
```

The input may evolve, but it must stay explicit and loaded by the reader before
projection.

## Build

Build a workspace projection service and tests.

Expected deliverables:

- workspace projection service
- `WorkspaceSnapshotReader` implementation or projection-backed adapter as
  needed
- `getWorkspaceSnapshotReader()` factory wiring once the reader exists
- active job refs from durable job state
- important asset refs from durable asset state or first asset projection
- workflow context ref from Phase 02A or a documented placeholder until that
  phase lands
- operator transition and trust distribution refs from Phase 02B readers when
  available, otherwise explicit nulls
- projection tests for empty, active, archived, and deleted states
- architecture-boundary tests that prove projection code does not scan
  `MessagePart`, `tool_result`, or historical transcript JSON for active work

Minimum test cases:

- no active conversation returns `null`
- active conversation with no jobs/assets returns an empty, restorable snapshot
- archived conversation can be projected by id but not returned as active
- deleted conversation projects `status: "deleted"` only through explicit by-id
  reads, never active user reads
- queued/running jobs appear in `activeJobRefs`
- succeeded/failed/canceled/dead-letter jobs do not appear in `activeJobRefs`
- durable `user_files` rows become compact `importantAssetRefs`
- `messages`, `MessagePart`, `tool_result`, and `job_status` do not appear in
  projector or reader source
- optional workflow, memory, and prompt readers can be absent without creating
  fake refs
- `updatedAt` is deterministic from loaded source timestamps

## Remove Before Phase 02 Is Complete

Phase 02 is complete only when the workspace projection is canonical and the
old transcript-derived assumptions have been removed from this projection layer.

Remove or reject all of the following before closing Phase 02:

- any use of `ConversationInteractor.getActiveForUser` inside workspace
  snapshot reader code
- any claim that Phase 02 is complete while `WorkspaceSnapshotReader` still
  exists only as a port with no concrete platform implementation
- any `getWorkspaceSnapshotReader()` factory wiring before the underlying reader
  exists and is covered by focused tests
- any import of `MessageRepository`, `MessagePart`, `ChatMessage`,
  `chatConversationApi`, `useChatRestore`, browser runtime modules, or renderer
  components in `src/core/platform/conversation-workspace/*`
- any active-job projection that includes `succeeded`, `failed`, `canceled`, or
  `dead_letter` in `activeJobRefs`
- any asset projection that discovers assets by scanning message JSON,
  `tool_result`, `job_status`, imported transcript payloads, or browser session
  storage
- any copy of full job request payloads, job result payloads, user-file metadata,
  lead/deal/referral payloads, or prompt text into `WorkspaceSnapshot`
- any new workspace table, migration, or `WorkspaceSnapshotDataMapper` unless
  Phase 02 evidence explicitly proves rebuildable projection is insufficient
- any route/hook/client restore cutover. Phase 03 owns that work
- any use of `new Date()` inside pure projection to decide `updatedAt`
- any projection test that relies on historical transcript parts to pass
- any broad `ConversationWorkspaceInteractor` that owns jobs, files, workflow,
  memory, prompt, and restore mutation together
- any attempt to backfill missing memory or prompt refs from transcript content,
  summaries, or homepage cache while their readers remain contracts only

## Phase QA

Before implementation, verify the phase does not attempt full restore cutover.
This phase produces the snapshot. Phase 02A enriches the business workflow
context. Phase 03 uses both for restore.

Also verify before implementation:

- Phase 02 starts from a rebuildable reader, not persistence
- all source reads are available through existing ports
- fake repositories can cover the first implementation without SQLite
- no product UI behavior needs to change for the phase to close

## Implementation QA

Required validation:

- unit tests for projection filtering
- integration test with real database rows if persistence is involved
- proof that succeeded jobs do not appear in `activeJobRefs`
- proof that old tool parts are not read to produce active work
- proof that related business refs stay compact and do not duplicate source
  domain payloads
- focused architecture-boundary test for `src/core/platform/conversation-workspace`
- `npm run qa:conversation-refactor` includes the new Phase 02 suite and remains
  green
- release evidence records Phase 02 as contract/projection proof, not restore
  cutover proof

## Implementation Notes

The current implementation uses:

- `WorkspaceSnapshotProjector` as the pure projection boundary
- `RepositoryBackedWorkspaceSnapshotReader` as the read-model adapter over
  `ConversationRepository`, `JobQueueRepository`, `UserFileRepository`, and the
  Phase 02A/02B readers
- `getWorkspaceSnapshotReader()` in `RepositoryFactory` as the only concrete
  assembly point

Current implemented source behavior:

- `currentObjective` and `recommendedNextStep` come from the conversation
  routing snapshot only
- `activeJobRefs` come only from queued/running durable jobs
- `importantAssetRefs` come from durable `user_files`, using the media asset
  projection helper for media and a compact direct mapping for documents
- `workflowContextRef`, `operatorTransitionRef`, and `trustDistributionRef`
  come from the Phase 02A/02B readers when present
- `relatedBusinessRefs` comes only from `BusinessWorkflowContext.relatedRefs`
- `latestMemoryRef` and `latestPromptBindingRef` remain null until real readers
  are wired
- `updatedAt` is deterministic across the loaded durable timestamps and does not
  use `new Date()` inside the projector

Current explicit limitations:

- no relationship-memory reader is wired yet
- no prompt-binding reader is wired yet
- no open-loop extraction exists yet, so `openLoops` remains empty
- no restore endpoint or homepage cutover exists yet; Phase 03 still owns that

## Update

After completion, update Phase 02A and Phase 03 with the exact workspace
projection API and any fields that remain temporarily null.

Also update:

- `src/lib/evals/conversation-refactor-evidence.ts` with the Phase 02 focused
  suite
- `release/conversation-refactor-evidence.json` after rerunning the QA bundle
- [../test-infrastructure-and-evidence.md](../test-infrastructure-and-evidence.md)
  if the test matrix or runner shape changes
