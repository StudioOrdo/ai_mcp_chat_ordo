# Phase 01c3ah Evidence: Studio Production, Media, And Work Consolidation

Date: 2026-05-06

Status: Implemented

## Governing Product Contract

- Chat remains the operating interface.
- UI surfaces remain the governance layer.
- Studio is the canonical production surface for work Ordo produces or is
  producing.
- The Studio second column is an evidence/object selector, not a dashboard.
- Base `/studio` renders the Production Brief.
- Selected Studio object details render one object and do not start with global
  section totals.
- Regular owner Studio UI must not expose raw logs, provider details, raw job
  ids, or donor queue management.

## Code Files Changed

- `src/components/media/MediaAssetDetail.tsx`
- `src/components/media/MediaAssetDetail.test.tsx`
- `src/components/media/UserMediaWorkspace.tsx`
- `src/components/studio/StudioWorkspace.tsx`
- `src/components/studio/StudioWorkspace.test.tsx`
- `src/lib/media/user-media.ts`
- `src/lib/studio/load-studio-workspace.ts`
- `src/lib/studio/load-studio-workspace.test.ts`
- `src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts`

## Documentation Files Changed

- `docs/_refactor/ordo/phases/01c3ah-studio-production-media-work-consolidation.md`
- `docs/_refactor/ordo/evidence/phase-01c3ah-studio-production-media-work-consolidation.md`

## What Changed

- Added a reusable `MediaAssetDetail` component for media preview/player,
  metadata facts, related evidence links, and retention/delete behavior.
- Reused the extracted media detail component from `/my/media`, preserving the
  donor route without keeping media governance isolated there.
- Added `projectUserFileToUserMediaItem` so Studio and `/my/media` share the
  same user-file-to-media-object projection.
- Extended the Studio read model with `selectedMediaItem`.
- Reworked `/studio` base copy from `Production workspace` to
  `Production Brief`.
- Reworked selected media detail in Studio so one selected media asset renders:
  preview/player, file facts, retention state, and related evidence links.
- Reworked selected workflow/job-like Studio detail so one work object renders
  safe status, related outputs, evidence, and owner-safe source links.
- Filtered raw `/jobs` and `/my/media` links from owner-facing Studio detail
  actions.
- Reframed job-backed media/work evidence as `Producing work` without showing
  raw job ids in regular owner UI.
- Updated stale product-kernel navigation tests so Ordo Chat remains the first
  owner rail surface and `My media` remains out of account navigation.

## Studio Read Model Contract

- `loadStudioWorkspace` still collects jobs, workflows, user files, content,
  and campaigns into a unified Studio object stream.
- User file cards are still projected through the asset catalog, then through
  `projectAssetCatalogEntryToOrdoCard`.
- User file detail data is projected through `projectUserFileToUserMediaItem`.
- `selectedCard` identifies the selected Studio object.
- `selectedMediaItem` is populated only when the selected object is a user-file
  media asset available to the owner.
- Missing selected object queries render the base Production Brief instead of a
  dead detail panel.

## Media Component Extraction

- Extracted from `UserMediaWorkspace.tsx` into `MediaAssetDetail.tsx`:
  - byte/date/duration/percent formatting helpers,
  - attachment label helper,
  - image/video/audio preview,
  - chart/graph/document data preview,
  - unsupported asset fallback action,
  - metadata fact grid,
  - attached media lock copy,
  - delete action for unattached media,
  - related evidence link list.

## Route And Mobile Evidence

- `/studio` uses `GovernanceSectionFrame` and retains shared list/detail mobile
  behavior through `data-governance-mobile-state`.
- Selected media uses route-selected Studio state through the `object` query
  parameter.
- `/my/media` remains available as a compatibility/donor route, but the normal
  account menu does not expose `My media`.
- Selected media detail does not render global quota/storage totals above the
  asset detail.

## QA Pass 1

Commands run:

```bash
npm test -- src/components/studio/StudioWorkspace.test.tsx src/lib/studio/load-studio-workspace.test.ts src/components/media/UserMediaWorkspace.test.tsx src/components/media/MediaAssetDetail.test.tsx src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.test.ts src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts
npm run typecheck
npm run lint -- src/components/studio/StudioWorkspace.tsx src/components/studio/StudioWorkspace.test.tsx src/lib/studio/load-studio-workspace.ts src/lib/studio/load-studio-workspace.test.ts src/components/media/MediaAssetDetail.tsx src/components/media/MediaAssetDetail.test.tsx src/components/media/UserMediaWorkspace.tsx src/lib/media/user-media.ts src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts
```

Results:

- Focused phase tests passed after fixes: 7 files, 47 tests.
- Typecheck passed.
- Focused lint passed.

Issues found and fixed:

- `StudioWorkspace.test.tsx` still treated all selected work actions as raw
  diagnostics. Fixed the expectation to allow safe `/studio/workflows/...`
  links while still rejecting `/jobs` links.
- `solopreneur-operating-loop-closeout.test.ts` was stale after prior shell
  work. Fixed expected owner rail ids/labels to include `Ordo Chat` first and
  fixed account/admin rail expectations so `My media` remains out of account
  navigation.

## QA Pass 2

Commands run:

```bash
npm test -- src/components/studio/StudioWorkspace.test.tsx src/lib/studio/load-studio-workspace.test.ts src/components/media/UserMediaWorkspace.test.tsx src/components/media/MediaAssetDetail.test.tsx src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.test.ts src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts
npm run typecheck
npm run lint -- src/components/studio/StudioWorkspace.tsx src/components/studio/StudioWorkspace.test.tsx src/lib/studio/load-studio-workspace.ts src/lib/studio/load-studio-workspace.test.ts src/components/media/MediaAssetDetail.tsx src/components/media/MediaAssetDetail.test.tsx src/components/media/UserMediaWorkspace.tsx src/lib/media/user-media.ts src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts
rg -n "My media|my-media|/my/media" src/components/AccountMenu.tsx src/lib/shell/shell-navigation.ts src/components/studio/StudioWorkspace.tsx src/lib/studio/load-studio-workspace.ts src/components/media/UserMediaWorkspace.tsx src/components/media/MediaAssetDetail.tsx
rg -n "provider|logs?|job_|/jobs|deferred|diagnosticHref|toolName" src/components/studio/StudioWorkspace.tsx src/components/media/MediaAssetDetail.tsx src/lib/studio/load-studio-workspace.ts
```

Results:

- Focused phase tests passed: 7 files, 47 tests.
- Typecheck passed.
- Focused lint passed.
- `My media` scan found only:
  - donor route definition in `shell-navigation.ts`,
  - `/my/media` donor reset link in the compatibility page,
  - Studio guard code that filters `/my/media` from owner detail actions.
- Raw diagnostic scan found only:
  - Studio guard code filtering `/jobs`,
  - internal import/projector names in the Studio read model,
  - source-kind mapping names not rendered as raw owner copy.

Issues found and fixed:

- QA pass 2 found no new implementation issues.

## Revalidation Pass

Date: 2026-05-06

Purpose:

- Re-ran the phase after adjacent Today/read-model work to verify Studio still
  owns media/work governance and that `/my/media` remains a donor surface.
- Verified no additional code changes were needed for the current phase.

Commands run:

```bash
npm test -- src/components/studio/StudioWorkspace.test.tsx src/lib/studio/load-studio-workspace.test.ts src/components/media/UserMediaWorkspace.test.tsx src/components/media/MediaAssetDetail.test.tsx src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.test.ts src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts
npm run typecheck
npm run lint -- src/components/studio/StudioWorkspace.tsx src/components/studio/StudioWorkspace.test.tsx src/lib/studio/load-studio-workspace.ts src/lib/studio/load-studio-workspace.test.ts src/components/media/MediaAssetDetail.tsx src/components/media/MediaAssetDetail.test.tsx src/components/media/UserMediaWorkspace.tsx src/components/media/UserMediaWorkspace.test.tsx src/lib/media/user-media.ts src/components/AccountMenu.tsx src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.ts src/lib/shell/shell-navigation.test.ts src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts
rg -n "My media|my-media|/my/media" src/components/AccountMenu.tsx src/components/studio/StudioWorkspace.tsx src/lib/studio/load-studio-workspace.ts src/components/media/UserMediaWorkspace.tsx src/components/media/MediaAssetDetail.tsx src/lib/shell/shell-navigation.ts
rg -n -P "provider|logs?|job_(?!event\\b)[0-9A-Za-z-]+|/jobs\\?|href=\\\"/jobs|diagnosticHref|toolName|raw job|raw log" src/components/studio/StudioWorkspace.tsx src/components/media/MediaAssetDetail.tsx src/lib/studio/load-studio-workspace.ts
```

Results:

- Focused phase tests passed: 7 files, 47 tests.
- Typecheck passed.
- Focused lint passed.
- `My media` scan found only the donor route definition, compatibility reset
  link, and Studio guard code that filters donor routes from owner detail
  actions.
- Raw diagnostics scan found only internal projector/source names and Studio
  guard logic, not owner-facing raw copy.

Issues found and fixed:

- No new implementation issues were found during this revalidation pass.

## Remaining Risks

- Studio still uses deterministic, request-time read models. Durable
  background-generated Production Brief storage is deferred to the later brief
  phases.
- Blog assets are still represented through content/campaign objects; this pass
  only adds direct selected-media detail for user-file media assets.
- Browser screenshots were not newly captured in this pass; route/mobile
  behavior is covered by shared governance-frame state attributes and focused
  component tests.
