# Phase 01c3v Evidence: People Selection Column And Mobile Drill-In

Status: Implemented

Evidence date: 2026-05-05

## Governing Contract

Contract:

- `docs/_business/ux/08-product-kernel-contract.md`

Invariant:

- Chat is the operating interface.
- UI surfaces are the governance layer.

This phase aligns the People surface with the product kernel:

- People is relationship governance, not a CRM table.
- The normal owner surface shows relationship evidence, not donor tables.
- Search and filters use durable evidence already projected by the read model.
- The mobile People route is list-first, with route-driven drill-in to detail.

## Code Changes

People/business read model and loader:

- `src/lib/business/people-read-model.ts`
- `src/lib/business/people-read-model.test.ts`
- `src/lib/business/load-business-workspace.ts`
- `src/lib/business/load-business-workspace.test.ts`

People surface:

- `src/components/business/BusinessWorkspace.tsx`
- `src/components/business/BusinessWorkspace.test.tsx`
- `src/app/business/page.test.tsx`
- `tests/browser-ui/business-workspace.spec.ts`

Related fixture/test updates:

- `src/lib/ordo-cards/ordo-card-projectors.test.ts`
- `src/lib/ordo-details/ordo-detail-projectors.test.ts`
- `src/lib/dashboard/load-user-dashboard.test.ts`

Docs:

- `docs/_refactor/ordo/phases/01c3v-people-selection-column-and-mobile-drill-in.md`
- `docs/_refactor/ordo/evidence/phase-01c3v-people-selection-column-and-mobile-drill-in.md`

## Behavior Implemented

- Replaced the old `/business` KPI/control/card index with a People selection
  workspace.
- Added a compact People selection column:
  - search field;
  - filter icon;
  - compact person rows;
  - selected row state;
  - footer count.
- Added route-driven mobile state:
  - `/business` renders list state on mobile;
  - `/business?person=<id>` renders detail state on mobile with a back link.
- Added filter controls:
  - Stage;
  - Source;
  - Next follow-up;
  - Relationship role;
  - Affiliate status.
- Extended `PersonReadModelItem` with owner-safe fields:
  - email;
  - organization;
  - source labels/categories;
  - offer labels;
  - relationship role;
  - affiliate status.
- Search now matches:
  - name;
  - organization;
  - email;
  - stage;
  - source labels/categories;
  - offer labels/evidence.
- Normal People copy translates source evidence into product language such as
  Website, QR code, Referral link, Direct conversation, Public offer, and Public
  content.

## Current Code Grounding

Confirmed anchors:

- `src/app/business/page.tsx`
  - Still role-gates anonymous users to `/login`.
  - Still loads `loadBusinessWorkspace` and renders `BusinessWorkspace`.
- `src/lib/business/people-read-model.ts`
  - Still derives people from conversations, referrals, leads, consultations,
    deals, and offer events.
  - No durable `people` table was added.
- `src/lib/business/load-business-workspace.ts`
  - Keeps compatibility card donors.
  - Adds People selection query parsing, filtering, pagination, and selected
    person projection.
- `src/components/business/BusinessWorkspace.tsx`
  - No client event handlers.
  - Uses links, forms, and `details`/`summary` for server-rendered route
    behavior and keyboard-accessible filtering.

## QA Pass 1

Focused phase tests:

```bash
npx vitest run src/lib/business/people-read-model.test.ts src/lib/business/load-business-workspace.test.ts src/components/business/BusinessWorkspace.test.tsx
```

Initial result:

- Failed, then passed after fixes.

Issues found and fixed:

- The filter form was nested inside the search form.
  - Fix: changed the search wrapper to a non-form container with separate
    sibling forms.
- The `offer_in_motion` filter matched purchased customers with historical
  offer labels.
  - Fix: limited the filter to Offer stage or a current next action mentioning
    an offer.
- Search test fixture used an ambiguous `Offer` query.
  - Fix: changed the stage-search assertion to use `Purchased`, which maps to
    a single grounded stage.
- Component tests queried labels duplicated inside filter options.
  - Fix: scoped assertions to the selected compact row or used plural queries.

Focused rerun:

- Passed. 3 files, 17 tests.

Related tests:

```bash
npx vitest run src/lib/business/people-read-model.test.ts src/lib/business/load-business-workspace.test.ts src/components/business/BusinessWorkspace.test.tsx src/app/business/page.test.tsx src/lib/ordo-cards/ordo-card-projectors.test.ts src/lib/ordo-details/ordo-detail-projectors.test.ts src/lib/dashboard/load-user-dashboard.test.ts
```

Result:

- Passed. 7 files, 53 tests.

Typecheck:

```bash
npm run typecheck
```

Initial result:

- Failed, then passed after fixture fixes.

