# Phase 01c3ai: Offers Brief, Selector, And Detail Governance

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3ae-shared-governance-section-framework.md`
- `01c3o-conversational-and-ui-offer-creation.md`
- `docs/_business/ux/08-product-kernel-contract.md`

Blocks:

- `01c3ao-canonical-ux-regression-closeout.md`

## Goal

Convert Offers into a governed section with:

- Offers Brief on the base route,
- second-column offer selector,
- selected offer detail,
- public/private/draft visibility,
- prices,
- source/provenance,
- safe owner actions.

## Current Code Grounding

- `src/app/offers/page.tsx`
  - Keeps one route for public and authenticated Offers.
  - Anonymous users still receive `PublicOffersSurface`.
  - Signed-in users now pass `searchParams` into the owner Offers read model so
    `/offers` renders the brief and `/offers?offerId=...` renders one selected
    offer detail.
- `src/components/offers/**`
  - `OfferSurfaces.tsx` now uses `GovernanceSectionFrame` for the authenticated
    owner surface.
  - Public `PublicOffersSurface` remains visitor-safe and does not render
    provenance, private proposals, drafts, or event internals.
  - `OwnerOffersWorkspace` renders a second-column offer selector and owner-safe
    offer detail with price, visibility, audience, source evidence, private
    relationship links, public link, QR/tracked-link controls, and governed
    publish/archive/edit actions.
- `src/lib/offers/**`
  - `load-offers-workspace.ts` now contains the owner offer read model,
    query parser, selector href builder, offer brief, selected object projector,
    event-state derivation, tracked-link association, and pagination.
  - `offer-service.ts` remains the durable owner/public offer boundary and
    continues to enforce publishing price requirements and ownership checks.
- `config/services.json`
  - Still available as public fallback donor data when no durable public offers
    exist.
- `src/lib/config/defaults.ts`
  - Static `ServiceOffering` defaults remain unchanged and public-only.
- durable `offers` and `offer_events` code added in prior phases
  - Reused for draft, public, private, sent, accepted, purchased, and archived
    offer state projection.
- public offer/tracked link tests from `01c3o` and `01c3q`
  - Preserved and extended with owner governance read-model tests.

## Required Work

1. Base authenticated Offers route renders Offers Brief. **Done.**
2. Second column lists public, private, draft, sent, accepted, purchased, and
   archived offers as available. **Done through state filters and selector row
   labels derived from durable offer status plus `offer_events`.**
3. Selected offer detail shows:
   - title,
   - price,
   - visibility,
   - public/private audience,
   - status,
   - source conversation or creation evidence,
   - relationship/person links when private,
   - public link/QR/tracked link when public.
   **Done.**
4. Public `/offers` remains visitor-safe and only shows public offers. **Done.**
5. Private offers never leak to public or unauthorized users. **Done for the
   current owner/public boundary; private recipient grants remain outside this
   phase.**
6. Offer actions route through chat or governed actions where changes matter.
   **Done via owner forms and private-offer chat prompt links.**

## Tests

Positive:

- public offer appears on public `/offers`.
- private offer appears only to authorized owner/recipient contexts.
- base owner Offers renders Offers Brief.
- selected offer renders price, visibility, source evidence, and next action.

Negative:

- public visitors cannot see private/draft offers.
- owner UI does not expose raw offer event internals as primary copy.
- price is required or clearly marked unavailable; no fake price metrics.

Edge:

- no offers renders first-offer next action.
- static service seeds import or display without breaking durable offers.
- selected missing/unauthorized offer falls back safely.

## Non-Goals

- Do not implement real payment checkout.
- Do not implement commission rates.
- Do not implement complex offer grant merge/split tools.

## Closeout Evidence Required

- Public/private offer route evidence.
- Offer read-model tests.
- Visibility negative tests.
- Static scan for private offer leaks.

Evidence:

- `docs/_refactor/ordo/evidence/phase-01c3ai-offers-brief-selector-and-detail-governance.md`

## Implementation Notes

- The owner Offers surface now follows the canonical disclosure path:
  - base route: Offers Brief plus create-offer governance fallback;
  - second column: compact overview, search, filters, offer selector, and count;
  - selected route: one offer detail, not global totals;
  - detail lenses: facts, promise/description, visibility/sharing, trail, and
    safe actions.
- Offer state labels are product labels, not raw table/event names.
- Fixed/hourly offers without a positive price are shown as `Price required`
  and do not show a publish button until the owner fixes price or billing.
- Public offer rendering is unchanged in principle: only durable published
  public offers appear first, with static service offerings retained as a
  public fallback donor.

## QA Status

Initial implementation checks:

- `npm test -- src/components/offers/OfferSurfaces.test.tsx src/lib/offers/load-offers-workspace.test.ts src/lib/offers/offer-service.test.ts src/app/offers/'[slug]'/page.test.tsx src/app/api/offers/route.test.ts src/app/api/offers/'[offerId]'/route.test.ts`
- `npm run typecheck`
- `npm run lint -- src/components/offers/OfferSurfaces.tsx src/components/offers/OfferSurfaces.test.tsx src/lib/offers/load-offers-workspace.ts src/lib/offers/load-offers-workspace.test.ts src/app/offers/page.tsx`

QA pass 1 and QA pass 2 results are recorded in the evidence document.
