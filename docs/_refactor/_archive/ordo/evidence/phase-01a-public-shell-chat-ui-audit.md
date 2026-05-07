# Phase 01a Evidence: Public Shell, Chat, And UI Audit

Status: Complete

Executed: 2026-05-04

Phase:

- `../phases/01a-public-shell-chat-and-ui-audit.md`

## Scope

This evidence records the current public homepage, chat, navigation, route,
SEO, command, and motion-reference shape. Phase 01a is diagnosis only. No
application code was changed.

## Executive Finding

The current Ordo public shell is already conversation-first on `/`, but its
route truth still reflects the old public Library and Journal model. The
homepage is an embedded chat surface, while navigation, footer, command
mentions, not-found recovery, sitemap, robots, about-page copy, rich-content
links, and tests still expose `/library`, `/journal`, and older blog/journal
language.

The right implementation order for Phase 01b-01f is therefore:

1. Replace public route truth first.
2. Make public navigation visible on desktop and mobile.
3. Update the chat-first homepage copy and actions.
4. Adapt motion and footer ideas from `../testing`.
5. Run stale-reference cleanup and closeout scans.

## Homepage Render Path

Current path:

- `src/app/page.tsx`
- `src/components/AppShell.tsx`
- `src/frameworks/ui/ChatSurface.tsx`
- `src/frameworks/ui/ChatContentSurface.tsx`
- `src/frameworks/ui/ChatMessageViewport.tsx`

Observed behavior:

- `src/app/page.tsx` calls `getSessionUser()` but does not currently use the
  returned value.
- The homepage resolves the shell home href through `resolveShellHomeHref()`.
  If it is not `/`, the page redirects. Today `SHELL_BRAND.homeHref` is `/`.
- The homepage renders `<ChatSurface mode="embedded" />`.
- `AppShell` treats `/` as `data-shell-route-mode="viewport-stage"` and places
  the footer outside the fixed-height homepage stage.
- `ChatSurface` suppresses floating chat on `/`, so the homepage has one chat
  surface, not both embedded and floating.
- Embedded chat emits `data-chat-container-mode="embedded"` and
  `data-chat-layout="message-composer"`.

Important existing tests:

- `tests/homepage-shell-layout.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`
- `tests/homepage-shell-evals.test.tsx`
- `tests/chat/chat-surface.test.tsx`
- `src/frameworks/ui/ChatMessageViewport.test.tsx`

Implementation impact:

- Phase 01d should keep `/` chat-first.
- Phase 01c and 01e must not place footer or mobile route chrome over the
  composer row.
- Phase 01f should keep the homepage ownership tests but update stale copy.

## First Message And Suggestion Path

Current path:

- `src/hooks/useGlobalChat.tsx`
- `src/hooks/chat/chatState.ts`
- `src/hooks/chat/useBootstrapMessages.ts`
- `src/lib/config/defaults.ts`
- `src/core/entities/MessageFactory`

Observed behavior:

- `ChatProvider` initializes messages by calling
  `createInitialChatMessages(initialRole, prompts)`.
- Anonymous users get `DEFAULT_PROMPTS.firstMessage.default` and
  `DEFAULT_PROMPTS.defaultSuggestions`.
- Referral visitors can get `firstMessage.withReferral` plus
  `referralSuggestions`.
- Signed-in roles can get role-specific bootstraps through
  `roleBootstraps`.
- `useBootstrapMessages` can replace bootstrap messages after prompt or role
  conditions change.

Current public copy problems:

- `DEFAULT_PROMPTS.defaultSuggestions` includes `Search my materials` and
  `Draft a publishable page`.
- `DEFAULT_PROMPTS.referralSuggestions` includes `Show me the library`.
- Homepage tests still fixture copy such as `Search my library`.

Important tests:

- `tests/first-message-flow.test.tsx`
- `tests/homepage-shell-layout.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`
- `tests/homepage-shell-evals.test.tsx`

