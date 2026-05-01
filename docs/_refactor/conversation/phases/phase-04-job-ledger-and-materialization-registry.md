# Phase 04: Job Ledger And Materialization Registry

## Objective

Extend the existing durable job ledger with a real materialization registry so
the system can answer two separate questions without conflating them:

1. is equivalent work already active right now?
2. has equivalent work already succeeded and produced reusable output?

The brutal current truth is simple:

- the job ledger already exists and is materially useful
- active dedupe already exists, but only for queued and running jobs inside a
  conversation
- a durable materialization registry does not exist yet
- there is already a domain contract and repository port for materialization,
  but there is still no durable table, adapter wiring, migration, enqueue
  integration, or restore/query path backed by persisted records

Phase 04 is therefore not a “polish the existing reuse layer” phase. It is the
phase that must create the missing durable reuse authority without collapsing
job history, browser runtime state, transcript evidence, and asset identity into
one blob.

## Source Specs

- [../jobs-assets-materialization-spec.md](../jobs-assets-materialization-spec.md)
- [../domain-model-spec.md](../domain-model-spec.md)
- [../target-architecture.md](../target-architecture.md)
- [../validation-strategy.md](../validation-strategy.md)
- [../test-infrastructure-and-evidence.md](../test-infrastructure-and-evidence.md)
- [phase-01-canonical-domain-contracts.md](phase-01-canonical-domain-contracts.md)
- [phase-02-workspace-snapshot-projection.md](phase-02-workspace-snapshot-projection.md)
- [phase-03-restore-read-model-and-idempotent-homepage.md](phase-03-restore-read-model-and-idempotent-homepage.md)

## Phase 03 Handoff

Phase 03 established the restore read model and the rule that transcript
history is render evidence, not operational authority.

Phase 04 must preserve those boundaries:

- restore continues to load active jobs from durable job state, not transcript
  message parts
- browser runtime continuity remains a disposable in-tab execution aid, not the
  source of durable reuse truth
- `WorkspaceSnapshot.activeJobRefs` remains queued and running work only
- reusable outputs must become explicit durable records instead of being
  rediscovered from transcript parts, browser caches, or ad hoc envelope scans

Phase 04 may reuse the Phase 03 restore payload shape, but it must improve the
meaning of `materializationKey` on workspace job and asset references by making
that field backed by a real registry instead of null-or-aspirational metadata.

## Current Codebase Grounding

The current codebase already has a clear durable deferred-execution backbone.
The missing piece is historical success reuse.

### Durable Job Ledger That Already Exists

| Surface | Current behavior | Phase 04 implication |
| --- | --- | --- |
| `src/lib/db/tables.ts` | `job_requests` and `job_events` are real durable tables with indexes for status, conversation, and dedupe key. | The ledger should stay the lifecycle authority for execution history. Do not replace it with a materialization table. |
| `src/lib/db/migrations.ts` | `job_requests` already tracks `failure_class`, `next_retry_at`, `recovery_mode`, `last_checkpoint_id`, `replayed_from_job_id`, and `superseded_by_job_id`. | Replay, recovery, and supersession lineage already belong to the job ledger. Materialization should reference jobs, not absorb job semantics. |
| `src/adapters/JobQueueDataMapper.ts` | Implements `createJob`, `appendEvent`, `findActiveJobByDedupeKey`, lease recovery, job listing, and event history. | This is the adapter seam where Phase 04 can add materialization-backed queries through a separate repository, not by bloating the mapper into a god object. |
| `src/lib/jobs/deferred-job-worker.ts` | Handles execution, progress, retries, cancelation, and lease recovery around durable jobs. | Worker completion is the right place to register successful materializations after server-authoritative outputs are known. |
| `src/lib/jobs/manual-replay.ts` | Manual replay dedupes only against active equivalent work and records replay lineage. | Replay must remain explicit. It may dedupe to an active equivalent, but it must not silently downgrade into historical reuse. |
| `src/lib/jobs/job-read-model.ts` | Builds canonical job snapshots from durable jobs and events. | Snapshot projection should remain read-only. Do not hide materialization decisions in snapshot builders. |
| `src/core/platform/execution/ExecutionTimelineReader.ts` | `JobStatusQuery` is actually backed by an execution-timeline reader, not a thin list wrapper. | Phase 04 should follow this pattern: durable repositories plus pure projectors, not route-local SQL or hook logic. |

