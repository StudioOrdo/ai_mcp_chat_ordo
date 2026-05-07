# Phase 01c3p: People Customer Stage And Funnel Cards

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3o-conversational-and-ui-offer-creation.md`
- `docs/_business/ux/08-product-kernel-contract.md`

Blocks:

- `01c3q-tracked-links-qr-and-attribution.md`
- `01c3s-solopreneur-results-dashboard-and-next-actions.md`

## Goal

Represent customers, leads, visitors, and affiliates in the simplest possible
stage model.

The solopreneur should not have to infer business progress from conversations,
referral rows, consultation records, or deal records. They should see people
and relationships moving through stages.

## Product Rule

People are business objects.

Chat is the operating interface. People UI is the relationship governance
layer.

The owner should be able to ask Ordo to follow up, explain a relationship,
draft a private offer, or summarize a person in conversation. The UI should
govern that relationship by showing evidence-backed stage, relationship trail,
related offers/content/links, and safe next actions.

Every person-like object should answer:

- Who is this?
- How did they arrive?
- What stage are they in?
- Which offer/content/QR link influenced them?
- What should I do next?
- What evidence/provenance supports that?

## Kernel Alignment

This phase implements the Person object and Relationship Trail lens from the
Product Kernel Contract.

Kernel objects affected:

- Person becomes the owner-facing abstraction for visitors, leads, customers,
  affiliates, referrers, and collaborators.
- Offer attaches to a person when an offer is viewed, chosen, purchased, or
  privately sent.
- Link attaches to a person when QR/referral/tracked-link activity identifies
  relationship motion.
- Result is derived from stage evidence, not invented metrics.

Implementation gates:

1. Reuse `users`, `conversations`, `lead_records`, `consultation_requests`,
   `deal_records`, `referrals`, and `referral_events` before adding tables.
2. Derive stages from durable evidence and map them to the product labels:
   Visitor, Conversation, Contact, Offer, Purchased, Follow-up.
3. Preserve anonymity when no PII exists.
4. Advance Offer To Visitor, Private Proposal, and Dashboard Decision scenario
   tests.
5. Reframe `/business` as People where the owner is managing relationships.
6. Keep admin triage data hidden unless the viewer has the required role.

## Current Code Grounding

### Durable Donors

- `users`
  - Durable authenticated users with referral code and affiliate state.
- `conversations`
  - Stores anonymous/authenticated conversation state, referral source, lane,
    recommended next step, and detected need summary.
- `lead_records`
  - Captured leads.
- `consultation_requests`
  - Consultation/customer-intent records.
- `deal_records`
  - Existing deal/proposal records with `estimated_price`.
- `training_path_records`
  - Training path outcomes.
- `referrals`
  - Referral attribution and credit status.
- `referral_events`
  - Referral milestones.

### Business Context Donors

- `src/core/platform/business-workflow/BusinessWorkflowContextReader.ts`
  - Conversation-scoped business context.
- `src/core/platform/business-workflow/BusinessWorkflowContextProjector.ts`
  - Projects lead/consultation/deal/training/referral context and recommended
    action.
- `src/lib/referrals/referral-analytics.ts`
  - Already computes introductions, started chats, registered, and qualified
    opportunities.
- `src/lib/referrals/referral-ledger.ts`
  - Records referral milestones.

### Current Surface

- `src/components/business/BusinessWorkspace.tsx`
  - Shows referral link/activity cards and aggregate counts.
  - Does not expose a people/customer index.
- `src/app/business/conversations/[conversationId]/page.tsx`
  - Existing detail route for conversation-centered business context.

Schema QA:

- There is no durable `people` table today.
- `person` is already an Ordo object kind in `src/core/entities/ordo-object.ts`,
  but the current implementation is conversation/referral/business-context
  scoped.
- This phase should start with a derived people read model from existing
  evidence rather than adding a broad new person table by default.

## Target Stage Model

Use a derived read model first:

- `anonymous`
- `known`
- `interested`
- `offer_chosen`
- `purchased_simulated`
- `customer`
- `lost_or_inactive`

This should initially be calculated from durable evidence:

- anonymous conversation with no user: `anonymous`
- authenticated user or linked referral: `known`
- lead/consultation/deal draft/recommended next step: `interested`
- offer selection event: `offer_chosen`
- simulated purchase event: `purchased_simulated`
- completed deal/payment-equivalent event: `customer`
- stale/no response/lost status: `lost_or_inactive`

Do not store the stage as the only truth unless the event model is also stored.

User-facing labels must follow the Product Kernel Contract:

| Internal/read-model state | UI label |
| --- | --- |
| `anonymous` | Visitor |
| `known` | Contact |
| `interested` | Conversation |
| `offer_chosen` | Offer |
| `purchased_simulated` | Purchased |
| `customer` | Purchased or Follow-up, depending on evidence |
| `lost_or_inactive` | Follow-up or Inactive |

## Required Work

- Add a people/customer read model that can list owner-visible people-like
  business objects. **Done via `src/lib/business/people-read-model.ts`.**
- Add `person` Ordo card projector or strengthen the existing business context
  projector for people. **Done via `projectPersonToOrdoCard`.**
- Add detail lenses:
  - Overview,
  - Relationship Trail,
  - Funnel,
  - Related,
  - Activity. **Done via `projectPersonToOrdoDetail` and
    `/business/people/[personId]`.**
- Add a stage chip component reused by people, conversations, and referrals.
  **Done for the People surface with `PeopleStageChip`; later phases can reuse
  the same component in additional surfaces.**
- Add stage transitions from offer events once `01c3o` exists. **Done for
  `chosen`, `sent_private`, and `purchase_simulated` event evidence.**
- Update Business/People surface to show people cards, not only referral cards.
  **Done.**
- Preserve conversation/referral/deal provenance. **Done through source refs,
  provenance refs, and the Relationship Trail lens.**

## Implementation Result

- `/business` now includes evidence-derived `person` cards before referral
  link/activity cards.
- Person stages are derived from existing durable donors rather than stored as
  standalone truth:
  - conversations,
  - users/roles,
  - referrals,
  - leads,
  - consultations,
  - deals,
  - offer events.
- The People workspace summary now shows stage counts for Visitor,
  Conversation, Contact, Offer, Purchased, and Follow-up.
- `/business/people/[personId]` shows the person detail view with Overview,
  Relationship Trail, Funnel, Related, and Activity lenses.
- Anonymous referral conversations remain anonymous; the UI does not invent
  name or email.
- Priced deals remain Conversation stage unless a durable offer event exists.
- Regular owner UI hides founder notes, admin triage notes, raw job/provider
  details, and raw table/log internals.

## Positive Tests

- Anonymous conversation becomes an anonymous person/opportunity card.
- Authenticated user becomes a known person card.
- Lead/deal/consultation produces interested stage.
- Chosen offer event produces offer-chosen stage.
- Simulated purchase event produces purchased-simulated stage.
- Stage card links to the correct detail route.

## Negative Tests

- User cannot see people from another owner/account.
- Anonymous visitor PII is not invented when missing.
- Stage is not advanced without durable evidence.
- Admin-only triage fields are not shown to regular users.

## Edge Tests

- Multiple conversations for same user.
- Referral linked after anonymous chat starts.
- Lead without email.
- Deal with estimated price but no offer event.
- Stale conversation with no next action.

## Exit Criteria

- The owner can understand relationships without reading raw CRM tables.
- People and conversations have visible funnel stages.
- Each stage is evidence-backed and inspectable.
- Offer and QR attribution can attach to people in later phases.
