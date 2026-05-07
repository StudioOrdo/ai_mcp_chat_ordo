# Phase 01c2: Public Mobile, Footer, And Safe-Area System

Status: Complete

Parent phase:

- `01c-public-navigation-footer-and-mobile-system.md`

Depends on:

- `01c1-public-discovery-and-conditional-feed.md`

## Goal

Make public navigation visible on desktop and mobile without relying on the
hidden left menu.

The homepage remains conversation-first, but the site must still feel
inspectable and familiar.

This phase does not build the signed-in work rail or admin/factory rail. Those
belong to 01c3 and 01c4. This phase makes the anonymous/public product surface
understandable first.

## Product Rule

Public route discovery must be visible.

The public user should not need to know there is a drawer to find Offers,
About, or Feed when Feed is available.

Chat is still the primary operator. Navigation is the map. Public navigation
must be compact enough for solopreneurs with little content, and it must stay
truthful when the feed is empty.

## Previous Phase Grounding

Use the completed route-state model from 01c1 rather than creating new public
route arrays in components.

01c1 completed:

- `ShellNavigationContext` in `src/lib/shell/shell-navigation.ts`.
- `DEFAULT_SHELL_NAVIGATION_CONTEXT` with `hasPublicFeedItems: false`.
- `feed` route gated by `contentGate: "public-feed"`.
- `loadPublicShellNavigationContext()` in
  `src/lib/shell/public-shell-state.ts`.
- `ShellNavigationProvider` in
  `src/lib/shell/ShellNavigationContextProvider.tsx`.
- `AppShell`, `SiteNav`, `SiteFooter`, `ShellWorkspaceMenu`, command
  registry, and sitemap now receive or resolve the same navigation context.
- `BlogPostRepository.countPublished()` backs feed discovery without loading
  all posts.

This phase should consume `resolvePrimaryNavRoutes()` or
`resolveRailMenuRoutes()` with the existing context. It should not reimplement
feed gating in JSX.

## Current Code Grounding

Current shell facts from the worktree after 01c1:

- `src/components/AppShell.tsx`
  - Receives `navigationContext?: ShellNavigationContext`.
  - Treats `/` as `data-shell-route-mode="viewport-stage"`.
  - Treats non-home public routes as `data-shell-route-mode="document-flow"`.
  - Adds `data-shell-floating-chat-clearance="true"` for non-admin document
    routes so mobile content can clear the floating chat launcher.
  - Renders `SiteFooter` outside the homepage viewport stage.
- `src/components/SiteNav.tsx`
  - Receives `navigationContext`.
  - Renders brand/home, `ShellWorkspaceMenu`, guest Login/Register, or
    authenticated Jobs/Notification utilities.
  - Does not render visible public route links today.
  - Current tests assert `data-shell-nav-region="primary-links"` is absent.
  - Applies quiet nav tone on `/feed` and `/feed/*`.
- `src/components/SiteFooter.tsx`
  - Uses `resolveFooterGroups(user, navigationContext)` and
    `resolveFooterGroupRoutes(group, user, navigationContext)`.
  - Already hides Feed when `hasPublicFeedItems` is false.
  - Is currently the only visible public route map outside the drawer.
- `src/components/ShellWorkspaceMenu.tsx`
  - Uses `resolveShellNavDrawerGroups(user, navigationContext)`.
  - Remains useful as a utility drawer, but must stop being the only public
    route discovery surface.
- `src/lib/shell/shell-navigation.ts`
  - `PRIMARY_NAV_ROUTE_IDS` and `RAIL_MENU_ROUTE_IDS` are
    `["home", "feed", "offers", "about"]`.
  - `resolvePrimaryNavRoutes(user, context)` returns Home, Offers, About by
    default and adds Feed only when content exists.
  - `resolveRailMenuRoutes(user, context)` uses the same public route set and
    is the right source for compact mobile route chrome.
- `src/frameworks/ui/ChatSurface.tsx`
  - Suppresses floating chat on `/`.
  - Suppresses floating chat on admin routes.
  - Shows floating chat on public document routes such as `/feed`, `/offers`,
    and `/about`.
- `src/frameworks/ui/ChatContentSurface.tsx`
  - Emits embedded composer row on `/` with
    `data-chat-composer-row="true"`.
  - Emits floating composer plane when the floating chat is open.
