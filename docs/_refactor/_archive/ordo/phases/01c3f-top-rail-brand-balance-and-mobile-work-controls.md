# Phase 01c3f: Top Rail Brand Balance And Mobile Work Controls

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3e-single-column-work-index-and-jobs-convergence.md`

## Goal

Fix the visual balance of the top rail and make authenticated mobile navigation
feel intentional.

This phase addresses the product/design issue visible after 01c3: duplicate
brand marks, centered links that feel optically off, and authenticated work
utilities that do not yet feel like a final mobile-first app shell.

## Product Rule

The top rail identifies the instance. The work controls manage the user's
operating system.

Do not mix brand, utility drawer, jobs, notifications, and public links into a
single visual cluster.

## Current Code Grounding

- `src/components/SiteNav.tsx`
  - Brand region now renders only `ShellBrand`.
  - `ShellWorkspaceMenu` moved to the account/utility region with a neutral
    menu glyph instead of an Ordo bitmap trigger.
  - Public links are centered through the shell grid.
- `src/components/shell/ShellBrand.tsx`
  - Uses `identity.markPath ?? identity.logoPath` as the visible top rail
    brand mark.
  - Wordmark is text and no longer uses `theme-display`.
- `src/lib/config/defaults.ts`
  - `DEFAULT_IDENTITY.logoPath` currently points at `/logo_with_words.png`.
  - `DEFAULT_IDENTITY.markPath` points at `/ordo-mark.png`.
- `src/lib/config/instance.schema.ts`
  - Validates `logoPath`.
  - Validates optional `markPath` as a root-relative path.
- `src/app/styles/shell.css`
  - `.shell-nav-band` desktop grid is `brand primary actions`.
  - `.shell-brand-row` uses `var(--font-brand, "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif)`.
  - `.shell-brand-wordmark` keeps `letter-spacing: 0`.
- `src/components/AuthenticatedWorkRail.tsx`
  - Desktop work rail exists.
  - Mobile now exposes an explicit `Work` trigger and a full workspace control
    sheet.
- `src/components/public/PublicRouteLinks.tsx`
  - Anonymous mobile dock donor pattern.
- `src/components/ShellWorkspaceMenu.tsx`
  - Drawer/utility donor component.
  - Trigger is now a neutral menu glyph, not a duplicate brand mark.

## Target Shape

### Top Rail

- Left: symbol-only logo mark plus separate `Studio Ordo` text.
- Center: public links (`Offers`, `About`, conditional `Feed`) optically
  centered.
- Right:
  - anonymous: Login/Register.
  - authenticated: compact account/profile affordance only if needed.
- No jobs rail.
- No notification bell.
- No duplicate logo/utility icon next to the brand.

### Brand

- Add explicit identity support for mark-only asset:
  - `markPath?: string`, or
  - `brandMarkPath?: string`.
- Default mark should be `/ordo-mark.png`.
- Keep `logoPath` for OpenGraph/large lockups if needed.
- Wordmark should use a clean sans stack:
  - `var(--font-brand, "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif)`.
- Letter spacing remains `0`.
- Do not use the reference bitmap asset directly.

### Authenticated Mobile

Use one of these final patterns:

- Preferred: `Work` sheet trigger.
  - Opens full-height sheet with Dashboard, Activity, Media, Referrals,
    Profile, attention inbox, and account utilities.
- Alternative: bottom dock only if the route count can remain readable at
  360px.

The route should be explicit and labeled. Do not rely on a hidden-left-menu as
the only discovery surface.

## Required Work

- [x] Add mark-only identity support or safely repoint the shell brand mark without
  breaking SEO image behavior.
- [x] Update `ShellBrand` to use the mark-only image plus separate wordmark.
- [x] Remove `theme-display` from the shell wordmark.
- [x] Add a tokenized brand font class or CSS variable.
- [x] Remove duplicate brand mark from the top-left cluster.
- [x] Move `ShellWorkspaceMenu` out of the brand cluster or reduce it to an
  account/overflow utility.
- [x] Rebalance the desktop top rail grid.
- [x] Add authenticated mobile work sheet or dock.
- [x] Ensure public mobile dock remains anonymous-only.
- [x] Ensure top rail and authenticated rail do not duplicate primary routes in a
  confusing way.

## Implemented Artifacts

- `src/lib/config/defaults.ts`
  - Adds optional `markPath` to `InstanceIdentity`.
  - Defaults `markPath` to `/ordo-mark.png` while keeping `logoPath` for SEO and
    large lockup metadata.
- `src/lib/config/instance.schema.ts`
  - Validates optional `identity.markPath`.
- `src/components/shell/ShellBrand.tsx`
  - Uses `markPath ?? logoPath` for the visible mark.
  - Keeps the wordmark as text and removes `theme-display`.
  - Adds `data-shell-brand-mark-source` for regression tests.
- `src/components/SiteNav.tsx`
  - Brand region is only the brand lockup.
  - Workspace drawer trigger lives in the account/utility region.
  - Jobs and attention controls remain out of the top rail.
- `src/components/ShellWorkspaceMenu.tsx`
  - Trigger uses a neutral menu glyph.
  - Drawer header uses `/ordo-mark.png`.
- `src/components/AuthenticatedWorkRail.tsx`
  - Desktop keeps the route rail plus jobs and attention utilities.
  - Mobile adds an explicit `Work` trigger and `Workspace controls` sheet.
  - Sheet includes Dashboard, Jobs, Activity, My Media, Referrals, Profile,
    jobs, and attention inbox.
- `src/lib/shell/shell-navigation.ts`
  - Adds canonical `/activity` route to the authenticated work/account route
    model.
- `src/app/globals.css` and `src/app/styles/foundation.css`
  - Add `--font-brand`.
- `src/app/styles/shell.css`
  - Adds brand font styling, neutral menu trigger sizing, and mobile work sheet
    rules.

## Implementation Decisions

- `logoPath` remains the metadata/large-lockup image. `markPath` is the visible
  app-shell mark.
- The workspace drawer is still available because it owns global/system
  utilities, simulation mode, and drawer discovery. It no longer visually
  competes with the brand.
- Authenticated mobile uses a sheet instead of a dense bottom dock because the
  signed-in route count includes Dashboard, Jobs, Activity, Media, Referrals,
  and Profile.
- The Activity route became canonical shell navigation because the 01c3d
  activity ledger should be reachable from the work system, not only from
  dashboard links.

## Positive Tests

- [x] Top rail has exactly one brand mark.
- [x] Brand mark uses symbol-only source.
- [x] Wordmark renders as text, not as part of the bitmap.
- [x] Public links are visible and balanced on desktop.
- [x] Authenticated mobile has an explicit work control.
- [x] Anonymous mobile still has the public dock from 01c2.

## Negative Tests

- [x] `JobsRail` is not rendered inside the top rail.
- [x] `NotificationFeed` or `AttentionInbox` is not rendered inside the top rail.
- [x] Anonymous users do not see authenticated work controls.
- [x] Display/Fraunces is not used for the shell wordmark.
- [x] No negative letter spacing is added for brand text.

## Edge Tests

- [x] 320px and 360px mobile widths.
- [x] Long instance name.
- [x] Missing custom `markPath`.
- [x] Feed hidden due to no public content.
- [x] Signed-in user on `/jobs`, `/workspace`, `/activity`, `/my/media`.

## Cleanup

- [x] Rename stale tests that refer to jobs/notifications as top nav utilities.
- [x] Remove any CSS that only existed for duplicate logo/wordmark behavior.

## Validation

- `npm test -- --run src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/ShellWorkspaceMenu.test.tsx tests/shell-brand.test.tsx tests/config-loader.test.ts src/lib/shell/shell-navigation.test.ts tests/shell-navigation-model.test.ts tests/job-visibility-solid.test.ts tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx tests/shell-acceptance.test.tsx tests/shell-visual-system.test.tsx`
  - 12 files, 111 tests passed.
- `npx eslint src/components/SiteNav.tsx src/components/AuthenticatedWorkRail.tsx src/components/ShellWorkspaceMenu.tsx src/components/shell/ShellBrand.tsx src/lib/config/defaults.ts src/lib/config/instance.schema.ts src/lib/shell/shell-navigation.ts src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/ShellWorkspaceMenu.test.tsx tests/shell-brand.test.tsx tests/config-loader.test.ts src/lib/shell/shell-navigation.test.ts tests/shell-navigation-model.test.ts tests/job-visibility-solid.test.ts tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx tests/shell-acceptance.test.tsx tests/shell-visual-system.test.tsx`
  - Passed.
- `npm run typecheck`
  - Passed.
- `npx playwright test tests/browser-ui/home-shell-header.spec.ts`
  - 4 browser tests passed.
  - The production build emitted existing Turbopack broad-trace warnings in
    `src/lib/user-files.ts`, `src/lib/appliance/native/native-binary-registry.ts`,
    and `next.config.ts`; the targeted browser spec still passed.

## Exit Criteria

- [x] Top rail looks intentional and balanced.
- [x] Brand uses mark-only image plus text wordmark.
- [x] Authenticated mobile work controls are clear and inspectable.
