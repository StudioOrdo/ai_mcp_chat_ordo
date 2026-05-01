# Projection Contract

## Purpose

A projection is a view over durable state.

## Source Of Truth Owner

Projection package or feature-specific projector.

## Current Status

`exists`

## Current Anchors

- `src/core/platform/execution/ExecutionTimeline.ts`
- `src/core/platform/execution/ExecutionTimelineProjector.ts`
- `src/core/platform/business-workflow/BusinessWorkflowContextProjector.ts`
- `src/core/entities/business-workflow-context.ts`

## Required Contract

A projection must define:

- projection id or type
- source refs
- source owner or visibility scope
- read shape
- freshness expectations
- materialization strategy
- invalidation strategy when materialized
- access policy
- empty state behavior
- error/support level behavior

## Current Implementation Coverage

Current projection patterns include:

- execution timelines
- execution timeline projectors
- execution timeline readers
- business workflow context projectors
- business workflow context records

## Contract Additions

The platform still needs a shared projection registration pattern for recipe,
artifact, QA, release, roadmap, and public process views.

## Lifecycle

- `live`: computed on read
- `materialized`: stored for speed, indexing, or joins
- `stale`: known out of date
- `unsupported`: source cannot be projected

## Event And Projection Expectations

- Projections should state whether they are live, materialized, stale, or
  unsupported.
- Materialized projections should define invalidation and rebuild expectations.
- Projection readers should expose support-level behavior when a source cannot
  be projected.
- Projection writeback is forbidden unless the projection contract explicitly
  maps a command to source-of-record state.

## Boundaries

Projections make state usable. They are not the canonical state unless the
contract explicitly says the projection is materialized as a read model.

## Must Not Absorb

- source-of-record workflow state
- artifact payloads when refs are enough
- permission truth
- recipe definition
- prompt instructions

## Migration Notes

The execution timeline and business workflow context are good projection
patterns. The architecture should reuse this style for kanban boards, public
roadmaps, artifact indexes, dashboards, and published process views.

## Positive Cases

- A work order timeline projects stage runs, events, artifacts, checkpoints, and
  next actions.
- A business process view projects lead, consultation, deal, training, referral,
  and notification state.
- A public roadmap projects approved development items and funding priority.

## Negative Cases

- A projection should not be mutated as the only way to update source state.
- A projection should not bypass permissions from source records.
- A projection should not invent missing evidence.

## Edge Cases

- A projection can degrade when some source systems are unsupported.
- A projection can be materialized for search or admin speed.
- A projection can summarize private evidence without exposing raw private data.
- A projection can combine several source records into one view.
