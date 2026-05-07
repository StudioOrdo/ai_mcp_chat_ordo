# Phase 01c3aw: Offers And Accepted Offer Lifecycle

Status: Implemented

Parent package:

- `02-ui-surface-realignment/09-implementation-phase-plan.md`

## Goal

Make Offers the canonical surface for public/private/draft/sent/accepted/
purchased offers, and introduce the accepted-offer lifecycle read model without
adding a premature top-level Accepted Offers route.

## Governing Docs

- `docs/_refactor/ordo/letters/refactor1.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/06-accepted-offers-lifecycle-surface.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/07-placeholder-read-model-policy.md`

## Current Code Grounding

Code anchors:

- `src/app/offers/page.tsx`
- `src/app/offers/[slug]/page.tsx`
- `src/lib/offers/load-offers-workspace.ts`
- `src/components/offers/OfferSurfaces.tsx`
- `src/core/entities/offer.ts`
- `src/core/entities/offer-event.ts`
- `src/lib/business/people-read-model.ts`
- `src/components/business/BusinessWorkspace.tsx`
- `src/lib/studio/load-studio-workspace.ts`
- `src/lib/dashboard/today-brief-read-model.ts`

## Verified Current State

- Owner offers read model supports visibility/state concepts including public,
  private, draft, sent, accepted, purchased, and archived.
- Public offers and owner offers already share `/offers` with session-based
  rendering.
- Offer events can connect offers to conversations, people, and tracked links.
- People and Today can already reflect offer motion through evidence.
- Accepted-offer lifecycle now projects from durable offer events inside the
  owner offer read model. It starts only from `chosen` or `purchase_simulated`
  evidence, can link fulfillment/delivery/feedback/report/follow-up evidence
  from event metadata, and renders limitations where links are missing.

## Target Behavior

- Offers base route renders Offer Brief.
- Offers selector filters public/private/draft/sent/accepted/purchased.
- Offer detail shows price, visibility, state, source relationship, events,
  sharing links, and next action.
- Accepted offer lifecycle is represented as data linked to People and Studio:
  accepted -> fulfillment -> delivery -> feedback -> report -> follow-up.
- Do not add Accepted Offers to owner rail in this phase.

## Implementation Steps

1. Audit offer state and visibility projection.
2. Ensure every public offer has price or an explicit missing-price action.
3. Add accepted-offer lifecycle read model fields where durable evidence exists.
4. Link accepted offers to People and Studio related refs.
5. Add tests for evidence-based accepted/purchased state.
6. Add negative tests for fake revenue/conversion.
7. Update docs/evidence.

## Positive Tests

- Public offers render price and visibility-safe copy.
- Owner offers selector filters accepted and purchased states.
- Accepted offer detail links to related person and fulfillment work when
  evidence exists.
- Person relationship trail shows offer accepted/purchased evidence.
- Today can surface accepted-offer fulfillment attention.

## Negative Tests

- Offer state does not advance without durable event evidence.
- Private offer data does not leak publicly.
- No fake revenue, conversion, checkout, or lifecycle metrics render.
- Accepted Offers is not added to owner rail.

## Edge Tests

- Accepted offer with no person link shows limitation.
- Accepted offer with no fulfillment work shows honest empty lifecycle state.
- Simulated purchase is labeled simulated.
- Missing price creates owner action but does not block public/private draft
  inspection.
- Archived accepted offer remains inspectable but inactive.

## Acceptance Criteria

- Offers owns commercial state.
- Accepted-offer lifecycle is available as a read model/detail lens.
- People and Studio show related evidence without duplicating ownership.
- No new top-level navigation item is introduced.

## Non-Goals

- No real checkout/payment processing.
- No commission/payout UI.
- No separate accepted-offers route.
- No fake revenue analytics.

## Required Commands

```bash
npx vitest run src/lib/offers/load-offers-workspace.test.ts src/components/offers/OfferSurfaces.test.tsx src/lib/business/people-read-model.test.ts src/components/business/BusinessWorkspace.test.tsx src/lib/studio/load-studio-workspace.test.ts src/lib/dashboard/today-brief-read-model.test.ts
npm run typecheck
npm run lint:css
npm run lint -- src/lib/offers/load-offers-workspace.ts src/components/offers/OfferSurfaces.tsx src/lib/business/people-read-model.ts src/components/business/BusinessWorkspace.tsx src/lib/studio/load-studio-workspace.ts src/lib/dashboard/today-brief-read-model.ts
```

## Static Scans

```bash
rg -n "accepted|purchased|purchase_simulated|revenue|conversion|checkout|Accepted Offers" src/app src/components src/lib src/core
```

## Closeout Evidence Required

- Offer lifecycle read model map.
- Screenshots for public offer, owner offer brief, and accepted offer detail.
- Tests proving private/public visibility and evidence-based state.
- Static scan proving no fake revenue/conversion claims.

## Closeout Evidence

Evidence file:

- `docs/_refactor/ordo/evidence/phase-01c3aw-offers-and-accepted-offer-lifecycle.md`

Implemented code:

- `src/lib/offers/load-offers-workspace.ts`
- `src/components/offers/OfferSurfaces.tsx`
- `src/lib/offers/load-offers-workspace.test.ts`
- `src/components/offers/OfferSurfaces.test.tsx`

Prompt handoff:

- `docs/_refactor/ordo/prompts/next.md`
- `docs/_refactor/ordo/prompts/archive/01c3ax-knowledge-base-surface.md`
