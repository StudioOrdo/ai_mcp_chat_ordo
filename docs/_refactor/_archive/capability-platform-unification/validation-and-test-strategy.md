# Validation and Test Strategy

## Objective

Define the validation gates that ensure the implementation phase improves the
architecture rather than merely moving code around.

## Testing Principle

This refactor is successful only if it increases architectural correctness and
behavioral clarity at the same time.

That means implementation must be validated at four levels:

1. projection parity
2. contract correctness
3. consumer migration safety
4. user and agent workflow quality

## Validation Matrix

### 1. Projection Parity Tests

Purpose:

- prove that new canonical projections preserve existing runtime behavior

Required coverage:

- capability runtime projection for representative sync, deferred, hybrid, and
  browser-bound capabilities
- execution planning parity for target selection and blocked-plan reasoning
- timeline projection parity for jobs and factory work orders

Failure examples that should block merge:

- projected roles differ from legacy behavior
- projected execution mode differs from shipped behavior
- planner silently changes target precedence without explicit approval

### 2. Contract Tests

Purpose:

- prove that the new platform contracts are stable and explainable

Required coverage:

- invalid input parsing produces explicit failures
- unsupported revision actions are represented honestly
- execution plans always return rationale or block reason
- knowledge access always returns retrieval quality and follow-up guidance

Failure examples that should block merge:

- contract allows ambiguous unsupported states
- planner returns null target without explanation
- knowledge service returns results with no quality signal

### 3. Migration Safety Tests

Purpose:

- ensure old and new paths remain behaviorally aligned during transition

Required coverage:

- before-and-after behavior snapshots for migrated capability families
- regression tests for registry assembly and tool execution
- regression tests for corpus search and route discovery after service split
- timeline readers against real persisted job/work-order fixtures

Failure examples that should block merge:

- migrated consumer drops metadata that existed before
- discovery search loses route or admin entity results
- timeline omits revision or artifact information needed for diagnosis

### 4. Workflow Acceptance Tests

Purpose:

- validate the user and agent experience promised by the architecture

Required coverage:

- agent can discover a capability, ground on knowledge, execute it, inspect the
  run, and revise it through the platform model
- operator can inspect execution without hopping across subsystem-specific
  surfaces for standard cases
- revision support levels are visible and accurate

Failure examples that should block merge:

- agents still need subsystem-specific knowledge for normal platform flows
- users still see multiple incompatible execution states for adjacent actions

## Quality Gates By Phase

### Capability Runtime Phase

Gate:

- parity tests for representative capabilities pass
- new capabilities can be added with fewer manual registration points

### Knowledge Access Phase

Gate:

- grounded retrieval tests pass
- discovery search tests pass
- mixed search ownership is reduced, not increased

### Execution Timeline Phase

Gate:

- timeline projector tests pass for jobs and work orders
- artifacts and next actions are visible in the projected timeline

### Revision Phase

Gate:

- revision support levels are explicit in tests
- factory refine/resume still passes end to end
- retry-only systems are accurately represented as such

### Agent Facade Phase

Gate:

- agent workflow acceptance tests pass through facade-only usage
- no subsystem-specific assumptions leak into standard agent flows

### Platform Convergence Phase

Gate:

- the main operator jobs experience is validated against platform interaction
  data while preserving current mapper-backed global browse semantics
- direct-turn and streaming chat entry points both pass through the platform
  facade boundary in focused tests, with direct-turn migration reusing the
  existing production facade root where practical
- `chat_turn` and observability execution kinds have explicit timeline-reader
  coverage for supported persisted cases
- execution-planner parity tests prove ownership migration without silent
  target-selection drift

### Media Proof Phase

Gate:

- deterministic media-discovery and canonicalization suites prove governed
  slot-safe asset selection for composition
- deterministic stress suites prove mixed-kind ambiguity, repeated governed
  reuse, and retry pressure do not silently corrupt composition inputs
- deterministic media-runtime, planning, routing, and serving suites pass
- required live media scenarios produce artifact-backed evidence bundles
- every required final-video scenario proves browser playback plus downloaded
  media stream validation
- every audio-required final-video scenario proves non-silent audio
- planner media evals classify guarded prompt failures separately from broken
  routing or execution regressions
- critical stressed failures are reproduced, explained, fixed or intentionally
  guarded, and rerun before the phase is considered complete

### Media Fault-Induction And Continuity Phase

Gate:

- later-turn media reuse scenarios in one long-lived conversation prove reuse,
  truthful clarification, or truthful guardrail behavior instead of silent
  regeneration
- ambiguity-heavy mixed-asset scenarios prove the system does not silently bind
  the wrong asset or wrong kind under overlapping labels
- route-pressure scenarios prove browser, deferred, and rerouted media flows
  preserve meaningful failure semantics
- reload, missed-event, retry, dedupe, and supersession scenarios prove the UI
  and persisted state recover coherently
- induced failures always retain enough evidence to explain the selected
  assets, route, plan, and recovery state without ad hoc reruns

### Shared Media Materialization And Live Runtime Phase

Gate:

- deterministic server-materialization suites prove chart and graph clips are
  promoted into governed derived image assets before worker preflight and
  FFmpeg execution
- route-parity suites prove browser and worker lanes share executable-plan
  validation semantics instead of silently diverging on supported visual kinds
- live workflow suites exercise real media production with live keys across
  attached-media, generated-chart, generated-graph, and later-turn reuse paths
- release evidence captures the exact deterministic and live commands, whether
  live keys were enabled, and enough artifact metadata to diagnose failures
  without rerunning the whole matrix
- phase completion is blocked if the product can still succeed in browser-only
  compose while the worker lane rejects the same governed chart or graph inputs

## Review Checklist

Every implementation PR should answer yes to all of these:

1. Does this strengthen a canonical owner rather than add another one?
2. Does this reduce duplication or at least avoid creating more?
3. Are unsupported states explicit in the contract?
4. Is there focused validation for the migrated slice?
5. Does this make the user or agent experience simpler, not just different?

If any answer is no, the change should be revised before merge.

## Recommended Test Layers

- unit tests for projectors, contracts, planners, and support-level policies
- integration tests for migrated registration and execution flows
- repository-backed tests for timeline projections and revision flows
- route or facade tests for end-to-end platform workflows

## Definition of Done

This validation strategy is ready when:

- each migration phase has explicit quality gates
- parity, contracts, and workflows are all covered
- the architecture cannot "succeed" while leaving the experience incoherent
