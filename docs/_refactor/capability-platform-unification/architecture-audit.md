# Architecture Audit

## Objective

Document the current architecture across orchestration, retrieval, tooling, and
observability. Identify where the system is already strong, where ownership is
duplicated, and where the current shape creates unnecessary friction for users,
operators, and agents.

## Status

- Research: complete
- Completion date: 2026-04-27
- Exit criterion met: core seams for orchestration, retrieval, execution, and
  observability were mapped and evaluated holistically

## Existing Strengths

### 1. Factory Orchestration Already Has a Good Core

The factory stack has a sound runtime center:

- `DAGPlanner` generates an immutable plan.
- `ProductionOrchestrator` owns execution and pause/resume lifecycle.
- `WorkOrder`, `StageRunRecord`, outputs, checkpoints, and events provide
  durable runtime truth.

Why this matters:

- the system already separates plan state from runtime state
- execution is checkpoint-aware and revision-capable
- the orchestration model is strong enough to remain the basis for future work

Conclusion:

Keep the factory execution model. Do not rewrite it into a second workflow
engine.

### 2. Retrieval Already Has a Strong Canonical Search Core

The retrieval stack has a strong center in hybrid search:

- vector and BM25 retrieval are already fused deterministically
- query preprocessing is explicit
- result formatting, rank fusion, and section-level deduplication already exist

Why this matters:

- the codebase does not need a new RAG engine
- the search engine is already a reasonable single source of retrieval truth
- the real opportunity is simplifying how search is surfaced and consumed

Conclusion:

Keep the search engine. Refactor the surfaces around it.

### 3. Capability Metadata Is Rich and Valuable

The capability catalog already carries a large amount of useful metadata:

- presentation
- execution mode
- role constraints
- execution target hints
- browser and MCP export facets

Why this matters:

- the codebase already has the right instinct: describe capabilities once,
  project them many ways
- the problem is incomplete commitment to that principle, not absence of it

Conclusion:

Treat the capability catalog as the canonical source of truth and reduce the
number of downstream manual registration layers.

## Main Architectural Problems

### Problem 1: Capability Ownership Is Split Across Too Many Layers

Today a single capability can appear in several forms:

- catalog definition
- runtime binding definition
- bundle registration
- tool descriptor registration
- execution target routing metadata

This creates several kinds of drift:

- a capability can be defined correctly in one layer but not projected
  correctly in another
- agents and developers must understand too many files to answer basic
  questions like "how does this run?"
- registration logic grows faster than the capability model itself

Architectural smell:

The system is close to projection-driven design, but still partly relies on
manual assembly.

### Problem 2: Retrieval Has Too Many Consumer Surfaces

The retrieval core is coherent, but the user-facing and agent-facing surfaces
are spread across:

- corpus library facade
- library interactor
- corpus tools
- global search
- chat search pipeline

Effects:

- multiple result shapes
- repeated audience filtering
- duplicated link-building and prefetch decisions
- unclear separation between grounding search and product navigation search

Architectural smell:

The system mixes two different concerns under "search":

- evidence retrieval for grounded reasoning
- discovery/navigation across routes, documents, and admin entities

Those should be separate services.

### Problem 3: Execution History Is Fragmented

Execution state is currently represented in several different models:

- work-order execution logs
- stage runs
- job event streams
- chat runtime hooks
- observability events
- JSONL runtime audit logs

Effects:

- no single timeline answers "what happened?"
- operators and agents must hop between subsystem-specific histories
- execution inspection is not a first-class platform surface

Architectural smell:

The platform treats execution history as implementation detail instead of as a
core domain surface.

### Problem 4: Multiple Pipelines Model Similar Concepts Differently

The codebase contains several good pipelines:

- chat runtime hooks
- tool middleware
- factory orchestration
- retrieval query processing

The issue is not that they exist. The issue is that each has a different state
model and lifecycle vocabulary.

Effects:

- harder to reuse tooling across systems
- harder to inspect or reason about lifecycle consistently
- harder for agents to compose across boundaries

Architectural smell:

Multiple pipelines are fine; multiple incompatible lifecycle models are not.

### Problem 5: User Experience Mirrors Internal Architecture Too Closely

The internal architecture is partitioned by subsystem, and the product surface
inherits that partitioning.

Examples:

- search means different things in different places
- execution state is different for jobs, tools, chat, and factory work orders
- revision and retry depend on which subsystem produced the work

Effects:

- the user has to think in terms of implementation seams
- the agent has to learn local protocols instead of platform primitives

Architectural smell:

The system is capability-rich but experience-poor.

## Core Diagnosis

The codebase does not primarily suffer from missing patterns.
It suffers from duplicate ownership of the same concepts.

The main concepts that need one canonical model are:

- capability definition
- knowledge retrieval
- execution planning
- execution history
- revision control

The strongest refactor direction is therefore not "build more subsystems." It
is "collapse parallel representations of the same subsystem concern."

## Design Constraints For The Refactor

Any target architecture should preserve these current strengths:

1. Factory plan/runtime separation stays intact.
2. Hybrid retrieval remains the search core.
3. Capability catalog remains the metadata source of truth.
4. Existing durable persistence and append-only event habits remain preferred.
5. The refactor must improve the user and agent model, not just move files.

## Definition of Done

This audit is complete when it is clear that the next design should:

- consolidate capability ownership
- separate grounding search from navigation search
- introduce a single execution-timeline surface
- keep the existing orchestration and retrieval cores
- optimize for simpler user and agent workflows, not just cleaner code
