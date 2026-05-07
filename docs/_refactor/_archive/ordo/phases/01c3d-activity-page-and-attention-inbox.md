# Phase 01c3d: Activity Page And Attention Inbox

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3c-mobile-first-user-dashboard.md`

## Goal

Create the full activity ledger and convert the bell into a real attention
inbox backed by durable activity and receipts.

## Product Rule

The bell is not navigation. The bell is "what needs my attention now."

The Activity page is the full inspectable ledger. The bell is a compact inbox
projection.

## Current Code Grounding

- `src/app/activity/page.tsx`
  - Minimal authenticated activity ledger created in 01c3c so dashboard
    view-all links are not dead.
  - It supports basic bucket/source filters and page navigation.
  - It does not yet provide search, receipt actions, inbox behavior, or bell
    replacement.
- `src/components/NotificationFeed.tsx`
  - Current bell popover.
  - Uses hardcoded defaults plus `/api/notifications/feed`.
  - Local unread state only.
- `src/app/api/notifications/feed/route.ts`
  - Current feed endpoint is referral/admin-referral specific.
- `src/lib/notifications/feed-notification.ts`
  - Minimal DTO: `id`, `title`, `body`, `href`, `scope`, `unread`,
    `createdAt`.
- `src/lib/referrals/referral-milestones.ts`
  - Donor projection from referral milestone to notification feed item.
- `src/lib/jobs/deferred-job-notifications.ts`
  - Browser push delivery, not in-app inbox.
- `src/hooks/useChatPushNotifications.test.tsx`
  - Existing browser push preference behavior.
- `src/lib/push/browser-push.ts`
  - Browser push registration/preference helpers.
- `src/frameworks/ui/jobs-rail/JobsRail.tsx`
  - Current job attention badge donor UI.
- `src/components/AuthenticatedWorkRail.tsx`
  - Current placement for jobs rail and notification bell.

## Target Shape

Add:

- `/activity`
  - Full ledger.
  - Single-column cards.
  - Filters:
    - All,
    - Needs attention,
    - Running,
    - Completed,
    - Jobs,
    - Workflows,
    - Referrals,
    - System.
  - Search.
  - Pagination or load more.
- `AttentionInbox`
  - Bell popover or sheet.
  - Shows only actionable/unread/high-signal activity.
  - Uses receipt state for read/ack/dismiss.
  - Links to `/activity` for the full list.

Do not make every completed event unread. Default unread should apply only to:

- needs-attention items,
- user-visible completed outputs,
- business milestone items,
- direct system warnings.

## Required Work

- [x] Upgrade `/activity/page.tsx` from the 01c3c minimal ledger into the full
  activity workspace.
- [x] Add `ActivityWorkspace` client component if filters/receipt actions need
  client interactivity.
- [x] Replace `NotificationFeed` default/hardcoded behavior with activity-backed
  attention inbox.
- [x] Keep `/api/notifications/feed` only as a compatibility adapter or replace it
  with `/api/activity?inbox=true`.
- [x] Add receipt actions:
  - mark read,
  - acknowledge,
  - dismiss,
  - mark all read.
- [x] Make the inbox mobile-first:
  - full-height sheet on small screens,
  - compact popover on desktop.
- [x] Keep browser push preference separate from in-app activity.

## Implemented Artifacts

- `src/lib/activity/activity-read-model.ts`
  - Adds durable inbox projection with `listUserInboxActivity`.
  - Adds unread classification helpers for attention items, completed outputs,
    referral milestones, and direct warning/critical items.
  - Adds `applyReceiptActionToInbox` for bulk mark-read without deleting
    activity.
- `src/lib/activity/activity-types.ts`
  - Adds `ActivityInboxReadResult` and `unreadOnly` query support.
- `src/app/api/activity/route.ts`
  - Supports `inbox=true` and `unreadOnly=true`.
  - Returns `unreadCount` for inbox responses.
- `src/app/api/activity/receipts/route.ts`
  - Adds authenticated bulk inbox `mark_read`.
- `src/app/api/notifications/feed/route.ts`
  - Compatibility adapter over the activity inbox.
  - No longer depends on referral self-service profile gating.
- `src/components/AttentionInbox.tsx`
  - Mobile-first attention inbox sheet/popover backed by
    `/api/activity?inbox=true`.
  - Supports mark all read, per-item mark read, acknowledge, dismiss, and
    pin/unpin through receipt APIs.
- `src/components/NotificationFeed.tsx`
  - Compatibility export to `AttentionInbox`; no hardcoded default production
    notifications remain.
- `src/components/activity/ActivityWorkspace.tsx`
  - Full activity workspace with filters, search, pagination, inbox mode,
    history mode, and receipt controls.
- `src/components/activity/ActivityReceiptControls.tsx`
  - Shared client receipt action controls.
- `src/components/activity/ActivityWorkspace.test.tsx`
  - QA regression coverage for unread-count stability when already-read items
    are pinned/unpinned and unread items are dismissed.
- `src/app/activity/page.tsx`
  - Server-authenticated activity page using durable activity and inbox
    projections.
- Tests:
  - `src/lib/activity/activity-read-model.test.ts`
  - `src/app/api/activity/route.test.ts`
  - `src/app/api/activity/receipts/route.test.ts`
  - `src/app/api/notifications/feed/route.test.ts`
  - `src/app/activity/page.test.tsx`
  - `src/components/AttentionInbox.test.tsx`
  - `src/components/AuthenticatedWorkRail.test.tsx`

## Implementation Decisions

- The activity read model owns inbox selection. React does not invent
  notification state.
- Completed activity is not globally unread. The default unread set is limited
  to attention items, completed output-producing activities, referral
  milestones, and direct warning/critical items.
- Mark all read clears unread state but does not delete activity. Attention
  items can remain visible until acknowledged or dismissed.
- Dismiss hides an item from the default inbox/activity view; history mode
  (`includeDismissed=true`) can still show the receipt-backed ledger item.
- Client receipt updates only adjust unread count when the previous receipt
  state was unread, so pin/unpin actions on already-read items do not corrupt
  inbox counts.
- Browser push remains separate. No push preference code was changed.

## Positive Tests

- `/activity` lists mixed activity from jobs, workflows, and referrals.
- Activity filters work.
- Search works.
- Pagination/load-more works.
- Bell count comes from unread attention items.
- Mark all read clears the unread count without deleting activity.
- Dismiss removes item from default inbox but not from the full ledger when
  history is requested.

## Negative Tests

- Anonymous user cannot read activity or inbox routes.
- User cannot read another user's activity.
- Admin-only activity is not shown to regular users.
- Browser push disabled does not suppress in-app activity.
- Hardcoded default notifications no longer appear in production UI.

## Edge Tests

- Activity source was deleted after receipt was created.
- Activity item is acknowledged on mobile and desktop.
- Inbox empty but Activity ledger has history.
- Search query with source id.
- Feed route compatibility if `/api/notifications/feed` remains.

## Cleanup

- Remove hardcoded `DEFAULT_NOTIFICATIONS` from the production notification
  path.
- Rename `NotificationFeed` if it becomes `AttentionInbox`.
- Update tests that assume notification popover contains platform update
  placeholders.

## Exit Criteria

- [x] Ordo has a real user activity page.
- [x] The bell reflects durable attention state.
- [x] Notification, push delivery, and activity are no longer conflated.
