# Conversation Refactor Roadmap

## Objective

Provide a phase-shaping roadmap for the greenfield conversation architecture.
This is not the final implementation plan. It is the sequence that future phase
documents should refine.

Detailed phase instructions now live in [phases/README.md](phases/README.md).
Those phase docs are the implementation control surface for this work package.

## Current Status

- Phases 0 through 11 are now implemented in code and validated through the
  conversation-refactor, runtime-integrity, Phase 11 tool-invocation, and
  composite release-evidence gates.
- Phase 12 remains the explicit documentation and platform-vision handoff.

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

- introduce contracts for workspace snapshot, business workflow context,
  operator transition, trust distribution, relationship memory, prompt binding,
  identity migration, and materialization records

Deliverables:

- types and repository ports
- no-op, empty, or projection-backed implementations only when useful
- contract tests

Status:

- implemented as pure domain contracts and ports, with no runtime cutover or
  schema change
- covered by `tests/conversation/phase-01-canonical-domain-contracts.test.ts`
- included in `npm run qa:conversation-refactor`

### Phase 2: Workspace Snapshot Projection

Goal:

- make homepage restore read canonical projections instead of transcript-derived
  runtime candidates

Deliverables:

- workspace restore endpoint
- active job projection
- reusable asset projection
- recent transcript projection
- restore idempotency tests

### Phase 2A: Business Workflow Context Projection

Goal:

- preserve task origin, related business objects, setup state, notifications,
  retries, and next actions around the conversation

Deliverables:

- workflow context projection
- compact related business refs
- setup and health blocker refs
- return-to-source context

### Phase 2B: Operator Transition And Trust Distribution Projection

Goal:

- make first-run and restore support users becoming economically effective,
  including QR/referral trust distribution

Deliverables:

- operator transition projection
- trust distribution projection
- referral QR/link readiness
- first-share, follow-up, and credit-review next actions
- proof that referral motion survives visit, chat, registration, and restore

### Phase 3: Restore Read Model And Idempotent Homepage

Goal:

- establish the canonical restore contract and cut homepage load away from
  transcript-driven execution

Deliverables:

- restore read model or endpoint
- canonical active-work filtering
- nullable or guarded placeholders for later asset, memory, prompt, and product
  projections
- homepage restore idempotency proof

### Phase 4: Job Ledger And Materialization Registry

Goal:

- prevent duplicate expensive work by reusing successful materializations

Deliverables:

- materialization key builder
- successful-result lookup
- asset catalog lineage fields
- exact-reuse and variant UX contracts

### Phase 5: Asset Catalog And Reusable Outputs

Goal:

- promote durable generated and uploaded outputs into a queryable asset catalog

Deliverables:

- asset catalog entity or projection
- output registration hooks
- reusable asset query for restore
- lineage and migration-safe repair strategy

### Phase 6: Relationship Memory Projection

Goal:

- build continuous memory independent of archived transcript search

Deliverables:

- memory record model
- memory projection pipeline
- memory evidence refs
- memory-backed restore summary

### Phase 7: Search Surface Split

Goal:

- split relationship memory retrieval, transcript recall, corpus grounding, and
  product discovery

Deliverables:

- separate service contracts
- updated `search_my_conversations` semantics or replacement
- transcript recall API
- memory retrieval API

### Phase 8: Prompt Binding And Governance

Goal:

- make durable decisions explainable against governed prompt context

Deliverables:

- prompt binding recorder
- binding refs on memory and asset-producing executions
- prompt drift diagnostics

### Phase 9: Identity Migration And Repair

Goal:

- make anonymous-to-authenticated conversion cover all canonical continuity
  models

Deliverables:

- durable migration event
- repair checks
- migration status projection
- post-login restore proof

### Phase 10: UI Simplification

Goal:

- simplify the conversation UI around the new state model

Deliverables:

- current work summary
- active work strip driven only by durable jobs
- reusable asset shelf
- memory-backed next action
- operator transition or trust-distribution next action
- transcript as history view

### Phase 11: Release Hardening And Learning Loop

Goal:

- consolidate the release gates, retire the remaining transcript-era
  compatibility seams, and close the package with release-grade evidence

Deliverables:

- shared QA-runner orchestration
- composite release evidence including tool-invocation provenance
- canonical-only workspace restore parsing
- governed-only chart and graph source rehydration
- final hardening artifacts and phase closeout documentation

Status:

- implemented and validated

### Phase 12: Platform Vision Research And Recording

Goal:

- record the next platform kernel and handoff without reopening completed
  conversation-package scope

Deliverables:

- platform-vision record
- next-batch kernel map and phase sequence
- explicit handoff grounded in the validated Phase 11 outcomes

Status:

- handoff phase only; not runtime implementation work in the completed
  conversation package

## Anti-Goals

- Do not preserve transcript-driven restore.
- Do not make message parts the primary integration layer.
- Do not rebuild the job ledger without cause.
- Do not treat embeddings as memory.
- Do not let browser session storage own recovery truth.
- Do not treat first-run as configuration before agency.
- Do not treat QR/referral as a marketing add-on when it is the trust layer.

## Definition Of Done

The roadmap is ready for phase documents when each future phase can be scoped
around one canonical ownership change and one executable proof.

## Phase Package

The current phase package expands this roadmap into the full supervised
AI-engineering loop:

```text
Collect -> Decide -> Spec -> QA -> Ground -> Phase QA -> Implement -> QA -> Update -> Repeat
```

Start at [phases/README.md](phases/README.md), then execute phases in numeric
order unless a phase QA review changes the sequence.
