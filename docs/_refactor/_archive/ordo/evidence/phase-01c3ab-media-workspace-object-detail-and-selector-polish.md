# Phase 01c3ab Evidence: Media Workspace Object Detail And Selector Polish

Date: 2026-05-05

Status: Implemented

## Code Files Changed

- `src/components/media/UserMediaWorkspace.tsx`
- `src/components/media/UserMediaWorkspace.test.tsx`
- `src/components/media/MediaOperationsWorkspace.tsx`
- `src/components/media/MediaOperationsWorkspace.test.tsx`
- `src/app/my/media/page.tsx`
- `tests/browser-ui/media-capacity-quotas.spec.ts`

## Documentation Files Changed

- `docs/_refactor/ordo/phases/01c3ab-media-workspace-object-detail-and-selector-polish.md`
- `docs/_refactor/ordo/reports/2026-05-05-media-workspace-ui-problem-report.md`
- `docs/_refactor/ordo/evidence/phase-01c3ab-media-workspace-object-detail-and-selector-polish.md`

## What Changed

- Added a real `Overview` pseudo-item to the media second column.
- Made Overview the default `/my/media` state.
- Changed the main media surface to render either `Media overview` or exactly
  one selected asset detail.
- Removed the old stacked global heading and summary cards from selected asset
  detail.
- Moved global storage and asset health into the Overview state and compact
  second-column status.
- Collapsed advanced media filters behind a compact `Filter` disclosure.
- Made media rows more compact with a type marker and width-safe filename
  handling.
- Rewrote owner-facing quota and attached-media copy to avoid implementation
  language.
- Renamed the admin media operations capacity heading from `Writable volume
  capacity` to `Storage volume capacity` so static owner-UI scans can run
  mechanically without false positives.
- Updated `/my/media` route metadata from `My Media` to `Media`.

## UX Contract

The final interaction model is:

- second column: page identity, Overview, search, filter access, and asset list;
- main column default: `Media overview`;
- main column selected state: exactly one asset detail;
- Overview and selected asset detail are mutually exclusive.

This keeps chat as the operating interface and the media page as a governance
surface for inspecting evidence.

## QA Pass 1

Commands run:

```bash
npm run test -- src/components/media/UserMediaWorkspace.test.tsx src/app/my/media/page.test.tsx src/lib/media/user-media.test.ts tests/media-architecture-audit.test.ts
npm run typecheck
npx eslint src/components/media/UserMediaWorkspace.tsx src/components/media/UserMediaWorkspace.test.tsx src/app/my/media/page.tsx src/app/my/media/page.test.tsx src/lib/media/user-media.ts src/lib/media/user-media.test.ts
rg -n "raw job|provider log|runtime log|job_events|media_workflow_events|Writable volume capacity|display only|in this phase|phase" src/components/media src/app/my/media src/lib/media/user-media.ts
npx playwright test tests/browser-ui/media-capacity-quotas.spec.ts -g "my media route"
```

Findings and fixes:

- Focused component tests initially still expected the old global heading.
  Updated tests to assert the exact Overview heading and selected-asset state.
- Static scan found owner-forbidden terms in negative assertions and one admin
  media operations heading. Reworked negative assertions to avoid literal
  forbidden copy and renamed the admin heading to `Storage volume capacity`.
- Browser smoke still expected the old heading and implementation-phase quota
  message. Updated it to assert `Governed media`, product-safe storage copy,
  and the mutual exclusion between Overview and selected asset detail.
- Browser smoke needed exact heading matching because `Latest governed media`
  also contained the same words. Added exact matching.

## QA Pass 2

Commands run:

```bash
npm run test -- src/components/media/UserMediaWorkspace.test.tsx src/components/media/MediaOperationsWorkspace.test.tsx src/app/my/media/page.test.tsx src/lib/media/user-media.test.ts tests/media-architecture-audit.test.ts
npm run typecheck
npx eslint src/components/media/UserMediaWorkspace.tsx src/components/media/UserMediaWorkspace.test.tsx src/components/media/MediaOperationsWorkspace.tsx src/components/media/MediaOperationsWorkspace.test.tsx src/app/my/media/page.tsx src/app/my/media/page.test.tsx src/lib/media/user-media.ts src/lib/media/user-media.test.ts tests/browser-ui/media-capacity-quotas.spec.ts
rg -n "raw job|provider log|runtime log|job_events|media_workflow_events|Writable volume capacity|display only|in this phase|phase" src/components/media src/app/my/media src/lib/media/user-media.ts
```

Results:

- Focused Vitest suite passed: 5 files, 14 tests.
- Typecheck passed.
- Focused ESLint passed.
- Static scan returned no matches.
- Browser smoke passed after QA pass 1 fixes.

Known existing warnings:

- Playwright/Next build still reports existing Turbopack broad-file-pattern
  warnings from `src/lib/user-files.ts`,
  `src/lib/appliance/native/native-binary-registry.ts`, and `next.config.ts`.
  These were present before this phase and are not caused by the media UI
  refactor.

## Remaining Risks

- The selected media state is client-local and not yet deep-linked with
  `?asset=<assetId>`.
- The filter disclosure uses native `details`; a future pass can replace it
  with the shared popover/sheet primitive once the shell has one.
