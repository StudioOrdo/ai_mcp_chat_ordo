# Phase 2 — Factory Persistence Backing

## Objective

Introduce a durable factory persistence slice for Phase 1 entities using the repository and SQLite data-mapper patterns that already exist in this codebase.

Phase 2 is not "extend the existing graph package" because no verified shared `src/core/graph/` or `graph_nodes` / `graph_edges` subsystem exists today. The implementation should instead create a factory-specific persistence model that is:

- aligned with the current raw-SQL SQLite stack
- additive in migrations
- JSON-safe for Phase 1 entities
- lineage-ready for future graph projection work
- explicit about current-state snapshots versus append-only history

## Status

- Design: QA-complete and implementation-ready
- Dependencies: Phase 1 entity layer
- Primary implementation target: new factory repository contract plus SQLite-backed adapter

## Verified Codebase Anchors

The Phase 2 design must follow patterns already verified in the repository:

| Concern | Verified anchor | Why it matters |
| ------ | ------ | ------ |
| DB bootstrap | `src/lib/db/tables.ts`, `src/lib/db/migrations.ts` | Schema is additive, raw SQL, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `addColumnIfNotExists(...)` |
| Repository contract shape | `src/core/use-cases/JobQueueRepository.ts` | Core interfaces live in `src/core/use-cases/` and expose use-case operations, not table CRUD |
| SQLite adapter shape | `src/adapters/JobQueueDataMapper.ts` | Adapters map rows to entities, serialize JSON explicitly, and own SQL |
| Snapshot / artifact history | `src/adapters/BlogPostArtifactDataMapper.ts`, `src/adapters/BlogPostRevisionDataMapper.ts` | Append-only JSON snapshots already exist and should be reused conceptually |
| Repository wiring | `src/adapters/RepositoryFactory.ts` | Process-cached singleton access pattern is already established |
| Checkpoint-adjacent runtime fields | `job_requests.last_checkpoint_id` in migrations | The codebase already accepts checkpoint pointers on long-running async work |

## Phase 2 Exit Criteria

Phase 2 is complete only when all of the following are true:

1. A `FactoryRepository` interface exists in `src/core/use-cases/`.
2. A SQLite-backed adapter exists in `src/adapters/` and follows the repo's data-mapper style.
3. The DB schema for factory persistence is introduced through `src/lib/db/tables.ts` and additive migration helpers in `src/lib/db/migrations.ts`.
4. Phase 1 entities can be durably stored and rehydrated without losing invariants or JSON safety.
5. Runtime history is queryable without reconstructing everything from ad hoc JSON scans.
6. Checkpoint save and resume metadata are modeled explicitly.
7. Focused repository tests cover positive, negative, and edge cases.
8. No speculative graph package, generic node/edge framework, or dead abstraction layer is introduced.

## Core Design Decisions

### 1. Use dedicated factory tables, not a fake generic graph layer

Do not start Phase 2 by creating `graph_nodes`, `graph_edges`, or a `GraphFactoryRepository` unless a real shared graph subsystem first becomes canonical elsewhere in the repo.

The implementation should introduce factory-specific tables with clear ownership and query intent. If future graph projection is needed, it can be built from these durable records.

### 2. Keep domain entities orthogonal to persistence rows

Phase 1 entities remain the domain contract. Persistence rows are storage concerns.

- Domain entities stay in `src/core/entities/`
- Repository contract stays in `src/core/use-cases/`
- SQL and row mapping stay in `src/adapters/`
- DB DDL and indexes stay in `src/lib/db/`

Do not leak database row types into orchestrator or planner code.

### 3. Split current-state snapshots from append-only history

The clean repo-native pattern is:

- one mutable summary row for coarse aggregate state
- immutable snapshots for plan and output payloads
- append-only event rows for audit/history

This mirrors how the jobs system uses `job_requests` plus `job_events` rather than trying to infer all current state from a generic event store.

### 4. Prefer indexed scalar columns for real queries and JSON for full payloads

The codebase already stores rich payloads as JSON strings while also promoting query-critical fields into indexed columns.

Phase 2 should do the same:

- status, user ownership, stage key, timestamps, sequence numbers, and foreign keys get dedicated columns
- full validated entity payloads are stored in `*_json` columns
- repository rehydrates the domain entity from JSON after row selection

### 5. Preserve lineage without over-normalizing the first cut

Lineage is required. A generic edge framework is not.

