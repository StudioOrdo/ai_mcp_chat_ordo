# Phase 01c3u Evidence: Shell Menu And Account Surface Alignment

Status: Implemented

Evidence date: 2026-05-05

## Governing Contract

Contract:

- `docs/_business/ux/08-product-kernel-contract.md`

Invariant:

- Chat is the operating interface.
- UI surfaces are the governance layer.

This phase aligns the shell with the product kernel:

- public nav is for visitors;
- owner rail is the business operating workspace;
- avatar menu is account-owned and personal-object-owned space;
- System is role-gated governance.

## Code Changes

Route and product contracts:

- `docs/_business/ux/08-product-kernel-contract.md`
- `src/lib/shell/shell-navigation.ts`
- `src/lib/shell/shell-navigation.test.ts`
- `tests/shell-navigation-model.test.ts`
- `src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts`

Shell components:

- `src/components/SiteNav.tsx`
- `src/components/SiteNav.test.tsx`
- `src/components/AccountMenu.tsx`
- `src/components/AccountMenu.test.tsx`
- `src/components/AuthenticatedWorkRail.tsx`
- `src/components/AuthenticatedWorkRail.test.tsx`
- `src/app/profile/page.tsx`
- `src/app/profile/page.test.tsx`
- `src/components/profile/ProfileSettingsPanel.tsx`
- `src/components/profile/ProfileSettingsPanel.test.tsx`
- `src/app/styles/shell.css`
- `src/app/styles/editorial.css`
- `src/components/media/UserMediaWorkspace.tsx`
- `src/components/media/UserMediaWorkspace.test.tsx`
- `src/app/my/media/page.test.tsx`
- `src/lib/media/user-media.test.ts`
- `tests/media-architecture-audit.test.ts`
- `src/components/studio/StudioWorkspace.tsx`
- `src/components/studio/StudioWorkspace.test.tsx`
- `src/app/studio/page.test.tsx`
- `src/lib/studio/load-studio-workspace.test.ts`
- `src/components/dashboard/UserDashboard.tsx`
- `src/components/dashboard/UserDashboard.test.tsx`
- `src/app/workspace/page.test.tsx`
- `src/lib/dashboard/load-user-dashboard.test.ts`

Related shell/product tests:

- `tests/shell-acceptance.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`
- `tests/shell-visual-system.test.tsx`
- `tests/admin-shell-and-concierge.test.tsx`
- `tests/job-visibility-solid.test.ts`
- `tests/ux-layout-navigation.test.tsx`
- `tests/browser-ui/business-workspace.spec.ts`
- `tests/browser-ui/mobile-workspace-admin-lists.spec.ts`

Related work-index fixes from browser QA:

- `src/lib/jobs/job-publication.ts`
- `src/lib/jobs/job-publication.test.ts`
- `src/lib/jobs/load-user-jobs-workspace.ts`
- `src/lib/jobs/load-user-jobs-workspace.test.ts`
- `src/components/jobs/JobsWorkspace.tsx`
- `src/components/jobs/JobsWorkspace.test.tsx`

Docs:

- `docs/_refactor/ordo/phases/01c3u-shell-menu-and-account-surface-alignment.md`
- `docs/_refactor/ordo/evidence/phase-01c3u-shell-menu-and-account-surface-alignment.md`

## Behavior Implemented

- Public top nav remains About, Offers, and conditional Feed.
- Signed-in `SiteNav` now mounts the avatar `AccountMenu`.
- Account menu shows:
  - My account
  - My media
  - My Referrals
  - Theme toggle in the menu header
  - Sign out
- Account menu no longer shows My conversations, My offers, My content,
  Preferences, or System.
- Profile and Preferences are collapsed into `/profile`, which now has a
  second-column account shell:
  - User info
  - Referral code
  - Preferences
- Owner rail shows:
  - Today
  - Studio
  - People
  - Offers
  - About
- Profile is no longer in the owner rail.
- Staff/admin rail grouping remains separate.
- Admin System remains hidden from staff and regular authenticated users.
- The old workspace drawer remains unmounted from the signed-in shell.
- Top-right jobs and notification controls remain unmounted from `SiteNav`.
- Donor routes remain addressable but do not appear in public nav or owner rail.
- Authenticated top rail and the global second column now share explicit shell
  width tokens so the logo/brand corner aligns with the two-rail structure.
