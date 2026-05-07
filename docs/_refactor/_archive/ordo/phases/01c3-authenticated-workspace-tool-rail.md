# Phase 01c3: Authenticated Workspace Tool Rail

Status: Implemented

Parent phase:

- `01c-public-navigation-footer-and-mobile-system.md`

Depends on:

- `01c2-public-mobile-footer-and-safe-area-system.md`

## Goal

Give signed-in users a clear app/workspace navigation model while making the
top rail visually quieter and more brand-forward.

01c2 made public route discovery visible and safe on mobile. 01c3 now moves
authenticated work utilities out of the top decorative cluster and into a
purpose-built authenticated rail.

## Follow-Up 01c3 Extension Series

Implementation of 01c3 exposed a deeper product issue: jobs, notifications,
workflows, operations, and runtime diagnostics are all event-shaped, but the
current UI treats jobs and notifications as separate unrelated icons.

Before 01c4 adds admin/global/factory navigation, complete the 01c3
extension series:

- `01c3a-activity-source-map-and-notification-taxonomy.md`
- `01c3b-activity-read-model-and-receipts.md`
- `01c3c-mobile-first-user-dashboard.md`
- `01c3d-activity-page-and-attention-inbox.md`
- `01c3e-single-column-work-index-and-jobs-convergence.md`
- `01c3f-top-rail-brand-balance-and-mobile-work-controls.md`
- `01c3g-activity-dashboard-regression-closeout.md`
- `01c3h-object-centered-information-architecture.md`
- `01c3i-ordo-card-system-and-progressive-disclosure.md`
- `01c3j-object-detail-lenses-provenance-funnel-and-performance.md`
- `01c3k-studio-business-surface-consolidation.md`
- `01c3l-hitl-dashboard-and-ceo-command-loop.md`
- `01c3m-object-centered-ux-regression-closeout.md`
- `01c3n-authenticated-route-and-left-rail-consolidation.md`
- `01c3o-conversational-and-ui-offer-creation.md`
- `01c3p-people-customer-stage-and-funnel-cards.md`
- `01c3q-tracked-links-qr-and-attribution.md`
- `01c3r-content-campaign-performance-loop.md`
- `01c3s-solopreneur-results-dashboard-and-next-actions.md`
- `01c3t-solopreneur-operating-loop-closeout.md`
- `01c3u-shell-menu-and-account-surface-alignment.md`
- `01c3v-people-selection-column-and-mobile-drill-in.md`
- `01c3w-person-detail-header-facts-and-source-actions.md`
- `01c3x-relationship-brief-current-summary.md`
- `01c3y-relationship-trail-and-source-linking.md`
- `01c3z-relationship-settings-and-people-shell-closeout.md`

These phases preserve the 01c3 rail work, but refine the product model:

- Dashboard owns "what matters now."
- Activity owns "what happened."
- Jobs remain durable execution records and diagnostics.
- Notifications become attention projections of activity.
- Browser push remains delivery only.
- Raw runtime logs remain diagnostics.
- Produced media, people, offers, QR links, workflows, and feed items become
  object-centered cards with detail lenses.
- Jobs and operations remain provenance/evidence, not the primary language of
  the solopreneur workspace.

Closeout status:

- `01c3h` through `01c3m` now establish the regular-user owner shell as
  Dashboard, Studio, Business, and Profile.
- Closeout evidence:
  `docs/_refactor/ordo/evidence/phase-01c3m-object-centered-ux-regression-closeout.md`.
- `01c3u` through `01c3z` now define the first polished People + shell menu
  implementation target: public nav, avatar user menu, owner left rail, compact
  People selector, person detail, Relationship Brief, Relationship Trail, and
  minimal relationship settings.

## Product Rule

Signed-in Ordo is a workspace, not just a website with a menu.

The top rail should identify the instance and provide public/site context. The
authenticated rail should carry the things the signed-in user actually manages:
current work, jobs, media, referrals, profile, notifications, and account/work
utilities.

Jobs and the notification bell must stop living as unrelated right-side top-nav
buttons. They belong inside the authenticated work rail.

## Design Rule

