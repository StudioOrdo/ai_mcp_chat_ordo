# Phase 09: Workflow Template Versioning And Run Inspector

Status: Planned

Related specs:

- `../specs/09-workflow-templates-runs-and-editing.md`

## Goal

Make successful workflows reusable, versioned, editable, and inspectable.

## Current Code To Research

- `src/core/entities/operation.ts`
- `src/core/use-cases/operations/*`
- `src/components/operations/*`
- `src/app/operations/**`
- `src/lib/media/workflows/*`
- `src/lib/factory/*operation*`

## Required Work

- Define workflow template/version/run contracts.
- Link content campaign operations to workflow versions.
- Add run inspector projection.
- Add LLM-assisted workflow change proposal operation.

## Tests

Positive:

- copy workflow creates separate template.
- editing creates new version.
- run inspector points to exact version.

Negative:

- active run cannot be mutated by template edit.
- LLM proposal cannot apply without user action.

Edge:

- failed run copied into new template.
- disabled capability blocks future run.

## Cleanup

- Keep operation as source of execution truth.
- Avoid exposing media/factory internals as the generic run model.

## Exit Criteria

- User can save, inspect, copy, and revise the flagship workflow.

