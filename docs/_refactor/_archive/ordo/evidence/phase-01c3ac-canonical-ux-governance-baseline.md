# Phase 01c3ac Evidence: Canonical UX Governance Baseline

Date: 2026-05-05

Status: Implemented

## Scope

This phase refreshed the current implementation baseline before the remaining
canonical UX governance phases start. It did not change product UI or durable
data models.

The governing invariant remains:

> Chat is the operating interface. UI surfaces are the governance layer.

## Code Files Changed

- None.

## Documentation Files Changed

- `docs/_refactor/ordo/phases/01c3ac-canonical-ux-governance-baseline.md`
- `docs/_refactor/ordo/canonical-ux-governance/phase-plan.md`
- `docs/_refactor/ordo/evidence/phase-01c3ac-canonical-ux-governance-baseline.md`

## Current Surface Classification

| Surface | Classification | Current code anchors | Notes |
| --- | --- | --- | --- |
| Public top navigation | Implemented | `src/components/SiteNav.tsx`, `src/components/public/PublicRouteLinks.tsx`, `src/lib/shell/shell-navigation.ts` | Center nav is public-only. Feed is conditional through the public shell context. |
| Authenticated owner rail | Partially aligned | `src/components/AuthenticatedWorkRail.tsx`, `src/lib/shell/shell-navigation.ts`, `src/app/styles/shell.css` | Owner rail shows Today, Studio, People, Offers, About. It is missing Ordo Chat first and uses a mobile bottom rail instead of the canonical hamburger. |
| Admin rail | Partially aligned | `src/components/AuthenticatedWorkRail.tsx`, `src/lib/shell/shell-navigation.ts` | Role-gated admin links exist, but the visible label for `operations-media` is still `Factory`; canonical label should be Jobs or another admin-safe section label. |
| Account menu | Partially aligned | `src/components/AccountMenu.tsx`, `src/lib/shell/shell-navigation.ts` | Theme toggle is in the header and sign out is separated. Current visible links are My account, My media, and My Referrals. Canonical account menu should remove My media and include Preferences through the Account surface. |
| Legacy shell workspace menu | Stale/donor-only | `src/components/ShellWorkspaceMenu.tsx`, `src/components/ShellWorkspaceMenu.test.tsx` | Not mounted by `SiteNav`. Keep as donor code until the shell/mobile phase either deletes or replaces it. |
| Legacy shell nav drawer | Stale/donor-only | `src/components/ShellNavDrawer.tsx` | Not mounted by `SiteNav`. It should not be treated as current product truth. |
| Today | Partially aligned | `src/components/dashboard/UserDashboard.tsx`, `src/lib/dashboard/load-user-dashboard.ts` | Already uses a second-column evidence index and selected object detail. Still uses dashboard naming in code/tests and needs the canonical section brief framework. |
| Studio | Partially aligned | `src/components/studio/StudioWorkspace.tsx`, `src/lib/studio/load-studio-workspace.ts` | Already consolidates generated media, workflows, and work objects. Needs the shared framework and stronger object-detail/provenance actions. |
| People | Implemented/aligned donor | `src/components/business/BusinessWorkspace.tsx`, `src/lib/business/load-business-workspace.ts` | Strongest current example of the target selector/detail pattern. It should be used as a donor for later sections. |
| Offers | Partially aligned | `src/components/offers/OfferSurfaces.tsx`, `src/lib/offers/load-offers-workspace.ts` | Public offers are clean. Owner offers still use a page-specific dashboard/form/card layout instead of canonical brief + selector + detail. |
| Account/Profile | Partially aligned | `src/components/profile/ProfileSettingsPanel.tsx`, `src/app/profile/page.tsx` | User info, referral code, and preferences sections exist. Route naming still says profile in code and metadata. |
| My media | Donor-only | `src/components/media/UserMediaWorkspace.tsx`, `src/lib/media/user-media.ts`, `src/app/my/media/page.tsx` | Useful media preview/delete donor, but canonical Studio should own media. This should not remain a primary account menu link. |
| Admin overview/System | Partially aligned/diagnostic-only | `src/app/admin/page.tsx`, `src/app/admin/system/**` | Role-gated admin surfaces exist and may expose diagnostics. Needs canonical System sections, including backups and restore. |
| Backup/restore | Implemented diagnostic foundation | `src/lib/appliance/backup/**`, `src/app/admin/system/backups/**` | Durable command/result/reconcile architecture exists and should be the model for later brief/background intelligence. |

