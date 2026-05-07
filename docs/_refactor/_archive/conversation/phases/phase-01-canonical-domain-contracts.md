# Phase 01: Canonical Domain Contracts

## Objective

Introduce the canonical contracts for the greenfield conversation architecture
without cutting over runtime behavior yet.

This phase gives later phases stable names, boundaries, ports, and testable
contracts.

## Phase 00 Baseline Input

Phase 00 recorded the current evidence baseline in
[../phase-00-baseline-evidence.md](../phase-00-baseline-evidence.md).

Existing durable surfaces to adapt before adding new persistence:

- `conversations` and `messages` for active transcript and conversation state
- `job_requests` and `job_events` for deferred work status and event history
- `user_files` for generated and uploaded asset backing
- `embeddings` for transcript recall only
- `prompt_provenance_records` for chat-turn prompt provenance
- `referrals` and `referral_events` for trust-distribution milestones

Known contract gaps to introduce without runtime cutover:

- `WorkspaceSnapshot`
- `BusinessWorkflowContext`
- `OperatorTransitionProfile`
- `TrustDistributionContext`
- `MaterializationRecord`
- `RelationshipMemoryRecord`
- `PromptBinding`
- `IdentityMigrationEvent` and migration status projection

Phase 01 must not solve restore yet. It should give the later phases clean
names, clean ownership, and clean seams so restore can be rebuilt without
threading more behavior through transcript parts.

## Current Codebase Grounding

The repo already has a mostly Clean Architecture shape. Phase 01 should extend
that shape instead of creating a separate architecture.

### Existing Layers To Preserve

| Layer | Current pattern | Phase 01 implication |
| --- | --- | --- |
| Domain entities | `src/core/entities/*.ts` contains plain TypeScript contracts such as `conversation.ts`, `job.ts`, `user-file.ts`, and `media-composition.ts`. | New canonical contracts belong here as plain data models and small pure helpers only. |
| Ports / use-case boundaries | `src/core/use-cases/*Repository.ts` defines repository ports such as `ConversationRepository`, `JobQueueRepository`, and `UserFileRepository`. | New persistence-facing contracts need ports here before adapters or SQL. |
| Adapters | `src/adapters/*DataMapper.ts` implements ports against `better-sqlite3`. | New persistence, if required, should be implemented as `*DataMapper` adapters, not imported by core code directly. |
| Composition roots | `src/adapters/RepositoryFactory.ts`, `src/lib/chat/conversation-root.ts`, and `src/lib/platform/agent-platform-facade-root.ts` assemble concrete dependencies. | New concrete adapters are wired here only after ports exist. |
| Read models / projectors | `src/core/platform/execution/*`, `src/core/platform/revision/*`, and `src/core/platform/facade/*` define read contracts, pure projectors, repository-backed readers, and facades. | Conversation restore contracts should copy this reader/projector/facade style. |
| Schema migration | `src/lib/db/tables.ts`, `src/lib/db/migrations.ts`, and `src/lib/db/schema.ts` create and migrate SQLite tables. | Any schema added in Phase 01 must be additive, idempotent, and covered by mapper or migration tests. |

### Existing Patterns Worth Reusing

- `ExecutionTimeline` separates a stable read contract from its durable sources.
- `ExecutionTimelineProjector` keeps projection logic pure and testable.
- `RepositoryBackedExecutionTimelineReader` composes repositories and projectors
  without leaking SQL into projection code.
- `PlatformInteractionFacade` composes multiple read models into a product-level
  interaction surface.
- `ConversationInteractor` depends on repository ports, not concrete mappers.
- `RepositoryFactory` documents the service-locator exception for Next.js server
  component boundaries and uses process-cached singleton lifetimes.
- `conversation-root.ts` is the accepted request-scoped composition root when
  related repositories need one DB handle.

### Boundary Exceptions To Shrink, Not Copy

Phase 01 should not normalize existing boundary exceptions into the new design.

Current exceptions found during grounding:

- `src/core/capability-catalog/runtime-tool-binding.ts` imports adapter-layer
  dependencies directly.
