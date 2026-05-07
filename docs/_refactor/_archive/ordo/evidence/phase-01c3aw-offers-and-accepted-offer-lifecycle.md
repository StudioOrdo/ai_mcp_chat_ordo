# Phase 01c3aw Evidence: Offers And Accepted Offer Lifecycle

Status: Implemented

Evidence date: 2026-05-07

## What Changed

- Added `OwnerOfferLifecycle` to the owner Offers read model.
- Lifecycle activates only from durable `chosen` or `purchase_simulated` offer
  events.
- Selected offer detail now renders an accepted-offer lifecycle lens:
  accepted, fulfillment work, delivery, feedback, report, and follow-up.
- Fulfillment/delivery/feedback/report/follow-up links are read only from
  durable event metadata; missing links render owner-safe limitations.
- Simulated purchase state is explicitly labeled `Purchased (simulated)` and
  does not imply real payment, revenue, or checkout.
- Prompt handoff loop started with the next phase prompt for `01c3ax`.

## Offer Lifecycle Read Model Map

Source:

- `Offer`
- `OfferEvent[]`
- `TrackedLinkWithPerformance[]`

Projected owner object:

- `stateLabels`: public/private/draft/sent/accepted/purchased/archived from
  offer fields and durable offer events.
- `relationshipLinks`: unique person refs from offer events.
- `lifecycle.active`: true only when a `chosen` or `purchase_simulated` event
  exists.
- `lifecycle.stateLabel`: `Accepted`, `Purchased (simulated)`, or
  `Not accepted`.
- `lifecycle.steps`: accepted, fulfillment, delivery, feedback, report,
  follow-up.
- `lifecycle.limitations`: missing person, missing fulfillment, and simulated
  purchase limitations.

Metadata keys supported as durable evidence:

- `fulfillmentHref`, `fulfillmentLabel`
- `deliveryHref`, `deliveryLabel`
- `feedbackHref`, `feedbackLabel`
- `reportHref`, `reportLabel`
- `follow_upHref`, `follow_upLabel`

## QA Pass 1

Commands run:

```bash
npx vitest run src/lib/offers/load-offers-workspace.test.ts src/components/offers/OfferSurfaces.test.tsx
npx vitest run src/lib/offers/load-offers-workspace.test.ts src/components/offers/OfferSurfaces.test.tsx src/lib/business/people-read-model.test.ts src/components/business/BusinessWorkspace.test.tsx src/lib/studio/load-studio-workspace.test.ts src/lib/dashboard/today-brief-read-model.test.ts
npm run typecheck
npm run lint:css
npm run lint -- src/lib/offers/load-offers-workspace.ts src/components/offers/OfferSurfaces.tsx src/lib/business/people-read-model.ts src/components/business/BusinessWorkspace.tsx src/lib/studio/load-studio-workspace.ts src/lib/dashboard/today-brief-read-model.ts
rg -n "accepted|purchased|purchase_simulated|revenue|conversion|checkout|Accepted Offers" src/app src/components src/lib src/core
```

Result:

- Required tests passed.
- Typecheck passed.
- CSS lint passed.
- Focused lint passed.

Issues found and fixed:

- Added the lifecycle read model and rendering because accepted/purchased state
  existed but the dedicated lifecycle lens was missing.
- Removed `checkout` from lifecycle owner copy so simulated purchases do not
  imply real payment flow.

## QA Pass 2

Commands rerun:

```bash
npx vitest run src/lib/offers/load-offers-workspace.test.ts src/components/offers/OfferSurfaces.test.tsx src/lib/business/people-read-model.test.ts src/components/business/BusinessWorkspace.test.tsx src/lib/studio/load-studio-workspace.test.ts src/lib/dashboard/today-brief-read-model.test.ts
npm run typecheck
npm run lint:css
npm run lint -- src/lib/offers/load-offers-workspace.ts src/components/offers/OfferSurfaces.tsx src/lib/business/people-read-model.ts src/components/business/BusinessWorkspace.tsx src/lib/studio/load-studio-workspace.ts src/lib/dashboard/today-brief-read-model.ts
rg -n "accepted|purchased|purchase_simulated|revenue|conversion|checkout|Accepted Offers" src/app src/components src/lib src/core
```

Result:

- Required tests passed.
- Typecheck passed.
- CSS lint passed.
- Focused lint passed.
- Static scan reviewed.

Issues found and fixed:

- None.

## Static Scan Review

Expected findings remain in:

- offer lifecycle/test code added by this phase;
- referrals/tracked-link analytics where conversion rates are existing durable
  referral/link metrics;
- admin/system/tools/tests where revenue/conversion/accepted operation language
  is diagnostic or fixture language;
- existing product-kernel/entity notes that explicitly say commerce remains
  simulated.

No `Accepted Offers` rail/account item was added. Owner Offers lifecycle copy
does not claim revenue, conversion, or live checkout.

## Visual QA

Authenticated browser screenshot QA is still blocked in this shell context
because owner routes redirect to `/install` without a usable install/session
state. This phase was verified through DOM/component tests, route/read-model
tests, typecheck, lint, and static scans.

## Prompt Handoff

Next prompt files written:

- `docs/_refactor/ordo/prompts/next.md`
- `docs/_refactor/ordo/prompts/archive/01c3ax-knowledge-base-surface.md`

## Remaining Risks

- Lifecycle links beyond accepted/purchase depend on durable metadata being
  written by future Studio/fulfillment work. Until then, the UI correctly
  renders limitations instead of progress.
- Visual screenshot evidence should be captured once local authenticated
  install/session state is available.
