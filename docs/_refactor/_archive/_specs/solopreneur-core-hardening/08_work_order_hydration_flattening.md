# Work Order Read Model Flattening

## Status
- **Disposition**: Keep, rewritten.
- **Priority**: Medium to High if factory work-order lists become active product UI.
- **Layer**: Persistence / Factory.
- **Reviewed**: 2026-05-01.

## Current Code Grounding
- `src/adapters/FactoryDataMapper.ts#listWorkOrdersByUser` selects rows from `factory_work_orders` and then calls `hydrateWorkOrderRow` for each row.
- `hydrateWorkOrderRow` loads parents, current DAG, stage runs, and active checkpoint data per row.
- `factory_work_orders` already stores `status`, `current_dag_id`, `current_stage_key`, `active_checkpoint_id`, timestamps, and `snapshot_json`.
- The current implementation is correct for detail hydration but too heavy for list surfaces.

## Verdict
The old finding was valid about the list hydration shape, but the proposed `hydration_summary_json` blob is not the best greenfield solution. The better design is to split list/read-summary DTOs from full work-order entities and only hydrate the full aggregate on detail/action paths.

## Target Architecture
- Add a `WorkOrderSummary` read model/port separate from `WorkOrder`.
- Implement `listWorkOrderSummariesByUser(...)` with a single indexed query against `factory_work_orders` plus bounded joins/counts if needed.
- Store explicit summary columns on `factory_work_orders` when they are hot:
  - `stage_total`
  - `stage_completed`
  - `stage_failed`
  - `current_stage_key`
  - `active_checkpoint_id`
  - `latest_event_at`
- Keep full `hydrateWorkOrderRow` for detail pages, orchestration, and mutation use cases.
- If richer summary data is needed, use a normalized projection table rather than one opaque `hydration_summary_json` blob.

## Greenfield Cutoff
- Break UI loaders that request full `WorkOrder[]` for list cards.
- List UI must depend on `WorkOrderSummary[]`; detail UI can fetch a full `WorkOrder`.

## Required Tests
- Positive: list summary query returns status, stage progress, active checkpoint, and timestamps without calling full hydration helpers.
- Positive: detail lookup still hydrates the full aggregate.
- Negative: list path must not query parents/stage runs/checkpoints once per row.
- Edge: paused work order without an active checkpoint shows a coherent summary.
- Edge: work order with no persisted DAG still returns a valid summary from row/snapshot fallback.
