# Phase 01c3ah: Studio Production, Media, And Work Consolidation

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3ae-shared-governance-section-framework.md`
- `01c3ab-media-workspace-object-detail-and-selector-polish.md`
- `docs/_refactor/planning/03-studio-media-jobs-consolidation.md`

Blocks:

- `01c3al-cross-section-object-detail-provenance-actions.md`

## Goal

Make Studio the canonical production surface for everything Ordo produces or is
producing:

- work,
- media,
- content,
- workflows,
- jobs-as-work,
- campaigns,
- related outputs.

`/my/media` remains a compatibility/donor route, but normal owner operation
should happen through Studio.

## Current Code Grounding

- `src/app/studio/page.tsx`
- `src/components/studio/StudioWorkspace.tsx`
- `src/lib/studio/load-studio-workspace.ts`
- `src/app/my/media/page.tsx`
- `src/components/media/UserMediaWorkspace.tsx`
- `src/lib/media/user-media.ts`
- `src/lib/media/workflows/media-workflow-read-model.ts`
- `src/lib/admin/jobs/admin-jobs.ts`
- `src/components/ordo-cards/OrdoCard.tsx`
- `src/lib/ordo-cards/**`

## Required Work

1. Use the shared governance section layout.
2. Base `/studio` renders Production Brief.
3. Second column lists all Studio objects:
   - all work,
   - workflows,
   - media,
   - content,
   - campaigns,
   - attention/in motion/produced/history filters.
4. Selecting media renders one media asset detail with preview/player.
5. Selecting workflow/job renders one work detail with related outputs.
6. Media details link to related conversation, workflow, job, content, or
   campaign where data exists.
7. Move media preview, metadata, and retention logic into reusable components.
8. Remove My media from normal account navigation if still present.
9. Keep raw job/provider/log details out of owner Studio UI; admin detail links
   may exist for authorized users.

## Implementation Notes

- `/studio` continues to use `GovernanceSectionFrame` as the shared section
  shell.
- The base route now renders `Production Brief` as the Studio section brief,
  with global production totals confined to the base route.
- `loadStudioWorkspace` now returns `selectedMediaItem` for selected media
  assets so Studio can render media details without sending the owner to
  `/my/media`.
- `projectUserFileToUserMediaItem` is now a shared user-file projector used by
  both `/my/media` and Studio.
- Media preview, facts, related evidence, and retention/delete behavior were
  extracted to `src/components/media/MediaAssetDetail.tsx`.
- Selected media in Studio renders one object detail with preview/player,
  created/size/dimensions/duration facts, safe retention state, and related
  evidence links.
- Selected workflow/job-like work in Studio renders a product-safe work detail:
  status, update time, related outputs, evidence, and only owner-safe links.
- Raw `/jobs` and `/my/media` donor links are filtered from selected Studio
  owner detail actions; job-related evidence is reframed as `Producing work`
  without exposing raw job ids.
- Missing selected Studio object queries fall back to `Production Brief`.
- Account navigation remains collapsed to user info, referrals, and
  preferences; `My media` remains only as a donor route definition and direct
  compatibility route.
- Revalidation on 2026-05-06 confirmed the current implementation still
  satisfies the phase after adjacent Today/read-model work. No additional code
  changes were required in this revalidation pass.

## Tests

Positive:

- base Studio renders Production Brief.
- Studio second column can filter to media and work.
- selected media renders preview/player and facts.
- selected workflow/job renders work status and related outputs.
- related conversation/workflow/job links appear when source data exists.

Negative:

- selected media does not show global storage/quota totals at the top.
- account menu does not show My media.
- regular owner Studio does not expose raw logs/provider details as primary
  copy.

Edge:

- unsupported media renders fallback preview/open action.
- media without related job still shows safe source/retention state.
- missing selected object falls back to Production Brief.

## Non-Goals

- Do not delete `/my/media` in this phase.
- Do not build full campaign analytics.
- Do not implement durable brief storage.

## Closeout Evidence Required

- Studio read-model changes.
- Media component extraction list.
- Route/mobile evidence.
- Static scan results for My media and raw diagnostics.

Evidence:

- `docs/_refactor/ordo/evidence/phase-01c3ah-studio-production-media-work-consolidation.md`