- `src/core/use-cases/UserAdminInteractor.ts` references `UserDataMapper` as a
  type instead of a narrow port.
- `ConversationInteractor` still has transcript-part asset collection helpers,
  which are compatibility behavior, not a pattern for new canonical contracts.
- Browser runtime recovery still derives candidates from message parts in
  `src/lib/media/browser-runtime/job-snapshots.ts`.

These exceptions may stay until their owning phases replace them, but Phase 01
must not create new exceptions of the same kind.

## Source Specs

- [../domain-model-spec.md](../domain-model-spec.md)
- [../target-architecture.md](../target-architecture.md)
- [../operator-transition-and-trust-distribution-spec.md](../operator-transition-and-trust-distribution-spec.md)
- [../governance-identity-and-migration-spec.md](../governance-identity-and-migration-spec.md)

## Collect

Research existing entity, repository, and projection patterns:

- `src/core/entities/`
- `src/core/use-cases/`
- `src/adapters/RepositoryFactory.ts`
- `src/adapters/*DataMapper.ts`
- `src/lib/db/migrations.ts`
- `src/lib/db/tables.ts`
- `src/core/platform/`

Look for current naming and persistence patterns for jobs, user files,
conversation events, prompt provenance, and platform read models.

## Decide

Decide where each canonical model belongs:

- `WorkspaceSnapshot`
- `RelationshipMemoryRecord`
- `WorkspaceJobRef` with job-ledger projection deferred to later phases
- `WorkspaceAssetRef` with asset-catalog enrichment deferred to later phases
- `MaterializationRecord`
- `PromptBinding`
- `OperatorTransitionProfile`
- `TrustDistributionContext`
- `IdentityMigrationEvent`

Also decide what remains an adapter around existing tables versus what requires
new persistence.

Prefer this placement unless implementation research proves a better local fit:

| Contract | Phase 01 file target | First implementation posture |
| --- | --- | --- |
| `WorkspaceSnapshot` | `src/core/entities/conversation-workspace.ts` | Contract plus rebuildable projection shape over `conversations`, job refs, asset refs, and optional context refs. |
| `WorkspaceSnapshotReader` / repository port | `src/core/use-cases/WorkspaceSnapshotRepository.ts` or `WorkspaceSnapshotReader.ts` | Port only, with null/empty support for missing later surfaces. |
| `BusinessWorkflowContext` | `src/core/entities/business-workflow-context.ts` | Contract and compact refs only; no CRM payload duplication. |
| `OperatorTransitionProfile` | `src/core/entities/operator-transition.ts` | Contract and status/mode enums only; no personality/profile duplication. |
| `TrustDistributionContext` | `src/core/entities/trust-distribution.ts` | Contract over existing referral/profile/ledger state; do not rebuild affiliate system. |
| `MaterializationRecord` | `src/core/entities/materialization.ts` | Contract and key policy only; persistence can wait until Phase 04 unless tests require a no-op port. |
| `RelationshipMemoryRecord` | `src/core/entities/relationship-memory.ts` | Contract, evidence refs, status, confidence, and non-goals only; no extraction pipeline. |
| `PromptBinding` | `src/core/entities/prompt-binding.ts` | Contract that can adapt current prompt provenance, not replacement storage yet. |
| `IdentityMigrationEvent` | `src/core/entities/identity-migration.ts` | Contract and status projection shape; persistence can wait until Phase 09 unless Phase 01 adds an event port. |

If persistence is introduced in Phase 01, use repository ports first and concrete
`*DataMapper` adapters second. Do not add a table simply because a contract
exists. A contract may be projection-backed, no-op, or in-memory until its owning
phase needs durable writes.

Rejected approaches must include:

- making message parts the canonical contract
- treating embeddings as relationship memory
- storing durable continuity only in browser storage
- duplicating full job or asset payloads in workspace snapshots
- turning referral QR/link or affiliate analytics into transcript-derived state
- importing adapters or `getDb()` from new core/domain files
- creating one giant `ConversationRuntimeState` contract that owns every surface
- storing loosely typed JSON blobs when stable refs and source ownership are
  already known
- using inheritance hierarchies where discriminated unions or composition fit
  the existing TypeScript style better

