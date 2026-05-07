# Offers, Commerce, And Private Proposals

## UX Intent

Offers are the bridge between Ordo's work and business results.

The public site needs clear public offers with prices. The owner also needs
private offers that can be created in conversation or UI and sent to a specific
person/account/role after a relationship develops.

## Existing Code Evidence

Public offers:

- `src/app/offers/page.tsx`
- `src/app/offers/[slug]/page.tsx`
- `src/lib/offers/load-offers-workspace.ts`
- `src/components/offers/OfferSurfaces.tsx`
- `config/services.json`
- `src/lib/config/defaults.ts`
- `src/lib/config/instance.ts`
- `src/lib/config/instance.schema.ts`

Durable offer model:

- `src/core/entities/offer.ts`
- `src/core/use-cases/OfferRepository.ts`
- `src/adapters/OfferDataMapper.ts`
- `src/lib/offers/offer-service.ts`
- `src/lib/db/tables.ts`
- `src/lib/db/migrations.ts`
- `src/app/api/offers/route.ts`
- `src/app/api/offers/[offerId]/route.ts`

Offer/business donors:

- `src/core/entities/ordo-object.ts` includes `offer`
- `src/lib/shell/shell-navigation.ts` maps `/offers` and `/business` to offer
  object kinds
- `src/lib/ordo-cards/ordo-card-projectors.ts`
- `src/lib/ordo-details/ordo-detail-routes.ts`
- `src/core/use-cases/tools/admin-prioritize-offer.tool.ts`
- `src/core/use-cases/tools/offer-management.tool.ts`
- `src/core/capability-catalog/families/admin-capabilities.ts`
- `src/core/capability-catalog/families/profile-capabilities.ts`
- `src/adapters/DealRecordDataMapper.ts`
- `src/core/entities/deal-record.ts`
- `src/core/platform/operator-transition/OperatorTransitionProjector.ts`

UI/conversation donors:

- chat action-link tests cover "Send offer" as text action
- business workspace links to public offers
- operator transition recommends clarifying the first offer

Tests:

- `tests/public-content-routes.test.ts`
- `src/app/offers/[slug]/page.test.tsx`
- `src/app/api/offers/route.test.ts`
- `src/app/api/offers/[offerId]/route.test.ts`
- `src/components/offers/OfferSurfaces.test.tsx`
- `src/adapters/OfferDataMapper.test.ts`
- `src/lib/offers/offer-service.test.ts`
- `src/core/use-cases/tools/offer-management.tool.test.ts`
- `src/lib/config/ConfigurationService.test.ts`
- `src/lib/config/instance.schema.ts` is validated by config tests
- `src/core/use-cases/tools/admin-prioritize-offer.tool.test.ts`
- `src/adapters/DealRecordDataMapper.test.ts`
- `src/core/platform/operator-transition/OperatorTransitionProjector.test.ts`
- `src/frameworks/ui/useChatSurfaceState.test.tsx`
- `src/frameworks/ui/RichContentRenderer.test.tsx`

## Current Functionality

The current `ServiceOffering` model includes:

- `id`
- `name`
- `description`
- `lane`
- `estimatedPrice`
- `estimatedHours`

`/offers` now uses durable published public offers first. `config/services.json`
remains a seed/import fallback donor when no durable public offers exist.

The durable `OfferService` supports:

- create draft
- update offer
- publish
- archive
- list owner offers
- list public offers
- record private send
- record public offer choice
- record simulated purchase

The durable `offer_events` table records creation, update, publication,
archival, private send, offer choice, and simulated purchase evidence.

The admin offer prioritization tool can recommend which offer or message should
be pushed based on funnel, anonymous demand, and lead queue signals.

Deal records can carry estimated price and stage-like business outcome data.

## UX Mapping

| Existing system | UX object | Disposition |
| --- | --- | --- |
| `config/services.json` | Seed public offers | Keep as import/default |
| `/offers` | Public and owner Offers | Keep as public page for visitors and governance page for owners |
| `offers` | Durable offer object | Keep as first-class object |
| `offer_events` | Offer provenance/activity | Keep for owner history and later People/Results joins |
| `create_offer` | Conversational offer creation | Keep as normal creation path |
| `admin_prioritize_offer` | Offer strategy signal | Reframe for owner later |
| `deal_records.estimatedPrice` | Proposal/outcome donor | Keep |
| operator transition offer refs | Onboarding/first offer guidance | Keep |
| chat "Send offer" action text | Conversation donor | Reframe into durable offer action |

## Required Offer Modes

| Offer mode | Visibility | Required behavior |
| --- | --- | --- |
| Public offer | Public visitor | Appears on public `/offers`, has price, CTA, tracked links. |
| Private offer | Selected person/account/role | Can be sent privately, does not appear on public `/offers`. |
| Draft offer | Owner/team only | Can be revised before public publish or private send. |
| Archived offer | Owner/team only | Preserved for provenance/results, hidden from active flows. |

## Product Requirements

1. Offers must have prices or a clear reason price is omitted.
2. Public offers can be created conversationally and through UI.
3. Private offers can be created conversationally and through UI.
4. Private offers must bind to a person/account/role or explicit audience.
5. Offer creation must preserve provenance: source conversation, prompt/context,
   revisions, and publish/send action.
6. Offers should connect to tracked links/QR codes.
7. Offer status should support at least draft, public, private sent, accepted,
   purchased/simulated purchased, archived.
8. The public offer page is not the offer management UI.

## Gaps

- Private offer grant/addressing is still not implemented.
- Generic tracked links/QR for published public offers are implemented in
  phase `01c3q`; private proposal links still require a share-gated model.
- Offer performance rollups are still planned in later People/Results phases.
- The durable offer model supports `purchase_simulated` events, but there is no
  buyer-facing checkout flow yet.
- Admin offer prioritization is useful but still separate from the owner offer
  creation workflow.

## Test Coverage Status

- Done: create/update/publish/archive through the durable service.
- Done: create offer conversationally and verify durable draft/provenance.
- Done: owner UI shows draft and published offers.
- Done: public pages show published public offers only.
- Done: public pages avoid private draft/provenance copy.
- Done: private send and simulated purchase create durable offer events.
- Planned: private offer grant/addressing and Relationship Trail event joins.
- Planned: simulated purchase updates person stage and offer performance.
- Planned: staff/admin offer audit lenses beyond the owner card projection.
