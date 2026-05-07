# Phase 01c3o Evidence: Conversational And UI Offer Creation

Generated: 2026-05-05

## Result

Status: Passed

This phase makes Offer a durable product object instead of only a config-rendered
public page.

The product invariant from `docs/_business/ux/08-product-kernel-contract.md`
was applied:

- Chat is the operating interface.
- UI surfaces are the governance layer.

## Code Grounding Verified

Before editing, the phase was grounded against these anchors:

- `/offers` rendered `services.offerings` from `getInstanceServices()`.
- `config/services.json` had an empty `offerings` array and remains a fallback
  donor only.
- `ServiceOffering` existed in config defaults/schema, but did not support
  owner creation, provenance, private proposals, durable events, or public
  publishing.
- `admin_prioritize_offer` existed as offer intelligence only; it does not
  create or publish offers.
- `src/core/entities/ordo-object.ts` already recognized `offer` as an object
  kind.
- `src/lib/business/load-business-workspace.ts` linked to `/offers` but did not
  load durable offers.

## Files Changed

Implementation:

- `src/core/entities/offer.ts`
- `src/core/use-cases/OfferRepository.ts`
- `src/adapters/OfferDataMapper.ts`
- `src/adapters/RepositoryFactory.ts`
- `src/lib/db/tables.ts`
- `src/lib/db/migrations.ts`
- `src/lib/offers/offer-service.ts`
- `src/lib/offers/offer-format.ts`
- `src/lib/offers/load-offers-workspace.ts`
- `src/components/offers/OfferSurfaces.tsx`
- `src/app/offers/page.tsx`
- `src/app/offers/[slug]/page.tsx`
- `src/app/api/offers/route.ts`
- `src/app/api/offers/[offerId]/route.ts`
- `src/core/use-cases/tools/offer-management.tool.ts`
- `src/core/tool-registry/ToolExecutionContext.ts`
- `src/lib/chat/stream-route-handler.ts`
- `src/core/capability-catalog/catalog-input-schemas.ts`
- `src/core/capability-catalog/families/profile-capabilities.ts`
- `src/core/capability-catalog/runtime-tool-binding.ts`
- `src/lib/chat/tool-bundles/profile-tools.ts`
- `src/lib/ordo-cards/ordo-card-types.ts`
- `src/lib/ordo-cards/ordo-card-projectors.ts`
- `src/lib/ordo-details/ordo-detail-routes.ts`

Tests:

- `src/adapters/OfferDataMapper.test.ts`
- `src/lib/offers/offer-service.test.ts`
- `src/core/use-cases/tools/offer-management.tool.test.ts`
- `src/components/offers/OfferSurfaces.test.tsx`
- `src/app/api/offers/route.test.ts`
- `src/app/api/offers/[offerId]/route.test.ts`
- `src/app/offers/[slug]/page.test.tsx`
- `src/lib/ordo-cards/ordo-card-projectors.test.ts`
- `tests/public-content-routes.test.ts`
- `src/core/capability-catalog/runtime-tool-binding.test.ts`

Docs:

- `docs/_refactor/ordo/phases/01c3o-conversational-and-ui-offer-creation.md`
- `docs/_refactor/ordo/evidence/phase-01c3o-conversational-and-ui-offer-creation.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/architecture/08-offers-commerce-and-private-proposals.md`
- `docs/_business/ux/architecture/12-capability-certification-and-complete-inventory.md`

Related lint cleanup:

- `src/lib/ordo-details/ordo-detail-projectors.test.ts`

## Implementation Notes

- Durable tables: `offers`, `offer_events`.
- Durable repository: `OfferDataMapper`.
- Use case boundary: `OfferService`.
- Conversation tool: catalog-bound `create_offer` in the profile bundle for
  signed-in roles.
- Public pages:
  - `/offers`
  - `/offers/[slug]`
- Owner governance surface:
  - signed-in `/offers`
  - create draft form
  - edit existing offer details
  - publish
  - archive
  - preview public page when published
- Public copy does not expose private drafts, private proposal details, raw
  event rows, raw message ids, raw conversation ids, provider details, or job
  internals.

## QA Pass 1

Commands:

```bash
npm test -- src/components/offers/OfferSurfaces.test.tsx src/adapters/OfferDataMapper.test.ts src/lib/offers/offer-service.test.ts src/core/use-cases/tools/offer-management.tool.test.ts src/app/api/offers/route.test.ts src/app/api/offers/'[offerId]'/route.test.ts src/app/offers/'[slug]'/page.test.tsx src/lib/ordo-cards/ordo-card-projectors.test.ts tests/public-content-routes.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts
npm run typecheck
npm run lint
```

