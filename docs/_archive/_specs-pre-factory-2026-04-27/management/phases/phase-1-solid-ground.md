# Phase 1: Solid Ground

> **Milestone:** After this phase, the system's data layer is correct, the SSE transport is resilient, and job state survives context-window trimming. Nothing visible changes in the UI yet - but everything the UI depends on is now trustworthy.

## Status: `[x] Complete`

---

## What Ships

### 1A — Entity & Projection Cascade

Consolidates: Spec 09 (projection), Spec 12 (route dedup), Spec 07 (DLQ status)

Extend the core types in a single cascade so every downstream consumer gets the data it needs:

- [x] Added `dead_letter` to `JobStatus` in `src/core/entities/job.ts`
- [x] Projected retry, timing, and checkpoint fields through `JobStatusMessagePart` in `src/core/entities/message-parts.ts`
- [x] Updated `buildJobStatusPartFromProjection()` in `src/lib/jobs/job-status.ts` to publish the expanded job metadata
- [x] Updated `parseJobStatusPart()` in `src/adapters/chat/EventParserStrategy.ts` to parse the expanded SSE payload
- [x] Extracted shared `executeJobAction()` into `src/lib/jobs/job-action-executor.ts`
- [x] Reduced `/api/jobs/[jobId]/route.ts` to auth plus delegation
- [x] Reduced `/api/chat/jobs/[jobId]/route.ts` to auth plus delegation
- [x] Removed duplicate canceled payload builders in favor of the canonical executor path
- [x] Updated `src/lib/jobs/deferred-job-worker.ts` so retry exhaustion writes `dead_letter`
- [x] Added `dead_letter` to `RETRIABLE_JOB_STATUSES` in `src/lib/jobs/manual-replay.ts`

### 1B — Job State Store

Consolidates: Spec 17 (context coherence)

Decouple the progress strip from the message list so job state survives context-window trimming:

- [x] Added `src/hooks/chat/useJobStateStore.ts` as the job-centric source of truth
- [x] Added `resolveProgressStripFromStore()` to `resolve-progress-strip.ts`
- [x] Wired the progress strip to the store through `useGlobalChat.tsx` and `useChatSurfaceState.tsx`
- [x] Added null-safe store handling so existing callers and tests without store input do not crash

### 1C — SSE Resilience

Consolidates: Spec 13 (SSE reconnection)

Make the real-time transport reliable:

- [x] Added client-side `highWaterMark` tracking to `useChatJobEvents.ts`
- [x] Added `since` support to `/api/chat/jobs`
- [x] Preserved and aligned the existing SSE `id:` and `Last-Event-Id` contract in `/api/chat/events`
- [x] Added bounded reconnect and backoff behavior to replace unbounded reconciliation
- [x] Detects premature stream termination in `ChatStreamAdapter.ts` and emits `connection_lost`

### 1D — Event-Driven Cancellation

Consolidates: Spec 08 (event bus)

Replace the 250ms polling loop with instant cancellation:

- [x] Added `src/lib/jobs/job-event-bus.ts` as the in-process cancellation accelerator
- [x] Replaced `startCancellationMonitor` polling in the worker with `jobEventBus` subscription
- [x] Emits `job_canceled` from `job-action-executor.ts` after the canonical cancel write

---

## Verification Checkpoint

```bash
npm run verify
```

Verification result:

- [x] Full repo verify passed: lint, TypeScript, and Vitest all green on the latest run
- [x] Focused worker coverage updated for `dead_letter` retry exhaustion and event-bus cancellation
- [x] Focused progress-strip coverage updated for store-backed resolution and missing-store safety
- [x] Focused chat provider and message-list coverage updated for the new store-backed state path and current defaults
- [x] Retrieval and corpus drift regressions uncovered during phase QA were fixed and revalidated so the repo-level gate stays green

Live smoke during closeout:

- [x] Local app shell loads successfully at `http://localhost:3000/`
- [x] Home route renders the embedded chat workspace, auth links, composer input, and prompt chips

Implementation note:

- [x] Same-process cancellation is now event-driven; persistence remains the source of truth for any cross-process recovery path

---

## Files Touched

| Action | File |
| --- | --- |
| MODIFY | `src/core/entities/job.ts` |
| MODIFY | `src/core/entities/message-parts.ts` |
| MODIFY | `src/lib/jobs/job-status.ts` |
| MODIFY | `src/lib/jobs/manual-replay.ts` |
| MODIFY | `src/lib/jobs/deferred-job-worker.ts` |
| MODIFY | `src/adapters/chat/EventParserStrategy.ts` |
| MODIFY | `src/adapters/ChatStreamAdapter.ts` |
| MODIFY | `src/app/api/jobs/[jobId]/route.ts` |
| MODIFY | `src/app/api/chat/jobs/[jobId]/route.ts` |
| MODIFY | `src/app/api/chat/jobs/route.ts` |
| MODIFY | `src/app/api/chat/events/route.ts` |
| MODIFY | `src/hooks/chat/useChatJobEvents.ts` |
| MODIFY | `src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts` |
| NEW | `src/lib/jobs/job-action-executor.ts` |
| NEW | `src/lib/jobs/job-event-bus.ts` |
| NEW | `src/hooks/chat/useJobStateStore.ts` |

---

## Depends On

Nothing — this is the foundation.

## Unlocks

Phase 2 (Transparent Operations), Phase 3 (Visual Polish), Phase 4 (Platform Maturity)
