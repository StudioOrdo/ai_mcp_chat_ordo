# Phase 01c3b Activity Read Model And Receipts

Status: Implemented
Date: 2026-05-04

## Purpose

This evidence file records the implementation of the activity read model and
receipt overlay introduced after the 01c3a taxonomy work.

The key decision is:

Activity remains projected from source-of-truth tables. Receipt state is the
only new durable state. Ordo does not duplicate every source row into a
notification table.

## Code Inspected

- `src/lib/jobs/job-read-model.ts`
  - Canonical job snapshot contract.
- `src/core/use-cases/JobStatusQuery.ts`
  - User-scoped job read interface.
- `src/lib/media/workflows/media-workflow-read-model.ts`
  - Canonical media workflow snapshots, linked job ids, and linked job
    suppression helpers.
- `src/lib/referrals/referral-analytics.ts`
  - User-scoped referral activity donor feed.
- `src/core/use-cases/operations/OperationRepository.ts`
  - User-scoped operation summaries and available actions.
- `src/lib/db/tables.ts`
  - Existing durable event tables and schema install path.
- `src/app/api/jobs/route.ts`
  - Current user jobs route kept stable for later UI convergence.

## Implemented Artifacts

- `src/lib/activity/activity-types.ts`
  - Normalized activity, query, pagination, receipt, and source id contracts.
- `src/lib/activity/activity-projectors.ts`
  - Source projectors for jobs, media workflows, referrals, and operations.
- `src/lib/activity/activity-read-model.ts`
  - Composite user activity read model.
- `src/adapters/ActivityReceiptDataMapper.ts`
  - SQLite receipt persistence.
- `src/lib/db/tables.ts`
  - `activity_receipts` schema and indexes.
- `src/adapters/RepositoryFactory.ts`
  - Activity read model and receipt mapper composition root.
- `src/app/api/activity/route.ts`
  - Activity list API.
- `src/app/api/activity/[activityId]/receipt/route.ts`
  - Activity receipt mutation API.

## Source Projection Contract

The read model projects these sources:

- jobs from `JobStatusQuery.listUserJobSnapshots`
- media workflows from `MediaWorkflowReadModel.listUserWorkflows`
- referral milestones from `ReferralAnalyticsService.getRecentActivity`
- operations from `OperationRepository.listOperationsForUser`

The read model applies these post-projection rules:

- suppress job cards already represented by a higher-level media workflow
- dedupe by source-specific `dedupeKey`
- overlay user/source receipts from `activity_receipts`
- hide dismissed items unless `includeDismissed` is true
- sort pinned first, then activity bucket priority, then recent update time
- paginate by page/limit metadata

## Receipt Contract

Receipt rows are scoped by:

- `user_id`
- `source_kind`
- `source_id`

Receipt actions are:

- `mark_read`
- `acknowledge`
- `dismiss`
- `pin`
- `unpin`

Receipt mutation first checks that the projected source is still visible to the
requesting user. This prevents users from creating receipts for deleted,
hidden, or other-user activity.

## Verification

Commands run:

```bash
npx vitest run src/lib/activity/activity-taxonomy.test.ts src/lib/activity/activity-projectors.test.ts src/lib/activity/activity-read-model.test.ts src/adapters/ActivityReceiptDataMapper.test.ts src/app/api/activity/route.test.ts 'src/app/api/activity/[activityId]/receipt/route.test.ts'
npx eslint src/lib/activity/activity-taxonomy.ts src/lib/activity/activity-types.ts src/lib/activity/activity-projectors.ts src/lib/activity/activity-read-model.ts src/lib/activity/activity-taxonomy.test.ts src/lib/activity/activity-projectors.test.ts src/lib/activity/activity-read-model.test.ts src/adapters/ActivityReceiptDataMapper.ts src/adapters/ActivityReceiptDataMapper.test.ts src/app/api/activity/route.ts src/app/api/activity/route.test.ts 'src/app/api/activity/[activityId]/receipt/route.ts' 'src/app/api/activity/[activityId]/receipt/route.test.ts'
npm run typecheck
```

Result:

- 48 targeted Vitest tests passed.
- ESLint passed for changed activity/API files.
- TypeScript passed with `tsc --noEmit`.

## QA Recheck

Date: 2026-05-04

Rechecked the phase contract against the implementation:

- The activity layer is a read model over jobs, media workflows, referrals, and
  operations.
- `activity_receipts` stores only per-user source receipt state.
- Receipt mutations verify source visibility before writing.
- Linked media workflow job rows are suppressed.
- Dismissed activity is quiet by default and available when explicitly
  requested.
- Stale receipts do not create phantom activity cards after a source is hidden
  or deleted.

Commands rerun:

```bash
npx vitest run src/lib/activity/activity-taxonomy.test.ts src/lib/activity/activity-projectors.test.ts src/lib/activity/activity-read-model.test.ts src/adapters/ActivityReceiptDataMapper.test.ts src/app/api/activity/route.test.ts 'src/app/api/activity/[activityId]/receipt/route.test.ts'
npx eslint src/lib/activity/activity-taxonomy.ts src/lib/activity/activity-types.ts src/lib/activity/activity-projectors.ts src/lib/activity/activity-read-model.ts src/lib/activity/activity-taxonomy.test.ts src/lib/activity/activity-projectors.test.ts src/lib/activity/activity-read-model.test.ts src/adapters/ActivityReceiptDataMapper.ts src/adapters/ActivityReceiptDataMapper.test.ts src/app/api/activity/route.ts src/app/api/activity/route.test.ts 'src/app/api/activity/[activityId]/receipt/route.ts' 'src/app/api/activity/[activityId]/receipt/route.test.ts' src/adapters/RepositoryFactory.ts
npm run typecheck
```

QA result:

- No implementation gaps found for this phase.
- 48 targeted Vitest tests passed.
- ESLint passed.
- TypeScript passed.

## Follow-On Boundaries

- 01c3c owns the mobile-first user dashboard that consumes this API.
- 01c3d owns the attention inbox and final notification presentation.
- 01c3e owns `/jobs` and current-work convergence into a single-column work
  index.
- Existing `NotificationFeed` and `/api/notifications/feed` remain donor
  behavior until those later phases intentionally replace them.
