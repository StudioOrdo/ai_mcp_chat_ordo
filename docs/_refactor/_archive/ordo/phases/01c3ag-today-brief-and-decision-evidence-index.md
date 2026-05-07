# Phase 01c3ag: Today Brief And Decision Evidence Index

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3ae-shared-governance-section-framework.md`
- `docs/_refactor/planning/09-today-brief-and-decision-surface.md`
- `docs/_refactor/planning/06-brief-generation-and-background-intelligence.md`

Blocks:

- `01c3am-brief-read-model-storage-and-evidence-manifests.md`

## Goal

Convert Today from a dashboard stream into a CEO daily brief.

The second column is the evidence index. The main pane is the interpretation
layer. Selecting an item shows one detail with why it matters, evidence, source
links, and the next action.

## Current Code Grounding

- `src/app/workspace/page.tsx`
- `src/components/dashboard/UserDashboard.tsx`
- `src/lib/dashboard/load-user-dashboard.ts`
- `src/lib/activity/activity-taxonomy.ts`
- `src/lib/activity/activity-types.ts`
- `src/components/ordo-cards/OrdoCard.tsx`
- `src/lib/dashboard/today-brief-read-model.ts`
- `src/components/governance/GovernanceSectionFrame.tsx`
- `src/lib/format/stable-date.ts`

Important current functions to research:

- `buildTodayBriefReadModel`
- `parseUserDashboardQuery`
- `buildDashboardHref`
- `todayItemMatchesQuery`
- `buildNextActionCards`
- `buildWeakSignalCards`
- `buildResultCards`
- `buildSystemHealth`

Stale pre-implementation functions:

- `buildTodaySelectionItems`
- `DashboardSelectionColumn`
- `DashboardOverview`
- `SelectedTodayObject`

Those prior local component helpers were replaced by the shared governance
section frame and deterministic Today read model.

## Required Work

1. Add/derive a Today read model with intent-based items:
   - decide,
   - watch,
   - inspect,
   - learn,
   - fix.
2. Base `/workspace` renders Today Brief, not stacked dashboard blocks.
3. Second column shows search/filter/list of Today items with icons by intent.
4. Selected item shows:
   - intent,
   - domain,
   - why this is on Today,
   - current state,
   - recommended action,
   - evidence refs,
   - source object links.
5. Completed work is not labeled Decision unless an owner decision remains.
6. System work appears only in owner-safe language and links to System/Admin
   for diagnostics when authorized.
7. Keep first deterministic brief compatible with future durable brief storage.

## Implementation Notes

- Added `src/lib/dashboard/today-brief-read-model.ts` as the deterministic
  Today read-model contract for this phase.
- `/workspace` now renders a Today Brief on the base route through
  `GovernanceSectionFrame`.
- The second column is now the Today evidence index with search, intent filter,
  intent icons, and selectable rows.
- Selected items render one detail view with:
  - intent and domain,
  - why the item is on Today,
  - current state,
  - recommended action,
  - evidence references,
  - source links.
- Completed work projects to `inspect`; running work projects to `watch`;
  result evidence projects to `learn`; failed, blocked, weak, or incomplete
  evidence projects to `fix`; explicit next actions project to `decide`.
- Failed/blocked activity is classified from durable activity source status
  before generic card status normalization.
- Owner-facing Today copy sanitizes raw job ids, log language, and provider
  language into safe work/evidence copy.
- Owner-facing Today links are now sanitized before render:
  - donor `/my/media` asset links are reframed to Studio media details,
  - media workflow job routes are reframed to Studio workflow details,
  - raw Jobs/Admin/Factory/Operations routes are dropped from regular owner
    evidence and source links.
- `GovernanceSectionFrame` now gives the root section an accessible label so
  section-level tests and assistive technology can identify the active
  governance surface.

## Tests

Positive:

- base route renders Today Brief.
- second column renders intent rows.
- selected item renders why/evidence/recommended action/source links.
- person, media, offer, and system source links route to the owning surface.

Negative:

- base route does not render every dashboard bucket as full blocks.
- completed work without owner action is not labeled Decision.
- owner Today copy does not expose raw job ids, logs, provider keys, command
  payloads, or restore target paths.

Edge:

- no evidence renders a first-action brief that routes to Ordo Chat.
- partial loader failure marks limitations while keeping safe evidence.
- selected missing item returns to the brief.

## Non-Goals

- Do not add durable brief storage.
- Do not migrate Studio, Offers, Account, or System.
- Do not expose raw admin diagnostics.

## Closeout Evidence Required

- Today read-model contract.
- Before/after route screenshots.
- Static scan for dashboard/diagnostic leakage.
- Tests and QA pass evidence.

Evidence:

- `docs/_refactor/ordo/evidence/phase-01c3ag-today-brief-and-decision-evidence-index.md`