### Enqueue Decision Point That Exists Today

| Surface | Current behavior | Phase 04 implication |
| --- | --- | --- |
| `src/lib/jobs/enqueue-deferred-tool-job.ts` | Resolves a dedupe key and checks only `findActiveJobByDedupeKey(conversationId, dedupeKey)` before creating a new job. | This is the primary decision seam to extend with materialization reuse. |
| `src/lib/jobs/job-dedupe.ts` | Generic dedupe key is `conversationId:toolName:stableStringify(payload)`. | This is active-job dedupe, not a durable materialization identity. It is too conversation-bound and too payload-literal to serve as the final reuse key for all expensive outputs. |
| `src/lib/jobs/compose-media-deferred-job.ts` | `compose_media` uses `compose_media:${plan.id}` as its dedupe key after plan validation. | This prevents duplicate active jobs for one plan id, but it is not a canonical materialization key because plan id is not the same thing as normalized operation identity. |
| `src/lib/jobs/manual-replay.ts` | Manual replay reuses the active dedupe query and creates a new job otherwise. | Replay behavior must be separated from historical reuse behavior so explicit replay is still possible after a previous success. |

### Materialization Reality Today

| Surface | Current behavior | Phase 04 implication |
| --- | --- | --- |
| `src/core/entities/materialization.ts` | A domain `MaterializationRecord` contract exists with reuse policy and output refs. | The concept exists in core and should remain the starting point for Phase 04. |
| `src/core/use-cases/MaterializationRepository.ts` | Materialization reader/writer ports already exist, including `findReusableSuccess(...)`, `findByMaterializationKey(...)`, `upsert(...)`, and `markSuperseded(...)`. | Phase 04 should implement persistence and composition behind these ports rather than inventing a second repository abstraction. |
| `src/core/entities/conversation-workspace.ts` | `WorkspaceJobRef` and `WorkspaceAssetRef` already include `materializationKey`. | The domain is prepared for Phase 04, but the field is mostly ungrounded until a real registry exists. |
| `src/core/platform/conversation-workspace/WorkspaceSnapshotProjector.ts` | Active job refs already carry `requestPayload.materializationKey` when present. | The restore-side field is not purely hypothetical today; Phase 04 must replace this ad hoc payload-carried source with durable registry-backed meaning. |
| `src/hooks/chat/composeMediaMaterializationCore.ts` | Browser-side composition code can reason about envelopes, playback URIs, and primary asset ids. | This is browser execution/materialization assistance, not durable registry authority. Do not treat it as Phase 04’s reuse source. |
| `src/lib/jobs/deferred-job-result.ts` | Deferred result payloads can include `resultEnvelope`, artifacts, and asset ids. | Result envelopes are evidence and presentation payloads. They are not a searchable registry. |
| `src/lib/db/tables.ts` | There is no `materialization_records` table or equivalent durable registry table today. | Phase 04 needs new persistence, not just another projector over existing job rows. |
| `src/lib/db/migrations.ts` | There is no materialization migration today. | Schema work is part of the phase, not optional cleanup. |

### Composition Roots And Existing Patterns

| Surface | Current behavior | Phase 04 implication |
| --- | --- | --- |
| `src/adapters/RepositoryFactory.ts` | `getJobStatusQuery()` returns `getExecutionTimelineReader()`. | Phase 04 should add materialization repository/query wiring here or in a narrow composition root, not import data mappers into core policy code. |
| `src/core/platform/execution/ExecutionTimelineReader.ts` | Uses repositories plus pure projectors to expose job and timeline reads. | Copy this style for materialization reads and enqueue decisions. |
| `src/core/platform/conversation-restore/WorkspaceRestoreReader.ts` | Restore composes workspace, jobs, and transcript through narrow ports. | Phase 04 should plug materialization-backed asset/job refs into restore by extending these readers, not by scanning transcript. |