- `/my/media` now follows the same shell pattern as People and Account:
  media search, filters, and asset selection are in the global second column;
  selected media detail, storage budget, quota summary, preview, and governed
  deletion controls are in the main governance column.
- `/studio` now follows the same shell pattern as People and Account: Studio
  search, object-type navigation, and status navigation are in the global
  second column; the production briefing, summary, and object cards are in the
  main governance column.
- `/workspace` / Today now follows the same shell pattern as People and
  Account: decisions, follow-ups, stuck work, and owner actions are in the
  global second column with object-type icon treatment; the main column carries
  the broader governance briefing, progress, outputs, results, weak signals,
  business-loop context, and Ask Ordo prompts.
- Owner media UI continues to hide writable-volume/host-capacity diagnostics;
  those remain scoped to Operations media surfaces.

## Current Code Grounding

Confirmed current anchors:

- `src/lib/shell/shell-navigation.ts`
  - Route model now has separate account and owner-rail route sets.
  - `business-about` is a distinct owner-rail route pointing at `/about` until
    a dedicated business About editor exists.
- `src/components/SiteNav.tsx`
  - Uses `PublicRouteLinks` for public nav.
  - Renders guest access links for anonymous users and `AccountMenu` for
    signed-in users.
- `src/components/AccountMenu.tsx`
  - Reuses `resolveAccountMenuRoutes`.
  - Keeps only account-owned links: My account, My media, My Referrals, plus
    theme toggle and Sign out.
  - Uses a bottom sheet on narrow viewports instead of a workspace right drawer.
- `src/components/profile/ProfileSettingsPanel.tsx`
  - Uses the same global second-column pattern for account-owned settings.
  - Keeps user info, referral code, and preferences in one account area.
- `src/components/media/UserMediaWorkspace.tsx`
  - Uses the same `shell-governance-grid` primitive as People and Account.
  - Keeps owner media discovery in a persistent second column.
  - Keeps selected asset evidence and governed actions in the main column.
- `src/components/studio/StudioWorkspace.tsx`
  - Uses the same `shell-governance-grid` primitive as People and Account.
  - Keeps Media, Workflows, Content, Campaigns, search, and status filters in
    the second-column Studio selector.
  - Keeps raw job language out of the main Studio owner briefing.
- `src/components/dashboard/UserDashboard.tsx`
  - Uses the same `shell-governance-grid` primitive as People and Account.
  - Projects next actions and attention items into a second-column decision
    selector.
  - Renders object-type icons for decision cards so decisions are visually
    scannable without exposing raw job/log/provider details.
- `src/components/AuthenticatedWorkRail.tsx`
  - Reuses `resolveAuthenticatedWorkRailRoutes` and
    `resolveAuthenticatedAdminRailRoutes`.
  - Does not render Jobs, Activity, My Media, Referrals, or Profile.
- `src/lib/jobs/job-publication.ts`
  - Falls back to persisted job state when the latest renderable event is stale
    or timestamp-tied behind the job row, preventing queued stale events from
    displacing active work in the mobile work index.

## QA Pass 1

Focused phase and related tests:

```bash
npx vitest run src/lib/shell/shell-navigation.test.ts tests/shell-navigation-model.test.ts src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/AccountMenu.test.tsx tests/shell-acceptance.test.tsx tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx tests/shell-visual-system.test.tsx src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts tests/admin-shell-and-concierge.test.tsx tests/job-visibility-solid.test.ts tests/ux-layout-navigation.test.tsx
```

Initial result:

- Failed, then passed after fixes.

Issues found and fixed:

- Stale route tests still expected account menu routes to equal owner rail
  routes.
  - Fix: split expectations between account menu and owner rail.
- Stale component tests still expected Profile in the owner rail.
  - Fix: asserted Profile absence and About presence.
- Stale `SiteNav` tests still expected no signed-in account menu.
  - Fix: asserted account menu presence for signed-in users.
- Footer duplicated Offers/About after About entered the owner rail.
  - Fix: footer Workspace group now keeps Today, Studio, People only while
    Information keeps Home, Offers, About.
