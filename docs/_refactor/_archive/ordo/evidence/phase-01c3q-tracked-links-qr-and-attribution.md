# Phase 01c3q Evidence: Tracked Links QR And Attribution

Generated: 2026-05-05

## Result

Status: Passed

This phase makes Link a durable, owner-governed business object for QR codes
and attribution.

The governing invariant from `docs/_business/ux/08-product-kernel-contract.md`
was applied:

- Chat is the operating interface.
- UI surfaces are the governance layer.

## Code Grounding Verified

Before editing, the phase was grounded against these anchors:

- `src/app/r/[code]/page.tsx`, `src/app/api/referral/[code]/route.ts`,
  `src/app/api/referral/visit/route.ts`, and `src/app/api/qr/[code]/route.ts`
  already supported referral URLs, referral visits, and referral QR generation.
- `src/lib/referrals/referral-visit.ts`, `src/lib/referrals/referral-ledger.ts`,
  and `src/lib/profile/profile-service.ts` already held referral cookies,
  referral events, and profile QR URLs.
- `src/lib/ordo-cards/ordo-card-projectors.ts` already projected referral QR
  as a `tracked_link` compatibility card.
- `src/components/business/BusinessWorkspace.tsx` already consumed business
  cards and could display new link cards without adding another surface.
- `src/components/offers/OfferSurfaces.tsx` already hosted owner offer
  governance and could expose "Create QR" for published public offers.
- `src/lib/offers/offer-service.ts` and `offer_events.tracked_link_id` already
  provided the correct attribution hook for offer choices and simulated
  purchases.
- `src/lib/chat/stream-intake.ts` and
  `src/lib/chat/migrate-anonymous-conversations.ts` already provided the
  points where link visits could become conversations and signups.

## Files Changed

Implementation:

- `src/core/entities/tracked-link.ts`
- `src/core/use-cases/TrackedLinkRepository.ts`
- `src/adapters/TrackedLinkDataMapper.ts`
- `src/adapters/RepositoryFactory.ts`
- `src/lib/db/tables.ts`
- `src/lib/db/migrations.ts`
- `src/lib/tracked-links/tracked-link-origin.ts`
- `src/lib/tracked-links/tracked-link-visit.ts`
- `src/lib/tracked-links/tracked-link-service.ts`
- `src/app/t/[code]/route.ts`
- `src/app/api/qr/tracked/[code]/route.ts`
- `src/app/api/tracked-links/route.ts`
- `src/app/offers/[slug]/page.tsx`
- `src/lib/chat/stream-intake.ts`
- `src/lib/chat/migrate-anonymous-conversations.ts`
- `src/lib/offers/offer-service.ts`
- `src/lib/ordo-cards/ordo-card-types.ts`
- `src/lib/ordo-cards/ordo-card-projectors.ts`
- `src/lib/ordo-cards/index.ts`
- `src/lib/business/load-business-workspace.ts`
- `src/components/offers/OfferSurfaces.tsx`
- `src/core/entities/ordo-object.ts`

Tests:

- `src/adapters/TrackedLinkDataMapper.test.ts`
- `src/lib/tracked-links/tracked-link-service.test.ts`
- `src/app/api/tracked-links/route.test.ts`
- `src/app/api/qr/tracked/[code]/route.test.ts`
- `src/app/t/[code]/route.test.ts`
- `src/app/offers/[slug]/page.test.tsx`
- `src/lib/offers/offer-service.test.ts`
- `src/lib/ordo-cards/ordo-card-projectors.test.ts`
- `src/core/entities/ordo-object.test.ts`

Docs:

- `docs/_refactor/ordo/phases/01c3q-tracked-links-qr-and-attribution.md`
- `docs/_refactor/ordo/evidence/phase-01c3q-tracked-links-qr-and-attribution.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/04-code-archaeology-functionality-map.md`
- `docs/_business/ux/05-product-story-reuse-map.md`
- `docs/_business/ux/architecture/07-people-referrals-relationships-and-results.md`
- `docs/_business/ux/architecture/08-offers-commerce-and-private-proposals.md`
- `docs/_business/ux/architecture/12-capability-certification-and-complete-inventory.md`

## Implementation Notes

- Durable `tracked_links` and `tracked_link_events` tables were added with
  owner, target, event, conversation, user, offer, and idempotency indexes.
- `TrackedLinkService` supports:
  - published public offer links,
  - owned public URL links,
  - code collision handling,
  - archiving,
  - idempotent visits,
  - offer views,
  - chat starts,
  - signup attribution,
  - offer choices,
  - simulated purchases.
