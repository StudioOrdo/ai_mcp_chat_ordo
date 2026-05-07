# Phase 01c3e: Single-Column Work Index And Jobs Convergence

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3d-activity-page-and-attention-inbox.md`

## Goal

Refactor the current jobs page and current-work concepts into a consistent
single-column work index.

The jobs page should stop feeling like a split technical console for regular
users. It should remain inspectable, but use the same card and action language
as Dashboard and Activity.

## Product Rule

Users do not manage "jobs." They manage work.

`/jobs` can remain as a direct technical route, but the primary UX should be a
single-column work index with consistent cards, filters, actions, and detail
links.

## Current Code Grounding

- `src/app/jobs/page.tsx`
  - Redirects anonymous users to `/login`.
  - Loads `loadUserJobsWorkspace`.
  - Renders `JobsWorkspace`.
- `src/lib/jobs/load-user-jobs-workspace.ts`
  - Now owns the `/jobs` work-index query contract for `status`, `bucket`,
    `sourceKind`, `q`, `page`, `jobId`, and `sourceId`.
  - Loads a wider user-scoped candidate set, applies filtered work-index
    projection, paginates the unified job/workflow list, and preserves a
    deep-linked selected job outside the current page.
- `src/components/jobs/JobsWorkspace.tsx`
  - Now renders a one-column `Work Index` surface.
  - Uses shared activity-style search/filter/pagination language.
  - Renders workflow and job records as a single ordered stream.
  - Applies the active work-index query to visible client state after live SSE
    updates so out-of-filter job events do not leak into the current view.
  - Workflow cards render readable linked-job chips where the linked job
    snapshot is available and explicit unavailable counts where it is not.
  - Selected job history is embedded inline rather than in a permanent right
    panel.
- `src/components/jobs/JobDetailPanel.tsx`
  - Reused as an embedded timeline/action region for selected jobs.
- `src/components/jobs/job-workspace-helpers.ts`
  - Donor status labels, action selection, artifact link, clipboard/export
    helpers.
- `src/components/jobs/useJobsEventStream.ts`
  - User job SSE plus periodic reconciliation.
  - Reconciliation now carries the active work-index search/filter/page params.
- `src/app/api/jobs/route.ts`
  - Existing compatibility route remains for `activeOnly`.
  - Work-index query params now return the same filtered workspace contract used
    by the server page loader.
- `src/frameworks/ui/jobs-rail/resolve-jobs-rail.ts`
  - Donor action resolver for open/cancel/retry/diagnose/workflow operation
    actions.
- `src/lib/media/workflows/media-workflow-read-model.ts`
  - `linkedJobs` already exists and should be surfaced.
- `src/components/activity/ActivityWorkspace.tsx`
  - 01c3d durable single-column activity surface with search, filters,
    pagination, inbox/history modes, and receipt controls.
- `src/components/activity/ActivityCard.tsx`
  - Shared activity card already used by Dashboard, Activity, and the inbox.
- `src/components/AttentionInbox.tsx`
  - Bell now reflects durable activity inbox state; `/jobs` should not create a
    second notification concept.
- `src/lib/activity/activity-read-model.ts`
  - 01c3d owns inbox projection and unread receipt state; 01c3e should reuse or
    deliberately extend this projection rather than building a separate jobs
    list contract.

## Target Shape

Shared work index components:

- `WorkIndexPage`
- `WorkIndexToolbar`
- `WorkIndexList`
- `WorkIndexCard`
- `WorkIndexCardActions`
- `WorkIndexInlineTimeline`

The card model should support:

- job,
- media workflow,
- operation,
- referral/business item,
- system item where role-appropriate.

`/jobs` should either:

- redirect to `/activity?sourceKind=job`, or
- render the shared work index with a job/workflow filtered default.

Keep direct job detail routes/query support:

- `/jobs?jobId=<id>`
- `/activity?sourceKind=job&sourceId=<id>`

## Required Work

- [x] Replace permanent two-column layout with one-column cards.
- [x] Add query support:
  - `status`,
  - `bucket`,
  - `sourceKind`,
  - `q`,
  - `page` or `cursor`,
  - `jobId`/`sourceId`.
- [x] Render workflow linked jobs as clickable chips/buttons using `linkedJobs`,
  not only `linkedJobIds.length`.
- [x] Reuse 01c3d activity card/search/filter language where possible so `/jobs`
  feels like a filtered work index rather than a separate console.
- [x] Put job controls on cards where safe:
  - cancel for queued/running,
  - retry for failed/canceled/dead-letter,
  - open conversation,
  - open artifact,
  - copy summary,
  - export log.
- [x] Keep detailed timeline expandable inline or on a focused detail route.
- [x] Reuse action logic from `resolve-jobs-rail.ts` or extract shared action
  descriptors to avoid duplicate job action policy.
- [x] Update `useJobsEventStream` reconciliation to preserve active filters or move
  live reconciliation into the shared activity client.
- [x] Ensure media jobs link back to the media workflow and final asset.

## Positive Tests

- Jobs page renders as one column on desktop and mobile.
- Workflow card renders linked job chips.
- Clicking a linked job opens that job detail.
- Active jobs can be canceled.
- Failed jobs can be retried.
- Completed jobs show artifact/open conversation actions where available.
- Filters/search/pagination preserve selection where possible.

## Negative Tests

- User cannot open another user's job by query param.
- Linked job IDs without readable snapshots do not create broken buttons.
- Audit-only job notification events do not create duplicate job cards.
- Canceled/superseded jobs are not promoted as active work.

## Edge Tests

- Selected job is outside the first page.
- Retry creates a new job id and updates selection.
- EventSource unavailable fallback keeps cards fresh.
- Workflow operation action expires during render.
- Very long job titles on 360px mobile.

## Cleanup

- [x] Remove old two-column-specific copy:
  - "Use the right side for full history and actions."
- [x] Delete stale tests that assert the split-detail panel is always present.
- [x] Preserve useful `JobDetailPanel` internals by extracting timeline/action
  subcomponents where needed.

## Exit Criteria

- [x] Jobs/workflows/activity share a consistent card model.
- [x] `/jobs` no longer feels like a separate product.
- [x] Media workflows expose their linked jobs clearly.

## Implementation Evidence

- Evidence file:
  - `docs/_refactor/ordo/evidence/phase-01c3e-single-column-work-index-and-jobs-convergence.md`
- Implemented code:
  - `src/lib/jobs/load-user-jobs-workspace.ts`
  - `src/app/jobs/page.tsx`
  - `src/app/api/jobs/route.ts`
  - `src/components/jobs/JobsWorkspace.tsx`
  - `src/components/jobs/JobDetailPanel.tsx`
  - `src/components/jobs/JobHistoryTimeline.tsx`
  - `src/components/jobs/useJobsEventStream.ts`
- Updated tests:
  - `src/lib/jobs/load-user-jobs-workspace.test.ts`
  - `src/components/jobs/JobsWorkspace.test.tsx`
  - `src/app/api/jobs/route.test.ts`
  - `src/app/jobs/page.test.tsx`
