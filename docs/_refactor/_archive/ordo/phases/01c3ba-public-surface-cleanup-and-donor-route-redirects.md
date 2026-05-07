# Phase 01c3ba: Public Surface Cleanup And Donor Route Redirects

Status: Planned

Parent package:

- `02-ui-surface-realignment/09-implementation-phase-plan.md`

## Goal

Clean up public and donor routes after canonical surfaces exist. This phase
decides and implements redirects, hidden states, or donor-only preservation for
Blog, Journal, Library, Activity, Jobs, Operations, and My Media.

## Governing Docs

- `docs/_refactor/ordo/letters/refactor1.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/00-route-and-surface-inventory.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/03-public-surfaces-homepage-modes.md`

## Current Code Grounding

Code anchors:

- `src/app/blog/page.tsx`
- `src/app/blog/[slug]/page.tsx`
- `src/app/journal/page.tsx`
- `src/app/journal/[slug]/page.tsx`
- `src/app/library/page.tsx`
- `src/app/library/[document]/page.tsx`
- `src/app/activity/page.tsx`
- `src/app/jobs/page.tsx`
- `src/app/operations/page.tsx`
- `src/app/my/media/page.tsx`
- `src/lib/shell/shell-navigation.ts`
- `src/middleware.ts` if route redirects/gates are centralized there.

## Verified Current State

- Route decision matrix classifies donor/hidden/redirect candidates.
- Several donor routes still have page files and may remain directly reachable.
- Public nav should not link donor routes.
- Owner rail/account menu should not link donor routes.
- Donor routes may still be needed as source detail or admin diagnostics until
  canonical replacements are complete.

## Target Behavior

- Public routes are Home, Offers, About, Feed when content exists, and access
  routes.
- Owner canonical routes are Conversations, Today, Studio, People, Offers,
  About, Account, Referrals, System/Admin as authorized.
- Donor routes either redirect to canonical surface, return notFound, or remain
  hidden/source-detail behind role gates.
- Redirects preserve safe destination and do not loop.

## Implementation Steps

1. Re-read the route decision matrix and verify prior phases are complete.
2. For each donor route, choose redirect, hidden/notFound, or role-gated donor
   preservation.
3. Implement redirects/gates in route pages or middleware.
4. Update shell/nav tests to ensure donor routes are not linked.
5. Add direct-route tests for redirects/notFound/access gates.
6. Update route decision matrix and evidence docs.

## Positive Tests

- Public canonical routes still load.
- Donor routes redirect or hide according to matrix.
- Admin donor routes remain available to authorized admins.
- `/my/media` converges to Studio after Studio parity.
- `/jobs` converges to Studio/System according to role.

## Negative Tests

- No donor route appears in public nav, owner rail, or account menu.
- Public users cannot access private library/corpus/admin donor content.
- Redirects do not create loops.
- Owner users cannot reach raw operations diagnostics unless authorized.

## Edge Tests

- Existing old content slug redirects to Feed detail when a mapping exists.
- Unknown donor slug renders notFound.
- Admin direct diagnostic route still works.
- Anonymous direct donor route gets login, notFound, or public-safe redirect as
  specified.
- Query parameters are preserved only when safe.

## Acceptance Criteria

- Route decision matrix and implementation agree.
- Public and owner nav are clean.
- Donor routes are not discoverable as product surfaces.
- Source detail/admin diagnostics remain accessible only where needed.

## Non-Goals

- No deletion of reusable donor code.
- No SEO policy beyond explicit redirects implemented here.
- No new public content product.

## Required Commands

```bash
npx vitest run src/lib/shell/shell-navigation.test.ts src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/AccountMenu.test.tsx src/app/page.test.tsx src/app/workspace/page.test.tsx src/app/studio/page.test.tsx src/app/business/page.test.tsx src/app/offers/page.test.tsx src/app/about/page.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/app/blog/page.tsx src/app/journal/page.tsx src/app/library/page.tsx src/app/activity/page.tsx src/app/jobs/page.tsx src/app/operations/page.tsx src/app/my/media/page.tsx src/lib/shell/shell-navigation.ts
```

## Static Scans

```bash
rg -n "href=\"/(blog|journal|library|activity|jobs|operations|my/media)|/my/media|/jobs|/activity|/operations|Library|Journal|Blog" src/app src/components src/lib/shell docs/_business/ux docs/_refactor/ordo/phases
```

## Closeout Evidence Required

- Updated route decision matrix.
- Redirect/notFound/access-gate test output.
- Static scan showing no donor nav leaks.
- Notes for any donor route deliberately retained.
