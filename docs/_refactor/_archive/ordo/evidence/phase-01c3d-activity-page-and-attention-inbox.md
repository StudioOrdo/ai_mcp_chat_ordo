# Phase 01c3d Activity Page And Attention Inbox

Status: Implemented
Date: 2026-05-04

## Purpose

This evidence file records the implementation of the durable Activity page and
attention inbox.

The key decision is:

The bell is an inbox projection over durable activity and receipts. It is not a
local notification list and it is not browser push delivery.

## Code Inspected

- `src/app/activity/page.tsx`
  - Minimal ledger from 01c3c.
- `src/components/NotificationFeed.tsx`
  - Previous hardcoded/local notification popover.
- `src/app/api/notifications/feed/route.ts`
  - Previous referral-specific compatibility endpoint.
- `src/lib/activity/activity-read-model.ts`
  - Durable activity projection and receipt application.
- `src/app/api/activity/route.ts`
  - Existing activity API.
- `src/app/api/activity/[activityId]/receipt/route.ts`
  - Existing single-item receipt API.
- `src/components/AuthenticatedWorkRail.tsx`
  - Placement for the jobs rail and bell.
- `src/lib/jobs/deferred-job-notifications.ts`
  - Browser push delivery boundary, intentionally left separate.

## Implemented Artifacts

- `src/lib/activity/activity-read-model.ts`
  - `listUserInboxActivity`
  - `applyReceiptActionToInbox`
  - `isActivityUnread`
  - `isActivityInboxItem`
- `src/app/activity/page.tsx`
  - Full authenticated Activity page using durable ledger and inbox projections.
- `src/components/activity/ActivityWorkspace.tsx`
  - Search, filters, pagination, inbox mode, history mode, and receipt controls.
- `src/components/activity/ActivityReceiptControls.tsx`
  - Shared mark read, acknowledge, dismiss, pin, and unpin controls.
- `src/components/AttentionInbox.tsx`
  - Durable attention inbox sheet/popover for the bell.
- `src/components/NotificationFeed.tsx`
  - Compatibility export to `AttentionInbox`.
- `src/app/api/activity/route.ts`
  - `inbox=true` and `unreadOnly=true` support.
- `src/app/api/activity/receipts/route.ts`
  - Bulk inbox mark-read route.
- `src/app/api/notifications/feed/route.ts`
  - Activity-backed compatibility feed.

## Verification

Commands run:

```bash
npx vitest run src/lib/activity/activity-read-model.test.ts src/app/api/activity/route.test.ts src/app/api/activity/receipts/route.test.ts 'src/app/api/activity/[activityId]/receipt/route.test.ts' src/app/api/notifications/feed/route.test.ts src/app/activity/page.test.tsx src/components/AttentionInbox.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/lib/dashboard/load-user-dashboard.test.ts src/components/dashboard/UserDashboard.test.tsx src/app/workspace/page.test.tsx src/lib/shell/shell-navigation.test.ts
npx eslint src/lib/activity/activity-types.ts src/lib/activity/activity-read-model.ts src/lib/activity/activity-read-model.test.ts src/app/api/activity/route.ts src/app/api/activity/route.test.ts src/app/api/activity/receipts/route.ts src/app/api/activity/receipts/route.test.ts 'src/app/api/activity/[activityId]/receipt/route.ts' 'src/app/api/activity/[activityId]/receipt/route.test.ts' src/app/api/notifications/feed/route.ts src/app/api/notifications/feed/route.test.ts src/app/activity/page.tsx src/app/activity/page.test.tsx src/components/activity/ActivityReceiptControls.tsx src/components/activity/ActivityWorkspace.tsx src/components/AttentionInbox.tsx src/components/AttentionInbox.test.tsx src/components/NotificationFeed.tsx src/components/AuthenticatedWorkRail.tsx src/components/AuthenticatedWorkRail.test.tsx
npm run typecheck
```

Result:

- 60 targeted Vitest tests passed.
- ESLint passed.
- TypeScript passed with `tsc --noEmit`.

## QA Follow-Up

QA found one client-state bug after the first implementation pass:

- `ActivityWorkspace` decremented `unreadCount` whenever an updated item had a
  `readAt` receipt. That could incorrectly lower the unread count when an
  already-read item was pinned or unpinned.

Fix:

- `ActivityWorkspace` now compares the previous item receipt with the updated
  item receipt before changing `unreadCount`.
- Dismiss now decrements unread only when the dismissed item was previously
  unread in the current view.
- Added `src/components/activity/ActivityWorkspace.test.tsx` coverage for:
  - pinning an already-read item without changing unread count,
  - dismissing an unread item and removing it from the inbox view.

Re-run after QA fix:

```bash
npx vitest run src/lib/activity/activity-read-model.test.ts src/app/api/activity/route.test.ts src/app/api/activity/receipts/route.test.ts 'src/app/api/activity/[activityId]/receipt/route.test.ts' src/app/api/notifications/feed/route.test.ts src/app/activity/page.test.tsx src/components/AttentionInbox.test.tsx src/components/activity/ActivityWorkspace.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/lib/dashboard/load-user-dashboard.test.ts src/components/dashboard/UserDashboard.test.tsx src/app/workspace/page.test.tsx src/lib/shell/shell-navigation.test.ts
npx eslint src/lib/activity/activity-types.ts src/lib/activity/activity-read-model.ts src/lib/activity/activity-read-model.test.ts src/app/api/activity/route.ts src/app/api/activity/route.test.ts src/app/api/activity/receipts/route.ts src/app/api/activity/receipts/route.test.ts 'src/app/api/activity/[activityId]/receipt/route.ts' 'src/app/api/activity/[activityId]/receipt/route.test.ts' src/app/api/notifications/feed/route.ts src/app/api/notifications/feed/route.test.ts src/app/activity/page.tsx src/app/activity/page.test.tsx src/components/activity/ActivityReceiptControls.tsx src/components/activity/ActivityWorkspace.tsx src/components/activity/ActivityWorkspace.test.tsx src/components/AttentionInbox.tsx src/components/AttentionInbox.test.tsx src/components/NotificationFeed.tsx src/components/AuthenticatedWorkRail.tsx src/components/AuthenticatedWorkRail.test.tsx
npm run typecheck
```

QA result:

- 62 targeted Vitest tests passed.
- ESLint passed.
- TypeScript passed with `tsc --noEmit`.

## Follow-On Boundaries

- 01c3e owns `/jobs` convergence into a single-column work index.
- 01c3f owns final top-rail balance and mobile work controls.
- Browser push delivery remains profile/preference-owned and separate from
  in-app activity receipts.
