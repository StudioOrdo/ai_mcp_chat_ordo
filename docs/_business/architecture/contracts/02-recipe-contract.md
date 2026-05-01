# Recipe Contract

## Purpose

A recipe is a reusable workflow definition.

## Source Of Truth Owner

Future recipe registry.

## Current Status

`new concept`

## Current Anchors

- none as `Recipe`
- related: `src/core/entities/product-brief.ts`
- related: `src/core/entities/production-dag.ts`
- related: `src/core/entities/work-order.ts`
- related: `src/lib/blog/blog-article-production-service.ts`

## Required Contract

A recipe must define:

- recipe id
- recipe version
- label and description
- lifecycle state
- start input contract
- allowed stage definitions
- stage dependency policy
- capability requirements by class
- artifact contracts
- evidence requirements
- QA gates
- revision policy
- release policy
- projection registrations
- governance defaults

## Current Implementation Coverage

Current code does not have a `Recipe` contract. Related coverage exists through:

- `ProductBrief` for some start-input shape
- `ProductionDAG` for a generated stage graph
- `WorkOrder` for durable run state
- blog/journal production for a content workflow outside factory work orders

## Contract Additions

The platform needs a recipe registry contract that can produce a resolved run
snapshot for each work order.

## Resolved Run Snapshot Rule

A work order must preserve the resolved recipe version used for that run.

At minimum, the run should retain:

- recipe id
- recipe version
- resolved stage graph or DAG snapshot
- resolved capability requirements
- resolved QA gates
- resolved revision and release policy

This protects old work orders from changing when a recipe is edited or replaced.

## Lifecycle

- `draft`: available for development and tests
- `active`: available for new work orders
- `deprecated`: available only for old work orders
- `retired`: unavailable except for history and replay

## Event And Projection Expectations

- Recipe publication, deprecation, and retirement should be auditable.
- Recipe versions should be projectable into admin recipe views.
- Work-order timelines should show the recipe id and version used for the run.
- Public or user-facing projections may show recipe labels, but should not expose
  private governance or prompt configuration.

## Boundaries

Recipes define what should happen. Work orders record what did happen.

## Must Not Absorb

- stage run attempts
- artifact payloads
- QA findings generated during one run
- job queue mechanics
- connector implementation details
- prompt text as the only workflow definition

## Migration Notes

Recipe should be introduced over existing factory concepts:

- `ProductBrief` maps to start input.
- `ProductionDAG` maps to stage dependency policy.
- `WorkOrder` maps to one execution run.
- Blog production maps to a proof content recipe.
- `WorkOrder.currentDag` is the current pattern to preserve a resolved execution
  graph and should inform the run snapshot design.

Do not build a new execution engine before proving that current work orders,
jobs, and timelines cannot carry the recipe run.

## Positive Cases

- Scrollytelling production defines research, organization, drafting,
  multimedia, QA, publishing, and derivative stages.
- Ordo development defines report intake, QA, spec, implementation,
  verification, release notes, and public update stages.
- QR funnel follow-up defines lead capture, triage, consult, offer, delivery,
  and feedback stages.

## Negative Cases

- A prompt template is not a recipe.
- A single connector chain is not a recipe.
- A UI board layout is not a recipe.
- A recipe should not be changed to fix one work order run.

## Edge Cases

- A recipe can require manual approval even when automated QA passes.
- A recipe can allow optional derivative stages after release.
- A recipe version can remain active for old work orders while a new version is
  used for new work.
- A recipe can require different capabilities depending on input scope.
