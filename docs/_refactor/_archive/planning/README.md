# Ordo Shell And Governance Planning Package

Status: Draft planning package

Evidence date: 2026-05-05

## Purpose

This folder captures the current-code archeology and ideal UX architecture for
the next Ordo shell refactor.

The work is larger than one page fix. The current app has many useful parts,
but the product shape needs one consistent governance model:

- chat is the operating interface,
- UI surfaces are the governance layer,
- every authenticated section uses the same shell pattern,
- every section has an overview brief first,
- the second column selects evidence-backed objects,
- the main pane explains the selected object or the section brief,
- admin/system diagnostics are powerful but do not leak into regular owner UX.

## Governing Documents

- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`

## Current Planning Docs

1. `00-current-code-grounding.md`
   - Current route, component, loader, and donor-surface map.
2. `01-chat-first-shell-and-mobile-menu.md`
   - Desktop rail, mobile hamburger, account menu, Ordo Chat first.
3. `02-global-section-brief-and-second-column-pattern.md`
   - Shared section overview, selector column, detail pane, mobile drill-in.
4. `03-studio-media-jobs-consolidation.md`
   - Studio/media/job convergence and removal of `My media` as a primary user surface.
5. `04-system-admin-jobs-backups-restore.md`
   - System/Admin second-column redesign, Jobs naming, backups and restore.
6. `05-account-profile-referrals-preferences.md`
   - Account menu and profile/referral/preferences surface.
7. `06-brief-generation-and-background-intelligence.md`
   - Durable AI-updated brief model and evidence links.
8. `07-clean-architecture-and-shared-components.md`
   - DRY/SOLID component and read-model plan.
9. `08-implementation-sequence-and-test-plan.md`
   - Proposed phase order and regression strategy.
10. `09-today-brief-and-decision-surface.md`
   - Today-specific critique, target brief model, and decision/detail contract.
11. `10-brief-executor-pattern-from-rust-backup-restore.md`
   - How to reuse the backup/restore command-result-reconcile architecture for
     durable AI brief updates.

## Critical Planning Update

Today is the forcing function for the whole shell refactor.

The current Today implementation already has some of the target mechanics:

- second-column search,
- filter sheet,
- selectable item rows,
- object query state,
- mobile list/detail behavior.

The failure is the main-pane product model. Today still renders stacked
dashboard blocks instead of a concise section brief. The next implementation
must treat Today as a CEO command brief:

- the second column is the evidence index,
- the main pane is the interpretation layer,
- selected detail shows one object with why it matters, evidence, and the next
  action,
- background/generated briefs must follow the same command/result/reconcile
  rigor proven by the Rust backup and restore system.

## Product Shape In One Sentence

Ordo is a chat-operated business staff for individuals, with quiet governance
surfaces that show what Ordo knows, what it did, why it matters, what needs a
decision, and what should happen next.
