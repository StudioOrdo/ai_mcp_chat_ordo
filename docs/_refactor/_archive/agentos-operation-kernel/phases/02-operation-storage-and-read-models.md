# Phase 02: Operation Storage And Read Models

Status: Implemented

## Goal

Add durable SQLite-backed storage, repositories, and read models for the Phase
01 operation contract:

- operations,
- operation steps,
- operation events,
- operation actions,
- operation artifacts.

Phase 02 makes operations durable and queryable. It must not add chat UI,
operation APIs, prompt grounding, worker execution, Rust payload changes, or
subsystem migrations. Those begin in later phases.

The net result must be a canonical operation ledger that later phases can use
without asking jobs, backup/restore, media, or factory to own the product-level
truth.

## Inputs From Phase 00 And Phase 01

Phase 00 evidence:

- `../evidence/phase-00-baseline.md`

Phase 01 implementation:

- `src/core/entities/operation.ts`
- `src/core/use-cases/operations/OperationStateMachine.ts`
- `src/core/use-cases/operations/OperationActionPolicy.ts`
- `src/core/use-cases/operations/OperationKindRegistry.ts`
- `src/core/use-cases/operations/OperationStatusMapping.ts`
- `../contract-spec.md`

Key constraints carried forward:

- Phase 00 confirmed there are no existing `operation%` tables.
- Phase 00 confirmed current durable ledgers are split across jobs,
  backup/restore, media, factory, messages, prompt bindings, and logs.
- Phase 01 introduced canonical `revision`, `operationRevision`,
  `idempotencyKey`, `payloadSchemaKey`, `allowedStatuses`, and
  `dependsOnStepIds`.
- Phase 01 requires stale actions and replayed action ids to fail safely.
- Phase 01 keeps state transitions in pure domain code. Phase 02 must call into
  that contract instead of rewriting state rules in SQL.

## Current Code Grounding

### Schema Entry Points

- `src/lib/db/schema.ts`
  - `ensureSchema` calls `createTables`, `runMigrations`, pruning, and seeds.
- `src/lib/db/index.ts`
  - opens the process-cached `better-sqlite3` handle.
  - enables WAL mode and `busy_timeout`.
  - currently does not enable SQLite foreign-key enforcement for runtime
    connections.
- `src/lib/db/tables.ts`
  - defines baseline tables for fresh databases.
  - contains job, factory, system command, backup, restore, prompt, conversation,
    and message table creation.
- `src/lib/db/migrations.ts`
  - contains additive migrations for existing local databases.
  - uses `addColumnIfNotExists` for columns and `CREATE TABLE IF NOT EXISTS`
    for new tables.

Decision:

Add operation tables to both `tables.ts` and `migrations.ts`. Fresh appliance
databases and existing local development databases must converge on the same
schema. Enable `PRAGMA foreign_keys = ON` in `getDb()` before `ensureSchema`
so operation child-table constraints are active in local, test, and Docker
runtime paths.

### Existing Repository Patterns

- `src/adapters/JobQueueDataMapper.ts`
  - maps rows to core entities.
  - uses JSON columns with `_json` suffix.
  - appends sequenced events with SQL-side `COALESCE(MAX(sequence), 0) + 1`.
- `src/lib/media/workflows/sqlite-media-workflow-repository.ts`
  - persists workflow, steps, events, dependencies, and JSON payloads.
  - uses `depends_on_step_ids_json`.
- `src/adapters/FactoryDataMapper.ts`
  - stores durable snapshots, stages, events, outputs, checkpoints.
  - appends per-work-order event sequences.
- `src/adapters/BackupSystemCommandDataMapper.ts`
  - validates command names and payloads before insertion.
  - maps JSON payload and result fields.
- `src/adapters/RepositoryFactory.ts`
  - exposes process-cached singleton repositories.
  - invalidates cached readers when the DB handle changes.

Decision:

Implement an `OperationDataMapper` in `src/adapters` and expose it through
`RepositoryFactory` with the same process-cached, DB-handle-aware lifetime used
by job, factory, media, and backup repositories.

### Existing Durable Ledgers To Link

Phase 02 must not migrate subsystem behavior, but it must create link columns
that can represent existing work:

- `job_requests.id`
- `system_commands.id`
- `backup_snapshots.id`
- `restore_plans.id`
- `media_workflows.id`
- `media_workflow_steps.id`
- `factory_work_orders.id`
- `factory_stage_runs.id`
- `factory_outputs.id`

Decision:

Do not add hard foreign keys to every subsystem table in Phase 02. Use nullable
typed reference fields and artifact metadata so the operation ledger stays
canonical without creating migration coupling. Where the referenced table is
core and stable, optional foreign keys are allowed only if they do not make
future subsystem pruning harder.

## Clean Architecture Shape

Expected new core files:

- `src/core/use-cases/operations/OperationRepository.ts`
- `src/core/use-cases/operations/OperationReadModel.ts`
- `src/core/use-cases/operations/OperationRepository.test.ts` only if the
  contract has pure in-memory helpers worth testing outside SQLite.

Expected new adapter files:

- `src/adapters/OperationDataMapper.ts`
- `src/adapters/OperationDataMapper.test.ts`

Expected modified files:

- `src/core/entities/operation.ts`
- `src/lib/db/index.ts`
- `src/lib/db/tables.ts`
- `src/lib/db/migrations.ts`
- `src/adapters/RepositoryFactory.ts`

`src/core/entities/operation.ts` changes are limited to storage-readiness
metadata that Phase 01 intentionally left out. Phase 02 must add
`OperationEvent.sequence` so the durable event ledger exposes the same ordering
it persists. Do not add new state-machine behavior to Phase 01 files.

Do not put storage logic in Phase 01 domain files. Do not let API routes or UI
components write operation rows directly.

## Schema Contract

Use SQLite tables with snake_case columns and JSON text columns matching current
repo conventions.

### `operations`

Columns:

- `id TEXT PRIMARY KEY`
- `kind TEXT NOT NULL`
- `revision INTEGER NOT NULL`
- `title TEXT NOT NULL`
- `status TEXT NOT NULL`
- `risk_level TEXT NOT NULL`
- `conversation_id TEXT DEFAULT NULL`
- `origin_message_id TEXT DEFAULT NULL`
- `created_by_user_id TEXT DEFAULT NULL`
- `created_by_role TEXT NOT NULL`
- `visibility TEXT NOT NULL`
- `current_step_id TEXT DEFAULT NULL`
- `summary TEXT DEFAULT NULL`
- `input_json TEXT NOT NULL DEFAULT '{}'`
- `result_json TEXT DEFAULT NULL`
- `error_json TEXT DEFAULT NULL`
- `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
- `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
- `completed_at TEXT DEFAULT NULL`

Indexes:

- `idx_operations_conversation_updated`
  on `(conversation_id, updated_at DESC, id DESC)`
- `idx_operations_user_status_updated`
  on `(created_by_user_id, status, updated_at DESC, id DESC)`
- `idx_operations_status_updated`
  on `(status, updated_at DESC, id DESC)`
- `idx_operations_kind_status_updated`
  on `(kind, status, updated_at DESC, id DESC)`
- `idx_operations_visibility_updated`
  on `(visibility, updated_at DESC, id DESC)`

Foreign keys:

- `conversation_id` references `conversations(id)` with `ON DELETE SET NULL`.
- `origin_message_id` references `messages(id)` with `ON DELETE SET NULL`.
- `created_by_user_id` references `users(id)` with `ON DELETE SET NULL`.
- `current_step_id` may reference `operation_steps(id)` with `ON DELETE SET NULL`
  only if the migration can avoid cyclic insert problems. Repository-level
  validation is still required either way.

Rules:

- `revision` starts at `1`.
- Repository mutation methods must only persist operation status/revision
  changes returned by `OperationStateMachine`.
- `current_step_id` may be null at draft creation.
- JSON fields must map to `Record<string, unknown>` or null in the adapter.

### `operation_steps`

Columns:

