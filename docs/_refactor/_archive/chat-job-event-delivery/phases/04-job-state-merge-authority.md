# Phase 04 - Job State Merge Authority

## Goal

Clarify which merge layer owns latest-by-job state before presentation uses it.

## Post-09 Hard-Cutover Note

This phase is historical evidence for the pre-09 message-part merge layer.
Phases 09b-09d replaced the product DTO and active-chat store with
`CanonicalJobSnapshot`. `ConversationMessages.upsertJobStatusMessage(...)` and
`suppressStaleJobStatusMessages(...)` have been deleted; default product chat no
longer mutates messages to apply job truth.

Historical commands and test-file references below are preserved as Phase 04
evidence only. Do not run deleted `tests/conversation-messages.test.ts`
as current validation; use the 09a-09d validation commands instead.

Phase 04 prepares the derived job-state layer for Phase 05 presenter dedupe. It
should not change route behavior, EventSource cursor behavior, raw transcript
history, or nested status-tool presentation yet.

## Preparation Evidence

Phase 03 now feeds `useJobStateStore()` through the existing
`upsertJobStateEntries()` path with conversation-scoped sequence discipline.
That means Phase 04 can focus on the merge layer instead of event delivery.

Current merge surfaces:

| Surface | Current responsibility | Phase 04 decision |
| --- | --- | --- |
| `useJobStateStore()` | Holds derived latest-by-job entries for active chat and merges `seededEntries`, transcript `job_status` parts, and live/reconciled entries by `jobId`. | Keep as the active chat latest-by-job store. Add direct tests. |
| `ConversationMessages.upsertJobStatusMessage()` | Applies one explicit `job_status` part into chat message state and merges it with an existing explicit part by sequence. | Keep as message-state upsert authority for explicit job parts. Decide whether it should reuse a shared merge primitive. |
| `ConversationMessages.suppressStaleJobStatusMessages()` | Removes older explicit job-status message parts from derived presentation input while leaving source messages unchanged. | Keep as derived presentation cleanup. It is not nested status-tool dedupe. |
| `usePresentedChatMessages()` | Applies `jobStateEntries` to messages with `upsertJobStatusMessage()`, then suppresses stale explicit job-status messages before `ChatPresenter`. | Keep as the bridge from durable job truth to presenter input. |
| `job-snapshot-reducer.ts` | Owns Jobs workspace snapshot freshness by sequence and `updatedAt`. | Retain separately unless a tiny shared freshness primitive is clearly useful. Do not import chat presenter/store types here. |

Drift and duplication found:

- `useJobStateStore.mergeJobStatusPart()` and
   `ConversationMessages.mergeJobStatusMessagePart()` duplicate most field merge
   behavior.
- The Jobs workspace reducer has a separate `compareSnapshotFreshness()` that
   uses sequence first, then `updatedAt`; the chat merge helpers currently use
   sequence only and treat equal sequence as incoming-wins.
- There is no `src/hooks/chat/useJobStateStore.test.tsx` in the current
   workspace despite the phase plan naming one.
- `ConversationMessages.test.ts` covers terminal-over-running and stale explicit
   message suppression, but does not yet cover equal sequence, missing sequence,
   missing `updatedAt`, or raw-history immutability explicitly.
- `usePresentedChatMessages.test.tsx` proves durable job snapshots replace stale
   transcript explicit job parts and suppress duplicate explicit job-status
   messages before presentation.

## Implementation Evidence

Implemented on 2026-04-30.

Changed merge authority:

- Added `src/lib/jobs/job-status-part-merge.ts` as the shared framework-free
   job-status part merge helper.
- Updated `useJobStateStore()` and `ConversationMessages.upsertJobStatusMessage()`
   to use the shared helper.
- Kept Jobs workspace freshness separate in `job-snapshot-reducer.ts` because it
   merges workspace snapshots and selected history, not chat message parts.

Added or updated focused tests:

- `src/hooks/chat/useJobStateStore.test.tsx` now directly covers newer terminal
   updates, older stale updates, equal-sequence merging, missing sequence,
   null-clearing fields, conversation changes, and null conversation behavior.
- `tests/conversation-messages.test.ts` now covers terminal over
   stale running updates, equal-sequence merging, missing sequence, missing
   `updatedAt`, equal-sequence null-clearing fields, and raw message immutability
   during stale suppression.
- `src/hooks/usePresentedChatMessages.test.tsx` now proves durable job truth is
   applied before presentation without mutating raw message history.

Verification command:

```bash
npm exec vitest run \
   src/hooks/chat/useJobStateStore.test.tsx \
   tests/conversation-messages.test.ts \
   src/hooks/usePresentedChatMessages.test.tsx \
   src/hooks/chat/useChatJobEvents.test.tsx
```

Result:

- 4 test files passed.
- 30 tests passed.

QA follow-up on 2026-04-30:

- Audited Phase 04 Done items against executable tests.
- Found and fixed an evidence gap: `ConversationMessages` had shared-helper
   coverage indirectly through `useJobStateStore()` for missing sequence and
   null-clearing behavior, but not direct message-upsert tests.
- Added direct `ConversationMessages` coverage for missing sequence as lower
   priority than numeric sequence.
