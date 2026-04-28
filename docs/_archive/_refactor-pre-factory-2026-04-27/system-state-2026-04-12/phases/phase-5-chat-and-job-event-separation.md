# Phase 5 — Chat And Job Event Separation

> Status: Complete
> Loop State: Exit criteria verified
> Goal: Freeze assistant-state convergence on the active chat stream and job-state convergence on the shared deferred-job publication and read-model contract.
> Prerequisites: Phase 0 complete

## Phase Intent

This phase is already landed. Assistant output, stop, and interruption state now converge through the active chat stream lifecycle, while deferred-job progress and results converge through durable job publications, scoped job-event SSE routes, and job snapshot reconciliation. The client no longer has to infer one state family from the other.

## Source Anchors To Refresh

- [../../../../src/core/entities/chat-stream.ts](../../../../src/core/entities/chat-stream.ts#L1)
- [../../../../src/lib/chat/StreamStrategy.ts](../../../../src/lib/chat/StreamStrategy.ts#L1)
- [../../../../src/hooks/chat/useChatStreamRuntime.ts](../../../../src/hooks/chat/useChatStreamRuntime.ts#L1)
- [../../../../src/hooks/chat/useChatJobEvents.ts](../../../../src/hooks/chat/useChatJobEvents.ts#L1)
- [../../../../src/hooks/useGlobalChat.tsx](../../../../src/hooks/useGlobalChat.tsx#L1)
- [../../../../src/components/jobs/useJobsEventStream.ts](../../../../src/components/jobs/useJobsEventStream.ts#L1)
- [../../../../src/app/api/chat/events/route.ts](../../../../src/app/api/chat/events/route.ts#L1)
- [../../../../src/app/api/jobs/events/route.ts](../../../../src/app/api/jobs/events/route.ts#L1)
- [../../../../src/lib/jobs/job-event-stream.ts](../../../../src/lib/jobs/job-event-stream.ts#L1)
- [../../../../src/lib/jobs/job-publication.ts](../../../../src/lib/jobs/job-publication.ts#L1)
- [../../../../src/lib/jobs/job-read-model.ts](../../../../src/lib/jobs/job-read-model.ts#L1)
- [../../../../src/lib/jobs/job-status-snapshots.ts](../../../../src/lib/jobs/job-status-snapshots.ts#L1)
- [../../../../src/lib/jobs/job-renderable-event.ts](../../../../src/lib/jobs/job-renderable-event.ts#L1)
- [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L1)

## Drift Traps

- Do not treat `/api/chat/events` as an assistant text stream; it is the conversation-scoped deferred-job event channel.
- Do not let audit-only worker events bypass `job-renderable-event.ts` or `job-publication.ts` when new event types are added.
- Do not route assistant terminal state through job snapshots or job-status upserts.
- Do not assume replayed job snapshots and live assistant stream events have interchangeable ordering guarantees.

## Verified Current State

### Event Ownership Matrix

| State family | Canonical producer and state source | Delivery surface | Client owner | Current rule |
| --- | --- | --- | --- | --- |
| Assistant stream lifecycle | active `/api/chat/stream` execution plus typed `generation_*` events in [../../../../src/core/entities/chat-stream.ts](../../../../src/core/entities/chat-stream.ts#L1) | active chat stream response | [../../../../src/hooks/chat/useChatStreamRuntime.ts](../../../../src/hooks/chat/useChatStreamRuntime.ts#L1) plus [../../../../src/lib/chat/StreamStrategy.ts](../../../../src/lib/chat/StreamStrategy.ts#L1) | `generation_stopped` and `generation_interrupted` update terminal stream state through `SET_STREAM_TERMINAL_STATE`, not job-state reducers |
| Conversation job-state convergence | durable job records and conversation events published through [../../../../src/lib/jobs/job-publication.ts](../../../../src/lib/jobs/job-publication.ts#L1) | [../../../../src/app/api/chat/events/route.ts](../../../../src/app/api/chat/events/route.ts#L1) backed by [../../../../src/lib/jobs/job-event-stream.ts](../../../../src/lib/jobs/job-event-stream.ts#L1) | [../../../../src/hooks/chat/useChatJobEvents.ts](../../../../src/hooks/chat/useChatJobEvents.ts#L1) | `job_queued`, `job_started`, `job_progress`, `job_completed`, `job_failed`, and `job_canceled` converge through `UPSERT_JOB_STATUS` |
| User-scoped jobs page convergence | the same job publication contract and durable job snapshots | [../../../../src/app/api/jobs/events/route.ts](../../../../src/app/api/jobs/events/route.ts#L1) plus [../../../../src/components/jobs/useJobsEventStream.ts](../../../../src/components/jobs/useJobsEventStream.ts#L1) | jobs surfaces outside the active chat transcript | route scope and auth differ from `/api/chat/events`, but payload ownership is the same publication layer |
| Reload and reconnect recovery | [../../../../src/lib/jobs/job-read-model.ts](../../../../src/lib/jobs/job-read-model.ts#L1) plus [../../../../src/lib/jobs/job-status-snapshots.ts](../../../../src/lib/jobs/job-status-snapshots.ts#L1) | `/api/chat/jobs`, `/api/chat/jobs/[jobId]`, backlog replay in the SSE routes | [../../../../src/hooks/chat/useChatJobEvents.ts](../../../../src/hooks/chat/useChatJobEvents.ts#L1) and chat job-status routes | durable job snapshots are authoritative when the client reconnects or joins after live events were emitted |
| Audit-only worker events | [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L1) appends notification and ownership events after durable job mutations | job publication fallback through [../../../../src/lib/jobs/job-publication.ts](../../../../src/lib/jobs/job-publication.ts#L1) | no separate visible reducer branch | `notification_sent`, `notification_failed`, and `ownership_transferred` never replace the user-visible job status |

### Event Family Contract

- `StreamEvent` keeps assistant lifecycle events and job lifecycle events as separate typed families even though they share one top-level union.
- [../../../../src/lib/chat/StreamStrategy.ts](../../../../src/lib/chat/StreamStrategy.ts#L1) maps `generation_stopped` and `generation_interrupted` to `SET_STREAM_TERMINAL_STATE`, while every `job_*` event maps to `UPSERT_JOB_STATUS`.
- [../../../../src/hooks/useGlobalChat.tsx](../../../../src/hooks/useGlobalChat.tsx#L1) wires [../../../../src/hooks/chat/useChatStreamRuntime.ts](../../../../src/hooks/chat/useChatStreamRuntime.ts#L1) and [../../../../src/hooks/chat/useChatJobEvents.ts](../../../../src/hooks/chat/useChatJobEvents.ts#L1) as separate responsibilities.
- [../../../../src/app/api/chat/events/route.ts](../../../../src/app/api/chat/events/route.ts#L1) and [../../../../src/app/api/jobs/events/route.ts](../../../../src/app/api/jobs/events/route.ts#L1) both delegate to [../../../../src/lib/jobs/job-event-stream.ts](../../../../src/lib/jobs/job-event-stream.ts#L1), so scope and auth vary without creating a second payload contract.
- [../../../../src/lib/jobs/job-publication.ts](../../../../src/lib/jobs/job-publication.ts#L1) and [../../../../src/lib/jobs/job-read-model.ts](../../../../src/lib/jobs/job-read-model.ts#L1) turn durable worker events into canonical `job_*` stream events and synthetic snapshots when no renderable event is available.

### Worker Semantics And Audit-Only Events

- [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L1) records user-relevant lifecycle events such as `started`, `progress`, `result`, `failed`, `retry_scheduled`, `retry_exhausted`, and `lease_recovered` before publication converts them into the stable `job_*` stream contract.
- Retry scheduling and lease recovery are part of visible job-state convergence because they change the durable job state that snapshot routes and replayed event streams expose.
- Notification delivery outcomes happen after a terminal job event and are explicitly audit-only. They are appended for observability, not to create a new visible job status.
- [../../../../src/lib/jobs/job-renderable-event.ts](../../../../src/lib/jobs/job-renderable-event.ts#L1) defines `notification_sent`, `notification_failed`, and `ownership_transferred` as audit-only, and the publication layer falls back to the latest renderable event or a synthetic snapshot instead of surfacing those audit events directly.

### Current QA Notes

- The event-separation contract is now backed by a broader 30-file verification bundle that passes 30 of 30 files and 181 of 181 tests.
- That bundle covers assistant terminal-state handling, stream-route deferred job emission, conversation-scoped and user-scoped job SSE routes, durable job snapshot and retry-history routes, worker retry and lease-recovery behavior, audit-only notification fallback, event parsing, transcript job reconciliation, jobs-page event consumption, and transcript or jobs UI rendering of normalized job parts.
- Production verification also now includes a clean `npm run build` and a targeted browser pass that covers stop-generation recovery, deferred-job chat flows, and the signed-in jobs page: 3 Playwright specs and 7 browser tests passed.

```bash
npm exec vitest run src/lib/jobs/job-event-stream.test.ts src/lib/jobs/job-publication.test.ts src/lib/jobs/job-read-model.test.ts src/lib/jobs/job-status.test.ts src/lib/jobs/deferred-job-result.test.ts tests/deferred-job-events-route.test.ts src/app/api/chat/events/route.test.ts src/app/api/jobs/events/route.test.ts src/app/api/jobs/[jobId]/events/route.test.ts src/app/api/jobs/[jobId]/route.test.ts src/app/api/jobs/route.test.ts tests/chat/chat-job-status-route.test.ts tests/deferred-job-status.tool.test.ts tests/job-status-summary-tools.test.ts src/hooks/chat/useChatJobEvents.test.tsx src/hooks/useGlobalChat.test.tsx src/hooks/chat/chatStreamProcessor.test.ts src/components/jobs/useJobsEventStream.test.tsx src/components/jobs/JobsWorkspace.test.tsx src/adapters/chat/EventParserStrategy.test.ts src/app/api/chat/stream/route.test.ts tests/chat/chat-stream-route.test.ts tests/stream-pipeline.test.ts src/frameworks/ui/chat/ToolPluginPartRenderer.test.tsx src/frameworks/ui/chat/plugins/system/resolve-progress-strip.test.ts src/frameworks/ui/chat/plugins/system/resolve-system-card.test.ts src/frameworks/ui/chat/plugins/system/system-card-family.test.tsx src/frameworks/ui/chat/plugins/system/ChatProgressStrip.test.tsx tests/deferred-job-worker.test.ts tests/deferred-job-worker-process.test.ts
npm run build
npm exec playwright test tests/browser-ui/chat-stop-generation.spec.ts tests/browser-ui/deferred-blog-jobs.spec.ts tests/browser-ui/jobs-page.spec.ts
```

## Suggested Verification Commands

```bash
npm exec vitest run src/lib/jobs/job-event-stream.test.ts src/lib/jobs/job-publication.test.ts src/lib/jobs/job-read-model.test.ts src/lib/jobs/job-status.test.ts src/lib/jobs/deferred-job-result.test.ts tests/deferred-job-events-route.test.ts src/app/api/chat/events/route.test.ts src/app/api/jobs/events/route.test.ts src/app/api/jobs/[jobId]/events/route.test.ts src/app/api/jobs/[jobId]/route.test.ts src/app/api/jobs/route.test.ts tests/chat/chat-job-status-route.test.ts tests/deferred-job-status.tool.test.ts tests/job-status-summary-tools.test.ts src/hooks/chat/useChatJobEvents.test.tsx src/hooks/useGlobalChat.test.tsx src/hooks/chat/chatStreamProcessor.test.ts src/components/jobs/useJobsEventStream.test.tsx src/components/jobs/JobsWorkspace.test.tsx src/adapters/chat/EventParserStrategy.test.ts src/app/api/chat/stream/route.test.ts tests/chat/chat-stream-route.test.ts tests/stream-pipeline.test.ts src/frameworks/ui/chat/ToolPluginPartRenderer.test.tsx src/frameworks/ui/chat/plugins/system/resolve-progress-strip.test.ts src/frameworks/ui/chat/plugins/system/resolve-system-card.test.ts src/frameworks/ui/chat/plugins/system/system-card-family.test.tsx src/frameworks/ui/chat/plugins/system/ChatProgressStrip.test.tsx tests/deferred-job-worker.test.ts tests/deferred-job-worker-process.test.ts
npm run build
npm exec playwright test tests/browser-ui/chat-stop-generation.spec.ts tests/browser-ui/deferred-blog-jobs.spec.ts tests/browser-ui/jobs-page.spec.ts
```

## Expected Evidence Artifacts

- An event-ownership matrix naming the canonical producer, transport, and client owner for each assistant and job event family.
- Test evidence proving backlog replay, snapshot hydration, retry scheduling, lease recovery, and audit-only fallback keep visible job state stable.
- A note that `/api/chat/events` and `/api/jobs/events` are scope-specific adapters over one publication contract rather than competing event systems.
- A note that notification and ownership-transfer events remain audit-focused and do not replace the last renderable job state.

## Scope Guardrails

- Do not rewrite the client shell wholesale in this phase.
- Do not collapse assistant and job events into one generic reducer path.
- Do not introduce a new job event channel without passing through the shared publication and read-model seam.

## Implementation Record

- Date: 2026-04-12
- Files changed: `src/core/entities/chat-stream.ts`, `src/lib/chat/StreamStrategy.ts`, `src/hooks/chat/useChatStreamRuntime.ts`, `src/hooks/chat/useChatJobEvents.ts`, `src/hooks/useGlobalChat.tsx`, `src/components/jobs/useJobsEventStream.ts`, `src/app/api/chat/events/route.ts`, `src/app/api/jobs/events/route.ts`, `src/lib/jobs/job-event-stream.ts`, `src/lib/jobs/job-publication.ts`, `src/lib/jobs/job-read-model.ts`, `src/lib/jobs/job-status-snapshots.ts`, `src/lib/jobs/job-renderable-event.ts`, `src/lib/jobs/deferred-job-worker.ts`, and the associated route, hook, and worker tests.
- Summary of what landed: assistant lifecycle convergence stayed on the active chat stream contract, deferred-job convergence moved behind one durable publication and snapshot seam, chat and jobs routes now expose that same job-event contract at different scopes, and audit-only notification events no longer compete with user-visible job state.
- Deviations from the original plan: the shipped system kept one typed `StreamEvent` union rather than physically splitting every event family into unrelated transports; separation is enforced by typed event families, shared publication rules, and separate client consumers instead.

## Post-Implementation QA

- [x] Refresh current event flows and client reconciliation assumptions.
- [x] Refresh job snapshot and stream payload shapes.
- [x] Record current tests around event rendering and sequencing.
- [x] Define the ownership model for assistant, job, and audit-only event families.
- [x] Run the broader Phase 5 unit verification bundle.
- [x] Run production build verification.
- [x] Run targeted browser verification for stop-generation and deferred-job user flows.
- [x] Confirm every event family has a clear ownership story.

## Exit Criteria

- Assistant-state and job-state convergence are clearly separated.
- Event ordering and ownership are documented and test-backed.
- Client reconciliation no longer depends on ambiguous duplicate signals.

## Handoff

- What the next phase should now assume: assistant stream lifecycle and durable job-state convergence are separate contracts with different transports, reducers, and replay rules.
- What remains unresolved: worker audit vocabulary can still grow over time, but every new audit-only event must stay behind the renderable-event and publication filters.
- What docs need updating: keep this packet, the status board, and the roadmap aligned whenever new job event types, job snapshot routes, or assistant terminal events change.
