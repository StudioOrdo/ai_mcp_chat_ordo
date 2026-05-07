# Phase 01c3e Single-Column Work Index And Jobs Convergence

Status: Implemented
Date: 2026-05-04

## Purpose

This evidence file records the implementation of the `/jobs` convergence into a
single-column work index.

The key decision is:

Users manage work, not background-job internals. Jobs remain inspectable for
auditability, retry, cancel, and export, but the default surface now follows the
work stream.

## Code Inspected

- `src/app/jobs/page.tsx`
- `src/app/api/jobs/route.ts`
- `src/lib/jobs/load-user-jobs-workspace.ts`
- `src/components/jobs/JobsWorkspace.tsx`
- `src/components/jobs/JobDetailPanel.tsx`
- `src/components/jobs/JobHistoryTimeline.tsx`
- `src/components/jobs/job-workspace-helpers.ts`
- `src/components/jobs/useJobsEventStream.ts`
- `src/lib/media/workflows/media-workflow-read-model.ts`
- `src/components/activity/ActivityWorkspace.tsx`
- `src/components/activity/ActivityCard.tsx`

## Implemented Artifacts

- `src/lib/jobs/load-user-jobs-workspace.ts`
  - Added `UserJobsWorkspaceQuery` and `UserJobsWorkspacePageInfo`.
  - Added `status`, `bucket`, `sourceKind`, `q`, `page`, `jobId`, and
    `sourceId` normalization.
  - Added user-scoped filtering across canonical job snapshots and media
    workflow snapshots.
  - Added unified work-index pagination while preserving a selected job outside
    the current page.
  - Treats canceled jobs/workflows as history, not running work.
- `src/app/jobs/page.tsx`
  - Passes the full search param map into the work-index loader.
  - Passes query and page info into the client workspace.
- `src/app/api/jobs/route.ts`
  - Preserves the existing compatibility list path for `activeOnly`.
  - Serves the filtered work-index contract for workspace query params so SSE
    fallback reconciliation preserves active filters.
- `src/components/jobs/JobsWorkspace.tsx`
  - Replaced the permanent two-column layout with a single-column work stream.
  - Replaced `Your Jobs` with `Work Index`.
  - Added activity-style search, filter chips, item count, and pagination.
  - Renders workflows and jobs in one ordered list.
  - Renders readable linked-job chips from `workflow.linkedJobs`.
  - Renders unavailable linked-job counts without broken buttons.
  - Keeps selected job detail/timeline inline.
  - Surfaces safe card actions for non-selected jobs.
- `src/components/jobs/JobDetailPanel.tsx`
  - Added embedded mode so selected-job details can live inside the card.
  - Removed letter-spacing utility classes from touched job-detail text.
- `src/components/jobs/JobHistoryTimeline.tsx`
  - Removed letter-spacing utility classes from touched timeline text.
- `src/components/jobs/useJobsEventStream.ts`
  - Added filtered reconciliation query support.

## Verification

Commands run:

```bash
npm test -- --run src/app/api/jobs/route.test.ts src/lib/jobs/load-user-jobs-workspace.test.ts src/components/jobs/JobsWorkspace.test.tsx src/components/jobs/useJobsEventStream.test.tsx src/app/jobs/page.test.tsx
npx eslint src/app/api/jobs/route.ts src/app/api/jobs/route.test.ts src/lib/jobs/load-user-jobs-workspace.ts src/components/jobs/JobsWorkspace.tsx src/components/jobs/JobDetailPanel.tsx src/components/jobs/JobHistoryTimeline.tsx src/components/jobs/useJobsEventStream.ts src/app/jobs/page.tsx src/lib/jobs/load-user-jobs-workspace.test.ts src/components/jobs/JobsWorkspace.test.tsx src/app/jobs/page.test.tsx
npm run typecheck
```

Result:

- 26 targeted Vitest tests passed.
- ESLint passed for touched files.
- TypeScript passed with `tsc --noEmit`.

## QA Follow-Up

QA found one filter-preservation gap after the first implementation pass:

- `useJobsEventStream` carried active work-index filters in the fallback
  reconciliation URL, but `/api/jobs` still ignored those query params.

Fix:

- `/api/jobs` now detects work-index query params and delegates to
  `loadUserJobsWorkspace`.
- Added API route coverage proving filtered work-index reconciliation uses the
  same user-scoped loader instead of the older compatibility interaction list.

Second QA finding:

- Live SSE events could still upsert an out-of-filter job into the client list
  before the next filtered reconciliation. Example: a running job event could
  appear while the user was viewing `bucket=completed`.

Fix:

- `JobsWorkspace` now applies the active work-index query to the visible client
  list after live SSE updates and fallback reconciliation.
- Selected jobs explicitly requested by `jobId` or `sourceId` remain visible so
  deep links still work.
- Added coverage that a running SSE event does not appear in a completed-only
  work-index view.

## Follow-On Boundaries

- 01c3f owns top-rail brand balance and mobile work controls.
- 01c3g owns stale CSS/test cleanup across the full 01c3x shell refactor,
  including any obsolete jobs-grid naming that remains as compatibility
  selectors.
