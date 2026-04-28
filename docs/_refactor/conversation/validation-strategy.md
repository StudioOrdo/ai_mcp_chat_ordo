# Validation Strategy

## Objective

Define the validation standards for implementing the greenfield conversation
architecture.

## Core Proofs

### 1. Restore Does Not Execute History

Proof:

- seed a conversation with old successful media outputs
- load homepage multiple times
- assert no new jobs are created
- assert existing assets are visible as reusable outputs

### 2. Active Work Comes From Job Ledger

Proof:

- create queued, running, failed, canceled, succeeded jobs
- restore workspace
- assert only active or attention-needed jobs appear in active work
- assert succeeded jobs appear only as history or assets

### 3. Materialization Reuse Prevents Duplicate Work

Proof:

- complete a media job
- repeat the same normalized request
- assert existing materialization is returned
- assert no duplicate job is created

### 4. Browser Cache Is Disposable

Proof:

- clear browser session storage
- restore workspace
- assert active jobs, assets, and memory still load correctly

### 5. Relationship Memory Updates Continuously

Proof:

- send conversation turns that introduce goals, preferences, and decisions
- assert memory records are projected before archive
- assert restore uses memory records

### 6. Search Surfaces Stay Separate

Proof:

- query relationship memory
- query transcript recall
- query corpus grounding
- assert each returns its own result contract and does not leak unrelated
  product semantics

### 7. Prompt Binding Is Recorded For Durable Decisions

Proof:

- execute an assistant turn that updates memory or creates a durable asset
- assert prompt binding exists with effective hash and slot refs

### 8. Anonymous Migration Repairs Continuity

Proof:

- create anonymous conversation, job, asset, and memory records
- register or log in
- assert ownership and search/memory refs are repaired
- assert restore shows the migrated workspace

## Required Test Classes

### Unit Tests

Use for:

- materialization key normalization
- memory projection rules
- restore projection filtering
- prompt-binding capture
- identity migration repair helpers

### Integration Tests

Use for:

- database-backed restore model
- job and asset linkage
- migration across tables
- deletion and retention behavior

### Browser Tests

Use for:

- homepage return-user experience
- active work strip behavior
- asset shelf behavior
- browser-cache deletion proof

### Data Repair Tests

Use for:

- rebuilding workspace snapshots
- rebuilding memory projections
- reindexing transcript recall
- repairing anonymous ownership drift

## Acceptance Bar

Implementation is not complete if it only passes happy-path chat tests.

It must prove:

- repeated restore is idempotent
- completed work is not re-executed
- durable outputs remain reachable
- active jobs remain inspectable
- memory survives long conversations
- identity migration preserves continuity
- prompt governance remains explainable

## Definition Of Done

The validation strategy is complete when every implementation phase can name:

- the state it owns
- the state it must not own
- the restore proof
- the migration proof
- the no-duplicate-work proof
- the browser-cache-disposable proof