- Added direct `ConversationMessages` coverage for equal-sequence `null` values
   intentionally clearing stale progress/result-envelope fields.
- Tightened `useJobStateStore` assertions so `null` clearing is distinguished
   from omitted fields.

Additional validation:

```bash
npm exec eslint \
   src/lib/jobs/job-status-part-merge.ts \
   src/hooks/chat/useJobStateStore.ts \
   src/hooks/chat/useJobStateStore.test.tsx \
   src/core/services/ConversationMessages.ts \
   tests/conversation-messages.test.ts \
   src/hooks/usePresentedChatMessages.test.tsx
```

Result: no findings.

## Steps

1. Add direct tests for `useJobStateStore()` because no current test file exists.
2. Review and document whether chat merge behavior should remain duplicated or
   move into a small shared pure helper.
3. If shared, keep the helper framework-free and local to the chat/job state
   layer; do not introduce repository, SQLite, or presenter dependencies.
4. Preserve the existing layer ownership:
   `useJobStateStore()` owns derived active-chat latest-by-job entries,
   `ConversationMessages` owns message-state upsert/suppression, and
   `usePresentedChatMessages()` owns applying durable truth before presentation.
5. Add tests for terminal-over-running, equal-sequence duplicates, missing
   sequence, missing `updatedAt`, and null-clearing fields such as
   `progressPercent`, `progressLabel`, and `resultEnvelope`.
6. Ensure raw message history remains unchanged while derived state is deduped.
7. Confirm Jobs workspace reducer freshness remains separate unless a genuinely
   reusable primitive emerges.

## Required Test Additions

Create `src/hooks/chat/useJobStateStore.test.tsx` or another focused hook test
file that proves:

1. A newer terminal job entry replaces an older running entry for the same
   `jobId`.
2. An older running entry cannot regress a newer terminal entry.
3. Equal sequence entries merge deterministically and preserve non-null useful
   fields from the prior entry when the incoming entry omits them.
4. Incoming `null` fields intentionally clear stale progress/result-envelope
   fields where current merge behavior supports that.
5. Missing `sequence` is treated as lower priority than a numeric sequence.
6. Changing `conversationId` clears ephemeral store entries.
7. Passing `conversationId: null` clears active derived entries and ignores
   incoming upserts.

Extend `tests/conversation-messages.test.ts` to prove:

1. `upsertJobStatusMessage()` keeps a terminal explicit job-status part over an
   older running update.
2. Equal-sequence explicit parts have documented incoming-wins behavior or use
   the new shared helper behavior if Phase 04 consolidates it.
3. Missing `updatedAt` does not throw and does not produce invalid timestamps.
4. `suppressStaleJobStatusMessages()` returns derived messages without mutating
   the original raw message array.

Extend `src/hooks/usePresentedChatMessages.test.tsx` only if needed to prove the
bridge applies durable job truth before presenter input without mutating the raw
messages.

Suggested focused command:

```bash
npm exec vitest run \
  src/hooks/chat/useJobStateStore.test.tsx \
  tests/conversation-messages.test.ts \
  src/hooks/usePresentedChatMessages.test.tsx \
  src/hooks/chat/useChatJobEvents.test.tsx
```

If the `useJobStateStore` test is created as `.test.ts` instead of `.test.tsx`,
update this command and the phase evidence.

## Code Anchors

- `src/hooks/chat/useJobStateStore.ts`
- `src/hooks/chat/useJobStateStore.test.tsx` or `src/hooks/chat/useJobStateStore.test.ts`
- `src/core/services/ConversationMessages.ts`
- `tests/conversation-messages.test.ts`
- `src/hooks/usePresentedChatMessages.ts`
- `src/hooks/usePresentedChatMessages.test.tsx`
- `src/components/jobs/job-snapshot-reducer.ts`
- `src/components/jobs/job-snapshot-reducer.test.ts`

## Positive Cases

- Latest durable job state replaces older explicit transcript job state before
   presentation.
- Terminal statuses are not regressed by stale running statuses.
- Equal sequence behavior is deterministic and documented.
- Derived dedupe does not mutate raw message history.

## Negative Cases

- Browser hooks, presenters, and UI reducers do not reach into repositories or
   SQLite.
- Phase 04 does not perform nested `get_deferred_job_status` presenter dedupe;
   that remains Phase 05.
- Phase 04 does not change SSE cursor, route, Push, or status-tool behavior.

## Edge Cases

- Missing `sequence` values.
- Missing or invalid `updatedAt` values.
- Equal sequence with partial payloads.
- Incoming `null` values that intentionally clear stale progress fields.
- Conversation changes and `conversationId: null` store cleanup.

## Done

- [x] Latest-by-job state has one clear authority per layer.
- [x] Any duplicate freshness helper has a documented reason or is removed.
- [x] `useJobStateStore()` has direct tests for newer, older, equal, missing
   sequence, conversation change, and null-conversation behavior.
- [x] `ConversationMessages` tests cover terminal-over-running, equal sequence,
   missing `updatedAt`, and raw-history immutability.
- [x] `usePresentedChatMessages` bridge coverage still proves durable truth is
   applied before presenter input.
- [x] No repository, SQLite, route, EventSource, Push, or status-tool behavior is
   changed in this phase.
