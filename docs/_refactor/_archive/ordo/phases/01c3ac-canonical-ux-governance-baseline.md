# Phase 01c3ac: Canonical UX Governance Baseline

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3aa-menu-aesthetic-and-focus-polish.md`
- `01c3ab-media-workspace-object-detail-and-selector-polish.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_refactor/ordo/canonical-ux-governance/README.md`

Blocks:

- `01c3ad-chat-first-shell-grid-and-mobile-menu.md`

## Goal

Refresh the current implementation evidence and reconcile stale phase/package
claims before the remaining canonical UX work begins.

This phase does not implement product UI unless the grounding finds a small
broken documentation or route-contract mismatch that must be fixed to make the
next phase safe.

## Product Rule

Chat is the operating interface. UI surfaces are the governance layer.

The baseline must prove exactly where current code already satisfies that rule
and where the current implementation still violates it.

## Current Code Grounding

Research and update evidence for:

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
- `src/app/admin/page.tsx`
- `src/app/admin/system/**`
- `src/components/offers/**`
- `src/lib/dashboard/load-user-dashboard.ts`
- `src/lib/studio/load-studio-workspace.ts`
- `src/lib/business/load-business-workspace.ts`
- `src/lib/offers/**`
- `src/lib/media/user-media.ts`
- `src/lib/appliance/backup/**`

## Required Work

1. Create `docs/_refactor/ordo/evidence/phase-01c3ac-canonical-ux-governance-baseline.md`.
2. Classify every major authenticated surface:
   - implemented,
   - partially aligned,
   - stale,
   - donor-only,
   - diagnostic-only.
3. Record exact tests that currently cover each surface.
4. Record the current route labels and account-menu labels.
5. Record every remaining conflict with:
   - Ordo Chat first,
   - account menu route set,
   - hamburger mobile nav,
   - section brief base route,
   - second-column evidence index,
   - selected object detail,
   - admin diagnostics boundary.
6. Update this phase and the package docs if the current code invalidates any
   planned phase dependency.

## Tests

Run targeted static scans:

```bash
rg -n "My media|My conversations|My offers|My content|Factory|Operations|Jobs|Activity|Profile|Dashboard" src tests docs/_refactor/ordo docs/_business/ux
```

Run current focused tests where they exist:

```bash
npm run test -- src/components/AccountMenu.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/dashboard/UserDashboard.test.tsx src/components/studio/StudioWorkspace.test.tsx src/components/media/UserMediaWorkspace.test.tsx
```

## Non-Goals

- Do not refactor shell, Today, Studio, Account, Offers, or System in this
  phase.
- Do not delete donor routes.
- Do not change durable data models.

## Closeout Evidence Required

- Current-code anchor table.
- Test inventory.
- Stale-language scan results.
- Dependency changes for later phases.
- Explicit list of implementation risks.

## Implementation Evidence

- Created
  `docs/_refactor/ordo/evidence/phase-01c3ac-canonical-ux-governance-baseline.md`.
- Classified the current public shell, owner rail, admin rail, account menu,
  stale drawer/menu donors, Today, Studio, People, Offers, Account/Profile,
  media donor route, Admin/System, and backup/restore foundation.
- Recorded current route labels and visible account-menu labels.
- Recorded the remaining conflicts with Ordo Chat first, account-menu route
  set, hamburger mobile nav, section briefs, second-column evidence indexes,
  selected object details, and admin diagnostics.
- Confirmed the existing dependency plan remains valid: `01c3ad` should follow
  this baseline.
