# Business Workflow Context Specification

## Objective

Define the business-workflow layer that makes the conversation refactor valuable
for solopreneurs and small businesses.

The product should give small operators enterprise-grade continuity without
enterprise cost or external system sprawl. Conversation restore should not only
answer what was said. It should answer what business work is in motion, why it
matters, what object it belongs to, and what the owner should do next.

This app is self-contained in a Docker image. The default architecture should
therefore make the local product feel like a compact operating system, not a
chat box that requires a separate CRM, project tracker, asset manager, and
analytics stack to become useful.

## Product Principle

The conversation is the relationship interface.

The business workflow context is the momentum layer.

Together they should let a solo operator return to the app and immediately see:

- who or what needs attention
- what work was already started
- what assets or outputs already exist
- what revenue, service, training, or operations object this connects to
- what the next useful action is

## Current Grounding

The codebase already contains the ingredients for this layer:

- `src/lib/chat/task-origin-handoff.ts` defines operator signal handoffs such
  as lead queue, routing review, deal queue, training path queue, system
  health, and overdue follow-ups.
- `src/lib/chat/media-continuity-handoff.ts` carries reusable media context
  into the next turn.
- `src/hooks/chat/useFailedSendRecovery.ts` and
  `src/hooks/chat/chatFailedSendRecovery.ts` preserve retry state for failed or
  interrupted sends.
- `src/hooks/chat/useLifecycleContext.ts`, `src/core/entities/lifecycle.ts`,
  and `src/core/entities/coach.ts` model activation, onboarding, role changes,
  tier changes, and next-step coach cards.
- `src/lib/jobs/deferred-job-notifications.ts` already links terminal job
  events to user notifications and conversation URLs.
- `/r/{code}`, `/api/referral/{code}`, `/api/referral/visit`, and
  `/api/qr/{code}` already preserve validated referral visits and QR entry.
- `/referrals`, `/admin/affiliates`, affiliate analytics, notification feed,
  and chat tools already expose self-service and admin referral surfaces.
- `src/lib/admin/admin-navigation.ts` and `src/components/ShellWorkspaceMenu.tsx`
  already know about admin/operator surfaces and workspace drawer context.
- Lead, deal, consultation, training, and referral entities already exist under
  `src/core/entities/` and `src/lib/referrals/`.

The gap is that these signals are not one durable product contract.

The QR/referral system is especially important: it should be treated as a
business workflow source because it turns a trusted introduction into a tracked
conversation, registration, lead, deal, training path, credit review, or payout
event.

## Canonical Model

### Business Workflow Context

`BusinessWorkflowContext` describes the business frame around the current
conversation.

```typescript
export interface BusinessWorkflowContext {
  id: string;
  userId: string;
  conversationId: string;
  primaryMode:
    | "revenue"
    | "service"
    | "training"
    | "operations"
    | "setup"
    | "general";
  origin: WorkflowOriginContext | null;
  relatedRefs: readonly BusinessObjectRef[];
  lifecycleRefs: readonly LifecycleProgressRef[];
  notificationRefs: readonly WorkflowNotificationRef[];
  interruptedTurnRefs: readonly InterruptedTurnRef[];
  healthRefs: readonly WorkflowHealthRef[];
  recommendedAction: WorkflowRecommendedAction | null;
  updatedAt: string;
}
```

### Origin Context

```typescript
export interface WorkflowOriginContext {
  sourceBlockId: string;
  sourceContextId: string | null;
  sourceRoute: string | null;
  sourceView: string | null;
  sourceFilters: Record<string, string>;
  returnHref: string | null;
}
```

This is the durable version of task-origin and current-page memento context.

It lets restore say, for example:

- return to the lead queue
- resume routing review
- continue the deal follow-up
- inspect the system-health issue
- finish onboarding

### Business Object Refs

