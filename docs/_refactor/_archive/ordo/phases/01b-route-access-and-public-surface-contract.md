# Phase 01b: Route, Access, And Public Surface Contract

Status: Complete

Parent phase:

- `01-public-site-shell-and-navigation.md`

Depends on:

- `01a-public-shell-chat-and-ui-audit.md`

Grounding evidence:

- `../evidence/phase-01a-public-shell-chat-ui-audit.md`

## Goal

Implement the public route truth before visual polish:

- `/`
- `/feed`
- `/offers`
- `/about`

Remove public `/library`, `/journal`, and `/blog` as product surfaces. Internal
corpus, blog, and journal donor code may remain only where later phases still
need it, but anonymous public routes, SEO, commands, and recovery links must not
promote those names.

## Product Rule

Route and access truth comes before aesthetics.

The public site is the intentional business presence. The corpus is internal
working context. The feed is optional public output.

Greenfield rule:

- Do not preserve public `/library`, `/journal`, or `/blog` compatibility.
- Do not redirect stale public routes to `/feed`.
- Stale public routes should fail visibly during implementation so tests catch
  old assumptions.
- Keep donor code only when a later phase still needs it and only when it is
  not anonymous public shell truth.

## Blast Radius

Routes, shell route registry, command registry, sitemap, robots, not-found, and
tests for public route exposure.

Do not redesign homepage composition or motion in this phase.

## Current Code To Research

01a confirmed the current leakage paths. Start with these owners before making
edits:

- `src/app/page.tsx`
- `src/app/about/page.tsx`
- `src/app/library/**`
- `src/app/journal/**`
- `src/app/blog/**`
- `src/app/not-found.tsx`
- `src/app/sitemap.ts`
- `src/app/robots.ts`
- `src/lib/shell/shell-navigation.ts`
- `src/lib/shell/shell-commands.ts`
- `src/lib/access/content-access.ts`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `src/frameworks/ui/RichContentRenderer.tsx`
- `src/lib/config/defaults.ts`
- `src/components/AccountMenu.tsx`
- `src/components/ShellWorkspaceMenu.tsx`
- `src/components/ShellNavDrawer.tsx`
- `src/components/SiteFooter.tsx`
- `tests/shell-acceptance.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `tests/shell-command-parity.test.ts`
- `tests/shell-navigation-model.test.ts`
- `tests/public-content-routes.test.ts`
- `tests/seo-infrastructure.test.ts`
- `src/frameworks/ui/useChatSurfaceState.test.tsx`
- `src/frameworks/ui/RichContentRenderer.test.tsx`
- `tests/homepage-shell-layout.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`
- `tests/homepage-shell-evals.test.tsx`

## 01a Findings To Carry Forward

Current route truth:

- `/` already renders as an embedded chat-first homepage through
  `src/app/page.tsx` and `ChatSurface mode="embedded"`.
- `/about` exists but is not registered as a public shell route.
- `/feed` and `/offers` do not exist.
- `/library`, `/journal`, and `/blog` exist as public routes.

Current public leakage:

- `SHELL_ROUTES` defines `corpus` as `/library` and `journal` as `/journal`.
- `PRIMARY_NAV_ROUTE_IDS`, `RAIL_MENU_ROUTE_IDS`, footer information groups,
  and drawer explore groups all point at `corpus` and `journal`.
- `resolveShellNavigationCommandDefinitions()` projects command definitions
  from the shell route registry, so stale route truth becomes command truth.
- `src/app/not-found.tsx` links to `/library`.
- `src/app/sitemap.ts` promotes `/library`, library chapter URLs, `/journal`,
  and published journal/blog post URLs.
- `src/app/robots.ts` explicitly allows `/library`.
- `src/app/about/page.tsx` links to `/library` and says "publish to your
  journal."
- `useChatSurfaceState` routes corpus actions and rich-content links to
  `/library/section/...`.
- `RichContentRenderer` has a `library-link` inline node.
- `AccountMenu` describes anonymous users as sales-agent mode and signed-in
  users as having full library access.

Phase 01b does not need to solve homepage composition, feed publishing,
offers modeling, or motion. It does need to make the public route and access
contract true everywhere anonymous users can discover routes.

## Target Public Route Contract

Anonymous public routes for this phase:

- `/`
- `/feed`
- `/offers`
- `/about`

Public shell labels:

- `Home`
- `Feed`
- `Offers`
- `About`

Non-public product concepts after this phase:

- `Library`
- `Journal`
- `Blog`
- `Corpus`
- `Admin`
- `Workspace`
- `Jobs`
- `Operations`
- `Profile`

Allowed internal references after this phase:

- Donor implementation references inside clearly internal code that is not
  reachable through anonymous shell, command, SEO, robots, not-found, homepage
  CTA, or public rich-content paths.
- Tests that intentionally document donor code as internal, if such tests are
  added in the same change.

Disallowed public references after this phase:

- Anonymous nav/footer/drawer links to `/library`, `/journal`, or `/blog`.
- Anonymous command or slash mention definitions for `nav-corpus` or
  `nav-journal`.
- Public sitemap or robots promotion of `/library`, `/journal`, or `/blog`.
- Not-found recovery links to `/library`.
- Public about/homepage CTA copy that invites visitors to the library or
  journal.

## Required Work

Work in this order.

1. Route files and empty states

   - Add `/feed` page with stable public page chrome and an honest empty state.
   - Add `/offers` page with stable public page chrome and an honest empty
     state, or use current `services.offerings` if the implementation is
     already clean and covered.
   - Keep `/` as the chat-first homepage.
   - Keep `/about` but remove library/journal CTAs and stale copy.

2. Shell route registry

   - Add shell route definitions for `feed`, `offers`, and `about`.
   - Keep `home` at `/`.
   - Remove `corpus` and `journal` from anonymous public route sets.
   - Replace footer and drawer public groups with `home`, `feed`, `offers`,
     and `about` as appropriate for this phase.
   - Keep signed-in/admin/workspace routes role-gated and absent from
     anonymous route discovery.

3. Command projection

   - Update command expectations through `src/lib/shell/shell-navigation.ts`,
     not by special-casing `src/lib/shell/shell-commands.ts`.
   - Public command definitions should project the new public route set.
   - `nav-corpus` and `nav-journal` must disappear for anonymous/public command
     surfaces.

4. SEO, robots, and recovery routes

   - Remove `/library`, library chapters, `/journal`, and published
     journal/blog URLs from public sitemap promotion.
   - Add `/feed`, `/offers`, and `/about` to sitemap behavior where
     appropriate.
   - Update robots allow/disallow policy to match the new public route set.
   - Remove `/library` from not-found recovery actions.

5. Stale public route behavior

   - Delete public `/library`, `/journal`, and `/blog` route files if the
     implementation can do so cleanly.
   - Otherwise make them intentionally non-public with `notFound()` or an
     authenticated/internal replacement.
   - Do not redirect old public routes to `/feed`.
   - If donor code remains, document why in the implementation notes.

6. Public leakage from chat/rendering

   - Remove anonymous-public dependence on `corpus` action routes that push
     `/library/section/...`.
   - Remove or gate public `library-link` behavior so anonymous public chat
     messages cannot route to `/library`.
   - Keep operation cards, job cards, graphs, audio, and rich message rendering
     intact.
   - Do not redesign the first assistant message in this phase beyond removing
     direct public route leakage if tests require it; Phase 01d owns the full
     conversational homepage copy.

7. Stale copy cleanup

   - Update `/about` public CTAs away from `Explore the library`.
   - Remove public role descriptions that say anonymous is sales-agent mode or
     signed-in users have full library access where they are part of public
     shell/account surfaces.

## Positive Tests

- `/`, `/feed`, `/offers`, and `/about` are reachable anonymously.
- Empty `/feed` renders stable page chrome.
- Empty `/offers` renders stable page chrome.
- Sitemap includes only the target public shell routes for this phase.
- Public command definitions include public route set only.
- Public shell route registry resolves anonymous public routes to the target
  route IDs.
- Public not-found recovery returns users to safe public destinations.
- `/about` has public CTAs that point to home/chat, feed, offers, account
  creation, or another approved public route.

## Negative Tests

- Anonymous public shell does not expose `/library`, `/journal`, or `/blog`.
- Public not-found page does not link to `/library`.
- Public commands do not include `nav-corpus` or `nav-journal`.
- Public sitemap does not include library chapters or journal/blog posts.
- Robots does not explicitly allow `/library`, `/journal`, or `/blog`.
- Anonymous drawer/footer route groups do not include `corpus` or `journal`.
- Public rich-content or action-link tests do not preserve anonymous routing to
  `/library`.
- Public route tests do not assert unauthenticated library access.

## Edge Tests

- Missing identity config uses default labels.
- No offers configured.
- No feed items.
- Stale `/library` request fails visibly.
- Stale `/journal` or `/blog` request fails visibly or follows an explicit
  non-public route decision.
- Signed-in users still retain role-gated access to workspace/admin routes.
- Internal donor-code references remain invisible to anonymous route discovery.

## Cleanup

- Delete public route files only if no later donor-code dependency requires
  their page modules.
- If donor page code remains temporarily, document exactly why and ensure it is
  not public shell truth.
- Rename or replace tests that describe the old product shape instead of
  preserving compatibility assertions.
- Keep cleanup scoped. Broader feed publishing, offers modeling, homepage
  composition, and motion work belong to later 01x phases.

## Test Files To Update Or Replace

Primary 01b tests:

- `tests/shell-navigation-model.test.ts`
- `tests/shell-command-parity.test.ts`
- `tests/public-content-routes.test.ts`
- `tests/seo-infrastructure.test.ts`

Likely affected supporting tests:

- `tests/shell-acceptance.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `src/components/SiteNav.test.tsx`
- `src/frameworks/ui/useChatSurfaceState.test.tsx`
- `src/frameworks/ui/RichContentRenderer.test.tsx`
- `tests/homepage-shell-layout.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`
- `tests/homepage-shell-evals.test.tsx`

