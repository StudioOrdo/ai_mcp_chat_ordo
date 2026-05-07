# Phase 01c3u: Shell Menu And Account Surface Alignment

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3t-solopreneur-operating-loop-closeout.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/00-ux-north-star.md`

Blocks:

- `01c3v-people-selection-column-and-mobile-drill-in.md`
- `01c4-admin-global-factory-navigation-rail.md`

## Goal

Make the authenticated shell teach the product model before the People page is
polished.

The owner should understand, without hunting, that:

- public navigation is for visitors;
- the left rail is the business operating workspace;
- the avatar menu is the user's own account and personal object space;
- System is role-gated governance, not a daily owner app.

## Product Rule

Chat is the operating interface. Shell navigation is the governance map.

The shell must not expose Jobs, Activity, Library, Referrals, Operations, Blog,
or Journal as primary owner concepts. Those remain donor routes, source
evidence, detail lenses, or System/Admin diagnostics.

## Current Code Grounding

- `src/lib/shell/shell-navigation.ts`
  - Defines public, account, owner rail, donor, and admin routes.
  - Currently carries the route contract that must be updated before UI work.
- `src/components/AppShell.tsx`
  - Chooses public shell versus authenticated shell.
- `src/components/SiteNav.tsx`
  - Renders top public navigation and the account region.
- `src/components/AuthenticatedWorkRail.tsx`
  - Renders owner rail and admin rail grouping.
- `src/components/ShellWorkspaceMenu.tsx`
  - Legacy workspace drawer donor; should not return as the primary menu.
- `src/frameworks/ui/jobs-rail/JobsRail.tsx`
  - Jobs utility donor; not a top-right owner control.
- `src/components/AttentionInbox.tsx`
  - Attention donor; not a top-right owner notification bell.
- `src/app/styles/shell.css`
  - Current left/bottom rail layout.

## UX Target

### Top Public Navigation

Show only:

- About
- Offers
- Feed, only when public content exists

Do not show authenticated work surfaces in the top center nav.

### Avatar User Menu

The upper-right avatar opens a narrow account menu, not another workspace
drawer. It should stay personal and lightweight:

- My account
- My media
- My Referrals
- Theme toggle in the menu header
- Sign out

Rules:

- Profile and Preferences collapse into the `/profile` account area.
- The profile page owns the second-column account sections: User info,
  Referral code, and Preferences.
- Do not show My conversations, My offers, or My content in the avatar menu;
  those are business/work objects governed by chat and domain surfaces.
- Do not show System in the avatar menu. System belongs in the left/admin rail
  where the governance model is visible.
- Theme is a slide-style toggle in the account menu header, not a menu row.

### Left Rail

Primary owner rail items:

- Today
- Studio
- People
- Offers
- About
- System, only when authorized

`About` in the left rail means owner governance of the business/public profile,
not simply the public About page. The public About link remains in the top nav.

## Required Work

- Remove Profile from the left rail and move profile/account-owned surfaces to
  the avatar menu.
- Add About to the owner rail as the owner-facing business profile/about
  governance surface.
- Gate System by role/permission.
- Keep top public nav limited to About, Offers, and conditional Feed.
- Replace any remaining right-drawer assumptions in signed-in owner tests.
- Keep donor routes directly reachable only where compatibility requires it.
- Make the logo/top rail and the global second-column grid align as one shell
  system. The brand corner should visually join the left rail and second
  column without shadows or decorative seams.
- Treat the second column as a global shell primitive used by People, Account,
  and later workspace pages.

## Implementation Notes

Implemented changes:

- Updated `docs/_business/ux/08-product-kernel-contract.md` so the normative
  owner rail is Today, Studio, People, Offers, About, with Profile moved to
  the avatar/account menu.
- Split account-menu routes from owner-rail routes in
  `src/lib/shell/shell-navigation.ts`.
- Added a signed-in avatar menu to `src/components/SiteNav.tsx`.
- Rebuilt `src/components/AccountMenu.tsx` around account-owned surfaces:
  My account, My media, My Referrals, a header theme toggle, and Sign out.
- Kept public nav as About, Offers, and conditional Feed through the existing
  `PublicRouteLinks` route resolver.
- Removed Profile from `AuthenticatedWorkRail` output by replacing the owner
  rail route set with Today, Studio, People, Offers, About.
- Preserved admin/staff rail grouping and kept System visible only to ADMIN in
  the current permission model.
- Kept `/jobs`, `/activity`, `/referrals`, `/operations/media`, Blog, Journal,
  and Library out of public nav and the owner rail.
- Reworked `/profile` as the account-owned second-column surface with User
  info, Referral code, and Preferences sections.
- Aligned the authenticated top rail to the owner rail plus global second
  column so the logo/brand corner reads as a precise two-rail connection.
- Reworked `/my/media` to use the same global second-column shell primitive:
  media search, filters, and asset selection live in the second column while
  the selected governed asset, storage budget, and safe deletion controls live
  in the main governance column.
- Reworked `/studio` to use the same global second-column shell primitive:
  Studio search, object-type navigation, and status navigation live in the
  second column while the production briefing, summary, and Ordo object cards
  live in the main governance column.
- Reworked `/workspace` / Today to use the same global second-column shell
  primitive: decisions, follow-ups, stuck work, and owner actions live in the
  second column with object-type icons while the main column carries the
  broader governance briefing, progress, outputs, results, and business-loop
  context.
- Reworked `/admin` / System to use the same global second-column shell
  primitive: System health, Pipeline attention, Conversation attention,
  Content operations, and Jobs health live in the second column while the main
  column exposes the selected section's linked page content and keeps the full
  admin route one click away.

Important grounding detail:

- The owner-rail About route is currently `business-about`, which points to
  `/about` because a dedicated owner-facing business About editor does not yet
  exist. The route is intentionally distinct from the public `about` route so
  future phases can move owner governance without changing the shell contract.

QA corrections made during implementation:

- The first route update duplicated Offers/About in the footer workspace group.
  The footer now keeps public Information links and workspace quick links
  distinct: Home/Offers/About under Information and Today/Studio/People under
  Workspace.
- The account menu initially retained old simulation/legibility language.
  It now uses Preferences/Theme and keeps role simulation out of regular
  owner UI.
- The account menu no longer reads `matchMedia` during initial render, avoiding
  a server/client surface mismatch.
- A later design critique narrowed the avatar menu further. My conversations,
  My offers, My content, Preferences, and System were removed from the menu;
  the account page now owns User info, Referral code, and Preferences instead.
- Browser QA exposed that stale queued job events could outrank active work in
  the mobile work index. The job publication/read-model path now falls back to
  persisted job state when a renderable event is stale, including equal
  timestamp ties.
- The media workspace still rendered as a centered dashboard instead of a
  shell-aligned governance page.
  - Fix: moved media discovery into a persistent second column, added mobile
    list/detail drill-in state, and kept raw operations/capacity details out of
    the owner media UI.
- The Studio workspace still rendered object/status filters as a large
  centered dashboard control, with Media buried as a chip in the main canvas.
  - Fix: moved Studio object types, including Media, and status filters into
    the global second column and kept the main canvas focused on the production
    briefing and object cards.
- Today still rendered owner decisions as full main-column cards, making the
  page feel like a long dashboard rather than a governance queue.
  - Fix: projected decisions and follow-ups into a second-column decision
    selector with icon/avatar treatment by object type, while leaving running
    work, produced outputs, results, weak signals, business-loop context, and
    Ask Ordo prompts in the main governance column.
- System still rendered as a card dashboard, so clicking admin sections moved
  away from the page instead of selecting and inspecting the related content.
  - Fix: projected system/admin sections into the global second column and
    rendered the selected section's grounded content in the main column using
    the existing admin loaders and linked admin pages.

## Tests

Add or update tests proving:

- public nav shows About, Offers, and conditional Feed only;
- left rail shows Today, Studio, People, Offers, About, and authorized System;
- left rail does not show Profile;
- avatar menu shows user-owned surfaces;
- avatar menu does not show My conversations, My offers, My content,
  Preferences, or System;
- `/profile` exposes User info, Referral code, and Preferences through the
  second-column account shell;
- System is role-gated;
- Jobs, Activity, Library, Referrals, Operations, Blog, and Journal do not
  appear in public nav or owner rail;
- mobile shell exposes owner rail concepts without reintroducing the right
  drawer.

Suggested anchors:

- `src/lib/shell/shell-navigation.test.ts`
- `src/components/SiteNav.test.tsx`
- `src/components/AuthenticatedWorkRail.test.tsx`
- browser shell specs under `tests/browser-ui`

Implemented test/evidence anchors:

- `src/lib/shell/shell-navigation.test.ts`
- `tests/shell-navigation-model.test.ts`
- `src/components/AuthenticatedWorkRail.test.tsx`
- `src/components/SiteNav.test.tsx`
- `src/components/AccountMenu.test.tsx`
- `tests/shell-acceptance.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`
- `tests/shell-visual-system.test.tsx`
- `src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts`
- `tests/admin-shell-and-concierge.test.tsx`
- `tests/job-visibility-solid.test.ts`
- `tests/ux-layout-navigation.test.tsx`
- `src/app/profile/page.test.tsx`
- `src/components/profile/ProfileSettingsPanel.test.tsx`
- `tests/browser-ui/business-workspace.spec.ts`
- `tests/browser-ui/mobile-workspace-admin-lists.spec.ts`
- `src/lib/jobs/job-publication.test.ts`
- `src/lib/jobs/load-user-jobs-workspace.test.ts`
- `src/components/jobs/JobsWorkspace.test.tsx`
- `src/components/studio/StudioWorkspace.test.tsx`
- `src/app/studio/page.test.tsx`
- `src/lib/studio/load-studio-workspace.test.ts`
- `src/components/dashboard/UserDashboard.test.tsx`
- `src/app/workspace/page.test.tsx`
- `src/lib/dashboard/load-user-dashboard.test.ts`
- `src/components/media/UserMediaWorkspace.test.tsx`
- `src/app/my/media/page.test.tsx`
- `src/lib/media/user-media.test.ts`
- `tests/media-architecture-audit.test.ts`
- `tests/jobs-system-dashboard.test.ts`
- `src/app/admin/system/operations/page.test.tsx`
- `src/app/admin/system/backups/page.test.tsx`
- `src/app/admin/system/keys/KeysManager.test.tsx`
- `docs/_refactor/ordo/evidence/phase-01c3u-shell-menu-and-account-surface-alignment.md`

## QA

QA pass 1:

- Ran focused shell/product tests.
- Ran `npm run typecheck`.
- Ran focused `npm run lint -- ...` on touched shell/model/test files.
- Issues found and fixed:
  - stale tests still expected Profile in the owner rail;
  - stale tests still expected no signed-in account menu in `SiteNav`;
  - footer duplicated Offers/About after About moved into the owner rail;
  - account-menu tests mocked `resolveAccountMenuRoutes` without
    `isShellRouteActive`;
  - shell visual tests assumed the old System Legibility accordion.

QA pass 2:

- Reran focused shell/product tests. Passed: 13 files, 126 tests.
- Reran `npm run typecheck`. Passed.
- Reran focused `npm run lint -- ...` on touched shell/model/test files.
  Passed.
- Ran stale-surface scans against shell components, route model, and shell
  tests. No stale Jobs/Activity/Library/Referrals/Operations/Blog/Journal
  exposure returned to public nav or owner rail.
- Removed one stale `profile` icon branch from `AuthenticatedWorkRail` found
  during static inspection, then reran focused tests/typecheck/lint/scans.
- Ran owner UI leak scans. No fake metrics, raw provider logs, raw runtime logs,
  or private diagnostic details were introduced in the shell/account surfaces.

Additional critique-driven pass:

- Removed My conversations, My offers, My content, Preferences, and System from
  the avatar account menu.
- Renamed My QR / referral link to My Referrals and routed it to the account
  second-column referral section.
- Collapsed Profile and Preferences into a single account surface with User
  info, Referral code, and Preferences sections.
- Moved the theme control into the account-menu header as a toggle.
- Tightened profile/account CSS so the second-column account shell lines up
  with the global authenticated shell.
- Added mobile browser coverage that caught a stale job-event ordering bug;
  fixed job publication fallback and work-index sorting so active work stays
  in the opening viewport.

## Non-Goals

- Do not implement the full System second column.
- Do not delete donor routes yet.
- Do not redesign the public homepage.
- Do not expose raw jobs/operations/logs in the owner shell.
