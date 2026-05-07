# Phase 01c3y: Relationship Trail And Source Linking

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3x-relationship-brief-current-summary.md`
- `01c3q-tracked-links-qr-and-attribution.md`
- `docs/_business/ux/08-product-kernel-contract.md`

Blocks:

- `01c3z-relationship-settings-and-people-shell-closeout.md`

## Goal

Project relationship evidence into a factual Relationship Trail.

The trail should let the owner inspect what happened without exposing raw
implementation nouns.

## Product Rule

Use "Relationship Trail," not "relationship provenance," in normal People UX.

Provenance is the right word for work/media/content/offers. Relationships need
a human trail of interactions, sources, and decisions.

## Current Code Grounding

- `src/lib/business/people-read-model.ts`
  - Current relationship event and stage evidence donor.
- `src/lib/referrals/referral-ledger.ts`
  - Referral milestones.
- `src/lib/referrals/referral-analytics.ts`
  - Referral motion and source analytics donor.
- `src/lib/tracked-links/tracked-link-service.ts`
  - Tracked links, QR/share targets, and events.
- `src/lib/offers/offer-service.ts`
  - Offer events, private sends, choices, and simulated purchases.
- `src/lib/content/content-campaign-read-model.ts`
  - Content/tracked-link performance donor.
- `src/app/business/conversations/[conversationId]/page.tsx`
  - Conversation source route.
- `src/app/offers/[slug]/page.tsx`
  - Public offer source route.
- `src/app/studio/content/[contentId]/page.tsx`
  - Content source route.

## UX Target

Timeline events:

- First visit
- QR / referral source
- Public content or short viewed
- Conversation started
- Brief created
- Brief updated
- Offer sent
- Offer viewed
- Offer accepted
- Purchase or simulated purchase
- Follow-up scheduled
- Message sent
- Owner action taken

Each event should show:

- human label;
- short summary;
- stable date/time;
- optional source link such as Open conversation, View offer, View content, or
  View brief.

## Required Work

- [x] Add a relationship trail projection layer that translates donor evidence into
  human events.
- [x] Include brief-created and brief-updated events where existing evidence can
  support them; otherwise represent only current brief until version evidence
  exists.
- [x] Link source objects where available:
  - conversation;
  - offer;
  - content/feed/studio item;
  - QR/referral/tracked link;
  - prior brief version when available.
- [x] Keep raw diagnostics behind detail/admin links.
- [x] Ensure chronological ordering is deterministic.

## Implementation Notes

Implemented changes:

- Extended `PersonRelationshipTrailItem` with `sourceActionLabel` so owner UI
  can render actions such as Open conversation, View offer, View content, and
  Open referral.
- Updated `src/lib/business/people-read-model.ts` to translate donor evidence
  into human relationship events:
  - conversations become Conversation started or Follow-up scheduled;
  - referrals create First visit and QR / referral source entries;
  - leads become Contact captured;
  - consultations and deals become Owner action taken entries;
  - offer events become Offer sent, Offer viewed, Offer accepted, or Purchase
    simulated;
  - tracked content events become Public content viewed when tied to durable
    conversation/user evidence.
- Added tracked-link event loading for People without adding a separate People
  table or standalone CRM model.
- Offer source links prefer the public slug route (`/offers/[slug]`) and fall
  back to the existing offer query route when a slug is unavailable.
- Content source links use the existing Studio content detail route.
- Business People preview now renders a Relationship Trail section below the
  current relationship summary.
- Generic object detail timeline rows can render human source action labels
  while preserving fallback behavior for other object kinds.

Grounding decisions:

- No brief-created or brief-updated events are currently projected because the
  codebase does not yet expose durable relationship brief version evidence.
  The current brief/summary remains represented by the current person summary
  until a later version store exists.
- Anonymous tracked-link events without durable person, conversation, or user
  linkage are not projected into People. This preserves the stage contract and
  avoids inventing PII.
- Raw table names remain only inside SQL and tests. Owner-facing People UI
  receives product-language labels.

## Tests

Add or update tests proving:

- Relationship Trail is chronological.
- QR/referral source appears as human copy.
- Offer sent/viewed/accepted/purchased events appear when durable offer events
  exist.
- Public content/short events appear when tracked-link/content evidence exists.
- Brief created/updated events appear only when evidence exists.
- Source links target the correct conversation, offer, content, or brief route.
- Raw labels like `tracked_link_events`, `offer_events`, `job_events`, or
  provider logs do not appear in normal People UI.

Suggested anchors:

- `src/lib/business/people-read-model.test.ts`
- `src/lib/tracked-links/tracked-link-service.test.ts`
- `src/lib/offers/offer-service.test.ts`
- `src/lib/ordo-details/load-business-object-detail.test.ts`
- `src/app/business/people/[personId]/page.test.tsx`

Implemented test/evidence anchors:

- `src/lib/business/people-read-model.test.ts`
- `src/components/business/BusinessWorkspace.test.tsx`
- `src/lib/ordo-details/ordo-detail-projectors.test.ts`
- `src/components/ordo-details/OrdoDetailLayout.test.tsx`
- `src/lib/ordo-details/load-business-object-detail.test.ts`
- `src/app/business/people/[personId]/page.test.tsx`
- `src/lib/business/load-business-workspace.test.ts`
- `src/lib/ordo-cards/ordo-card-projectors.test.ts`
- `src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts`
- `docs/_refactor/ordo/evidence/phase-01c3y-relationship-trail-and-source-linking.md`

## QA

QA pass 1:

- Ran focused phase tests:
  - `src/lib/business/people-read-model.test.ts`
  - `src/components/business/BusinessWorkspace.test.tsx`
  - `src/lib/ordo-details/ordo-detail-projectors.test.ts`
  - `src/components/ordo-details/OrdoDetailLayout.test.tsx`
  - `src/lib/ordo-details/load-business-object-detail.test.ts`
  - `src/app/business/people/[personId]/page.test.tsx`
- Ran related tests:
  - `src/lib/business/load-business-workspace.test.ts`
  - `src/lib/ordo-cards/ordo-card-projectors.test.ts`
  - `src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts`
- Ran `npm run typecheck`.
- Ran targeted `npx eslint` on touched implementation and test files.
- Ran owner UI/product drift scans for raw donor labels and provider/job
  leakage.
- Issues found and fixed:
  - component tests needed to account for both header and trail source links;
  - component tests needed to account for the same stable timestamp appearing
    in the facts row and trail;
  - typecheck found tracked-link offer source links can lack an offer id, so
    source-link fallback now handles missing IDs safely;
  - normal People preview fallback link copy now says Open related item instead
    of generic Open source.

QA pass 2:

- Reran focused phase tests.
- Reran related tests.
- Reran `npm run typecheck`.
- Reran targeted `npx eslint`.
- Reran stale-surface/static scans.
- Issues found and fixed:
  - tracked-link QR scan events targeting content were being classified as
    Public content source categories instead of QR code source categories.
    The trail label was correct, but the source filter/category was not.
    Fixed the projection to categorize scan events as QR code regardless of
    target kind.

Scan notes:

- Remaining raw table-name hits are SQL donor queries and tests asserting those
  raw strings do not render in owner UI.
- Generic detail layout still has fallback Open source copy for non-People
  object kinds. People preview and relationship trail projectors use explicit
  human action labels.

## Non-Goals

- Do not implement full attribution analytics dashboards here.
- Do not expose raw activity receipts.
- Do not build relationship merge/split tooling.
