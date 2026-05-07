# 02 UI Surface Realignment: Accepted Offers Lifecycle Surface

Status: Draft spec

## Goal

Define how accepted offers become a lifecycle surface without creating another
top-level app too early. Accepted offers should connect People, Offers, Studio,
delivery, feedback, reporting, and follow-up.

## Current Code Grounding

Current anchors:

- `src/lib/offers/load-offers-workspace.ts`
- `src/components/offers/OfferSurfaces.tsx`
- `src/core/entities/offer.ts`
- `src/core/entities/offer-event.ts`
- `src/app/offers/page.tsx`
- `src/app/offers/[slug]/page.tsx`
- `src/lib/business/people-read-model.ts`
- `src/components/business/BusinessWorkspace.tsx`
- `src/lib/dashboard/load-user-dashboard.ts`
- `src/lib/dashboard/today-brief-read-model.ts`
- `src/lib/studio/load-studio-workspace.ts`
- `src/core/entities/ordo-object.ts`

## Verified Current State

- Owner offers already support states such as public, private, draft, sent,
  accepted, purchased, and archived in the workspace read model.
- Offer events and tracked links can connect offers to people and source
  activity.
- People stages can project offer and purchased states.
- Today can surface decisions or inspected output.
- Studio owns produced work but does not yet explicitly treat accepted offer
  fulfillment as a first-class lifecycle.
- No separate `Accepted Offers` top-level nav exists.

## Target Behavior

Accepted offer lifecycle:

```text
offer accepted -> fulfillment work -> delivery -> feedback -> report -> follow-up
```

Primary placement:

- Offers owns the accepted offer detail and commercial state.
- People shows the relationship state and relationship trail.
- Studio shows the fulfillment work/media/content produced for the offer.
- Today shows owner decisions, blocked fulfillment, delivery ready, and follow-up
  attention.

Navigation:

- Do not add Accepted Offers as a top-level rail item until there is enough
  evidence that it needs its own surface.
- Use Offers filters and second-column rows for accepted/purchased states.
- Add a dedicated Accepted Offer detail lens when the read model exists.

Accepted offer read model fields:

- offer id, title, price, visibility, accepted/purchased state;
- person/account link;
- source/referral/tracked link refs;
- fulfillment work refs;
- delivery refs;
- feedback/report refs;
- next action;
- limitations.

## Reuse / Move / Hide / Mock Decisions

- Reuse Offers as the canonical owner surface.
- Reuse People relationship trail for person-side lifecycle evidence.
- Reuse Studio work/media/content for fulfillment evidence.
- Hide accepted-offer lifecycle from the left rail until it becomes operationally
  necessary.
- Mock only deterministic empty lifecycle sections with explicit "No fulfillment
  work yet" limitations.

## Positive Tests

- Accepted offer appears in Offers selector under accepted/purchased filters.
- Accepted offer detail links to the related person when evidence exists.
- Person relationship trail shows offer sent/viewed/accepted/purchased events.
- Studio work detail can link back to an accepted offer source ref.
- Today shows blocked or ready accepted-offer fulfillment as owner-safe work.

## Negative Tests

- Accepted offer state is not advanced without durable offer event evidence.
- No fake revenue or conversion metrics appear.
- Private offer details do not leak to anonymous users.
- Owner UI does not require the raw job queue to understand fulfillment state.

## Edge Tests

- Accepted offer with no person link shows limitation and chat next action.
- Accepted offer with no fulfillment work shows honest empty state.
- Simulated purchase is labeled as simulated until real payment exists.
- Archived accepted offer remains inspectable but not active.
- Missing offer id renders shared missing-detail state.

## Acceptance Criteria

- Accepted offer lifecycle is represented as a read model, not scattered UI
  conditionals.
- Offers remains the source of commercial truth.
- People and Studio show related evidence without duplicating ownership.
- No new top-level nav item is added until justified.

## Non-Goals

- No real checkout/payment integration.
- No commission accounting.
- No separate accepted-offers route unless a later phase proves need.
- No fake revenue analytics.

## Required Commands

```bash
npx vitest run src/lib/offers/load-offers-workspace.test.ts src/components/offers/OfferSurfaces.test.tsx src/lib/business/people-read-model.test.ts src/components/business/BusinessWorkspace.test.tsx src/lib/dashboard/today-brief-read-model.test.ts src/components/studio/StudioWorkspace.test.tsx
npm run typecheck
npm run lint -- src/lib/offers/load-offers-workspace.ts src/components/offers/OfferSurfaces.tsx src/lib/business/people-read-model.ts src/components/business/BusinessWorkspace.tsx src/lib/dashboard/today-brief-read-model.ts src/components/studio/StudioWorkspace.tsx
rg -n "accepted|purchased|purchase_simulated|revenue|conversion|checkout" src/core src/lib src/components src/app
```

## Closeout Evidence Required

- Accepted-offer lifecycle data map.
- Tests showing evidence-based stage transitions.
- Screenshots of Offers detail, People trail, and Studio related work when
  implemented.
- Static scan showing no fake revenue or checkout claims.
