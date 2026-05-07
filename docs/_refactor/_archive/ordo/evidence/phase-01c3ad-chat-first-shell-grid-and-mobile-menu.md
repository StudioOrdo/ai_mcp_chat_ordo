# Phase 01c3ad Evidence: Chat-First Shell Grid And Mobile Menu

Date: 2026-05-05

Status: Implemented

## Scope

This phase aligned the global shell with the canonical UX contract:

> Chat is the operating interface. UI surfaces are the governance layer.

The work was limited to shell navigation, account menu, authenticated mobile
menu behavior, shell grid tokens, and focused shell tests. It did not migrate
section internals, create section briefs, delete donor routes, or change
durable product data.

## Code Files Changed

- `src/lib/shell/shell-navigation.ts`
- `src/components/AccountMenu.tsx`
- `src/components/AuthenticatedWorkRail.tsx`
- `src/components/SiteNav.tsx`
- `src/components/shell/ShellMobileMainMenu.tsx`
- `src/app/styles/shell.css`
- `src/components/AccountMenu.test.tsx`
- `src/components/AuthenticatedWorkRail.test.tsx`
- `src/components/SiteNav.test.tsx`
- `src/components/ShellWorkspaceMenu.test.tsx`
- `src/lib/shell/shell-navigation.test.ts`
- `tests/shell-visual-system.test.tsx`

## Documentation Files Changed

- `docs/_refactor/ordo/phases/01c3ad-chat-first-shell-grid-and-mobile-menu.md`
- `docs/_refactor/ordo/canonical-ux-governance/phase-plan.md`
- `docs/_refactor/ordo/evidence/phase-01c3ad-chat-first-shell-grid-and-mobile-menu.md`

## Route Contract Evidence

Authenticated owner rail route order:

1. `ordo-chat` -> `/` -> `Ordo Chat`
2. `workspace-overview` -> `/workspace` -> `Today`
3. `studio` -> `/studio` -> `Studio`
4. `business` -> `/business` -> `People`
5. `offers` -> `/offers` -> `Offers`
6. `business-about` -> `/about` -> `About`

Authenticated admin rail route order:

1. `admin-dashboard` -> `/admin` -> `Admin`
2. `admin-jobs` -> `/admin/jobs` -> `Jobs`
3. `admin-system` -> `/admin/system` -> `System`

Staff/non-admin users do not receive the admin rail route set. The donor
`operations-media` route remains addressable for existing diagnostic code but
is not the visible admin rail entry.

## Account Menu Evidence

Authenticated account route order:

1. `profile` -> `/profile` -> `User info`
2. `my-qr-referral` -> `/profile?section=referrals` -> `My Referrals`
3. `preferences` -> `/profile?section=preferences` -> `Preferences`

The account menu header contains the compact theme toggle. The authenticated
account menu no longer renders `My media`, `My conversations`, `My offers`,
`My content`, or `System`. Sign out remains separated below the account route
group.

## Mobile Menu Evidence

`src/components/shell/ShellMobileMainMenu.tsx` is mounted from `SiteNav` for
authenticated users. The menu:

- opens from the `Open main menu` hamburger button;
- renders an owner route group with Ordo Chat first;
- renders an admin route group only for users with admin permission;
- closes by backdrop, close button, Escape, or route navigation;
- uses `role="dialog"` and `aria-modal="true"` while open.

Focused component tests in `src/components/SiteNav.test.tsx` verify the mobile
hamburger opens the owner menu and that admin users see role-gated Admin, Jobs,
and System entries.

## Static Scan Results

Command:

```bash
rg -n "My media|My conversations|My offers|My content|Factory|data-authenticated-work-mobile-controls|ShellNavDrawer|ShellWorkspaceMenu|Open workspace menu" src/components/AccountMenu.tsx src/components/AuthenticatedWorkRail.tsx src/components/SiteNav.tsx src/components/shell/ShellMobileMainMenu.tsx src/lib/shell/shell-navigation.ts src/app/styles/shell.css src/components/AccountMenu.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/ShellWorkspaceMenu.test.tsx src/lib/shell/shell-navigation.test.ts tests/shell-visual-system.test.tsx
```

Result summary:

- `AccountMenu.tsx` contains none of the removed account-menu labels.
- `AuthenticatedWorkRail.tsx` contains no visible `Factory` label and no mobile
  controls region.
- `SiteNav.tsx` does not mount `ShellNavDrawer` or `ShellWorkspaceMenu`.
- `shell-navigation.ts` still defines donor route labels for `My media`,
  `My content`, `My conversations`, and `My offers`; those routes have no
  account visibility and remain available only as donor/internal route
  metadata for later migrations.
