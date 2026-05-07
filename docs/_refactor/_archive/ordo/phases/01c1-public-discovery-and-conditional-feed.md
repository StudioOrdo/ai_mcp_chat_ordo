# Phase 01c1: Public Discovery And Conditional Feed

Status: Complete

Parent phase:

- `01c-public-navigation-footer-and-mobile-system.md`

Depends on:

- `01c0-navigation-refactor-grounding-and-contract.md`

## Goal

Make public route discovery honest.

`/feed` is valid, but Feed is not promoted until there is published public
content to show.

## Product Rule

Empty feed is a route state, not a navigation promise.

Visitors should not see `Feed` in the primary public navigation, footer,
commands, or sitemap until a public feed item exists.

## Current Code To Research

- `src/lib/shell/shell-navigation.ts`
- `src/lib/shell/shell-commands.ts`
- `src/components/SiteFooter.tsx`
- `src/app/sitemap.ts`
- `src/app/robots.ts`
- `src/app/feed/page.tsx`
- `src/core/use-cases/BlogPostRepository.ts`
- `src/adapters/BlogPostDataMapper.ts`
- `tests/shell-navigation-model.test.ts`
- `tests/shell-command-parity.test.ts`
- `tests/shell-acceptance.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `src/app/sitemap.test.ts`

## Required Work

- Add route-state support to shell route resolution.
- Mark Feed as a conditional public discovery route.
- Add a public shell state loader that answers whether public feed items exist.
- Prefer a count/read-model method over loading every published post.
- Keep direct `/feed` route access and empty-state rendering.
- Hide Feed from:
  - public header discovery,
  - footer,
  - workspace/public drawer group,
  - command definitions,
  - sitemap.
- Keep robots allowed for `/feed`; robots permission is not route promotion.

## Positive Tests

- With one published feed item, Feed appears in public route groups.
- With one published feed item, `nav-feed` appears in commands.
- With one published feed item, sitemap includes `/feed`.
- Direct `/feed` renders the feed page.

## Negative Tests

- With zero published feed items, Feed is absent from public route groups.
- With zero published feed items, `nav-feed` is absent from commands.
- With zero published feed items, sitemap excludes `/feed`.
- Hiding Feed does not remove Offers or About.

## Edge Tests

- Feed count loader fails closed and hides Feed from discovery.
- Feed item exists but is not published.
- Admin draft exists but no public item exists.

## Cleanup

- Remove tests that assume Feed is always public navigation.
- Keep direct route tests separate from discovery tests.

## Exit Criteria

- Feed discovery is truthful and state-driven.
- Public route state uses one shared resolver across nav, footer, commands, and
  sitemap.

## Implementation Notes

Completed in current code:

- Added `ShellNavigationContext` with `hasPublicFeedItems`.
- Marked the `feed` shell route with a `public-feed` content gate.
- Updated shell route resolvers so primary nav, rail routes, footer groups,
  drawer groups, route visibility snapshots, and command routes share the same
  stateful filtering.
- Added `loadPublicShellNavigationContext()` in
  `src/lib/shell/public-shell-state.ts`.
- Added `ShellNavigationProvider` so command mentions and command execution can
  use the same feed state as the shell.
- Wired the root layout to load public feed state server-side and pass it into
  `AppShell`, `ChatSurface` command context, `SiteNav`, `SiteFooter`, and
  `ShellWorkspaceMenu`.
- Added `BlogPostRepository.countPublished()` and SQLite implementation so the
  shell does not load all published posts on every layout render.
- Updated sitemap behavior:
  - empty feed: `/feed` is excluded,
  - published feed content: `/feed` is included.
- Kept robots allowed for `/feed`; robots remains route permission, not public
  promotion.
- Kept direct `/feed` route access and empty-state page rendering.

## QA Evidence

Focused implementation tests:

```bash
npx vitest run tests/shell-navigation-model.test.ts src/lib/shell/shell-navigation.test.ts tests/shell-command-parity.test.ts tests/shell-command-parity.test.tsx tests/shell-acceptance.test.tsx tests/site-shell-composition.test.tsx src/app/sitemap.test.ts tests/seo-infrastructure.test.ts src/lib/shell/public-shell-state.test.ts tests/public-content-routes.test.ts tests/blog-pipeline-integration.test.ts
```

Result:

- 11 test files passed.
- 124 tests passed.

Static checks:

```bash
npm run typecheck
npx eslint src/lib/shell/shell-navigation.ts src/lib/shell/shell-commands.ts src/lib/shell/ShellNavigationContextProvider.tsx src/lib/shell/public-shell-state.ts src/components/AppShell.tsx src/components/SiteNav.tsx src/components/SiteFooter.tsx src/components/ShellWorkspaceMenu.tsx src/components/ShellNavDrawer.tsx src/hooks/useCommandRegistry.ts src/app/layout.tsx src/app/sitemap.ts tests/shell-navigation-model.test.ts src/lib/shell/shell-navigation.test.ts tests/shell-command-parity.test.ts tests/shell-command-parity.test.tsx tests/shell-acceptance.test.tsx tests/site-shell-composition.test.tsx src/app/sitemap.test.ts tests/seo-infrastructure.test.ts src/lib/shell/public-shell-state.test.ts tests/blog-pipeline-integration.test.ts
```

Result:

- TypeScript passed.
- Targeted ESLint passed.
