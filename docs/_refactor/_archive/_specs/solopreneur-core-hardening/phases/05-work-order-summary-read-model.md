# Phase 05 - Work Order Summary Read Model

## Objective
Split factory work-order list reads from full aggregate hydration so list UI and admin/operator surfaces stay fast as factory usage grows.

## Current Code Grounding
- `src/adapters/FactoryDataMapper.ts#listWorkOrdersByUser` returns full `WorkOrder[]`.
- `hydrateWorkOrderRow` loads parents, current DAG, stage runs, and active checkpoint per row.
- `factory_work_orders` already stores hot status/current-stage/checkpoint/timestamp columns plus `snapshot_json`.

## Architecture
- CQRS read split: `WorkOrderSummary` for list/read surfaces; full `WorkOrder` for detail/action/orchestration.
- Projection columns: keep hot list fields on `factory_work_orders` or a normalized summary projection.
- Repository segregation: list methods return summaries; detail methods hydrate aggregates.

## Implementation Steps
1. Add `WorkOrderSummary` entity/DTO and repository port method.
2. Implement `listWorkOrderSummariesByUser` using indexed row columns and bounded summary data.
3. Update list UI/loaders to consume summaries instead of full `WorkOrder[]`.
4. Keep full hydration for `findWorkOrderById`, orchestration, pause/resume, and detail pages.
5. Add guardrail tests that list paths do not call full hydration.

## Cleanup
- Do not add an opaque `hydration_summary_json` blob as the first solution.
- Remove UI/list dependencies on full aggregate fields they do not render.
- Keep factory mutation paths strict around full aggregate validation.

## Tests
- Positive: list summaries include status, current stage, checkpoint marker, progress counts, and timestamps.
- Positive: detail lookup still hydrates the full aggregate.
- Negative: list path does not query parents/stage runs/checkpoints once per row.
- Edge: paused work order without active checkpoint renders coherent summary.
- Edge: work order with missing current DAG falls back predictably.

## Done Criteria
- Factory list surfaces use summary read models.
- Full hydration is reserved for detail and mutation paths.
- Factory repository and UI tests remain green.
