# Phase 01c3a Activity Source Map

Status: Implemented
Date: 2026-05-04

## Purpose

This evidence file records the current code grounding for Ordo's activity and
notification taxonomy.

The key decision is:

Activity is the durable user-facing source of truth. Notifications are only an
attention projection of activity. Browser push is only a delivery channel. Raw
observability remains diagnostic unless it is intentionally projected through a
role-gated activity source.

## Code Inspected

- `src/core/entities/job.ts`
  - Source of `JobStatus`, `JobEventType`, `JobRequest`, and `JobEvent`.
- `src/lib/jobs/job-renderable-event.ts`
  - Existing audit-only event policy for `notification_sent`,
    `notification_failed`, and `ownership_transferred`.
- `src/lib/jobs/job-publication.ts`
  - Existing fanout path for chat stream, job stream, job history, and
    conversation projection.
- `src/lib/jobs/deferred-job-notifications.ts`
  - Browser push delivery channel for terminal job events.
- `src/lib/media/workflows/types.ts`
  - Source of `MediaWorkflowStatus` and media workflow source shape.
- `src/lib/media/workflows/media-workflow-read-model.ts`
  - Existing canonical workflow read model with linked jobs/actions.
- `src/core/entities/operation.ts`
  - Source of `OperationStatus`, `OperationVisibility`, operation actions, and
    operation events.
- `src/app/api/operations/[operationId]/events/route.ts`
  - Existing operation event stream.
- `src/lib/referrals/referral-milestones.ts`
  - Source of referral milestone projection and current notification donor
    logic.
- `src/lib/notifications/feed-notification.ts`
  - Current minimal notification DTO.
- `src/components/NotificationFeed.tsx`
  - Current bell UI; contains hardcoded defaults and local unread state.
- `src/app/api/notifications/feed/route.ts`
  - Current notification feed route; referral/admin-referral oriented.
- `src/lib/observability/runtime-audit-log.ts`
  - Raw diagnostic log source.
- `src/app/api/diagnostics/conversations/[conversationId]/route.ts`
  - Diagnostic bundle source for staff/admin review.

## Implemented Artifacts

- `src/lib/activity/activity-taxonomy.ts`
  - Activity buckets, source kinds, severities, normalized field names, source
    map, role visibility policy, and status-to-bucket helpers.
- `src/lib/activity/index.ts`
  - Public export for the activity taxonomy module.
- `src/lib/activity/activity-taxonomy.test.ts`
  - Unit tests for source map completeness, job mapping, workflow mapping,
    operation mapping, referral mapping, diagnostic suppression, push delivery
    separation, and audit-only job event suppression.

## Source Map

| Source Kind | Current Source Of Truth | Projection Mode | Default Visibility | Notes |
| --- | --- | --- | --- | --- |
| `job` | `jobs`, `job_events` | `projectable` | signed-in users | Primary durable execution record. |
| `job_event` | `job_events` | `projectable` | signed-in users | Renderable events enrich job cards; audit-only notification events are suppressed. |
| `media_workflow` | `media_workflows`, `media_workflow_steps`, `media_workflow_events` | `projectable` | signed-in users | Higher-level media work source that should own linked job projection when possible. |
| `operation` | `operations`, `operation_actions`, `operation_artifacts` | `projectable` | visibility-dependent | Governs confirmations, risk, artifacts, and complex work. |
| `operation_event` | `operation_events` | `projectable` | visibility-dependent | Timeline detail, not a separate inbox by default. |
| `referral_milestone` | `referrals`, `referral_events` | `projectable` | signed-in users | Business-loop and QR/referral progress source. |
| `browser_push_delivery` | `push_subscriptions`, `user_preferences`, job terminal events | `delivery_only` | signed-in users | Not durable activity unless a failure is explicitly user-actionable. |
| `runtime_audit_log` | runtime audit logs | `diagnostic_only` | staff/admin | Never regular user activity. |
| `provider_log` | provider/runtime logs | `diagnostic_only` | staff/admin | Diagnostic only. |
| `route_metric` | route metrics/structured logs | `diagnostic_only` | staff/admin | Diagnostic only. |
| `mcp_process_log` | MCP/native process logs | `diagnostic_only` | staff/admin | Diagnostic only. |
| `admin_signal` | admin notification evaluators/analytics | `admin_only` | staff/admin | Must be intentionally projected before regular users can see it. |

## Bucket Rules

- Jobs:
  - `queued`, `running` -> `running`
  - `succeeded` -> `completed`
  - `failed`, `dead_letter` -> `needs_attention`
  - `canceled` -> `history`
- Job events:
  - renderable progress events -> `running`
  - result events -> `completed`
  - failed/retry exhausted events -> `needs_attention`
  - audit-only notification/ownership events -> suppressed
- Media workflows:
  - `queued`, `running` -> `running`
  - `blocked`, `failed` -> `needs_attention`
  - `succeeded` -> `completed`
  - `canceled` -> `history`
- Operations:
  - `awaiting_confirmation`, `blocked`, `failed` -> `needs_attention`
  - enabled confirmation action -> `needs_attention`
  - `queued`, `running` -> `running`
  - `succeeded` -> `completed`
  - `draft`, `cancelled`, `expired` -> `history`
- Referral milestones:
  - `credit_pending_review` -> `needs_attention`
  - `credit_state_changed` -> `history`
  - all other current milestones -> `completed`

## Normalized Activity Fields

Later phases must project source rows into these fields:

- `id`
- `sourceKind`
- `sourceId`
- `userId`
- `roleVisibility`
- `bucket`
- `severity`
- `title`
- `summary`
- `statusLabel`
- `href`
- `primaryAction`
- `secondaryActions`
- `createdAt`
- `updatedAt`
- `dedupeKey`

## Boundary Decisions

- `/jobs` remains available as a direct technical route until 01c3e decides
  whether to render a filtered work index or redirect to filtered activity.
- `NotificationFeed` is donor UI until 01c3d. The hardcoded default
  notifications are not part of the final product contract.
- Browser push failures are delivery facts. They become user activity only when
  the user can take action on them.
- Runtime/provider/MCP/route diagnostics are staff/admin-only unless a future
  phase intentionally projects a role-safe activity item.
