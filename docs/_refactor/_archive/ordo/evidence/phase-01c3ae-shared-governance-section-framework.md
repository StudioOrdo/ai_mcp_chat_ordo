# Phase 01c3ae Evidence: Shared Governance Section Framework

Status: Implemented

Date: 2026-05-06

## Governing Product Contract

- Chat remains the operating interface.
- UI surfaces remain the governance layer.
- Components render section read models instead of deriving business meaning
  from raw tables, jobs, logs, or provider details.
- Base routes render a section brief.
- Query-selected/detail states render one selected object detail.
- The second column is an evidence/object selector, not a dashboard.

## New Shared Components

- `src/components/governance/GovernanceSectionFrame.tsx`
  - `GovernanceSectionModel<TObject, TSummary>`
  - `SectionBrief`
  - `SectionPermissions`
  - `GovernanceSelectorItem`
  - `GovernanceFilterControl`
  - `GovernanceSectionFrame`
  - `ObjectSelectorRow`
  - `SectionBriefPanel`

## First Migrated Donor

- `src/components/studio/StudioWorkspace.tsx`

Studio now uses the shared governance frame while keeping its existing
`StudioWorkspaceData` read model and `OrdoCard` detail rendering. The selected
Studio object path renders one object detail and no section-wide metric strip
above that selected object.

## Tests Added Or Updated

- `src/components/governance/GovernanceSectionFrame.test.tsx`
- `src/components/studio/StudioWorkspace.test.tsx`

Covered behavior:

- base brief state renders,
- selected detail state renders,
- second column renders search, filters, list, and count footer,
- mobile selected detail renders a back-to-list control,
- missing/unauthorized selection renders quiet copy,
- selector links preserve existing filters/search,
- regular owner selector rows hide diagnostic labels,
- diagnostics render only when the section model allows them.

## QA Pass 1

Commands:

- `npm run test -- src/components/governance/GovernanceSectionFrame.test.tsx src/components/studio/StudioWorkspace.test.tsx src/components/business/BusinessWorkspace.test.tsx src/components/dashboard/UserDashboard.test.tsx src/components/media/UserMediaWorkspace.test.tsx src/components/profile/ProfileSettingsPanel.test.tsx src/components/offers/OfferSurfaces.test.tsx`
- `npm run typecheck`
- `npm run lint -- src/components/governance/GovernanceSectionFrame.tsx src/components/governance/GovernanceSectionFrame.test.tsx src/components/studio/StudioWorkspace.tsx src/components/studio/StudioWorkspace.test.tsx`
- static scan for raw job/log/provider/diagnostic owner-facing language in the
  touched shared and Studio components.

Result:

- Focused section tests passed.
- Typecheck passed.
- Lint passed.
- Static scan found a donor-boundary issue: Studio still attached a
  hidden diagnostic selector label and used `Operation` as owner-facing object
  copy. Fixed by removing the diagnostic label from Studio selector items and
  translating operation objects as `Work`.

## QA Pass 2

Commands:

- `npm run test -- src/components/governance/GovernanceSectionFrame.test.tsx src/components/studio/StudioWorkspace.test.tsx src/components/business/BusinessWorkspace.test.tsx src/components/dashboard/UserDashboard.test.tsx src/components/media/UserMediaWorkspace.test.tsx src/components/profile/ProfileSettingsPanel.test.tsx src/components/offers/OfferSurfaces.test.tsx`
- `npm run typecheck`
- `npm run lint -- src/components/governance/GovernanceSectionFrame.tsx src/components/governance/GovernanceSectionFrame.test.tsx src/components/studio/StudioWorkspace.tsx src/components/studio/StudioWorkspace.test.tsx`
- static scan for raw job/log/provider/diagnostic owner-facing language in
  touched code/docs.

Result:

- Focused section tests passed.
- Typecheck passed.
- Lint passed.
- Static scan initially found only stale diagnostic wording in the test fixture.
  Updated the test fixture to use neutral `Internal route` copy, reran the
  phase tests, lint, typecheck, and scan successfully.

## Remaining Surfaces

- Today: `01c3ag`
- Account/profile: `01c3af`
- Studio media/work consolidation: `01c3ah`
- Offers: `01c3ai`
- System/admin/backups/restore: `01c3ak`