## Current Route And Menu Labels

### Public Top Navigation

Current center/public nav:

- `Offers` -> `/offers`
- `About` -> `/about`
- `Feed` -> `/feed`, only when public content exists

The brand links to the home/chat entry route. Public top navigation does not
show Jobs, Activity, Library, Referrals, Operations, Blog, Journal, or Profile.

### Owner Rail

Current owner rail order:

- `Today` -> `/workspace`
- `Studio` -> `/studio`
- `People` -> `/business`
- `Offers` -> `/offers`
- `About` -> `/about`

Conflict: `Ordo Chat` is not first.

### Admin Rail

Current admin rail:

- `Admin` -> `/admin`
- `Factory` -> `/operations/media`
- `System` -> `/admin/system`

Conflict: `Factory` is visible in the admin rail even though canonical language
requires the top-level admin label to be `Jobs` or `System`, with Factory kept
internal/diagnostic.

### Account Menu

Current authenticated account menu:

- `My account` -> `/profile`
- `My media` -> `/my/media`
- `My Referrals` -> `/profile?section=referrals`
- Theme toggle in the menu header
- `Sign out`

Conflicts:

- `My media` should move into Studio and leave the account menu.
- `Preferences` is implemented inside `/profile` but not directly exposed as a
  menu item.
- `profile` remains the route id and code name, even though the visible product
  concept is Account/User info.

Stale/non-visible account route definitions still exist for My conversations,
My offers, My content, and Preferences.

## Conflict Ledger

| Contract area | Current state | Required follow-up phase |
| --- | --- | --- |
| Ordo Chat first | Missing from owner rail. Chat remains available through home/root surfaces, not as the first authenticated workspace item. | `01c3ad-chat-first-shell-grid-and-mobile-menu.md` |
| Account menu route set | Current menu still exposes My media and omits Preferences. | `01c3ad`, then `01c3af-account-user-info-referrals-preferences.md` |
| Hamburger mobile nav | Authenticated mobile uses fixed bottom rail from `src/app/styles/shell.css`. | `01c3ad` |
| Section brief base route | Today and Studio have partial overview/brief behavior; Offers/Account/System are not yet uniform. | `01c3ae`, then section migrations |
| Second-column evidence index | People, Today, Studio, Account/Profile, Media, and Admin have variations. Offers remains page-specific. | `01c3ae` through `01c3ak` |
| Selected object detail | Today, Studio, People, Account/Profile, Media, and Admin have variations. Shared object detail headers/actions are not yet extracted. | `01c3al-cross-section-object-detail-provenance-actions.md` |
| Admin diagnostics boundary | Admin/System are role-gated, but the visible admin rail still says Factory. Raw diagnostic vocabulary remains in diagnostic routes and tests. | `01c3ad`, `01c3ak`, `01c3ao` |

## Test Inventory

| Surface | Current focused tests |
| --- | --- |
| Public nav | `src/components/SiteNav.test.tsx` |
| Owner/admin rail | `src/components/AuthenticatedWorkRail.test.tsx` |
| Account menu | `src/components/AccountMenu.test.tsx` |
| Today | `src/components/dashboard/UserDashboard.test.tsx`, `src/app/workspace/page.test.tsx` |
| Studio | `src/components/studio/StudioWorkspace.test.tsx` |
| People | `src/components/business/BusinessWorkspace.test.tsx` |
| Account/Profile | `src/components/profile/ProfileSettingsPanel.test.tsx`, `src/app/profile/page.test.tsx` |
| Media donor | `src/components/media/UserMediaWorkspace.test.tsx`, `src/app/my/media/page.test.tsx`, `src/lib/media/user-media.test.ts` |
| Offers | `src/components/offers/OfferSurfaces.test.tsx`, `src/lib/offers/load-offers-workspace.test.ts` |
| Admin/System | `src/app/admin/page.test.tsx`, `src/app/admin/system/page.test.tsx`, `src/app/admin/system/backups/page.test.tsx`, `src/app/admin/system/operations/page.test.tsx`, `src/app/admin/system/keys/KeysManager.test.tsx` |
| Backup/restore architecture | `src/lib/appliance/backup/**.test.ts`, `src/core/use-cases/tools/appliance-backup.tool.test.ts` |