Issues found and fixed:

- Owner offer surface test expected a single `$500` element, but the UI
  correctly renders price in both card metrics and governance controls. Fixed
  the test to assert at least two price receipts.
- Repo-wide lint surfaced one stale unused import in
  `src/lib/ordo-details/ordo-detail-projectors.test.ts`. Removed the import.

Result after fixes:

- Focused phase tests passed.
- Typecheck passed.
- Lint passed with existing warnings only.

## QA Pass 2

Commands:

```bash
npm test -- src/components/offers/OfferSurfaces.test.tsx src/adapters/OfferDataMapper.test.ts src/lib/offers/offer-service.test.ts src/core/use-cases/tools/offer-management.tool.test.ts src/app/api/offers/route.test.ts src/app/api/offers/'[offerId]'/route.test.ts src/app/offers/'[slug]'/page.test.tsx src/lib/ordo-cards/ordo-card-projectors.test.ts tests/public-content-routes.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/app/business/page.test.tsx src/components/business/BusinessWorkspace.test.tsx src/lib/shell/shell-navigation.test.ts tests/shell-navigation-model.test.ts
npm run typecheck
```

Stale-surface/static scans:

```bash
rg -n "getInstanceServices|services\\.offerings|estimatedPrice|config/services\\.json" src/app/offers src/lib/offers src/components/offers tests/public-content-routes.test.ts docs/_refactor/ordo/phases/01c3o-conversational-and-ui-offer-creation.md docs/_refactor/ordo/evidence/phase-01c3o-conversational-and-ui-offer-creation.md
rg -n "created_from|metadata_json|conversation_id|message_id|actor_user_id|offer_events|internal provenance|private proposal|provider|raw log|job_id" src/app/offers src/components/offers src/lib/offers/load-offers-workspace.ts src/core/use-cases/tools/offer-management.tool.ts
rg -n 'No durable offers|No durable `offers`|no first-class offer table|planned durable offers|config-backed rather than durable|current offers are config-backed|No durable offer table exists|No owner-facing offer management UI exists|No public/private offer tests' docs/_business/ux docs/_refactor/ordo/phases/01c3o-conversational-and-ui-offer-creation.md docs/_refactor/ordo/evidence/phase-01c3o-conversational-and-ui-offer-creation.md
rg -n "fake|mock metric|sample metric|job_[A-Za-z0-9_:-]+|inputSnapshot|resultPayload|provider log|runtime log|metadata_json" src/app/offers src/components/offers src/lib/offers src/core/use-cases/tools/offer-management.tool.ts src/lib/ordo-cards/ordo-card-projectors.ts
rg -n "TODO|FIXME" src/app/offers src/components/offers src/lib/offers src/core/use-cases/tools/offer-management.tool.ts src/adapters/OfferDataMapper.ts
```

Results:

- Phase and adjacent route/business/shell tests passed.
- Typecheck passed.
- Stale UX-doc scan found no remaining claims that durable offers are missing.
- Config donor scan found only documented fallback usage in
  `loadPublicOffersPageData`, a test mock, and historical grounding text.
- Public/regular offer UI scan found no raw provider/log text, raw job ids,
  raw `metadata_json`, raw actor ids, raw event table names, or public
  provenance labels.
- Tool-result scan found `created_from_conversation_id` and
  `created_from_message_id` only in `create_offer` tool output, where they are
  intentional evidence fields for chat/tool integration rather than regular
  visitor UI.
- Existing `job_event` switch cases remain in the shared Ordo card projector;
  they are not offer UI copy and were not introduced by this phase.
- TODO/FIXME scan found no hits in touched offer implementation files.

Issues found and fixed:

- UX architecture inventory still said durable offers were missing. Updated
  `docs/_business/ux/08-product-kernel-contract.md`,
  `docs/_business/ux/architecture/08-offers-commerce-and-private-proposals.md`,
  and
  `docs/_business/ux/architecture/12-capability-certification-and-complete-inventory.md`
  to reflect the durable offer model and remaining follow-on gaps.

## Static Scan Notes

Initial scans classified:

- `getInstanceServices` remains only as a public-offer fallback donor in
  `loadPublicOffersPageData` and a test mock. It is not the `/offers` page
  product interface.
- Public offer surfaces did not contain raw provider/log/job text, raw
  `metadata_json`, raw actor ids, raw event table names, or public provenance
  labels.
