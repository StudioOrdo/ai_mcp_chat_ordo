# Phase 01c3ao: Canonical UX Regression Closeout

Status: Planned

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3ac-canonical-ux-governance-baseline.md`
- `01c3ad-chat-first-shell-grid-and-mobile-menu.md`
- `01c3ae-shared-governance-section-framework.md`
- `01c3af-account-user-info-referrals-preferences.md`
- `01c3ag-today-brief-and-decision-evidence-index.md`
- `01c3ah-studio-production-media-work-consolidation.md`
- `01c3ai-offers-brief-selector-and-detail-governance.md`
- `01c3aj-about-business-story-governance.md`
- `01c3ak-system-admin-jobs-backups-restore-sections.md`
- `01c3al-cross-section-object-detail-provenance-actions.md`
- `01c3am-brief-read-model-storage-and-evidence-manifests.md`
- `01c3an-brief-executor-command-result-reconcile.md`
- `01c3ap-account-menu-password-and-affiliate-route-alignment.md`

Blocks:

- `01c4-admin-global-factory-navigation-rail.md` unless that phase is retired
  or rewritten around the canonical System/Admin contract.
- `02-public-feed-contract-and-replacement.md` if public/feed route behavior
  regresses.

## Goal

Close the canonical UX governance package with deterministic evidence that the
authenticated shell and major surfaces now follow the product kernel.

This is not a new feature phase. It is regression, documentation, stale-surface
classification, and closeout.

## Product Rule

Chat is the operating interface. UI surfaces are the governance layer.

The closeout must prove that every regular owner surface is a governance
surface over evidence, not a parallel operating system, dashboard dump, or raw
diagnostic console.

## Current Code Grounding

Re-check every area touched by the package before certifying closeout:

- `src/components/SiteNav.tsx`
- `src/components/AuthenticatedWorkRail.tsx`
- `src/components/AccountMenu.tsx`
- `src/components/ShellWorkspaceMenu.tsx`
- `src/components/ShellNavDrawer.tsx`
- `src/app/styles/shell.css`
- `src/components/dashboard/UserDashboard.tsx`
- `src/components/studio/StudioWorkspace.tsx`
- `src/components/media/UserMediaWorkspace.tsx`
- `src/components/profile/ProfileSettingsPanel.tsx`
- `src/components/offers/**`
- `src/app/admin/page.tsx`
- `src/app/admin/system/**`
- `src/lib/dashboard/load-user-dashboard.ts`
- `src/lib/studio/load-studio-workspace.ts`
- `src/lib/media/user-media.ts`
- `src/lib/offers/**`
- `src/lib/appliance/backup/**`
- package evidence docs under `docs/_refactor/ordo/evidence/**`

## Required Work

1. Run package-level static scans.
2. Run focused unit/component/loader tests for all touched sections.
3. Run mobile route/browser smoke tests for:
   - Ordo Chat/main nav,
   - Today,
   - Studio,
   - People,
   - Offers,
   - Account,
   - System.
4. Verify public nav remains minimal and Feed remains conditional.
5. Verify owner UI contains no raw diagnostic leaks.
6. Verify selected details do not show global section totals above objects.
7. Verify account menu route set: My Account, Change Password, header theme
   toggle, and Sign out only. Referral/QR routes must remain in `/referrals`
   and referral evidence surfaces, not Account.
8. Verify admin/system role gates.
9. Verify brief evidence/manifest behavior.
10. Update:
    - `docs/_refactor/ordo/canonical-ux-governance/README.md`,
    - `docs/_refactor/ordo/canonical-ux-governance/phase-plan.md`,
    - `docs/_refactor/ordo/canonical-ux-governance/validation-checklist.md`,
    - `docs/_refactor/ordo/phase-plan.md`,
    - `docs/_refactor/ordo/phases/README.md`,
    - package evidence docs.
11. Classify stale donor surfaces:
    - keep,
    - redirect,
    - hide,
    - admin-only,
    - prune candidate.

## Tests

Run phase-required tests from every package phase plus:

```bash
npm run typecheck
npm run lint:strict
npm run lint:css
```

Run static scans for:

```bash
rg -n "My media|My conversations|My offers|My content|Factory|Provider log|Command payload|Activity receipt" src tests docs/_refactor/ordo docs/_business/ux
```

Run browser/mobile smoke tests named or created by implementation phases.

## Acceptance Criteria

- Ordo Chat is first in authenticated navigation.
- Every major authenticated surface uses the canonical section model.
- Account route/menu behavior is canonical.
- Today is a brief/evidence/detail surface, not a dashboard stream.
- Studio owns media/work/jobs-as-work and selected media detail.
- Offers has public/private/draft governance.
- System has backups, restore plans, jobs, and diagnostics behind admin gates.
- Briefs are evidence-backed and failure-safe.
- Public nav is minimal.
- All required tests pass twice.

## Non-Goals

- Do not add new product capabilities.
- Do not implement feed/audio RSS or campaign analytics beyond existing phase
  scope.
- Do not prune donor routes until replacement tests pass.

## Closeout Evidence Required

- Full QA command list and results.
- Static scan results.
- Browser/mobile evidence.
- Stale surface ledger.
- Remaining explicit risks.
