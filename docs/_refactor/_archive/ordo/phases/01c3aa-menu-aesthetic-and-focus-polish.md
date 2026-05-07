# Phase 01c3aa: Menu Aesthetic And Focus Polish

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3u-shell-menu-and-account-surface-alignment.md`
- `01c3v-people-selection-column-and-mobile-drill-in.md`
- `01c3z-relationship-settings-and-people-shell-closeout.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_refactor/ordo/hit-lists/01c3aa-menu-aesthetic-hit-list.md`

Blocks:

- `01c4-admin-global-factory-navigation-rail.md`

## Goal

Polish the shell menus so the app matches the intended Studio Ordo UX target:
quiet public navigation, clear owner workspace rail, precise account menu,
visible focus states, and mobile controls that feel deliberate rather than
bolted on.

## Product Rule

Chat is the operating interface. UI surfaces are the governance layer.

Menus should reveal the smallest useful governance surface:

- public visitors see public navigation;
- owners see business workspace navigation;
- user-owned objects live in the account menu;
- system/admin routes remain role-gated.

## Current Code Grounding

- `src/components/SiteNav.tsx`
  - Correctly renders public nav plus account access.
- `src/components/public/PublicRouteLinks.tsx`
  - Correctly resolves About, Offers, and conditional Feed.
- `src/components/AuthenticatedWorkRail.tsx`
  - Correctly resolves Today, Studio, People, Offers, About, and authorized
    admin routes.
- `src/components/AccountMenu.tsx`
  - Correctly groups account-owned and user-owned surfaces.
  - Needs icons, calmer row rhythm, less decorative dropdown motion, and a
    tighter account-only route set.
- `src/components/business/BusinessWorkspace.tsx`
  - Uses the People second column and selected-person detail surface.
  - Must consume a global shell second-column primitive instead of owning a
    local centered grid.
- `src/app/styles/shell.css`
  - Owns public nav, owner rail, account menu, dropdown, and mobile dock visual
    rules.
  - Needs the main polish work and should own the shared authenticated shell
    geometry.
- `src/app/styles/utilities.css`
  - Owns `focus-ring`, `input-field`, and shared utility tokens.

## Required Work

### Public Nav

- Keep public route set unchanged.
- Make public nav visually lighter by reducing the center pill treatment.
- Preserve centered alignment and focus states.
- Keep Feed conditional.

### Owner Rail

- Keep route set unchanged.
- Desktop rail should be icon + label in one row.
- Active state should be a thin indicator plus subtle surface treatment.
- Keep mobile bottom dock compact and scroll-safe.
- Keep System/admin entries role-gated.

### Shell Geometry

- Treat the second column as a global shell primitive, not a People-only column.
- Add shared owner rail and second-column width tokens.
- Align authenticated top navigation to those same tokens.
- Put the logo/brand at the top-left shell corner in authenticated mode.
- Let the company/site name span at most the owner rail plus second-column
  width.
- Make the top rail and left rail meet as one clean frame with no glass/shadow
  effect at the seam.
- Move the People workspace to the global governance grid primitive as the
  first consumer.

### Account Menu

- Add small icons to account menu route rows.
- Keep rows plain case, not uppercase-heavy.
- Keep only account-owned routes: My profile, My media, My Referrals,
  Preferences, and Sign out.
- Remove My conversations, My offers, and My content from the account menu
  because People, Offers, and Studio own those domains.
- Keep System in the left rail for authorized users, not in the account menu.
- Rename QR/referral account access to My Referrals.
- Move Light/Dark into the account menu header as a slide toggle.
- Reduce dropdown radius/motion to feel precise.
- Keep mobile sheet behavior.
- Keep Sign out accessible and visually aligned.

### Focus And Accessibility

- Preserve visible focus rings.
- Keep minimum mobile touch targets.
- Ensure icon-only controls retain accessible labels.
- Do not hide routes behind a right-side drawer.

## Tests

Add or update tests proving:

- account menu rows render icons for My profile, My media, My Referrals, and
  Preferences;
- account menu does not show My conversations, My offers, My content, or
  System;
- theme renders as a header slide toggle;
- account menu still opens as mobile sheet;
- owner rail still exposes Today, Studio, People, Offers, About on mobile;
- owner rail does not expose Jobs, Operations, Logs, Activity, Profile, or raw
  donor routes;
- public nav still exposes About, Offers, and conditional Feed only;
- shell CSS contains the polished owner rail and dropdown primitives;
- shell CSS contains global owner rail and second-column tokens;
- authenticated top rail uses a corner brand region spanning owner rail plus
  second-column width;
- People uses the global governance grid primitive;
- static scans show no raw Jobs/Operations/Logs in owner shell UI.

Suggested anchors:

- `src/components/AccountMenu.test.tsx`
- `src/components/AuthenticatedWorkRail.test.tsx`
- `src/components/SiteNav.test.tsx`
- `tests/shell-visual-system.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `tests/browser-ui/business-workspace.spec.ts`