## Clean Architecture, SOLID, And GoF Rules

Phase 01 is a contract phase, so architecture quality matters more than volume.

### Clean Architecture Rules

- Entities in `src/core/entities` must not import adapters, React, Next.js,
  `better-sqlite3`, environment helpers, or route code.
- Use-case ports in `src/core/use-cases` must describe behavior in business
  language, not SQL or HTTP language.
- Adapters may import domain entities and ports; domain entities and ports must
  not import adapters.
- Composition roots may know concrete classes. Core contracts may not.
- Read models should have explicit source refs instead of hiding provenance in
  arbitrary metadata.

### SOLID Rules

- Single Responsibility: each contract owns one reason to change. For example,
  `WorkspaceSnapshot` summarizes current workspace state; it does not own job
  payloads, asset metadata, memory extraction, or referral ledger rows.
- Open/Closed: add new projection inputs through compact refs and projector
  inputs, not by rewriting every consumer of the contract.
- Liskov Substitution: repository ports must be implementable by in-memory,
  projection-backed, and SQLite adapters without changing caller behavior.
- Interface Segregation: prefer small reader/writer ports such as
  `WorkspaceSnapshotReader` and `WorkspaceSnapshotWriter` if a full repository
  would force callers to depend on methods they do not use.
- Dependency Inversion: use-case services depend on ports and pure projectors;
  concrete `DataMapper` classes are selected in composition roots.

### GoF Patterns To Use Deliberately

- Repository: persistence ports plus `*DataMapper` implementations, matching
  the existing adapter layer.
- Factory / Composition Root: `RepositoryFactory`, `conversation-root.ts`, or a
  new narrow conversation-refactor root wires concrete dependencies.
- Facade: a future restore facade can compose workspace, workflow, jobs, assets,
  memory, prompt, and migration readers the way `PlatformInteractionFacade`
  composes timeline and revision views.
- Strategy: status mapping, key building, and projection policies should be
  replaceable functions or small strategy objects, not conditionals spread
  across UI and routes.
- Adapter: existing tables such as `conversations`, `job_requests`,
  `user_files`, `prompt_provenance_records`, `referrals`, and `referral_events`
  should be adapted into new contracts before new storage is considered.
- Null Object / Unsupported Projection: when a later phase owns a surface, Phase
  01 may define explicit empty or unsupported projections instead of returning
  ambiguous partially shaped objects.

Patterns to avoid:

- Singleton domain services. Process-cached singletons belong in composition
  roots only.
- God object facades that mutate multiple domains directly.
- Active Record models that mix SQL persistence with domain contracts.
- Observer/event code that makes browser state or SSE events authoritative.

## Spec QA

Check each contract for:

- owner
- lifecycle
- migration behavior
- deletion behavior
- projection path into restore
- negative ownership boundary

Every contract must say what state it must not own.

Additional architecture QA:

- no new file in `src/core/entities` imports from `src/adapters`, `src/lib/db`,
  `next/*`, `react`, or UI/framework folders
- no new file in `src/core/use-cases` imports a concrete `*DataMapper`
- every new repository port has a boundary or contract test that proves it is a
  substitutable port; fake or in-memory implementations are only required once
  the phase adds behavior beyond pure contract shape
- every contract's fields, refs, and phase notes identify owner, lifecycle,
  deletion, migration, projection, and non-goals without forcing prose sections
  into pure TypeScript entity files
- every optional field has a reason: later phase, unavailable source, privacy,
  or deleted source
- every ref type names its owning source and avoids copying full payloads

## Ground

Before coding, map contracts to concrete files. Suggested likely locations:

- `src/core/entities/conversation-workspace.ts`
- `src/core/entities/relationship-memory.ts`
- `src/core/entities/materialization.ts`
- `src/core/entities/operator-transition.ts`
- `src/core/entities/trust-distribution.ts`
- `src/core/use-cases/*Repository.ts`
- `src/adapters/*DataMapper.ts`
- `src/lib/db/migrations.ts`

Use different names if the current codebase suggests a better local pattern.

Concrete grounding map from current code:

| Current source | What Phase 01 can adapt | What Phase 01 must not do |
| --- | --- | --- |
| `ConversationRepository` / `ConversationDataMapper` | user, conversation, active/archive/delete/import state | make conversation rows the full workspace model |
| `MessageRepository` / `MessageDataMapper` | recent transcript and evidence refs | use `messages.parts` as operational truth for new contracts |
| `JobQueueRepository` / `JobQueueDataMapper` | active job refs, terminal job refs, job event evidence | rebuild job ledger or duplicate job payloads in workspace snapshots |
| `UserFileRepository` / `UserFileDataMapper` | durable file refs and asset backing | make binary storage the asset catalog contract |
| `PromptProvenanceDataMapper` | effective hash, slot refs, sections, replay context | assume chat-turn provenance covers all durable decisions |
| `embed-conversation.ts` / vector store | transcript recall source ids and ownership repair | treat embedding rows as relationship memory |
| `referral-ledger.ts`, `ReferralDataMapper`, `ReferralEventDataMapper` | trust-distribution refs and milestone evidence | duplicate referral ledger rows or automate payout decisions |
| `ExecutionTimelineReader` / projectors | reader/projector/facade structure | put projection logic in route handlers or React hooks |

Suggested new architecture files for Phase 01:

- `src/core/entities/conversation-workspace.ts`
- `src/core/entities/business-workflow-context.ts`
- `src/core/entities/operator-transition.ts`
- `src/core/entities/trust-distribution.ts`
- `src/core/entities/materialization.ts`
- `src/core/entities/relationship-memory.ts`
- `src/core/entities/prompt-binding.ts`
- `src/core/entities/identity-migration.ts`
- `src/core/use-cases/WorkspaceSnapshotRepository.ts`
- `src/core/use-cases/BusinessWorkflowContextRepository.ts`
- `src/core/use-cases/OperatorTransitionRepository.ts`
- `src/core/use-cases/TrustDistributionRepository.ts`
- `src/core/use-cases/MaterializationRepository.ts`
- `src/core/use-cases/RelationshipMemoryRepository.ts`
- `src/core/use-cases/PromptBindingRepository.ts`
- `src/core/use-cases/IdentityMigrationRepository.ts`

Only add adapter files in Phase 01 when a contract cannot be tested without
them. Otherwise, leave adapter creation to the owning projection phase.

## Build

Build the minimum contract layer:

- TypeScript interfaces or entity types
- repository ports for new canonical models
- no-op, projection-backed, or in-memory implementations only where useful; do
  not create fake adapters merely to make a contract phase feel more complete
- contract tests for shape, migration fields, and ownership boundaries

Avoid runtime cutover in this phase unless it is required to make tests compile.

Expected architecture deliverables:

- pure domain contracts for the missing canonical surfaces
- small ref/value-object types shared by the contracts, such as business object
  refs, source refs, evidence refs, lifecycle status, and migration status
- repository or reader ports for contracts that later phases must query
- explicit unsupported/empty projection values where later phases own the data
- contract tests that assert boundaries, no payload duplication, and migration
  fields
- architecture tests or static canaries that prevent new core-to-adapter imports
  for this package

Do not add UI components, routes, restore endpoints, browser hooks, SSE behavior,
or schema-heavy persistence in Phase 01 unless a contract cannot compile or be
tested without the smallest possible adapter.

## Remove Before Phase 01 Is Complete

Phase 01 is complete only after the implementation removes ambiguity introduced
by the contract work. This does not mean deleting all old runtime behavior; it
means deleting contract-level confusion before later phases start.

Remove or reject all of the following before closing Phase 01:

- any new contract field whose only source is `MessagePart`, `tool_result`, or
  historical transcript JSON
- any new core/domain import from `src/adapters`, `src/lib/db`, route handlers,
  React components, hooks, or Next.js framework APIs
- any new use-case dependency on a concrete `*DataMapper` instead of a port
- any new table or column that duplicates full job payloads, full asset
  metadata, full lead/deal/referral payloads, or full prompt text without an
  explicit retention decision
- any catch-all `metadata: Record<string, unknown>` field used as a substitute
  for known first-class refs or lifecycle state
