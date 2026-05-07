# Phase 01c3aa Evidence: Menu Aesthetic And Focus Polish

Date: 2026-05-05

Status: Implemented

## Product Contract

Governing invariant:

- chat is the operating interface;
- UI surfaces are the governance layer.

This phase only changed shell/menu governance surfaces. It did not add new
business routes, new product concepts, fake metrics, or raw job/log/provider
details to regular owner UI.

## Code Changes

- `src/components/SiteNav.tsx`
  - Added authenticated shell marker for layout-specific CSS.
  - Kept top public nav public-only.
  - Kept account access in the top-right account menu.
- `src/components/public/PublicRouteLinks.tsx`
  - Removed heavy pill wrapper and made public links lighter.
- `src/components/AccountMenu.tsx`
  - Added route icons for retained account-owned routes, access, and sign-out
    rows.
  - Removed My conversations, My offers, My content, and System from the
    account menu.
  - Renamed the QR/referral account entry to My Referrals.
  - Moved Light/Dark into the menu header as a slide toggle.
  - Kept mobile account menu as a bottom sheet.
- `src/lib/shell/shell-navigation.ts`
  - Tightened the account menu resolver to My profile, My media, My Referrals,
    and Preferences.
  - Kept System in the authenticated left rail for authorized users.
- `src/components/business/BusinessWorkspace.tsx`
  - Replaced the local centered People grid with `shell-governance-grid`.
- `src/app/styles/shell.css`
  - Added `--shell-owner-rail-width` and
    `--shell-owner-secondary-column-width`.
  - Added reusable `shell-governance-grid`.
  - Joined authenticated top rail and left rail with simple background and
    hairline borders.
  - Put the authenticated brand in the shell corner spanning owner rail plus
    second-column width.
  - Changed desktop owner rail to icon + label rows with a thin active
    indicator.
  - Reduced account dropdown radius, motion, and shadow.

## Test Changes

- `src/components/AccountMenu.test.tsx`
  - Covers retained route icons, omitted account routes, the My Referrals label,
    the header theme toggle, Login, and Register.
- `src/components/SiteNav.test.tsx`
  - Covers authenticated shell marker and global shell geometry CSS primitives.
- `src/lib/shell/shell-navigation.test.ts`
  - Covers the account menu route set and authenticated left rail System
    behavior.
- `tests/shell-navigation-model.test.ts`
  - Covers account-menu absence for conversations, offers, content, and System.
- `tests/browser-ui/business-workspace.spec.ts`
  - Covers mobile owner rail and account menu contract in the browser.

## QA Pass 1

Commands run:

- `npm run test -- src/components/AccountMenu.test.tsx tests/shell-visual-system.test.tsx src/lib/shell/shell-navigation.test.ts tests/shell-navigation-model.test.ts src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx`
- `npm run typecheck`
- `npx eslint src/components/AccountMenu.tsx src/lib/shell/shell-navigation.ts src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.test.ts tests/shell-visual-system.test.tsx tests/shell-navigation-model.test.ts`
- `npm run lint:css`
- `rg -n "\b(Jobs|Operations|Logs|Activity|Library)\b" src/components/SiteNav.tsx src/components/AuthenticatedWorkRail.tsx src/components/AccountMenu.tsx src/components/public/PublicRouteLinks.tsx src/app/styles/shell.css || true`
- `rg -n "My conversations|My offers|My content|My QR / referral link|data-account-menu-route=\"admin-system\"|admin-system" src/components/AccountMenu.tsx src/components/SiteNav.tsx src/components/public/PublicRouteLinks.tsx tests/browser-ui/business-workspace.spec.ts || true`
- `rg -n "Date\.now|Math\.random|toLocale|<script|dangerouslySetInnerHTML|typeof window" src/components/SiteNav.tsx src/components/AuthenticatedWorkRail.tsx src/components/AccountMenu.tsx src/components/public/PublicRouteLinks.tsx src/components/business/BusinessWorkspace.tsx src/app/styles/shell.css || true`

