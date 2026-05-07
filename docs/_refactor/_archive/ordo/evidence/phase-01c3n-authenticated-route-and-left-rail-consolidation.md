# Phase 01c3n Evidence: Authenticated Route And Left Rail Consolidation

Generated: 2026-05-05

## Result

Status: Passed

The authenticated shell now has one owner navigation model:

- Today -> `/workspace`
- Studio -> `/studio`
- People -> `/business`
- Offers -> `/offers`
- Profile -> `/profile`

Staff/admin users get an additional visually separate admin rail group:

- Admin -> `/admin`
- Factory -> `/operations/media`
- System -> `/admin/system`

Jobs, Activity, My Media, Referrals, Operations, and logs remain direct donor
routes or diagnostics. They are not regular owner-primary navigation.

## Product Kernel Verification

Governing contract:

- `docs/_business/ux/08-product-kernel-contract.md`

Invariant verified:

- Chat is the operating interface.
- UI surfaces are the governance layer.
- Product navigation teaches Today, Studio, People, Offers, Profile.
- Jobs/notifications/activity/operations/logs surface as badges, cards,
  provenance, or admin diagnostics instead of owner apps.

## Files Changed

Implementation:

- `src/lib/shell/shell-navigation.ts`
- `src/components/SiteNav.tsx`
- `src/components/AppShell.tsx`
- `src/components/AuthenticatedWorkRail.tsx`
- `src/app/styles/shell.css`
- `src/components/business/BusinessWorkspace.tsx`
- `src/components/dashboard/UserDashboard.tsx`
- `src/app/business/page.tsx`
- `src/app/workspace/page.tsx`

Tests:

- `src/lib/shell/shell-navigation.test.ts`
- `tests/shell-navigation-model.test.ts`
- `src/components/AuthenticatedWorkRail.test.tsx`
- `src/components/SiteNav.test.tsx`
- `src/components/ShellWorkspaceMenu.test.tsx`
- `src/components/business/BusinessWorkspace.test.tsx`
- `src/components/dashboard/UserDashboard.test.tsx`
- `src/app/business/page.test.tsx`
- `src/app/workspace/page.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`
- `tests/shell-acceptance.test.tsx`
- `tests/shell-visual-system.test.tsx`
- `tests/browser-ui/home-shell-header.spec.ts`
- `tests/browser-ui/admin-shell-responsive.spec.ts`
- `tests/browser-ui/business-workspace.spec.ts`

Docs:

- `docs/_refactor/ordo/phases/01c3n-authenticated-route-and-left-rail-consolidation.md`
- `docs/_refactor/ordo/evidence/phase-01c3n-authenticated-route-and-left-rail-consolidation.md`

## QA Pass 1

Commands:

```bash
npx vitest run src/components/AuthenticatedWorkRail.test.tsx tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx tests/shell-acceptance.test.tsx tests/shell-visual-system.test.tsx
npx vitest run src/lib/shell/shell-navigation.test.ts tests/shell-navigation-model.test.ts tests/shell-command-parity.test.ts tests/shell-command-parity.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/ShellWorkspaceMenu.test.tsx src/components/AccountMenu.test.tsx tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx tests/shell-acceptance.test.tsx tests/shell-visual-system.test.tsx src/components/business/BusinessWorkspace.test.tsx src/app/business/page.test.tsx src/components/dashboard/UserDashboard.test.tsx src/app/workspace/page.test.tsx
npm run typecheck
npx eslint src/components/AuthenticatedWorkRail.tsx src/components/AppShell.tsx src/components/SiteNav.tsx src/components/business/BusinessWorkspace.tsx src/components/dashboard/UserDashboard.tsx src/lib/shell/shell-navigation.ts src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/ShellWorkspaceMenu.test.tsx tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx tests/shell-acceptance.test.tsx tests/shell-visual-system.test.tsx src/components/business/BusinessWorkspace.test.tsx src/app/business/page.test.tsx src/components/dashboard/UserDashboard.test.tsx src/app/workspace/page.test.tsx tests/shell-navigation-model.test.ts src/lib/shell/shell-navigation.test.ts
npx stylelint src/app/styles/shell.css
npx playwright test tests/browser-ui/home-shell-header.spec.ts tests/browser-ui/admin-shell-responsive.spec.ts tests/browser-ui/business-workspace.spec.ts
```

Issues found and fixed:

- `AuthenticatedWorkRail` initially rendered duplicate desktop and mobile link
  sets in the DOM, creating ambiguous accessible route links. Fixed by using one
  responsive rail body for desktop and mobile.
- `AuthenticatedWorkRail` test setup produced React act warnings because the
  attention-count request resolved after assertions. Fixed by making the badge
  count test async and keeping unrelated tests on a pending fetch stub.
- Browser specs still required the retired workspace drawer. Fixed
  `home-shell-header`, `admin-shell-responsive`, and `business-workspace`
  expectations to match the new public header, authenticated governance rail,
  and People vocabulary.