- `AccountMenu` tests mocked `resolveAccountMenuRoutes` without
  `isShellRouteActive`.
  - Fix: added the mock export.
- Visual tests still asserted the old System Legibility/Simulation Mode menu.
  - Fix: updated assertions to Preferences/Theme and no simulation controls.
- Avatar menu still carried too many personal/workspace concepts after the
  design critique.
  - Fix: removed My conversations, My offers, My content, Preferences, and
    System from the menu.
- Profile and Preferences linked to the same destination but behaved like
  separate concepts.
  - Fix: collapsed them into one `/profile` account shell with User info,
    Referral code, and Preferences sections.
- My QR / referral link language was too implementation-heavy.
  - Fix: renamed it to My Referrals and routed it to
    `/profile?section=referrals`.
- The theme control still read like a menu row.
  - Fix: moved it into the account-menu header as a slide-style toggle.
- Account/profile surfaces did not use the global second-column structure
  clearly enough.
  - Fix: added shell width tokens and profile account-section CSS to align with
    the authenticated shell.
- Mobile browser QA exposed that a stale queued job event could appear ahead of
  active work.
  - Fix: tightened job publication fallback and work-index sorting, then added
    equal-timestamp stale event coverage.

Focused rerun:

- Passed. 13 files, 126 tests.

Typecheck:

```bash
npm run typecheck
```

Result:

- Passed.

Focused lint:

```bash
npm run lint -- src/components/AccountMenu.tsx src/components/SiteNav.tsx src/components/AuthenticatedWorkRail.tsx src/lib/shell/shell-navigation.ts src/components/AccountMenu.test.tsx src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/lib/shell/shell-navigation.test.ts
```

Result:

- Passed.

## QA Pass 2

Focused phase and related tests rerun:

```bash
npx vitest run src/lib/shell/shell-navigation.test.ts tests/shell-navigation-model.test.ts src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/AccountMenu.test.tsx tests/shell-acceptance.test.tsx tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx tests/shell-visual-system.test.tsx src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts tests/admin-shell-and-concierge.test.tsx tests/job-visibility-solid.test.ts tests/ux-layout-navigation.test.tsx
```

Result:

- Passed. 13 files, 126 tests.

Typecheck:

```bash
npm run typecheck
```

Result:

- Passed.

Focused lint:

```bash
npm run lint -- src/components/AccountMenu.tsx src/components/SiteNav.tsx src/components/AuthenticatedWorkRail.tsx src/lib/shell/shell-navigation.ts src/components/AccountMenu.test.tsx src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/lib/shell/shell-navigation.test.ts
```

Result:

- Passed.

Stale-surface scan:

```bash
rg -n "ShellWorkspaceMenu|JobsRail|AttentionInbox|NotificationFeed|/jobs|/activity|/my/media|/referrals|operations/media|Blog|Journal|Library" src/components/SiteNav.tsx src/components/AuthenticatedWorkRail.tsx src/components/AccountMenu.tsx src/lib/shell/shell-navigation.ts tests/shell-acceptance.test.tsx tests/site-shell-composition.test.tsx src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/AccountMenu.test.tsx
```

Result:

- No stale primary public nav or owner rail exposure found.
- `/my/media` and `/referrals` only appear as account-menu/user-owned
  destinations in tests or route model.
- Jobs, Activity, Operations, Blog, Journal, and Library remain donor,
  diagnostic, or directly addressable route definitions rather than primary
  public nav or owner rail items.
- `JobsRail` and `AttentionInbox` remain badge/count donors for owner-safe rail
  indicators, not top-right owner controls.

Issue found and fixed during static inspection:

- `AuthenticatedWorkRail` still carried a dead `profile` icon branch even
  though Profile no longer resolves into the owner rail.
  - Fix: removed the stale branch and reran the focused shell/product test
    suite, typecheck, lint, and static scans.

Owner UI leak scan:

```bash
rg -n "raw job|raw log|provider log|runtime log|diagnostic|job_[A-Za-z0-9_-]+|operation_events|job_events|tracked_link_events|offer_events|Operations|Activity|Jobs|Library|Journal|Blog" src/components/AccountMenu.tsx src/components/SiteNav.tsx src/components/AuthenticatedWorkRail.tsx src/components/dashboard src/components/business src/components/offers src/components/studio src/lib/shell/shell-navigation.ts
```

