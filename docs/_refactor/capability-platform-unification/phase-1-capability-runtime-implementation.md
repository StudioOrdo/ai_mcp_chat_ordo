# Phase 1 Implementation Spec — Capability Runtime Unification

## Objective

Turn Phase 1 of the platform roadmap into a code-facing implementation plan
that can be executed in narrow slices against the current codebase.

This phase is the highest-leverage migration because it reduces the duplicate
ownership currently spread across:

- `src/core/capability-catalog/catalog.ts`
- `src/core/capability-catalog/runtime-tool-binding.ts`
- `src/lib/chat/tool-composition-root.ts`
- `src/core/tool-registry/ToolRegistry.ts`

## Phase Outcome

At the end of this phase, the system should have one canonical runtime
projection for a capability, and the tool registration path should consume that
projection instead of manually rebuilding capability metadata in parallel.

## Current Problem Statement

Today the system represents one capability in several overlapping ways:

1. canonical catalog metadata
2. runtime binding parse and executor wiring
3. tool descriptor assembly
4. bundle registration and registry population
5. execution planning metadata

This creates drift risk and makes the agent/runtime story harder to explain.

## Scope

### In Scope

- new `CapabilityRuntime` projection
- runtime projection tests
- migration of registry assembly to consume projected runtime data
- explicit plan-explainability at the runtime layer
- representative parity coverage

### Out of Scope

- knowledge access split
- execution timeline work
- revision vocabulary generalization
- agent facade introduction
- full capability-family reorganization

## Canonical Files To Touch

### Existing Files

- `src/core/capability-catalog/catalog.ts`
- `src/core/capability-catalog/runtime-tool-binding.ts`
- `src/core/capability-catalog/runtime-tool-projection.ts`
- `src/lib/chat/tool-composition-root.ts`
- `src/core/tool-registry/ToolRegistry.ts`
- `src/lib/capabilities/executor-dispatch.ts`

### New Files

- `src/core/platform/capability-runtime/CapabilityRuntime.ts`
- `src/core/platform/capability-runtime/CapabilityExecutionExplanation.ts`
- `src/core/platform/capability-runtime/CapabilityRuntime.test.ts`
- `src/lib/chat/tool-bundle-composition.ts`

The exact file names can move slightly, but the boundary should remain the
same.

## Target Runtime Shape

Phase 1 should introduce a projection that answers these questions for every
capability:

1. What is the capability called?
2. Who can run it?
3. How is its input parsed and described?
4. How is it presented to users and agents?
5. How is its execution planned?
6. What revision support level does it advertise?

This runtime shape must be derived from canonical metadata plus current binding
logic, not manually re-authored elsewhere.

## Implementation Slices

### Slice 1: Introduce Read-Only Runtime Projection

Tasks:

- create `CapabilityRuntime` type
- create projector from catalog definition plus binding definition
- expose read-only projection helpers
- do not yet migrate any consumers

Acceptance criteria:

- projection exists for representative sync, deferred, hybrid, and browser
  capabilities
- no current runtime path is deleted

### Slice 2: Add Projection Parity Tests

Representative capability coverage should include:

- calculator capability
- corpus search capability
- admin capability
- media capability
- deferred job capability
- factory capability

Tests should prove parity for:

- name
- roles
- schema description
- execution mode
- execution target planning shape
- major presentation properties

Acceptance criteria:

- projection parity tests pass for the chosen cross-section
- test failures clearly indicate where projection diverges from legacy behavior

### Slice 3: Migrate Tool Descriptor Assembly

Tasks:

- make the current registration path consume `CapabilityRuntime`
- minimize direct metadata reconstruction in `runtime-tool-binding.ts`
- keep current command execution semantics unchanged

Acceptance criteria:

- registry population still works
- descriptor schemas and roles stay behaviorally stable
- no business capability changes are introduced in this slice

### Slice 4: Make Execution Planning Explainable From Runtime

Tasks:

- ensure runtime projection can surface execution planning rationale
- expose blocked-plan reasoning in a reusable format
- avoid scattering execution explanation across registry and dispatch layers

Acceptance criteria:

- execution-plan diagnostics can be inspected from the runtime surface
- planner outputs are stable enough for downstream consumers and tests

Implementation status:

- completed via `CapabilityRuntime.executionPlan` and
  `CapabilityRuntime.executionExplanation`
- blocked-plan reasoning now projects through
  `CapabilityExecutionExplanation.ts` instead of remaining implicit inside
  execution-target planning only

### Slice 5: Reduce Duplicate Manual Wiring

Tasks:

- remove only the redundant metadata assembly that the runtime projection now
  owns
- preserve current behavior while shrinking ownership overlap

Acceptance criteria:

- fewer manual touch points are required to add or change a capability
- deletion is backed by parity tests, not confidence alone

## Coding Rules For This Phase

