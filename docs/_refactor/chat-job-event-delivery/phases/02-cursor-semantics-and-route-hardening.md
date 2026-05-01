# Phase 02 - Cursor Semantics And Route Hardening

## Goal

Prove route-level catch-up before changing client behavior.

This phase is intentionally route and stream focused. It should not change
`useChatJobEvents()` cursor behavior yet; that belongs to Phase 03 after the
route contracts are pinned down.

## Preparation Evidence

Phase 00 provides the deterministic Keith-shaped job timeline:

- One durable `admin_web_search` job for `keith@firehose360.com`.
- Explicit `queued`, `started`, and `result` events with conversation sequences
   `1`, `2`, and `3`.
- Repeated unchanged status-tool snapshots exist only as transcript evidence;
   route tests should prove durable event catch-up, not assistant polling.

Phase 01 established the cursor split that Phase 02 must preserve:

- Conversation streams use `job_events.sequence` scoped to one conversation.
- User streams use `job_events.rowid` exposed as the stream-facing `sequence`.
- Both routes accept `afterSequence` and `Last-Event-ID`, but those cursors are
   intentionally different contracts.
- `createJobEventStreamResponse()` is the shared stream loop and must continue
   using `buildJobPublication()` through `mapJobEventPayload()`.

## Existing Coverage Before Phase 02

| Surface | Existing coverage | Phase 02 gap |
| --- | --- | --- |
| `tests/chat-job-event-baseline.test.ts` | Proves one Keith-style durable job and conversation event sequence `1`, `2`, `3`. | Reuse fixture constants or mirror the sequence in route tests. |
| `src/app/api/chat/events/route.test.ts` | Proves chat route streams normalized job parts and calls `listConversationEvents()` with `afterSequence: 0`. | Add explicit conversation cursor catch-up tests for query and `Last-Event-ID`. |
| `tests/deferred-job-events-route.test.ts` | Proves `/api/chat/events?afterSequence=3` replays durable backlog and maps canceled events. | Either consolidate with app-route tests or keep as legacy route coverage with clear ownership. |
| `src/app/api/jobs/events/route.test.ts` | Proves anonymous callers get `401` and signed-in backlog uses `listUserEvents(userId, { afterSequence })`. | Add `Last-Event-ID` and name the user rowid cursor in the test title. |
| `src/lib/jobs/job-event-stream.test.ts` | Proves initial backlog poll and audit-only publication mapping. | Add stale/duplicate ordering expectations if needed at the stream-helper boundary. |
| `src/lib/jobs/job-publication.test.ts` | Proves renderable event preference over audit-only events and synthetic fallback. | Keep as publication contract; do not duplicate this logic in route tests. |

## Implementation Evidence

Implemented on 2026-04-30.

Added or updated focused tests:

- `src/app/api/chat/events/route.test.ts` now proves conversation sequence
   catch-up from `afterSequence`, conversation sequence catch-up from
   `Last-Event-ID`, and invalid cursor fallback to `0`.
- `src/app/api/jobs/events/route.test.ts` now names the Jobs stream cursor as a
   user rowid cursor, proves `Last-Event-ID` catch-up, and proves invalid cursor
   fallback to `0`.
- `src/lib/jobs/job-event-stream.test.ts` now proves missing jobs are skipped
   while the next poll advances from the emitted event sequence.

No client hook behavior changed in this phase. `useChatJobEvents()` cursor
tracking remains Phase 03.

Verification command:

```bash
npm exec vitest run \
   tests/chat-job-event-baseline.test.ts \
   src/app/api/chat/events/route.test.ts \
   tests/deferred-job-events-route.test.ts \
   src/app/api/jobs/events/route.test.ts \
   src/lib/jobs/job-event-stream.test.ts \
   src/lib/jobs/job-publication.test.ts
```

Result:

- 6 test files passed.
- 26 tests passed.

## QA Evidence

QA completed on 2026-04-30.

Checks performed:

- Re-read Phase 02 goals, Done checklist, and validation checklist against the
   changed route and stream tests.
- Confirmed Phase 02 stayed route/stream-only and did not modify
   `useChatJobEvents()`.
- Confirmed route-level reconnect/catch-up is covered by `Last-Event-ID` plus
   durable cursor replay tests; client reconnect behavior remains Phase 03.
- Re-ran the focused Vitest command above: 6 files passed, 26 tests passed.
- Ran targeted ESLint on the changed TypeScript tests with no findings.

## Steps