```typescript
export interface BusinessObjectRef {
  kind:
    | "lead"
    | "deal"
    | "consultation_request"
    | "training_path"
    | "referral"
    | "journal_item"
    | "job"
    | "asset";
  id: string;
  label: string;
  status: string | null;
  href: string | null;
  reason: string;
}
```

These refs are not a replacement for the owning domain tables. They are compact
links that help restore and memory understand what business object the
conversation is currently serving.

Referral refs should be included when a trusted introduction caused or shaped
the conversation. The compact ref should point to the referral ledger or
analytics surface, not duplicate the referral row.

### Lifecycle Progress Refs

```typescript
export interface LifecycleProgressRef {
  kind: "lifecycle" | "coach" | "onboarding" | "capability_unlock";
  id: string;
  status: "pending" | "active" | "succeeded" | "dismissed";
  label: string;
  nextHref: string | null;
}
```

This converts lifecycle and coach cards into durable activation context.

### Interrupted Turn Refs

```typescript
export interface InterruptedTurnRef {
  id: string;
  failedUserMessageId: string;
  retryKey: string;
  status: "retryable" | "dismissed" | "superseded";
  taskOriginRef: string | null;
  mediaContinuityRef: string | null;
  createdAt: string;
}
```

This makes failed sends and interrupted generations recoverable beyond a single
browser session.

## Workspace Snapshot Integration

`WorkspaceSnapshot` should include a compact workflow pointer:

```typescript
export interface WorkspaceSnapshot {
  workflowContextRef: string | null;
  relatedBusinessRefs: readonly BusinessObjectRef[];
}
```

The snapshot still owns the current relationship state. The workflow context
owns the business frame and cross-surface momentum.

## Restore Experience

Restore should load workflow context after the workspace snapshot and before
the final product presentation.

The resulting surface should be able to show:

- current business mode: revenue, service, training, operations, setup, or
  general
- related lead, deal, consultation, training path, referral, journal item, job,
  or asset
- incomplete onboarding or capability setup
- interrupted work that can be retried
- completed jobs that need review
- route back to the originating workspace surface
- health or configuration blockers that affect the next action

## Small-Business Value Rules

### Revenue Work Should Stay Connected

If a conversation starts from a lead, deal, referral, or consultation request,
jobs and assets created from that conversation should remain attributable to
that business object.

### Trust Distribution Should Stay Visible

If a conversation starts from a referral QR/link or leads to a shareable
referral asset, restore should preserve that trust-distribution frame. The next
action might be follow up with the referred person, share the QR card, review a
credit exception, or thank the referrer.

### Setup Should Resume

If the user is mid-onboarding, mid-install, or mid-capability unlock, restore
should recommend finishing setup when it is more useful than continuing a raw
chat thread.

### Work Should Not Disappear Across Surfaces

Moving from admin leads to conversation to jobs to media should preserve the
business frame. The user should not have to remember which queue, filter, or
object started the work.

### Notifications Should Close The Loop

If a job finishes while the user is away, restore should know whether there was
a terminal notification and should make review, reuse, or retry the next action.

### Health Should Shape Guidance

If runtime health, missing keys, worker status, quota, or policy prevents a
next action, restore should surface that as a clear blocker rather than letting
the user rediscover the failure by asking again.

## Non-Goals

This layer must not become a full external CRM clone.

It must not duplicate lead, deal, referral, job, asset, or lifecycle payloads.

It must not require external SaaS services to be valuable.

It must not turn the chat transcript back into the operational store.

## Test Requirements

The test package must prove:

- lead or deal origin survives conversation restore
- task-origin survives failed-send retry and page reload
- onboarding or coach progress can resume after leaving the page
- a completed notified job appears as reviewable work
- route/filter context can return the user to the originating surface
- a health blocker changes the recommended next action
- deleted or inaccessible business refs do not leak through restore

## Definition Of Done

This spec is complete when a returning small-business user can open the app and
understand not just the chat history, but the business momentum:

- what needs attention
- why it matters
- what exists already
- what to do next
- where to go if the work belongs in another surface
