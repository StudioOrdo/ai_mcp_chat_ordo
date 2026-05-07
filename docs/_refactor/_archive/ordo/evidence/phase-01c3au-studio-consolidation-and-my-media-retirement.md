# Phase 01c3au Evidence: Studio Consolidation And My Media Retirement

Date: 2026-05-07

Status: Implemented

## Governing Product Contract

- Chat remains the operating interface.
- UI surfaces remain the governance layer.
- Studio is the canonical owner workspace for produced work, media, workflows,
  content, campaigns, and jobs-as-work.
- The second column is an evidence/object selector, not a dashboard.
- Base Studio renders a production brief.
- Selected Studio routes render one object and do not begin with global media
  totals, quota, or stored-media cards.
- Raw jobs, logs, providers, payloads, queue internals, and operation
  diagnostics stay in Admin/System.
- `/my/media` is donor/deferred only and not primary owner IA.

## Code Files Changed

- `src/app/my/media/page.tsx`
- `src/app/my/media/page.test.tsx`
- `src/lib/studio/load-studio-workspace.ts`
- `src/lib/studio/load-studio-workspace.test.ts`
- `src/components/studio/StudioWorkspace.tsx`
- `src/components/studio/StudioWorkspace.test.tsx`
- `src/components/media/UserMediaWorkspace.tsx`

## Documentation Files Changed

- `docs/_refactor/ordo/phases/01c3au-studio-consolidation-and-my-media-retirement.md`
- `docs/_refactor/ordo/evidence/phase-01c3au-studio-consolidation-and-my-media-retirement.md`

## Implementation Evidence

`/my/media` now redirects signed-in users to the Studio media selector:

- `/my/media` -> `/studio?kind=media_asset`
- `/my/media?assetId=uf_1` -> `/studio?kind=media_asset&object=media_asset%3Auf_1`

Studio selected detail now rewrites legacy owner donor links back into Studio
selection:

- `/jobs?jobId=job_1` -> `/studio?object=workflow_run%3Ajob%3Ajob_1`
- `/jobs?sourceKind=media_workflow&sourceId=mwf_1` ->
  `/studio?object=workflow_run%3Amedia_workflow%3Amwf_1`
- `/my/media?assetId=uf_audio_1` ->
  `/studio?kind=media_asset&object=media_asset%3Auf_audio_1`

Studio media card summaries now use owner-safe production language. For
example, a generated image attached to a conversation is projected as
`image asset · attached to a conversation` instead of rendering the source type
and retention chain as the row summary.

Studio selected work detail now maps owner status copy to stable product
language:

- `queued` -> `Waiting`
- `running` -> `In motion`
- `succeeded` -> `Ready`
- `failed`/`blocked` -> `Needs attention`

The deferred `UserMediaWorkspace` component remains available as donor/deferred
code and keeps its existing media preview/delete tests, but its reset link now
points back to `/studio?kind=media_asset`.

## QA Pass 1

Commands run:

```bash
npx vitest run src/lib/studio/load-studio-workspace.test.ts src/components/studio/StudioWorkspace.test.tsx src/components/media/UserMediaWorkspace.test.tsx src/lib/media/user-media.test.ts src/lib/jobs/load-user-jobs-workspace.test.ts src/components/jobs/JobsWorkspace.test.tsx src/lib/shell/shell-navigation.test.ts src/app/my/media/page.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/lib/studio/load-studio-workspace.ts src/components/studio/StudioWorkspace.tsx src/components/media/MediaAssetDetail.tsx src/components/media/UserMediaWorkspace.tsx src/lib/media/user-media.ts src/lib/shell/shell-navigation.ts src/app/my/media/page.tsx src/app/my/media/page.test.tsx src/components/studio/StudioWorkspace.test.tsx src/lib/studio/load-studio-workspace.test.ts
rg -n "my/media|My Media|stored media|quota usage|raw job|job id|payload|provider|Factory" src/app src/components src/lib
rg -n "Date\\.now\\(|Math\\.random\\(|toLocaleString\\(|toLocaleDateString\\(" src/lib/studio src/components/studio src/components/media src/lib/media src/components/jobs src/lib/jobs
```

Results:

- Focused tests passed: 8 files, 65 tests.
- Typecheck passed.
- CSS lint passed.
- Focused lint passed.
- Broad diagnostic static scan returned expected matches in admin/system,
  lower-level job/media libraries, tests, and the retained donor route. Focused
  touched-owner scan confirmed no `My Media`, global media quota, stored-media
  card, fake-metric, provider, payload, or raw job copy was introduced into
  Studio selected detail.
- Date/hydration scan returned no matches in touched Studio/media owner files.

Issues found and fixed:

- `UserMediaWorkspace` still had a `/my/media` reset link. It was changed to
  `/studio?kind=media_asset`.

## Visual QA

The local app was reachable, but both `/studio` and `/my/media?assetId=uf_1`
returned `307 Temporary Redirect` to `/install` in this shell context. No
authenticated browser screenshot could be captured here. Closeout uses DOM,
unit, lint, and static evidence.

## QA Pass 2

Commands run:

```bash
npx vitest run src/lib/studio/load-studio-workspace.test.ts src/components/studio/StudioWorkspace.test.tsx src/components/media/UserMediaWorkspace.test.tsx src/lib/media/user-media.test.ts src/lib/jobs/load-user-jobs-workspace.test.ts src/components/jobs/JobsWorkspace.test.tsx src/lib/shell/shell-navigation.test.ts src/app/my/media/page.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/lib/studio/load-studio-workspace.ts src/components/studio/StudioWorkspace.tsx src/components/media/MediaAssetDetail.tsx src/components/media/UserMediaWorkspace.tsx src/lib/media/user-media.ts src/lib/shell/shell-navigation.ts src/app/my/media/page.tsx src/app/my/media/page.test.tsx src/components/studio/StudioWorkspace.test.tsx src/lib/studio/load-studio-workspace.test.ts
rg -n "my/media|My Media|stored media|quota usage|raw job|job id|payload|provider|Factory" src/app src/components src/lib
rg -n "Date\\.now\\(|Math\\.random\\(|toLocaleString\\(|toLocaleDateString\\(" src/lib/studio src/components/studio src/components/media src/lib/media src/components/jobs src/lib/jobs
curl -I --max-time 2 http://localhost:3000/studio
curl -I --max-time 2 'http://localhost:3000/my/media?assetId=uf_1'
```

Results:

- Focused tests passed again: 8 files, 65 tests.
- Typecheck passed again.
- CSS lint passed again.
- Focused lint passed again.
- Broad diagnostic static scan was reviewed again. Remaining matches are outside
  regular owner Studio UI or are the retained donor-route redirect/mapping
  evidence.
- Date/hydration scan returned no matches in touched Studio/media owner files
  again.
- `curl` visual reachability check confirmed the local install redirect blocker.

Issues found and fixed:

- None.
