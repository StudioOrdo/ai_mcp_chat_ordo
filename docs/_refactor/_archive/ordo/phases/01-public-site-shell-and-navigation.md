# Phase 01: Public Site Shell And Navigation

Status: Split Into 01x Series

Related specs:

- `../specs/01-conversational-homepage.md`
- `../specs/02-public-feed-and-content-negotiation.md`
- `../specs/03-offers-and-business-profile.md`
- `../evidence/phase-00-baseline.md`

## Goal

Establish the greenfield public site shape for Ordo:

- `/` is the conversational homepage.
- `/feed` is the canonical public content stream.
- `/offers` is the canonical public offer surface.
- `/about` is the canonical public identity and trust page.

The public site must not expose `Library`, `Journal`, `Blog`, `Corpus`,
`Admin`, `Workspace`, or other internal implementation surfaces as primary
product concepts.

## 01x Implementation Series

Do not implement this parent phase as one broad change. Phase 01 is the first
product impression and must be implemented through the focused 01x series:

1. `01a-public-shell-chat-and-ui-audit.md`
   - Audit current chat, message, public shell, footer, route, mobile, and
     `../testing` motion patterns before edits.
2. `01b-route-access-and-public-surface-contract.md`
   - Implement route truth and access boundaries for `/`, `/feed`, `/offers`,
     and `/about`; remove public `/library`, `/journal`, and `/blog`.
3. `01c-public-navigation-footer-and-mobile-system.md`
   - Refactor frontend navigation into public discovery, signed-in work rail,
     admin/factory rail, conditional feed discovery, and mobile/footer
     navigation.
4. `01d-conversational-homepage-composition.md`
   - Make the homepage feel like Ordo: chat-first, offer-aware, content-light,
     and useful even with zero feed posts.
5. `01e-public-motion-scrollytelling-and-responsive-polish.md`
   - Apply the useful scrollytelling ideas from `../testing` with reduced
     motion, mobile safety, and no admin/workspace motion creep.
6. `01f-public-shell-regression-cleanup-and-closeout.md`
   - Remove stale public library/journal/blog leakage and prove the shell with
     deterministic tests.

Product priority for the public site:

1. chat/intake,
2. offers,
3. about/trust,
4. feed as optional public output that appears in discovery only when public
   content exists.

A solopreneur must be able to launch with one offer, one about paragraph, a
useful chat intake path, and zero feed posts without the site feeling empty.

## Product Decision

Ordo does not need a public library.

The public site is what the business intentionally shows the world. The corpus
is what Ordo and authorized users are allowed to use as private working context.
Those are different products and must not share the same anonymous navigation
surface.

Target language:

- Public visitors see `Home`, `Offers`, and `About`.
- Public visitors see `Feed` only when the instance has published public feed
  content.
- Staff/admin users may later see `Corpus`, `Knowledge`, `Assets`, `Content`,
  and `Workflows` behind access control.
- Agents retrieve private context through governed corpus access, not through
  public `/library` URLs.
- Public feed items are deliberate projections of internal assets/content.

## Current Code Grounding

Phase 00 found:

- `/feed` and `/offers` do not exist yet.
- `/library` and `/journal` are the current primary public shell routes.
- `/about` exists but is not registered in shell navigation.
- Homepage already renders `ChatSurface` and is the strongest current match for
  the target product shape.

Phase 01 supersedes the Phase 00 target-direction notes for `/library`,
`/journal`, and `/blog`. Phase 00 recorded the pre-decision baseline. The
greenfield decision for this phase is stricter: public library is removed, and
journal/blog are donor systems for feed, not public compatibility surfaces.

Implementation research must start with:

