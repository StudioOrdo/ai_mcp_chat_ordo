# Chat Job Event Delivery Refactor

This package tracks the refactor that moves chat job updates away from
assistant-driven status polling and toward a reliability-first delivery model:
durable job events, in-chat SSE, catch-up reconciliation, and optional browser
push for away-from-chat notifications.

Current status: Phases 00-09d are implemented and validated. Phases 09a-09d
supersede the earlier compatibility-oriented cleanup guidance where it retained
message-shaped job presentation bridges. The current architecture is a hard
cutover: job lifecycle state is written to job tables/events, read through
canonical job snapshots, and composed with messages only at presentation.

## Package Contents

1. [contract-spec.md](contract-spec.md): implementation-ready product and
   technical contract.
2. [phase-plan.md](phase-plan.md): proposed execution sequence and closeout
   requirements.
3. [validation-checklist.md](validation-checklist.md): focused unit, route,
   database, and browser proof matrix.
4. [qa-review.md](qa-review.md): code-grounded QA findings, design-pattern
  guardrails, dead-code cleanup requirements, and test coverage standards.
5. [systemic-audit.md](systemic-audit.md): repo-wide fragmentation and legacy
  cleanup watchlist for related job status, eval, push, and browser runtime
  surfaces.
6. [phases/](phases/README.md): detailed phase-by-phase implementation plan.
7. [keith-compose-video-5-whys.md](keith-compose-video-5-whys.md): current
   Keith compose-media duplicate video investigation and Phase 08 regression
   target.
8. [phases/10a-audio-job-contract-and-routing.md](phases/10a-audio-job-contract-and-routing.md),
   [phases/10b-audio-worker-materialization-and-compose-integration.md](phases/10b-audio-worker-materialization-and-compose-integration.md),
   and [phases/10c-audio-presentation-restore-and-legacy-prune.md](phases/10c-audio-presentation-restore-and-legacy-prune.md):
   hard-cutover plan for making high-usage audio generation a canonical media
   job that composes cleanly with `compose_media`.

## Incident Grounding

This package is grounded in the April 30, 2026 conversation for
`keith@firehose360.com`.

Observed issue:

- The chat transcript showed repeated `Admin Web Search`/status cards while the
  job rail showed only one job.
- Database inspection found exactly one durable `admin_web_search` job:
  `job_076cf2d0-dc0d-4581-a239-89c892f9ab76`.
- The job had three durable events: `queued`, `started`, and `result`.
- The transcript contained one `admin_web_search` call plus five repeated
  `get_deferred_job_status` calls for the same job while it was running.
- The Jobs rail correctly deduped by `jobId` and showed the latest durable job
  state.

Root cause:

- The assistant used status polling as a waiting strategy.
- Repeated status tool results were persisted/rendered into chat history.
- The chat surface and jobs rail were showing different concepts: transcript
  activity versus durable job truth.

## Target Decision

Use this delivery hierarchy:

1. Durable `job_requests` and `job_events` remain the source of truth.
2. In-chat live updates use SSE/EventSource from existing job event endpoints.
3. Reconciliation fetches current job snapshots after reconnect, focus,
   visibility change, initial load, and timed fallback.
4. Browser Push API is optional and only for background/away notifications.
5. The assistant should not repeatedly call status tools to wait for job
   completion.

## Existing Code To Preserve

- [src/app/api/chat/events/route.ts](../../../src/app/api/chat/events/route.ts)
  exposes conversation-scoped job SSE.
- [src/app/api/jobs/events/route.ts](../../../src/app/api/jobs/events/route.ts)
  exposes signed-in user job SSE.
- [src/lib/jobs/job-event-stream.ts](../../../src/lib/jobs/job-event-stream.ts)
  maps durable job events to SSE payloads.
- [src/lib/jobs/job-read-model.ts](../../../src/lib/jobs/job-read-model.ts)
  is the product read-model contract for canonical job snapshots.
- [src/hooks/chat/useChatJobEvents.ts](../../../src/hooks/chat/useChatJobEvents.ts)
  already subscribes to conversation-scoped events and reconciles snapshots.
