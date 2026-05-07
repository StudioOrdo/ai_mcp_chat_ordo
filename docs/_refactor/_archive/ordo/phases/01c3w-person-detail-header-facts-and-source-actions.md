# Phase 01c3w: Person Detail Header, Facts, And Source Actions

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3v-people-selection-column-and-mobile-drill-in.md`
- `docs/_business/ux/08-product-kernel-contract.md`

Blocks:

- `01c3x-relationship-brief-current-summary.md`
- `01c3y-relationship-trail-and-source-linking.md`

## Goal

Make the selected person detail immediately understandable before showing
history.

The owner should see who this is, what stage the relationship is in, where the
person came from, and how to reopen the source conversation.

## Product Rule

The person detail starts with current relationship state, then evidence.

The header and facts row should be a chief-of-staff briefing, not a data dump.

## Current Code Grounding

- `src/app/business/people/[personId]/page.tsx`
  - Existing person detail route. Still redirects anonymous visitors and
    loads owner-scoped detail through `loadBusinessPersonDetail`.
- `src/lib/ordo-details/load-business-object-detail.ts`
  - Detail loader for business objects. Reuses
    `loadPersonReadModelItem(user.id, personId)` and rejects objects outside
    the current owner scope.
- `src/lib/ordo-details/ordo-detail-projectors.ts`
  - Existing detail lens projection. Now projects a person-specific header
    model with stage, organization, source action, and relationship facts.
- `src/components/ordo-details/OrdoDetailLayout.tsx`
  - Current generic object detail layout. Now renders the person-specific
    header before generic lenses when `detail.personHeader` is present.
- `src/lib/business/people-read-model.ts`
  - Current fields and evidence sources for person summary. Existing
    `sourceLabels`, `referralCodes`, `primaryConversationId`,
    `relationshipTrail`, and `nextAction` provide the facts row without adding
    a durable `people` table.
- `src/app/business/conversations/[conversationId]/page.tsx`
  - Existing conversation detail/source route.
- `src/components/business/BusinessWorkspace.tsx`
  - Current `/business` People selection/detail surface. Now renders the same
    owner-safe person header and facts row in the selected relationship detail.
- `src/lib/format/stable-date.ts`
  - Stable UTC timestamp formatting used for detail dates.

## UX Target

Header:

- avatar;
- name;
- organization;
- stage badge;
- Open conversation button.

Facts row:

- Introduced by;
- Came from;
- Last conversation;
- Next follow-up.

Rules:

- omit unknown values or show a quiet dash;
- use plain labels;
- do not duplicate the Relationship Trail;
- keep the Open conversation action near the name.

## Required Work

- [x] Project a person-specific detail header rather than relying only on
  generic object detail layout.
- [x] Add person facts row using existing evidence only.
- [x] Link Open conversation to the correct source conversation when available.
- [x] Preserve anonymous state when no PII exists.
- [x] Keep admin-only facts hidden from regular owner UI.
- [x] Add stable timestamp formatting through `src/lib/format/stable-date.ts`.

## Implementation Notes

Implemented changes:

- Added `OrdoPersonDetailHeaderModel` to the detail model.
- `projectPersonToOrdoDetail` now projects:
  - display name;
  - organization;
  - stage label;
  - Open conversation href;
  - facts for Introduced by, Came from, Last conversation, and Next follow-up.
- `OrdoDetailLayout` now renders a person-specific header/facts block for
  person details while leaving generic detail layout behavior unchanged for
  media/content/workflow/referral objects.
- `/business` selected relationship detail now renders the same owner-facing
  person header and facts row before relationship evidence.
- Stable date rendering uses `formatStableUtcShortDateTime` from
  `src/lib/format/stable-date.ts`.
- Unknown relationship facts use a quiet dash. No fake source, company, email,
  next follow-up, or conversation action is invented for anonymous people.

Grounding decisions:

- `Introduced by` uses a referral code link when durable referral evidence
  exists; otherwise it renders a quiet dash.
- `Came from` uses existing owner-safe `sourceLabels`.
- `Last conversation` is derived from relationship-trail conversation evidence.
- `Next follow-up` uses existing `nextAction` text until a later phase adds a
  durable scheduling/time model.

## Tests

Add or update tests proving:

- header renders avatar/name/company/stage;
- Open conversation links to the correct conversation route;
- facts row shows introduced-by, source, last conversation, and next follow-up
  when evidence exists;
- unknown facts are omitted or shown as quiet dash;
- anonymous people do not invent name/email/company;
- admin-only diagnostic fields do not appear for regular owner views.

Suggested anchors:

- `src/app/business/people/[personId]/page.test.tsx`
- `src/lib/ordo-details/load-business-object-detail.test.ts`
- `src/lib/business/people-read-model.test.ts`
- `src/components/ordo-details/OrdoDetailLayout.test.tsx`

Implemented test/evidence anchors:

- `src/components/business/BusinessWorkspace.test.tsx`
- `src/components/ordo-details/OrdoDetailLayout.test.tsx`
- `src/lib/ordo-details/ordo-detail-projectors.test.ts`
- `src/lib/business/people-read-model.test.ts`
- `src/app/business/people/[personId]/page.test.tsx`
- `src/lib/ordo-details/load-business-object-detail.test.ts`
- `docs/_refactor/ordo/evidence/phase-01c3w-person-detail-header-facts-and-source-actions.md`

## QA

QA pass 1:

- Ran focused phase tests:
  - `src/components/business/BusinessWorkspace.test.tsx`
  - `src/components/ordo-details/OrdoDetailLayout.test.tsx`
  - `src/lib/ordo-details/ordo-detail-projectors.test.ts`
  - `src/lib/business/people-read-model.test.ts`
  - `src/app/business/people/[personId]/page.test.tsx`
  - `src/lib/ordo-details/load-business-object-detail.test.ts`
- Ran `npm run typecheck`.
- Ran focused `npm run lint -- ...` on touched component, projector, route,
  read-model, and test files.
- Issues found and fixed:
  - initial shell command needed the bracketed person route path quoted;
  - typecheck found `OrdoPersonDetailHeaderModel` was not exported through the
    `@/lib/ordo-details` barrel.

QA pass 2:

- Reran focused phase and related tests.
- Reran `npm run typecheck`.
- Reran focused `npm run lint -- ...`.
- Ran stale-surface/static scans and owner UI leak scans.
- Reran `npx playwright test tests/browser-ui/business-workspace.spec.ts`.
- Issues found and fixed:
  - none.
- Scan notes:
  - generic non-person detail diagnostics still exist for media/work/system
    detail surfaces, but person-specific detail does not render diagnostic
    links in regular owner People UI.
  - `provenanceRefs`, SQL table names, and raw job ids remain only in code or
    tests for non-person/detail compatibility. They do not appear in the new
    person header/facts owner UI.

## Non-Goals

- Do not implement editable role/affiliate settings in this phase.
- Do not implement brief history or full timeline yet.
- Do not add commission/payment UI.
