# 02 UI Surface Realignment: Shell And Menu IA Alignment

Status: Draft spec

## Goal

Make shell navigation match the canonical Ordo IA without changing surface
semantics in multiple places. The shell must preserve the invariant: chat is
the operating interface, and UI surfaces are the governance layer.

## Current Code Grounding

Current anchors:

- `src/lib/shell/shell-navigation.ts`
- `src/components/SiteNav.tsx`
- `src/components/AuthenticatedWorkRail.tsx`
- `src/components/shell/ShellMobileMainMenu.tsx`
- `src/components/AccountMenu.tsx`
- `src/components/AppShell.tsx`
- `src/components/public/PublicRouteLinks.tsx`
- `src/components/ShellWorkspaceMenu.test.tsx`
- `src/components/AuthenticatedWorkRail.test.tsx`
- `src/components/SiteNav.test.tsx`
- `src/components/AccountMenu.test.tsx`
- `src/lib/shell/shell-navigation.test.ts`

## Verified Current State

- `SHELL_ROUTES` is the central route registry.
- `PRIMARY_NAV_ROUTE_IDS` is `home`, `feed`, `offers`, `about`.
- `ACCOUNT_MENU_ROUTE_IDS` is `profile`, `referrals`.
- `AUTHENTICATED_WORK_RAIL_ROUTE_IDS` is `ordo-chat`, `workspace-overview`,
  `studio`, `business`, `offers`, `business-about`.
- `AUTHENTICATED_ADMIN_RAIL_ROUTE_IDS` is `admin-dashboard`, `admin-jobs`,
  `admin-system`.
- `SiteNav` renders `ShellMobileMainMenu` inside the brand region for signed-in
  users and renders account actions on the right.
- The previous hamburger issue was caused by shell/menu presentation leaking
  into desktop expectations. The shell contract should make hamburger behavior
  explicit: mobile-only, integrated with the brand zone.
- The route id `business-about` currently points at `/about` but uses
  `targetSurface: "profile_settings"`, which is stale. It should be governed as
  owner About/business-story, not account settings.
- `ordo-chat` currently has `targetSurface: "public"` although signed-in
  Conversations is an owner operating surface. That is stale naming in the
  registry even if the href remains `/`.
- Knowledge Base is not present in owner rail yet.

## Target Behavior

### Public top rail

- Brand/logo links to Home.
- Top center nav shows Offers, About, and Feed only when public content exists.
- Top center nav never shows owner/admin/donor routes.

### Owner rail

Order:

1. Conversations
2. Today
3. Studio
4. People
5. Offers
6. About
7. Knowledge Base, only after its read model is implemented

Rules:

- Conversations comes first.
- The desktop rail uses stable icon and label alignment.
- Mobile uses a hamburger integrated into the brand/left shell zone.
- The hamburger does not render as an extra desktop action.

### Account menu

Menu contents:

- My Account
- Affiliate Dashboard
- Sign out
- Theme toggle in the menu header

Rules:

- Change Password lives only in the My Account second column.
- Preferences live only in My Account.
- Affiliate Dashboard links to `/referrals`.
- System lives only in the admin rail.

### Admin rail

Order:

1. Admin
2. Jobs
3. System

Rules:

- Factory should not be a visible primary label.
- Raw operations/logs/provider internals stay inside System/Admin.

## Reuse / Move / Hide / Mock Decisions

- Reuse `SHELL_ROUTES` as source of truth.
- Move route/surface stale labels into the registry, not local component
  conditionals.
- Hide donor routes from `PRIMARY_NAV_ROUTE_IDS`, `ACCOUNT_MENU_ROUTE_IDS`, and
  owner rail ids.
- Do not mock shell routes. If a route has no product surface yet, omit it from
  primary navigation.

## Positive Tests

- `resolvePrimaryNavRoutes` returns only public route ids and conditionally
  includes Feed.
- `resolveAuthenticatedWorkRailRoutes` returns owner rail routes in canonical
  order.
- `resolveAccountMenuRoutes` returns My Account and Affiliate Dashboard.
- Admin users see Admin, Jobs, and System in admin rail.
- Mobile signed-in shell exposes hamburger/menu from the brand zone.

## Negative Tests

- Desktop shell does not render the hamburger as an account-side icon.
- Account menu does not include Change Password, Preferences, System, My Media,
  My Conversations, My Offers, My Content, or QR.
- Public nav does not include Library, Blog, Journal, Jobs, Activity,
  Operations, Admin, System, or Referrals.
- Owner rail does not include donor or diagnostic routes.

## Edge Tests

- Anonymous users see login/register access and public nav only.
- Signed-in non-admin users do not see admin rail items.
- Admin users see owner rail and admin rail without duplicate System links.
- Feed route is removed from public nav when `hasPublicFeedItems` is false.
- Account menu closes on route change and Escape on desktop and mobile sheet.

## Acceptance Criteria

- Shell route registry is the only source for the four nav zones.
- Route target surfaces align with product meaning.
- Hamburger behavior is explicitly mobile-only.
- All route links remain keyboard-accessible and have visible focus states.
- Desktop brand, left rail, and second-column boundaries line up without
  decorative seams or extra shadows.

## Non-Goals

- No new surface implementation.
- No redesign of Account detail content.
- No Knowledge Base rail item until the Knowledge Base read model exists.

## Required Commands

```bash
npx vitest run src/lib/shell/shell-navigation.test.ts src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/ShellWorkspaceMenu.test.tsx src/components/AccountMenu.test.tsx
npm run typecheck
npm run lint -- src/lib/shell/shell-navigation.ts src/components/SiteNav.tsx src/components/AuthenticatedWorkRail.tsx src/components/AccountMenu.tsx src/components/shell/ShellMobileMainMenu.tsx
rg -n "My media|My conversations|My offers|My content|Change Password|Preferences|System|Factory|Activity|Operations|Jobs" src/components src/lib/shell
```

## Closeout Evidence Required

- Before/after route registry diff.
- Desktop screenshot of shell with no hamburger.
- Mobile screenshot of hamburger integrated with brand zone.
- Account menu screenshot showing My Account, Affiliate Dashboard, theme, and
  Sign out only.
- Test output for shell navigation, account menu, and work rail.
