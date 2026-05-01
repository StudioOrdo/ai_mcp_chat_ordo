# Stage 07 - Projection And Read Model Package

## Goal

Create a disciplined place for performance and view-specific state.

## Build

- Group current `_review` notes into projection families.
- Define rebuild and invalidation rules.
- Add work-order summary projection if needed.
- Add artifact index projection if needed.
- Add search index projection for FTS/vector modernization.
- Add admin stats projection only after measuring need.

## Done

- Projections have source write models and consistency tests.
- UI views stop doing expensive reconstruction when a stable read model exists.

## Guardrails

- Do not add trigger-maintained tables without a rebuild path.
- Do not optimize speculative dashboards before core workflows exist.
