# Phase 09 - Push Notification Boundary

## Goal

Keep browser Push optional and terminal-state-only.

## Steps

1. Confirm active chat correctness passes with Push disabled.
2. Confirm Push subscription API rejects anonymous users.
3. Confirm signed-in subscriptions can be upserted.
4. Emit Push only for terminal or attention-worthy states.
5. Tag notifications by `jobId` so newer notifications replace older ones.
6. Include `jobId`, `conversationId`, `status`, and route URL in payloads.
7. Confirm service worker click behavior opens or focuses the target route.
8. Document why Push is not an active-chat transport.

## Code Anchors

- `src/hooks/useChatPushNotifications.ts`
- `src/app/api/notifications/push/route.ts`
- `src/lib/jobs/deferred-job-notifications.ts`
- `src/adapters/PushNotificationChannel.ts`
- `public/push-worker.js`
- `tests/browser-ui/push-notifications.spec.ts`

## Done

- Push can be enabled without changing SSE/reconciliation correctness.
- Active chat passes with Push unavailable, denied, or disabled.
