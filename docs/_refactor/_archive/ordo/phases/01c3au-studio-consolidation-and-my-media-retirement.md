# Phase 01c3au: Studio Consolidation And My Media Retirement

Status: Implemented

Parent package:

- `02-ui-surface-realignment/09-implementation-phase-plan.md`

## Goal

Make Studio the canonical owner surface for all work Ordo produces, including
media, content, workflows, campaigns, and jobs-as-work. Retire `/my/media` from
primary IA by moving any necessary media selection/playback affordances into
Studio.

## Governing Docs

- `docs/_refactor/ordo/letters/refactor1.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/08-studio-jobs-and-background-briefs.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/02-shared-surface-frame-contract.md`

## Current Code Grounding

Code anchors:

- `src/app/studio/page.tsx`
- `src/lib/studio/load-studio-workspace.ts`
- `src/components/studio/StudioWorkspace.tsx`
- `src/app/studio/media/[assetId]/page.tsx`
- `src/components/media/MediaAssetDetail.tsx`
- `src/app/my/media/page.tsx`
- `src/components/media/UserMediaWorkspace.tsx`
- `src/lib/media/user-media.ts`
- `src/app/jobs/page.tsx`
- `src/lib/jobs/load-user-jobs-workspace.ts`
- `src/components/jobs/JobsWorkspace.tsx`
- `src/lib/shell/shell-navigation.ts`

## Verified Current State

- Studio already merges workflow, job, media, content, and campaign objects.
- Studio already uses `GovernanceSectionFrame`.
- Studio can render selected media detail.
- `/my/media` has a separate media selector/detail frame and is a donor route.
- `/jobs` exists as owner-accessible job workspace but should not be primary
  owner IA.
- Implemented pass verified Studio can rewrite legacy `/jobs` and `/my/media`
  links back into Studio object selection, preserving owner-safe source paths
  without exposing raw diagnostic routes in the selected owner detail.
- Implemented pass verified direct `/my/media` requests now redirect to the
  Studio media selector, preserving selected asset intent when `assetId`,
  `id`, or `object` is present.

## Target Behavior

- Studio second column selects work/media/content/campaign objects.
- Studio selected detail shows one object and type-appropriate controls.
- Media playback/preview lives in Studio detail.
- `/my/media` is no longer linked from account menu or owner rail and should
  redirect or remain hidden donor after parity.
- Raw jobs stay admin/system diagnostics; owner sees jobs as work.

## Implementation Steps

1. Compare `/my/media` functionality against Studio media detail.
2. Move any missing owner-safe media preview/playback/filter affordances into
   Studio.
3. Ensure selected media detail does not render global media totals above it.
4. Ensure Studio work objects link to provenance/source refs.
5. Remove or redirect `/my/media` after parity tests pass.
6. Keep `/jobs` hidden from owner primary nav and surfaced through Studio/System.
7. Update docs/evidence.

## Positive Tests

- Studio selector includes media, workflow, content, and campaign objects.
- Selecting a media asset renders playback/preview and metadata in Studio.
- Studio base route renders production brief/overview.
- `/my/media` is absent from account menu and owner rail.
- Admin System still exposes raw jobs where authorized.

## Negative Tests

- Selected media detail does not begin with global quota/stored-media totals.
- Owner Studio does not show raw job ids as primary copy.
- Account menu does not show My Media.
- `/my/media` does not remain the canonical media workspace.

## Edge Tests

- Media with no associated workflow still renders limited provenance.
- Workflow with no output still renders work state.
- Empty Studio renders honest limited/empty state.
- Direct `/my/media` request redirects safely or renders hidden donor state as
  specified by implementation.
- Admin job detail remains accessible to admin after owner job hiding.

## Acceptance Criteria

- Studio is the owner production workspace.
- Media inspection parity exists in Studio.
- `/my/media` is retired from primary IA.
- Jobs are translated to owner-safe work in Studio and raw diagnostics in
  Admin/System.

## Non-Goals

- No destructive media policy change.
- No new media generation workflow.
- No admin job redesign.
- No broad operations UI work.

## Required Commands

```bash
npx vitest run src/lib/studio/load-studio-workspace.test.ts src/components/studio/StudioWorkspace.test.tsx src/components/media/UserMediaWorkspace.test.tsx src/lib/media/user-media.test.ts src/lib/jobs/load-user-jobs-workspace.test.ts src/components/jobs/JobsWorkspace.test.tsx src/lib/shell/shell-navigation.test.ts
npm run typecheck
npm run lint:css
npm run lint -- src/lib/studio/load-studio-workspace.ts src/components/studio/StudioWorkspace.tsx src/components/media/MediaAssetDetail.tsx src/components/media/UserMediaWorkspace.tsx src/lib/media/user-media.ts src/lib/shell/shell-navigation.ts
```

## Static Scans

```bash
rg -n "my/media|My Media|stored media|quota usage|raw job|job id|payload|provider|Factory" src/app src/components src/lib
```

## Closeout Evidence Required

- Studio desktop/mobile screenshots for base and selected media detail.
- Route/nav evidence proving `/my/media` is no longer primary.
- Test output for Studio, media, jobs, and shell nav.

Evidence:

- `docs/_refactor/ordo/evidence/phase-01c3au-studio-consolidation-and-my-media-retirement.md`

Implemented changes:

- `/my/media` now redirects signed-in users to `/studio?kind=media_asset`,
  preserving media selection as `object=media_asset:<assetId>` when direct
  donor links include an asset id.
- Studio media cards now use owner-safe summaries such as
  `image asset · attached to a conversation` instead of implementation-source
  chains.
- Studio selected work/media details rewrite legacy `/jobs` and `/my/media`
  source/action links into Studio object-selection links.
- Studio owner detail status labels now use owner-safe labels such as
  `Waiting`, `In motion`, `Ready`, and `Needs attention`.
- The deferred `UserMediaWorkspace` donor component no longer emits a
  `/my/media` reset link; its reset target points to the Studio media selector.

QA summary:

- QA pass 1 found one donor-component IA leak: a `/my/media` reset link inside
  `UserMediaWorkspace`. It was replaced with `/studio?kind=media_asset`.
- QA pass 2 repeated the focused tests, typecheck, CSS lint, focused lint, and
  static scans. No additional fixes were required.
- Visual browser QA could not be captured because the local app redirected
  `/studio` and `/my/media` to `/install` in this shell context. DOM, unit, lint,
  and static evidence were used for closeout.