1. Do not change business capability behavior while introducing projection.
2. Do not mix knowledge-access changes into this phase.
3. Do not let `ToolRegistry` become a metadata synthesizer.
4. Do not introduce a second canonical source of truth.
5. Prefer adapters during migration over broad rewrites.

## Review Checklist

Every Phase 1 PR should answer yes to all of these:

1. Is the catalog still the canonical metadata owner?
2. Does the new runtime projection reduce duplicate ownership?
3. Are deleted code paths covered by parity tests?
4. Is execution planning more explainable after the change?
5. Did this avoid accidental expansion into search or timeline work?

## Validation Commands

The exact test commands can vary as implementation lands, but Phase 1 must end
with focused validation for:

- capability runtime projection tests
- affected capability-catalog tests
- affected tool-registry tests
- affected runtime-binding tests

No Phase 1 slice should be closed using doc-only or diff-only validation.

## Definition of Done

Phase 1 is complete only when:

- `CapabilityRuntime` exists as a canonical projection
- representative parity tests pass
- tool registration consumes the runtime projection
- execution planning explanation is available from the runtime surface
- duplicate metadata ownership is materially reduced without changing shipped
  capability behavior

## Current Implementation Status

The current codebase has materially completed the core Phase 1 runtime seam.

Implemented runtime surface:

- `src/core/platform/capability-runtime/CapabilityRuntime.ts` is the canonical
  runtime projection over `CAPABILITY_CATALOG`
- the runtime is split into `CapabilityRuntimeStatic` and planning-aware
  `CapabilityRuntime`
- planning-aware runtime now exposes both `executionPlan` and
  `executionExplanation` for reusable target-selection diagnostics
- static runtime facets currently cover descriptor, schema, presentation, job,
  browser, MCP export, binding summary, local execution targets, and
  prompt-hint projections

Implemented consumer migrations:

- tool descriptor projection consumes runtime descriptor helpers
- bundle registration is centralized through catalog-bound helper paths
- chat bundle composition is centralized in a shared composition map
- role directive assembly consumes runtime-static prompt-hint data
- execution target planning consumes runtime-projected static facets
- local external target inventory consumes runtime projection helpers
- MCP export and MCP sidecar inventory consume runtime-static projections
- schema batch projection helpers consume runtime-static projections

Implemented test and regression coverage:

- `CapabilityRuntime.test.ts` covers parity for representative capabilities and
  static-vs-planned runtime behavior, including blocked-plan explanation
- runtime-tool-binding coverage now validates catalog-bound membership parity
  through runtime-static binding summaries instead of raw catalog key walks
- convergence and prompt-directive tests validate projected data via
  runtime-static helpers instead of raw catalog walks
- end-to-end catalog flow tests now validate projected presentation, job,
  browser, and prompt-hint behavior via runtime-static helpers
- source-verification guards currently cover `schema-projection.ts`,
  `mcp-export.ts`, `mcp-sidecar-inventory.ts`,
  `role-directive-assembler.ts`, `local-external-target-inventory.ts`, and
  `execution-targets.ts`

Focused validation currently in use:

- `npm test -- "src/core/platform/capability-runtime/CapabilityRuntime.test.ts"`
- `npm test -- "src/core/capability-catalog/runtime-tool-binding.test.ts"`
- `npm test -- "src/core/capability-catalog/prompt-directive-unification.test.ts" "src/core/capability-catalog/registry-convergence.test.ts"`
- `npm test -- "src/core/capability-catalog/e2e-catalog-flow.test.ts" "src/core/capability-catalog/registry-convergence.test.ts"`
- `npm test -- "src/core/capability-catalog/schema-derivation.test.ts"`
- `npm test -- "src/lib/chat/tool-composition-root.test.ts" "src/lib/chat/tool-bundles/bundle-registration.test.ts" "src/frameworks/ui/chat/registry/default-tool-registry.test.ts"`

Remaining Phase 1 follow-up work should be limited to places that still need
to distinguish true definition-shape coverage from tests or utilities that are
only validating already-projected runtime metadata.

Intentional raw-catalog / definition-shape boundary:

- `catalog.test.ts` should remain catalog-backed because it verifies baseline
  definition-shape invariants directly on `CAPABILITY_CATALOG`
- `catalog-coverage.test.ts` should remain catalog-backed where it checks
  bundle coverage and required definition facets like `core.name` and
  `presentation`
- `e2e-catalog-flow.test.ts` can continue to use raw catalog facet counts when
  it is explicitly proving source-of-truth parity from definition-level `job`,
  `browser`, and `promptHint` facets into runtime-static projections
- `capability-ownership.test.ts` should keep the single catalog-key alignment
  assertion that proves runtime-static names have not drifted from catalog
  ownership keys

Projected-metadata tests should prefer runtime-static helpers instead of raw
catalog walks; this now includes schema-derivation, registry-convergence,
prompt-directive, runtime-tool-binding, and related projection-parity suites.