Issues found and fixed:

- Existing person test fixtures in dashboard, card projector, and detail
  projector tests were missing the new read-model fields.
  - Fix: added email, organization, source labels/categories, offer labels,
    relationship role, and affiliate defaults to those fixtures.

Focused lint:

```bash
npm run lint -- src/components/business/BusinessWorkspace.tsx src/components/business/BusinessWorkspace.test.tsx src/lib/business/load-business-workspace.ts src/lib/business/load-business-workspace.test.ts src/lib/business/people-read-model.ts src/lib/business/people-read-model.test.ts tests/browser-ui/business-workspace.spec.ts src/lib/ordo-cards/ordo-card-projectors.test.ts src/lib/ordo-details/ordo-detail-projectors.test.ts src/lib/dashboard/load-user-dashboard.test.ts
```

Initial result:

- Passed with one warning, then passed cleanly after fix.

Issue found and fixed:

- New loader test used an import type annotation style flagged by lint.
  - Fix: removed the unnecessary import annotation.
- After that lint cleanup, typecheck caught the mocked module spread as
  `unknown`.
  - Fix: cast the mocked actual module to `Record<string, unknown>` before
    spreading it.

Browser smoke:

```bash
npx playwright test tests/browser-ui/business-workspace.spec.ts
```

Initial result:

- The first browser rerun was blocked by a stale Playwright `test-server`
  process from the prior interrupted run.

Issue found and fixed:

- Cleared the stale Playwright test server process and reran the browser smoke.

Result:

- Passed. 1 file, 1 test.

## QA Pass 2

Focused tests:

```bash
npx vitest run src/lib/business/people-read-model.test.ts src/lib/business/load-business-workspace.test.ts src/components/business/BusinessWorkspace.test.tsx src/app/business/page.test.tsx src/lib/ordo-cards/ordo-card-projectors.test.ts src/lib/ordo-details/ordo-detail-projectors.test.ts src/lib/dashboard/load-user-dashboard.test.ts
```

Result:

- Passed. 7 files, 53 tests.

Typecheck:

```bash
npm run typecheck
```

Result:

- Passed.

Focused lint:

```bash
npm run lint -- src/components/business/BusinessWorkspace.tsx src/components/business/BusinessWorkspace.test.tsx src/lib/business/load-business-workspace.ts src/lib/business/load-business-workspace.test.ts src/lib/business/people-read-model.ts src/lib/business/people-read-model.test.ts tests/browser-ui/business-workspace.spec.ts src/lib/ordo-cards/ordo-card-projectors.test.ts src/lib/ordo-details/ordo-detail-projectors.test.ts src/lib/dashboard/load-user-dashboard.test.ts
```

Result:

- Passed.

Static scan:

```bash
rg -n "CRM|dashboard|referral_events|tracked_link_events|job_events|operation_events|job_|OrdoCard|People and relationship loop|View public offers|Open referral link|Introductions|qualified opportunities|started chats|registered" src/components/business/BusinessWorkspace.tsx src/lib/business/load-business-workspace.ts src/lib/business/people-read-model.ts src/components/business/BusinessWorkspace.test.tsx src/lib/business/load-business-workspace.test.ts tests/browser-ui/business-workspace.spec.ts
```

Result:

- No user-facing People UI leak found.
- Remaining hits are compatibility code/test references to `OrdoCard`,
  negative-test fixture values, or non-rendered loader fields.

Owner UI leak scan:

```bash
rg -n "raw job|raw log|provider log|runtime log|diagnostic|job_[A-Za-z0-9_-]+|operation_events|job_events|tracked_link_events|referral_events|lead_records|deal_records" src/components/business/BusinessWorkspace.tsx src/lib/business/load-business-workspace.ts src/lib/business/people-read-model.ts
```

Result:

- No regular People UI leak found.
- Remaining hits are SQL table names inside the read model implementation.

Hydration/static stability scan:

```bash
rg -n "<script|Date\\.now\\(|Math\\.random\\(|toLocale" src/components/business/BusinessWorkspace.tsx tests/browser-ui/business-workspace.spec.ts
```

Initial result:

- Found `toLocaleString()` in the server-rendered People footer count.

Issue found and fixed:

- Replaced locale-sensitive number formatting with stable `String(...)`
  formatting.

Browser smoke:

```bash
npx playwright test tests/browser-ui/business-workspace.spec.ts
```

Result:

- Passed. 1 file, 1 test.

## Remaining Risks

- The selected relationship preview is intentionally light because
  `01c3w-person-detail-header-facts-and-source-actions.md` owns full detail
  header/facts/source-action polish.
- Relationship role and affiliate are derived owner-safe read-model fields for
  this phase; durable editing belongs to later relationship settings work.
