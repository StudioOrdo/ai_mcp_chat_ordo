# Phase 01c3p Evidence: People Customer Stage And Funnel Cards

Generated: 2026-05-05

## Result

Status: Passed

This phase makes Person a derived, owner-facing business object over existing
relationship evidence.

The governing invariant from `docs/_business/ux/08-product-kernel-contract.md`
was applied:

- Chat is the operating interface.
- UI surfaces are the governance layer.

## Code Grounding Verified

Before editing, the phase was grounded against these anchors:

- `src/core/platform/business-workflow/BusinessWorkflowContextReader.ts`
  already joins conversations to leads, consultations, deals, training paths,
  referrals, referral events, and notification evidence.
- `src/core/platform/business-workflow/BusinessWorkflowContextProjector.ts`
  already creates conversation-scoped recommended actions and related refs.
- `src/lib/referrals/referral-analytics.ts` already computes introductions,
  started chats, registrations, qualified opportunities, and referral activity.
- `src/lib/business/load-business-workspace.ts` previously projected only
  referral link/activity cards.
- `src/components/business/BusinessWorkspace.tsx` already served as the People
  route shell, but its metrics and copy were referral-first.
- `src/core/entities/ordo-object.ts` already declared `person` as an Ordo
  object kind with a known gap: Business needed a user/account index.
- `01c3o` had already landed durable `offers` and `offer_events`, including
  `chosen`, `sent_private`, and `purchase_simulated` events.

## Files Changed

Implementation:

- `src/lib/business/people-read-model.ts`
- `src/lib/business/load-business-workspace.ts`
- `src/components/business/BusinessWorkspace.tsx`
- `src/components/business/PeopleStageChip.tsx`
- `src/lib/ordo-cards/ordo-card-types.ts`
- `src/lib/ordo-cards/ordo-card-projectors.ts`
- `src/lib/ordo-cards/index.ts`
- `src/lib/ordo-details/ordo-detail-routes.ts`
- `src/lib/ordo-details/ordo-detail-projectors.ts`
- `src/lib/ordo-details/index.ts`
- `src/lib/ordo-details/load-business-object-detail.ts`
- `src/app/business/people/[personId]/page.tsx`
- `src/core/entities/ordo-object.ts`

Tests:

- `src/lib/business/people-read-model.test.ts`
- `src/lib/business/load-business-workspace.test.ts`
- `src/components/business/BusinessWorkspace.test.tsx`
- `src/components/business/PeopleStageChip.test.tsx`
- `src/lib/ordo-cards/ordo-card-projectors.test.ts`
- `src/lib/ordo-details/ordo-detail-projectors.test.ts`
- `src/lib/ordo-details/load-business-object-detail.test.ts`
- `src/app/business/people/[personId]/page.test.tsx`

Docs:

- `docs/_refactor/ordo/phases/01c3p-people-customer-stage-and-funnel-cards.md`
- `docs/_refactor/ordo/evidence/phase-01c3p-people-customer-stage-and-funnel-cards.md`
- `docs/_business/ux/architecture/07-people-referrals-relationships-and-results.md`
- `docs/_business/ux/architecture/12-capability-certification-and-complete-inventory.md`
- `docs/_refactor/ordo/phases/01c3h-object-centered-information-architecture.md`
- `docs/_refactor/ordo/phases/01c3i-ordo-card-system-and-progressive-disclosure.md`

## Implementation Notes

- No broad `people` table was added.
- `loadPeopleReadModel` derives person cards from:
  - owner conversations,
  - owner referral-linked conversations,
  - lead records,
  - consultation requests,
  - deal records,
  - offer events.
- Stage labels follow the Product Kernel Contract:
  - Visitor,
  - Conversation,
  - Contact,
  - Offer,
  - Purchased,
  - Follow-up.
- Stage advancement requires durable evidence:
  - priced deal alone remains Conversation stage,
  - `chosen` offer event advances to Offer,
  - `purchase_simulated` advances to Purchased.
- Person details use the existing object detail layout and expose:
  - Overview,
  - Relationship Trail,
  - Funnel,
  - Related,
  - Activity.

## QA Pass 1

Commands:

```bash
npx vitest run src/lib/business/people-read-model.test.ts src/lib/business/load-business-workspace.test.ts src/components/business/BusinessWorkspace.test.tsx src/components/business/PeopleStageChip.test.tsx src/lib/ordo-cards/ordo-card-projectors.test.ts src/lib/ordo-details/ordo-detail-projectors.test.ts src/lib/ordo-details/load-business-object-detail.test.ts 'src/app/business/people/[personId]/page.test.tsx'
npm run typecheck
```

Issues found and fixed:

- The initial people read model moved a lead into a person card but did not
  carry the source conversation into that person's Relationship Trail. Fixed
  the lead merge path so the person card keeps conversation provenance and
  trail order.

Result after fixes:

- Focused phase tests passed.
- Typecheck passed.

## QA Pass 2

Commands:

```bash
npx vitest run src/lib/business/people-read-model.test.ts src/lib/business/load-business-workspace.test.ts src/components/business/BusinessWorkspace.test.tsx src/components/business/PeopleStageChip.test.tsx src/lib/ordo-cards/ordo-card-projectors.test.ts src/lib/ordo-details/ordo-detail-projectors.test.ts src/lib/ordo-details/load-business-object-detail.test.ts 'src/app/business/people/[personId]/page.test.tsx' src/app/business/page.test.tsx 'src/app/business/conversations/[conversationId]/page.test.tsx' 'src/app/business/referrals/[referralCode]/page.test.tsx'
npm run typecheck
npm run lint -- src/lib/business/people-read-model.ts src/lib/business/load-business-workspace.ts src/components/business/BusinessWorkspace.tsx src/components/business/PeopleStageChip.tsx src/lib/ordo-cards/ordo-card-projectors.ts src/lib/ordo-details/ordo-detail-projectors.ts src/lib/ordo-details/load-business-object-detail.ts src/app/business/people/[personId]/page.tsx
```

Stale-surface/static scans:

```bash
rg -n "founder_note|customer_response_note|triage_state|metadata_json|provider|runtime log|job_id|job_[A-Za-z0-9_:-]+" src/lib/business src/components/business src/app/business src/lib/ordo-details src/lib/ordo-cards/ordo-card-projectors.ts
rg -n "No complete person index|does not yet project a single person|known gap: Business needs a user/account index|No durable people table|claiming a generic person index exists|account-level person indexes|user/account-level person index" docs/_business/ux docs/_refactor/ordo/phases
```

Results:

- Phase and adjacent business route tests passed.
- Typecheck passed.
- Focused lint passed.
- Static scans found no People/business regular-owner UI leaks of founder
  notes, customer response notes, raw metadata JSON, fake metrics, or stale
  person-index claims.
- The raw-term scan still finds pre-existing shared `job_event` and
  `provider_log` switch cases in the generic Ordo card/activity projector and
  studio detail projector. Those are not People surface copy and were not
  introduced by this phase.
- Stale UX documentation was updated so it no longer says the person index is
  wholly missing.

Issues found and fixed:

- Stage precedence initially let stale follow-up outrank later offer/purchase
  evidence. Fixed the rank ordering so Follow-up outranks only early
  anonymous/known/interested evidence while Offer, Purchased, and customer
  evidence remain higher.

## Remaining Explicit Risks

- The person read model is intentionally derived; if relationship identity
  needs manual merging/splitting later, that should be a future governed
  operation rather than hidden automatic mutation.
- Staff/admin cross-owner person detail routing remains conservative; this
  phase focuses regular owner People governance.
