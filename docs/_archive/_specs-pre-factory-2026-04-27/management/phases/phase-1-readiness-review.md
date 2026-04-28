# Phase 1 Readiness Review

> Repo-grounded assessment for [Phase 1: Solid Ground](./phase-1-solid-ground.md).
> Use this before starting implementation so the work follows the current codebase rather than the original spec language.

---

## Summary

Phase 1 is mostly well-targeted, but it overstates a few missing pieces and understates two risks.

What is already present:

- `JobRequest` already carries `attemptCount`, `nextRetryAt`, `recoveryMode`, `lastCheckpointId`, `startedAt`, and `completedAt` in [src/core/entities/job.ts](../../../../src/core/entities/job.ts).
- The SSE route already emits `id:` records through [src/lib/jobs/job-event-stream.ts](../../../../src/lib/jobs/job-event-stream.ts) and already accepts `last-event-id` or `afterSequence` in [src/app/api/chat/events/route.ts](../../../../src/app/api/chat/events/route.ts).
- The worker already has retry scheduling and retry exhaustion events in [src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts).

What is actually missing:

- `dead_letter` is not part of `JobStatus` yet.
- The job status message part does not project the retry and timing fields that already exist on `JobRequest`.
- The UI progress strip still derives from rendered transcript messages instead of a job-centric store.
- `useChatJobEvents` still relies on best-effort snapshot reconciliation and does not track a client high-water mark.
- Both cancel routes still duplicate cancel-action logic and differ in how they shape canceled payload state.
- Worker-side cancellation is still driven by a 250ms polling loop.

Highest-risk assumptions in the current Phase 1 doc:

- An in-memory event bus only improves cancellation if the cancel writer and the worker run in the same process. If the worker runs separately, this does not replace polling by itself.
- The job-state store is not just a new hook. It has to cross the `ChatProvider` to `useChatSurfaceState` boundary cleanly or the progress strip will keep scanning transcript-derived state.

---

## Readiness By Slice

### 1A — Entity & Projection Cascade

Current state:

- `JobStatus` is still `"queued" | "running" | "succeeded" | "failed" | "canceled"` in [src/core/entities/job.ts](../../../../src/core/entities/job.ts).
- `JobStatusMessagePart` in [src/core/entities/message-parts.ts](../../../../src/core/entities/message-parts.ts) does not yet include `attemptCount`, `maxAttempts`, `nextRetryAt`, `startedAt`, `completedAt`, or `lastCheckpointId`.
- `buildJobStatusPartFromProjection()` in [src/lib/jobs/job-status.ts](../../../../src/lib/jobs/job-status.ts) already centralizes publication, but its local projection type omits the timing and retry fields.
- `parseJobStatusPart()` in [src/adapters/chat/EventParserStrategy.ts](../../../../src/adapters/chat/EventParserStrategy.ts) does not parse the new fields yet.
- `RETRIABLE_JOB_STATUSES` in [src/lib/jobs/manual-replay.ts](../../../../src/lib/jobs/manual-replay.ts) is currently only `failed` and `canceled`.
- Both cancel endpoints duplicate `buildCanceledEventPayload()` in [src/app/api/jobs/[jobId]/route.ts](../../../../src/app/api/jobs/[jobId]/route.ts) and [src/app/api/chat/jobs/[jobId]/route.ts](../../../../src/app/api/chat/jobs/[jobId]/route.ts), and the two versions do not preserve the same progress semantics.

Assessment:

- This is the strongest Phase 1 slice. The ownership points are already good.
- The main correction is that this is a projection-and-publication pass more than an entity-creation pass.
- The shared cancel executor is worth doing early because it removes duplicate route behavior before Phase 2 builds UI actions on top.

Recommended first implementation target:

- Start here.

### 1B — Job State Store

Current state:

- The progress strip is derived from `PresentedMessage[]` in [src/frameworks/ui/useChatSurfaceState.tsx](../../../../src/frameworks/ui/useChatSurfaceState.tsx) via [src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts).
- `useChatJobEvents()` in [src/hooks/chat/useChatJobEvents.ts](../../../../src/hooks/chat/useChatJobEvents.ts) dispatches job updates into the chat reducer, but there is no job-centric store exposed from [src/hooks/useGlobalChat.tsx](../../../../src/hooks/useGlobalChat.tsx).
- The reducer in [src/hooks/chat/chatState.ts](../../../../src/hooks/chat/chatState.ts) still treats job state as transcript message state.

Assessment:

- This slice is more invasive than the phase doc implies because it crosses provider, reducer, and UI consumption seams.
- The safest implementation is to add a job-state store alongside chat message state in `ChatProvider`, not to hide it entirely inside `resolve-progress-strip.ts`.
- If this store is added too early, it risks duplicating job state without a clear ownership rule. If added too late, Phase 2 keeps building on transcript scans.

Recommended implementation target:

- Do this after 1A publication fields and after 1C high-water mark work, so the store shape matches the final live event payload.

### 1C — SSE Resilience

Current state:

- The route already uses `last-event-id` or `afterSequence` in [src/app/api/chat/events/route.ts](../../../../src/app/api/chat/events/route.ts).
- The stream response already emits SSE `id:` lines in [src/lib/jobs/job-event-stream.ts](../../../../src/lib/jobs/job-event-stream.ts).
- `useChatJobEvents()` does not retain a client-side `highWaterMark`; it always rehydrates from `/api/chat/jobs?...limit=50` and reconnects best-effort on `onerror`, focus, and visibility change.
- `/api/chat/jobs` in [src/app/api/chat/jobs/route.ts](../../../../src/app/api/chat/jobs/route.ts) does not accept a `since` cursor today.
- `ChatStreamAdapter` in [src/adapters/ChatStreamAdapter.ts](../../../../src/adapters/ChatStreamAdapter.ts) does not emit a `connection_lost` event for premature termination.