Result:

- No raw provider logs, runtime logs, fake metrics, or private diagnostic data
  were introduced in the shell/account surfaces touched by this phase.
- Existing diagnostic route definitions remain in the route model for direct
  access and System/Admin use.
- Existing owner-facing Studio copy mentions Jobs only as diagnostics and keeps
  Studio as the object-centered owner surface.
- Existing dashboard diagnostic hrefs remain source/detail links and are covered
  by related tests asserting raw job/provider details stay out of regular owner
  UI.

Additional critique-follow-up QA:

```bash
npm run test -- src/components/profile/ProfileSettingsPanel.test.tsx src/app/profile/page.test.tsx src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.test.ts tests/shell-navigation-model.test.ts tests/shell-visual-system.test.tsx tests/admin-shell-and-concierge.test.tsx
```

Result:

- Passed. 7 files, 51 tests.

```bash
npm run test -- src/lib/jobs/job-publication.test.ts src/lib/jobs/job-read-model.test.ts src/lib/jobs/job-event-stream.test.ts src/lib/jobs/load-user-jobs-workspace.test.ts src/components/jobs/JobsWorkspace.test.tsx
```

Result:

- Passed. 5 files, 42 tests.

```bash
npm run typecheck
```

Result:

- Passed.

```bash
npx eslint src/lib/jobs/job-publication.ts src/lib/jobs/job-publication.test.ts src/components/jobs/JobsWorkspace.tsx src/lib/jobs/load-user-jobs-workspace.ts src/components/jobs/JobsWorkspace.test.tsx src/lib/jobs/load-user-jobs-workspace.test.ts
```

Result:

- Passed.

```bash
npx playwright test tests/browser-ui/business-workspace.spec.ts tests/browser-ui/mobile-workspace-admin-lists.spec.ts -g "People workspace|workspace routes keep"
```

Result:

- Passed. 2 tests.

Media second-column follow-up QA:

```bash
npm run test -- src/components/media/UserMediaWorkspace.test.tsx src/app/my/media/page.test.tsx src/lib/media/user-media.test.ts tests/media-architecture-audit.test.ts
```

Result:

- Passed. 4 files, 12 tests.

```bash
npm run typecheck
```

Result:

- Passed.

```bash
npx eslint src/components/media/UserMediaWorkspace.tsx src/components/media/UserMediaWorkspace.test.tsx src/app/my/media/page.tsx src/app/my/media/page.test.tsx src/lib/media/user-media.ts src/lib/media/user-media.test.ts
```

Result:

- Passed.

```bash
rg -n "raw job|provider|runtime log|job_events|media_workflow_events|Writable volume capacity|ShellWorkspaceMenu|JobsRail|NotificationFeed|Activity|Operations" src/components/media src/app/my/media src/lib/media/user-media.ts src/components/AccountMenu.tsx src/lib/shell/shell-navigation.ts
```

Result:

- Owner `/my/media` still does not expose writable-volume capacity.
- Raw job/provider/runtime/event terms were not introduced in regular owner
  media UI.
- Matches outside `/my/media` are existing Operations/admin or route-model
  references.

```bash
npx playwright test tests/browser-ui/media-capacity-quotas.spec.ts -g "my media route"
```

Result:

- Passed. 1 browser test.
- The production build emitted existing broad-file-pattern/NFT warnings from
  `src/lib/user-files.ts`, `src/lib/appliance/native/native-binary-registry.ts`,
  and `next.config.ts`; the `/my/media` browser assertion passed and those
  warnings are unrelated to this shell layout change.

Studio second-column follow-up QA:

```bash
npm run test -- src/components/studio/StudioWorkspace.test.tsx src/app/studio/page.test.tsx src/lib/studio/load-studio-workspace.test.ts
```

Result:

- Failed once because status/object counts became part of link accessible
  names. Fixed with `aria-hidden` counts and added tests for the Studio
  second-column selector.
- Passed after fix. 3 files, 8 tests.

```bash
npm run typecheck
```