- [src/hooks/chat/useJobStateStore.ts](../../../src/hooks/chat/useJobStateStore.ts)
  stores canonical job snapshots by `jobId`.
- [src/frameworks/ui/jobs-rail/resolve-jobs-rail.ts](../../../src/frameworks/ui/jobs-rail/resolve-jobs-rail.ts)
  projects deduped job state into the rail model.
- [public/push-worker.js](../../../public/push-worker.js) and
  [src/app/api/notifications/push/route.ts](../../../src/app/api/notifications/push/route.ts)
  provide the optional browser push foundation.

## Desired Product Behavior

- Starting a deferred job shows one compact job card or rail item.
- The card updates in place as job events arrive.
- Repeated unchanged status snapshots do not create repeated visible cards.
- The assistant explains completed/failed state after the event arrives, not by
  repeatedly polling the same job.
- The Jobs rail, chat card, jobs workspace, and notification badge agree on job
  count and latest state.
- Closing and reopening the tab restores the latest job state from durable data.
- Browser push can notify completion/failure when the user is away, but it is
  not required for the active chat UI to stay current.

## Guardrails

- Do not make browser Push API the primary in-chat transport.
- Do not use assistant tool calls as the wait loop for deferred jobs.
- Do not treat transcript message parts as the source of operational truth.
- Do not duplicate job cards for the same `jobId` and same or older `sequence`.
- Do not hide real job failures; dedupe only duplicate/stale render artifacts.
- Do not remove `get_deferred_job_status`; keep it for explicit inspection and
  diagnostics.
- Do not break admin workflows that intentionally inspect historical jobs.
- Do not add a parallel job event transport or duplicate job state store.
- Do not hide duplicates only in React components after duplicate view models
  have already been created; dedupe in the presenter/read-model layer.
- After implementation, remove stale tests, prompt hints, or helper paths that
  only existed to normalize assistant polling noise.
- Keep default product rendering snapshot-driven. Any remaining
  `JobStatusMessagePart` conversion is an internal renderer/diagnostic adapter,
  not a persistence, restore, reconciliation, or product read-model contract.
- Rewrite eval incentives that require assistant status-tool polling for
  non-user-initiated recovery after the event/reconciliation path owns that
  behavior.

## Phase Status

| Phase | Goal | Status |
| --- | --- | --- |
| 00 | Baseline evidence | Implemented |
| 01 | Contract and surface inventory | Implemented |
| 02 | Cursor semantics and route hardening | Implemented |
| 03 | Active chat event hook | Implemented |
| 04 | Job state merge authority | Implemented |
| 05 | Presenter dedupe and raw history | Implemented |
| 06 | Status tool guardrails | Implemented |
| 07 | Eval and fixture rewrite | Implemented |
| 08 | Legacy fragmentation cleanup | Implemented |
| 09a | Job state contract and guardrails | Implemented |
| 09b | Canonical job read model | Implemented |
| 09c | Chat presentation split | Implemented |
| 09d | Stop dual writes and prune | Implemented |
| 09 | Push notification boundary | Deferred until 09a-09d are complete |
| 10 | Browser and runtime proof | Not started |
| 10a | Audio job contract and routing | Not started |
| 10b | Audio worker materialization and compose integration | Not started |
| 10c | Audio presentation restore and legacy prune | Not started |
| 11 | Release evidence | Not started |
| 12 | Closeout and handoff | Not started |

## Next Work

1. Re-review optional browser push now that active chat correctness and the
   dual-write cleanup are complete.
2. Complete Phase 10 browser/runtime proof against the canonical snapshot
   contract.
3. Complete Phases 10a-10c so `generate_audio` follows the same canonical job
   and materialization path as `compose_media`.
4. Complete Phase 11 release evidence and Phase 12 closeout/handoff.
5. Keep `qa-review.md` and `systemic-audit.md` aligned with the 09a-09d hard
   cutover whenever new job surfaces are added.
