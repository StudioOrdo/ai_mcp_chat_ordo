# Phase 01c3y Evidence: Relationship Trail And Source Linking

Status: Implemented

Evidence date: 2026-05-05

## Governing Contract

Contract:

- `docs/_business/ux/08-product-kernel-contract.md`

Invariant:

- Chat is the operating interface.
- UI surfaces are the governance layer.

This phase aligns People with the product kernel:

- Relationships use Relationship Trail, not relationship provenance.
- Owner UI translates donor evidence into human events.
- Source links point to existing conversation, referral, offer, and content
  surfaces.
- Relationship stages and trail entries are backed by durable evidence.

## Code Changes

People read model:

- `src/lib/business/people-read-model.ts`
- `src/lib/business/people-read-model.test.ts`

People surface:

- `src/components/business/BusinessWorkspace.tsx`
- `src/components/business/BusinessWorkspace.test.tsx`

Object detail model and layout:

- `src/lib/ordo-details/ordo-detail-types.ts`
- `src/lib/ordo-details/ordo-detail-projectors.ts`
- `src/lib/ordo-details/ordo-detail-projectors.test.ts`
- `src/components/ordo-details/OrdoDetailLayout.tsx`
- `src/components/ordo-details/OrdoDetailLayout.test.tsx`

Related regression anchors:

- `src/lib/ordo-details/load-business-object-detail.test.ts`
- `src/app/business/people/[personId]/page.test.tsx`
- `src/lib/business/load-business-workspace.test.ts`
- `src/lib/ordo-cards/ordo-card-projectors.test.ts`
- `src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts`

Docs:

- `docs/_refactor/ordo/phases/01c3y-relationship-trail-and-source-linking.md`
- `docs/_refactor/ordo/evidence/phase-01c3y-relationship-trail-and-source-linking.md`

## Behavior Implemented

- Added `sourceActionLabel` to relationship trail rows and detail timeline
  rows.
- Projected relationship events from existing donors:
  - conversations;
  - referrals;
  - lead records;
  - consultation requests;
  - deal records;
  - offer events;
  - tracked link events tied to durable conversation/user evidence.
- Added owner-safe trail labels:
  - First visit;
  - QR / referral source;
  - Public content viewed;
  - Conversation started;
  - Contact captured;
  - Owner action taken;
  - Offer sent;
  - Offer viewed;
  - Offer accepted;
  - Purchase simulated;
  - Follow-up scheduled.
- Added source action labels:
  - Open conversation;
  - Open referral;
  - View offer;
  - View content;
  - Open link.
- Added Relationship Trail rendering to the selected People preview.
- Preserved generic detail layout behavior while allowing human timeline action
  labels.

## Grounding Decisions

- Brief-created and brief-updated events are not projected yet because there is
  no durable relationship brief version evidence in the current codebase.
- Anonymous tracked-link events without durable conversation/user linkage are
  skipped so the read model does not invent a person.
- Offer source links prefer `/offers/[slug]` when the slug exists, otherwise
  use the existing offer query route.
- Content source links use `/studio/content/[contentId]`.
- Raw table names remain in SQL and tests only.

## QA Pass 1

Focused phase tests:

```bash
npx vitest run src/lib/business/people-read-model.test.ts src/components/business/BusinessWorkspace.test.tsx src/lib/ordo-details/ordo-detail-projectors.test.ts src/components/ordo-details/OrdoDetailLayout.test.tsx src/lib/ordo-details/load-business-object-detail.test.ts 'src/app/business/people/[personId]/page.test.tsx'
```

Initial result:

- Failed, then passed after fixes.

Issues found and fixed:

- The new trail added a second Open conversation link in the selected
  relationship view.
  - Fix: updated the component test to assert the intended multiple source
    links.
- The same stable timestamp appears in both the relationship facts row and the
  trail.
  - Fix: updated the component test to assert multiplicity instead of a single
    text node.

Focused rerun result:

- Passed. 6 files, 33 tests.

Related tests:

```bash
npx vitest run src/lib/business/load-business-workspace.test.ts src/lib/ordo-cards/ordo-card-projectors.test.ts src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts
```

Result:

- Passed. 3 files, 38 tests.

Typecheck:

```bash
npm run typecheck
```

Initial result:

- Failed, then passed after fix.

Issue found and fixed:

- Tracked-link source links can lack a concrete offer id.
  - Fix: `offerHref` now handles missing offer IDs and falls back to `/offers`.

Focused lint:

```bash
npx eslint src/lib/business/people-read-model.ts src/components/business/BusinessWorkspace.tsx src/lib/ordo-details/ordo-detail-types.ts src/lib/ordo-details/ordo-detail-projectors.ts src/components/ordo-details/OrdoDetailLayout.tsx src/lib/business/people-read-model.test.ts src/components/business/BusinessWorkspace.test.tsx src/lib/ordo-details/ordo-detail-projectors.test.ts src/components/ordo-details/OrdoDetailLayout.test.tsx
```

Result:

- Passed.

Owner UI leak/static scan:

```bash
rg -n "tracked_link_events|offer_events|job_events|provider logs|providerModel|Relationship provenance" src/components/business src/components/ordo-details src/lib/business src/lib/ordo-details -g "*.ts" -g "*.tsx" -g "!*.test.ts" -g "!*.test.tsx"
```

Result:

- Remaining hits are SQL donor queries in `src/lib/business/people-read-model.ts`.
- No owner-facing People component or detail component renders those raw labels.

## QA Pass 2

Focused phase tests:

```bash
npx vitest run src/lib/business/people-read-model.test.ts src/components/business/BusinessWorkspace.test.tsx src/lib/ordo-details/ordo-detail-projectors.test.ts src/components/ordo-details/OrdoDetailLayout.test.tsx src/lib/ordo-details/load-business-object-detail.test.ts 'src/app/business/people/[personId]/page.test.tsx'
```

Result:

- Passed.

Related tests:

```bash
npx vitest run src/lib/business/load-business-workspace.test.ts src/lib/ordo-cards/ordo-card-projectors.test.ts src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts
```

Result:

- Passed.

Typecheck:

```bash
npm run typecheck
```

Result:

- Passed.

Focused lint:

```bash
npx eslint src/lib/business/people-read-model.ts src/components/business/BusinessWorkspace.tsx src/lib/ordo-details/ordo-detail-types.ts src/lib/ordo-details/ordo-detail-projectors.ts src/components/ordo-details/OrdoDetailLayout.tsx src/lib/business/people-read-model.test.ts src/components/business/BusinessWorkspace.test.tsx src/lib/ordo-details/ordo-detail-projectors.test.ts src/components/ordo-details/OrdoDetailLayout.test.tsx
```

Result:

- Passed.

Static scans:

```bash
rg -n "tracked_link_events|offer_events|job_events|provider logs|providerModel|Relationship provenance" src/components/business src/components/ordo-details src/lib/business src/lib/ordo-details -g "*.ts" -g "*.tsx" -g "!*.test.ts" -g "!*.test.tsx"
```

Result:

- No owner-facing component leaks found.
- Remaining hits are SQL donor queries.

Issues found and fixed in QA pass 2:

- Tracked-link QR scan events targeting content were being categorized as
  Public content source categories even though the relationship event label was
  QR / referral source.
  - Fix: scan events now categorize as QR code regardless of target kind.

## Remaining Risks

- Relationship brief version history is not implemented yet, so brief-created
  and brief-updated trail events are intentionally absent.
- Tracked-link events without durable person, user, or conversation linkage do
  not appear in People yet.
- Relationship settings and additional People shell closeout remain owned by
  later phases.