The top rail should feel closer to the Studio Ordo brand reference:

- inline logo mark plus `Studio Ordo` text,
- refined, calm, high-contrast wordmark,
- public links placed in the most visually balanced position,
- no copied bitmap reference image,
- no oversized marketing treatment,
- no hidden-left-menu dependency for core discovery.

Use the existing logo/identity source (`identity.logoPath`, `ShellBrand`,
`SHELL_BRAND`, and config identity values). Do not create a one-off brand asset.

Typography target:

- Use the existing brand/display tokens where possible.
- Do not use negative letter spacing in the implementation.
- Prefer a clean inline wordmark that reads well at nav size on desktop and
  mobile.
- If the wordmark needs a more editorial feel, add a tokenized class such as
  `.shell-brand-wordmark` rather than hard-coding font styles into JSX.

## Previous Phase Grounding

01c2 completed:

- `src/components/public/PublicRouteLinks.tsx`
  - `PublicRouteLinks` for desktop public links.
  - `PublicMobileRouteDock` for anonymous mobile public dock.
  - Both consume `resolvePrimaryNavRoutes()` / `resolveRailMenuRoutes()`.
- `src/components/SiteNav.tsx`
  - Visible desktop public route links in
    `data-shell-nav-region="primary-links"`.
  - Login/Register remain in `account-access`.
- `src/components/AppShell.tsx`
  - Anonymous-only public mobile dock.
  - `data-shell-public-mobile-nav="true"` on anonymous shells.
- `src/app/layout.tsx`
  - Body-level `data-shell-public-mobile-nav="true"` so floating chat clears
    the dock.
- `src/app/styles/shell.css`
  - Desktop `brand primary actions` grid.
  - Public mobile dock and safe-area variables.
- `src/app/styles/chat.css`
  - Floating chat launcher/frame clears anonymous mobile dock.
- Browser tests now explicitly set `ordo_installed=1` and read the Playwright
  database for referral scenarios.

01c3 should preserve all 01c2 behavior for anonymous users.

## Current Code Grounding

Current shell/navigation facts after 01c2:

- `src/components/SiteNav.tsx`
  - Renders `ShellWorkspaceMenu` in the brand region.
  - Renders `ShellBrand href={homeHref} showMark={false} compactOnMobile`.
  - Renders `PublicRouteLinks` between brand and account access.
  - For signed-in users, renders `AuthenticatedJobsRail` and
    `NotificationFeed` inside `data-shell-nav-region="account-access"`.
  - For anonymous users, renders Login/Register inside account access.
  - This means signed-in top nav currently mixes public links, work status,
    notifications, and account access in one horizontal band.
- `src/components/shell/ShellBrand.tsx`
  - Already supports `showMark`, `showWordmark`, and `compactOnMobile`.
  - Uses `identity.logoPath` for the mark.
  - Current wordmark class includes negative tracking; implementation should
    replace that with tokenized zero-tracking brand styling.
- `src/components/public/PublicRouteLinks.tsx`
  - Filters Home from desktop public links because brand/home owns that action.
  - Labels Home as Chat only for the anonymous mobile dock.
  - Should remain the source for public route links.
- `src/frameworks/ui/jobs-rail/JobsRail.tsx`
  - Already has job state, badge count, trigger, dialog drawer, active work,
    completed work, and utility actions.
  - It is currently mounted from top nav through `AuthenticatedJobsRail`.
- `src/frameworks/ui/jobs-rail/useJobsRailController.ts`
  - Bridges jobs/workflows from global chat state.
  - Provides conversation utility actions:
    copy transcript, export JSON, import JSON, diagnostic bundle actions.
  - This controller is reusable for a rail-mounted work utility panel.
- `src/components/NotificationFeed.tsx`
  - Renders a bell button and notification popover.
  - Fetches `/api/notifications/feed` for signed-in users.
  - Filters admin-scoped notifications by role.
  - It is currently mounted in top nav.