Result:

- Passed.

```bash
npx eslint src/components/studio/StudioWorkspace.tsx src/components/studio/StudioWorkspace.test.tsx src/app/studio/page.tsx src/app/studio/page.test.tsx src/lib/studio/load-studio-workspace.ts src/lib/studio/load-studio-workspace.test.ts
```

Result:

- Passed.

```bash
rg -n "raw job|provider|runtime log|job_events|media_workflow_events|Writable volume capacity|ShellWorkspaceMenu|JobsRail|NotificationFeed|Activity|Operations|My Media|Jobs stay" src/components/studio src/app/studio src/lib/studio/load-studio-workspace.ts
```

Result:

- No owner Studio UI leak hits. Media is represented as a Studio object type,
  not as a separate My Media primary surface.

Today second-column decision follow-up QA:

```bash
npm run test -- src/components/dashboard/UserDashboard.test.tsx src/app/workspace/page.test.tsx src/lib/dashboard/load-user-dashboard.test.ts
```

Result:

- Failed once because tests still expected decision/follow-up objects to be
  full main-column Ordo cards. Updated tests to assert the new second-column
  decision-card contract.
- Passed after fix. 3 files, 11 tests.

```bash
npm run typecheck
```

Result:

- Passed.

```bash
npx eslint src/components/dashboard/UserDashboard.tsx src/components/dashboard/UserDashboard.test.tsx src/app/workspace/page.tsx src/app/workspace/page.test.tsx src/lib/dashboard/load-user-dashboard.ts src/lib/dashboard/load-user-dashboard.test.ts
```

Result:

- Passed.

```bash
rg -n "raw job|provider log|runtime log|job_events|media_workflow_events|Writable volume capacity|ShellWorkspaceMenu|JobsRail|NotificationFeed|My Jobs|Your Jobs|My Media" src/components/dashboard/UserDashboard.tsx src/app/workspace src/lib/dashboard/load-user-dashboard.ts
```

Result:

- No owner Today UI leak hits. The decision column keeps object decisions
  scannable while preserving regular-owner copy boundaries.

System second-column section follow-up QA:

```bash
npm run test -- tests/jobs-system-dashboard.test.ts
```

Result:

- Failed once because older source tests still expected the old three-column
  card dashboard and `haptic-press` action chips. Updated tests to assert the
  System second-column workspace, section links, and selected-section content
  contract.
- Passed after fix. 1 file, 35 tests.

```bash
npm run test -- tests/admin-shell-and-concierge.test.tsx
```

Result:

- Failed once because the admin shell test still expected an `Admin dashboard`
  heading. Updated the test to assert the `Overview` selected-section heading,
  `System sections` second column, and section link to
  `/admin?section=system-health`.
- Passed after fix. 1 file, 8 tests.

```bash
npm run test -- tests/jobs-system-dashboard.test.ts tests/admin-shell-and-concierge.test.tsx src/app/admin/system/operations/page.test.tsx src/app/admin/system/backups/page.test.tsx src/app/admin/system/keys/KeysManager.test.tsx
```

Result:

- Passed. 5 files, 48 tests.

```bash
npm run typecheck
```

Result:

- Failed once because `AdminDashboardPage` changed to destructured props
  without a default argument while a test imports and calls it directly.
  Added a default empty props object.
- Passed after fix.

```bash
npx eslint src/app/admin/page.tsx tests/jobs-system-dashboard.test.ts tests/admin-shell-and-concierge.test.tsx
```

Result:

- Passed.

```bash
rg -n "My Jobs|Your Jobs|My Media|raw job|provider log|runtime log|job_events|media_workflow_events|ShellWorkspaceMenu|NotificationFeed" src/app/admin src/components/admin src/app/workspace src/components/dashboard src/app/studio src/components/studio src/app/my/media src/components/media
```

Result:

- No new owner dashboard/studio/system leaks. The only `My Media` match is the
  existing `/my/media` route metadata title.

## Remaining Risks

- Owner-rail About currently links to `/about`; the route id is distinct so a
  later owner-facing About editor can replace the destination without changing
  shell IA.
- The System link is currently ADMIN-only because the existing route permission
  model does not expose a finer-grained system permission.