Use explicit foreign keys and focused link tables where queryable relationships matter. Only add a generic relation table if a real many-to-many lineage need cannot be expressed cleanly with explicit tables.

### 6. Keep canonical domain IDs as the only cross-entity references

The factory persistence layer should not invent a second ID space for stored outputs.

- `StageResultRef.entityId` must refer to the domain entity id
- `Composition.embeddedAssetIds` and section `assetId` values must refer to `FactoryAsset.id`
- repository methods must return and accept canonical domain ids, not hidden storage row ids

This keeps Phase 1 entities, persistence, and future read models aligned.

### 7. Give stage runs a durable identity

Phase 2 should treat `StageRunRecord.id` as a required domain field.

Reason:

- checkpoints need to point to the precise stage run that triggered the pause
- event rows need a stable foreign key target
- output rows need to record which exact stage run produced them
- `workOrderId + stageKey` is not sufficient if stage run records ever need to be referenced across replans, snapshots, or migration boundaries

This is a narrow Phase 1 carry-forward amendment, not a broad model rewrite.

## Clean Implementation Rules

Phase 2 must obey these constraints:

- No ORM.
- No new persistence framework.
- No broad `graph/` package introduced only for factory.
- No duplicate lifecycle logic spread across repository and orchestrator.
- No silent coercion of invalid JSON or timestamps.
- No persistence-only enum copies if Phase 1 constants already exist.
- No writes of invalid entities; repository must validate before durable persistence boundaries.
- No hidden cross-aggregate mutation inside read methods.
- No "temporary" tables or columns that are not used by the implementation plan.

## Recommended Persistence Model

The first implementation should use dedicated factory tables that match the actual query surfaces we know we need.

### `factory_work_orders`

Purpose: coarse aggregate snapshot and entry point for most reads.

Recommended columns:

- `id TEXT PRIMARY KEY`
- `user_id TEXT DEFAULT NULL`
- `conversation_id TEXT DEFAULT NULL`
- `status TEXT NOT NULL`
- `current_dag_id TEXT DEFAULT NULL`
- `current_stage_key TEXT DEFAULT NULL`
- `active_checkpoint_id TEXT DEFAULT NULL`
- `created_at TEXT NOT NULL`
- `started_at TEXT DEFAULT NULL`
- `completed_at TEXT DEFAULT NULL`
- `paused_at TEXT DEFAULT NULL`
- `snapshot_json TEXT NOT NULL`

Indexes:

- `(user_id, status)`
- `(conversation_id, created_at)`
- `(status, created_at)`

Notes:

- `snapshot_json` stores the canonical `WorkOrder` entity.
- Scalar columns exist only for queryability and guardrails.

### `factory_work_order_parents`

Purpose: queryable multi-parent lineage for revisions and merges.

Recommended columns:

- `work_order_id TEXT NOT NULL`
- `parent_work_order_id TEXT NOT NULL`
- `ordinal INTEGER NOT NULL`
- `relationship_kind TEXT NOT NULL DEFAULT 'revision_parent'`

Indexes / constraints:

- `PRIMARY KEY (work_order_id, parent_work_order_id)`
- `UNIQUE(work_order_id, ordinal)`
- `(parent_work_order_id)`

Notes:

- This table is the queryable projection of `WorkOrder.previousWorkOrderIds`.
- Keep `previousWorkOrderIds` in `snapshot_json`, but do not force lineage queries to scan JSON.
- Multi-parent lineage is a first-class requirement, so a join table is the clean choice here.

### `factory_production_dags`

Purpose: immutable plan snapshots for each generated DAG version.

Recommended columns:

- `id TEXT PRIMARY KEY`
- `work_order_id TEXT NOT NULL`
- `dag_version INTEGER NOT NULL`
- `generated_at TEXT NOT NULL`
- `snapshot_json TEXT NOT NULL`

Indexes / constraints:

- `UNIQUE(work_order_id, dag_version)`
- `(work_order_id, generated_at DESC)`

Notes:

- Never mutate a stored DAG snapshot.
- `factory_work_orders.current_dag_id` points to the active DAG version.

### `factory_stage_runs`

Purpose: current snapshot of each stage execution for a work order.

Recommended columns:

- `id TEXT PRIMARY KEY`
- `work_order_id TEXT NOT NULL`
- `stage_key TEXT NOT NULL`
- `stage_kind TEXT NOT NULL`
- `status TEXT NOT NULL`
- `attempt_count INTEGER NOT NULL`
- `result_entity_kind TEXT DEFAULT NULL`
- `result_entity_id TEXT DEFAULT NULL`
- `error_json TEXT DEFAULT NULL`
- `started_at TEXT DEFAULT NULL`
- `completed_at TEXT DEFAULT NULL`
- `snapshot_json TEXT NOT NULL`

Indexes / constraints:

- `UNIQUE(work_order_id, stage_key)`
- `(work_order_id, status)`
- `(work_order_id, stage_key)`

Notes:

- This table stores the latest `StageRunRecord` snapshot for each stage, keyed by the durable `StageRunRecord.id`.
- Attempt history belongs in `factory_events`, not duplicate stage-run rows.
- `result_entity_kind` / `result_entity_id` should match the Phase 1 result reference contract.

### `factory_outputs`

Purpose: append-only durable storage for stage output entities.

Supported entity kinds in the first cut:

- `research_packet`
- `draft`
- `asset`
- `composition`
- `qa_report`
- `release`
- `outcome`

Recommended columns:

- `id TEXT PRIMARY KEY`
- `work_order_id TEXT NOT NULL`
- `stage_run_id TEXT DEFAULT NULL`
- `entity_kind TEXT NOT NULL`
- `supersedes_entity_id TEXT DEFAULT NULL`
- `created_at TEXT NOT NULL`
- `payload_json TEXT NOT NULL`

Indexes:

- `(work_order_id, entity_kind, created_at DESC)`
- `(stage_run_id)`
- `(supersedes_entity_id)`

Notes:

- `id` must equal the persisted domain entity id, not a surrogate storage row id.
- Do not overwrite prior artifacts during refinement or remediation.
- A refined asset, revised draft, or new QA report creates a new artifact row.
- `supersedes_entity_id` preserves a simple lineage chain between domain entities.

### `factory_composition_assets`

Purpose: queryable ordered composition membership.

Recommended columns:

- `composition_id TEXT NOT NULL`
- `asset_id TEXT NOT NULL`
- `ordinal INTEGER NOT NULL`

Indexes / constraints:

- `PRIMARY KEY (composition_id, asset_id)`
- `UNIQUE(composition_id, ordinal)`
- `(asset_id)`

Notes:

- Do not rely on JSON array scans for every composition membership query.
- Preserve asset order explicitly.
- Both ids are canonical domain ids, not storage-only row ids.

### `factory_checkpoints`

Purpose: immutable pause/resume snapshots.

Recommended columns:

- `id TEXT PRIMARY KEY`
- `work_order_id TEXT NOT NULL`
- `stage_run_id TEXT DEFAULT NULL`
- `resume_from_stage_key TEXT NOT NULL`
- `reason TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `consumed_at TEXT DEFAULT NULL`
- `snapshot_json TEXT NOT NULL`

Indexes:

- `(work_order_id, created_at DESC)`
- `(work_order_id, consumed_at)`

Notes:

- Checkpoints are append-only.
- Resume should mark the chosen checkpoint as consumed, not delete it.
- `factory_work_orders.active_checkpoint_id` points at the current unresolved checkpoint.

### `factory_events`

Purpose: append-only event stream for audit, debugging, retries, and lifecycle reconstruction.

Recommended columns:

- `id TEXT PRIMARY KEY`
- `work_order_id TEXT NOT NULL`
- `stage_run_id TEXT DEFAULT NULL`
- `sequence INTEGER NOT NULL`
- `event_type TEXT NOT NULL`
- `payload_json TEXT NOT NULL`
- `created_at TEXT NOT NULL`

Indexes / constraints:

- `UNIQUE(work_order_id, sequence)`
- `(work_order_id, created_at)`
- `(stage_run_id, created_at)`

Notes:

- This is where attempt start, attempt failure, checkpoint saved, resumed, remediation queued, and artifact superseded events live.
- Do not treat events as the only source of truth for current work order state.

## Repository Contract Shape

The repository contract should expose aggregate-meaningful operations, not low-level row CRUD.

Recommended file:

- `src/core/use-cases/FactoryRepository.ts`

Recommended adapter:

- `src/adapters/FactoryDataMapper.ts`

Recommended `RepositoryFactory` seam:

- add `getFactoryRepository()` in `src/adapters/RepositoryFactory.ts`

Representative contract shape:

```typescript
export interface FactoryRepository {
  createWorkOrder(workOrder: WorkOrder): Promise<WorkOrder>;
  updateWorkOrder(workOrder: WorkOrder): Promise<WorkOrder>;
  findWorkOrderById(id: string): Promise<WorkOrder | null>;
  listWorkOrdersByUser(
    userId: string,
    options?: { statuses?: WorkOrderStatus[]; limit?: number },
  ): Promise<WorkOrder[]>;