- `src/lib/shell/shell-navigation.ts`
  - Signed-in routes already exist:
    - `workspace-overview` -> `/workspace`
    - `jobs` -> `/jobs`
    - `my-media` -> `/my/media`
    - `referrals` -> `/referrals`
    - `operations-media` -> `/operations/media` for staff/admin
    - `profile` -> `/profile`
  - `ACCOUNT_MENU_ROUTE_IDS` already lists the signed-in work route set.
  - `resolveAccountMenuRoutes()` is the current helper closest to a signed-in
    work rail source.
  - `RAIL_MENU_ROUTE_IDS` remains public-only after 01c2 and should not be
    repurposed for signed-in work without renaming.
- Existing signed-in routes:
  - `src/app/workspace/page.tsx`
  - `src/app/jobs/page.tsx`
  - `src/app/my/media/page.tsx`
  - `src/app/referrals/page.tsx`
  - `src/app/profile/page.tsx`
  - `src/app/operations/page.tsx`
  - `src/app/operations/media/page.tsx`
- `src/app/styles/shell.css`
  - Current desktop nav grid is `brand primary actions`.
  - Brand CSS exists as `.shell-brand-row` and `.shell-brand-mark`.
  - Public links exist as `.shell-nav-primary-links` and
    `.shell-nav-public-link`.
- `src/app/styles/chat.css`
  - Jobs rail styles live here today. Moving the authenticated rail may justify
    moving rail-specific CSS into `shell.css` later, but this phase can keep
    existing classes if the component remains jobs-rail-specific.

## Target Shape

### Top Rail

The top rail becomes the public/site identity rail:

- Left: inline brand with logo mark and wordmark.
- Center: public route links (`Offers`, `About`, conditional `Feed`) using
  `PublicRouteLinks`.
- Right:
  - anonymous: Login/Register.
  - signed-in: a single account/user affordance or compact profile access only
    if needed.

The top rail should not visibly contain:

- `JobsRail`,
- notification bell,
- signed-in workspace route cluster,
- admin route cluster.

### Authenticated Work Rail

Add a signed-in-only work rail/component.

Recommended component names:

- `AuthenticatedWorkRail`
- `AuthenticatedWorkRailLinks`
- `AuthenticatedMobileWorkDock` or `AuthenticatedWorkSheet`

Recommended route source:

- Add a dedicated resolver in `src/lib/shell/shell-navigation.ts`, for example
  `resolveAuthenticatedWorkRailRoutes(user)`, backed by a new
  `AUTHENTICATED_WORK_RAIL_ROUTE_IDS`.
- The initial route ids should mirror the current signed-in workspace set:
  - `workspace-overview`
  - `jobs`
  - `my-media`
  - `referrals`
  - `profile`
  - `operations-media` only for staff/admin
- Do not duplicate admin-global routes here; 01c4 owns admin/factory global
  navigation.

Recommended utility placement:

- Move `JobsRail` into the authenticated rail.
- Move `NotificationFeed` into the authenticated rail.
- Keep conversation utilities inside the jobs/work rail drawer for now because
  `useJobsRailController()` already owns copy/export/import/diagnostics.
- Keep `ShellWorkspaceMenu` only as a secondary utility drawer until 01c5/01c6
  decide whether it remains necessary.

### Mobile

Anonymous mobile keeps the 01c2 public dock.

Authenticated mobile should not show the anonymous public dock. It should show
a signed-in work control that is easy to inspect:

- Option A: bottom dock with Work, Jobs, Media, Referrals, Profile.
- Option B: compact "Work" button that opens a full-height sheet with routes,
  jobs, notifications, and account utilities.

Prefer Option B if route count plus notification/job state would crowd 360px
mobile. The sheet should be explicit and labeled, not a hidden hamburger.

## Required Work

- Add a dedicated authenticated work rail route resolver.
- Build signed-in desktop work rail:
  - Current Work,
  - Jobs,
  - My Media,
  - Referrals,
  - Profile,
  - staff/admin Media Ops when allowed.
- Move `JobsRail` out of `SiteNav` top account-access and into the
  authenticated work rail.
- Move `NotificationFeed` out of `SiteNav` top account-access and into the
  authenticated work rail.
- Preserve anonymous top rail behavior from 01c2.
- Preserve public route links in the top rail for signed-in users, but make
  them secondary to work navigation.
