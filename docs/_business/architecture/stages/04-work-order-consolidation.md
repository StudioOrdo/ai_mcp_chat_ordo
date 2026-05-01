# Stage 04 - Work Order Consolidation

## Goal

Make work orders the durable execution backbone.

## Build

- Decide how `Recipe` maps onto existing `ProductBrief`, `ProductionDAG`, and
  `WorkOrder`.
- Decide how jobs wrap work orders as execution envelopes.
- Add or document work-order summary projections for lists.
- Preserve stage run records as runtime truth.
- Preserve checkpoints and revision loops.

## Done

- New workflows do not invent private lifecycle engines.
- Blog, scrollytelling, development, and business process work can all point to
  the same execution vocabulary.

## Guardrails

- Do not mutate DAG plan nodes to store runtime truth.
- Do not store important state only in job events.
- Do not duplicate work order hydration logic in UI routes.
