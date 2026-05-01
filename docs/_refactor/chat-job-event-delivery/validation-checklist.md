# Chat Job Event Delivery Validation Checklist

## Unit Tests

- [x] `ChatPresenter` renders one visible job-status entry for a message with
  repeated `get_deferred_job_status` snapshots for the same `jobId` and
  unchanged `sequence`.
- [x] `ChatPresenter` selects the freshest nested snapshot when one assistant
  message contains multiple snapshots for the same `jobId`.
- [x] `ChatPresenter` uses the shared render-candidate freshness path or a
  documented smaller primitive instead of a local first-wins `renderedJobIds`
  strategy.
- [x] `ChatPresenter` prefers a final `succeeded` explicit `job_status` part over
  stale nested `running` snapshots.
- [x] `usePresentedChatMessages` suppresses stale explicit job-status messages
  after job truth is applied.
- [x] `useJobStateStore` keeps the latest sequence per `jobId` and does not
  regress from terminal to running.
- [x] `useJobStateStore` clears ephemeral entries on conversation change and
  ignores incoming upserts when `conversationId` is null.
- [x] `ConversationMessages` job-status merge behavior is covered for equal
  sequence, missing sequence, missing `updatedAt`, and null-clearing fields.
- [x] Derived job-state and presentation dedupe do not mutate raw message
  history.
- [x] `useChatJobEvents` opens EventSource with the latest known
  conversation-scoped `afterSequence` cursor after initial reconciliation.
- [x] `useChatJobEvents` ignores older or equal-sequence stream events after a
  newer snapshot has already been reconciled.
- [x] `useChatJobEvents` advances its conversation cursor from accepted live job
  stream events and later reconciliation snapshots.
- [x] `useChatJobEvents` resets cursor state on conversation change and closes
  the old EventSource.
- [x] `useChatJobEvents` keeps missing-conversation backoff behavior after cursor
  tracking is added.
- [ ] `resolveJobsRail` keeps one item/count for repeated entries with the same
  `jobId`.
- [x] Prompt directive tests include the no repeated wait-loop guidance for job
  status tools.

Suggested focused command:

```bash
npm exec vitest run \
  src/adapters/ChatPresenter.test.ts \
  src/lib/chat/JobRenderCandidateMerger.test.ts \
  src/hooks/usePresentedChatMessages.test.tsx \
  src/hooks/chat/useChatJobEvents.test.tsx \
  src/hooks/chat/useJobStateStore.test.tsx \
  src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts \
  src/core/capability-catalog/prompt-directive-unification.test.ts
```

Adjust file list if exact test locations change.

If `src/lib/chat/JobRenderCandidateMerger.test.ts` does not exist yet, add it
or cover the shared helper behavior through `src/adapters/ChatPresenter.test.ts`
with an explicit note in closeout.

## Route And Stream Tests

- [x] `/api/chat/events?afterSequence=N` returns only events newer than `N`.
- [x] `/api/chat/events` honors `Last-Event-ID` as the conversation-scoped
  sequence cursor when `afterSequence` is absent.
- [x] `/api/chat/events` falls back to `0` for invalid cursor values.
- [x] `/api/jobs/events?afterSequence=N` documents and tests user-scoped cursor
  semantics.
- [x] `/api/jobs/events` honors `Last-Event-ID` as the user rowid cursor when
  `afterSequence` is absent.
- [x] `/api/jobs/events` route tests name the user cursor as rowid-derived, not
  conversation sequence.
- [x] `createJobEventStreamResponse` emits canonical publication payloads.
- [x] `createJobEventStreamResponse` skips missing jobs while advancing by the
  event sequence.
- [x] Event stream ignores audit-only events or resolves them to latest renderable
  job state.
- [x] Route-level reconnect catch-up is covered by `Last-Event-ID` and durable
  cursor replay tests; client reconnect behavior remains Phase 03.

Suggested focused command:

```bash
npm exec vitest run \
  tests/chat-job-event-baseline.test.ts \
  src/app/api/chat/events/route.test.ts \
  tests/deferred-job-events-route.test.ts \
  src/app/api/jobs/events/route.test.ts \
  src/lib/jobs/job-event-stream.test.ts \
  src/lib/jobs/job-publication.test.ts \
  src/components/jobs/useJobsEventStream.test.tsx
```

Canonical route tests now live under the app route tree where available:
[src/app/api/chat/events/route.test.ts](../../../src/app/api/chat/events/route.test.ts)
and [src/app/api/jobs/events/route.test.ts](../../../src/app/api/jobs/events/route.test.ts).
The older [tests/deferred-job-events-route.test.ts](../../../tests/deferred-job-events-route.test.ts)
still provides useful legacy route coverage until Phase 08 evaluates whether it
should be consolidated.

## Database Fixtures

- [ ] Seed one `admin_web_search` job with `queued`, `started`, and `result`
  events.
- [ ] Seed one assistant message with repeated `get_deferred_job_status` tool
  results for that job.
- [ ] Assert durable job count is one.
- [ ] Assert visible chat card count is one.
- [ ] Assert Jobs rail count is one.

The Keith local fixture can be used as investigation evidence, but automated
tests should use deterministic fixtures rather than the developer's `.data`
database.

## Browser Tests

- [ ] Start a deferred job from chat.
- [ ] Confirm the chat renders one compact job card while running.
- [ ] Confirm Jobs rail badge shows one job.
- [ ] Wait for completion via SSE or controlled fixture event.
- [ ] Confirm the same card updates to completed instead of appending duplicates.
- [ ] Reload the page and confirm one completed card remains.
- [ ] Open Jobs drawer and confirm one completed row for the job.
- [ ] Simulate EventSource failure, then focus/visibility change, and confirm
  reconciliation restores latest state.

Suggested browser command shape:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/browser-ui/job-event-delivery.spec.ts
```

## Push Notification Tests

Browser push is optional for this package's core correctness.

- [ ] Subscription API rejects anonymous users.
- [ ] Subscription API upserts signed-in subscriptions.
- [ ] Terminal job event builds a notification payload with `jobId`,
  `conversationId`, `status`, and URL.
- [ ] Service worker click opens or focuses the target URL.
- [ ] Push notifications are tagged by `jobId`.

## Cleanup And Dead-Code Tests

- [ ] No test expects repeated unchanged status-tool snapshots to produce
  repeated visible cards.
- [ ] No new duplicate freshness helper exists outside the intended presenter or
  job-state merge module.
- [ ] Duplicate presenter media-truth helper logic is removed or explicitly
  retained with a boundary reason.
- [ ] Eval scenarios no longer require status tools as the normal missed-SSE
  recovery proof unless the scenario is explicitly about user-requested status
  inspection.
- [ ] Runner fixtures no longer synthesize repeated status reads as the default
  recovery path.
- [ ] Prompt directive tests prove repeated wait-loop polling is discouraged.
- [ ] Raw transcript/export or diagnostics still expose original tool history
  where intended.
- [ ] Explicit status-tool requests still work after assistant wait-loop
  suppression.
- [ ] Compose-media synthetic browser job compatibility is documented or handed
  off to the compose-media execution ownership package.

## Manual QA

- [ ] Ask for a live web search as admin.
- [ ] Confirm the assistant does not repeatedly call status tools while waiting.
- [ ] Confirm the chat card updates through job events.
- [ ] Confirm a manual `what is the job status?` request can still use the status
  tool once and summarize clearly.
- [ ] Confirm diagnostic/export output still contains raw history when needed.
- [ ] Confirm active chat job updates still work when browser Push is disabled,
  denied, or unavailable.

## Release Evidence

Record:

- commands run
- test files and pass/fail counts
- browser scenario notes
- database fixture summary
- screenshots or traces if the browser scenario changes visible UI
- residual risks and follow-up issues