- Update `ShellBrand` usage so the top rail shows inline logo mark plus
  wordmark.
- Replace negative wordmark tracking with a tokenized brand style that uses
  zero letter spacing.
- Optimize `shell-nav-band` layout for visual balance:
  - brand left,
  - public links centered or optically centered,
  - minimal account access right,
  - authenticated work rail outside the top decorative cluster.
- Ensure no duplicated visible destinations across top rail and work rail.
- Ensure no anonymous user can see work rail links, jobs rail, notification
  bell, profile, or authenticated utilities.
- Keep direct signed-in routes reachable and role-safe.

## 01c3 Extension Notes

- The visible label `Current Work` should be revisited by 01c3c. The target
  product language is likely `Dashboard`.
- The current bell should be treated as donor UI until 01c3d replaces it with
  an activity-backed attention inbox.
- The current `/jobs` page should be treated as donor UI until 01c3e removes
  the default two-column user experience.
- The shell brand should be corrected in 01c3f:
  - mark-only asset for the logo mark,
  - separate text wordmark,
  - sans-serif brand font,
  - zero letter spacing.

## Design Acceptance

- Top nav should feel like:
  - brand identity,
  - light public context,
  - minimal account/access affordance.
- Work rail should feel like:
  - the signed-in user's operating console,
  - inspectable,
  - not hidden behind the old workspace menu.
- Jobs and notification state should be visibly part of "work", not public
  site navigation.
- The inline logo/wordmark must use current identity config and existing mark
  asset. Do not paste or trace the reference image.

## Positive Tests

- Authenticated desktop shell renders the work rail.
- Authenticated desktop work rail links to:
  - `/workspace`,
  - `/jobs`,
  - `/my/media`,
  - `/referrals`,
  - `/profile`.
- Staff/admin work rail includes `/operations/media`.
- Jobs rail is mounted inside the authenticated work rail, not top
  `account-access`.
- Notification feed is mounted inside the authenticated work rail, not top
  `account-access`.
- Top rail still renders public links from `PublicRouteLinks`.
- Top rail brand renders mark plus wordmark.
- Active route state works for workspace, jobs, media, referrals, profile, and
  media ops.
- Mobile authenticated user gets the authenticated work control/sheet and not
  the anonymous public route dock.
- Anonymous top rail and mobile dock remain unchanged from 01c2.

## Negative Tests

- Anonymous users do not render authenticated work rail, JobsRail,
  NotificationFeed, profile, jobs, media, referrals, or workspace links.
- Authenticated users do not see Login/Register in the top rail.
- Jobs and notification bell are not direct children of
  `data-shell-nav-region="account-access"` after the refactor.
- Work rail does not duplicate public route links.
- Public route links are not reimplemented outside `PublicRouteLinks`.
- Feed remains conditionally discoverable according to
  `hasPublicFeedItems`.
- Admin-global routes are not added to the authenticated work rail except the
  existing staff/admin `operations-media` work surface.

## Edge Tests

- Apprentice role.
- Authenticated role without admin privileges.
- Staff role.
- Admin role.
- Active `/feed` while signed in.
- Active `/operations/media` for staff/admin.
- 360px mobile width.
- Long instance name.
- No active jobs.
- Running job with badge.
- Multiple unread notifications.
- Reduced motion.

## Cleanup

- Update tests that currently expect `JobsRail` and `NotificationFeed` inside
  `SiteNav` account access.
- Remove drawer-only signed-in navigation assumptions from tests.
- Keep `ShellWorkspaceMenu` as a secondary utility drawer only; do not remove
  it until 01c5/01c6 if still useful.
- If jobs rail CSS becomes generally work-rail CSS, move or rename classes in a
  separate mechanical cleanup after behavior passes.
- Do not touch admin/factory global rail in this phase; 01c4 owns that work.

## Test Plan

Focused model/component tests:

```bash
npx vitest run src/lib/shell/shell-navigation.test.ts src/components/SiteNav.test.tsx src/components/AppShell.test.tsx tests/shell-acceptance.test.tsx tests/site-shell-composition.test.tsx tests/shell-visual-system.test.tsx
```

