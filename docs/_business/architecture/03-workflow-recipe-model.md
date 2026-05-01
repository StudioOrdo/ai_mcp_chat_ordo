# Workflow And Recipe Model

This model defines recipe as the contract for complex factory workflows.

It does not replace the primary operator interface, which is the continuous
conversation thread.

## Recipe

A recipe is a reusable workflow definition for high-structure work such as
scrollytelling production, development delivery loops, and business process
pipelines.

Current status: planned contract over existing systems.

A recipe defines:

- start inputs
- stage semantics and dependency policy
- capability classes and source policies
- artifact contracts
- QA gates
- revision and release policies
- projection requirements

Rule: recipes are configuration plus code contracts, not prompt text.

## Work Order

A work order is one durable run of workflow work.

Current status: implemented with upgrade path.

Current work orders already capture durable execution state and can host recipe
mapping incrementally.

Upgrade direction:

- add recipe id and version mapping
- preserve existing stage-run and event history
- keep compatibility with current job and timeline projections

## Stage Types

Stage semantics should stay expressive at the recipe level while persistence
stays conservative.

Do not expand persisted enums until execution behavior, validation, and
projections require it.

## Capability Selection

Recipes should target capability classes, not hardcoded tool names.

The capability catalog remains the execution compiler:

- intent or stage need
- capability match
- runtime route selection

Until recipe capability classes are formalized, document capability needs in
plain language and map them explicitly during implementation.

## Stage Output Rule

Every stage writes durable state:

- artifact
- event
- QA record
- or explicit pause/exception record

No important workflow state may live only in transient prompts or UI memory.

## Interface Rule

Operators should never manage recipe internals directly.

They issue intent in conversation. The system projects recipe progress as status,
evidence, outputs, and next actions back into the same thread.
