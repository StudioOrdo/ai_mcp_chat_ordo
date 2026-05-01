# Chat Job Event Delivery QA Review

Date: 2026-04-30
Status: package QA complete; implementation not started

## Verdict

The package is directionally correct and grounded in the current architecture.
The implementation should extend the existing job publication, SSE, snapshot,
presenter, and rail projection seams rather than introduce a new transport or a
parallel job model.

The main spec gaps found during QA were:

- missing explicit dead-code cleanup criteria after the refactor
- missing design-pattern guidance for where dedupe/cursor logic should live
- suggested test paths that did not fully match the current repo
- insufficient negative and edge tests for stale nested status-tool snapshots
- no explicit requirement to preserve raw history while deduping the default
  product presentation

This QA pass updates the package expectations without changing production code.

## Current Code Grounding

### Existing Architecture To Reuse

The current implementation already has the right backbone:

- [src/app/api/chat/events/route.ts](../../../src/app/api/chat/events/route.ts)
  accepts `afterSequence` and streams conversation-scoped durable job events.
- [src/app/api/jobs/events/route.ts](../../../src/app/api/jobs/events/route.ts)
  streams signed-in user job events using user-scoped cursor semantics.
- [src/lib/jobs/job-event-stream.ts](../../../src/lib/jobs/job-event-stream.ts)
  is the Template Method-style stream loop shared by both routes.
- [src/lib/jobs/job-publication.ts](../../../src/lib/jobs/job-publication.ts)
  is the canonical publication factory/adapter from `JobRequest + JobEvent` to
  `JobStatusMessagePart` and stream payload.
- [src/hooks/chat/useChatJobEvents.ts](../../../src/hooks/chat/useChatJobEvents.ts)
  already performs active-chat EventSource subscription plus snapshot
  reconciliation.
- [src/components/jobs/useJobsEventStream.ts](../../../src/components/jobs/useJobsEventStream.ts)
  already tracks `lastSequenceRef` for user-scoped jobs workspace events.
- [src/hooks/chat/useJobStateStore.ts](../../../src/hooks/chat/useJobStateStore.ts)
  already merges by `jobId` and sequence.
- [src/adapters/ChatPresenter.ts](../../../src/adapters/ChatPresenter.ts)
  already extracts nested job status snapshots from tool results.
- [src/hooks/usePresentedChatMessages.ts](../../../src/hooks/usePresentedChatMessages.ts)
  already applies durable job truth and suppresses stale explicit job-status
  messages.
- [src/frameworks/ui/jobs-rail/resolve-jobs-rail.ts](../../../src/frameworks/ui/jobs-rail/resolve-jobs-rail.ts)
  already projects deduped operational truth for the Jobs rail.

### Current Implementation Pressure

- `useChatJobEvents` currently opens `/api/chat/events?conversationId=...`
  without passing an `afterSequence` cursor, even though the route and stream
  helper already support one.
- `useJobsEventStream` already has the stronger cursor pattern and should be the
  reference implementation for active chat.
- `ChatPresenter` uses `renderedJobIds` to avoid duplicate job cards within one
  presented message, but it does not compare freshness between repeated nested
  snapshots before rendering the first one.
- `usePresentedChatMessages` reconciles explicit `job_status` parts against
  durable job truth, but nested status-tool snapshots can still enter through
  `ChatPresenter` before cross-message suppression has enough context.
- Job status prompt hints in
  [src/core/capability-catalog/families/job-capabilities.ts](../../../src/core/capability-catalog/families/job-capabilities.ts)
  still encourage summarizing status reads but do not explicitly forbid
  repeated unchanged wait-loop polling.

## Design Pattern QA

The implementation should use the existing patterns already present in the repo:

- **Adapter**: keep `job-publication.ts` as the adapter from durable queue state
  to stream/chat presentation payloads.
- **Template Method**: keep `createJobEventStreamResponse()` as the shared route
  streaming algorithm with route-specific `listEvents` and auth/conversation
  resolution injected by callers.
- **Strategy**: continue using `EventParserStrategy` for stream event parsing
  instead of scattering event-type conditionals across UI hooks.
- **Repository**: continue accessing durable job state through
  `JobQueueRepository`; do not read SQLite directly from hooks or presenters.
