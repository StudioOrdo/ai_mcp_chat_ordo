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

### 9. Business Workflow Context Restores Momentum

Proof:

- start from a lead, deal, referral, training, setup, or operations surface
- create or resume a conversation from that origin
- restore the workspace
- assert the restore response includes compact workflow context, related
  business refs, and a useful next action
- assert the UI can return to the originating surface without transcript
  re-derivation

### 10. Operator Transition Creates Agency

Proof:

- start from first-run or post-install state
- create or resume an operator transition profile
- assert the restore response includes transition status, operator mode,
  useful refs, and an agency-oriented next action
- assert setup blockers are named truthfully when they prevent useful work

### 11. Trust Distribution Restores Referral Motion

Proof:

- enable affiliate access for a user with a referral code
- request the referral QR through chat or `/referrals`
- visit `/r/{code}`, activate the signed referral visit, and start anonymous
  chat
- assert referral linkage survives restore and anonymous registration
- assert referral milestones appear as workflow or trust-distribution refs

## Required Test Classes

The detailed test-infrastructure plan lives in
[test-infrastructure-and-evidence.md](test-infrastructure-and-evidence.md).
Use that document for scenario matrices, evidence bundle requirements, phase
runner expectations, and coverage accounting.

### Unit Tests

Use for:

- materialization key normalization
- memory projection rules
- restore projection filtering
- prompt-binding capture
- identity migration repair helpers
- business workflow context projection rules
- operator transition and trust-distribution projection rules

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
- lead/deal/setup return-to-source behavior
- first-run operator transition and referral QR/share behavior

### Data Repair Tests

Use for:

- rebuilding workspace snapshots
- rebuilding memory projections
- reindexing transcript recall
- repairing anonymous ownership drift

### Fault-Induction Tests

Use for:

- old transcript parts that look executable but must render as history only
- stale or empty browser runtime cache
- missed job events and restore reconciliation
- duplicate materialization requests under retry pressure
- partial identity migration followed by idempotent repair
- memory correction, retraction, and supersession
- disabled affiliate access, stale referral cookie, invalid QR code, and admin
  credit-review exception handling

### Release Evidence Runner

Use for:

- summarizing deterministic, integration, browser, and fault-induction gates
- recording skipped live or long-running gates explicitly
- retaining command exit codes and output tails
- writing `release/conversation-refactor-evidence.json`
- proving the package state without manually reconstructing which suites ran

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
- business workflow context preserves small-business momentum
- operator transition helps a user move from setup or uncertainty to first
  economic motion
- trust distribution preserves QR/referral context across visit, chat,
  registration, restore, and follow-up

## Definition Of Done

The validation strategy is complete when every implementation phase can name:

- the state it owns
- the state it must not own
- the restore proof
- the migration proof
- the no-duplicate-work proof
- the browser-cache-disposable proof
- the evidence artifact or runner command that proves the phase closed
- the business workflow proof when a phase changes task-origin, lifecycle,
  notification, failed-send, or related business-object behavior
- the operator-transition and trust-distribution proof when a phase changes
  install, first-run, referral, QR, affiliate, profile, or onboarding behavior