- any default export or barrel export that hides ownership of the new contracts
- any contract that lacks migration, deletion, privacy, and non-goal sections
- any TODO placeholder in a contract file that does not state the owning later
  phase and the guarded behavior until then
- any duplicate concept names between docs and code, such as both
  `RelationshipMemory` and `RelationshipMemoryRecord` meaning different things
- any new runtime call path that changes homepage restore behavior before Phase
  03 explicitly accepts that cutover

Also remove from the phase plan any proposed new persistence that Phase 01 did
not prove necessary. Unneeded tables are not neutral; they become migration and
privacy burden.

## Phase QA

Before implementation, verify:

- no contract duplicates an existing entity unnecessarily
- no contract requires a future UI choice to be made now
- schema changes, if any, are additive and migration-safe
- Clean Architecture boundaries are proven by static checks or review notes
- every GoF pattern used has a concrete purpose and is not ceremony
- every removal item above is either completed or explicitly deferred to a named
  later phase with a guard

## Implementation QA

Required validation:

- typecheck or focused compile validation
- unit tests for new contracts and repository ports
- migration/schema tests if persistence was added
- no homepage restore behavior changes unless explicitly accepted
- focused architecture-boundary tests for new files
- `npm run qa:conversation-refactor` remains green after Phase 01 updates its
  evidence bundle or focused suite list

## Update

After completion, update Phase 02 with the actual contract names and storage
locations to use for workspace projection.

Also update:

- [../phase-00-baseline-evidence.md](../phase-00-baseline-evidence.md) if the
  evidence classification changes
- `release/conversation-refactor-evidence.json` if Phase 01 adds new focused
  suites or changes the QA bundle
- [phase-02-workspace-snapshot-projection.md](phase-02-workspace-snapshot-projection.md)
  with exact contract names, ports, and any unsupported/null projections Phase
  02 must honor

## Implementation Notes

Phase 01 implementation adds pure contracts and repository/reader ports only.

Added entity contracts:

- `src/core/entities/conversation-continuity.ts`
- `src/core/entities/conversation-workspace.ts`
- `src/core/entities/business-workflow-context.ts`
- `src/core/entities/operator-transition.ts`
- `src/core/entities/trust-distribution.ts`
- `src/core/entities/materialization.ts`
- `src/core/entities/relationship-memory.ts`
- `src/core/entities/prompt-binding.ts`
- `src/core/entities/identity-migration.ts`

Added ports:

- `src/core/use-cases/WorkspaceSnapshotRepository.ts`
- `src/core/use-cases/BusinessWorkflowContextRepository.ts`
- `src/core/use-cases/OperatorTransitionRepository.ts`
- `src/core/use-cases/TrustDistributionRepository.ts`
- `src/core/use-cases/MaterializationRepository.ts`
- `src/core/use-cases/RelationshipMemoryRepository.ts`
- `src/core/use-cases/PromptBindingRepository.ts`
- `src/core/use-cases/IdentityMigrationRepository.ts`

No schema, route, hook, SSE, browser-runtime, or homepage restore cutover is
part of Phase 01. The executable proof is
`tests/conversation/phase-01-canonical-domain-contracts.test.ts`, now included
in `npm run qa:conversation-refactor`.

Semantic QA decisions now locked by Phase 01:

- `WorkspaceJobRef.status` is active-only: `queued` or `running`. Terminal and
  attention states such as `succeeded`, `failed`, `canceled`, and `dead_letter`
  must not appear in `WorkspaceSnapshot.activeJobRefs`.
- `MaterializationOutputKind` is limited to `asset`, `job`, and `work_order`.
  A transcript message can be evidence, but it is not a canonical
  materialization output.
- Phase 01 intentionally added no fake adapters, SQLite tables, routes, hooks,
  SSE behavior, browser-runtime changes, or restore cutover. The ports are
  validated as boundaries and can receive projection-backed or SQLite adapters
  in their owning phases.
- The conversation refactor evidence bundle now covers Phase 00 through Phase
  02A as `conversation-refactor-phase-00-02a-business-workflow-context` with
  `phase: "00-02A"`.
