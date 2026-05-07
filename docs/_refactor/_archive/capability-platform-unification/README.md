# Capability Platform Unification

## Overview

This package defines a greenfield refactor direction for the parts of the
system that currently span:

- factory DAG orchestration and asset generation
- corpus search, retrieval, and RAG grounding
- tool registry, capability catalog, and execution-target planning
- logs, events, jobs, and execution history

The current codebase already has strong foundations in each area. The problem
is not missing capability. The problem is that the same capability is modeled
several times across parallel layers, which makes the system harder to extend,
harder for agents to reason about, and harder for users to understand.

This package exists to define a more functional, DRY, and SOLID platform shape
that simplifies both the operator experience and the agent execution model.

## Package Contents

1. `README.md`: entry point, scope, and intended use of the package.
2. `architecture-audit.md`: current-state map of the main systems, duplication, ownership drift, and architectural pain points.
3. `target-architecture.md`: proposed platform architecture, canonical abstractions, design patterns, and simplified user and agent interaction model.
4. `module-map.md`: concrete module boundaries, current-to-target ownership mapping, dependency rules, and anti-patterns to avoid.
5. `contracts-and-interfaces.md`: canonical platform contracts, implementation-oriented interface definitions, and support-level explainability rules.
6. `migration-playbook.md`: projection-first migration sequence, deletion rules, rollout guidance, and risk controls.
7. `validation-and-test-strategy.md`: quality gates for each phase and parity, contract, migration, and workflow validation rules.
8. `phase-1-capability-runtime-implementation.md`: code-facing implementation plan for the highest-leverage first slice, including file targets, slice sequencing, and completion criteria.
9. `phase-2-knowledge-access-implementation.md`: code-facing implementation plan for the knowledge-access split, grounded in the completed Phase 1 seam and the current search code.
10. `phase-3-execution-timeline-implementation.md`: code-facing implementation plan for the execution timeline projection, grounded in the current job and factory inspection surfaces.
11. `phase-4-revision-platform-implementation.md`: code-facing implementation plan for the revision platform contract, grounded in the current factory revision stack and retry-only job flows.
12. `phase-5-ux-and-agent-simplification-implementation.md`: code-facing implementation plan and closeout for the Phase 5 facade and interaction-model simplification work, grounded in the current chat, operator, discovery, and grounding composition seams.
13. `phase-6-platform-convergence-and-timeline-completion.md`: code-facing implementation plan for closing the remaining post-Phase-5 convergence gaps across the operator jobs surface, direct chat entry points, execution-timeline coverage, and execution-planning ownership, grounded in the current mapper-backed admin jobs flow, existing agent-facade root, and persisted observability sources.
14. `phase-7-media-evals-and-video-proof.md`: implementation plan for governed typed media discovery plus stress-driven, artifact-backed evals that prove cross-media assembly, planner routing, recovery behavior, and final playable video outputs.
15. `adr-001-capability-runtime.md`: local decision record establishing `CapabilityRuntime` as the canonical runtime projection.
16. `ROADMAP.md`: phased migration plan, sequencing, deliverables, and definition of done.

## Recommended Reading Order

1. `README.md`
2. `architecture-audit.md`
3. `target-architecture.md`
4. `module-map.md`
5. `contracts-and-interfaces.md`
6. `migration-playbook.md`
7. `validation-and-test-strategy.md`
8. `phase-1-capability-runtime-implementation.md`
9. `phase-2-knowledge-access-implementation.md`
10. `phase-3-execution-timeline-implementation.md`
11. `phase-4-revision-platform-implementation.md`
12. `phase-5-ux-and-agent-simplification-implementation.md`
13. `phase-6-platform-convergence-and-timeline-completion.md`
14. `phase-7-media-evals-and-video-proof.md`
15. `adr-001-capability-runtime.md`
16. `ROADMAP.md`

## Scope

This package is intentionally broader than a single subsystem refactor.
It treats the following as one platform problem:

- how capabilities are defined
- how capabilities are discovered
- how knowledge is retrieved and grounded
- how execution is planned and routed
- how execution state is inspected, resumed, or revised

The target state is a platform that lets the system answer five questions with
one coherent model:

1. What can the system do?
2. What knowledge can the system ground on?
3. What should run next?
4. What happened during execution?
5. How can the user revise or continue the work?

## Working Principles

- Keep the existing production-proven cores where they are already sound.
- Eliminate duplicate ownership of the same concept across multiple layers.
- Prefer projection from a single source of truth over manual re-registration.
- Separate user-facing search from agent-facing grounding.
- Treat execution history as a first-class product surface, not scattered logs.
- Design for agent leverage first, because that also simplifies the operator
  experience.

## Intended Outcome

At the end of this refactor direction, the platform should present a much
smaller mental model:

- one canonical capability model
- one canonical knowledge access model
- one canonical execution timeline
- one canonical revision surface

That simplification is the core product goal. The architecture is in service of
that outcome.

## Implementation Package Standard

This package is intended to be implementation-grade.

That means implementation should not begin from the roadmap alone. It should be
guided by:

- the target architecture
- the concrete module map
- the canonical contracts
- the migration playbook
- the validation strategy
- the Phase 1 implementation spec for the first migration slice
- the active ADRs for canonical ownership decisions

If a future document contradicts those implementation anchors, the contradiction
should be resolved before code lands.