- `id TEXT PRIMARY KEY`
- `operation_id TEXT NOT NULL`
- `sequence INTEGER NOT NULL`
- `kind TEXT NOT NULL`
- `status TEXT NOT NULL`
- `depends_on_step_ids_json TEXT NOT NULL DEFAULT '[]'`
- `capability_name TEXT DEFAULT NULL`
- `job_id TEXT DEFAULT NULL`
- `system_command_id TEXT DEFAULT NULL`
- `resource_ref_json TEXT DEFAULT NULL`
- `input_json TEXT NOT NULL DEFAULT '{}'`
- `output_json TEXT DEFAULT NULL`
- `error_json TEXT DEFAULT NULL`
- `retry_count INTEGER NOT NULL DEFAULT 0`
- `started_at TEXT DEFAULT NULL`
- `completed_at TEXT DEFAULT NULL`
- `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
- `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`

Indexes:

- unique `idx_operation_steps_operation_sequence`
  on `(operation_id, sequence)`
- `idx_operation_steps_operation_status`
  on `(operation_id, status, sequence)`
- `idx_operation_steps_job`
  on `(job_id)`
- `idx_operation_steps_system_command`
  on `(system_command_id)`

Foreign keys:

- `operation_id` references `operations(id)` with `ON DELETE CASCADE`.
- Do not add hard foreign keys from `job_id`, `system_command_id`, or
  `resource_ref_json` to subsystem tables in Phase 02.

Rules:

- `depends_on_step_ids_json` stores Phase 01 `dependsOnStepIds`.
- Step transition persistence must go through repository methods that validate
  against `OperationStateMachine`.
- `job_id` and `system_command_id` are optional links for later phases.

### `operation_events`

Columns:

- `id TEXT PRIMARY KEY`
- `operation_id TEXT NOT NULL`
- `step_id TEXT DEFAULT NULL`
- `sequence INTEGER NOT NULL`
- `event_type TEXT NOT NULL`
- `actor_type TEXT NOT NULL`
- `actor_id TEXT DEFAULT NULL`
- `payload_json TEXT NOT NULL DEFAULT '{}'`
- `created_at TEXT NOT NULL DEFAULT (datetime('now'))`

Indexes:

- unique `idx_operation_events_operation_sequence`
  on `(operation_id, sequence)`
- `idx_operation_events_operation_created`
  on `(operation_id, created_at, id)`
- `idx_operation_events_step_created`
  on `(step_id, created_at, id)`
- `idx_operation_events_type_created`
  on `(event_type, created_at DESC)`

Foreign keys:

- `operation_id` references `operations(id)` with `ON DELETE CASCADE`.
- `step_id` references `operation_steps(id)` with `ON DELETE SET NULL`.

Rules:

- Events are append-only.
- Sequence is per operation.
- `OperationEvent.sequence` must be hydrated into the core event entity.
- Use a transaction or SQL-side sequence allocation to prevent duplicate
  sequence values.
- Do not update existing event rows.

### `operation_actions`

Columns:

- `id TEXT PRIMARY KEY`
- `operation_id TEXT NOT NULL`
- `operation_revision INTEGER NOT NULL`
- `action_type TEXT NOT NULL`
- `label TEXT NOT NULL`
- `risk_level TEXT NOT NULL`
- `confirm_policy TEXT NOT NULL`
- `allowed_roles_json TEXT NOT NULL DEFAULT '[]'`
- `allowed_statuses_json TEXT NOT NULL DEFAULT '[]'`
- `enabled INTEGER NOT NULL`
- `disabled_reason TEXT DEFAULT NULL`
- `idempotency_key TEXT NOT NULL`
- `expires_at TEXT DEFAULT NULL`
- `payload_json TEXT NOT NULL DEFAULT '{}'`
- `payload_schema_key TEXT NOT NULL`
- `confirmation_text TEXT DEFAULT NULL`
- `accepted_at TEXT DEFAULT NULL`
- `accepted_by_user_id TEXT DEFAULT NULL`
- `accepted_by_role TEXT DEFAULT NULL`
- `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
- `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`

Indexes:

- unique `idx_operation_actions_idempotency`
  on `(operation_id, idempotency_key)`
- unique `idx_operation_actions_operation_action`
  on `(operation_id, id)`
- `idx_operation_actions_operation_revision`
  on `(operation_id, operation_revision)`
- `idx_operation_actions_operation_enabled`
  on `(operation_id, enabled, expires_at)`
- `idx_operation_actions_action_type`
  on `(action_type, created_at DESC)`

Foreign keys:

- `operation_id` references `operations(id)` with `ON DELETE CASCADE`.

Rules:

- Stored action rows are the durable source for exposed actions.
- `replaceActions` must not delete accepted action rows. It must disable
  superseded unaccepted rows and insert the newly exposed action rows so stale
  clients can receive deterministic stale-action responses.
- Accepting an action must persist `accepted_at`, `accepted_by_user_id`, and
  `accepted_by_role` in the same transaction as the event append.
- `acceptAction` input must include the caller's `idempotencyKey`; the
  repository must compare it with the stored row before calling
  `OperationActionPolicy`.
- If `OperationActionPolicy` returns `duplicate: true`, the repository must
  return the accepted result without appending a second event or performing a
  second mutation.
- Reusing an accepted action id with a different idempotency key must be
  rejected before any mutation.