## Non-Goals

- Do not change the product navigation contract.
- Do not add new pages.
- Do not implement admin global rail yet.
- Do not delete donor routes.
- Do not redesign People content cards or relationship settings.

## QA Requirements

Run:

- focused component tests for AccountMenu, AuthenticatedWorkRail, SiteNav;
- shell visual/composition tests;
- browser smoke for `/business`;
- typecheck;
- focused eslint;
- static scans for stale owner-shell labels and hydration-prone patterns.

## Implementation Notes

- Treat `src/app/styles/shell.css` as the primary implementation point.
- Keep component changes small and limited to account menu row icons if
  possible.
- Avoid adding event handlers to server components.
- Avoid date/random/client-branch hydration hazards.

## Closeout Evidence Required

Document:

- CSS primitives changed;
- account menu component changes;
- shell/nav tests run;
- browser/mobile evidence;
- static scan results;
- remaining risks or deferred work.

## Implementation Summary

Implemented 2026-05-05.

Changed code:

- `src/components/SiteNav.tsx`
  - Marks authenticated shell nav with `data-shell-nav-authenticated`.
  - Keeps the public route links in the top nav.
  - Uses the account menu instead of top-right jobs/notification controls.
- `src/components/public/PublicRouteLinks.tsx`
  - Removes the heavy center nav pill treatment from the markup.
  - Keeps About, Offers, and conditional Feed behavior unchanged.
- `src/components/AccountMenu.tsx`
  - Adds icons for the retained account-owned route rows, access rows, and
    sign out.
  - Keeps only My profile, My media, My Referrals, Preferences, and Sign out in
    the account menu.
  - Removes My conversations, My offers, My content, and System from the
    account menu.
  - Moves Light/Dark from a menu row into the account header as a slide toggle.
  - Keeps mobile account access as a sheet rather than a right-side drawer.
- `src/lib/shell/shell-navigation.ts`
  - Renames QR/referral account access to My Referrals.
  - Tightens the account menu route resolver to account-owned routes only.
- `src/components/business/BusinessWorkspace.tsx`
  - Moves People onto the reusable `shell-governance-grid` primitive.
- `src/app/styles/shell.css`
  - Adds global owner rail and second-column width tokens.
  - Adds authenticated top-nav geometry tied to the same shell columns.
  - Joins authenticated top rail and left rail with simple background/borders
    instead of shadow/blur decoration.
  - Makes the desktop owner rail icon + label in one row with a thin active
    indicator.
  - Lightens public nav, account trigger, account dropdown, and account menu
    icon styling.
- `src/components/AccountMenu.test.tsx`
  - Adds account-menu icon coverage.
- `src/components/SiteNav.test.tsx`
  - Adds authenticated shell grid and CSS primitive coverage.
- `src/lib/shell/shell-navigation.test.ts`
  - Covers the tightened account menu route set and My Referrals label.
- `tests/browser-ui/business-workspace.spec.ts`
  - Covers the mobile owner rail and the slim account menu contract.

Evidence:

- `docs/_refactor/ordo/hit-lists/01c3aa-menu-aesthetic-hit-list.md`
- `docs/_refactor/ordo/evidence/phase-01c3aa-menu-aesthetic-and-focus-polish.md`
