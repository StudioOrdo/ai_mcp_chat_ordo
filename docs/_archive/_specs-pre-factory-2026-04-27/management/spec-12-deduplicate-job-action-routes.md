# Spec 12 — Deduplicate Job Action API Routes

## Goal

Consolidate the two nearly-identical job action endpoints into a single shared implementation. Today, both `/api/jobs/[jobId]` and `/api/chat/jobs/[jobId]` independently implement the same cancel/retry logic with divergent `buildCanceledEventPayload` implementations.

---

## Problem Statement

### Two Routes, Same Logic, Different Bugs

| Aspect | `/api/jobs/[jobId]` | `/api/chat/jobs/[jobId]` |
|---|---|---|
| Auth | `requireAuthenticatedUser` + `ensureUserOwnsConversationJob` | `resolveUserId` + `interactor.get()` |
| Cancel payload builder | Preserves `progressPercent`, `progressLabel`, `activePhaseKey` individually | Blankets with `progressPercent: null`, `progressLabel: null`, `activePhaseKey: null` |
| Retry owner | `user.id` | `userId` from `resolveUserId()` |
| File | `src/app/api/jobs/[jobId]/route.ts` (173 lines) | `src/app/api/chat/jobs/[jobId]/route.ts` (153 lines) |

The `buildCanceledEventPayload` functions are **semantically different** — one preserves progress state on cancel, the other nullifies it. This means canceling the same job from the admin panel vs. the chat produces different event payloads. This is a correctness bug.

---

## Proposed Solution

### Extract a Shared Job Action Executor

Create `src/lib/jobs/job-action-executor.ts`:

```typescript
export interface JobActionContext {
  actorUserId: string;
  repository: JobQueueRepository;
  projector: DeferredJobConversationProjector;
}

export type JobActionResult =
  | { action: "cancel"; job: JobRequest; eventSequence: number }
  | { action: "retry"; job: JobRequest; deduped: boolean; replay: ManualJobReplayResult };

export async function executeJobAction(
  jobId: string,
  action: "cancel" | "retry",
  context: JobActionContext,
): Promise<JobActionResult>;
```

### Canonical Cancel Payload

Use the `/api/jobs/[jobId]` version (which preserves progress state) as the canonical implementation. The chat route's version that nullifies progress is the bug — it destroys information.

### Route Refactoring

Both routes become thin wrappers:

```typescript
// /api/jobs/[jobId]/route.ts
export async function POST(request, { params }) {
  return runRouteTemplate({
    execute: async (context) => {
      const user = await requireAuthenticatedUser(context);
      await ensureUserOwnsConversationJob(user.id, job.conversationId, context);
      const result = await executeJobAction(jobId, action, { actorUserId: user.id, ... });
      return successJson(context, result);
    },
  });
}

// /api/chat/jobs/[jobId]/route.ts
export async function POST(request, { params }) {
  return runRouteTemplate({
    execute: async (context) => {
      const { userId } = await resolveUserId();
      await interactor.get(job.conversationId, userId);
      const result = await executeJobAction(jobId, action, { actorUserId: userId, ... });
      return successJson(context, result);
    },
  });
}
```

Each route retains its own auth strategy (admin vs. chat session) but delegates all business logic to the shared executor.

---

## Files

| Action | File |
|---|---|
| **NEW** | `src/lib/jobs/job-action-executor.ts` — shared cancel/retry logic |
| **MODIFY** | `src/app/api/jobs/[jobId]/route.ts` — delegate to executor |
| **MODIFY** | `src/app/api/chat/jobs/[jobId]/route.ts` — delegate to executor |
| **DELETE** | `buildCanceledEventPayload` from both routes (moved to executor) |

---

## Test Cases

**Positive:**
- Cancel via admin route: produces identical event payload as cancel via chat route.
- Retry via admin route: produces identical replay result as retry via chat route.

**Negative:**
- Cancel a succeeded job via either route: returns 409 from shared guard.
- Retry a running job via either route: returns 409 from shared guard.

**Edge:**
- Cancel from admin with `requireAuthenticatedUser` returning a Response (unauthorized): never reaches executor.

---

## Success Criteria

1. `buildCanceledEventPayload` exists in exactly one file.
2. Both routes produce byte-identical event payloads for the same job action.
3. Auth strategy remains route-specific; business logic is shared.
