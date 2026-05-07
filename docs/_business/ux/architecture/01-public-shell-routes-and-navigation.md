# Public Shell, Routes, And Navigation

## UX Intent

The public site should be minimal and understandable:

- Home
- Public Offers
- About
- Feed only when public content exists

Authenticated users should move through a small operator workspace:

- Conversations
- Today
- Studio
- People
- Offers
- About

Account/User info lives in the upper-right account menu rather than the
operator rail.

Admin should be a separate governance mode, not mixed into the operator's daily
navigation.

## Existing Code Evidence

Routes:

- `src/app/page.tsx`
- `src/app/offers/page.tsx`
- `src/app/about/page.tsx`
- `src/app/feed/page.tsx`
- `src/app/workspace/page.tsx`
- `src/app/studio/page.tsx`
- `src/app/business/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/admin/**`
- donor routes: `/jobs`, `/activity`, `/my/media`, `/referrals`,
  `/operations`, `/blog`, `/journal`, `/library`

Shell/navigation:

- `src/lib/shell/shell-navigation.ts`
- `src/lib/shell/public-shell-state.ts`
- `src/components/AppShell.tsx`
- `src/components/SiteNav.tsx`
- `src/components/SiteFooter.tsx`
- `src/components/ShellNavDrawer.tsx`
- `src/components/ShellWorkspaceMenu.tsx`
- `src/components/AuthenticatedWorkRail.tsx`
- `src/components/public/PublicRouteLinks.tsx`
- `src/components/shell/ShellBrand.tsx`

Tests:

- `src/lib/shell/shell-navigation.test.ts`
- `src/lib/shell/public-shell-state.test.ts`
- `src/components/AppShell.test.tsx`
- `src/components/SiteNav.test.tsx`
- `src/components/AuthenticatedWorkRail.test.tsx`
- `src/components/ShellWorkspaceMenu.test.tsx`
- `src/app/page.test.tsx`
- `src/app/sitemap.test.ts`

## Current Functionality

`shell-navigation.ts` already contains the right architectural concepts:

- route disposition: `primary`, `secondary`, `diagnostic`, `donor`, `legacy`
- route visibility by role
- public feed content gate
- object kind mapping
- diagnostic route mapping
- command visibility

`src/core/entities/ordo-object.ts` defines object kinds and surface targets:

- `media_asset`
- `content_item`
- `workflow_run`
- `operation`
- `person`
- `offer`
- `tracked_link`
- `campaign`
- `conversation`

This is strong evidence that the final shell should not be a free-form route
list. It should be an object-centered route contract.

## UX Mapping

| Current surface | UX target | Disposition |
| --- | --- | --- |
| `/` | Home conversation hero | Keep |
| `/offers` | Public Offers | Keep |
| `/about` | About | Keep |
| `/feed` | Public Feed, conditional | Keep |
| `/workspace` | Today | Reframe |
| `/studio` | Studio | Keep |
| `/business` | People/Results during migration | Reframe |
| `/profile` | Account/User info | Keep as account route |
| `/jobs` | Work diagnostics | Hide |
| `/activity` | Activity diagnostics/attention donor | Hide |
| `/my/media` | Studio media donor | Hide |
| `/referrals` | People/referral donor | Hide |
| `/operations` | Operation diagnostics/details | Hide |
| `/blog`, `/journal`, `/library` | Feed/Studio/Corpus donors | Hide from public nav |
| `/admin/**` | Admin governance | Keep in admin mode |

## Product Requirements

1. Public header shows only Home brand, Public Offers, About, and conditional
   Feed.
2. Public footer may carry secondary links, but not diagnostic destinations.
3. Authenticated navigation uses a desktop left rail and mobile hamburger
   menu, not a right drawer.
4. Jobs and notifications collapse into Today/Studio/People badges and cards.
5. Admin navigation uses a separate vertical rail and admin language.
6. `/business` may remain as the route while the UI label migrates to People.
7. Public Feed must stay hidden when there are no public published content
   items.

## Gaps

- The current shell still has donor/diagnostic surfaces close to primary UX.
- The right drawer remains a product mismatch.
- The authenticated rail needs a clearer mobile-first version.
- Route labels still use "Business" in some places where People is the UX
  target.

## Tests To Preserve Or Add

Existing:

- shell route visibility snapshots
- public feed gate
- site nav route links
- authenticated rail route selection

Add:

- no diagnostic route appears in public header/footer
- no top-right job/bell control appears as primary navigation
- People label can point to `/business` during migration
- mobile nav exposes the same primary operator surfaces as desktop