## Static Scan Results

Required scan:

```bash
rg -n "My media|My conversations|My offers|My content|Factory|Operations|Jobs|Activity|Profile|Dashboard" src tests docs/_refactor/ordo docs/_business/ux
```

Result:

- The initial scan returned 4,395 matches before this evidence document was
  added.
- The final QA pass 2 scan returned 4,426 matches after this evidence document
  intentionally recorded the stale labels and diagnostic terms.
- Most matches are expected in docs, tests, internal operation/factory code,
  diagnostic admin surfaces, and implementation entity names.
- Product-relevant findings for later phases:
  - `src/lib/shell/shell-navigation.ts` still defines visible/donor route labels
    for `My media`, `My content`, `My conversations`, `My offers`, and
    `operations-media`.
  - `src/components/AccountMenu.tsx` still includes `my-media` in the
    authenticated menu route set.
  - `src/components/AuthenticatedWorkRail.tsx` maps `operations-media` to the
    visible label `Factory`.
  - Account/menu tests still assert `My media` is visible.
  - Historical phase docs before the canonical package still contain the older
    Dashboard/Factory/My media vocabulary and should not be treated as current
    product contract.

## QA Pass 1

Commands run:

```bash
rg -n "My media|My conversations|My offers|My content|Factory|Operations|Jobs|Activity|Profile|Dashboard" src tests docs/_refactor/ordo docs/_business/ux
npm run test -- src/components/AccountMenu.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/dashboard/UserDashboard.test.tsx src/components/studio/StudioWorkspace.test.tsx src/components/media/UserMediaWorkspace.test.tsx
```

Results:

- Static scan completed and produced the 4,395-match baseline above.
- Focused Vitest suite passed: 6 files, 36 tests.

Issues found and fixed:

- No code issues were fixed in QA pass 1 because this phase is a baseline
  evidence phase.
- Documentation was updated to classify the scan results as contract conflicts,
  donor routes, diagnostics, or historical docs.

## QA Pass 2

Commands run:

```bash
rg -n "My media|My conversations|My offers|My content|Factory|Operations|Jobs|Activity|Profile|Dashboard" src tests docs/_refactor/ordo docs/_business/ux
npm run test -- src/components/AccountMenu.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/dashboard/UserDashboard.test.tsx src/components/studio/StudioWorkspace.test.tsx src/components/media/UserMediaWorkspace.test.tsx
```

Results:

- Static scan completed and returned 4,426 matches after this evidence document
  was added. The increased count is expected because the evidence document
  intentionally names the current conflicts.
- Focused Vitest suite passed: 6 files, 36 tests.

Issues found and fixed:

- QA pass 2 found no new implementation issues.
- Updated this evidence document to replace the pending QA pass 2 placeholder
  with the final scan and test results.

## Dependency Impact

The current code does not invalidate the planned dependency order. It confirms
the package sequence:

1. `01c3ad` must fix shell/menu/mobile route truth first.
2. `01c3ae` should extract shared section primitives before more page-specific
   refactors.
3. `01c3af` through `01c3ak` should migrate Account, Today, Studio, Offers,
   About, and System onto that shared framework.
4. `01c3am`/`01c3an` should model durable brief generation on the existing
   backup/restore command/result/reconcile architecture.

## Remaining Risks

- Several phase docs before the canonical UX package still contain older
  vocabulary. Treat `docs/_business/ux/08-product-kernel-contract.md` and
  `docs/_business/ux/09-canonical-ux-architecture.md` as higher-priority
  contracts.
- `ShellWorkspaceMenu` and `ShellNavDrawer` remain in the codebase as stale
  donor components. The shell phase must either replace or explicitly retire
  them.
- The account menu and tests still encode My media as visible. This is a known
  target for `01c3ad`/`01c3af`, not a hidden regression.
- The admin rail still says Factory. This is a known target for `01c3ad`.
- Typecheck/lint were not run in this doc-only phase because no application
  code changed.