- `src/app/styles/foundation.css`
  - Defines safe-area tokens:
    `--safe-area-inset-*`, `--safe-area-padding-*`,
    `--fab-offset-*`, `--fab-launcher-size`,
    `--shell-floating-chat-clearance-block`.
  - Mobile overrides reduce FAB size and offsets.
- `src/app/styles/shell.css`
  - Defines `.shell-nav-frame`, `.shell-nav-band`, `.shell-nav-actions`,
    `.ui-shell-nav-links`, `.ui-shell-nav-item-active`, and
    `.ui-shell-nav-item-idle`.
  - Has mobile document-flow floating-chat clearance for
    `[data-shell-main-surface][data-shell-floating-chat-clearance="true"]`.
  - Still has old quiet-tone selectors named `journal`; these should be
    corrected to `feed` if touched in this phase.
- `src/app/styles/utilities.css`
  - Defines `.safe-area-pt`, `.safe-area-pb`, and `.safe-area-px`.

Reference patterns from `../testing`:

- `../testing/components/site-footer.tsx`
  - Useful idea: compact brand plus handout links as a persistent public map.
  - Do not copy route names, visual brand, or the external-link model.
- `../testing/components/motion/PresentationFooterGate.tsx`
  - Useful idea: body/state gate for footer compaction on constrained
    presentation surfaces.
  - Do not hide Ordo public route discovery during normal browsing.
- `../testing/app/globals.css`
  - Useful idea: explicit footer-safe tokens and short-viewport compaction.
  - Do not import the deck palette, slide system, or framer-motion assumptions.

## Implementation Shape

Build a small reusable public route chrome layer, not route-specific links in
three components.

Recommended components:

- `PublicRouteLinks`
  - Pure client component.
  - Inputs: `user`, `navigationContext`, `variant`.
  - Uses `resolvePrimaryNavRoutes()` for desktop/header and footer-like link
    clusters.
  - Renders only public routes; no login/register, no admin/workspace items.
  - Marks the active route with `aria-current="page"` using
    `isShellRouteActive()`.
- `PublicMobileRouteDock`
  - Client component mounted from `AppShell` or `SiteNav`.
  - Anonymous/public only for this phase.
  - Uses `resolveRailMenuRoutes(user, navigationContext)`.
  - Renders Chat/Home, Offers, About, and conditional Feed.
  - Uses short labels and stable widths so 360px mobile does not overflow.
  - Must reserve safe-area bottom space and must not overlap the embedded home
    composer or floating chat launcher.

Recommended placement:

- Desktop header:
  - Add `PublicRouteLinks` to `SiteNav` between brand and account access.
  - Expose `data-shell-nav-region="primary-links"` again, but with the 01c1
    route-state model.
  - Keep Login/Register secondary in `account-access`.
- Mobile:
  - Keep top chrome simple: menu trigger, brand/home, access action.
  - Add a bottom public route dock only for anonymous/public users, or use a
    compact footer gate if the implementation proves dock/composer conflict.
  - On `/`, the dock must clear the embedded composer row.
  - On document-flow public routes, the dock must not collide with the floating
    chat launcher.
- Footer:
  - Keep `SiteFooter` state-driven.
  - Update styling/structure only as needed to match the public route set and
    mobile safe-area rules.

Safe-area contract:

- Add explicit CSS custom properties for public mobile nav size and clearance,
  for example:
  - `--public-mobile-nav-block-size`
  - `--public-mobile-nav-offset-block`
  - `--public-mobile-nav-clearance-block`
- Use existing `--safe-area-inset-bottom` and `--fab-offset-block`.
- Document-flow public pages need enough bottom padding for both the mobile
  route dock and the floating chat launcher.
- Homepage viewport stage needs enough bottom room for the embedded composer
  and dock without shrinking the message viewport into unusability.

Accessibility contract:

- Desktop public links live inside the primary navigation landmark.
- Mobile public route dock has a distinct label such as
  `aria-label="Public navigation"`.
- Active route uses `aria-current="page"`.
- Login/Register remain reachable but are not mixed into the route dock.
- Touch targets must remain at least 44px high.

## Current Code To Re-Check Before Editing

