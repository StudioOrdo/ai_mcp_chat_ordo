# Phase 01c3aq: Route Registry And Shell Contract Lock

Status: Implemented

Parent package:

- `02-ui-surface-realignment/09-implementation-phase-plan.md`

## Goal

Lock the shell route registry to the canonical public, owner, account, and admin
navigation contracts before deeper surface work continues. This phase prevents
donor routes and stale labels from leaking back into primary navigation.

## Governing Docs

- `docs/_refactor/ordo/letters/refactor1.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/00-route-and-surface-inventory.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/01-shell-and-menu-ia-alignment.md`

## Current Code Grounding

Code anchors:

- `src/lib/shell/shell-navigation.ts`
- `src/components/SiteNav.tsx`
- `src/components/AuthenticatedWorkRail.tsx`
- `src/components/shell/ShellMobileMainMenu.tsx`
- `src/components/AccountMenu.tsx`
- `src/components/public/PublicRouteLinks.tsx`
- `src/components/AppShell.tsx`
- `src/lib/shell/shell-navigation.test.ts`
- `src/components/SiteNav.test.tsx`
- `src/components/AuthenticatedWorkRail.test.tsx`
- `src/components/ShellWorkspaceMenu.test.tsx`
- `src/components/AccountMenu.test.tsx`

## Verified Current State

- `SHELL_ROUTES` is already the central route registry.
- Public nav is registry-driven and conditionally supports Feed.
- Account menu route ids are `profile` and `referrals`.
- Owner rail includes Conversations, Today, Studio, People, Offers, and About.
- Admin rail includes Admin, Jobs, and System.
- `ordo-chat` points to `/`, is labeled Conversations, and now targets the
  `business` surface with `conversation`/`person` object semantics instead of
  the stale public route semantics.
- `business-about` points to `/about` and now targets the public About surface
  instead of stale profile-settings semantics.
- Knowledge Base is intentionally absent from primary owner rail until its read
  model exists.

## Target Behavior

- Public top rail: Home through brand, Offers, About, Feed only when public
  content exists.
- Owner rail: Conversations, Today, Studio, People, Offers, About. Knowledge
  Base remains future/disabled until implemented.
- Account menu: My Account, Affiliate Dashboard, theme toggle, Sign out.
- Admin rail: Admin, Jobs, System.
- Hamburger is mobile-only and integrated into the brand zone.
- No donor route is present in public nav, account menu, or owner rail.

## Implementation Steps

1. Audit `SHELL_ROUTES` target surfaces, labels, dispositions, and route ids
   against the route decision matrix.
2. Correct stale target surface values for Conversations and owner About.
3. Add explicit tests for public, owner, account, and admin route groups.
4. Add negative tests for donor route leakage.
5. Keep Knowledge Base out of owner rail until phase `01c3ax`.
6. Verify hamburger/menu behavior is not rendered as a desktop account-side
   action.
7. Update this phase with implementation evidence.

## Positive Tests

- Public nav resolves Home, Offers, About, and conditional Feed.
- Owner rail resolves Conversations, Today, Studio, People, Offers, About.
- Account menu resolves My Account and Affiliate Dashboard.
- Admin rail resolves Admin, Jobs, System for admin users.
- Signed-in mobile shell exposes main menu from the brand zone.

## Negative Tests

- Public nav does not include Library, Blog, Journal, Jobs, Activity,
  Operations, Admin, System, Referrals, Profile, or Account-only routes.
- Account menu does not include Change Password, Preferences, System, My Media,
  My Conversations, My Offers, My Content, QR, Jobs, or Operations.
- Owner rail does not include Jobs, Activity, Operations, Library, Journal,
  Blog, Factory, Logs, Provider Keys, or raw diagnostics.
- Desktop does not show hamburger as a right-side floating action.

## Edge Tests

- Anonymous users see public nav and login/register access only.
- Owner users do not see admin rail items.
- Admin users see owner rail and admin rail without duplicate System account
  menu links.
- Feed route disappears from public nav when `hasPublicFeedItems` is false.
- Account menu closes on Escape and route changes.

## Acceptance Criteria