Implementation impact:

- Phase 01d should update public first-message defaults and suggestions.
- Suggestions must route to public-safe actions: ask what Ordo does, view
  offers, ask a business question, view about/process, and optionally explore
  feed output.
- Public suggestions must not send anonymous visitors to `/library`,
  `/journal`, or `/blog`.

## Chat Message Composition Path

Current path:

- `src/hooks/usePresentedChatMessages.ts`
- `src/adapters/ChatPresenter.ts`
- `src/adapters/MarkdownParserService.ts`
- `src/adapters/CommandParserService.ts`
- `src/frameworks/ui/MessageList.tsx`
- `src/frameworks/ui/RichContentRenderer.tsx`

Observed behavior:

- `usePresentedChatMessages` creates a `ChatPresenter` using markdown and
  command parsers.
- Dynamic suggestions come from the last assistant message only when its
  response state is open.
- `scrollDependency` changes when presented messages or dynamic suggestions
  change.
- `ChatMessageViewport` owns scroll pinning and the "Scroll to bottom" control.
- Embedded hero state centers the transcript stack; conversation state anchors
  it toward the bottom.
- Rich content can render diagrams, graphs, audio, operation cards, job status
  cards, tables, action links, and `library-link`.

Current public route leakage in chat:

- `ACTION_HANDLERS.corpus` routes to `/library/section/${value}`.
- `handleLinkClick(slug)` routes to `/library/section/${slug}`.
- `RichContentRenderer` has a `library-link` inline node.
- Rich-content tests assert `/library` and `/journal` action behavior.

Important tests:

- `src/frameworks/ui/useChatSurfaceState.test.tsx`
- `src/frameworks/ui/RichContentRenderer.test.tsx`
- `src/frameworks/ui/chat/ToolPluginPartRenderer.test.tsx`
- `tests/chat/chat-surface.test.tsx`

Implementation impact:

- Phase 01b should remove anonymous-public dependence on corpus/library action
  routes.
- Phase 01d can preserve the rich message system and custom operation/action
  cards; only the public route targets and labels need correction.
- Phase 01f should scan rich-content fixtures for stale public route language.

## Public Navigation, Footer, Drawer, And Command Path

Current path:

- `src/lib/shell/shell-navigation.ts`
- `src/lib/shell/shell-commands.ts`
- `src/components/SiteNav.tsx`
- `src/components/ShellWorkspaceMenu.tsx`
- `src/components/ShellNavDrawer.tsx`
- `src/components/SiteFooter.tsx`
- `src/components/AccountMenu.tsx`

Observed route model:

- `SHELL_ROUTES` defines public `home`, `corpus` (`/library`), and `journal`
  (`/journal`).
- `PRIMARY_NAV_ROUTE_IDS` is `["corpus", "journal"]`.
- `RAIL_MENU_ROUTE_IDS` is `["corpus", "journal"]`.
- `SHELL_FOOTER_GROUPS.information.routeIds` is `["corpus", "journal"]`.
- `SHELL_NAV_DRAWER_GROUPS.explore.routeIds` is `["corpus", "journal"]`.
- `resolveShellNavigationCommandDefinitions()` projects command routes from the
  same route registry, so commands inherit stale public route truth.
- `SiteFooter` resolves footer groups from the same model.
- `SiteNav` does not show public route links directly; it shows brand,
  workspace/drawer utility, and login/register or notification/job utilities.
- `SiteNav` only applies quiet tone for `/journal` and `/journal/*`.
- `ChatSurface` applies quiet tone for `/journal`, `/journal/*`, `/blog`, and
  `/blog/*`.
- `ShellWorkspaceMenu` and `ShellNavDrawer` both expose the drawer groups.
- `AccountMenu` still describes anonymous users as `sales agent mode` and
  authenticated users as having `full library access`.

Important tests:

- `tests/shell-navigation-model.test.ts`
- `tests/shell-command-parity.test.ts`
- `tests/shell-acceptance.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `src/components/SiteNav.test.tsx`

Implementation impact:

- Phase 01b should introduce public route IDs for `feed`, `offers`, and
  `about`, then remove public `corpus` and `journal` route exposure.
- Phase 01c should make the public route set visible without relying on a
  hidden left drawer.
- Phase 01c should keep account/start actions visible but secondary to public
  route clarity.
- Phase 01f should remove stale tests expecting `nav-corpus`, `nav-journal`,
  Library, Journal, sales-agent mode, and full-library-access copy.

## Public Route And SEO Leakage

Current route files:

- Existing: `/`, `/about`, `/blog`, `/journal`, `/library`
- Missing: `/feed`, `/offers`

Current leakage:

- `src/app/not-found.tsx` links to `/library` as the secondary recovery action.
- `src/app/sitemap.ts` imports `getCorpusSummaries`, adds `/library`, adds
  library chapter URLs, adds `/journal`, and adds published journal/blog post
  URLs.
- `src/app/robots.ts` allows `/library` and `/library/`.
- `src/app/about/page.tsx` says "publish to your journal", links to
  `/library`, and labels the CTA `Explore the library`.
- `src/app/library/**` is public and tests assert no auth guard.
- `tests/public-content-routes.test.ts` validates public library metadata and
  unauthenticated library pages.
- `tests/seo-infrastructure.test.ts` validates sitemap and robots support for
  `/library`.

Implementation impact:

- Phase 01b should make `/`, `/feed`, `/offers`, and `/about` the public route
  contract.
- Phase 01b should make stale `/library`, `/journal`, and `/blog` public
  requests intentionally fail or become non-public. Because this project is
  greenfield, compatibility redirects are not required.
- Phase 01b should update sitemap and robots to stop promoting old public
  surfaces.

## Current Public Empty-State Capabilities

Current support:

- `src/lib/config/defaults.ts` defines `DEFAULT_SERVICES.offerings: []` and
  `bookingEnabled: false`.
- `tests/config-loader.test.ts` covers empty services offerings.
- `/about` exists and can be rewritten without new infrastructure.
- The homepage can render with only the chat bootstrap.

Current gaps:

- No `/feed` page exists.
- No `/offers` page exists.
- Feed cannot be treated as required for a solopreneur launch.
- Offers should be able to render an honest empty state or configured
  service offerings.

Implementation impact:

- Phase 01b should add honest empty-state routes.
- Phase 01d should make the homepage feel complete with zero feed posts and no
  configured offers.

## Mobile Behavior And Current Tests

Current behavior:

- `AppShell` makes `/` a viewport stage, with the footer outside the stage.
- `ChatContentSurface` emits the embedded composer row with
  `data-chat-composer-row="true"`.
- `ChatMessageViewport` positions the scroll CTA with safe-area bottom spacing.
- `ShellWorkspaceMenu` and `ShellNavDrawer` use left-side modal panels.
- Public route discovery currently lives primarily in drawer/footer models, not
  in visible public navigation.
- Existing safe-area tokens live in `src/app/styles/foundation.css` and
  utility classes live in `src/app/styles/utilities.css`.

Important tests:

- `tests/homepage-shell-layout.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`
- `tests/browser-fab-mobile-density.test.tsx`
- `tests/browser-support.test.ts`
- `tests/browser-motion.test.tsx`

Implementation impact:

- Phase 01c needs explicit mobile public route visibility tests.
- Phase 01e needs non-overlap tests for bottom/footer navigation and composer.
- Hidden left menu must not be the primary public route discovery path.

## `../testing` Motion And Footer Patterns

Files inspected:

- `../testing/components/layouts/PresentationLayout.tsx`
- `../testing/components/motion/PresentationSlide.tsx`
- `../testing/components/motion/PresentationFooterGate.tsx`
- `../testing/components/motion/PresentationProgress.tsx`
- `../testing/components/motion/PresentationShortcuts.tsx`
- `../testing/components/motion/presentation-nav.ts`
- `../testing/components/site-footer.tsx`
- `../testing/app/globals.css`
- `../testing/tests/browser/presentation.spec.ts`

Reference facts:

- `PresentationSlide` uses tall sections (`170vh` or `200vh`) with an inner
  sticky `100vh` stage.
- Slide progress is driven by `framer-motion` `useScroll`.
- The first slide bypasses slide-context progress to avoid an initial bad
  scroll state.
- `PresentationFooterGate` toggles body classes for first, middle, and last
  slide states.
- The presentation footer is compact and treated as route/handout chrome.
- `PresentationProgress` provides a right-side slide counter and jump control.
- `PresentationShortcuts` handles keyboard navigation but ignores typing
  targets such as inputs and textareas.
- `../testing` depends on `framer-motion`; Ordo currently does not.

Adopt:

- Sticky section idea for a controlled public first impression.
- Footer/bottom route chrome as a first-class orientation surface.
- Safe-area footer padding and short-viewport handling.
- Browser tests that prove sticky structure and footer visibility.

Adapt:

- Footer gate/compaction, but do not hide public route discovery during normal
  browsing.
- Progress rail only if the homepage has enough sections to need orientation.
- Keyboard shortcuts only if they cannot conflict with chat composer typing.
- Reveal animation should use CSS or existing Ordo primitives unless a new
  dependency is justified by more than decoration.

Reject for Phase 01:

- Full slide-deck engine.
- Decorative parallax or blur that hurts text and chat clarity.
- Adding `framer-motion` only to copy the reference site.
- Hiding the footer in a way that makes public routes hard to discover.

Implementation impact:

- Phase 01e should borrow the mental model, not the full architecture.
- Phase 01e should include reduced-motion and mobile/short-viewport proof.

## Phase 01b-01f Test Update Matrix

Phase 01b should update or replace:

- `tests/shell-navigation-model.test.ts`
- `tests/shell-command-parity.test.ts`
- `tests/public-content-routes.test.ts`
- `tests/seo-infrastructure.test.ts`
- `src/app/not-found.tsx` related assertions if covered elsewhere

Phase 01c should update or replace:

- `tests/shell-acceptance.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `src/components/SiteNav.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`

Phase 01d should update or replace:

- `tests/first-message-flow.test.tsx`
- `tests/homepage-shell-layout.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`
- `tests/homepage-shell-evals.test.tsx`
- `src/frameworks/ui/useChatSurfaceState.test.tsx`
- `src/frameworks/ui/RichContentRenderer.test.tsx`

Phase 01e should add or update:

- Browser/mobile public shell tests for desktop, mobile, short viewport, and
  reduced-motion behavior.
- Existing safe-area and motion tests if the public shell adds bottom route
  chrome.

Phase 01f should run stale-reference scans for:

- `/library`
- `/journal`
- `/blog`
- `Search my library`
- `Open library`
- `Show me the library`
- `nav-corpus`
- `nav-journal`
- `sales agent mode`
- `full library access`

Allowed exceptions after Phase 01f should be explicitly documented internal
donor-code references only.

## Product Guidance Confirmed

- The homepage should remain chat-first.
- Public route set should be small: `/`, `/feed`, `/offers`, `/about`.
- Library is internal corpus/context, not a default public destination.
- Feed is optional public output, not a prerequisite for launch.
- Offers and chat are the practical solopreneur entry points.
- Footer or bottom navigation is a good public discovery pattern.
- Hidden left drawer is useful utility chrome, but not the primary public map.
- The public first assistant message should sound like the CEO chief of staff,
  not a salesperson.

## 01a Exit Criteria

- Evidence file exists: yes.
- Evidence names code and test anchors for Phase 01b-01f: yes.
- `../testing` patterns are classified as adopt, adapt, or reject: yes.
- Application code changed: no.
