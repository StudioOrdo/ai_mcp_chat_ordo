# Chat Job Event Delivery Contract Spec

Status: ready for implementation planning
Date: 2026-04-30
Owner surface: chat transcript, Jobs rail, jobs workspace, notification system

## 1. Purpose

Deferred work in Studio Ordo must update the chat and jobs surfaces from durable
job truth, not from repeated assistant status polling.

This contract defines the target behavior for reliable in-chat job updates:

- durable event log first
- SSE/EventSource for active chat updates
- snapshot reconciliation for missed events
- presentation dedupe for repeated status artifacts
- optional browser Push API for background notification only

The goal is to make jobs feel live and trustworthy while preventing transcript
spam like repeated `get_deferred_job_status` cards for the same job state.

## 2. Incident Evidence

### User And Conversation

- User: `keith@firehose360.com`
- User ID: `usr_a3a9341d-de18-4e2f-ba7b-fc244414121f`
- Conversation ID: `conv_837e0675-bde1-4db8-a433-5a65e4cf2f95`
- User request: `now make research using the web what the latest llm model news is`

### Durable Job Truth

One durable job existed for the request:

- Job ID: `job_076cf2d0-dc0d-4581-a239-89c892f9ab76`
- Tool: `admin_web_search`
- Status: `succeeded`
- Query: `latest LLM model news 2025`
- Durable events: `queued`, `started`, `result`

### Transcript Artifacts

The assistant message contained:

- one `admin_web_search` tool call
- one deferred job result for that call
- five repeated `get_deferred_job_status` calls for the same `jobId`
- repeated identical `running` snapshots with `sequence = 2`
- one final `succeeded` job status with `sequence = 3`

### Five Whys Summary

1. The conversation looked spammed because repeated status snapshots were
   rendered as visible job activity.
2. The repeated snapshots existed because the assistant repeatedly called
   `get_deferred_job_status` while waiting.
3. The assistant could do that because status tools are available as normal
   assistant tools and there is no hard runtime throttle for unchanged job
   status reads.
4. The rail showed one job because the durable job model and rail projection
   dedupe by `jobId` and latest sequence.
5. The mismatch happened because chat presented transcript/tool activity while
   the rail presented durable operational truth.

## 3. Product Contract

### 3.1 In-Chat Job Updates

The chat surface must show a single current card per durable job unless the user
explicitly opens history or diagnostics.

For one `jobId`, the default chat view must render only the latest meaningful
status snapshot:

- higher `sequence` replaces lower `sequence`
- equal `sequence` with identical `status` and `updatedAt` is duplicate noise
- terminal states replace running states
- result payload is retained from the latest terminal/result event

The chat transcript may retain raw tool history for export/diagnostics, but the
default product view must be deduped.

### 3.2 Jobs Rail

The Jobs rail remains the compact operational truth surface.

It must continue to:

- dedupe by `jobId`
- prefer latest sequence and latest `updatedAt`
- filter canceled/superseded jobs from the default list where appropriate
- use durable job status, not transcript count, for badges and rows

### 3.3 Assistant Behavior

The assistant should not repeatedly call `get_deferred_job_status` as a waiting
loop.

Allowed uses:

- explicit user asks for status
- diagnostic inspection
- recovering after reconnect if event stream is unavailable
- one-time check when a job ID is referenced but not present in local state

Disallowed default behavior:

- calling the same status tool repeatedly for the same `jobId` without an event,
  sequence, or user-intent change
- rendering repeated unchanged status cards into the chat transcript

### 3.4 Background Notifications

Browser Push API is optional and permission-gated.

It should only notify terminal or attention-worthy state changes:

- `succeeded`
- `failed`
- `dead_letter`
- possibly long-running `needs_input` states

It must not be required for active chat correctness.

## 4. Source-Of-Truth Contract

Phase 01 inventory is recorded in
[phases/01-contract-and-surface-inventory.md](phases/01-contract-and-surface-inventory.md).
The inventory assigns current owners for durable state, route contracts, client
hooks, presentation helpers, and adjacent Push/browser-runtime boundaries.

### 4.1 Durable Tables

The authoritative data remains:

- `job_requests`: current job state
- `job_events`: append-only event timeline

The UI may render projections from messages, but messages do not define whether
a job is actually running, completed, or failed.

### 4.2 Canonical Publication

All job delivery channels must use the same publication contract:

```text
JobRequest + JobEvent
  -> buildJobPublication()
  -> JobStatusMessagePart
  -> channel-specific payload
```

Existing anchor:

- [src/lib/jobs/job-publication.ts](../../../src/lib/jobs/job-publication.ts)

### 4.3 Event Cursor

Each live job stream must use a monotonic cursor.

Conversation-scoped cursor:

- based on `job_events.sequence` within a conversation
- endpoint: [src/app/api/chat/events/route.ts](../../../src/app/api/chat/events/route.ts)

User-scoped cursor:

- currently based on `job_events.rowid` as `user_sequence` through
  `listUserEvents`