Jobs/notification regression checks:

```bash
npx vitest run src/frameworks/ui/jobs-rail/JobsRail.test.tsx src/components/NotificationFeed.test.tsx
```

Browser checks:

```bash
npx playwright test tests/browser-ui/home-shell-header.spec.ts tests/browser-ui/mobile-home-library-density.spec.ts tests/browser-ui/mobile-public-reading.spec.ts
```

Add a dedicated browser spec if needed:

```bash
npx playwright test tests/browser-ui/authenticated-work-rail.spec.ts
```

Static checks:

```bash
npm run typecheck
npx eslint src/components/SiteNav.tsx src/components/AppShell.tsx src/components/shell/ShellBrand.tsx src/components/public/PublicRouteLinks.tsx src/frameworks/ui/jobs-rail/JobsRail.tsx src/components/NotificationFeed.tsx
npx stylelint src/app/styles/shell.css src/app/styles/chat.css
```

## Exit Criteria

- Signed-in navigation feels like a workspace.
- Jobs and notifications are in the authenticated rail, not the top public
  identity rail.
- Top rail renders inline logo mark and wordmark cleanly.
- Public links remain visible and stateful without taking over signed-in work
  navigation.
- Anonymous 01c2 behavior remains intact.
- Core signed-in destinations are visible, active, role-safe, and free of
  duplicate visible placement.
- Focused unit/component/browser tests pass.

## Implementation Evidence

Completed in this phase:

- Added `src/components/AuthenticatedWorkRail.tsx`.
  - Signed-in-only `Workspace` rail.
  - Canonical work links from `resolveAuthenticatedWorkRailRoutes()`.
  - Jobs rail and notification feed mounted inside
    `data-authenticated-work-rail-utilities`.
- Updated `src/lib/shell/shell-navigation.ts`.
  - Added `AUTHENTICATED_WORK_RAIL_ROUTE_IDS`.
  - Added `resolveAuthenticatedWorkRailRoutes()`.
  - Kept `resolveAccountMenuRoutes()` as a compatibility delegate.
- Updated `src/components/AppShell.tsx`.
  - Mounts authenticated work rail below the top public/site nav on document
    and viewport-stage routes.
  - Anonymous users still get only the public mobile dock from 01c2.
- Updated `src/components/SiteNav.tsx`.
  - Removed top-nav jobs rail and notification feed ownership.
  - Preserved anonymous Login/Register access.
  - Top brand now renders the current identity logo mark plus wordmark.
- Updated `src/components/shell/ShellBrand.tsx` and
  `src/app/styles/shell.css`.
  - Replaced hard-coded negative wordmark tracking with
    `.shell-brand-wordmark`.
  - Added authenticated work rail layout styles.
- Added `src/components/AuthenticatedWorkRail.test.tsx`.
- Updated shell/navigation/component/browser expectations so tests assert the
  new ownership boundary.

Verification run:

```bash
npx vitest run src/lib/shell/shell-navigation.test.ts src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/AppShell.test.tsx tests/shell-acceptance.test.tsx tests/site-shell-composition.test.tsx tests/shell-visual-system.test.tsx tests/homepage-shell-ownership.test.tsx
npm run typecheck
npx eslint src/components/AuthenticatedWorkRail.tsx src/components/SiteNav.tsx src/components/AppShell.tsx src/components/shell/ShellBrand.tsx src/lib/shell/shell-navigation.ts src/components/public/PublicRouteLinks.tsx src/frameworks/ui/jobs-rail/JobsRail.tsx src/components/NotificationFeed.tsx
npx stylelint src/app/styles/shell.css src/app/styles/chat.css
npx playwright test tests/browser-ui/home-shell-header.spec.ts tests/browser-ui/mobile-home-library-density.spec.ts tests/browser-ui/mobile-public-reading.spec.ts
npx vitest run src/frameworks/ui/jobs-rail/JobsRail.test.tsx src/components/NotificationFeed.test.tsx
npx vitest run tests/homepage-shell-layout.test.tsx tests/homepage-shell-evals.test.tsx
```

All commands passed.
