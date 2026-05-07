# Phase 01c0: Navigation Refactor Grounding And Contract

Status: Planned

Parent phase:

- `01c-public-navigation-footer-and-mobile-system.md`

Depends on:

- `01a-public-shell-chat-and-ui-audit.md`
- `01b-route-access-and-public-surface-contract.md`

## Goal

Freeze the frontend navigation contract before changing UI.

This phase collects current evidence, defines the target route/role/state model,
and prevents the refactor from becoming a cosmetic rewrite.

## Product Rule

Navigation is a product contract, not a menu component.

Every visible destination must answer:

- who can see it,
- where it belongs,
- whether it is public, personal, factory, or global,
- whether it depends on content state.

## Current Code Grounding

Known current facts:

- `src/components/SiteNav.tsx` renders brand, workspace menu, jobs rail,
  notifications, and guest access.
- `src/components/ShellWorkspaceMenu.tsx` mixes public routes, workspace routes,
  admin routes, current-workspace links, accessibility controls, role
  simulation, and logout.
- `src/lib/shell/shell-navigation.ts` currently lists `feed` in public route
  groups unconditionally.
- `src/app/layout.tsx` can load server-side shell state before rendering
  `AppShell`.
- `src/app/feed/page.tsx` exists and already has an empty state.
- `src/core/use-cases/BlogPostRepository.ts` exposes `listPublished()` but not
  an efficient public-feed count.

## Required Work

- Inventory all shell navigation entry points:
  - header,
  - footer,
  - drawer,
  - account/menu,
  - command palette,
  - sitemap,
  - robots,
  - not-found actions,
  - rich message route actions.
- Define route groups:
  - Public,
  - My Work,
  - Factory,
  - Global/Admin,
  - Utility/Settings.
- Define `ShellNavigationContext` with at least:
  - `hasPublicFeedItems`.
- Decide which components receive context directly and which use pure route
  resolvers.
- Add doc evidence naming exact tests that need to change.

## Positive Tests

- Route model can resolve anonymous, signed-in, staff, and admin route groups.
- Route model can resolve public routes with `hasPublicFeedItems = false`.
- Route model can resolve public routes with `hasPublicFeedItems = true`.

## Negative Tests

- Empty feed is not included in public discovery.
- Anonymous users do not receive My Work, Factory, or Global route groups.
- Route model does not require async work in component render.

## Edge Tests

- Missing navigation context defaults to safe public state.
- Multi-role admin user receives admin groups once, without duplicate links.
- Unknown route id throws in tests rather than failing silently.

## Cleanup

- Mark stale public-drawer tests for replacement in later 01c phases.
- Record intentionally retained donor code for feed/admin journal.

## Exit Criteria

- A tested navigation model contract exists.
- Implementation phases know which files and tests they own.
- No UI refactor starts before route state is explicit.