1. Add a chat route test named around `conversation sequence` that calls
   `/api/chat/events?conversationId=...&afterSequence=1` and asserts
   `listConversationEvents(conversationId, { afterSequence: 1, limit: 100 })`.
2. Add a chat route test named around `Last-Event-ID conversation sequence` that
   omits the query cursor, sends `Last-Event-ID: 2`, and asserts the same
   conversation-scoped repository contract.
3. Add a chat route negative/edge test proving an invalid query or header cursor
   becomes `0` rather than throwing or suppressing backlog.
4. Add a user route test named around `user rowid cursor` that calls
   `/api/jobs/events?afterSequence=10` and asserts
   `listUserEvents(userId, { afterSequence: 10, limit: 100 })`.
5. Add a user route test named around `Last-Event-ID user rowid cursor` that
   sends `Last-Event-ID: 11` and asserts the same user-scoped repository
   contract.
6. Keep anonymous user rejection on `/api/jobs/events` as a negative case.
7. Confirm `createJobEventStreamResponse()` performs an initial backlog poll and
   advances by emitted event `sequence` without creating route-specific stream
   loops.
8. Confirm audit-only events still map through latest renderable event or
   synthetic publication fallback using `job-event-stream.test.ts` and
   `job-publication.test.ts`.
9. Document any intentionally different cursor names in test titles. Prefer
   `conversation sequence` and `user rowid cursor` over generic `sequence`.

## Test Implementation Notes

- Prefer extending `src/app/api/chat/events/route.test.ts` and
  `src/app/api/jobs/events/route.test.ts` for the canonical route tests.
- Keep `tests/deferred-job-events-route.test.ts` only if it still protects a
  broader legacy route path; otherwise Phase 08 can evaluate consolidation.
- Use the Phase 00 fixture names for Keith-shaped semantics where useful, but do
  not depend on `.data/local.db` or the live Keith conversation.
- Mock route repositories at the port boundary. Do not reach into SQLite from
  route tests unless the test is explicitly about `JobQueueDataMapper` cursor
  behavior.
- Do not change `useChatJobEvents()` in this phase. The Phase 02 output is the
  route contract that Phase 03 will consume.

## Positive Cases

- Chat route catches up from `afterSequence` using conversation event sequence.
- Chat route catches up from `Last-Event-ID` using conversation event sequence.
- Jobs route catches up from `afterSequence` using user rowid cursor semantics.
- Jobs route catches up from `Last-Event-ID` using user rowid cursor semantics.
- Stream payloads still include the canonical job status `part` and legacy event
  fields needed by current clients.

## Negative Cases

- Anonymous callers cannot open `/api/jobs/events`.
- Invalid cursor values fall back to `0` and do not block backlog replay.
- Missing jobs are skipped by the stream helper while still advancing the stream
  cursor.
- Older/equal events are not a route concern once the repository applies
  `sequence > afterSequence`; client stale-event suppression remains Phase 03.

## Edge Cases

- `Last-Event-ID` is used only when `afterSequence` is absent.
- Audit-only events such as `notification_sent` preserve useful renderable state
  through the latest renderable event lookup.
- A stream window of `0` still performs one initial backlog poll.

## Suggested Focused Command

```bash
npm exec vitest run \
  tests/chat-job-event-baseline.test.ts \
  src/app/api/chat/events/route.test.ts \
  tests/deferred-job-events-route.test.ts \
  src/app/api/jobs/events/route.test.ts \
  src/lib/jobs/job-event-stream.test.ts \
  src/lib/jobs/job-publication.test.ts
```

## Code Anchors

- `src/app/api/chat/events/route.ts`
- `src/app/api/jobs/events/route.ts`
- `src/app/api/jobs/_lib.ts`
- `src/lib/jobs/job-event-stream.ts`
- `src/lib/jobs/job-publication.ts`
- `tests/chat-job-event-baseline.test.ts`
- `src/app/api/chat/events/route.test.ts`
- `tests/deferred-job-events-route.test.ts`
- `src/app/api/jobs/events/route.test.ts`

## Done

- [x] Route tests prove catch-up by cursor.
- [x] Chat tests name `conversation sequence` explicitly.
- [x] Jobs tests name `user rowid cursor` explicitly.
- [x] Query cursor and `Last-Event-ID` are both covered.
- [x] Invalid cursor fallback is covered.
- [x] Stream helper still uses canonical job publication.
- [x] No client hook behavior changes are included in this phase.
