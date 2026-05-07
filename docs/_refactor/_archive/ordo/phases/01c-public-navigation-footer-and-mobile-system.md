# Phase 01c: Frontend Navigation System Refactor

Status: Planned

Parent phase:

- `01-public-site-shell-and-navigation.md`

Depends on:

- `01a-public-shell-chat-and-ui-audit.md`
- `01b-route-access-and-public-surface-contract.md`

## Goal

Refactor Ordo's frontend navigation into the product shape we actually want:

- public visitors get an obvious, small public site map,
- signed-in users get a durable work surface,
- staff/admin users get a clear tool rail for global operations,
- feed discovery appears only when there is public content,
- the old hidden-left-menu pattern stops being the primary way to understand
  the product.

The current `ShellWorkspaceMenu` has become a utility drawer, public site nav,
role simulator, admin menu, workspace menu, theme panel, and sign-out surface at
the same time. That is why the navigation feels wrong. This phase splits those
responsibilities into clear surfaces.

## Product Rule

Chat is the operator. Navigation and footer are the map.

Public users should always be able to find:

- Home/chat,
- Offers,
- About.

Feed is optional output. It should be visible in public navigation, footer,
commands, and sitemap only after the instance has at least one published public
feed item. The `/feed` route may still exist and render an honest empty state
when directly visited.

Signed-in users should not have to open a public-site menu to find work. Staff
and admin users should not have to scroll through public links to find global
operations. The authenticated shell needs a tool rail.

## Blast Radius

Frontend shell navigation, public nav, footer, mobile bottom nav, command
projection, sitemap/SEO route discovery, workspace/admin navigation, shell
tests, and account/start actions.

Do not redesign individual admin/workspace page internals unless the existing
navigation shell prevents the new rail from being coherent.

## 01cX Implementation Series

This phase is intentionally split because it touches almost every frontend
navigation assumption:

1. `01c0-navigation-refactor-grounding-and-contract.md`
   - Freeze the target route/role/state contract and collect current code
     evidence.
2. `01c1-public-discovery-and-conditional-feed.md`
   - Add context-aware public route discovery and hide feed when empty.
3. `01c2-public-mobile-footer-and-safe-area-system.md`
   - Build visible desktop/mobile public nav and composer-safe bottom/footer
     behavior.
4. `01c3-authenticated-workspace-tool-rail.md`
   - Replace signed-in hidden-menu primary discovery with a work rail.
5. `01c4-admin-global-factory-navigation-rail.md`
   - Add admin/staff global and factory group navigation.
6. `01c5-command-seo-and-route-state-parity.md`
   - Align commands, sitemap, robots, footer, drawer, and tests with the same
     route state.
7. `01c6-navigation-regression-cleanup-and-closeout.md`
   - Remove stale drawer-first/public-route assumptions and close the refactor.

## Target Navigation Model

### Public Anonymous

Desktop:

- brand/home,
- Offers,
- About,
- Feed only if `hasPublicFeedItems`,
- Login/Register as secondary access actions.

Mobile:

- brand/home in top chrome,
- bottom or footer gate with Chat, Offers, About, and conditional Feed,
- account access remains available without competing with route clarity.

### Signed-In User

Desktop:

- persistent app rail for My Work:
  - Chat/Home,
  - Current Work,
  - Jobs,
  - My Media,
  - Referrals,
  - Profile.

Mobile:

- compact bottom/work rail or sheet with the same My Work destinations.

### Staff/Admin

Desktop:

- app rail includes My Work plus Factory and Global/Admin groups:
  - Factory: workflows, operations, media/content production, feed drafts,
    work orders as those surfaces land.
  - Global/Admin: dashboard, users, conversations, leads, affiliates, prompts,
    system, backups, jobs.

Mobile:

- role-aware work sheet with the same grouping and clear section labels.

The old menu can remain as a utility/settings drawer during the transition, but
it must stop being the only place where users discover core routes.

## Navigation State Contract

Introduce a small context object rather than making shell routes async:

```ts
interface ShellNavigationContext {
  hasPublicFeedItems: boolean;
}
```

The context is loaded server-side near the root shell and passed into client
navigation components. Route definitions remain pure data, but route resolvers
accept the context and filter stateful destinations such as `feed`.

Initial feed state can be backed by the existing blog donor repository, but
implementation should prefer a lightweight count/read-model method over loading
all published posts on every layout render.

## Current Code To Research

- `src/components/SiteNav.tsx`
- `src/components/AppShell.tsx`
- `src/components/ShellWorkspaceMenu.tsx`
- `src/components/ShellNavDrawer.tsx`
- `src/components/AccountMenu.tsx`
- `src/lib/shell/shell-navigation.ts`
- `src/lib/shell/shell-commands.ts`
- `src/lib/admin/admin-navigation.ts`
- `src/app/layout.tsx`
- `src/app/sitemap.ts`
- `src/app/feed/page.tsx`
- `src/core/use-cases/BlogPostRepository.ts`
- `src/adapters/BlogPostDataMapper.ts`
- `src/app/styles/**`
- `tests/shell-acceptance.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `tests/SiteNav*`
- `tests/shell-command-parity.test.ts`

Reference pattern:

- `../testing/components/site-footer.tsx`
- `../testing/components/motion/PresentationFooterGate.tsx`
- `../testing/app/globals.css`

## Required Work

- Execute the 01cX sequence.
- Keep route visibility driven by one shared model.
- Make feed conditional on real public content.
- Build visible public desktop/mobile navigation.
- Build authenticated/admin rail patterns.
- Preserve direct access to route pages even when a route is hidden from
  discovery.
- Make command/search/SEO route projection match the visible product state.
- Remove tests that encode the old drawer-first navigation model.

## Positive Tests

- Desktop anonymous shell visibly exposes Home/chat, Offers, and About.
- Desktop anonymous shell exposes Feed only when content exists.
- Mobile anonymous shell visibly exposes the same public route set.
- Footer exposes the same public route set.
- Account/start action remains available.
- Signed-in user has visible My Work navigation.
- Admin user has visible Global/Admin navigation.

## Negative Tests

- Core public routes are not only discoverable through a hidden left menu.
- Footer/bottom nav does not cover the chat composer.
- Anonymous nav does not expose admin/workspace/jobs/operations/profile.
- Empty feed is not promoted in nav/footer/commands/sitemap.
- Admin/global routes are not mixed into public navigation.

## Edge Tests

- Narrow mobile viewport.
- Short mobile viewport.
- Empty feed.
- One published feed item.
- No offers.
- Signed-in user still has access to role-gated management surfaces.
- Admin with many route groups.
- Reduced motion if Phase 01e has already changed public motion behavior.

## Cleanup

- Remove public tests that expect `Library` and `Journal` in footer/nav.
- Remove account/menu copy that says anonymous is in sales-agent mode or that
  signed-in users have full library access.
- Remove tests that expect primary public route discovery to live only in
  `ShellWorkspaceMenu`.
- Rename current "Journal" admin nav toward public-content/feed language once
  the feed phase owns the data model.

## Exit Criteria

- Public navigation is visible and understandable on desktop and mobile.
- Footer/bottom navigation is an approved public navigation pattern.
- Hidden left drawer is not the primary public discovery path.
- Feed is hidden from discovery when empty and visible when published content
  exists.
- Signed-in/admin users have visible role-appropriate work/global navigation.