- The repository must delegate validation to Phase 01 `OperationActionPolicy`.

### `operation_artifacts`

Columns:

- `id TEXT PRIMARY KEY`
- `operation_id TEXT NOT NULL`
- `step_id TEXT DEFAULT NULL`
- `kind TEXT NOT NULL`
- `uri TEXT NOT NULL`
- `label TEXT NOT NULL`
- `metadata_json TEXT NOT NULL DEFAULT '{}'`
- `created_at TEXT NOT NULL DEFAULT (datetime('now'))`

Indexes:

- `idx_operation_artifacts_operation_created`
  on `(operation_id, created_at DESC, id DESC)`
- `idx_operation_artifacts_step_created`
  on `(step_id, created_at DESC, id DESC)`
- `idx_operation_artifacts_kind_created`
  on `(kind, created_at DESC)`

Foreign keys:

- `operation_id` references `operations(id)` with `ON DELETE CASCADE`.
- `step_id` references `operation_steps(id)` with `ON DELETE SET NULL`.

Rules:

- Artifacts store references, not binary data.
- Artifact `uri` may be an internal stable reference such as
  `backup://backup_...`, `job://job_...`, `media://asset_...`, or
  `factory://output_...`.

## Repository Contract

Create a core repository contract in
`src/core/use-cases/operations/OperationRepository.ts`.

Required write methods:

- `createOperation(input): Promise<OperationSnapshot>`
- `updateOperationStatus(input): Promise<OperationSnapshot>`
- `upsertStep(input): Promise<OperationSnapshot>`
- `transitionStep(input): Promise<OperationSnapshot>`
- `replaceActions(input): Promise<OperationSnapshot>`
- `acceptAction(input): Promise<OperationActionAccepted>`
- `appendEvent(input): Promise<OperationEvent>`
- `attachArtifact(input): Promise<OperationArtifact>`

Required read methods:

- `findOperationById(id): Promise<OperationSnapshot | null>`
- `listOperationsByConversation(conversationId, options): Promise<OperationSummary[]>`
- `listOperationsForUser(userId, options): Promise<OperationSummary[]>`
- `listOperationsForAdmin(options): Promise<OperationSummary[]>`
- `listEvents(operationId, options): Promise<OperationEvent[]>`
- `listArtifacts(operationId, options): Promise<OperationArtifact[]>`
- `listAvailableActions(operationId, options): Promise<OperationAction[]>`

Required types:

- `OperationSnapshot`
  - `operation`
  - `steps`
  - `actions`
  - `events`
  - `artifacts`
- `OperationSummary`
  - operation scalar fields,
  - counts for steps/actions/artifacts/events,
  - latest event type/time,
  - progress summary based on step statuses.

Implementation rules:

- `OperationDataMapper` must map rows into Phase 01 `Operation`,
  `OperationStep`, `OperationAction`, `OperationEvent`, and
  `OperationArtifact`.
- `OperationDataMapper` must centralize JSON parsing/serialization helpers.
  Do not scatter raw `JSON.parse` and `JSON.stringify` calls through repository
  methods.
- Hydration must validate enum fields through Phase 01 guards such as
  `isOperationKind`, `isOperationStatus`, and `isOperationStepStatus` before
  returning core entities.
- Hydration must validate role fields against the current `RoleName` literals
  before returning core entities.
- Write inputs must reject invalid record-shaped JSON payloads before SQL
  writes. Array-shaped fields such as `dependsOnStepIds` must be validated as
  arrays.
- The mapper constructor must accept injectable `OperationKindRegistry`,
  `OperationStateMachine`, `OperationActionPolicy`, and payload validators, with
  Phase 01 defaults used when callers do not pass them.
- All multi-row writes must use `db.transaction`.
- Repository write methods must append domain events for creation, status
  change, step change, action exposure, action request/rejection, artifact
  attachment, and completion where appropriate.
- The repository must not expose raw SQL rows to callers.
- API and UI layers must not be introduced in Phase 02.

## Read Model Contract

Create `src/core/use-cases/operations/OperationReadModel.ts` for stable view
types that later phases can reuse.

Read models required in Phase 02:

- conversation operation card summary,
- admin/global operation list summary,
- operation detail snapshot,
- health operation aggregate,
- prompt grounding operation summary.

The implementation can live in `OperationDataMapper` methods for Phase 02, but
the types must be defined in core so UI, health, and prompt phases do not
invent incompatible shapes later.

### Conversation Summary

