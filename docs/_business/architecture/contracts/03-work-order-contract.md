# Work Order Contract

## Purpose

A work order is one durable run of workflow work.

## Source Of Truth Owner

Factory/workflow repository layer.

## Current Status

`partial`

## Current Anchors

- `src/core/entities/work-order.ts`
- `src/core/use-cases/FactoryRepository.ts`
- `src/adapters/FactoryDataMapper.ts`

## Required Contract

A work order must record:

- work order id
- schema version
- recipe id and version after recipes exist
- owner and visibility
- start input ref
- status
- current stage key
- stage runs
- artifact index or output refs
- QA state
- release state
- revision number
- parent or previous work order ids
- pause/checkpoint state
- execution events
- user id and conversation id when applicable
- created, started, completed, and updated timestamps

## Current Implementation Coverage

Current work orders already record:

- id
- schema version
- brief id
- status
- current DAG
- stage runs
- execution log
- revision
- previous work order ids
- pause state
- created, started, and completed timestamps
- user id
- conversation id
- initiation reason

## Contract Additions

The platform contract still needs:

- recipe id and recipe version
- resolved recipe snapshot metadata
- owner and visibility semantics beyond `userId`
- generic start input ref
- generic artifact index or output refs
- QA gate summary
- release state summary
- updated timestamp

## Lifecycle

- `planned`
- `running`
- `paused`
- `succeeded`
- `failed`
- `canceled`

## Event And Projection Expectations

- Work-order status changes should append durable events.
- Stage-run changes should be projectable into a work-order timeline.
- Blocking QA reports and pause/checkpoint state should be projectable as next
  actions.
- Work-order projections should link to artifact, evidence, QA, and release
  refs without embedding all payloads.

## Boundaries

Work orders record run state. They should reference artifacts, releases, QA
reports, evidence, and events rather than absorbing all payloads.

## Must Not Absorb

- recipe definition
- capability catalog metadata
- raw connector implementation details
- all artifact payloads
- projection-only display state

## Migration Notes

Current work orders already record `briefId`, `currentDag`, `stageRuns`,
`executionLog`, revision, parent ids, pause state, user id, conversation id, and
initiation reason.

Missing platform fields:

- recipe id
- recipe version
- resolved recipe snapshot metadata
- visibility
- generic start input ref
- generic artifact index
- release state summary
- QA gate summary
- updated timestamp

## Positive Cases

- A scrollytelling run has one work order with stage runs and artifact refs.
- A failed QA gate pauses the work order and records the blocking report.
- A revised draft creates new artifact refs without erasing prior refs.

## Negative Cases

- A work order should not be created just to display a dashboard card.
- A work order should not store recipe stage definitions inline as the only
  source of truth after recipe contracts exist.
- A work order should not hide stage failures inside unstructured logs.

## Edge Cases

- A work order can be paused with no failed stage when it needs human approval.
- A work order can have skipped stages when recipe policy allows optional work.
- A work order can create a child revision rather than mutating a completed run.
- A work order can be conversation-linked or user-owned without a conversation.