  saveProductionDAG(dag: ProductionDAG, options?: { version: number }): Promise<void>;
  findProductionDAGById(id: string): Promise<ProductionDAG | null>;
  findCurrentProductionDAGForWorkOrder(workOrderId: string): Promise<ProductionDAG | null>;

  replaceWorkOrderParents(workOrderId: string, parentIds: readonly string[]): Promise<void>;
  listParentWorkOrderIds(workOrderId: string): Promise<string[]>;

  upsertStageRun(stageRun: StageRunRecord): Promise<StageRunRecord>;
  listStageRunsForWorkOrder(workOrderId: string): Promise<StageRunRecord[]>;

  appendOutput(
    input:
      | { entityKind: "research_packet"; entity: ResearchPacket; workOrderId: string; stageRunId?: string; supersedesArtifactId?: string }
      | { entityKind: "draft"; entity: Draft; workOrderId: string; stageRunId?: string; supersedesArtifactId?: string }
      | { entityKind: "asset"; entity: FactoryAsset; workOrderId: string; stageRunId?: string; supersedesEntityId?: string }
      | { entityKind: "composition"; entity: Composition; workOrderId: string; stageRunId?: string; supersedesArtifactId?: string }
      | { entityKind: "qa_report"; entity: QAReport; workOrderId: string; stageRunId?: string; supersedesArtifactId?: string }
      | { entityKind: "release"; entity: Release; workOrderId: string; stageRunId?: string; supersedesArtifactId?: string }
      | { entityKind: "outcome"; entity: Outcome; workOrderId: string; stageRunId?: string; supersedesArtifactId?: string },
  ): Promise<{ entityId: string }>;

  listOutputsForWorkOrder(
    workOrderId: string,
    entityKind?: string,
  ): Promise<Array<{ entityId: string; entityKind: string; payload: unknown }>>;

  createCheckpoint(checkpoint: WorkOrderPauseState, input: {
    checkpointId: string;
    workOrderId: string;
    stageRunId?: string;
    resumeFromStageKey: string;
    createdAt: string;
  }): Promise<void>;
  findLatestActiveCheckpoint(workOrderId: string): Promise<null | {
    checkpointId: string;
    pauseState: WorkOrderPauseState;
    resumeFromStageKey: string;
    createdAt: string;
  }>;
  markCheckpointConsumed(checkpointId: string, consumedAt: string): Promise<void>;