Results:

- Focused Vitest suite: passed, 50 tests after stale assertion fixes.
- Typecheck: passed.
- Focused eslint: passed.
- Stylelint: passed.
- Stale owner-shell label scan: no matches.
- Account-menu stale route scan: only intentional negative Playwright
  assertions remained before the browser spec was updated.
- Hydration-prone pattern scan: only `typeof window` inside an AccountMenu
  `useEffect` media-query guard; accepted because it does not affect SSR text
  output.

Issues found and fixed in QA pass 1:

- Visual/product review found the account menu still duplicated workspace
  domains and admin navigation: My conversations, My offers, My content, and
  System were present, and Theme was a regular menu row.
- Fixed by tightening `resolveAccountMenuRoutes`, removing the stale account
  menu branches, renaming QR/referral access to My Referrals, and moving Theme
  to a header slide toggle.
- Browser expectations still asserted My conversations and My QR / referral
  link. Fixed the browser smoke to assert My media, My Referrals, Preferences,
  the theme toggle, and absence of removed account routes.
- A shell visual test needed to account for the theme control moving into the
  account menu header. Updated the test to cover the header slide toggle.

Known unrelated observations:

- Production build during Playwright emitted existing Turbopack broad file
  tracing warnings in storage/native registry code. These are outside this
  shell/menu phase.

## QA Pass 2

Commands run after all fixes:

- `npm run test -- src/components/AccountMenu.test.tsx tests/shell-visual-system.test.tsx src/lib/shell/shell-navigation.test.ts tests/shell-navigation-model.test.ts src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx tests/site-shell-composition.test.tsx src/components/business/BusinessWorkspace.test.tsx`
- `npm run typecheck`
- `npx eslint src/components/AccountMenu.tsx src/lib/shell/shell-navigation.ts src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.test.ts tests/shell-visual-system.test.tsx tests/shell-navigation-model.test.ts src/components/SiteNav.tsx src/components/public/PublicRouteLinks.tsx src/components/business/BusinessWorkspace.tsx tests/browser-ui/business-workspace.spec.ts`
- `npm run lint:css`
- `npx playwright test tests/browser-ui/business-workspace.spec.ts`
- `rg -n "\b(Jobs|Operations|Logs|Activity|Library)\b" src/components/SiteNav.tsx src/components/AuthenticatedWorkRail.tsx src/components/AccountMenu.tsx src/components/public/PublicRouteLinks.tsx src/app/styles/shell.css || true`
- `rg -n "My conversations|My offers|My content|My QR / referral link|data-account-menu-route=\"admin-system\"|admin-system" src/components/AccountMenu.tsx src/components/SiteNav.tsx src/components/public/PublicRouteLinks.tsx tests/browser-ui/business-workspace.spec.ts || true`
- `rg -n "Date\.now|Math\.random|toLocale|<script|dangerouslySetInnerHTML|typeof window" src/components/SiteNav.tsx src/components/AuthenticatedWorkRail.tsx src/components/AccountMenu.tsx src/components/public/PublicRouteLinks.tsx src/components/business/BusinessWorkspace.tsx src/app/styles/shell.css || true`

Results:

- Focused Vitest suite: passed, 70 tests.
- Typecheck: passed.
- Focused eslint: passed.
- Stylelint: passed.
- Playwright `/business` browser smoke: passed.
- Stale owner-shell label scan: no matches.
- Account-menu stale route scan: only intentional negative Playwright
  assertions for removed labels.
- Hydration-prone pattern scan: only `typeof window` inside an AccountMenu
  `useEffect` media-query guard; accepted because it does not affect SSR text
  output.

Issues found and fixed in QA pass 2:

- None.

Known unrelated observations:

- The Playwright production build still emits existing Turbopack broad
  file-tracing warnings from `src/lib/user-files.ts`,
  `src/lib/appliance/native/native-binary-registry.ts`, and `next.config.ts`.
  They do not come from the shell/menu changes.
