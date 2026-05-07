# Phase 01c5: Command, SEO, And Route-State Parity

Status: Planned

Parent phase:

- `01c-public-navigation-footer-and-mobile-system.md`

Depends on:

- `01c4-admin-global-factory-navigation-rail.md`

## Goal

Make every navigation projection agree with the same route state.

The visible UI, command palette, slash mentions, sitemap, robots posture, rich
message action routes, and not-found actions must not tell different stories.

## Product Rule

One route state model, many projections.

If Feed is hidden because there is no public content, every discovery surface
must agree. If an admin route is role-gated, public commands and public footer
must not leak it.

## Current Code To Research

- `src/lib/shell/shell-navigation.ts`
- `src/lib/shell/shell-commands.ts`
- `src/hooks/useCommandRegistry.ts`
- `src/app/sitemap.ts`
- `src/app/robots.ts`
- `src/app/not-found.tsx`
- `src/frameworks/ui/RichContentRenderer.tsx`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `tests/shell-command-parity.test.ts`
- `tests/seo-infrastructure.test.ts`
- `src/app/sitemap.test.ts`
- `src/frameworks/ui/RichContentRenderer.test.tsx`

## Required Work

- Pass navigation context through command creation where needed.
- Keep static command fixtures honest or replace them with context-aware test
  helpers.
- Make sitemap include Feed only when public content exists.
- Keep robots route permissions conservative without using robots as public
  route promotion.
- Update not-found actions so they point to Home, Offers, About, and
  conditional Feed.
- Update rich-message route examples away from unconditional Feed when testing
  empty public state.

## Positive Tests

- Commands match visible route state.
- Slash mentions match command state.
- Sitemap matches public discovery state.
- Not-found actions are valid public routes.

## Negative Tests

- Empty feed does not create `nav-feed`.
- Empty feed does not appear in sitemap.
- Public command registry does not expose workspace/admin routes.
- Deleted public routes do not return through message fixtures.

## Edge Tests

- Feed hidden in anonymous context but visible in admin direct route context
  only where explicitly intended.
- Sitemap loader handles feed-state read failure safely.
- Rich message route action to `/feed` still routes if a tool explicitly emits
  it, but default public suggestions do not promote empty Feed.

## Cleanup

- Remove static command constants that cannot represent state if they become
  misleading.
- Rename tests around route state rather than old command parity assumptions.

## Exit Criteria

- Route projections are consistent across UI, commands, SEO, and message
  actions.
- Feed state cannot drift between surfaces.
