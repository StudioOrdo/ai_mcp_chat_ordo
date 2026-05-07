# Ordo Canonical UX Governance Package

Status: Planned
Created: 2026-05-05

## Purpose

This package turns the current UX canon and planning package into executable
Ordo phases.

The target is the final authenticated product shape for the solopreneur:

- chat operates the system,
- UI surfaces govern what chat starts,
- every major section has a brief,
- every major section has a second-column evidence/object selector,
- every selected object has one focused detail pane,
- every claim links to evidence,
- admin diagnostics stay role-gated,
- backup/restore-grade command/result/reconcile discipline becomes the model
  for background brief intelligence.

## Governing Contracts

- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/prompt.md`
- `docs/_business/ordo_process.md`

## Current Planning Inputs

- `docs/_refactor/planning/00-current-code-grounding.md`
- `docs/_refactor/planning/01-chat-first-shell-and-mobile-menu.md`
- `docs/_refactor/planning/02-global-section-brief-and-second-column-pattern.md`
- `docs/_refactor/planning/03-studio-media-jobs-consolidation.md`
- `docs/_refactor/planning/04-system-admin-jobs-backups-restore.md`
- `docs/_refactor/planning/05-account-profile-referrals-preferences.md`
- `docs/_refactor/planning/06-brief-generation-and-background-intelligence.md`
- `docs/_refactor/planning/07-clean-architecture-and-shared-components.md`
- `docs/_refactor/planning/08-implementation-sequence-and-test-plan.md`
- `docs/_refactor/planning/09-today-brief-and-decision-surface.md`
- `docs/_refactor/planning/10-brief-executor-pattern-from-rust-backup-restore.md`

## Phase Numbering

The work continues the existing `01c3` authenticated workspace sequence.

Existing implemented subphases reached `01c3aa` and `01c3ab`. This package
continues with `01c3ac` so the chronology remains readable and the future
implementation prompt can point at one phase file at a time.

## Package Contents

- `phase-plan.md` - dependency-ordered execution plan.
- `validation-checklist.md` - package-level QA and closeout checks.
- `../phases/01c3ac-*` through `../phases/01c3ap-*` - implementable phase specs.

## Implementation Rule

Do not build new feature islands.

Every phase must either:

1. extract a shared shell/section/detail/read-model primitive,
2. migrate an existing donor surface into the canonical pattern,
3. add durable evidence/brief infrastructure,
4. or close out/prune the stale surface after replacement tests pass.

If a page cannot answer "what is the brief, what is the evidence index, what is
selected, and where is the trail/provenance?" it is not done.
