# Stage Run Contract

## Purpose

A stage run is one executed attempt or completed execution record inside a work
order stage.

## Source Of Truth Owner

Work order repository layer.

## Current Status

`exists`

## Current Anchors

- `src/core/entities/stage-run-record.ts`
- `src/core/entities/production-stage.ts`
- `src/core/entities/factory-constants.ts`

## Required Contract

A stage run must record:

- stage run id
- work order id
- stage key
- stage semantic or kind
- status
- attempt count
- started and completed timestamps
- input refs when relevant
- result refs when relevant
- QA refs when relevant
- evidence refs when relevant
- selected capability ids when relevant
- error code and message when failed

## Current Implementation Coverage

Current `StageRunRecord` already records:

- stage run id
- stage key
- status
- started and completed timestamps
- result ref
- error code and message
- attempt count

## Contract Additions

The platform contract still needs, where relevant:

- direct work order id in storage or projection inputs
- stage semantic or kind distinct from stage key
- input refs
- QA refs
- evidence refs
- selected capability ids

## Lifecycle

- `pending`
- `running`
- `succeeded`
- `failed`
- `skipped`
- `paused`
- `canceled`

## Event And Projection Expectations

- Stage start, success, failure, skip, pause, and cancel should be projectable
  into the work-order timeline.
- A stage run should expose result refs for artifact, QA, release, or outcome
  projections.
- Failed stage runs should expose error information without requiring log
  scraping.
- Retried stage runs should preserve attempt history or enough event history to
  explain the retry.

## Boundaries

Stage runs record execution state. They do not define recipe stage policy.

## Must Not Absorb

- recipe stage definition
- work order lifecycle summary
- full artifact payloads
- capability catalog metadata
- UI progress card state

## Migration Notes

The existing `StageRunRecord` is a good base. Future implementation should add
only the fields needed for generic recipes:

- work order id if the storage shape needs it directly
- selected capability ids
- input refs
- evidence refs
- QA refs

## Positive Cases

- A research stage run records the research packet output ref.
- A QA stage run records the QA report output ref.
- A failed generation stage records an error code and attempt count.

## Negative Cases

- A stage run should not rewrite the recipe.
- A skipped stage should not look like a succeeded stage.
- A failed stage should not hide its error in a free-form progress message only.

## Edge Cases

- A stage can produce only an event or QA report.
- A stage can pause for human approval without producing a final artifact.
- A stage can be retried and preserve prior failed attempts.
- A stage can run in parallel with another stage when dependencies allow it.
