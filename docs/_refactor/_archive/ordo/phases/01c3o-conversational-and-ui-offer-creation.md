# Phase 01c3o: Conversational And UI Offer Creation

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3n-authenticated-route-and-left-rail-consolidation.md`
- `docs/_business/ux/08-product-kernel-contract.md`

Blocks:

- `01c3p-people-customer-stage-and-funnel-cards.md`
- `01c3q-tracked-links-qr-and-attribution.md`
- `03-business-profile-offers-and-public-profile.md`

## Goal

Make offers first-class business objects that can be created conversationally
and through the UI.

The solopreneur should be able to say:

> Create a $500 strategy call offer for solopreneurs who need help turning
> their messy AI workflow into a repeatable process.

Ordo should produce a draft offer card with price, audience, promise, CTA,
visibility, and next actions. The same object should be editable from the
business UI and publishable to the public offers page.

## Product Rule

Offers are not config.

Chat is the operating interface. The Offers UI is the governance layer.

The normal creation path should be conversational: the owner tells Ordo what
they want to sell, who it helps, and how it should be positioned. The UI then
governs the durable offer by making price, visibility, publication state,
private recipients, provenance, and performance inspectable and safe.

`config/services.json` can remain a seed/import donor, but it should not be the
owner's product interface. A created offer must be durable, editable,
publishable, measurable, and connected to conversations, QR links, and customer
stage.

## Kernel Alignment

This phase implements the Offer object in the Product Kernel Contract.

Kernel objects affected:

- Offer is created as a durable object.
- Person can later connect to private proposals and offer stage.
- Link can later create QR/tracked links for published/shareable offers.
- Activity records offer creation, publication, and approval events.

Implementation gates:

1. Reuse `/offers`, `ServiceOffering`, config offerings, and
   `admin_prioritize_offer` as donors before adding UI surface area.
2. Add the durable offer model because static config cannot support owner
   creation, private proposals, provenance, or performance.
3. Support public offer, private offer, and internal draft visibility.
4. Advance the New Owner, Offer To Visitor, and Private Proposal scenario
   tests.
5. Hide internal provenance from public offer pages while keeping it available
   in owner detail lenses.
6. Require price, explicit free billing, or explicit contact-for-price billing
   before publish.

## Current Code Grounding

### Current Display-Only Offer Surface

- `src/app/offers/page.tsx`
  - Reads `getInstanceServices()`.
  - Displays `services.offerings`.
  - Shows `estimatedPrice` and `estimatedHours` when configured.
  - Empty state says the owner can configure offers later.
- `config/services.json`
  - Currently has an empty `offerings` array.
- `src/lib/config/defaults.ts`
  - `ServiceOffering` supports `id`, `name`, `description`, `lane`,
    `estimatedPrice`, and `estimatedHours`.
- `src/lib/config/instance.schema.ts`
  - Validates config offerings and non-negative integer prices.

Pre-implementation schema QA:

- The initial grounding confirmed no durable `offers` table in
  `src/lib/db/tables.ts` or `src/lib/db/migrations.ts`.
- The initial grounding confirmed no durable `offer_events` table.
- Public offer tests still proved the config-backed empty state and
  configured-offer rendering before this phase.

Implemented schema:

- `src/lib/db/tables.ts` and `src/lib/db/migrations.ts` now create durable
  `offers` and `offer_events`.
- `src/adapters/OfferDataMapper.ts` implements the durable mapper.
- `src/core/entities/offer.ts` and `src/core/use-cases/OfferRepository.ts`
  define the entity and repository contract.

### Current Offer Intelligence Donor

- `src/core/use-cases/tools/admin-prioritize-offer.tool.ts`
  - Recommends what offer/message to push based on admin/operator signals.
  - Does not create, update, publish, or price offers.
- `src/core/capability-catalog/families/admin-capabilities.ts`
  - Registers `admin_prioritize_offer`.

### Current Object Model Gap

- `src/core/entities/ordo-object.ts`
  - Defines `offer` as an object kind.
  - Records known gap: no internal offer performance/conversion model exists.
- `src/lib/business/load-business-workspace.ts`
  - Links to `/offers`, but does not load offer objects.
- `src/components/business/BusinessWorkspace.tsx`
  - Shows a `View public offers` link, not offer creation or offer cards.

## Target Offer Model

Add durable offer storage:

- `offers`
  - `id`
  - `slug`
  - `owner_user_id`
  - `title`
  - `summary`
  - `description`
  - `audience`
  - `promise`
  - `price_cents`
  - `currency`
  - `billing_kind`
  - `estimated_minutes`
  - `status`
  - `visibility`
  - `cta_label`
  - `created_from_conversation_id`
  - `created_from_message_id`
  - `created_at`
  - `updated_at`
  - `published_at`
  - `archived_at`

- `offer_events`
  - `id`
  - `offer_id`
  - `event_type`
  - `actor_user_id`
  - `person_ref`
  - `conversation_id`
  - `message_id`
  - `tracked_link_id`
  - `metadata_json`
  - `created_at`

Offer statuses:

- `draft`
- `ready`
- `published`
- `archived`

Visibility:

- `private`
- `public`

Billing kind:

- `fixed`
- `hourly`
- `free`
- `contact`

Initial event types:

- `created`
- `updated`
- `published`
- `archived`
- `viewed`
- `chosen`
- `sent_private`
- `purchase_simulated`

## Conversational Flow

When the user asks to create an offer:

1. Compile the request into a draft offer.
2. Require a price or explicit `contact/free` billing kind.
3. Return an offer card in chat.
4. Provide buttons:
   - Edit details,
   - Publish,
   - Preview public page,
   - Create QR/tracked link after publish.
5. Store provenance:
   - conversation id,
   - message id,
   - tool/action id,
   - user id.

## UI Flow

In the owner workspace:

- Offers index shows offer cards.
- `Create offer` opens a form.
- Form fields match the conversational draft shape.
- Drafts can be saved without publishing.
- Publishing requires title, promise/description, price/billing kind, CTA, and
  public visibility confirmation.

## Public Flow

- `/offers` reads published offers from durable storage.
- `/offers/[slug]` shows a single offer with CTA.
- Empty public offers should be human:
  - either hide Offers from nav when no published offers exist,
  - or show a simple no-current-offers message with chat CTA.

## Required Work

- Add durable offer tables/migrations. **Done.**
- Add durable offer event storage for provenance, public/private visibility
  changes, offer choice, and simulated purchase.
- Add offer repository/mapper. **Done.**
- Add offer service/use cases. **Done:**
  - create draft,
  - update draft,
  - publish,
  - archive,
  - list owner offers,
  - list public offers.
- Add an offer card projector. **Done.**
- Add owner Offers page/surface or Business Offers tab. **Done via `/offers`
  for signed-in owners.**
- Update public `/offers` to use durable published offers. **Done.**
- Keep `config/services.json` only as a fallback/seed donor during migration.
  **Done in `loadPublicOffersPageData`.**
- Add a conversation tool/action for offer creation. **Done with
  catalog-bound `create_offer`.**

## Implementation Result

- Chat can create durable draft offers through catalog-bound `create_offer`.
- Owner `/offers` governs creation, editing, publishing, archiving, price,
  visibility, and public preview.
- Public `/offers` and `/offers/[slug]` read durable published public offers
  first, with config offerings retained only as a fallback donor.
- Offer cards project price, visibility, billing, duration, status, public
  preview, edit action, and provenance refs without exposing raw job/provider
  details in the regular owner UI.
- Offer events record creation, update, publication, archival, private send,
  offer choice, and simulated purchase.
- Conversation provenance stores conversation id and user message id when the
  tool runs inside chat.

Evidence:

- `docs/_refactor/ordo/evidence/phase-01c3o-conversational-and-ui-offer-creation.md`

## Positive Tests

- User can create a draft offer through a use case.
- User can publish a valid priced offer.
- Public `/offers` shows only published offers.
- Owner workspace shows draft and published offers.
- Conversation-created offer records provenance.
- Offer publish, private send, choice, and simulated purchase produce durable
  offer events.

## Negative Tests

- Offer without price or explicit free/contact billing cannot publish.
- Regular user cannot edit another user's offer.
- Anonymous user cannot create offers.
- Archived offers do not appear publicly.
- Public page does not expose private draft fields or internal provenance.

## Edge Tests

- Free offer.
- Contact-for-price offer.
- Duplicate slug collision.
- Long description.
- Empty instance with no published offers.
- Offer created from conversation with no active session should fail safely.

## Exit Criteria

- Offers are no longer just config-rendered content.
- The owner can create and manage offers without touching files.
- Public offers are priced, understandable, and measurable-ready.
- Conversation and UI create the same durable offer object.

## QA Result

Passed on 2026-05-05.

Primary commands:

- `npm test -- src/components/offers/OfferSurfaces.test.tsx src/adapters/OfferDataMapper.test.ts src/lib/offers/offer-service.test.ts src/core/use-cases/tools/offer-management.tool.test.ts src/app/api/offers/route.test.ts src/app/api/offers/'[offerId]'/route.test.ts src/app/offers/'[slug]'/page.test.tsx src/lib/ordo-cards/ordo-card-projectors.test.ts tests/public-content-routes.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts`
- `npm test -- src/components/offers/OfferSurfaces.test.tsx src/adapters/OfferDataMapper.test.ts src/lib/offers/offer-service.test.ts src/core/use-cases/tools/offer-management.tool.test.ts src/app/api/offers/route.test.ts src/app/api/offers/'[offerId]'/route.test.ts src/app/offers/'[slug]'/page.test.tsx src/lib/ordo-cards/ordo-card-projectors.test.ts tests/public-content-routes.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/app/business/page.test.tsx src/components/business/BusinessWorkspace.test.tsx src/lib/shell/shell-navigation.test.ts tests/shell-navigation-model.test.ts`
- `npm run typecheck`
- `npm run lint`

Details are recorded in:

- `docs/_refactor/ordo/evidence/phase-01c3o-conversational-and-ui-offer-creation.md`