- Generic tracked links use:
  - `/t/[code]` for redirect and visit capture,
  - `/api/qr/tracked/[code]` for QR PNG rendering.
- Existing referral links and QR routes were not replaced or broken.
- Regular owner UI receives cards and metrics, not raw event logs or provider
  details.
- The first content-compatible path is owned public URL creation. Dedicated
  content/media/campaign target validators are deferred until those objects have
  stable public share contracts.

## QA Pass 1

Commands:

```bash
npx vitest run src/adapters/TrackedLinkDataMapper.test.ts src/lib/tracked-links/tracked-link-service.test.ts src/app/api/tracked-links/route.test.ts 'src/app/api/qr/tracked/[code]/route.test.ts' 'src/app/t/[code]/route.test.ts' 'src/app/offers/[slug]/page.test.tsx' src/lib/offers/offer-service.test.ts src/lib/ordo-cards/ordo-card-projectors.test.ts src/core/entities/ordo-object.test.ts src/lib/shell/shell-navigation.test.ts
npx vitest run src/lib/business/load-business-workspace.test.ts src/components/offers/OfferSurfaces.test.tsx src/components/business/BusinessWorkspace.test.tsx
```

Issues found and fixed:

- `src/core/entities/ordo-object.test.ts` still expected the Person object
  contract to say the user/account index was missing. Updated the assertion to
  the current derived-person-index contract.

Result after fixes:

- Focused tracked-link, offer, card, route, business workspace, and shell tests
  passed.

## QA Pass 2

Commands:

```bash
npx vitest run src/adapters/TrackedLinkDataMapper.test.ts src/lib/tracked-links/tracked-link-service.test.ts src/app/api/tracked-links/route.test.ts 'src/app/api/qr/tracked/[code]/route.test.ts' 'src/app/t/[code]/route.test.ts' 'src/app/offers/[slug]/page.test.tsx' src/lib/offers/offer-service.test.ts src/lib/ordo-cards/ordo-card-projectors.test.ts src/core/entities/ordo-object.test.ts src/lib/shell/shell-navigation.test.ts src/lib/business/load-business-workspace.test.ts src/components/offers/OfferSurfaces.test.tsx src/components/business/BusinessWorkspace.test.tsx src/app/api/referral/[code]/route.test.ts src/app/api/referral/visit/route.test.ts src/lib/referrals/referral-ledger.test.ts src/lib/referrals/referral-visit.test.ts src/lib/referrals/referral-origin.test.ts
npm run typecheck
npx vitest run src/adapters/TrackedLinkDataMapper.test.ts src/lib/tracked-links/tracked-link-service.test.ts src/app/api/tracked-links/route.test.ts 'src/app/api/qr/tracked/[code]/route.test.ts' 'src/app/t/[code]/route.test.ts' 'src/app/offers/[slug]/page.test.tsx' src/lib/offers/offer-service.test.ts src/lib/ordo-cards/ordo-card-projectors.test.ts src/core/entities/ordo-object.test.ts src/lib/shell/shell-navigation.test.ts src/lib/business/load-business-workspace.test.ts src/components/offers/OfferSurfaces.test.tsx src/components/business/BusinessWorkspace.test.tsx
```

Static scans:

```bash
rg -n "Explicitly does not invent generic tracked links yet|No durable `tracked_links`|known gap says only referral-code QR|Generic tracked links for any URL do not exist yet|Generic tracked links/QR for offers are still planned" docs/_business/ux docs/_refactor/ordo/phases src
rg -n "provider_log|runtime_audit_log|metadata_json|job_event|inputSnapshot|resultEnvelope" src/app/business src/components/business src/components/offers src/lib/business src/lib/ordo-cards src/app/offers
```

Results:

- Expanded phase and referral compatibility tests passed.
- Typecheck passed.
- Stale-surface scan found one old sentence in
  `01c3i-ordo-card-system-and-progressive-disclosure.md` that said generic
  tracked links did not exist. It was updated to the phase 01c3q reality.
- Phase tests were rerun after that doc fix and passed.
- Regular-owner leak scan found diagnostic source-kind filters and test
  fixtures in `src/lib/ordo-cards`, but no owner-facing Business/Offer copy
  exposing provider logs, raw runtime logs, secrets, raw metadata, or fake
  metrics.

Issues found and fixed:

- Updated the stale 01c3i planning sentence so future phases do not regress
  back to referral-only assumptions.

## Remaining Explicit Risks

- Target-specific tracked links for content items, media assets, and campaigns
  are intentionally deferred until those objects expose stable public share
  contracts and visibility validators.
- Real purchase/payment conversion remains outside this phase; the current
  purchase event is still `purchase_simulated`.
