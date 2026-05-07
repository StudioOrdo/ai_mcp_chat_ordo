# Conversation Refactor Phases

## Purpose

This folder turns the conversation refactor specifications into an executable
phase sequence.

The phase docs are intentionally not final implementation instructions. Each
phase must be refreshed before coding because the codebase will change as prior
phases land.

Use these files as the control system for the work:

```text
Collect -> Decide -> Spec -> QA -> Ground -> Phase QA -> Implement -> QA -> Update -> Repeat
```

## Operating Rules

1. No edit before diagnosis.
2. Every phase starts with context collection against the current codebase.
3. Every phase records rejected approaches and why they were rejected.
4. Every phase maps requirements to real files before implementation.
5. Every phase has pre-implementation QA and post-implementation QA.
6. Every completed phase updates later phases with what changed.
7. Every phase classifies proof as covered, partial, missing, misleading, or
   guarded before implementation begins.
8. Every phase that changes behavior adds or updates release evidence, not only
   local tests.

## Phase Sequence

1. [Phase 00: Baseline Inventory And Evidence](phase-00-baseline-inventory-and-evidence.md)
2. [Phase 01: Canonical Domain Contracts](phase-01-canonical-domain-contracts.md)
3. [Phase 02: Workspace Snapshot Projection](phase-02-workspace-snapshot-projection.md)
4. [Phase 02A: Business Workflow Context Projection](phase-02a-business-workflow-context-projection.md)
5. [Phase 02B: Operator Transition And Trust Distribution Projection](phase-02b-operator-transition-and-trust-distribution-projection.md)
6. [Phase 03: Restore Read Model And Idempotent Homepage](phase-03-restore-read-model-and-idempotent-homepage.md)
7. [Phase 04: Job Ledger And Materialization Registry](phase-04-job-ledger-and-materialization-registry.md)
8. [Phase 05: Asset Catalog And Reusable Outputs](phase-05-asset-catalog-and-reusable-outputs.md)
9. [Phase 06: Relationship Memory Projection](phase-06-relationship-memory-projection.md)
10. [Phase 07: Search Surface Split](phase-07-search-surface-split.md)
11. [Phase 08: Prompt Binding And Governance](phase-08-prompt-binding-and-governance.md)
12. [Phase 09: Identity Migration Privacy And Repair](phase-09-identity-migration-privacy-and-repair.md)
13. [Phase 10: Product Experience Cutover](phase-10-product-experience-cutover.md)
14. [Phase 11: Release Hardening And Next-Batch Planning](phase-11-release-hardening-and-learning-loop.md)
15. [Phase 12: Platform Vision Research And Recording](phase-12-platform-vision-research-and-recording.md)

## Required Phase Update Step

After each implementation phase closes, update:

- the completed phase with actual files changed and proofs run
- the next phase with new context, constraints, and rejected assumptions
- [../validation-strategy.md](../validation-strategy.md) if the proof model changed
- [../test-infrastructure-and-evidence.md](../test-infrastructure-and-evidence.md)
  if the test matrix, evidence bundle, or runner changed
- [../ROADMAP.md](../ROADMAP.md) if sequencing changed

## Test Infrastructure Rule

Use [../test-infrastructure-and-evidence.md](../test-infrastructure-and-evidence.md)
as the cross-phase QA contract.

The conversation phases should follow the later media package pattern:

- deterministic suites prove contracts and database behavior
- browser suites prove shipped product continuity
- fault-induction suites reproduce known weak seams
- release evidence records command outcomes, scenario matrices, and passing
  rules
- critical failures follow reproduce, explain, resolve, rerun

## Completion Standard

The current conversation package is complete only when each canonical surface is
implemented, verified, cut over, and handed off into a clearly scoped next
batch plan:

- `WorkspaceSnapshot`
- `JobLedger`
- `AssetCatalog`
- `MaterializationRecord`
- `RelationshipMemory`
- `PromptBinding`
- `BusinessWorkflowContext`
- `OperatorTransitionProfile`
- `TrustDistributionContext`
- identity migration events and repair state
- restore read model
- product UI projections
- next-batch specs and phase sequence seeded from the final package state
