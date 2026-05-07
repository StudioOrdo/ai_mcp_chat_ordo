# Phase 01c3v: People Selection Column And Mobile Drill-In

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3u-shell-menu-and-account-surface-alignment.md`
- `01c3p-people-customer-stage-and-funnel-cards.md`
- `docs/_business/ux/08-product-kernel-contract.md`

Blocks:

- `01c3w-person-detail-header-facts-and-source-actions.md`

## Goal

Turn the current People/Business index into a quiet selection surface instead
of a dashboard.

The second column should help the owner find and select a person quickly. It
should not be a section menu, KPI panel, referral dashboard, or CRM table.

## Product Rule

People is the relationship governance surface.

The owner should be able to scan:

- who the person is;
- what stage they are in;
- where they came from;
- when the next meaningful event is.

## Current Code Grounding

- `src/app/business/page.tsx`
  - Compatibility route for People.
- `src/components/business/BusinessWorkspace.tsx`
  - Replaced the old People/Business dashboard surface with the search-first
    People selection column, compact row component, filter sheet, selected
    state, and mobile list/detail drill-in behavior.
- `src/lib/business/load-business-workspace.ts`
  - Now returns people-first selection data, selected person state, People
    filters, and People pagination while preserving card donors for detail and
    compatibility paths.
- `src/lib/business/people-read-model.ts`
  - Derived people/person projection from existing evidence. Extended with
    owner-safe email, organization, source labels/categories, offer labels,
    relationship role, and affiliate fields so search/filtering can stay
    grounded without raw donor names.
- `src/components/business/PeopleStageChip.tsx`
  - Existing stage chip.
- `src/lib/ordo-cards/ordo-card-projectors.ts`
  - Existing person card projection donor.
- `src/components/ordo-cards/OrdoCard.tsx`
  - General card renderer, likely too heavy for compact People row use.

## UX Target

The People second column contains:

- search field;
- filter icon button;
- compact people list;
- selected person state;
- footer count.

The filter control opens a popover/sheet with:

- Stage
- Source
- Next follow-up
- Relationship role
- Affiliate status

Person rows should show:

- avatar or initials;
- name;
- organization or short descriptor;
- stage badge;
- next date or most relevant date;
- optional tiny source/offer icon.

## Required Work

- Replace large People section controls with a search-first second column.
- Add compact person row/card component distinct from `OrdoCard`.
- Add selected state with subtle warm background, thin active indicator, and
  stronger border.
- Add filter popover/sheet with accessible controls.
- Keep search matching grounded in current read model fields:
  - name;
  - company/organization;
  - email if available;
  - relationship stage;
  - source/referral label;
  - offer under consideration.
- Implement mobile list-to-detail drill-in state or route behavior.

## Implementation Notes

Implemented changes:

- `/business` now renders a two-surface People workspace:
  - mobile list state when no `person` query is present;
  - mobile detail state when `person` is present;
  - desktop selection column plus selected relationship preview.
- Replaced KPI/dashboard controls with:
  - `Search people...`;
  - icon-only filter summary with accessible label;
  - compact person rows;
  - selected row indicator;
  - `Showing X of Y people` footer count.
- Added filter controls for:
  - Stage;
  - Source;
  - Next follow-up;
  - Relationship role;
  - Affiliate status.
- Kept normal People copy product-safe:
  - Website;
  - QR code;
  - Referral link;
  - Direct conversation;
  - Public offer;
  - Public content.
- Removed heavyweight `OrdoCard` rendering from the normal People index. The
  card model remains available as a donor for detail surfaces and compatibility
  tests.
- Kept search/filtering grounded in the existing read model instead of adding a
  durable `people` table.

Important grounding details:

- `BusinessWorkspaceData.cards` still exists for compatibility and detail
  donor paths, but the normal `/business` UI uses `people`, `selectedPerson`,
  and `peopleTotal`.
- `person` query state drives the mobile drill-in. This avoids client event
  handlers and preserves server-rendered route stability.
- The selected relationship preview is intentionally light. Phase `01c3w`
  remains responsible for the full detail header, facts row, and source action
  polish.

## Tests

Add or update tests proving:

- People list renders compact rows from the existing people read model.
- Search matches name, organization, email, stage, source, and offer evidence
  when those fields exist.
- Filter popover/sheet opens with keyboard-accessible controls.
- Selected person state is visible and stable.
- Mobile width shows list and detail as separate usable states.
- No raw donor labels such as `referral_events` or `tracked_link_events`
  appear in normal People list copy.

Suggested anchors:

- `src/components/business/BusinessWorkspace.test.tsx`
- `src/lib/business/people-read-model.test.ts`
- browser/mobile specs for `/business`

Implemented test/evidence anchors:

- `src/components/business/BusinessWorkspace.test.tsx`
- `src/lib/business/load-business-workspace.test.ts`
- `src/lib/business/people-read-model.test.ts`
- `src/app/business/page.test.tsx`
- `src/lib/ordo-cards/ordo-card-projectors.test.ts`
- `src/lib/ordo-details/ordo-detail-projectors.test.ts`
- `src/lib/dashboard/load-user-dashboard.test.ts`
- `tests/browser-ui/business-workspace.spec.ts`
- `docs/_refactor/ordo/evidence/phase-01c3v-people-selection-column-and-mobile-drill-in.md`

## QA

QA pass 1:

- Ran focused People/business tests.
- Ran `npm run typecheck`.
- Ran focused `npm run lint -- ...` on touched business/read-model/test files.
- Issues found and fixed:
  - filter form was nested inside the search form, which would cause invalid
    HTML and hydration risk;
  - `offer_in_motion` filter treated any historical offer label as active
    motion, including purchased customers;
  - search fixture for stage matching used an ambiguous `Offer` query that also
    matched other offer-related copy;
  - tests queried duplicate visible labels that also appeared inside filter
    options;
  - downstream test fixtures needed the new read-model fields;
  - lint reported a type-import style warning in the new loader test;
  - typecheck then caught the mocked module spread as `unknown` after the lint
    cleanup.

QA pass 2:

- Reran focused People/business and related card/detail/dashboard tests:
  - 7 files, 53 tests passed.
- Reran `npm run typecheck`.
- Reran focused `npm run lint -- ...` on touched business/read-model/browser
  files.
- Reran `npx playwright test tests/browser-ui/business-workspace.spec.ts`.
- Ran stale-surface/static scans and owner UI leak scans.
- Issues found and fixed:
  - `toLocaleString()` in the server-rendered People footer count could drift
    between server and client locale formatting. Replaced it with stable string
    formatting.
- Scan notes:
  - `OrdoCard` and donor table names remain only in loader compatibility code,
    tests, or SQL read-model implementation. They do not render in the normal
    People owner UI.
  - No raw job/log/provider details, fake metrics, or private donor labels were
    found in the regular People UI.

## Non-Goals

- Do not build a full CRM table.
- Do not add a new durable `people` table unless code grounding proves the
  read model cannot support the UI.
- Do not implement relationship merge/split tools.
- Do not move QR/referral analytics into a separate primary page.
