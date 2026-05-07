# Phase 01c6: Navigation Regression Cleanup And Closeout

Status: Planned

Parent phase:

- `01c-public-navigation-footer-and-mobile-system.md`

Depends on:

- `01c5-command-seo-and-route-state-parity.md`

## Goal

Close the navigation refactor and remove the old product assumptions.

This phase exists because navigation regressions are easy to miss: a route can
be removed from the header but remain in commands, fixtures, not-found actions,
or a stale drawer test.

## Product Rule

The old drawer-first navigation model is dead.

The drawer can survive as utility/settings/overflow, but it must not be the
primary public, signed-in, or admin discovery surface.

## Current Code To Research

- `src/components/SiteNav.tsx`
- `src/components/ShellWorkspaceMenu.tsx`
- `src/components/ShellNavDrawer.tsx`
- `src/components/SiteFooter.tsx`
- `src/lib/shell/shell-navigation.ts`
- `src/lib/admin/admin-navigation.ts`
- `tests/shell-acceptance.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `tests/shell-navigation-model.test.ts`
- `tests/shell-command-parity.test.ts`
- `tests/homepage-shell-layout.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`
- `src/components/SiteNav.test.tsx`

## Required Work

- Run the full 01cX navigation test set.
- Run stale scans for:
  - drawer-only public discovery,
  - unconditional Feed discovery,
  - `Library` as public nav,
  - `Journal` as public nav,
  - jobs/notification top-nav placement,
  - hardcoded notification placeholder defaults,
  - two-column user jobs layout assumptions,
  - duplicate shell brand marks,
  - old route IDs such as `nav-feed` in empty-state fixtures.
- Update phase closeout evidence with:
  - public desktop proof,
  - public mobile proof,
  - empty-feed proof,
  - one-published-feed proof,
  - authenticated rail proof,
  - dashboard/activity proof,
  - attention inbox proof,
  - single-column work index proof,
  - admin rail proof.
- Update `01d`, `01e`, and `01f` dependencies if their assumptions changed.

## Positive Tests

- Anonymous desktop navigation passes.
- Anonymous mobile navigation passes.
- Authenticated rail passes.
- Admin rail passes.
- Empty feed state passes.
- Published feed state passes.

## Negative Tests

- Public routes are not discoverable only through hidden drawer.
- Empty feed is not promoted.
- Admin/workspace routes do not leak to anonymous nav.
- Stale public library/journal/blog routes do not return.

## Edge Tests

- Narrow mobile viewport.
- Short mobile viewport.
- Admin on deep admin routes.
- Signed-in user on feed route.
- Feed state read failure.

## Cleanup

- Delete obsolete tests instead of preserving contradictory behavior.
- Remove dead components if `ShellNavDrawer` is fully replaced.
- Keep `ShellWorkspaceMenu` only if it has a clear utility role.
- Update parent phase status/evidence.

## Exit Criteria

- Navigation refactor is complete and documented.
- Old drawer-first assumptions are gone from tests.
- The frontend shell feels close to final product shape.
