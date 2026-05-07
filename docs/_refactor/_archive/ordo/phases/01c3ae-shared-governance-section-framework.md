# Phase 01c3ae: Shared Governance Section Framework

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3ad-chat-first-shell-grid-and-mobile-menu.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_refactor/planning/02-global-section-brief-and-second-column-pattern.md`
- `docs/_refactor/planning/07-clean-architecture-and-shared-components.md`

Blocks:

- `01c3af-account-user-info-referrals-preferences.md`
- `01c3ag-today-brief-and-decision-evidence-index.md`
- `01c3ah-studio-production-media-work-consolidation.md`
- `01c3ai-offers-brief-selector-and-detail-governance.md`
- `01c3ak-system-admin-jobs-backups-restore-sections.md`

## Goal

Extract the shared authenticated section pattern so each surface does not build
its own shell, selector, filter, brief, and mobile drill-in behavior.

The target pattern is:

```text
Left rail | Second-column evidence index | Main pane
```

Base route renders a section brief. Query-selected route renders one selected
object detail.

## Current Code Grounding

Donor implementations:

- `src/components/business/BusinessWorkspace.tsx` remains the strongest People
  donor for relationship selection and detail behavior.
- `src/components/studio/StudioWorkspace.tsx` was migrated in this phase as the
  first donor surface proving the shared governance section frame.
- `src/components/dashboard/UserDashboard.tsx`
- `src/components/media/UserMediaWorkspace.tsx`
- `src/components/profile/ProfileSettingsPanel.tsx`
- `src/app/admin/page.tsx`
- `src/components/offers/**`
- `src/app/styles/shell.css`

Object/card foundations:

- `src/components/ordo-cards/OrdoCard.tsx`
- `src/lib/ordo-cards/**`
- `src/core/entities/ordo-object.ts`

## Required Work

Implemented shared primitives in
`src/components/governance/GovernanceSectionFrame.tsx` for:

- governance section layout,
- second-column selector,
- second-column search field,
- filter icon/sheet,
- compact overview tile,
- object selector row,
- base section brief panel,
- selected object detail slot,
- mobile back-to-list control,
- pagination/count footer.

Read-model contract:

```ts
interface GovernanceSectionModel<TObject, TSummary> {
  sectionId: string;
  sectionTitle: string;
  brief: SectionBrief | null;
  summary: TSummary;
  objects: TObject[];
  selectedObject: TObject | null;
  permissions: SectionPermissions;
}
```

Implementation rules:

- React components render read models, not raw tables.
- Section-wide totals do not appear above selected object detail.
- Second column is a selector/evidence index, not a dashboard.
- Mobile list and detail are separate states.

Studio now passes a `GovernanceSectionModel<OrdoCard, StudioWorkspaceSummary>`
to the shared frame. The frame owns list/detail mobile state, search/filter
rendering, selector row structure, missing-selection fallback, and diagnostic
label gating. Studio keeps its existing read model loader and existing OrdoCard
detail rendering.

## Tests

Positive:

- shared layout renders base brief state.
- shared layout renders selected detail state.
- second column renders search/filter/list/count.
- mobile selected detail renders a back-to-list control.

Negative:

- selected detail does not render section-wide metric cards above the object.
- owner UI does not expose raw diagnostic labels through shared components.

Edge:

- no selected object renders section brief.
- missing/unauthorized selected object returns to brief with quiet copy.
- query params preserve filters when selecting an object.

## Non-Goals

- Do not migrate every section in this phase.
- Do not create durable brief storage yet.
- Do not redesign card contents beyond the shared frame.

## Closeout Evidence Required

- New/extracted component list.
- First migrated donor surface proof.
- Component and route tests.
- Remaining sections still needing migration.

## Implementation Evidence

- Added `src/components/governance/GovernanceSectionFrame.tsx`.
- Added `src/components/governance/GovernanceSectionFrame.test.tsx`.
- Migrated `src/components/studio/StudioWorkspace.tsx` to use the shared frame.
- Studio selected object detail still renders one object and does not render
  section-wide summary metrics above it.
- Shared component tests cover base brief state, selected detail state,
  search/filter/list/count behavior, mobile back-to-list, missing selection,
  filter-preserving selector links, and diagnostic label gating.

## Remaining Migration Surfaces

- Today dashboard: still has section-specific brief/list logic and should move
  to this frame in `01c3ag`.
- Account/profile: has compatible behavior but remains client-specific for
  editable account forms and should migrate carefully in `01c3af`.
- Media workspace: still has a bespoke selector/detail split and should merge
  into Studio object detail work in `01c3ah`.
- Offers: still needs offer read model and selector/detail migration in
  `01c3ai`.
- System/Admin: still needs section selector/detail convergence, backups, and
  restore sections in `01c3ak`.
