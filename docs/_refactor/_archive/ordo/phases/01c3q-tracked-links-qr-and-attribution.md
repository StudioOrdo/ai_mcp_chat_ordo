# Phase 01c3q: Tracked Links QR And Attribution

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3o-conversational-and-ui-offer-creation.md`
- `01c3p-people-customer-stage-and-funnel-cards.md`
- `docs/_business/ux/08-product-kernel-contract.md`

Blocks:

- `01c3r-content-campaign-performance-loop.md`
- `01c3s-solopreneur-results-dashboard-and-next-actions.md`

## Goal

Make QR codes and tracked links a generic business primitive.

The solopreneur should be able to create a QR code for:

- their affiliate/referral link,
- an offer,
- a piece of content,
- a public feed item,
- a short/video/audio asset,
- any public URL the system owns.

The system should track scans, visits, chats, signups, offer choices, and
simulated purchases back to the link and the object it represents.

## Product Rule

Every shareable object can have a tracked link. Every tracked link has
performance.

Chat is the operating interface. Link and QR UI is attribution governance.

The owner should be able to ask Ordo to create or share a link in conversation.
The UI must govern that link by showing the target object, visibility, QR state,
attribution trail, events recorded, and whether it is safe to keep sharing.

Do not create a QR code for every raw file or internal job. Create tracked
links for published/shareable objects and campaigns.

## Kernel Alignment

This phase implements the Link object in the Product Kernel Contract.

Kernel objects affected:

- Link becomes the generic share and QR primitive.
- Offer, Content, Media, Campaign, and Person can be link targets when they are
  published/shareable.
- Activity records scans, visits, chats, signups, offer choices, and simulated
  purchases.
- Result is calculated from tracked events.

Implementation gates:

1. Reuse the existing referral URL, QR endpoint, referral cookies, referral
   ledger, and referral analytics before adding generic tracked-link behavior.
2. Block public QR/tracked links for draft/private objects unless a private
   share-gated link model exists.
3. Preserve backward compatibility for existing referral URLs.
4. Advance Offer To Visitor, Private Proposal, Content To Result, and
   Dashboard Decision scenario tests.
5. Keep raw tracking diagnostics out of public pages.
6. Ensure attribution can connect link to person, offer, content, and result.

## Current Code Grounding

### Existing Referral QR

- `src/app/r/[code]/page.tsx`
  - Referral landing page.
- `src/app/api/referral/[code]/route.ts`
  - Referral lookup.
- `src/app/api/referral/visit/route.ts`
  - Referral visit tracking.
- `src/app/api/qr/[code]/route.ts`
  - QR PNG generation for active affiliate referral codes.
- `src/lib/referrals/referral-visit.ts`
  - Referral visit cookie handling.
- `src/lib/referrals/referral-ledger.ts`
  - Referral event recording.
- `src/lib/profile/profile-service.ts`
  - Builds referral URL and QR URL for a profile.

Schema QA:

- Durable `tracked_links` and `tracked_link_events` tables now exist in
  `src/lib/db/tables.ts` and `src/lib/db/migrations.ts`.
- The existing referral QR endpoint remains referral-code specific for
  compatibility.
- Generic tracked links use `/t/[code]` and `/api/qr/tracked/[code]`.
- The first generic validators are published public offers and owned public
  URLs. Content/media/campaign-specific target validators remain future work.

### Existing Card Donor

- `src/lib/ordo-cards/ordo-card-projectors.ts`
  - Projects referral QR data as a `tracked_link` card.
  - Projects durable generic `tracked_links` as QR/performance cards.
- `src/core/entities/ordo-object.ts`
  - `tracked_link` now documents public-offer support and future
    content/media/campaign target validators.

### Existing Business Surface

- `src/components/business/BusinessWorkspace.tsx`
  - Shows referral QR card when affiliate state exists.
- `src/components/referrals/ReferralsWorkspace.tsx`
  - Donor for QR download/copy/share behavior.

## Target Data Model

Add durable tables:

- `tracked_links`
  - `id`
  - `code`
  - `owner_user_id`
  - `target_kind`
  - `target_id`
  - `destination_url`
  - `label`
  - `purpose`
  - `status`
  - `created_from_conversation_id`
  - `created_at`
  - `updated_at`
  - `archived_at`

- `tracked_link_events`
  - `id`
  - `tracked_link_id`
  - `event_type`
  - `anonymous_visit_id`
  - `session_id`
  - `conversation_id`
  - `user_id`
  - `referral_id`
  - `offer_id`
  - `metadata_json`
  - `created_at`

Event types:

- `scan`
- `visit`
- `chat_started`
- `signup`
- `offer_viewed`
- `offer_chosen`
- `purchase_simulated`
- `conversion`

Implementation note:

- The first generic implementation may record a QR scan as a redirect/visit
  event when the system cannot distinguish camera scan from plain URL open.
  The product UI should say "visits" unless the event source can honestly
  prove a scan.

## Required Work

- Keep existing referral code behavior working. **Done.**
- Add generic tracked link repository/mapper. **Done.**
- Add generic QR endpoint for tracked links. **Done.**
- Add generic tracked-link redirect route. **Done.**
- Add tracked-link card projector. **Done.**
- Add owner UI actions:
  - Create QR for offer. **Done for published public offers.**
  - Create QR for content. **Done through owned-public-URL service/API; target
    specific content cards remain future work.**
  - Copy link. **Done through tracked-link card actions.**
  - Download QR. **Done through tracked-link card actions.**
  - View performance. **Done through tracked-link card metrics.**
- Add attribution capture for chat/register/offer-choice flows. **Done.**
- Add compatibility bridge so referral QR can eventually be represented as a
  tracked link without breaking existing referral URLs. **Done through shared
  `tracked_link` Ordo card projection while preserving `/r/[code]`.**

## Positive Tests

- Owner can create tracked link for a published offer.
- QR endpoint renders for active tracked link.
- Redirect records scan/visit event.
- Offer viewed/chosen events attribute to tracked link.
- Referral QR still works.

## Negative Tests

- Private/draft object cannot get public tracked link.
- User cannot create tracked link for another owner's object.
- Archived tracked link stops recording public conversions or redirects to a
  safe unavailable page.
- Invalid QR code does not leak target metadata.

## Edge Tests

- Duplicate code collision.
- Same offer has multiple tracked links.
- Anonymous visit later registers.
- QR scan without JS.
- Bot/repeated scan idempotency.

## Exit Criteria

- QR is no longer referral-only.
- Published public offers and owned public URLs can be shared and measured.
- Attribution flows from link to offer events, conversations, registration, and
  the existing People/funnel read model.
- Existing referral analytics remain intact.

## Implementation Notes

- `TrackedLinkDataMapper` implements durable link/event storage over SQLite.
- `TrackedLinkService` gates public offer links to published public offers,
  gates URL links to owned public paths, allocates collision-resistant codes,
  and records idempotent visits/chat/signups/outcomes.
- `/api/tracked-links` supports JSON and form creation for offer links, plus
  JSON owned-public-URL links.
- `/t/[code]` is the generic redirect and visit capture route.
- `/api/qr/tracked/[code]` renders PNG QR codes for active links with generic
  not-found errors.
- `/offers/[slug]` records `tl` offer views and carries `tl` into the
  homepage/chat CTA.
- Chat stream intake records `chat_started` when a tracked-link visit cookie is
  present.
- Anonymous conversation migration records `signup` after registration.
- Offer choice and simulated purchase events mirror into tracked-link events
  when `trackedLinkId` is present.
- Business workspace cards include generic tracked-link QR/performance cards.

## Evidence

- `docs/_refactor/ordo/evidence/phase-01c3q-tracked-links-qr-and-attribution.md`
