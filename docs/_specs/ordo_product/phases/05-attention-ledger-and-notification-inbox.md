# Phase 05 - Attention Ledger And Notification Inbox

## Objective
Turn notifications into durable attention state so Ordo knows what happened,
what was told to the user, and what still requires action.

## Current Code Grounding
- Notification feed and push routes exist.
- Job events and job history exist.
- Referral notifications and milestones exist.
- Deferred job notifications exist.
- Work orders, deals, training paths, and storage warnings can emit events.

## Architecture
- Attention ledger is a read/write model for user-facing attention.
- Push/feed delivery is a channel, not the source of truth.
- Inbox items point to jobs, work orders, referrals, leads, deals, training
  paths, storage events, support items, or config changes.

## Suggested Inbox Item Fields
- `id`
- `userId`
- `sourceUnit`
- `severity`
- `status`: `unread`, `read`, `acknowledged`, `dismissed`, `resolved`
- `requiresAction`
- `actionRefs`
- `relatedEntity`
- `createdAt`
- `deliveredAt`
- `readAt`
- `resolvedAt`

## Tests
- Job completion/failure creates or updates attention state.
- Referral milestone creates user-visible item when enabled.
- Admin-only diagnostic events do not leak to users.
- Read/acknowledge/resolve transitions are idempotent.

## Done Criteria
- Notifications are backed by durable attention state.
- Ordo can summarize pending user attention reliably.

