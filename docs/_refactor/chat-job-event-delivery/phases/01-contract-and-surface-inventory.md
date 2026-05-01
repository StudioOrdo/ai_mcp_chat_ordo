# Phase 01 - Contract And Surface Inventory

## Goal

Make every implementation surface explicit so the refactor reuses existing
architecture instead of adding another job delivery path.

## Post-09 Hard-Cutover Note

This phase is historical inventory. Phases 09a-09d supersede the earlier
decisions that retained message-shaped job lifecycle state as product behavior.
Current product code uses `CanonicalJobSnapshot` as the job read-model contract;
message repositories own speech/history, not operational job lifecycle state.

## Steps

1. Confirm all source-of-truth tables and repository methods used by the phase.
2. Confirm route contracts for `/api/chat/events`, `/api/jobs/events`, and
   `/api/chat/jobs`.
3. Confirm chat hook, Jobs workspace hook, Jobs rail projection, presenter, and
   message-state merge responsibilities.
4. Confirm `JobRenderCandidateMerger.ts` is the preferred presenter-level
   freshness consolidation point.
5. Confirm browser runtime synthetic job behavior is tracked by the compose-media
   ownership package and does not expand this refactor.
6. Confirm Push is optional away/background delivery only.
7. Update `contract-spec.md`, `systemic-audit.md`, or this phase if any surface
   has drifted.

## Code Anchors

- `src/adapters/JobQueueDataMapper.ts`
- `src/app/api/chat/events/route.ts`
- `src/app/api/jobs/events/route.ts`
- `src/app/api/chat/jobs/route.ts`
- `src/hooks/chat/useChatJobEvents.ts`
- `src/components/jobs/useJobsEventStream.ts`
- `src/hooks/chat/useJobStateStore.ts`
- `src/hooks/usePresentedChatMessages.ts`
- `src/lib/chat/JobRenderCandidateMerger.ts`
- `src/adapters/ChatPresenter.ts`
- `src/core/services/ConversationMessages.ts`

## Implementation Evidence

Implemented on 2026-04-30.

This phase made no production behavior changes. It inventories the current
surfaces and assigns one responsibility to each surface before Phase 02 and
Phase 03 change cursor behavior.

## Source-Of-Truth Inventory

| Surface | Current responsibility | Phase 01 decision |
| --- | --- | --- |
| `job_requests` | Authoritative current job state. | Retain as operational truth. Messages and UI projections must not override it. |
| `job_events` | Append-only event timeline. `appendEvent()` assigns `sequence` per conversation. | Retain as event truth. Conversation cursor means `job_events.sequence`. |
| `JobQueueDataMapper.createJob()` | Creates queued job request rows; it does not automatically append a queued event. | Retain. Tests must seed events explicitly when proving event timelines. |
| `JobQueueDataMapper.appendEvent()` | Appends conversation-scoped event sequence using `MAX(sequence) + 1` for the conversation. | Retain. This is the conversation event cursor source. |
| `JobQueueDataMapper.listConversationEvents()` | Lists events by `conversation_id` and `sequence > afterSequence`. | Retain for `/api/chat/events`. |
| `JobQueueDataMapper.listUserEvents()` | Lists signed-in user events by `job_events.rowid` and maps that rowid to returned `sequence`. | Retain but keep named separately as user cursor semantics. |
| `JobQueueDataMapper.findLatestRenderableEventForJob()` | Skips audit-only events when publishing a job status snapshot. | Retain as publication fallback support. |
| `JobQueueDataMapper.listEventsForJob()` | Lists per-job history ordered by conversation sequence. | Retain for history and diagnostics, not active chat waiting. |

## Route Contract Inventory