- endpoint: [src/app/api/jobs/events/route.ts](../../../src/app/api/jobs/events/route.ts)

Implementation must document and test both cursor semantics. If they remain
different, they must be named differently in code and tests so consumers do not
mix conversation sequence and user sequence.

## 5. Transport Contract

### 5.1 Active Chat

Use EventSource/SSE as the active chat transport.

The active chat hook must:

- subscribe when `conversationId` exists
- pass `afterSequence` where possible
- update `JobStateEntry` via `upsertJobStateEntries`
- dispatch job status events into chat state
- reconcile on open, error, focus, visible tab, and periodic fallback
- close the stream on conversation change or unmount

Existing anchor:

- [src/hooks/chat/useChatJobEvents.ts](../../../src/hooks/chat/useChatJobEvents.ts)

Implementation note:

- [src/app/api/chat/events/route.ts](../../../src/app/api/chat/events/route.ts)
  already accepts `afterSequence` and `Last-Event-ID`.
- [src/components/jobs/useJobsEventStream.ts](../../../src/components/jobs/useJobsEventStream.ts)
  already tracks `lastSequenceRef` for the jobs workspace.
- The active chat hook should adopt the same cursor discipline instead of
  relying only on snapshot reconciliation plus a cursorless EventSource URL.

### 5.2 Jobs Workspace

Use the user-scoped SSE stream and durable catch-up for the jobs workspace.

Existing anchor:

- [src/components/jobs/useJobsEventStream.ts](../../../src/components/jobs/useJobsEventStream.ts)

### 5.3 Browser Push

Use Browser Push only for away-from-chat notifications.

Push payloads must include enough routing context to open the right view:

```json
{
  "title": "Studio Ordo",
  "body": "A job finished.",
  "url": "/jobs?jobId=job_...",
  "conversationId": "conv_...",
  "jobId": "job_...",
  "status": "succeeded"
}
```

Existing anchors:

- [public/push-worker.js](../../../public/push-worker.js)
- [src/app/api/notifications/push/route.ts](../../../src/app/api/notifications/push/route.ts)

## 6. Presentation Dedupe Contract

### 6.1 Dedupe Key

Default chat presentation must dedupe job cards with this identity:

```ts
type JobRenderIdentity = {
  jobId: string;
};
```

Freshness comparison:

1. highest `sequence`
2. latest `updatedAt`
3. terminal status beats active status when sequence is tied
4. result payload beats empty payload when sequence is tied

Duplicate suppression key:

```ts
type DuplicateStatusKey = {
  jobId: string;
  sequence: number | null;
  status: string;
  updatedAt: string | null;
};
```

### 6.2 Explicit Job Status Parts

Existing `job_status` message parts are already reconciled through:

- [src/core/services/ConversationMessages.ts](../../../src/core/services/ConversationMessages.ts)
- [src/hooks/usePresentedChatMessages.ts](../../../src/hooks/usePresentedChatMessages.ts)

This behavior must be preserved and extended to account for nested job snapshots
inside tool results.

### 6.3 Nested Status Tool Results

`get_deferred_job_status` and `list_deferred_jobs` tool results can contain job
snapshots inside `tool_result.result`.

The default presenter must not render repeated nested snapshots for the same job
when a newer explicit `job_status` part or job-state entry exists.

Existing anchor:

- [src/adapters/ChatPresenter.ts](../../../src/adapters/ChatPresenter.ts)

Existing consolidation anchor:

- [src/lib/chat/JobRenderCandidateMerger.ts](../../../src/lib/chat/JobRenderCandidateMerger.ts)

Implementation note:

- The current presenter dedupes nested snapshots by `jobId` within one message
  using `renderedJobIds`.
- The refactor must add freshness-aware selection before creating visible render
  entries so the first repeated nested snapshot is not blindly accepted when a
  later snapshot for the same job appears in the same message.
- Cross-message durable truth should continue to flow through
  [src/hooks/usePresentedChatMessages.ts](../../../src/hooks/usePresentedChatMessages.ts).
- `JobRenderCandidateMerger.ts` already contains render-candidate freshness
  primitives. Reuse or promote that path before adding another latest-by-job
  comparator. If message-state, Jobs workspace, and presenter snapshots cannot
  share one helper type, share only a smaller freshness primitive and document
  why the boundaries differ.

## 7. Assistant And Tool Guardrail Contract

### 7.1 Runtime Guardrail

The app should introduce a runtime-level repeated status read guard.

Candidate behavior:

- track last status result per assistant response for `jobId`
- if the next status read returns the same `jobId`, `status`, and `sequence`,
  return a compact non-rendering result or mark it as duplicate
- do not persist another visible tool result when the status is unchanged

This guard must not block explicit user commands or diagnostics.

### 7.2 Prompt Guardrail

Update job capability prompt hints so the assistant knows the product contract:

- start or inspect once
- summarize current state once
- rely on event stream for waiting
- do not poll repeatedly unless the user explicitly asks

Existing anchor:

- [src/core/capability-catalog/families/job-capabilities.ts](../../../src/core/capability-catalog/families/job-capabilities.ts)