Fields:

- `operationId`
- `kind`
- `title`
- `status`
- `riskLevel`
- `revision`
- `currentStepId`
- `summary`
- `progress`
- `availableActions`
- `latestEvent`
- `updatedAt`

### Admin Summary

Fields:

- conversation summary fields,
- `createdByUserId`
- `createdByRole`
- `visibility`
- `createdAt`
- `completedAt`
- step/action/artifact/event counts.

### Health Aggregate

Fields:

- total active operations,
- active by status,
- active by kind,
- failed count,
- blocked count,
- oldest active operation age,
- pending destructive actions.

### Prompt Grounding Summary

Fields:

- operation id/kind/status/revision,
- current step,
- latest relevant events,
- available action ids/types/labels,
- artifact labels/uris,
- error code/message.

Phase 05 will use this for model context; Phase 02 only needs stable data
contracts and repository methods.

## RepositoryFactory Contract

Update `src/adapters/RepositoryFactory.ts` with:

- process-cached singleton `getOperationRepository()`,
- DB-handle invalidation matching job/factory/media/backup patterns,
- no eager DB opening beyond existing `getDb()` behavior.

If later read models need a narrower type alias, expose it as a function that
returns the same `OperationDataMapper` instance rather than a second DB-backed
object.

## Greenfield Pruning And Non-Goals

This is greenfield. There is no user data to preserve through broad migration
machinery.

Do:

- add clean operation tables,
- add clean repository contracts,
- add read models designed for future phases,
- keep subsystem legacy rows untouched,
- use the operation ledger as the new canonical path.

Do not:

- backfill current dev jobs/media/factory/backup rows into operations,
- add compatibility for old Rust command names `backup` or `restore`,
- mutate existing subsystem behavior,
- add operation UI or API routes,
- store binary artifacts in SQLite,
- duplicate Phase 01 state transition rules in SQL.

## Positive Use Cases

- Empty database schema creation includes all operation tables and indexes.
- A `backup_create` operation can be created with revision `1`.
- A `restore_execute` operation can store destructive actions with
  `allowedStatuses`, `operationRevision`, `idempotencyKey`, and
  `payloadSchemaKey`.
- A media workflow operation can store dependent steps with
  `dependsOnStepIds`.
- A factory work order operation can attach factory output artifacts.
- Events append in operation-local sequence order.
- Conversation-scoped reads return only operations for that conversation.
- Admin reads can filter by status, kind, and created time.

## Negative Use Cases

- Creating an operation with an unknown kind is rejected before insertion.
- Persisting a status transition that Phase 01 rejects fails before SQL update.
- Accepting an action with stale `operationRevision` fails and appends no
  acceptance mutation.
- Reusing an accepted action id with a different idempotency key fails.
- Attaching an artifact to a missing operation fails.
- Appending an event to a missing operation fails.
- Direct SQL callers are not introduced.

## Edge Use Cases

- Operation may have no conversation id for admin/system operations.
- Operation may have no current step while in draft state.
- Operation may have zero available actions after completion.
- Action may expire while still visible in a stale client; repository must
  return a stale action result through `OperationActionPolicy`.
- Failed operation can retry only when the kind registry says retry is allowed.
- Step dependencies may be empty.
- Step dependencies may refer to skipped steps, which count as satisfied.
- Artifact metadata can be empty but must still serialize to `{}`.
- Existing local development database can already have jobs, media workflows,
  backup snapshots, restore plans, and system commands without operation rows.

## Test Plan

Required tests:

```bash
npx vitest run \
  src/core/entities/operation.test.ts \
  src/adapters/OperationDataMapper.test.ts \
  src/core/use-cases/operations/OperationRepository.test.ts

npm run typecheck
```

If `OperationRepository.test.ts` is not needed because all contract behavior is
covered by `OperationDataMapper.test.ts` and Phase 01 pure tests, record that in
the implementation closeout and run:

```bash
npx vitest run \
  src/core/entities/operation.test.ts \
  src/adapters/OperationDataMapper.test.ts \
  src/core/use-cases/operations/OperationStateMachine.test.ts \
  src/core/use-cases/operations/OperationActionPolicy.test.ts \
  src/core/use-cases/operations/OperationKindRegistry.test.ts \
  src/core/use-cases/operations/OperationStatusMapping.test.ts
```

Minimum `OperationDataMapper.test.ts` coverage:

- fresh `createTables` schema creation and migration schema creation both
  create all operation tables and indexes,
