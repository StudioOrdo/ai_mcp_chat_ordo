# Phase 01c3b: Activity Read Model And Receipts

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3a-activity-source-map-and-notification-taxonomy.md`

## Goal

Build the durable read model and receipt overlay that let Ordo show a coherent
user activity feed without copying every source table into a new notification
store.

## Product Rule

The activity feed should be durable, inspectable, and quiet.

Source tables remain authoritative. The activity layer projects source state
into a user-facing shape and stores only per-user receipt state such as read,
acknowledged, dismissed, and pinned.

## Current Code Grounding

- `src/lib/jobs/load-user-jobs-workspace.ts`
  - Current jobs loader pulls `jobs`, `workflows`, one selected job, and its
    history.
  - It has fixed limits and no search/filter/pagination model.
- `src/app/api/jobs/route.ts`
  - Current user jobs API supports `activeOnly` and `limit`.
  - No cursor, search, source type, or bucket filters.
- `src/lib/jobs/user-jobs-workspace.ts`
  - Sorts active jobs before recent jobs.
  - Donor logic for activity sorting.
- `src/core/platform/execution/ExecutionTimelineReader.ts`
  - Durable job, work order, tool, chat turn, and observability timeline reader.
- `src/core/platform/facade/PlatformInteractionFacade.ts`
  - Existing facade for job/work-order interaction projection.
- `src/lib/media/workflows/media-workflow-read-model.ts`
  - Already joins media workflows to linked job snapshots and operation
    actions.
- `src/lib/referrals/referral-analytics.ts`
  - Produces referral notification feed donor items for user scope.
- `src/lib/referrals/admin-referral-analytics.ts`
  - Produces admin-scoped referral notification feed donor items.
- `src/lib/db/tables.ts`
  - Existing durable event tables include:
    - `job_events`,
    - `media_workflow_events`,
    - `operation_events`,
    - `factory_events`,
    - `conversation_events`,
    - `referral_events`.
  - There is no durable in-app notification/read receipt table yet.

## Target Shape

Add a product read model, not another source of truth:

- `src/lib/activity/activity-types.ts`
  - `ActivitySourceKind`,
  - `ActivityBucket`,
  - `ActivitySeverity`,
  - `ActivityItem`,
  - `ActivityReceiptState`,
  - `ActivityQuery`.
- `src/lib/activity/activity-projectors.ts`
  - source-specific projectors:
    - job snapshot to activity,
    - media workflow snapshot to activity,
    - referral feed notification to activity,
    - operation snapshot/action to activity.
- `src/lib/activity/activity-read-model.ts`
  - composes source projectors,
  - sorts and filters,
  - applies receipt overlay,
  - returns pagination metadata.
- `src/adapters/ActivityReceiptDataMapper.ts`
  - stores user-specific receipt state only.
- `src/app/api/activity/route.ts`
  - authenticated list endpoint.
- `src/app/api/activity/[activityId]/receipt/route.ts`
  - mark read, acknowledge, dismiss, pin.

Recommended receipt table:

- `activity_receipts`
  - `id TEXT PRIMARY KEY`
  - `user_id TEXT NOT NULL`
  - `source_kind TEXT NOT NULL`
  - `source_id TEXT NOT NULL`
  - `read_at TEXT DEFAULT NULL`
  - `acknowledged_at TEXT DEFAULT NULL`
  - `dismissed_at TEXT DEFAULT NULL`
  - `pinned_at TEXT DEFAULT NULL`
  - `updated_at TEXT NOT NULL`
  - unique index on `(user_id, source_kind, source_id)`

## Required Work

- [x] Add activity domain types.
- [x] Add activity projection functions with unit tests.
- [x] Add SQLite receipt table migration and data mapper.
- [x] Add activity read model that supports:
  - `bucket`,
  - `sourceKind`,
  - `status`,
  - `q`,
  - `limit`,
  - `cursor` or page/offset.
- [x] Add `/api/activity` list route.
- [x] Add receipt mutation route.
- [x] Keep `/api/jobs` behavior stable until later phases move the UI.
- [x] Ensure activity projection suppresses duplicate linked job rows when a media
  workflow is the higher-level card.
- [x] Ensure receipt state does not mutate source job/workflow/referral rows.

## Implemented Artifacts

- `src/lib/activity/activity-types.ts`
  - Normalized activity item, action, source ref, read query, page metadata,
    receipt state, receipt actions, receipt repository contract, and
    `sourceKind:sourceId` id helpers.
- `src/lib/activity/activity-projectors.ts`
  - Projectors for canonical jobs, media workflows, referral milestone donor
    items, and operation summaries/actions.
- `src/lib/activity/activity-read-model.ts`
  - Composite read model that queries source repositories, suppresses workflow
    linked job duplicates, overlays per-user receipt state, filters, sorts, and
    paginates.
- `src/adapters/ActivityReceiptDataMapper.ts`
  - SQLite receipt repository that stores only user/source receipt state.
- `src/lib/db/tables.ts`
  - Adds `activity_receipts` with unique `(user_id, source_kind, source_id)`
    index and supporting lookup indexes.
- `src/adapters/RepositoryFactory.ts`
  - Wires `getActivityReceiptDataMapper()` and `getActivityReadModel()` from
    existing job, media workflow, referral, and operation read paths.
- `src/app/api/activity/route.ts`
  - Authenticated list endpoint with bucket/source/status/search/page filters.
- `src/app/api/activity/[activityId]/receipt/route.ts`
  - Authenticated receipt mutation endpoint for `mark_read`, `acknowledge`,
    `dismiss`, `pin`, and `unpin`.
- `src/lib/activity/activity-projectors.test.ts`
  - Projection coverage for owner jobs, blocked media workflows, referral
    milestones, operation actions, and system-owned suppression.
- `src/lib/activity/activity-read-model.test.ts`
  - Cross-source read model coverage for sorting, duplicate suppression,
    filtering, pagination, receipt overlay, per-user isolation, and deleted
    source handling.
- `src/adapters/ActivityReceiptDataMapper.test.ts`
  - Schema, uniqueness, upsert, per-user isolation, list, and validation
    coverage.
- `src/app/api/activity/route.test.ts`
  - Auth and filter validation coverage for the list endpoint.
- `src/app/api/activity/[activityId]/receipt/route.test.ts`
  - Auth, id/action validation, mutation, and 404 coverage for receipts.
- `docs/_refactor/ordo/evidence/phase-01c3b-activity-read-model-and-receipts.md`
  - Implementation evidence and verification commands.

## Implementation Decisions

- Activity stays a read model over authoritative sources. The only new durable
  state is receipt state in `activity_receipts`.
- The first API uses page/limit metadata rather than cursor metadata because
  current donor reads (`jobs`, `media_workflows`, referrals, operations) already
  expose bounded list methods. Later UI phases can introduce cursor semantics
  without changing the source projection contract.
- Workflow-linked job snapshots are suppressed when a media workflow owns the
  higher-level activity card. The job detail route remains available by direct
  link until the 01c3e work-index convergence phase.
- Receipt mutations verify the source is still visible to the requesting user
  before writing a receipt. A stale receipt can exist after the source is gone,
  but it will not create a phantom activity card.
- Raw diagnostics, browser push delivery, and existing `NotificationFeed`
  behavior remain outside this phase.

## Positive Tests

- Project jobs and workflows into one sorted activity list.
- Apply read/ack/dismiss receipt state.
- Return `needs_attention` before `running`, then recent completed/history.
- Filter by source kind.
- Filter by bucket.
- Search by title, status label, tool/capability label, and source id.
- Pagination returns stable page metadata.

## Negative Tests

- A user cannot read another user's activity.
- A user cannot mark another user's activity receipt.
- Dismissed items are hidden by default and included only when explicitly
  requested.
- Receipt mutation with an unknown source kind fails validation.

## Edge Tests

- Activity source exists after receipt was created.
- Receipt exists after source was deleted or hidden.
- Multiple source records project to the same dedupe key.
- Workflow linked job snapshot missing.
- Operation action expired between projection and mutation.

## Cleanup

- Do not replace `NotificationFeed` yet.
- Do not replace `/jobs` yet.
- Keep donor APIs stable while the activity API is introduced.

## Exit Criteria

- [x] Ordo has a durable activity read model.
- [x] Read/ack/dismiss/pin state is stored per user.
- [x] Existing jobs/workflows/referrals/operations can be queried through the
  new model.
- [x] Targeted unit/API tests, ESLint, and TypeScript checks pass.
