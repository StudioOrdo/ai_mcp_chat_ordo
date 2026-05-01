# Phase 03 - Active Chat Event Hook

## Goal

Make active chat use durable event delivery as the primary update path.

Phase 03 consumes the route contract locked in Phase 02. The chat hook should
become cursor-aware without adding a new transport, a new event parser, or a new
job-state store.

## Preparation Evidence

Phase 02 proved the route side of the contract:

- `/api/chat/events` accepts `afterSequence` and `Last-Event-ID` as
   conversation-scoped `job_events.sequence` cursors.
- Invalid chat cursors fall back to `0` and do not suppress backlog replay.
- Stream payloads continue to include canonical `job_status` parts.
- Route-level reconnect/catch-up is covered by durable cursor replay; client
   reconnect behavior now belongs here.

Current `useChatJobEvents()` behavior:

- Opens `/api/chat/events?conversationId=...` without `afterSequence`.
- Reconciles `/api/chat/jobs?conversationId=...&limit=50` on mount, stream
   error, focus, visible-tab transition, and a 15 second visible-tab interval.
- Dispatches reconciled snapshots through `UPSERT_JOB_STATUS` and optionally
   calls `upsertJobStateEntries()`.
- Parses live job SSE payloads through `EventParserStrategy` and forwards them
   through `createChatStreamProcessor()`.
- Does not currently track the latest conversation event sequence, seed a
   cursor from reconciliation, or suppress stale live events.

Reference implementation to reuse:

- `useJobsEventStream()` uses `lastSequenceRef`, opens EventSource with
   `afterSequence`, advances the cursor only after an accepted payload, ignores
   older/equal events, and advances from reconciliation snapshots/history.
- Phase 03 should copy that discipline, but keep the cursor name and tests
   conversation-specific. Do not use the user rowid cursor wording from the Jobs
   workspace hook.

Existing hook tests before implementation:

| Test | Current coverage | Phase 03 gap |
| --- | --- | --- |
| `backs off snapshot reconciliation after a missing conversation response` | Missing conversation backoff protects repeated failed snapshot reads. | Keep this behavior when adding cursor state. |
| `preserves normalized job parts from live SSE events` | Live `part` payloads reach chat state. | Add cursor advance and stale-event assertions around accepted job payloads. |
| `rehydrates a larger deferred-job snapshot set for busy conversations` | Snapshot reconciliation dispatches many jobs and uses limit `50`. | Seed cursor from the highest snapshot `part.sequence`. |
| `periodically reconciles deferred jobs while the conversation stays open` | Visible-tab interval remains a fallback. | Ensure periodic reconcile advances the cursor without reopening duplicate streams. |

## Implementation Evidence

Implemented on 2026-04-30.

Changed `useChatJobEvents()` to:

- Reconcile `/api/chat/jobs` before opening the EventSource.
- Seed a conversation-scoped cursor from the highest numeric snapshot
   `part.sequence`.
- Open `/api/chat/events` with `conversationId` and `afterSequence`.
- Advance the cursor only for accepted job stream events with newer numeric
   `sequence` values.
- Ignore older or equal sequence job stream events.
- Preserve missing-conversation backoff, focus/visibility/interval
   reconciliation, and EventSource cleanup.
- Reconcile and reopen EventSource with the latest conversation cursor after a
   stream error.
- Keep snapshot reconciliation available when `EventSource` is unavailable.

Added or updated focused tests in `src/hooks/chat/useChatJobEvents.test.tsx` for:

- Reconciled cursor seeding before stream open.
- Accepted live event cursor advance and stale live event suppression.
- Stream error reconciliation and EventSource reopen with the latest cursor.
- Conversation change cursor reset and old stream close.
- Missing `conversationId` no-op behavior.
- EventSource-unavailable reconciliation fallback.

Verification command:

```bash
npm exec vitest run \
   src/hooks/chat/useChatJobEvents.test.tsx \
   src/components/jobs/useJobsEventStream.test.tsx \
   src/app/api/chat/events/route.test.ts
```

Result:

- 3 test files passed.
- 16 tests passed.

## QA Evidence

QA completed on 2026-04-30.

QA finding fixed:

- The first implementation reconciled after `EventSource.onerror`, but left the
   old EventSource URL alive. Because `/api/chat/events` gives the query
   `afterSequence` precedence over `Last-Event-ID`, browser reconnect could have
   reused a stale query cursor. The hook now closes and reopens EventSource after
   error reconciliation so the URL carries the latest conversation cursor.

Checks performed:

- Re-read Phase 03 goals, Done checklist, and Phase 02 route cursor contract.
- Verified active chat still uses the existing `EventParserStrategy`,
   `createChatStreamProcessor()`, and `upsertJobStateEntries()` path.
- Re-ran the focused Vitest command above: 3 files passed, 16 tests passed.
- Ran targeted ESLint on the changed hook and hook test with no findings.
- Ran static diagnostics and whitespace checks with no findings.

Additional validation:

```bash
npm exec eslint src/hooks/chat/useChatJobEvents.ts src/hooks/chat/useChatJobEvents.test.tsx
```