- Test matches for the removed labels are negative assertions or mock resolver
  payloads that prove the account menu ignores stale donor routes.
- `ShellWorkspaceMenu`/`ShellNavDrawer` names remain in donor component tests
  and shell route type names, but the current SiteNav product surface no
  longer mounts them.

## QA Pass 1

Commands run:

```bash
npm run test -- src/components/AccountMenu.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/lib/shell/shell-navigation.test.ts
npm run test -- tests/shell-visual-system.test.tsx src/components/ShellWorkspaceMenu.test.tsx src/components/AppShell.test.tsx tests/homepage-shell-layout.test.tsx tests/homepage-shell-ownership.test.tsx tests/homepage-shell-evals.test.tsx tests/site-shell-composition.test.tsx
npx eslint src/components/AccountMenu.tsx src/components/AuthenticatedWorkRail.tsx src/components/SiteNav.tsx src/components/shell/ShellMobileMainMenu.tsx src/lib/shell/shell-navigation.ts src/components/AccountMenu.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/ShellWorkspaceMenu.test.tsx src/lib/shell/shell-navigation.test.ts tests/shell-visual-system.test.tsx
npx stylelint src/app/styles/shell.css
npm run typecheck
```

Results:

- Phase test suite passed: 4 files, 40 tests.
- Focused related shell suite passed after fixes: 7 files, 44 tests.
- ESLint passed for touched TypeScript and test files.
- Stylelint passed for `src/app/styles/shell.css`.
- Typecheck passed.

Issues found and fixed:

- `AuthenticatedWorkRail.test.tsx` read badge text as part of rail labels.
  Fixed the assertion to read `.authenticated-work-rail-label` so badge counts
  remain layout evidence without changing the product label.
- `ShellWorkspaceMenu.test.tsx` expected one unique Offers/About link even
  though the donor drawer contains public and workspace groups. Fixed the donor
  assertion to verify that at least one matching route href exists.

## QA Pass 2

Commands run:

```bash
npm run test -- src/components/AccountMenu.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/lib/shell/shell-navigation.test.ts
npm run test -- tests/shell-visual-system.test.tsx src/components/ShellWorkspaceMenu.test.tsx src/components/AppShell.test.tsx tests/homepage-shell-layout.test.tsx tests/homepage-shell-ownership.test.tsx tests/homepage-shell-evals.test.tsx tests/site-shell-composition.test.tsx
rg -n "My media|My conversations|My offers|My content|Factory|data-authenticated-work-mobile-controls|ShellNavDrawer|ShellWorkspaceMenu|Open workspace menu" src/components/AccountMenu.tsx src/components/AuthenticatedWorkRail.tsx src/components/SiteNav.tsx src/components/shell/ShellMobileMainMenu.tsx src/lib/shell/shell-navigation.ts src/app/styles/shell.css src/components/AccountMenu.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/ShellWorkspaceMenu.test.tsx src/lib/shell/shell-navigation.test.ts tests/shell-visual-system.test.tsx
npx eslint src/components/AccountMenu.tsx src/components/AuthenticatedWorkRail.tsx src/components/SiteNav.tsx src/components/shell/ShellMobileMainMenu.tsx src/lib/shell/shell-navigation.ts src/components/AccountMenu.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/ShellWorkspaceMenu.test.tsx src/lib/shell/shell-navigation.test.ts tests/shell-visual-system.test.tsx
npx stylelint src/app/styles/shell.css
npm run typecheck
```

Final results:

- Phase test suite passed: 4 files, 40 tests.
- Focused related shell suite passed: 7 files, 44 tests.
- Static scan matched only expected donor route metadata, stale donor drawer
  names, mocks, and negative assertions. It found no visible removed account
  links in `AccountMenu.tsx`, no visible `Factory` label in
  `AuthenticatedWorkRail.tsx`, and no mounted drawer component in
  `SiteNav.tsx`.
- ESLint passed for touched TypeScript and test files.
- Stylelint passed for `src/app/styles/shell.css`.
- Typecheck passed.

Issues found and fixed:

- QA pass 2 found no new implementation issues.
- This evidence document was updated from pending QA results to final QA
  results after the reruns completed.

## Remaining Risks

- `ShellWorkspaceMenu` and `ShellNavDrawer` remain in the repository as donor
  components. They are not mounted in current `SiteNav`, but later closeout
  should either retire them or mark them explicitly as diagnostic/donor code.
- Donor route ids for My media/content/conversations/offers remain in
  `shell-navigation.ts` without account visibility. Later Studio, People,
  Offers, and Account phases should migrate or retire those donor routes.
- This phase uses component-level DOM evidence for mobile menu behavior rather
  than saved visual screenshots. Section-specific mobile list/detail behavior
  remains deferred to the shared governance section framework phase.