- Shell registry is the only source of truth for route group membership.
- Route target surfaces match product meaning.
- Donor routes are not exposed in primary IA.
- Shell tests fail if legacy/donor labels return.

## Non-Goals

- No new route implementation.
- No Knowledge Base route.
- No donor route redirects.
- No visual redesign beyond shell contract corrections required by tests.

## Required Commands

```bash
npx vitest run src/lib/shell/shell-navigation.test.ts src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/ShellWorkspaceMenu.test.tsx src/components/AccountMenu.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/lib/shell/shell-navigation.ts src/components/SiteNav.tsx src/components/AuthenticatedWorkRail.tsx src/components/shell/ShellMobileMainMenu.tsx src/components/AccountMenu.tsx src/components/public/PublicRouteLinks.tsx src/components/AppShell.tsx
```

## Static Scans

```bash
rg -n "My media|My conversations|My offers|My content|Change Password|Preferences|System|Factory|Activity|Operations|Library|Journal|Blog" src/components src/lib/shell
rg -n "ACCOUNT_MENU_ROUTE_IDS|AUTHENTICATED_WORK_RAIL_ROUTE_IDS|AUTHENTICATED_ADMIN_RAIL_ROUTE_IDS|PRIMARY_NAV_ROUTE_IDS" src/lib/shell/shell-navigation.ts
```

## Closeout Evidence Required

- Route group diff in `shell-navigation.ts`.
- Test output for shell navigation and shell components.
- Desktop shell screenshot showing no desktop hamburger.
- Mobile shell screenshot showing brand-zone menu.
- Updated notes in this phase documenting any route classification changes.

## Implementation Evidence

Code changed:

- `src/lib/shell/shell-navigation.ts`
  - Reclassified `ordo-chat` from `public` to `business`.
  - Added `conversation` and `person` object kinds to `ordo-chat`.
  - Reclassified `business-about` from `profile_settings` to `public`.
- `src/lib/shell/shell-navigation.test.ts`
  - Added explicit public, owner, account, and admin route-id lock tests.
  - Added donor/diagnostic/account leakage negative tests for primary nav,
    account menu, and owner rail.
  - Updated object-centered route assertions for Conversations and owner About.

QA pass 1:

- `npx vitest run src/lib/shell/shell-navigation.test.ts src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/ShellWorkspaceMenu.test.tsx src/components/AccountMenu.test.tsx`
  - Passed: 5 files, 48 tests.
- `npm run typecheck`
  - Passed.
- `npm run lint:css`
  - Passed.
- `npm run lint -- src/lib/shell/shell-navigation.ts src/components/SiteNav.tsx src/components/AuthenticatedWorkRail.tsx src/components/shell/ShellMobileMainMenu.tsx src/components/AccountMenu.tsx src/components/public/PublicRouteLinks.tsx src/components/AppShell.tsx`
  - Passed.
- `npm run lint -- src/lib/shell/shell-navigation.ts src/lib/shell/shell-navigation.test.ts`
  - Passed as an extra focused lint check for the touched test file.

QA pass 2:

- Re-ran the shell/navigation test group.
  - Passed: 5 files, 48 tests.
- Static scan:
  - `rg -n "My media|My conversations|My offers|My content|Change Password|Preferences|System|Factory|Activity|Operations|Library|Journal|Blog" src/components src/lib/shell`
  - Reviewed matches. Remaining hits are route definitions for donor/admin
    surfaces, negative test assertions, admin/diagnostic components, profile
    second-column sections, or public journal/library implementation files.
    They are not exposed through public nav, account menu, or owner rail route
    groups.
- Static scan:
  - `rg -n "ACCOUNT_MENU_ROUTE_IDS|AUTHENTICATED_WORK_RAIL_ROUTE_IDS|AUTHENTICATED_ADMIN_RAIL_ROUTE_IDS|PRIMARY_NAV_ROUTE_IDS" src/lib/shell/shell-navigation.ts`
  - Verified route groups remain centralized in `shell-navigation.ts`.

Screenshot note:

- No browser screenshot was captured in this registry-only implementation pass.
  Existing `SiteNav` DOM/CSS tests verify the mobile main menu is in the brand
  region, absent from the account region, and hidden at desktop breakpoints.
