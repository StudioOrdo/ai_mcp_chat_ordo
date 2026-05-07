# Module Map

## Objective

Define the concrete module boundaries for the unified capability platform so the
implementation phase has clear ownership, low coupling, and a stable migration
target.

## Design Rule

Each module must own one decision-making concern.

If a module both decides policy and performs transport or persistence plumbing,
the boundary is probably too large.

## Target Package Shape

The proposed target shape is logical first. File paths can vary, but the module
ownership should remain stable.

```text
src/core/platform/
  capability-runtime/
    CapabilityRuntime.ts
    CapabilityRuntimeProjector.ts
    CapabilityEligibility.ts
    CapabilityPresentation.ts
  knowledge-access/
    KnowledgeAccessService.ts
    CitationEnvelope.ts
    GroundingPolicy.ts
  discovery-search/
    DiscoverySearchService.ts
    DiscoveryResult.ts
  execution/
    ExecutionPlanner.ts
    ExecutionPlan.ts
    ExecutionTargetStrategy.ts
    ExecutionTimeline.ts
    ExecutionTimelineProjector.ts
  revision/
    RevisionControlService.ts
    RevisionCapability.ts
    RevisionAction.ts
    RevisionSupportLevel.ts
  agent-facade/
    AgentPlatformFacade.ts
    AgentCapabilityDiscovery.ts
    AgentExecutionInspector.ts
```

## Module Ownership

### 1. `capability-runtime`

Owns:

- projection from catalog definition to runtime-ready capability model
- validation projection
- RBAC projection
- presentation projection
- capability eligibility projection

Does not own:

- transport registration
- execution dispatch side effects
- UI rendering

Why:

The current system restates capability information across multiple layers. This
module exists to centralize that projection work.

### 2. `knowledge-access`

Owns:

- grounded retrieval
- evidence packaging
- citations and canonical references
- section prefetch policy
- retrieval quality assessment

Does not own:

- route search
- admin entity search
- shell navigation

Why:

Grounding and discovery are different product concerns. This module is only for
evidence retrieval.

### 3. `discovery-search`

Owns:

- route search
- admin entity lookup
- user-facing discovery search across product surfaces

Does not own:

- RAG grounding
- citation envelopes
- evidence packaging

Why:

This keeps the user navigation problem separate from the agent grounding
problem.

### 4. `execution`

Owns:

- explainable execution planning
- execution-target selection
- fallback and blocked-plan reasoning
- unified execution timeline projection

Does not own:

- capability metadata source of truth
- concrete tool business logic
- revision policy

Why:

Execution planning and execution history currently feel like adjacent but
separate concerns. This module makes them coherent.

### 5. `revision`

Owns:

- revision vocabulary
- revision support levels by capability
- retry/resume/refine inspection rules
- projection of subsystem-specific revision support into a common contract

Does not own:

- factory orchestration logic itself
- job execution logic itself

Why:

Factory remains the reference implementation, but the platform needs a shared
revision language.

### 6. `agent-facade`

Owns:

- agent-oriented platform verbs
- platform composition for discovery, grounding, execution, inspection, and
  revision

Does not own:

- orchestration internals
- retrieval internals
- transport internals

Why:

This facade exists to simplify platform consumption, not to become another
business-logic layer.

## Existing To Target Mapping

### Capability Runtime

Current seams:

- capability catalog
- runtime tool binding
- tool composition root
- tool registry

Target mapping:

- catalog stays canonical
- runtime binding logic is reduced and folded into capability runtime
  projection
- tool composition root becomes a consumer of projected runtime data
- registry stays focused on execution and lookup, not metadata synthesis

### Knowledge Access

Current seams:

- search pipeline
- hybrid search engine
- corpus library facade
- search interactor
- corpus tools

Target mapping:

- hybrid search engine remains the retrieval core
- corpus library search shaping migrates into knowledge access
- corpus tools consume knowledge access rather than reconstructing retrieval
  behavior

### Discovery Search

Current seams:

- global search
- admin entity search
- route resolution

Target mapping:

- these become explicit discovery-search concerns
- they stop pretending to be the same service as agent grounding

### Execution Timeline

Current seams:

- job events
- work-order execution logs
- stage runs
- chat runtime hooks
- observability event bus

Target mapping:

- current stores remain in place
- timeline projection reads from them into one queryable model

### Revision

Current seams:

- factory pause/refine/resume services
- job retry and replay paths

Target mapping:

- platform revision contracts wrap these support levels explicitly
- factory remains the advanced reference path

## Dependency Rules

1. `agent-facade` may depend on all other platform modules.
2. `revision` may depend on `execution`, but not vice versa.
3. `execution` may depend on `capability-runtime`, but not vice versa.
4. `knowledge-access` and `discovery-search` must remain separate siblings.
5. Platform modules may depend on existing subsystem adapters during migration,
   but subsystem-specific modules should not depend back on the new facade.

## Anti-Patterns To Avoid

- a new god-service that owns all platform behavior
- moving business logic into transport routes or UI helpers
- introducing a second metadata source parallel to the capability catalog
- embedding retrieval shaping logic directly inside agent or chat surfaces
- forcing immediate persistence unification before projection proves value

## Definition of Done

This module map is implementation-ready when:

- each new module has one clear concern
- dependency direction is explicit
- current-to-target mapping is understandable
- the migration can proceed incrementally without subsystem rewrites