## Source Authority Matrix

| Concern | Current authority | Forbidden authority | Phase 04 rule |
| --- | --- | --- | --- |
| Job lifecycle | `job_requests` and `job_events` via `JobQueueRepository` and `ExecutionTimelineReader` | transcript `job_status` parts, SSE cache, browser runtime maps | Keep job lifecycle in the existing ledger. |
| Active-equivalent detection | `findActiveJobByDedupeKey` in `JobQueueRepository` | transcript scans, browser-local plan caches | Keep the active check, but treat it as only the first gate. |
| Historical reusable success | no persisted implementation today behind the existing materialization port | `resultEnvelope` scans, imported transcript, browser runtime job store | Implement the existing materialization repository/query boundary with durable storage and composition wiring. |
| Durable output identity | current job result envelope artifacts plus durable user-file records | raw message ids, tool invocation ids, browser runtime ids | Register durable outputs as explicit materialization outputs tied to stable keys. |
| Restore-time `materializationKey` values | domain field exists and current workspace projection can surface payload-carried keys, but not yet registry-backed keys | fake keys derived from transcript or UI state | Move this field from payload-carried convenience to durable registry-backed meaning. |
| Manual replay lineage | `replayed_from_job_id` and `superseded_by_job_id` on `job_requests` | materialization supersession pretending to be replay | Preserve replay as job-ledger behavior, separate from reuse. |

## Decide

Default Phase 04 decisions, grounded in current code:

1. Keep `job_requests` and `job_events` as the only execution-lifecycle
   authority.
2. Add a new durable materialization table and adapter implementation behind the
  existing materialization repository port instead of overloading
  `job_requests` into both a job ledger and a reuse registry.
3. Make `enqueueDeferredToolJob(...)` the first extension seam for reuse-aware
   decisions.
4. Start with the first expensive durable family where duplicate work already
   hurts: `compose_media`.
5. Register successful materializations only after server-authoritative outputs
   are known.
6. Keep manual replay as an explicit re-execution action. Manual replay may
   dedupe to an equivalent active job, but it should not silently convert into
   “reuse a past success” unless a separate explicit reuse action is requested.

Rejected approaches:

- active-job dedupe only
- using `job_requests.id` as materialization identity
- using `plan.id` as the final canonical materialization key
- inferring reusable success by scanning transcript `tool_result` payloads
- inferring reusable success by scanning browser runtime stores or caches
- storing materialization state only inside `request_payload_json` or
  `result_payload_json`
- adding timestamps, message ids, tool invocation ids, or browser runtime ids to
  the canonical materialization key
- letting hooks or route handlers independently decide reuse without a shared
  repository/query boundary

## Materialization Registry Contract

Phase 04 should ground the existing domain contract rather than inventing a new
ad hoc shape.

Start from the core contract in `src/core/entities/materialization.ts` and wire
it through the existing repository port in
`src/core/use-cases/MaterializationRepository.ts`.

Recommended Phase 04 rule: keep the job ledger as the authority for execution
lifecycle, and keep the materialization registry as the authority for reusable
completed results.

That means the registry should not become a second full execution ledger.
Statuses such as queued, running, failed, and canceled already belong to
`job_requests` and `job_events`.

Recommended first durable shape for the registry layer:

```typescript
export interface MaterializationRecord {
  id: string;
  userId: string | null;
  conversationId: string | null;
  materializationKey: string;
  toolName: string;
  pipelineVersion: string | null;
  status: "ready" | "superseded" | "invalidated";
  reusePolicy: "never" | "same_user" | "same_conversation" | "global_if_public";
  inputSourceRefs: readonly ContinuitySourceRef[];
  outputRefs: readonly MaterializationOutputRef[];
  evidenceRefs: readonly CanonicalEvidenceRef[];
  producedByJobId: string | null;
  supersededByRecordId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Recommended new ports:

- `MaterializationQuery`
- `MaterializationKeyBuilder`
- `MaterializationRegistrar` or `MaterializationRecorder`

These additions should extend the current core surface rather than duplicating
it. `MaterializationRepository` already exists and should remain the canonical
repository port.

## Materialization Key Rules

The current active dedupe keys are not enough. Phase 04 needs a new stable key
builder for historical reuse.

Materialization keys must include:

- operation name or tool name
- normalized request payload after validation and canonicalization
- canonical source asset ids or explicit continuity source refs
- relevant pipeline version
- relevant prompt or model version when output quality depends on it
- relevant policy or role scope when reuse visibility changes by audience

Materialization keys must exclude:

- job id
- event sequence
- browser runtime id
- tool invocation id
- timestamps
- raw message ids unless the message itself is a canonical source artifact
- ad hoc client-only counters

Specific grounded warning from current code:

- `buildDeferredJobDedupeKey(...)` is conversation-scoped and payload-literal
  active dedupe, not a general materialization identity
- `compose_media:${plan.id}` is even narrower and should be treated as a local
  active dedupe key, not the finished historical reuse key

## Enqueue Decision Order

The current controlling seam is `src/lib/jobs/enqueue-deferred-tool-job.ts`.
Phase 04 should make the decision order explicit:

1. validate and normalize the operation request
2. resolve canonical source asset ids or continuity refs
3. compute the materialization key
4. check for an active equivalent job
5. check for a reusable successful materialization
6. create a new job only when neither of the first two matches apply

Recommended result families:

```typescript
type EnqueueOutcome =
  | { outcome: "active_equivalent"; job: JobRequest; event: JobEvent; materialization: null }
  | { outcome: "exact_reuse"; job: null; event: null; materialization: MaterializationRecord }
  | { outcome: "queued"; job: JobRequest; event: JobEvent; materialization: null };