Result: no findings.

Note: `src/hooks/chat/useJobStateStore.test.tsx` does not currently exist in
this workspace. Phase 04 owns the job-state merge authority tests.

## Steps

1. Add a conversation-scoped `lastSequenceRef` or equivalent cursor state to
   `useChatJobEvents`.
2. Reset the cursor when `conversationId` changes; do not carry a cursor between
   conversations.
3. Reconcile initial snapshots before opening the EventSource or open with `0`
   and immediately advance after the first successful reconciliation. Prefer the
   approach that is easiest to test without delaying live updates.
4. Advance the cursor from reconciliation by taking the maximum numeric
   `part.sequence` from `/api/chat/jobs` snapshots.
5. Open EventSource with `afterSequence=${lastSequenceRef.current}` using the
   Phase 02 route contract.
6. Advance the cursor only after successfully parsing and accepting a job stream
   event with a numeric `sequence` greater than the current cursor.
7. Ignore older or equal sequence job stream events after a newer snapshot or
   stream event has already advanced the cursor.
8. Reconcile on stream error, focus, visible-tab transition, and periodic
   fallback; reconciliation should update the same job entries in place via the
   existing store path.
9. Close EventSource on conversation change or unmount.
10. Keep behavior stable when `conversationId` is missing or `EventSource` is
   unavailable; reconciliation fallback should still work where possible.

## Implementation Notes

- Keep using `EventParserStrategy` and `createChatStreamProcessor()`; do not add
  a second parser or processor for job events.
- Keep using `upsertJobStateEntries()` as the durable job truth bridge. It
  already merges newer job parts by `jobId` and `sequence`.
- Use `getJobMessageId(event.jobId)` only as the fallback when a stream payload
  lacks `messageId`, as the hook does today.
- Treat only job stream events as cursor-bearing for this phase:
  `job_queued`, `job_started`, `job_progress`, `job_completed`, `job_canceled`,
  and `job_failed`.
- Malformed events should continue to be ignored with the existing warning.
- Do not introduce Browser Push or status-tool polling changes in this phase.
- Do not alter `/api/chat/events`; Phase 02 already locked that route contract.

## Required Test Additions

Extend `src/hooks/chat/useChatJobEvents.test.tsx` with tests that prove:

1. Initial reconciliation seeds the conversation cursor from the highest
   snapshot `part.sequence`, then EventSource opens with
   `/api/chat/events?conversationId=...&afterSequence=N`.
2. A live job event with `sequence: N + 1` advances the cursor and updates both
   chat state and `upsertJobStateEntries()` when provided.
3. Older or equal sequence live job events are ignored after the cursor advances
   from reconciliation.
4. Stream error triggers reconciliation and reopens EventSource with the latest
   known conversation sequence.
5. Focus, visible-tab transition, and periodic fallback reconciliation advance
   the cursor from snapshot sequences.
6. Conversation change closes the old EventSource, resets the cursor, and opens
   the new conversation stream with that conversation's cursor.
7. Missing `conversationId` creates no EventSource and performs no fetch.
8. `EventSource` unavailable does not crash; reconciliation remains the fallback
   path if the hook keeps the current early-return behavior, document that as an
   intentional limitation or adjust the hook to reconcile without SSE.

Suggested focused command:

```bash
npm exec vitest run \
  src/hooks/chat/useChatJobEvents.test.tsx \
  src/components/jobs/useJobsEventStream.test.tsx \
  src/app/api/chat/events/route.test.ts
```

## Code Anchors

- `src/hooks/chat/useChatJobEvents.ts`
- `src/hooks/chat/useChatJobEvents.test.tsx`
- `src/adapters/chat/EventParserStrategy.ts`
- `src/components/jobs/useJobsEventStream.ts`

## Positive Cases

- Reconnect catches up without assistant status polling.
- Focus reconciliation updates the same job entry in place.
- A successful initial reconciliation prevents the hook from replaying already
   known conversation events.
- A newer live stream event advances the cursor and updates one durable job
   entry.

## Negative Cases

- Equal sequence events do not duplicate visible state.
- Older running events do not regress terminal jobs.
- Cursor state does not leak from one conversation to another.
- Malformed or non-job events do not advance the cursor.

## Edge Cases

- Snapshot reconciliation returns jobs without numeric `part.sequence`; cursor
   remains unchanged.
- EventSource is unavailable in the browser environment.
- The active conversation disappears and returns `404`; existing missing
   conversation backoff remains intact.
- Stream payload lacks `messageId`; fallback still uses `getJobMessageId()`.

## Done

- [x] Hook opens the chat EventSource with a conversation-scoped
   `afterSequence` cursor.
- [x] Hook advances the cursor from reconciliation snapshots and accepted live
   job events.
- [x] Hook ignores older or equal sequence live job events.
- [x] Hook resets cursor and closes old EventSource on conversation change.
- [x] Hook preserves missing-conversation backoff and periodic fallback
   reconciliation.
- [x] Hook tests cover cursor open, cursor advance, reconnect, stale event
   suppression, conversation change, and missing `conversationId`.
