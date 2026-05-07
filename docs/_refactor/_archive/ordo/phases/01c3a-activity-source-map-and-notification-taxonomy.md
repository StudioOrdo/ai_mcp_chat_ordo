# Phase 01c3a: Activity Source Map And Notification Taxonomy

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3-authenticated-workspace-tool-rail.md`

## Goal

Define the product and code contract for Ordo activity, notifications, jobs,
workflows, operations, and diagnostics before changing the user dashboard.

This phase exists because the current UI treats jobs and notifications as two
separate icons, while the code already has several durable event sources. We
need one vocabulary before we build the dashboard and activity surfaces.

## Product Rule

Activity is the source of truth. Notifications are only the attention projection
of activity.

Regular users should not need to understand implementation terms such as
`job_events`, `operation_events`, or runtime audit logs. They should see what is
running, what finished, what failed, what needs a decision, and what was
created.

## Current Code Grounding

- `src/core/entities/job.ts`
  - `JobStatus`, `JobEventType`, `JobRequest`, and `JobEvent`.
  - Job events include renderable execution events and audit-only notification
    events.
- `src/lib/jobs/job-renderable-event.ts`
  - Defines audit-only job event types:
    - `notification_sent`,
    - `notification_failed`,
    - `ownership_transferred`.
- `src/lib/jobs/job-publication.ts`
  - Shared publication contract for main chat stream, chat event stream,
    jobs event stream, per-job history, and conversation projector.
- `src/app/api/jobs/events/route.ts`
  - Streams authenticated user job events.
- `src/app/api/chat/events/route.ts`
  - Streams conversation-scoped job events.
- `src/lib/media/workflows/media-workflow-read-model.ts`
  - Provides `CanonicalMediaWorkflowSnapshot`, `linkedJobIds`, `linkedJobs`,
    operation state, and available actions.
- `src/app/api/operations/[operationId]/events/route.ts`
  - Exposes operation events with sequence and limit support.
- `src/frameworks/ui/operations/OperationTimeline.tsx`
  - Existing operation timeline projection.
- `src/lib/jobs/deferred-job-notifications.ts`
  - Browser push dispatcher for terminal job outcomes.
  - This is delivery, not a durable in-app notification inbox.
- `src/components/NotificationFeed.tsx`
  - Current bell popover.
  - Has hardcoded default notifications, referral-derived dynamic
    notifications, local unread state, and no durable read/ack state.
- `src/app/api/notifications/feed/route.ts`
  - Current feed endpoint is referral/admin-referral oriented.
- `src/lib/referrals/referral-milestones.ts`
  - Converts referral milestones to `FeedNotification`.
- `src/core/entities/NotificationChannel.ts`
  - Generic admin/user notification channel shape.
- `src/lib/admin/notifications/**`
  - Admin signal evaluator/dispatcher donor code.
  - Not currently a durable user activity store.
- `src/lib/observability/runtime-audit-log.ts`
  - Raw runtime audit logs for diagnostics.
  - These are not regular user notifications.
- `src/app/api/diagnostics/conversations/[conversationId]/route.ts`
  - Diagnostic bundle can include runtime logs, conversation export, and job
    timelines.

## Target Taxonomy

Use these product-facing buckets:

- `needs_attention`
  - failed jobs,
  - blocked media workflows,
  - failed push notification delivery when it affects the user,
  - operation actions requiring confirmation,
  - system health warnings relevant to the user's role.
- `running`
  - queued/running jobs,
  - running media workflows,
  - running operations that are visible to the current user.
- `completed`
  - succeeded jobs,
  - completed workflows,
  - newly created media/assets,
  - referral milestones.
- `history`
  - acknowledged, canceled, superseded, and low-priority activity.
- `diagnostic`
  - runtime audit logs and diagnostic bundles.
  - Staff/admin only by default.

## Required Work

- [x] Create a written source map in this phase doc or a companion evidence
  file.
- [x] Define the normalized activity fields needed by later phases:
  - `id`,
  - `sourceKind`,
  - `sourceId`,
  - `userId`,
  - `roleVisibility`,
  - `bucket`,
  - `severity`,
  - `title`,
  - `summary`,
  - `statusLabel`,
  - `href`,
  - `primaryAction`,
  - `secondaryActions`,
  - `createdAt`,
  - `updatedAt`,
  - `dedupeKey`.
- [x] Define which current sources can be projected immediately:
  - jobs,
  - media workflows,
  - operation actions/events,
  - referral milestones.
- [x] Define which sources must stay diagnostic/admin-only:
  - runtime audit logs,
  - raw provider logs,
  - route metrics,
  - MCP/native process logs.
- [x] Define the distinction between:
  - durable activity item,
  - attention notification,
  - browser push delivery,
  - raw observability event.
- [x] Decide whether `/jobs` remains a direct technical detail route or becomes
  a filtered activity route in later phases.

## Implemented Artifacts

- `src/lib/activity/activity-taxonomy.ts`
  - Activity buckets, source kinds, severities, source map, normalized contract
    fields, role-visibility helpers, and source status to activity bucket
    helpers.
- `src/lib/activity/index.ts`
  - Public export for activity taxonomy.
- `src/lib/activity/activity-taxonomy.test.ts`
  - Positive, negative, and edge-oriented unit coverage for this phase.
- `docs/_refactor/ordo/evidence/phase-01c3a-activity-source-map.md`
  - Written source map and implementation evidence.

## Implementation Decision

`/jobs` remains a direct technical detail route for now. Phase 01c3e owns the
decision to render it as a single-column filtered work index or redirect it to a
filtered activity route after the activity read model exists.

This phase intentionally does not add the durable activity read model,
receipts, activity API, dashboard, or inbox UI. Those are owned by 01c3b,
01c3c, and 01c3d.

## Positive Tests

- Unit tests prove each known source kind maps to the correct activity bucket.
- Job `queued` and `running` map to `running`.
- Job `failed` and `dead_letter` map to `needs_attention`.
- Media workflow `blocked` maps to `needs_attention`.
- Referral notification milestone maps to `completed` or `needs_attention`
  depending on milestone type.

## Negative Tests

- Audit-only `notification_sent` does not create a duplicate completed job card.
- Raw runtime audit records do not appear in the regular user activity feed.
- Anonymous users cannot receive authenticated activity projections.
- Admin-only signals do not leak into authenticated non-admin activity.

## Edge Tests

- Job with missing conversation context.
- Media workflow with `linkedJobIds` but no loadable linked job snapshots.
- Operation visible to staff/admin but not regular authenticated users.
- Browser push suppressed because web push is unconfigured.

## Cleanup

- Mark current `NotificationFeed` defaults as donor behavior, not final product
  behavior.
- Do not delete donor code in this phase.

## Exit Criteria

- [x] Future phases have one agreed activity vocabulary.
- [x] Notification work is no longer conflated with push delivery.
- [x] Diagnostics are explicitly separate from regular user activity.
