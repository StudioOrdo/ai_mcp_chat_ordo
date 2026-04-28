# Conversation Refactor Roadmap

## Objective

Provide a phase-shaping roadmap for the greenfield conversation architecture.
This is not the final implementation plan. It is the sequence that future phase
documents should refine.

## Sequencing Principle

Do not start by redesigning the chat UI.

Start by introducing canonical state and projections. The UI should become
simpler because the state model becomes honest.

## Phase Shape

### Phase 0: Baseline And Parity Inventory

Goal:

- freeze current restore, job, asset, search, prompt, and migration behavior as
  tests and evidence

Deliverables:

- restore idempotency baseline
- job ledger inventory
- asset lineage inventory
- conversation search inventory
- anonymous migration inventory

### Phase 1: Canonical Domain Contracts

Goal:

- introduce contracts for workspace snapshot, relationship memory, asset
  catalog, prompt binding, and materialization records

Deliverables:

- types and repository ports
- no-op or projection-backed implementations
- contract tests

### Phase 2: Workspace Restore Projection

Goal:

- make homepage restore read canonical projections instead of transcript-derived
  runtime candidates

Deliverables:

- workspace restore endpoint
- active job projection
- reusable asset projection
- recent transcript projection
- restore idempotency tests

### Phase 3: Asset Catalog And Materialization Reuse

Goal:

- prevent duplicate expensive work by reusing successful materializations

Deliverables:

- materialization key builder
- successful-result lookup
- asset catalog lineage fields
- exact-reuse and variant UX contracts

### Phase 4: Relationship Memory Projection

Goal:

- build continuous memory independent of archived transcript search

Deliverables:

- memory record model
- memory projection pipeline
- memory evidence refs
- memory-backed restore summary

### Phase 5: Search Surface Split

Goal:

- split relationship memory retrieval, transcript recall, corpus grounding, and
  product discovery

Deliverables:

- separate service contracts
- updated `search_my_conversations` semantics or replacement
- transcript recall API
- memory retrieval API

### Phase 6: Prompt Binding And Governance

Goal:

- make durable decisions explainable against governed prompt context

Deliverables:

- prompt binding recorder
- binding refs on memory and asset-producing executions
- prompt drift diagnostics

### Phase 7: Identity Migration And Repair

Goal:

- make anonymous-to-authenticated conversion cover all canonical continuity
  models

Deliverables:

- durable migration event
- repair checks
- migration status projection
- post-login restore proof

### Phase 8: UI Simplification

Goal:

- simplify the conversation UI around the new state model

Deliverables:

- current work summary
- active work strip driven only by durable jobs
- reusable asset shelf
- memory-backed next action
- transcript as history view

## Anti-Goals

- Do not preserve transcript-driven restore.
- Do not make message parts the primary integration layer.
- Do not rebuild the job ledger without cause.
- Do not treat embeddings as memory.
- Do not let browser session storage own recovery truth.

## Definition Of Done

The roadmap is ready for phase documents when each future phase can be scoped
around one canonical ownership change and one executable proof.
