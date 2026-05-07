# Canonical UX Governance Phase Plan

Status: Planned
Date: 2026-05-05

## Phase Sequence

1. `../phases/01c3ac-canonical-ux-governance-baseline.md` - Implemented
   - Refresh current code/doc grounding, reconcile stale phase claims, and
     produce the final implementation map.

2. `../phases/01c3ad-chat-first-shell-grid-and-mobile-menu.md` - Implemented
   - Make Ordo Chat first, clean the desktop shell grid, replace mobile bottom
     assumptions with hamburger navigation, and finalize the account/admin
     route split.

3. `../phases/01c3ae-shared-governance-section-framework.md`
   - Extract the shared section layout, second-column selector, base brief
     state, selected detail state, filter sheet, and mobile back behavior.

4. `../phases/01c3af-account-user-info-referrals-preferences.md`
   - Convert `/profile` into Account with User info, My Referrals, and
     Preferences sections using the same second-column pattern.

5. `../phases/01c3ag-today-brief-and-decision-evidence-index.md`
   - Convert Today from dashboard stream to CEO daily brief plus
     intent-driven evidence index and selected item detail.

6. `../phases/01c3ah-studio-production-media-work-consolidation.md`
   - Consolidate Studio, media, jobs-as-work, workflows, content, and campaigns
     into one production surface with selected object details.

7. `../phases/01c3ai-offers-brief-selector-and-detail-governance.md`
   - Convert Offers into public/private/draft offer selector, Offer Brief, and
     selected offer detail with price and visibility governance.

8. `../phases/01c3aj-about-business-story-governance.md`
   - Convert About/business story management into a governed section that can
     support public copy, owner story, and future editing without polluting the
     public nav.

9. `../phases/01c3ak-system-admin-jobs-backups-restore-sections.md`
   - Convert Admin/System into role-gated sections for overview, health,
     providers, capabilities, visibility, backups, restore plans, jobs,
     operations, logs, and keys.

10. `../phases/01c3al-cross-section-object-detail-provenance-actions.md`
    - Standardize object detail headers, facts rows, actions, provenance,
      relationship trail, performance, visibility, and admin diagnostic links.

11. `../phases/01c3am-brief-read-model-storage-and-evidence-manifests.md`
    - Add the durable brief/read-model foundation, evidence refs, limitations,
      history, stale states, and manifest shape.

12. `../phases/01c3an-brief-executor-command-result-reconcile.md`
    - Add request/result/reconcile execution semantics for brief updates,
      modeled on backup/restore and ready for later Rust/native executors.

13. `../phases/01c3ao-canonical-ux-regression-closeout.md`
    - Run cross-section desktop/mobile/accessibility/static QA, update docs,
      prune or mark stale donor surfaces, and close the package.

14. `../phases/01c3ap-account-menu-password-and-affiliate-route-alignment.md`
    - Correct the post-shell account menu IA, move referral/QR out of Account
      and back to `/referrals`, and add the missing Change Password account
      section/API.

## Dependency Rules

- `01c3ad` depends on `01c3ac`.
- `01c3ae` depends on `01c3ad`.
- `01c3af` through `01c3ak` depend on `01c3ae`.
- `01c3al` depends on at least two migrated sections and must be applied
  across all migrated sections before closeout.
- `01c3am` can start after deterministic section briefs exist.
- `01c3an` depends on `01c3am` and the backup/restore command-result-reconcile
  grounding.
- `01c3ao` depends on every prior phase in this package.
- `01c3ap` depends on `01c3af` and should be completed before final closeout
  certification is treated as done.

## Stop Conditions

Stop a phase before implementation when:

- code grounding does not name exact files and tests;
- the phase would create a page-specific layout instead of shared primitives;
- the phase exposes raw jobs/logs/provider details in regular owner UI;
- a brief claim cannot link to evidence or a declared limitation;
- mobile list/detail navigation is not specified;
- public/private/staff/admin visibility boundaries are unclear;
- the implementation would remove a donor route before replacement tests pass.
