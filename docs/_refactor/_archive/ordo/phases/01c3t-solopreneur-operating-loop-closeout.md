# Phase 01c3t: Solopreneur Operating Loop Closeout

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3n-authenticated-route-and-left-rail-consolidation.md`
- `01c3o-conversational-and-ui-offer-creation.md`
- `01c3p-people-customer-stage-and-funnel-cards.md`
- `01c3q-tracked-links-qr-and-attribution.md`
- `01c3r-content-campaign-performance-loop.md`
- `01c3s-solopreneur-results-dashboard-and-next-actions.md`
- `docs/_business/ux/08-product-kernel-contract.md`

Blocks:

- `01c4-admin-global-factory-navigation-rail.md`
- `02-public-feed-contract-and-replacement.md`
- `03-business-profile-offers-and-public-profile.md`

## Goal

Close the solopreneur operating-loop refactor with proof that Ordo now has a
simple owner-facing shape:

- create useful work,
- publish/share it,
- track who responds,
- understand what worked,
- take the next action.

## Product Rule

If a regular owner cannot explain the app in one minute, the phase is not done.

Chat is the operating interface. The owner-facing UI is the governance system.

The closeout must prove that the owner can initiate normal work through
conversation and then govern it through Today, Studio, People, Offers, Profile,
and detail lenses. If the owner must understand jobs, queues, operations,
logs, or analytics as primary apps, the package has failed. If the UI cannot
prove what chat did, the package has also failed.

The owner-facing system should be:

- Today,
- Studio,
- People,
- Offers,
- Profile.

Everything else is provenance, admin, diagnostics, or future integration.

## Kernel Alignment

This phase certifies the Product Kernel Contract against the implemented
solopreneur operating loop.

Kernel objects covered:

- Work
- Media
- Content
- Person
- Offer
- Link
- Campaign
- Activity
- Result

Scenario tests that must pass:

- New Owner
- Offer To Visitor
- Private Proposal
- Content To Result
- Studio Provenance
- Dashboard Decision

The phase is not a visual cleanup pass only. It must prove that navigation,
cards, detail lenses, visibility, stages, attribution, and dashboard decisions
fit one product model.

## Closeout Invariants

### Navigation

- No regular-user right drawer as the primary workspace switcher.
- No top-right jobs icon.
- No top-right notification bell.
- Regular-user primary navigation exposes only owner concepts.
- Admin/global controls are separate and role-gated.

### Offers

- Offers are durable business objects.
- Offers have prices or explicit free/contact billing.
- Offers can be created by chat or UI.
- Public offers show only published offers.
- Offer creation stores provenance.

### People

- People/customer objects have stage chips.
- Stages are evidence-backed.
- People details show funnel, related objects, activity, and provenance.

### QR And Attribution

- Published/shareable objects can have tracked links/QR codes.
- Referral QR remains backward-compatible.
- Attribution connects scans/visits/chats/signups/offer choices/purchases.

### Content And Results

- Content objects can connect to campaigns/tracked links/performance.
- Dashboard shows what worked and what needs action.
- No metrics are fabricated when the system lacks evidence.

## Current Code Grounding

- `docs/_business/ux/08-product-kernel-contract.md`
  - Governs the final owner vocabulary and scenario model.
- `src/core/entities/ordo-object.ts`
  - Defines object kinds, detail lenses, primary product surfaces, and donor
    source contracts.
- `src/lib/shell/shell-navigation.ts`
  - Defines public discovery, owner rail, admin rail, donor routes, and route
    visibility.
- `src/components/AppShell.tsx`
  - Mounts the authenticated left rail and keeps anonymous visitors on the
    public shell.
- `src/components/AuthenticatedWorkRail.tsx`
  - Renders Today, Studio, People, Offers, Profile for regular owners and
    keeps staff/admin controls in a separate rail group.
- `src/lib/offers/offer-service.ts`
  - Stores durable offers, offer events, publication state, private send
    events, choices, simulated purchases, and tracked-link mirrors.
- `src/lib/business/people-read-model.ts`
  - Derives evidence-backed people stages, including simulated purchase state,
    from conversations, referrals, leads, consultations, deals, and offer
    events.
- `src/lib/tracked-links/tracked-link-service.ts`
  - Stores tracked links, QR/share targets, and events for visits, chats,
    signups, offer choices, and simulated purchases.
- `src/lib/content/content-campaign-read-model.ts`
  - Projects owner content and tracked-link events into content/campaign
    performance without fabricating metrics.
- `src/lib/dashboard/load-user-dashboard.ts`
  - Builds Today from activity, people, offers, content, links, and grounded
    next actions.
- `src/lib/ordo-cards/ordo-card-projectors.ts`
  - Projects Work, Media, Content, Person, Offer, Link, Campaign, Activity,
    and Result evidence into cards with source/provenance references.
- `src/lib/ordo-details`
  - Provides governance detail lenses for people, content, media, workflow, and
    provenance.

## Implementation Notes

Implemented in this closeout:

- Promoted Offers to a first-class product surface in the shared object
  taxonomy and shell route contract.
- Kept People focused on relationships, referrals, tracked links, campaigns,
  conversations, and funnel state.
- Added a Product Kernel closeout regression test that proves:
  - owner navigation is Today, Studio, People, Offers, Profile;
  - Feed remains conditional;
  - jobs, activity, raw media, referrals, and operations remain donor or
    diagnostic surfaces rather than owner-primary apps;
  - staff/admin controls are role-gated and separate;
  - every kernel object maps to a governed surface and default detail lens;
  - offer, people-stage, tracked-link, content-performance, and dashboard
    claims have durable or explicitly derived backing;
  - stale drawer/notification donors are not mounted by the production shell;
  - this phase package remains grounded in the Product Kernel Contract.

Deferred:

- Real checkout, revenue, and ROI remain deferred until durable payment/order
  events exist.
- Private proposal grants and private content publishing remain deferred to a
  dedicated visibility/share phase.
- Full legacy donor route deletion remains deferred; this phase proves donor
  containment, not URL removal.
- Campaign/pillar authoring and scheduling remain deferred.

## Required QA

Run the Product Kernel Contract gate:

```bash
rg -n "Product Kernel Contract|Kernel Alignment|Scenario" docs/_refactor/ordo/phases/01c3{n,o,p,q,r,s,t}-*.md
```

Every phase in this package must state which kernel object it changes, which
donor code it absorbs, which visibility rule applies, and which scenario tests
it advances.

Historical-baseline note:

- `01c3m` may still refer to Dashboard, Business, and Profile because it
  certifies the implemented object-centered baseline before the Product Kernel
  Contract existed.
- `01c3n` through `01c3t` must prove the final owner vocabulary: Today,
  Studio, People, Offers, Profile.

Run static scans for stale top-level implementation surfaces:

```bash
rg -n "ShellWorkspaceMenu|JobsRail|AttentionInbox|/jobs|/activity|/my/media|/referrals|operations/media" src/components src/lib/shell tests
```

Classify each hit:

- allowed diagnostic/admin route,
- allowed test fixture,
- stale owner navigation,
- stale copy,
- real bug.

Run schema/read-model coverage:

```bash
rg -n "offers|offer_events|tracked_links|tracked_link_events|customer_stage|purchased_simulated" src tests
```

Classify schema/read-model hits:

- implemented durable model,
- planned table/use case still missing,
- donor config/static surface,
- test fixture,
- stale unsupported copy.

The closeout cannot pass if offer, tracked-link, people-stage, or campaign
metrics appear in regular owner UI without a backing durable model or an
explicitly tested derived read model.

Run card/detail coverage:

```bash
rg -n "kind: \"offer\"|kind: \"person\"|kind: \"tracked_link\"|defaultLens|provenanceRefs|sourceRefs" src/lib/ordo-cards src/lib/ordo-details tests
```

## Positive Tests

- New owner can create an offer in chat and publish after confirmation.
- Owner can create/edit an offer in UI.
- Visitor can view published offers.
- Visitor can scan QR and start chat.
- Registered user stage advances after offer choice.
- Simulated purchase is visible in person/offer/dashboard.
- Content performance appears when tracked events exist.
- Dashboard recommends a grounded next action.

## Negative Tests

- Draft/private offers are not public.
- User cannot see another user's people/offers/performance.
- QR for private object is blocked.
- Stale donor routes are not primary navigation.
- No fake revenue/ROI appears.

## Edge Tests

- Empty new instance.
- One offer, no traffic.
- Traffic, no chat.
- Chat, no signup.
- Signup, no chosen offer.
- Affiliate attribution plus offer attribution.
- Many tracked links for one offer.
- Mobile 320px/360px.

## Exit Criteria

- The owner-facing app feels smaller after adding these capabilities.
- The business loop is inspectable through cards and detail lenses.
- Jobs, notifications, operations, and activity support the product without
  becoming the product.
- Future feed, campaign, workflow, and admin phases have a clean foundation.

## QA Evidence

Evidence file:

- `docs/_refactor/ordo/evidence/phase-01c3t-solopreneur-operating-loop-closeout.md`
