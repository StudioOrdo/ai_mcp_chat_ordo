# Phase 01c3ai Evidence: Offers Brief, Selector, And Detail Governance

Status: Implemented

Date: 2026-05-06

## Governing Contracts

- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`

Core invariant preserved:

> Chat is the operating interface. UI surfaces are the governance layer.

## Code Grounding

Confirmed current anchors before editing:

- `src/app/offers/page.tsx`
  - Anonymous users render the public Offers surface.
  - Signed-in users render the owner Offers surface.
- `src/components/offers/OfferSurfaces.tsx`
  - Public visitor offer cards already hid draft/private/provenance copy.
  - Owner surface was still a bespoke dashboard/form/list, not the shared
    governance section frame.
- `src/lib/offers/load-offers-workspace.ts`
  - Public data already preferred durable published public offers and retained
    `config/services.json` as fallback donor data.
  - Owner data exposed offers/cards/counts but not a section brief, selector
    query model, selected object detail, event-derived state labels, or
    tracked-link association.
- `src/lib/offers/offer-service.ts`
  - Durable service already supported draft creation, update, publish, archive,
    private send events, public choice events, simulated purchase events,
    ownership checks, and price validation.
- `src/core/entities/offer.ts`
  - Existing durable model supports `draft`, `ready`, `published`, `archived`,
    `private`, `public`, price/billing, source conversation/message, and
    durable `offer_events`.
- `src/lib/tracked-links/tracked-link-service.ts`
  - Existing tracked-link service supports public offer QR/tracked links only
    for published public offers.

## Implementation

Files changed:

- `src/app/offers/page.tsx`
- `src/components/offers/OfferSurfaces.tsx`
- `src/components/offers/OfferSurfaces.test.tsx`
- `src/lib/offers/load-offers-workspace.ts`
- `src/lib/offers/load-offers-workspace.test.ts`
- `tests/public-content-routes.test.ts`
- `docs/_refactor/ordo/phases/01c3ai-offers-brief-selector-and-detail-governance.md`
- `docs/_refactor/ordo/evidence/phase-01c3ai-offers-brief-selector-and-detail-governance.md`

Implemented behavior:

- Authenticated `/offers` now renders the owner Offers section through
  `GovernanceSectionFrame`.
- Base authenticated route renders `Offers Brief` plus the governed create-offer
  fallback form.
- Second column renders:
  - compact offer overview;
  - search;
  - state and visibility filters;
  - public/private/draft/sent/accepted/purchased/archived offer selector rows;
  - footer count and pagination when needed.
- `?offerId=...` renders exactly one selected offer detail:
  - title;
  - price;
  - visibility;
  - audience;
  - status;
  - source conversation or UI creation evidence;
  - relationship/person links for private proposal events;
  - public offer link and QR/tracked-link controls for public offers;
  - existing tracked-link performance summary when available;
  - owner-safe offer trail labels;
  - publish/archive/edit governed actions.
- Public `/offers` remains anonymous-safe and public-only.
- Fixed/hourly offers without positive prices display `Price required` and do
  not show a publish action until pricing or billing is explicit.

## Tests Added Or Updated

- `src/components/offers/OfferSurfaces.test.tsx`
  - Owner Offers Brief and selector rendering.
  - Selected public offer detail with price, source evidence, public link, and
    QR/tracked-link controls.
  - Selected private offer detail with relationship links and no public link.
  - Public offer surface remains free of private/provenance/draft copy.
- `src/lib/offers/load-offers-workspace.test.ts`
  - Owner offer read model projects durable events without raw internals.
  - State/search filters work.
  - Missing selected offer falls back safely.
  - Empty Offers workspace shows first-offer next action.
  - Query parser/href builder preserve selector state.

## QA Pass 1

Commands:

```bash
npm test -- src/components/offers/OfferSurfaces.test.tsx src/lib/offers/load-offers-workspace.test.ts src/lib/offers/offer-service.test.ts src/app/offers/'[slug]'/page.test.tsx src/app/api/offers/route.test.ts src/app/api/offers/'[offerId]'/route.test.ts
npm test -- tests/public-content-routes.test.ts src/app/api/tracked-links/route.test.ts src/lib/tracked-links/tracked-link-service.test.ts src/app/t/'[code]'/route.test.ts src/app/api/qr/tracked/'[code]'/route.test.ts
npm run typecheck
npm run lint -- src/components/offers/OfferSurfaces.tsx src/components/offers/OfferSurfaces.test.tsx src/lib/offers/load-offers-workspace.ts src/lib/offers/load-offers-workspace.test.ts src/app/offers/page.tsx
```

Results:

- Focused offer tests: passed.
- Focused public/tracked-link route tests initially failed because
  `tests/public-content-routes.test.ts` still mocked the old owner Offers
  workspace shape and did not expose the new selector href builder.
- Lint on touched offer files: passed.
- Typecheck initially failed because existing tests call `OffersPage()` with no
  props and the new page signature required a props object.

Fixes:

- Updated `src/app/offers/page.tsx` to default its props argument to `{}` while
  still accepting `searchParams` when provided.
- Reran `npm run typecheck`: passed.
- Updated `tests/public-content-routes.test.ts` to mock the new owner Offers
  read model, include `buildOwnerOffersHref`, and expect the owner route to
  receive `searchParams`.
- Reran focused public/tracked-link route tests: passed.

## QA Pass 2

Commands:

```bash
npm test -- src/components/offers/OfferSurfaces.test.tsx src/lib/offers/load-offers-workspace.test.ts src/lib/offers/offer-service.test.ts src/app/offers/'[slug]'/page.test.tsx src/app/api/offers/route.test.ts src/app/api/offers/'[offerId]'/route.test.ts tests/public-content-routes.test.ts src/app/api/tracked-links/route.test.ts src/lib/tracked-links/tracked-link-service.test.ts src/app/t/'[code]'/route.test.ts src/app/api/qr/tracked/'[code]'/route.test.ts
npm run typecheck
npm run lint -- src/components/offers/OfferSurfaces.tsx src/components/offers/OfferSurfaces.test.tsx src/lib/offers/load-offers-workspace.ts src/lib/offers/load-offers-workspace.test.ts src/app/offers/page.tsx tests/public-content-routes.test.ts
rg -n "offer_events|metadata_json|offer_evt|created_from|createdFrom|sent_private|purchase_simulated|personRef|trackedLinkId|private proposal|draft|raw job|provider|logs?|diagnostic" src/app/offers/page.tsx src/app/offers/'[slug]'/page.tsx
rg -n "offer_events|metadata_json|offer_evt|created_from|raw job|provider|logs?|diagnostic" src/components/offers/OfferSurfaces.tsx src/lib/offers/load-offers-workspace.ts
rg -n "listOwnerOffers|listOfferEvents|OwnerOffersWorkspace|createdFromConversationId|createdFromMessageId|personRef" src/app/offers/'[slug]'/page.tsx
rg -n "Private Proposal|sent privately|Offer Trail|relationshipLinks" src/app/offers/'[slug]'/page.tsx
```

Results:

- Full focused offer/public/tracked-link rerun: passed, 11 test files and 50
  tests.
- Typecheck: passed.
- Lint on touched offer files and related public-content test: passed.
- Static public/owner leakage scans: no matches.

Fixes:

- No QA pass 2 fixes were required.

## Remaining Risks / Deferred Work

- Private recipient grant URLs are not implemented in this phase. The owner
  detail can show private relationship/person evidence, and public visitors
  cannot see private/draft offers.
- Real checkout/payment is intentionally out of scope.
- Commission/affiliate rate UI is intentionally out of scope.