- `src/components/SiteNav.tsx`
- `src/components/SiteFooter.tsx`
- `src/components/AppShell.tsx`
- `src/frameworks/ui/ChatSurface.tsx`
- `src/frameworks/ui/ChatContentSurface.tsx`
- `src/frameworks/ui/ChatInput.tsx`
- `src/app/styles/foundation.css`
- `src/app/styles/shell.css`
- `src/app/styles/utilities.css`
- `src/lib/shell/shell-navigation.ts`
- `src/lib/shell/ShellNavigationContextProvider.tsx`
- `tests/shell-acceptance.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `src/components/SiteNav.test.tsx`
- `tests/homepage-shell-layout.test.tsx`
- `tests/browser-ui/mobile-home-library-density.spec.ts`
- `tests/browser-ui/mobile-public-reading.spec.ts`

Reference:

- `../testing/components/site-footer.tsx`
- `../testing/components/motion/PresentationFooterGate.tsx`
- `../testing/app/globals.css`

## Required Work

- Add visible desktop public nav:
  - brand/home,
  - Offers,
  - About,
  - conditional Feed.
- Use `resolvePrimaryNavRoutes(user, navigationContext)`.
- Keep public route links visible for anonymous visitors without opening
  `ShellWorkspaceMenu`.
- Add mobile public navigation:
  - compact top brand/access,
  - bottom or footer gate with Chat, Offers, About, conditional Feed.
- Use `resolveRailMenuRoutes(user, navigationContext)`.
- Keep Login/Register visible but secondary.
- Ensure bottom navigation and floating chat composer never overlap.
- Preserve quiet route tone for feed reading routes.
- Keep public footer useful without Feed.
- Keep public route labels short enough for narrow mobile widths.
- Update stale tests that currently assert `primary-links` is absent.
- Do not build authenticated/admin work rails in this phase.
- Do not add a new route registry, hard-coded feed checks, or async logic in
  render.

## Positive Tests

- Anonymous desktop nav visibly exposes Offers and About.
- Anonymous desktop nav visibly exposes Feed only when content exists.
- Anonymous mobile nav exposes the same route set.
- Footer exposes the same public route set.
- Login/Register remain reachable.
- Active public route is marked with `aria-current="page"`.
- Direct `/feed` remains reachable when Feed is hidden from discovery.
- Public route chrome uses the shared 01c1 navigation context.

## Negative Tests

- Public routes are not only discoverable inside `ShellWorkspaceMenu`.
- Anonymous users do not see workspace/admin/profile/jobs links.
- Bottom nav does not cover chat composer or message input.
- Empty-feed state does not show Feed in desktop nav, mobile dock, footer, or
  drawer.
- Login/Register do not appear as route-dock peers with Chat/Offers/About.
- Component tests do not preserve the old assertion that
  `data-shell-nav-region="primary-links"` is always absent.

## Edge Tests

- Narrow mobile viewport.
- Short mobile viewport.
- Empty feed.
- No offers.
- Long instance name.
- Reduced motion.
- 360px width with Login/Register present.
- `/` embedded chat with mobile dock.
- `/offers` and `/about` document-flow pages with floating chat launcher.
- `/feed` quiet-tone route with Feed hidden from discovery but direct route
  loaded.

## Cleanup

- Delete public-nav tests that assert no visible primary links exist.
- Remove drawer-only public discovery language from docs and tests.
- Rename or replace stale `journal` quiet-tone CSS selectors if they affect
  feed surfaces.
- Keep `ShellWorkspaceMenu` as utility drawer only; do not remove it here.
- Leave authenticated and admin route rail cleanup for 01c3 and 01c4.

## Test Plan

Focused tests to update/add:

```bash
npx vitest run src/components/SiteNav.test.tsx tests/shell-acceptance.test.tsx tests/site-shell-composition.test.tsx tests/homepage-shell-layout.test.tsx tests/shell-navigation-model.test.ts
```

Browser/mobile tests to update/add after component behavior passes:

```bash
npx playwright test tests/browser-ui/mobile-home-library-density.spec.ts tests/browser-ui/mobile-public-reading.spec.ts tests/browser-ui/home-shell-header.spec.ts
```

Static checks:

```bash
npm run typecheck
npx eslint src/components/SiteNav.tsx src/components/SiteFooter.tsx src/components/AppShell.tsx src/app/styles/shell.css src/app/styles/foundation.css
```

If CSS-only selectors are changed, add or update source-level tests rather than
relying only on snapshots.

## Exit Criteria

- Public users can understand the site without opening a hidden menu.
- Mobile navigation is safe around the chat composer.
- Footer and public nav use the same stateful route model.
- Anonymous desktop and mobile routes are visible, stateful, and free of
  admin/workspace leakage.
- Focused unit/component tests pass.
- At least one mobile browser test proves no horizontal overflow and no
  composer/dock/FAB overlap.

## Implementation Notes

Implemented:

- Added `src/components/public/PublicRouteLinks.tsx`.
  - `PublicRouteLinks` uses `resolvePrimaryNavRoutes()` and
    `isShellRouteActive()` for visible desktop public links.
  - `PublicMobileRouteDock` uses `resolveRailMenuRoutes()` for anonymous
    mobile route chrome and labels Home as Chat.
  - Both consume the 01c1 `ShellNavigationContext`; no component reimplements
    feed gating.
- Updated `src/components/SiteNav.tsx`.
  - Restored `data-shell-nav-region="primary-links"` as visible desktop public
    discovery.
  - Keeps Login/Register in account access, separate from public route links.
- Updated `src/components/AppShell.tsx`.
  - Mounts the anonymous/public mobile route dock from shell layout.
  - Marks anonymous shell routes with `data-shell-public-mobile-nav="true"`.
  - Preserves document-flow floating-chat clearance for public routes.
- Updated `src/app/layout.tsx`.
  - Propagates the public-mobile-nav state to `<body>` so the floating chat
    sibling can clear the dock.
  - Continues sharing `loadPublicShellNavigationContext()` through the shell
    provider and `AppShell`.
- Updated `src/app/styles/shell.css` and `src/app/styles/chat.css`.
  - Added desktop primary public link layout.
  - Added fixed mobile public route dock with safe-area variables.
  - Adds homepage composer clearance and document-flow bottom padding for the
    dock plus floating chat.
  - Moves the floating chat launcher and floating frame above the public mobile
    dock.
  - Corrected stale quiet route surface selectors from `journal` to `feed`.
- Updated browser fixtures/tests.
  - Exported `ensureInstalledCookie()` so public browser specs explicitly enter
    the installed shell state.
  - Fixed referral browser setup to read `process.env.STUDIO_ORDO_DB_PATH`
    instead of the developer `.data` database.

Deferred by design:

- Authenticated user rail and admin/factory rail remain 01c3/01c4 work.
- Feed remains directly reachable at `/feed`, but discovery stays hidden while
  `hasPublicFeedItems` is false.

## QA Evidence

Focused component/model checks passed:

```bash
npx vitest run src/components/SiteNav.test.tsx src/components/AppShell.test.tsx tests/shell-acceptance.test.tsx tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx tests/shell-visual-system.test.tsx tests/homepage-shell-layout.test.tsx tests/shell-navigation-model.test.ts src/lib/shell/shell-navigation.test.ts
```

Result: 9 files, 71 tests passed.

Static checks passed:

```bash
npm run typecheck
npx eslint src/components/public/PublicRouteLinks.tsx src/components/SiteNav.tsx src/components/AppShell.tsx src/app/layout.tsx src/components/SiteNav.test.tsx src/components/AppShell.test.tsx tests/shell-acceptance.test.tsx tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx tests/shell-visual-system.test.tsx tests/browser-ui/helpers/public-form.ts tests/browser-ui/home-shell-header.spec.ts tests/browser-ui/mobile-home-library-density.spec.ts tests/browser-ui/mobile-public-reading.spec.ts
npx stylelint src/app/styles/shell.css src/app/styles/chat.css
```

Browser/mobile checks passed:

```bash
npx playwright test tests/browser-ui/home-shell-header.spec.ts tests/browser-ui/mobile-home-library-density.spec.ts tests/browser-ui/mobile-public-reading.spec.ts
```

Result: 20 tests passed.

Known unrelated build warnings during Playwright web server build:

- Turbopack broad file-pattern warnings in `src/lib/user-files.ts` and
  `src/lib/appliance/native/native-binary-registry.ts`.
- Turbopack NFT tracing warning via `next.config.ts`.