- `src/app/page.tsx`
- `src/app/about/page.tsx`
- `src/app/not-found.tsx`
- `src/app/library/**`
- `src/app/journal/**`
- `src/app/blog/**`
- `src/components/SiteNav.tsx`
- `src/components/SiteNav.test.tsx`
- `src/components/AppShell.tsx`
- `src/components/AccountMenu.tsx`
- `src/components/ShellWorkspaceMenu.tsx`
- `src/components/ShellNavDrawer.tsx`
- `src/lib/shell/shell-navigation.ts`
- `src/lib/shell/shell-commands.ts`
- `src/lib/config/defaults.ts`
- `src/frameworks/ui/ChatSurface.tsx`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `src/frameworks/ui/RichContentRenderer.tsx`
- `src/app/sitemap.ts`
- `src/app/robots.ts`
- `tests/shell-acceptance.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `tests/shell-command-parity.test.ts`
- `tests/shell-navigation-model.test.ts`
- `tests/homepage-shell-layout.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`
- `tests/homepage-shell-evals.test.tsx`
- `tests/first-message-flow.test.tsx`
- `tests/public-content-routes.test.ts`
- `tests/seo-infrastructure.test.ts`
- `tests/evals/eval-runner.test.ts`

## Public Route Contract

### `/`

The homepage remains chat-first. The default assistant message functions as the
hero and public call-to-action layer.

Public suggestions should be safe, mission-aligned, and role-aware:

- explain Ordo
- explore feed
- view offers
- ask a business question
- create account / sign in

Anonymous suggestions must not route users to public library paths.

### `/feed`

Add the route now, even if the feed is empty.

For this phase, `/feed` only needs a stable public page with an honest empty
state. Full content projection, RSS/JSON negotiation, podcast feeds, and feed
item detail pages belong to the feed phase.

### `/offers`

Add the route now, even if no offers are configured.

For this phase, `/offers` only needs a stable public page with an honest empty
state or current instance/business offer copy if that already exists cleanly.
Full offer modeling and KPI tracking belong to the offers phase.

### `/about`

Register the existing about page in the public shell.

Update copy and CTAs so the page points visitors toward conversation, feed,
offers, or account creation. It must not use `Explore the library` as a public
CTA.

## Internal Corpus / Library Decision

The current public library code is donor code, not the target public product.

Phase 01 should remove `Library` from anonymous product surfaces:

- public navigation
- drawer navigation
- footer navigation
- command discovery
- homepage suggestions
- sitemap promotion
- robots allow-list language
- public rich-message actions
- public not-found recovery actions
- public command/slash mention definitions
- account/menu copy that says public or signed-in users have "library" access

Since this is greenfield, public `/library` does not need compatibility.
Prefer deleting it or making it intentionally non-public with `notFound()` or an
authenticated/internal replacement. Do not redirect `/library` to `/feed`; stale
links should fail loudly during implementation and tests.

Do not build the full internal corpus UI in this phase. The future internal
surface should be designed separately, likely as one or more role-gated routes
such as:

- `/admin/corpus`
- `/workspace/corpus`
- `/workspace/assets`
- `/workspace/content`

Any retained corpus capability must be accessed through role-aware tools,
operation cards, or internal pages, not anonymous public URLs.

## Journal / Blog Decision

`Journal` and `Blog` are current content route names, but they are not the
target public shell.

Phase 01 should remove `Journal` and `Blog` from primary public navigation and
public shell language. The feed phase will decide whether to delete, replace,
or migrate the underlying journal/blog implementation.

If `/journal` or `/blog` remains temporarily reachable because later content
work has not migrated yet, it must not appear in anonymous navigation,
homepage CTAs, footer links, command discovery, sitemap priority, or product
copy after this phase.

## Required Work

- Add shell route definitions for `feed`, `offers`, and `about`.
- Replace public shell groups so anonymous visitors see only the target public
  route set: `Home`, `Offers`, `About`, plus `Feed` when public content exists.
- Remove `Library`, `Journal`, and `Blog` from anonymous nav, drawer, footer,
  and command discovery.
- Keep signed-in/admin/workspace routes role-gated and absent from anonymous
  public navigation.
- Keep `/` chat-first and remove homepage default suggestions that point to
  library/journal concepts.
- Add simple `/feed` and `/offers` pages with stable empty states.
- Update `/about` CTAs away from library.
- Update sitemap and robots behavior so public promotion matches the new route
  contract and does not advertise an empty feed.
- Identify and remove public `/library` leakage in rich content actions,
  homepage mocks, and command handlers where it affects anonymous users.
- Update public not-found recovery links away from `/library`.
- Update account/menu role descriptions away from sales-agent/library language.
- Update route tone behavior so `/feed` receives any public reading tone
  previously hard-coded only for `/journal`.

## Out Of Scope

- Full feed publishing.
- RSS, JSON, or podcast feed negotiation.
- Offer KPI tracking.
- Internal corpus management UI.
- Workflow/template editing.
- Asset model redesign.
- Public content item detail routes beyond what is needed for stable navigation.

## Positive Tests

- Anonymous public shell exposes `Home`, `Offers`, and `About`.
- Anonymous public shell exposes `Feed` only when public feed content exists.
- Anonymous homepage renders the chat-first hero experience.
- `/feed` renders a stable empty state when no public content exists.
- `/offers` renders a stable empty state when no offers exist.
- `/about` renders and its primary CTAs point to allowed public routes or auth.
- Sitemap includes `/`, `/offers`, and `/about`, and includes `/feed` only
  when public feed content exists.
- Robots policy does not advertise deleted public library behavior.
- Public not-found recovery keeps users inside the target public route set.

## Negative Tests

- Anonymous navigation does not expose `Library`, `Journal`, `Blog`, `Corpus`,
  `Admin`, `Workspace`, jobs, operations, referrals, or profile routes.
- Homepage suggestions do not route anonymous users to `/library`.
- Footer and drawer do not expose `/library`, `/journal`, or `/blog`.
- Public rich-message actions do not present `/library` as an anonymous browse
  destination.
- Public `/library` is not promoted through sitemap, robots, shell navigation,
  or command discovery.
- Public 404/not-found pages do not point to `/library`.
- Account/menu role descriptions do not use "sales agent mode" or "full library
  access" as product language.

## Edge Tests

- Empty feed and empty offers still render stable navigation and page chrome.
- Missing instance identity/config still renders default public route labels.
- Logged-in admin/staff users can still reach their role-gated surfaces.
- Referral visitors still receive referral-aware homepage suggestions without
  exposing internal library/corpus routes.
- Stale `/library` links fail visibly in tests instead of silently redirecting
  to feed.
- Existing eval fixtures that recommend `/library` are replaced with feed,
  offers, about, or authenticated internal corpus expectations.

## Cleanup

- Remove old "Library first" default suggestions.
- Remove public shell tests that encode `Library` and `Journal` as the primary
  anonymous route shape.
- Replace public reading/browser tests with feed/about/offers shell tests.
- Replace command parity tests that encode `nav-corpus` and `nav-journal` as
  canonical anonymous navigation commands.
- Replace homepage/eval fixtures that say "Search my library" or recommend
  `/library`.
- Leave donor library/journal/blog implementation cleanup notes for the feed
  and corpus phases if the deletion is larger than this shell phase.

## Exit Criteria

- All 01x subphases are implemented and closed.
- Public route shape is explicit and tested.
- Anonymous site shell is `Home`, `Offers`, and `About`, with `Feed` added to
  discovery only when public feed content exists.
- The homepage remains chat-first and feels like Ordo, not a generic website
  with a chatbot.
- `/feed`, `/offers`, and `/about` are reachable public routes.
- Public `/library` is no longer a promoted product surface.
- No anonymous route, nav, prompt, footer, command, sitemap, or robot policy
  treats library as public.
- No public not-found, account-menu, rich-message, command, or eval fixture
  points anonymous users to `/library`, `/journal`, or `/blog`.
- No full content model or corpus UI changes are required to complete this
  phase.
