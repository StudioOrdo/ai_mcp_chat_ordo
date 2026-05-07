# People, Referrals, Relationships, And Results

## UX Intent

People is where Ordo helps the solo operator understand who is involved, how
they arrived, what they need, what was promised, and what should happen next.

This surface should not feel like a CRM spreadsheet. It should feel like a
relationship trail with enough business signal to show whether the operator's
effort is creating results.

## Existing Code Evidence

People/business workspace:

- `src/components/business/BusinessWorkspace.tsx`
- `src/lib/business/load-business-workspace.ts`
- `src/app/business/page.tsx`
- `src/app/business/conversations/[conversationId]/page.tsx`
- `src/app/business/referrals/[referralCode]/page.tsx`

Referrals:

- `src/lib/referrals/referral-analytics.ts`
- `src/lib/referrals/referral-milestones.ts`
- `src/lib/referrals/referral-visit.ts`
- `src/lib/referrals/referral-ledger.ts`
- `src/lib/referrals/referral-links.ts`
- `src/lib/referrals/campaign-presets.ts`
- `src/app/r/[code]/page.tsx`
- `src/app/api/referral/[code]/route.ts`
- `src/app/api/referral/visit/route.ts`
- `src/app/api/qr/[code]/route.ts`

Relationship and business workflow:

- `src/core/platform/business-workflow/**`
- `src/core/platform/relationship-memory/**`
- `src/core/platform/operator-transition/**`
- `src/core/use-cases/LeadCaptureInteractor.ts`
- `src/core/use-cases/CreateDealFromWorkflowInteractor.ts`
- `src/core/use-cases/CreateTrainingPathFromWorkflowInteractor.ts`
- `src/core/use-cases/RequestConsultationInteractor.ts`

Data:

- `conversations`
- `conversation_events`
- `relationship_memory_records`
- `referrals`
- `referral_events`
- `lead_records`
- `deal_records`
- `consultation_requests`
- `training_path_records`

Tests:

- `src/components/business/BusinessWorkspace.test.tsx`
- `src/lib/business/load-business-workspace.test.ts`
- `src/lib/referrals/**.test.ts`
- `src/core/platform/business-workflow/**.test.ts`
- `src/core/platform/relationship-memory/**.test.ts`
- `src/core/platform/operator-transition/**.test.ts`
- `src/adapters/LeadRecordDataMapper.test.ts`
- `src/adapters/DealRecordDataMapper.test.ts`
- `src/adapters/RelationshipMemoryDataMapper.test.ts`
- `src/app/business/**.test.tsx`
- `src/app/r/[code]/page.test.tsx`

## Current Functionality

The code already supports:

- referral code generation and QR entry
- referral visit activation
- referral event ledgers and milestones
- referral analytics: introductions, chats, registered, qualified, credit
  status
- conversation-linked business workflow context
- lead records
- deal records with estimated price
- consultation requests
- training paths
- relationship memory for goals/preferences/commitments with evidence
- operator transition state for first offer/share/onboarding guidance

## UX Mapping

| Existing system | UX object | Surface |
| --- | --- | --- |
| `referrals` | Link / referral source | People |
| `referral_events` | Relationship milestone | Relationship Trail |
| `conversations` | Conversation / person context | People |
| `lead_records` | Person stage and need | People |
| `deal_records` | Offer/purchase path | People/Offers |
| `relationship_memory_records` | What Ordo remembers | Person detail |
| `operator_transition` | Next action/onboarding | Today/Account |
| `campaign-presets` | Campaign/tracked-link donor | People/Results |

## Relationship Stage Model

Use simple stages:

1. Visitor
2. Conversation
3. Contact
4. Offer
5. Purchased
6. Follow-up

Current code now projects a derived person object across the first set of
durable sources:

- conversations,
- referrals,
- lead records,
- consultation requests,
- deal records,
- offer events.

The read model is intentionally derived rather than stored as a standalone
truth. Later phases can add governed merge/split operations if relationship
identity needs manual correction.

## Product Requirements

1. The main relationship surface should be called People.
2. Each person card should show source, stage, next action, and last meaningful
   event.
3. Each person detail should have a Relationship Trail.
4. Referral/QR activity should be visible as business motion, not isolated as a
   referrals-only page.
5. Relationship memory should be summarized as "what Ordo remembers."
6. Deals and training paths should appear as outcomes or opportunities, not as
   admin tables.
7. QR/referral metrics should connect to offers and content where possible.

## Current Gaps And Status

- The first person index read model exists in
  `src/lib/business/people-read-model.ts` and merges referrals,
  conversations, leads, consultations, deals, and offer events.
- Relationship memory is still not summarized in the person card/detail view.
- Tracked links now exist for published public offers, published content, and
  owned public URLs; media/campaign target-specific validators remain future
  work.
- Purchase is not modeled as a normal operator/customer event.
- Purchase is currently represented by `offer_events.purchase_simulated` until
  real payment/order events exist.
- "Business" remains the route name for compatibility, but the owner surface
  is presented as People.
- Campaign/content performance is not yet connected to People.
- Today now consumes people follow-up, referral overview, offer-event, and
  content-campaign result evidence for the owner brief; People remains the
  relationship-detail surface.

## Tests To Preserve Or Add

Existing:

- referral visit and origin tests
- referral ledger and analytics tests
- business workspace tests
- relationship memory projector tests
- lead/deal mapper tests
- operator transition tests

Add:

- person card merges referral, conversation, lead, and deal evidence
- Relationship Trail orders events from QR visit through offer decision
- anonymous visitor becomes authenticated person without losing referral origin
- private offer sent to a person appears in that person's trail
- content/tracked-link attribution can create a relationship event
