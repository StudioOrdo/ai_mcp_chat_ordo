# 02 UI Surface Realignment: Public Surfaces And Homepage Modes

Status: Draft spec

## Goal

Define the public-facing surfaces without leaking owner, admin, library, jobs,
or diagnostic concepts into the public site. The homepage can support modes, but
each mode must remain honest and grounded in durable content or deterministic
placeholder rules.

## Current Code Grounding

Current anchors:

- `src/app/page.tsx`
- `src/frameworks/ui/ChatSurface.tsx`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `src/components/SiteNav.tsx`
- `src/components/public/PublicRouteLinks.tsx`
- `src/lib/shell/shell-navigation.ts`
- `src/app/offers/page.tsx`
- `src/components/offers/OfferSurfaces.tsx`
- `src/lib/offers/load-offers-workspace.ts`
- `src/app/about/page.tsx`
- `src/components/about/AboutSurfaces.tsx`
- `src/lib/about/load-about-workspace.ts`
- `src/app/feed/page.tsx`
- `src/lib/feed/load-public-feed.ts`
- `src/app/blog/page.tsx`
- `src/app/journal/page.tsx`
- `src/app/library/page.tsx`

## Verified Current State

- `/` renders `ChatSurface` for anonymous and signed-in users.
- Signed-in home passes `showConversationSelector=true`.
- `/offers` and `/about` switch between public and owner mode based on session.
- `/feed` is a public content surface when public items exist.
- Public nav is registry-driven and can conditionally include Feed.
- `blog`, `journal`, and `library` base routes exist but are hidden or donor
  routes relative to the current product canon.
- Public offers can fall back to configured services if durable offers are not
  present. That fallback must be labeled as configured/static, not live sales
  intelligence.

## Target Behavior

Public surfaces:

- Home: chat-first public entry and brand promise.
- Offers: public selling surface with prices and public/private distinction.
- About: business story and trust surface.
- Feed: public published content only when content exists.

Homepage modes may be introduced later:

- chat mode: ask Ordo and understand the business;
- offers mode: public packages;
- about mode: story and proof;
- feed mode: public content if available;
- campaign mode: referral/tracked landing context after QR/link entry.

Public surfaces must not show:

- Jobs
- Activity
- Operations
- Library
- Raw corpus
- Admin
- System
- Internal Journal
- Provider/log/diagnostic nouns

## Reuse / Move / Hide / Mock Decisions

- Reuse `ChatSurface` for Home.
- Reuse `PublicOffersSurface` and `PublicAboutSurface`.
- Reuse Feed only when public content exists.
- Hide Blog/Journal/Library from public nav; treat them as donors for Feed and
  Knowledge Base.
- Mock public homepage modes only with static copy that does not claim live
  intelligence.

## Positive Tests

- Anonymous `/` renders chat entry.
- Signed-in `/` renders chat with conversation selector.
- `/offers` renders public offers for anonymous users and owner workspace for
  signed-in users.
- `/about` renders public story for anonymous users and owner workspace for
  signed-in users.
- Feed appears in nav only when public feed data exists.

## Negative Tests

- Public nav does not show Library, Blog, Journal, Jobs, Activity, Operations,
  Admin, System, Referrals, Profile, or Account-only routes.
- Public pages do not render raw diagnostic nouns.
- Public placeholder copy does not claim live metrics, active intelligence, or
  evidence that does not exist.

## Edge Tests

- No public offers: public offers page shows a clear empty/intake state.
- No public content: Feed route can exist but is not in public nav.
- Signed-in user on public route gets the owner governance variant where the
  route is dual-mode.
- Referral/tracked-link landing preserves attribution without showing private
  owner data.

## Acceptance Criteria

- Public IA is simple and visitor-safe.
- Dual-mode routes have explicit public and owner render paths.
- Public route copy avoids internal implementation nouns.
- Feed, Blog, Journal, and Library are not conflated.

## Non-Goals

- No public homepage redesign in this package.
- No SEO migration implementation.
- No private offer access model changes.

## Required Commands

```bash
npx vitest run src/app/page.test.tsx src/components/SiteNav.test.tsx src/components/offers/OfferSurfaces.test.tsx src/components/about/AboutSurfaces.test.tsx src/app/feed/page.test.tsx
npm run typecheck
npm run lint -- src/app/page.tsx src/components/SiteNav.tsx src/components/public/PublicRouteLinks.tsx src/components/offers/OfferSurfaces.tsx src/components/about/AboutSurfaces.tsx
rg -n "Jobs|Activity|Operations|Library|Journal|Admin|System|provider|payload|log" src/app src/components
```

## Closeout Evidence Required

- Public desktop and mobile screenshots for Home, Offers, About, and Feed when
  content exists.
- Static scan proving public nav excludes donor/admin/internal routes.
- Test output for public nav and dual-mode routes.