- create/read operation snapshot,
- create/read/update operation with revision increment,
- create/read dependent steps,
- dependency-invalid step transition is rejected,
- append/read events in sequence order with `OperationEvent.sequence` exposed,
- replace/list available actions,
- replacing actions disables superseded unaccepted rows without deleting
  accepted history,
- accept action with idempotency behavior,
- duplicate idempotent accept returns without a second mutation or event,
- reject same action id with different idempotency key,
- reject stale action revision,
- attach/list artifact,
- child rows for missing operations fail through repository validation and
  database constraints,
- runtime DB handles report `PRAGMA foreign_keys = 1`,
- invalid enum values and malformed JSON fail during mapper hydration instead
  of leaking invalid core entities,
- conversation-scoped list,
- user-scoped list,
- admin/global list with status/kind filters,
- health aggregate,
- prompt grounding summary,
- no storage writes happen outside repository methods in tests.

Optional focused lint:

```bash
npx eslint \
  src/core/use-cases/operations/OperationRepository.ts \
  src/core/use-cases/operations/OperationReadModel.ts \
  src/adapters/OperationDataMapper.ts \
  src/adapters/OperationDataMapper.test.ts
```

## Exit Criteria

- Operation tables exist in both `tables.ts` and `migrations.ts`.
- Runtime DB handles enable SQLite foreign-key enforcement.
- `OperationRepository` and read-model types exist in core.
- `OperationDataMapper` persists and hydrates Phase 01 operation entities.
- Operation writes use transactions.
- Operation events are append-only and sequenced per operation.
- Operation action acceptance is validated by `OperationActionPolicy`.
- Operation state changes are validated by `OperationStateMachine`.
- Read models support conversation, admin, health, and prompt grounding use
  cases.
- `RepositoryFactory` exposes operation storage with process-cached DB-handle
  invalidation.
- Required tests and typecheck pass.
- No UI, API, prompt, Rust, or subsystem migration work leaks into Phase 02.

## Implementation Closeout

Implemented files:

- `src/core/entities/operation.ts`
- `src/core/use-cases/operations/OperationRepository.ts`
- `src/core/use-cases/operations/OperationReadModel.ts`
- `src/adapters/OperationDataMapper.ts`
- `src/adapters/OperationDataMapper.test.ts`
- `src/lib/db/index.ts`
- `src/lib/db/tables.ts`
- `src/lib/db/migrations.ts`
- `src/adapters/RepositoryFactory.ts`

Closeout notes:

- Added `OperationEvent.sequence` and storage-facing enum guards to the Phase 01
  operation entity contract.
- Added operation tables and indexes to both fresh schema creation and additive
  migrations.
- Enabled `PRAGMA foreign_keys = ON` for runtime `getDb()` handles before
  schema creation.
- Added `OperationRepository` and read-model contracts in core.
- Added `OperationDataMapper` as the SQLite repository implementation with
  centralized JSON serialization/hydration, enum/role validation, transaction
  writes, operation-local event sequencing, stale-action handling, idempotent
  action acceptance, policy-level `action_rejected` event recording, and read
  models.
- Exposed `getOperationRepository()` through `RepositoryFactory` with DB-handle
  invalidation and added focused coverage for the cache invalidation behavior.
- No UI, API route, prompt-grounding, Rust, worker, backup/media/factory
  migration, or subsystem behavior was added in Phase 02.
- `OperationRepository.test.ts` was not added because the repository contract has
  no separate pure in-memory helper behavior. Contract behavior is covered by
  `OperationDataMapper.test.ts` plus the Phase 01 pure operation tests.

Verification:

```bash
npx vitest run \
  src/core/entities/operation.test.ts \
  src/adapters/OperationDataMapper.test.ts \
  src/core/use-cases/operations/OperationStateMachine.test.ts \
  src/core/use-cases/operations/OperationActionPolicy.test.ts \
  src/core/use-cases/operations/OperationKindRegistry.test.ts \
  src/core/use-cases/operations/OperationStatusMapping.test.ts

npm run typecheck -- --pretty false

npx eslint \
  src/core/use-cases/operations/OperationRepository.ts \
  src/core/use-cases/operations/OperationReadModel.ts \
  src/adapters/OperationDataMapper.ts \
  src/adapters/OperationDataMapper.test.ts
```

QA rerun on 2026-05-03:

- operation-focused Vitest suite passed with 6 files and 59 tests.
- `npm run typecheck -- --pretty false` passed.
- focused ESLint command above passed.
