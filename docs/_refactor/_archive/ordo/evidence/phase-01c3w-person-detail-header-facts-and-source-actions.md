# Phase 01c3w Evidence: Person Detail Header, Facts, And Source Actions

Status: Implemented

Evidence date: 2026-05-05

## Governing Contract

Contract:

- `docs/_business/ux/08-product-kernel-contract.md`

Invariant:

- Chat is the operating interface.
- UI surfaces are the governance layer.

This phase aligns the People detail surface with the product kernel:

- People detail starts with current relationship state.
- The header and facts row are owner-safe governance, not a CRM table.
- Source actions point back to durable conversation/referral evidence.
- The UI does not invent PII or fake relationship facts.

## Code Changes

People surface:

- `src/components/business/BusinessWorkspace.tsx`
- `src/components/business/BusinessWorkspace.test.tsx`

Object detail model and layout:

- `src/lib/ordo-details/ordo-detail-types.ts`
- `src/lib/ordo-details/index.ts`
- `src/components/ordo-details/OrdoDetailLayout.tsx`
- `src/components/ordo-details/OrdoDetailLayout.test.tsx`

Person detail projection:

- `src/lib/ordo-details/ordo-detail-projectors.ts`
- `src/lib/ordo-details/ordo-detail-projectors.test.ts`

Related regression anchors:

- `src/lib/business/people-read-model.test.ts`
- `src/app/business/people/[personId]/page.test.tsx`
- `src/lib/ordo-details/load-business-object-detail.test.ts`

Docs:

- `docs/_refactor/ordo/phases/01c3w-person-detail-header-facts-and-source-actions.md`
- `docs/_refactor/ordo/evidence/phase-01c3w-person-detail-header-facts-and-source-actions.md`

## Behavior Implemented

- Added person-specific header projection to object details.
- Added person-specific header rendering to `OrdoDetailLayout`.
- Added the same header/facts block to the selected `/business` relationship
  detail preview.
- Header includes:
  - avatar initials;
  - name;
  - organization when known;
  - stage badge;
  - Open conversation action when a primary conversation exists.
- Facts row includes:
  - Introduced by;
  - Came from;
  - Last conversation;
  - Next follow-up.
- Unknown facts render as a quiet dash.
- Anonymous people do not receive invented email, company, or source actions.
- Dates use `formatStableUtcShortDateTime`.

## QA Pass 1

Focused phase tests:

```bash
npx vitest run src/components/business/BusinessWorkspace.test.tsx src/components/ordo-details/OrdoDetailLayout.test.tsx src/lib/ordo-details/ordo-detail-projectors.test.ts src/lib/business/people-read-model.test.ts 'src/app/business/people/[personId]/page.test.tsx' src/lib/ordo-details/load-business-object-detail.test.ts
```

Result:

- Passed. 6 files, 31 tests.

Typecheck:

```bash
npm run typecheck
```

Initial result:

- Failed, then passed after fix.

Issue found and fixed:

- `OrdoPersonDetailHeaderModel` was defined in detail types but not exported
  through `@/lib/ordo-details`.
  - Fix: exported the type from `src/lib/ordo-details/index.ts`.

Focused lint:

```bash
npm run lint -- src/components/business/BusinessWorkspace.tsx src/components/business/BusinessWorkspace.test.tsx src/components/ordo-details/OrdoDetailLayout.tsx src/components/ordo-details/OrdoDetailLayout.test.tsx src/lib/ordo-details/ordo-detail-types.ts src/lib/ordo-details/index.ts src/lib/ordo-details/ordo-detail-projectors.ts src/lib/ordo-details/ordo-detail-projectors.test.ts src/lib/business/people-read-model.ts src/lib/business/people-read-model.test.ts 'src/app/business/people/[personId]/page.test.tsx' src/lib/ordo-details/load-business-object-detail.test.ts
```

Result:

- Passed.

## QA Pass 2

Focused phase tests:

```bash
npx vitest run src/components/business/BusinessWorkspace.test.tsx src/components/ordo-details/OrdoDetailLayout.test.tsx src/lib/ordo-details/ordo-detail-projectors.test.ts src/lib/business/people-read-model.test.ts 'src/app/business/people/[personId]/page.test.tsx' src/lib/ordo-details/load-business-object-detail.test.ts
```

Result:

- Passed. 6 files, 31 tests.

Typecheck:

```bash
npm run typecheck
```

Result:

- Passed.

Focused lint:

```bash
npm run lint -- src/components/business/BusinessWorkspace.tsx src/components/business/BusinessWorkspace.test.tsx src/components/ordo-details/OrdoDetailLayout.tsx src/components/ordo-details/OrdoDetailLayout.test.tsx src/lib/ordo-details/ordo-detail-types.ts src/lib/ordo-details/index.ts src/lib/ordo-details/ordo-detail-projectors.ts src/lib/ordo-details/ordo-detail-projectors.test.ts src/lib/business/people-read-model.ts src/lib/business/people-read-model.test.ts 'src/app/business/people/[personId]/page.test.tsx' src/lib/ordo-details/load-business-object-detail.test.ts
```

Result:

- Passed.

Static product-drift and owner UI leak scan:

```bash
rg -n "CRM|dashboard|referral_events|tracked_link_events|job_events|operation_events|job_|raw job|raw log|provider log|runtime log|diagnostic|Diagnostics|Diagnostic|lead_records|deal_records|prompt binding|activity receipt|provenance" src/components/business/BusinessWorkspace.tsx src/components/ordo-details/OrdoDetailLayout.tsx src/lib/ordo-details/ordo-detail-projectors.ts src/lib/ordo-details/ordo-detail-types.ts src/lib/business/people-read-model.ts src/components/business/BusinessWorkspace.test.tsx src/components/ordo-details/OrdoDetailLayout.test.tsx src/lib/ordo-details/ordo-detail-projectors.test.ts
```

Result:

- No rendered person header/facts owner UI leak found.
- Remaining hits are:
  - generic non-person diagnostic detail layout support;
  - code/test-only `provenanceRefs`;
  - SQL table names inside the people read model;
  - non-person test fixtures for media/job provenance.

Hydration/static stability scan:

```bash
rg -n "<script|Date\\.now\\(|Math\\.random\\(|toLocale|new Intl\\.DateTimeFormat" src/components/business/BusinessWorkspace.tsx src/components/ordo-details/OrdoDetailLayout.tsx src/lib/ordo-details/ordo-detail-projectors.ts src/lib/ordo-details/ordo-detail-types.ts src/lib/business/people-read-model.ts
```

Result:

- No hits.

Browser smoke:

```bash
npx playwright test tests/browser-ui/business-workspace.spec.ts
```

Result:

- Passed. 1 file, 1 test.

Issues found and fixed in QA pass 2:

- None.

## Remaining Risks

- `Next follow-up` currently uses the existing `nextAction` evidence text.
  Durable scheduled follow-up dates belong to later scheduling/time work.
- Relationship Brief and Relationship Trail polish remains owned by
  `01c3x` and `01c3y`.