Do not blindly preserve old assertions. If a test exists only to prove public
library/journal exposure, replace it with the new public route contract.

## Verification Commands

At minimum, run:

```bash
npm test -- tests/shell-navigation-model.test.ts tests/shell-command-parity.test.ts tests/public-content-routes.test.ts tests/seo-infrastructure.test.ts
```

Then run any supporting tests touched by the implementation.

Run stale-reference scans and document allowed internal exceptions:

```bash
rg -n "/library|/journal|/blog|nav-corpus|nav-journal|Open library|Show me the library|Search my library|sales agent mode|full library access" src tests
```

## Exit Criteria

- Public route contract is implemented and tested.
- `/library`, `/journal`, and `/blog` are not public product surfaces.
- No homepage or motion work is required for this phase to pass.
- Any retained donor-code references are documented as internal/non-public.
- 01b implementation notes identify what remains for 01c, 01d, 01e, and 01f.

## Implementation Notes

Completed on 2026-05-04.

Implemented public route truth:

- Added `/feed` with stable public chrome and an honest empty state.
- Added `/offers` with stable public chrome and `services.offerings` rendering.
- Kept `/` as the chat-first homepage.
- Kept `/about`, removed public library/journal CTAs, and pointed the secondary
  CTA at `/offers`.
- Replaced public `/library/**`, `/journal/**`, and `/blog/**` route modules
  with visible `notFound()` guards instead of redirects.

Updated route discovery:

- `src/lib/shell/shell-navigation.ts` now exposes `home`, `feed`, `offers`,
  and `about` as the anonymous public route set.
- Command projection follows the shell registry, so public commands are now
  `nav-home`, `nav-feed`, `nav-offers`, and `nav-about`.
- Footer, drawer, rail menu, sitemap, robots, referral landing, not-found, and
  route-tone tests now reflect the public contract.

Updated chat leakage behavior:

- Retired public routes sent through rich route actions are intercepted in
  `useChatSurfaceState` and turned into composer guidance instead of navigation.
- Legacy `corpus` actions no longer push `/library/section/...`.
- Rich-content renderer tests now use `/feed` for public route examples.

Retained donor-code exceptions:

- Admin journal routes under `/admin/journal/**` remain internal/admin tooling.
- Blog/media asset APIs and storage names remain because media generation and
  backup/restore phases still use those internal entities.
- Knowledge access, discovery search, library metadata, and journal components
  remain as donor/internal implementation code for later feed/corpus migration.
- The stale-reference scan still reports those internal donors and older broad
  tests. They are not anonymous shell, command, SEO, robots, not-found, or
  public route truth after this phase.

Verification run:

```bash
npm test -- tests/shell-navigation-model.test.ts tests/shell-command-parity.test.ts tests/public-content-routes.test.ts tests/seo-infrastructure.test.ts
npm test -- tests/shell-acceptance.test.tsx tests/site-shell-composition.test.tsx src/components/SiteNav.test.tsx src/components/AppShell.test.tsx src/frameworks/ui/ChatSurface.test.tsx src/frameworks/ui/useChatSurfaceState.test.tsx src/frameworks/ui/RichContentRenderer.test.tsx tests/homepage-shell-layout.test.tsx tests/homepage-shell-ownership.test.tsx tests/homepage-shell-evals.test.tsx tests/chat/chat-surface.test.tsx src/app/sitemap.test.ts src/app/journal/page.test.tsx 'src/app/journal/[slug]/page.test.tsx' 'src/app/library/section/[slug]/page.test.ts'
npm test -- tests/blog-hero-rendering.test.tsx
npm run typecheck
```

## QA Follow-up

QA completed on 2026-05-04 after the initial implementation.

Finding fixed:

- Legacy rich-content route payloads can arrive as `params.path` or
  `params.href`, not only as direct `value`. `useChatSurfaceState` now resolves
  all three forms through the same retired-public-route guard, so old
  `/library`, `/journal`, and `/blog` payloads cannot bypass the guard.

Test coverage strengthened:

- `tests/public-content-routes.test.ts` now renders `/feed` and `/offers`
  directly, including:
  - feed empty-state actions;
  - offers empty state;
  - configured offer rendering from `services.offerings`.
- `src/frameworks/ui/useChatSurfaceState.test.tsx` now covers valid legacy
  `params.path` route dispatch and blocked retired `params.path` dispatch.

QA verification run:

```bash
npm test -- tests/public-content-routes.test.ts src/frameworks/ui/useChatSurfaceState.test.tsx
npm test -- tests/shell-navigation-model.test.ts tests/shell-command-parity.test.ts tests/public-content-routes.test.ts tests/seo-infrastructure.test.ts
npm test -- tests/shell-acceptance.test.tsx tests/site-shell-composition.test.tsx src/components/SiteNav.test.tsx src/components/AppShell.test.tsx src/frameworks/ui/ChatSurface.test.tsx src/frameworks/ui/useChatSurfaceState.test.tsx src/frameworks/ui/RichContentRenderer.test.tsx tests/homepage-shell-layout.test.tsx tests/homepage-shell-ownership.test.tsx tests/homepage-shell-evals.test.tsx tests/chat/chat-surface.test.tsx src/app/sitemap.test.ts src/app/journal/page.test.tsx 'src/app/journal/[slug]/page.test.tsx' 'src/app/library/section/[slug]/page.test.ts' tests/blog-hero-rendering.test.tsx
npm run typecheck
npx eslint src/app/feed/page.tsx src/app/offers/page.tsx src/app/about/page.tsx src/app/not-found.tsx src/app/sitemap.ts src/app/robots.ts 'src/app/r/[code]/page.tsx' src/lib/shell/shell-navigation.ts src/frameworks/ui/useChatSurfaceState.tsx src/frameworks/ui/ChatSurface.tsx src/components/AppShell.tsx src/components/SiteNav.tsx src/lib/config/defaults.ts src/components/AccountMenu.tsx tests/public-content-routes.test.ts src/frameworks/ui/useChatSurfaceState.test.tsx
npm run build
```

Build result:

- Production build passed.
- Build emitted pre-existing broad-file-tracing warnings from
  `src/lib/user-files.ts`, `src/lib/appliance/native/native-binary-registry.ts`,
  and `next.config.ts`. These are not caused by the 01b route contract, but
  should be considered during later appliance/runtime hardening.

Stale-reference scan result:

- Full stale scan still reports 686 retained donor/test references across
  internal journal, blog, media, corpus, knowledge-access, and legacy eval code.
- Public discovery surface scan is limited to intentional matches:
  - robots disallows for stale public routes;
  - `/admin/journal` as an admin-only route;
  - `useChatSurfaceState` retired-route guards.

Remaining for later 01x phases:

- 01c should decide how public feed publishing consumes the retained journal/blog
  donor code and rename or retire stale internals when the feed model lands.
- 01d owns homepage first-message composition, public CTA wording, and the
  conversation-first hero.
- 01e owns motion, scrollytelling, responsive polish, and visual QA.
- 01f owns the broad stale-test cleanup and final public-shell regression pass.