```

Do not overload one boolean such as `deduplicated` to mean both “reused a live
job” and “reused an old success.” Those are semantically different outcomes and
the UI, restore model, and audit trail need to distinguish them.

## Clean Architecture, SOLID, And GoF Rules

Phase 04 needs stricter boundaries than the current outline implied.

### Clean Architecture Rules

- Job lifecycle policy stays in job ports, worker logic, and timeline readers.
- Materialization policy stays in materialization ports, key builders, and pure
  projectors.
- Route handlers authenticate, parse inputs, call one use case or facade, and
  serialize JSON.
- React hooks render reuse outcomes and restore state; they do not determine
  historical reuse by scanning messages or browser caches.
- Browser runtime code may produce artifacts and envelopes, but final durable
  registration must be server-authoritative.
- Transcript remains audit and presentation evidence, never the reuse control
  plane.

### SOLID Rules

- Single Responsibility: key building, registry writes, registry reads, enqueue
  decisioning, and UI adaptation must be separate units.
- Open/Closed: new operation families should plug in normalization and source
  resolution strategies without rewriting the whole enqueue path.
- Liskov Substitution: enqueue policy must run against fake repositories in
  tests without SQLite, Next.js, or browser runtime modules.
- Interface Segregation: depend on narrow job and materialization ports, not a
  mega service that owns execution, restore, routing, and UI concerns.
- Dependency Inversion: high-level reuse policy depends on ports and entities;
  adapters depend on SQLite and current storage details.

### GoF Patterns To Use Deliberately

- Repository: separate repositories for job ledger and materialization registry.
- Data Mapper: SQLite row mapping remains in adapters.
- Projector: pure projectors shape reuse results, restore materialization refs,
  and any UI-facing summaries.
- Facade: a small enqueue/reuse facade may orchestrate active-job lookup,
  materialization lookup, and job creation.
- Strategy: per-operation normalization and materialization-key derivation
  should be pluggable.
- Adapter: client code consumes exact-reuse vs active-equivalent vs queued
  results through a compatibility adapter while the UI migrates.
- Null Object / Empty Projection: absent materialization remains explicit null or
  empty collections, not inferred transcript state.

### Patterns To Avoid

- Active Record
- Service Locator inside core policy code
- God Facade that owns enqueue, restore, replay, asset lookup, and rendering
- message-part authority
- browser-cache authority
- a single JSON blob field treated as the materialization database

## Build

Expected Phase 04 deliverables:

- durable materialization schema and migration
- materialization repository and query ports
- SQLite adapter implementation for materialization records
- stable materialization key builder for at least `compose_media`
- enqueue extension that distinguishes active-equivalent, exact-reuse, and new
  job creation
- success registration path from deferred worker completion to materialization
  record creation
- restore/read-model extension so workspace job and asset refs can carry real
  materialization keys where available
- focused tests for key stability, reuse, and explicit replay behavior
- evidence updates proving duplicate expensive work is prevented without hiding
  job history

Recommended first file shape:

- `src/core/use-cases/MaterializationRepository.ts`
- `src/core/use-cases/MaterializationQuery.ts`
- `src/core/services/materialization/MaterializationKeyBuilder.ts`
- `src/core/services/materialization/ResolveMaterializationReuse.ts`
- `src/adapters/MaterializationDataMapper.ts`
- `src/lib/jobs/materialization-key.ts`
- `src/lib/jobs/materialization-registration.ts`
- focused tests beside the new services and adapters

The practical rule here is:

- keep `MaterializationRepository.ts` and add the missing implementation and
  composition wiring
- add `MaterializationQuery.ts` only if a separate read-model/query interface is
  actually needed beyond the existing repository methods

## Remove Before Phase 04 Is Complete

Phase 04 is not complete while any of the following remain true:

- active-job dedupe is still the only duplicate-work protection for expensive
  durable outputs
- `compose_media:${plan.id}` is still acting as the de facto reuse identity for
  historical materialization
- the only place reusable output can be found is inside transcript
  `tool_result` payloads, `job_status` message parts, or result envelopes
- browser runtime stores or browser-side materialization helpers are treated as
  durable authority for historical reuse
- no materialization table or equivalent durable registry exists in schema and
  migrations
- `src/core/entities/materialization.ts` and
  `src/core/use-cases/MaterializationRepository.ts` remain domain-only surfaces
  without a durable adapter, composition wiring, or persisted implementation
- enqueue code still returns one ambiguous “deduped” outcome for both active
  equivalent work and historical reuse
- manual replay still has no explicit rule separating replay from reuse
- restore-time `materializationKey` fields still come only from ad hoc payload
  values and cannot be traced back to durable records
- successful job completion can produce durable output without registering a
  materialization record or explicit no-reuse policy
- route handlers or hooks are still scanning transcript history to answer “has
  this already succeeded?”
- any Phase 04 closure claim depends on browser runtime continuity tests alone
  rather than durable reuse tests

Compatibility exceptions may exist temporarily, but they must be named,
shrink-only, and covered by regression tests.

## Phase QA

Before implementation, confirm these grounded truths:

- the current ledger is strong enough to remain the execution authority
- the registry is the missing authority, not the ledger
- replay and reuse are different actions
- browser runtime is not a durable registry
- transcript evidence is not a reusable-success index
- this phase can ship without full asset catalog redesign as long as durable
  output refs are registered and queryable in a materialization record

## Implementation QA

Required validation:

- unit tests for materialization key normalization and stability
- unit tests proving excluded transient inputs do not change the key
- adapter tests for registry create, lookup, supersession, and query behavior
- enqueue tests proving the three-way outcome split:
  active equivalent, exact reuse, queued new job
- `compose_media` tests proving repeated equivalent requests reuse durable output
  instead of creating a new job
- replay tests proving explicit manual replay still creates a new job when there
  is no active equivalent, even if a previous success exists
- worker completion tests proving successful outputs register a materialization
  record
- restore/read-model tests proving `materializationKey` values come from durable
  records rather than transcript projection
- no-duplicate-work evidence from
  [../validation-strategy.md](../validation-strategy.md)

Suggested evidence updates:

- add Phase 04 suites to the conversation refactor evidence bundle
- add a browser or integration proof that repeated equivalent media requests do
  not create new jobs after a prior success is already durable
- add architecture canaries that forbid transcript scanning in reuse policy code

## Update

After completion, update Phase 05 and later asset phases with the actual
materialization fields, registry lookup paths, and output-registration hooks
consumed by the asset shelf, workspace restore, and execution surfaces.