- **Presenter / View Model**: keep transcript dedupe in presenter/message
  projection code, not in React components or card renderers.
- **Reducer / Store**: keep latest-by-job merge behavior in job state store or a
  small pure helper that can be tested independently.

Patterns to avoid:

- a new WebSocket service for this problem
- a second job event bus parallel to `job_events`
- React-component-level dedupe that only hides DOM nodes after duplicate view
  models have already been created
- ad hoc JSON-shape checks duplicated outside `job-status-snapshots.ts`
- direct database access in browser hooks or presenters

## SOLID QA

- **Single Responsibility**: cursor tracking belongs in the event hook; stream
  encoding belongs in `job-event-stream.ts`; publication belongs in
  `job-publication.ts`; visible dedupe belongs in presentation/read-model code.
- **Open/Closed**: adding future deferred tools must not require new stream
  routes or new Jobs rail dedupe branches. Tool-specific result actions can stay
  in presentation registries/resolvers.
- **Liskov Substitution**: stream payloads produced by chat events and jobs
  workspace events must remain parseable as the same job stream event family.
- **Interface Segregation**: active chat should depend on a narrow job event
  stream and snapshot endpoint, not the whole jobs workspace API.
- **Dependency Inversion**: routes depend on repository interfaces and injected
  callbacks; hooks depend on HTTP/EventSource, not concrete persistence.

## Dead-Code And Cleanup Requirements

After implementation, remove or rewrite code that only exists to compensate for
assistant polling noise.

Cleanup candidates must be verified before deletion:

- stale tests that expect repeated status-tool results to render as repeated
  visible job cards
- duplicate helper logic if freshness comparison is introduced in more than one
  file
- any route or hook fallback that becomes unreachable after cursor-based catch-up
  is implemented
- obsolete prompt lines that imply repeated status reads are the normal waiting
  path
- fixture data or test helpers that use the developer `.data/local.db` instead
  of deterministic test fixtures

Do not remove:

- `get_deferred_job_status`, `list_deferred_jobs`, `get_my_job_status`, or
  `list_my_jobs`
- raw transcript export/diagnostic visibility
- existing browser push subscription APIs
- the Jobs rail projection contract
- job event history or admin inspection surfaces

## Positive Test Coverage Required

- One `admin_web_search` deferred job produces one visible chat job card.
- A running card updates to `succeeded` from SSE and reconciliation.
- Reconnect catches up from `afterSequence` without assistant polling.
- Jobs rail count remains one for repeated entries with the same `jobId`.
- Manual user request for job status still produces one clear summary.

## Negative Test Coverage Required

- Repeated unchanged `get_deferred_job_status` results do not create repeated
  visible job cards.
- Older sequence events do not regress a terminal job state.
- Equal-sequence duplicate events do not change the visible model.
- Browser Push disabled or unavailable does not affect active chat correctness.
- Anonymous users cannot subscribe to browser push or jobs workspace streams.

## Edge Test Coverage Required

- Audit-only events fall back to the latest renderable event or synthetic job
  state through `buildJobPublication()`.
- `dead_letter` maps to failed/attention-worthy presentation and optional push.
- `canceled` remains visible when it is the latest state and is not hidden as a
  duplicate.
- Same job id appears in both explicit `job_status` parts and nested status-tool
  results; explicit/latest durable truth wins.
- Same assistant message contains multiple nested snapshots for one job; the
  freshest one wins before render entries are created.
- Conversation-scoped sequence and user-scoped `rowid` cursor semantics remain
  named and tested separately.

## Required QA Commands

Use existing files where possible:

```bash
npm exec vitest run \
  src/adapters/ChatPresenter.test.ts \
  src/hooks/usePresentedChatMessages.test.tsx \
  src/hooks/chat/useChatJobEvents.test.tsx \
  src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts \
  src/lib/jobs/job-event-stream.test.ts \
  src/lib/jobs/job-publication.test.ts \
  tests/deferred-job-events-route.test.ts
```

Add new tests only where these files cannot express the behavior cleanly.

## QA Closeout Rule

The refactor is not complete until the package docs are updated with:

- implementation files touched
- tests added or updated
- dead code removed or explicitly retained with rationale
- command output summary
- browser scenario result
- residual risks