  appendEvent(input: {
    workOrderId: string;
    stageRunId?: string;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }): Promise<void>;
}
```

Contract rules:

- Repository validates domain entities before write.
- Repository throws on cross-work-order relationship mismatches.
- Repository returns hydrated domain entities, not row objects.
- Repository owns JSON serialization and parse boundaries.
- Repository uses canonical domain ids as durable references; it must not expose storage-only surrogate ids.

## Query Patterns Phase 2 Must Support

These are the minimum query paths the first implementation must make efficient and explicit:

1. Load a work order by id and rehydrate its current snapshot.
2. List work orders for a user by status, newest first.
3. Load the current DAG for a work order.
4. List stage runs for a work order in DAG order or stable stage-key order.
5. Resolve the latest stage result reference to its artifact payload.
6. Load the latest active checkpoint for a paused work order.
7. Load a composition and its ordered assets without scanning all artifact JSON blobs.
8. Walk multi-parent work order lineage through `factory_work_order_parents`.
9. Read append-only event history for one work order for debugging and audit.

## Write Patterns Phase 2 Must Enforce

### Work order lifecycle

- Create a work order row with the canonical `WorkOrder` snapshot.
- Update the work order snapshot when coarse status changes.
- Keep lifecycle timestamps in sync with the validated domain entity.

### DAG persistence

- Store each DAG version immutably.
- Move the current pointer on the work order instead of mutating a DAG row.

### Stage execution persistence

- Upsert the current `StageRunRecord` snapshot for the stage.
- Append lifecycle events for attempt start, retry scheduled, failed, succeeded, paused.
- Do not create duplicate active stage rows for the same `workOrderId + stageKey`.

### Artifact persistence

- Persist each output entity as a new output row using the domain entity id as the row primary key.
- Link stage results to the output entity they produced.
- Use `supersedes_entity_id` when remediation/refinement replaces a prior output.

### Lineage persistence

- Persist `WorkOrder.previousWorkOrderIds` into `factory_work_order_parents`.
- Preserve the array order using `ordinal`.
- Do not collapse multi-parent lineage down to a single direct parent column.

### Checkpoint persistence

- Save a checkpoint snapshot when the work order pauses.
- Mark old checkpoint consumed on resume.
- Never delete checkpoints as part of normal resume flow.

## Positive, Negative, and Edge Cases

### Positive cases

- Persist and reload a `WorkOrder` whose `current_dag_id` points to an immutable DAG snapshot.
- Persist and reload a `WorkOrder` with more than one parent work order in lineage.
- Persist stage run snapshots for research, draft, asset generation, composition, QA, release.
- Persist a `Composition` plus ordered asset membership and rehydrate in the same order.
- Persist a checkpoint and later resolve the latest active checkpoint for resume.
- Persist a refined asset as a superseding artifact without losing the prior asset record.
- List user-scoped work orders by status using indexed scalar columns rather than full JSON scans.

### Negative cases

- Reject writes when the entity fails Phase 1 validation.
- Reject stage run writes where `result_entity_kind` does not match the referenced output entity kind.
- Reject artifact inserts whose `work_order_id` disagrees with the referenced stage run.
- Reject duplicate DAG version for the same work order.
- Reject duplicate event sequence for the same work order.
- Reject checkpoint consume requests for nonexistent or already consumed checkpoints.
- Reject duplicate lineage parent links or duplicate lineage ordinals for the same work order.
- Reject composition asset link inserts that refer to assets outside the composition's work order.
- Reject unauthorized user-scoped reads that would leak another user's work order.

### Edge cases

- Anonymous work orders that later become associated with a signed-in user.
- Work orders synthesized from more than one prior revision branch.
- Work orders with multiple DAG versions after replanning.
- Retry of a transiently failed stage where the stage snapshot changes but prior event history remains intact.
- Pause requested after a stage succeeded but before the next stage starts.
- Resume after a refined asset supersedes a prior artifact while downstream composition still points to the old one.
- RepositoryFactory singleton invalidation when tests swap DB handles.
- Empty optional outputs: work order exists before any stage artifacts exist.
- Large JSON payloads that remain valid and queryable through promoted columns.

## Test Plan

The implementation is not ready without focused repository tests.

Recommended test file:

- `src/adapters/FactoryDataMapper.test.ts`

Recommended test style:

- in-memory `better-sqlite3`
- call `createTables(db)` and relevant migrations
- seed only the minimal user / conversation rows required by foreign keys
- assert both scalar columns and hydrated entity output

Minimum test coverage:

1. create + reload work order snapshot
2. save immutable DAG versions and resolve current DAG
3. upsert stage run and preserve stage uniqueness per work order
4. append artifact and reload typed payload
5. persist composition asset ordering
6. create, fetch, and consume checkpoint
7. append ordered event stream with uniqueness guarantees
8. reject invalid entity payloads and cross-work-order mismatches
9. list work orders by user with status filter
10. preserve multi-parent lineage through `factory_work_order_parents`
11. preserve output lineage through `supersedes_entity_id`

## Implementation Sequence

1. Add factory table DDL to `src/lib/db/tables.ts`.
2. Add additive migration guards and indexes to `src/lib/db/migrations.ts` only where needed for existing DBs.
3. Create `src/core/use-cases/FactoryRepository.ts`.
4. Implement `src/adapters/FactoryDataMapper.ts`.
5. Wire `getFactoryRepository()` into `src/adapters/RepositoryFactory.ts`.
6. Add focused repository tests.
7. Only then start Phase 3 orchestration work against the repository seam.

## Anti-Goals

Phase 2 should explicitly avoid:

- building planner or orchestrator logic
- adding UI or API routes
- inventing a general graph framework that nothing else uses
- deriving current runtime state only from events
- storing only opaque JSON with no indexed query columns
- deleting history rows during normal remediation or resume flows

## Deliverable

Phase 2 should end with a factory persistence slice that is boring, explicit, and durable:

- factory-specific SQLite tables
- a single repository contract
- a single SQLite data mapper
- focused migration changes
- focused tests

That is the cleanest path to Phase 3 orchestration without dead code, speculative abstractions, or persistence drift.
