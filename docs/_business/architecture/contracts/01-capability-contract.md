# Capability Contract

## Purpose

A capability is something Ordo can do through a governed interface.

## Source Of Truth Owner

Capability catalog.

## Current Status

`exists`

## Current Anchors

- `src/core/capability-catalog/`
- `src/core/platform/capability-runtime/`
- `src/core/platform/execution/`
- `mcp/operations-server.ts`

## Required Contract

A capability must define:

- stable capability id
- human label and description
- capability class or classes
- role access
- input schema
- output shape or artifact contract
- execution mode
- execution target
- cost and rate policy when relevant
- presentation metadata
- prompt hint metadata when relevant
- provenance behavior
- MCP/browser/job exposure rules when relevant

## Current Implementation Coverage

Current capability definitions already cover:

- stable tool/capability name
- label and description
- category
- role access
- input schema and output hint
- presentation family and card kind
- execution mode and execution surface
- prompt hints
- MCP export intent
- browser/job exposure
- executor and validation bindings
- local execution targets

## Contract Additions

The platform contract still needs:

- recipe-facing capability class or classes
- source policy compatibility
- artifact contract compatibility
- evidence/provenance requirements
- cost and rate policy when relevant
- explicit lifecycle state if capabilities become installable or mutable

## Lifecycle

- `draft`: defined but not generally available
- `active`: selectable by recipes or users
- `deprecated`: kept for old records but not selected for new work
- `disabled`: unavailable for execution

## Event And Projection Expectations

- Capability changes should be projectable into admin capability views.
- Capability execution should remain visible through job, tool, or work-order
  timelines.
- Capability selection by a recipe or stage should be visible in provenance.
- Deprecated or disabled capabilities should remain readable for old work-order
  history.

## Boundaries

Capabilities own execution affordances and schemas. They do not own workflow
order, approval gates, release policy, or business process state.

## Must Not Absorb

- recipe definitions
- work order state
- stage run attempts
- UI card state
- connector-specific secrets
- prompt-only workflow instructions

## Migration Notes

The current catalog already owns most required fields. Stage 05 should add the
recipe-facing contract additions:

- capability class
- source policy compatibility
- artifact contract compatibility
- evidence/provenance requirements

## Positive Cases

- A web search capability can be used by research recipes without hardcoding one
  provider into the recipe.
- A chart generation capability can expose the same schema to chat, jobs, and
  recipe execution.
- A browser or MCP implementation can be swapped while the capability class
  remains stable.

## Negative Cases

- A capability named after one website should not become the recipe contract for
  all research.
- A capability should not decide whether a release is approved.
- A capability should not store the full work order state.

## Edge Cases

- One capability can satisfy multiple capability classes.
- One capability can have multiple execution targets.
- A capability can be visible in admin but not selectable by a recipe.
- A capability can produce no artifact if the correct result is an error or QA
  finding.
