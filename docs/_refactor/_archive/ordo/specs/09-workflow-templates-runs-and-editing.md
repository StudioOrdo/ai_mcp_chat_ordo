# Spec 09: Workflow Templates, Runs, And Editing

## Goal

Make repeated processes first-class, inspectable, versioned, editable artifacts.

## Current Code To Use

- `src/core/entities/operation.ts` and `src/core/use-cases/operations/*`
  provide durable execution truth.
- `src/lib/media/workflows/types.ts` has feature-specific workflow snapshots.
- `src/lib/factory/production-orchestrator.ts` has staged work order execution.
- `src/lib/db/tables.ts` has operations, operation steps, media workflows,
  factory work orders, jobs, and artifacts.
- `src/components/operations/*` and `src/app/operations/**` expose operation
  run state.

## Required Work

- Define `WorkflowTemplate`, `WorkflowVersion`, and `WorkflowRun`.
- Version templates immutably.
- Let operation runs point to workflow version where applicable.
- Add run inspector that shows:
  - steps,
  - status,
  - inputs,
  - outputs,
  - reviews,
  - artifacts,
  - actions,
  - metrics.
- Add conversation operation for "review this workflow and propose changes."

## Cleanup After Replacement

- Avoid letting media and factory workflow tables become user-facing concepts
  when generic workflow run is the product concept.

## Positive Tests

- Copy workflow creates new template/version without mutating old runs.
- Editing a workflow creates a new version.
- Run inspector shows the exact version used.

## Negative Tests

- Running operation cannot be mutated by editing its template.
- User cannot apply LLM-proposed workflow changes without explicit action.
- Invalid step dependency graph is rejected.

## Edge Tests

- Workflow version is deleted/hidden after runs exist: run remains inspectable.
- Failed run can be copied into a revised template.
- Workflow with disabled capability is blocked with reason.