Assessment:

- The route-side backlog replay work is partially complete already.
- The real missing work is client-side cursor management, bounded reconnect behavior, and explicit degradation signaling.
- The phase doc should be interpreted as “finish SSE continuity end-to-end,” not “introduce SSE IDs from scratch.”

Recommended implementation target:

- Do this before the job-state store so the store can be fed from stable, deduplicated event ordering.

### 1D — Event-Driven Cancellation

Current state:

- The worker still polls every 250ms through `startCancellationMonitor()` in [src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts).
- Cancel writes happen inside the two duplicate route handlers, not through a shared executor.

Assessment:

- Replacing the poller with an in-memory `EventEmitter` is only correct if cancel writes and the worker share process memory.
- If the worker can run in another process, the event bus should be treated as an optimization layer, not the source of truth.
- The safe design is: shared action executor writes cancellation canonically; optional in-process event bus accelerates local workers; persistence remains authoritative.

Recommended implementation target:

- Do the shared action executor in 1A first.
- Only replace the poller after confirming the intended runtime topology for the worker.

---

## Recommended Execution Order

1. Projection and status cascade.
   - Add `dead_letter` to [src/core/entities/job.ts](../../../../src/core/entities/job.ts).
   - Extend [src/core/entities/message-parts.ts](../../../../src/core/entities/message-parts.ts).
   - Update [src/lib/jobs/job-status.ts](../../../../src/lib/jobs/job-status.ts).
   - Update [src/adapters/chat/EventParserStrategy.ts](../../../../src/adapters/chat/EventParserStrategy.ts).
   - Extend [src/lib/jobs/job-status.test.ts](../../../../src/lib/jobs/job-status.test.ts).

2. Canonical job action execution.
   - Extract `executeJobAction()` into `src/lib/jobs/job-action-executor.ts`.
   - Reduce [src/app/api/jobs/[jobId]/route.ts](../../../../src/app/api/jobs/[jobId]/route.ts) to auth plus delegation.
   - Reduce [src/app/api/chat/jobs/[jobId]/route.ts](../../../../src/app/api/chat/jobs/[jobId]/route.ts) to auth plus delegation.
   - Normalize cancel payload behavior once, not twice.
   - Extend route tests in `src/app/api/jobs/[jobId]/route.test.ts` and add or extend chat job action coverage.

3. Worker terminal-state semantics.
   - Update [src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts) so retry exhaustion produces `dead_letter` instead of leaving terminal state at `failed`.
   - Update [src/lib/jobs/manual-replay.ts](../../../../src/lib/jobs/manual-replay.ts) if `dead_letter` should remain manually replayable.
   - Extend [src/lib/jobs/deferred-job-worker.test.ts](../../../../src/lib/jobs/deferred-job-worker.test.ts).

4. Client SSE continuity.
   - Add client `highWaterMark` tracking in [src/hooks/chat/useChatJobEvents.ts](../../../../src/hooks/chat/useChatJobEvents.ts).
   - Add `since` support to [src/app/api/chat/jobs/route.ts](../../../../src/app/api/chat/jobs/route.ts).
   - Keep using SSE `id:` and `last-event-id` already present in the event route.
   - Add a `connection_lost` event or equivalent degradation signal in [src/adapters/ChatStreamAdapter.ts](../../../../src/adapters/ChatStreamAdapter.ts) if the product still needs it after bounded retries.
   - Extend [src/app/api/chat/events/route.test.ts](../../../../src/app/api/chat/events/route.test.ts) and [src/hooks/chat/useChatJobEvents.test.tsx](../../../../src/hooks/chat/useChatJobEvents.test.tsx).

5. Job-state store and progress strip decoupling.
   - Add `src/hooks/chat/useJobStateStore.ts`.
   - Plumb it through [src/hooks/useGlobalChat.tsx](../../../../src/hooks/useGlobalChat.tsx).
   - Shift [src/frameworks/ui/useChatSurfaceState.tsx](../../../../src/frameworks/ui/useChatSurfaceState.tsx) and [src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts) to consume the store rather than transcript scans.
   - Extend [src/frameworks/ui/chat/plugins/system/resolve-progress-strip.test.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.test.ts).

6. Optional in-process cancellation acceleration.
   - Add `src/lib/jobs/job-event-bus.ts` only if the worker and cancel route share process memory.
   - If they do not, keep persistence as the source of truth and treat the bus as out of scope for the first cut.

---

## Suggested Verification Bundle

Run these first while implementing Phase 1:

```bash
npx vitest run \
  src/lib/jobs/job-status.test.ts \
  src/hooks/chat/useChatJobEvents.test.tsx \
  src/frameworks/ui/chat/plugins/system/resolve-progress-strip.test.ts \
  src/app/api/chat/events/route.test.ts \
  src/app/api/chat/jobs/route.test.ts \
  src/app/api/jobs/[jobId]/route.test.ts \
  src/lib/jobs/deferred-job-worker.test.ts
```

Then run the phase-level gate:

```bash
npm run typecheck
npm run test
```

---

## Recommended Doc Adjustments For Phase 1

If the main phase doc is updated later, tighten the wording in these places:

- Rephrase 1A from “add these fields” to “project these existing fields into publication and SSE surfaces,” except for `dead_letter`.
- Rephrase 1C from “add SSE IDs” to “finish client-side replay continuity using the existing SSE ID contract.”
- Note explicitly in 1D that the in-memory event bus only replaces polling for same-process workers.
