# Phase 01d: Conversational Homepage Composition

Status: Planned

Parent phase:

- `01-public-site-shell-and-navigation.md`

Depends on:

- `01a-public-shell-chat-and-ui-audit.md`
- `01b-route-access-and-public-surface-contract.md`
- `01c-public-navigation-footer-and-mobile-system.md`
- `01c6-navigation-regression-cleanup-and-closeout.md`

## Goal

Make the homepage feel like Ordo from the first visit.

This is not a marketing landing page with a chatbot. The first assistant
message is the hero. Intent buttons are the primary calls to action. Supporting
sections explain enough to build trust without forcing the solopreneur to write
lots of content.

## Product Rule

A solopreneur can launch with:

- one offer,
- one about paragraph,
- one useful chat intake path,
- zero feed posts.

The homepage must still feel complete.

## Blast Radius

Homepage composition, chat first-message config, public suggestions, homepage
tests, and public empty-state previews.

Do not implement full feed publishing, offer KPI tracking, or admin workflow UI.
Use the Phase 01c route-state model: Feed is an optional homepage action and
must not be promoted when there are no public feed items.

## Current Code To Research

- `src/app/page.tsx`
- `src/frameworks/ui/ChatSurface.tsx`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `src/frameworks/ui/ChatMessageViewport.tsx`
- `src/adapters/ChatPresenter.ts`
- `src/lib/config/defaults.ts`
- `src/lib/config/instance.ts`
- `src/app/about/page.tsx`
- `src/app/feed/page.tsx` after Phase 01b
- `src/app/offers/page.tsx` after Phase 01b
- `tests/first-message-flow.test.tsx`
- `tests/homepage-shell-layout.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`
- `tests/homepage-shell-evals.test.tsx`

## Required Work

- Keep `/` chat-first.
- Replace public default copy that says "search your library."
- Set anonymous tone to the public face of the CEO's chief of staff, not a
  salesperson.
- Add public intent suggestions:
  - ask what Ordo does,
  - view offers,
  - ask a business question,
  - view about/process,
  - explore feed only when public feed content exists.
- Add short supporting homepage sections only if they help explain Ordo.
- Add feed/offers/about previews that are honest when empty.
- Do not require feed content for the homepage to feel alive.

## Positive Tests

- Anonymous homepage renders the first assistant message as the primary hero.
- Public suggestions route only to allowed public actions.
- Empty feed does not make homepage feel broken.
- One configured offer can appear as the practical business CTA.

## Negative Tests

- Homepage does not route anonymous users to `/library`, `/journal`, or `/blog`.
- Homepage does not expose admin/staff tools.
- Homepage does not imply public content exists when feed is empty.
- Homepage does not use static marketing hero copy that competes with chat.

## Edge Tests

- Missing identity config.
- Missing offers.
- Empty feed.
- Referral visitor.
- Mobile viewport with composer visible.

## Cleanup

- Remove homepage test fixtures that say "Search my library."
- Remove duplicate hero copy paths that compete with the first message.

## Exit Criteria

- Homepage first impression is chat-first, offer-aware, and content-light.
- The homepage can launch a solopreneur site without feed posts.
- Public CTAs are route-safe and role-safe.