### 7.3 Tool Availability

Do not remove these tools:

- `get_deferred_job_status`
- `list_deferred_jobs`
- `get_my_job_status`
- `list_my_jobs`

They remain valuable for explicit inspection, diagnostics, and administrative
workflows.

Existing eval and live-runner scenarios that mark status tools as `must_use` for
missed-SSE recovery must be rewritten after the hook-level recovery path is in
place. Status tools remain expected for explicit user status requests,
diagnostics, and deterministic fixture setup.

## 8. Failure And Recovery Contract

The system must handle:

- EventSource unavailable: fall back to timed reconciliation.
- EventSource reconnect: reconcile before trusting new events.
- Server restart: reconnect and catch up from durable events/snapshots.
- Missed event: reconcile latest snapshot from `job_requests`.
- Duplicate event: ignore if sequence is older or equal to last applied.
- Duplicate transcript snapshot: suppress from default presentation.
- Closed tab: optional browser push can notify terminal state; next open still
  reconciles from durable data.

## 9. Architecture And Design Pattern Contract

Phase 01 confirmed these existing owners should be reused:

- [src/adapters/JobQueueDataMapper.ts](../../../src/adapters/JobQueueDataMapper.ts)
  owns durable repository access and the two cursor meanings.
- [src/lib/jobs/job-event-stream.ts](../../../src/lib/jobs/job-event-stream.ts)
  owns the shared SSE stream loop.
- [src/lib/jobs/job-publication.ts](../../../src/lib/jobs/job-publication.ts)
  owns job-to-status-publication mapping.
- [src/hooks/chat/useChatJobEvents.ts](../../../src/hooks/chat/useChatJobEvents.ts)
  owns active-chat event subscription and reconciliation.
- [src/components/jobs/useJobsEventStream.ts](../../../src/components/jobs/useJobsEventStream.ts)
  remains the reference for cursor discipline.
- [src/hooks/usePresentedChatMessages.ts](../../../src/hooks/usePresentedChatMessages.ts)
  owns applying durable job truth before presenter view-model creation.
- [src/lib/chat/JobRenderCandidateMerger.ts](../../../src/lib/chat/JobRenderCandidateMerger.ts)
  remains the preferred presenter-level freshness consolidation point.

This refactor must extend the current architecture rather than introduce a new
job delivery subsystem.

Use these existing patterns:

- Adapter: keep `job-publication.ts` as the durable-job-to-presentation adapter.
- Template Method: keep `createJobEventStreamResponse()` as the shared stream
  loop with route-specific callbacks.
- Strategy: keep event parsing in `EventParserStrategy` and related parsers.
- Repository: use `JobQueueRepository` and route APIs; do not reach into SQLite
  from browser hooks or presenters.
- Presenter/View Model: perform visible transcript dedupe before UI card
  rendering, not inside individual React cards.
- Store/Reducer: keep latest-by-job merge behavior in pure merge helpers that
  can be unit-tested.

Avoid:

- WebSockets for this specific problem unless SSE plus reconciliation is proven
  insufficient.
- A second job event log outside `job_events`.
- Component-level duplicate hiding that leaves duplicate render entries in the
  view model.
- Duplicate JSON snapshot parsing outside `job-status-snapshots.ts`.

## 10. Dead-Code Cleanup Contract

The implementation is not complete until the cleanup pass is done.

Remove or rewrite:

- tests that intentionally expect repeated unchanged status-tool results to
  render as repeated visible cards
- duplicate freshness comparison helpers if the same logic appears in more than
  one production file
- obsolete prompt hints that suggest repeated status reads are the normal wait
  path
- eval expectations and runner fixtures that require `list_deferred_jobs` or
  `get_deferred_job_status` as the normal missed-SSE recovery path
- fixture code that depends on the developer `.data/local.db` instead of
  deterministic test fixtures
- fallback paths that become unreachable after cursor catch-up, if tests prove
  they are no longer needed

Retain:

- explicit status tools for user-requested inspection and diagnostics
- raw transcript history for export/admin inspection
- browser push subscription routes and service worker support
- job event history and jobs workspace timelines

## 11. Acceptance Criteria

### Product

- One web search request creates one visible job card by default.
- Repeated unchanged status reads do not create repeated visible cards.
- Jobs rail badge matches durable job state, not transcript artifact count.
- The chat card updates from running to completed via job event delivery.
- Browser reload shows the completed job once.
- Closing and reopening the Jobs drawer shows the same durable job state.

### Technical

- `/api/chat/events` emits durable job events using canonical publication.
- `useChatJobEvents` can catch up after disconnect without assistant polling.
- Nested status snapshots inside status-tool results are deduped at presentation.
- Prompt/tool guardrails prevent repeated unchanged status polling loops.
- Browser push, if enabled, is terminal-state notification only.

## 12. Non-Goals

- Replacing SSE with WebSockets.
- Making Push API mandatory.
- Removing status tools.
- Hiding raw tool history from exports or diagnostics.
- Reworking the entire job queue.
- Changing durable job statuses.