- The Playwright admin spec used `/api/auth/switch`, which is correctly denied
  to non-admin users in production mode. Fixed by promoting the Playwright
  account directly in the test database.

Result after fixes:

- Unit/focused suites passed.
- Typecheck passed.
- Focused ESLint passed.
- Focused stylelint passed.
- Focused Playwright browser suite passed.

## QA Pass 2

Commands:

```bash
npx vitest run src/lib/shell/shell-navigation.test.ts tests/shell-navigation-model.test.ts tests/shell-command-parity.test.ts tests/shell-command-parity.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/ShellWorkspaceMenu.test.tsx src/components/AccountMenu.test.tsx tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx tests/shell-acceptance.test.tsx tests/shell-visual-system.test.tsx src/components/business/BusinessWorkspace.test.tsx src/app/business/page.test.tsx src/components/dashboard/UserDashboard.test.tsx src/app/workspace/page.test.tsx
npm run typecheck
npx eslint src/components/AuthenticatedWorkRail.tsx src/components/AppShell.tsx src/components/SiteNav.tsx src/components/business/BusinessWorkspace.tsx src/components/dashboard/UserDashboard.tsx src/lib/shell/shell-navigation.ts src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/ShellWorkspaceMenu.test.tsx tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx tests/shell-acceptance.test.tsx tests/shell-visual-system.test.tsx src/components/business/BusinessWorkspace.test.tsx src/app/business/page.test.tsx src/components/dashboard/UserDashboard.test.tsx src/app/workspace/page.test.tsx tests/shell-navigation-model.test.ts src/lib/shell/shell-navigation.test.ts tests/browser-ui/home-shell-header.spec.ts tests/browser-ui/admin-shell-responsive.spec.ts tests/browser-ui/business-workspace.spec.ts
npx stylelint src/app/styles/shell.css
npx playwright test tests/browser-ui/home-shell-header.spec.ts tests/browser-ui/admin-shell-responsive.spec.ts tests/browser-ui/business-workspace.spec.ts
```

Stale-surface/static scans:

```bash
rg -n "ShellWorkspaceMenu|data-shell-workspace-menu|workspace-menu|Open workspace menu" src tests --glob '!node_modules'
rg -n "Jobs|Activity|My Media|Referrals|Media Ops|Open attention inbox|data-attention-inbox|data-jobs-rail" src/components/AuthenticatedWorkRail.tsx src/components/SiteNav.tsx src/components/AppShell.tsx src/components/dashboard src/components/business src/components/studio src/lib/shell tests/shell-acceptance.test.tsx tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx tests/browser-ui/home-shell-header.spec.ts tests/browser-ui/admin-shell-responsive.spec.ts --glob '!node_modules'
rg -n "inputSnapshot|provider log|runtime log|raw log|job_[A-Za-z0-9_:-]+|asset_[A-Za-z0-9_:-]+" src/components/dashboard src/components/studio src/components/business src/components/AuthenticatedWorkRail.tsx src/components/SiteNav.tsx --glob '!*.test.ts' --glob '!*.test.tsx'
rg -n "Dashboard|Business" src/components/AuthenticatedWorkRail.tsx src/components/SiteNav.tsx src/components/business src/components/dashboard src/app/business src/app/workspace src/lib/shell tests/shell-acceptance.test.tsx tests/homepage-shell-ownership.test.tsx tests/site-shell-composition.test.tsx tests/browser-ui/business-workspace.spec.ts --glob '!node_modules'
```

Classification:

- `ShellWorkspaceMenu` remains as a donor component and in direct donor tests,
  but `SiteNav` no longer renders it as the public/signed-in primary switcher.
- Browser and unit test hits for `Open workspace menu` are negative assertions
  or donor component tests.
- `Jobs`, `Activity`, `My Media`, `Referrals`, and `Media Ops` remain in
  `src/lib/shell/shell-navigation.ts` as donor/diagnostic route definitions and
  in tests that assert they do not appear in the owner rail.
- `AuthenticatedWorkRail` uses job and attention read models only for badges.
  It does not mount `JobsRail` or `AttentionInbox`.
- Runtime/input leak scan found no regular owner UI leaks for raw provider
  logs, raw runtime logs, `inputSnapshot`, raw job IDs, or raw asset IDs in the
  touched owner surfaces.
- `Business` remains in code-internal route/component names and the existing
  `business_loop` bucket. Owner-facing route language now says People where
  this phase owns the surface.

QA pass 2 issues:

- No new implementation issues found.

## Known Non-Blocking Build Warnings

Focused Playwright runs invoke `next build`. The build still emits existing
Turbopack/NFT tracing warnings in:

- `src/lib/user-files.ts`
- `src/lib/appliance/native/native-binary-registry.ts`
- `next.config.ts`

Those warnings predate this phase and are unrelated to authenticated route
consolidation.