| Route | Current responsibility | Phase 01 decision |
| --- | --- | --- |
| `/api/chat/events` | Resolves a conversation, accepts `afterSequence` or `Last-Event-ID`, and streams `listConversationEvents()`. | Retain. Phase 02 hardens tests; Phase 03 makes the chat hook pass a cursor. |
| `/api/jobs/events` | Requires an authenticated user, accepts `afterSequence` or `Last-Event-ID`, and streams `listUserEvents()`. | Retain. Cursor remains user-scoped rowid semantics even though payload field is `sequence`. |
| `/api/chat/jobs` GET | Reconciles current conversation job snapshots from platform job interactions. | Retain as active chat snapshot reconciliation path. |
| `/api/chat/jobs` POST | Enqueues `compose_media` deferred jobs and handles exact materialization reuse. | Out of scope for this package except compatibility checks; execution ownership remains in the compose-media package. |
| `createJobEventStreamResponse()` | Shared SSE stream loop using route-specific event listing and canonical publication. | Retain as Template Method seam; no new stream loop. |
| `job-read-model.ts` | Converts job rows/events into `CanonicalJobSnapshot` product DTOs. | Current product contract after 09b. |
| `job-publication.ts` | Legacy/publication helper for status-shaped stream/card adapters. | Retained only outside product read-model truth; not a persistence or restore contract after 09d. |

## Client And Presentation Inventory

| Surface | Current responsibility | Phase 01 decision |
| --- | --- | --- |
| `useChatJobEvents()` | Subscribes to conversation events, dispatches job status updates, and reconciles `/api/chat/jobs` on open/error/focus/visibility/interval. | Reuse. Phase 03 adds cursor tracking; do not add another active-chat transport. |
| `useJobsEventStream()` | User-scoped Jobs workspace EventSource with `lastSequenceRef`, stale-event suppression, and reconciliation. | Reuse as the cursor discipline reference for Phase 03. |
| `useJobStateStore()` | Latest-by-`jobId` store for chat/rail state using sequence-first merge. | Retain. Candidate for a smaller shared freshness primitive later, but do not import presenter types here. |
| `usePresentedChatMessages()` | Composes `messages + CanonicalJobSnapshot[]` into presented view models. | Current product presentation facade after 09c. |
| `ChatPresenter` | Builds `ToolRenderEntry` view models from canonical snapshots and normal message content. | Default product job cards are snapshot-driven after 09c/09d. |
| `JobRenderCandidateMerger.ts` | Legacy/internal card-renderer freshness helper. | Retained only as an internal adapter helper, not a product source of truth. |
| `job-snapshot-reducer.ts` | Jobs workspace reducer and local snapshot freshness comparison. | Retain. Share only smaller freshness primitives if practical. |
| `resolve-jobs-rail.ts` | Compact Jobs rail projection, deduping by `jobId` and latest sequence/updated time. | Retain as rail read-model projection. |

## Adjacent Boundaries

| Surface | Current responsibility | Phase 01 decision |
| --- | --- | --- |
| Browser runtime synthetic jobs | Current workspace code excludes `compose_media` from transcript-derived browser runtime candidates; other browser-capable media tools can still produce synthetic browser job ids. | Do not expand this refactor. Phase 10 only adds compatibility proof; compose-media execution ownership remains separate. |
| Compose-media execution ownership package | Owns idempotent compose execution, materialization keys, and server/browser execution ownership. | Cross-reference during closeout; do not implement compose-media execution changes here. |
| Browser Push | Push subscription and notification infrastructure exists separately from active chat SSE. | Keep optional and terminal/attention-state-only. Phase 09 proves active chat works without Push. |
| Status tools | Status tools remain explicit inspection and diagnostic tools. | Keep tools. Phase 06 updates guardrails; Phase 07 rewrites eval incentives. |

## Drift Found

- `/api/chat/events` already accepts `afterSequence` and `Last-Event-ID`, but
   `useChatJobEvents()` still opens a cursorless EventSource URL. This is already
   assigned to Phase 03.
- Conversation and user streams intentionally use different cursor semantics:
   conversation streams use `job_events.sequence`; user streams use `job_events`
   rowid mapped as the returned stream `sequence`. Phase 02 must name these
   separately in tests.
- `JobRenderCandidateMerger.ts` is still unused by `ChatPresenter`. This is
   assigned to Phase 05.
- Current workspace code already prevents `compose_media` transcript-derived
   browser runtime candidates. This supports the boundary decision, but Phase 10
   still needs compatibility proof against durable server job snapshots.

## Phase 01 Closeout

No new transport, store, repository method, event log, or production runtime path
was introduced. Later phases must reuse the owners above unless they document a
specific drift from this inventory.

## Done

- [x] Each surface has one assigned responsibility.
- [x] Any overlapping helper is marked reuse, consolidate, or intentionally retain.
- [x] No new transport, store, or event log has been introduced.
