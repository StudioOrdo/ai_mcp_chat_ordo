# Target Architecture

## Objective

Define the greenfield target architecture for a unified capability platform
that simplifies how the system exposes knowledge, execution, revision, and
product affordances to both users and agents.

## Target State

The target state is a platform with four canonical surfaces:

1. `CapabilityRuntime`
   - what the system can do
   - how a capability is validated, authorized, presented, and executed

2. `KnowledgeAccess`
   - how the system retrieves, grounds, and cites knowledge
   - distinct from navigation and entity search

3. `ExecutionTimeline`
   - what happened during an execution
   - unified across tools, jobs, chat runtime, and factory work orders

4. `RevisionControl`
   - how paused, failed, or in-progress work is inspected, retried, resumed,
     or refined

Everything else should be a projection, adapter, or UI-specific presentation of
those four surfaces.

## Proposed Platform Model

### Layer 1: Canonical Metadata

The capability catalog should remain the single source of truth.

It should define:

- name and family
- input contract
- output contract
- RBAC policy
- presentation metadata
- execution-target policy
- revision behavior
- grounding requirements

The rule is simple:

If a property can be derived from the catalog, it should not be re-registered
manually elsewhere.

### Layer 2: Canonical Runtime Projection

Introduce a single projection model, for example `CapabilityRuntime`, that is
derived from the catalog and consumed by all runtime surfaces.

Suggested responsibilities:

- input parsing and validation
- execution-target planning
- descriptor projection for tool usage
- browser and MCP export projection
- user-facing capability summaries

This replaces the current pattern where several layers partly restate the same
capability.

### Layer 3: Agent Facade

Introduce a stable agent-facing facade with a very small API surface:

- `discoverCapabilities()`
- `searchKnowledge()`
- `executeCapability()`
- `inspectExecution()`
- `reviseExecution()`

This facade is not a new monolith. It is a platform boundary that hides the
internal subsystem layout from agents.

Its purpose is to make the system easier to use, not to own all business logic.

### Layer 4: Execution Substrate

Execution targets remain pluggable, but planning and dispatch should feel like
one coherent concern.

Supported target classes can remain:

- host TypeScript
- browser WASM
- deferred job
- MCP stdio
- containerized MCP
- native process
- remote service

But the platform should own a single `ExecutionPlanner` concept that decides:

- whether a capability is runnable
- where it should run
- why it is blocked
- what fallback exists

The planner should return an explainable plan, not just a selected target.

### Layer 5: Execution Timeline

Introduce a canonical execution timeline projection.

It should be able to ingest events from:

- tool execution
- deferred jobs
- factory work orders
- chat runtime stages
- observability logs when relevant

The goal is not to replace all current storage models immediately. The goal is
to expose one queryable and renderable timeline surface.

This becomes the default way to answer:

- what ran
- what is running now
- what failed
- what artifacts were produced
- what can be revised or retried

## Knowledge Model

The knowledge layer should be split into two platform services.

### `KnowledgeAccessService`

Purpose:

- grounded retrieval
- citations and canonical references
- section prefetch and evidence packaging
- relevance and coverage reasoning

This service should own:

- corpus retrieval
- chunk ranking and fusion
- citation-ready result shaping
- optional prefetch behavior

### `DiscoverySearchService`

Purpose:

- route search
- admin entity search
- product discovery search
- shell navigation support

This service should not be the default grounding mechanism for agents.

Reason:

Users and agents need different search affordances. Mixing them makes both less
predictable.

## Revision Model

The platform should treat revision as a general capability, not as a factory-only
special case.

Factory revision remains the most advanced implementation and should stay the
reference pattern. The generalized platform contract should include:

- inspect current execution
- pause if supported
- retry from failure if supported
- resume from checkpoint if supported
- refine outputs if supported

That does not mean every subsystem must support all revision operations. It
means the platform should present one revision vocabulary.

## Recommended Design Patterns

### Facade

Use a facade for the agent surface.

Why:

- hides subsystem-specific complexity
- improves ergonomics for agents and operators
- reduces coupling to internal runtime organization

### Strategy

Use strategy for execution targets.

Why:

- the system already runs across multiple targets
- target-specific behavior should remain isolated
- planners can choose between strategies without leaking implementation detail

### Projection

Use projection aggressively from canonical metadata.

Why:

- avoids repeated manual registration
- allows one source of truth to power runtime, UI, browser, and agent views

### Specification

Use explicit specifications for eligibility and policy.

Why:

- access control, environment support, and runnability are currently scattered
- a specification model makes failures explainable and testable

### Timeline Projection

Use projection rather than immediate storage unification for execution history.

Why:

- avoids a rewrite of current durable systems
- gives the product a unified execution view quickly
- lets the codebase converge incrementally

## User Experience Target

The product should collapse to a much simpler user model.

Current implicit model:

- choose the right subsystem
- choose the right search mode
- interpret a subsystem-specific execution state
- learn subsystem-specific retry or revision behavior

Target model:

1. Ask for an outcome.
2. The system chooses or suggests capabilities.
3. The system grounds on relevant knowledge when needed.
4. The system shows one execution timeline.
5. If the work needs intervention, the system exposes one revision surface.

This is the architectural standard. If a design choice makes this model less
clear, it is likely the wrong design choice.

## Agent Experience Target

Agents should be able to work from a much smaller platform vocabulary:

- discover
- ground
- execute
- inspect
- revise

The more the platform can make those verbs explicit and stable, the easier it
becomes to leverage the system’s real capabilities instead of forcing agents to
memorize local seams.

## Definition of Done

The target architecture is well defined when all of the following are true:

- one canonical runtime projection exists for capabilities
- one canonical grounding service exists for agent evidence retrieval
- one canonical execution timeline exists as a platform surface
- one canonical revision vocabulary exists across executable systems
- the user and agent models are both simpler than the current subsystem map
