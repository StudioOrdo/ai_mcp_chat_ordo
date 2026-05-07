# Phase 09d - Stop Dual Writes And Prune

## Goal

Finish deleting the dual-write architecture that creates assistant job-status
messages for job events. 09b/09c should already have broken the product path;
09d is the final prune/audit phase that removes the remaining production
writers, stale tests, docs, and prompt/eval incentives.

After this phase, new job lifecycle state is written once to job tables/events
and read once through the canonical job read model.

## Pre-Implementation Codebase Grounding

09a/09b/09c moved default chat state and presentation onto
`CanonicalJobSnapshot`, but before 09d the repo still had several production
and test-only bridges that could write or parse transcript-shaped job lifecycle
state. 09d is the hard-cutover cleanup for those bridges.

Pre-implementation hard-cutover inventory:

- `src/lib/jobs/deferred-job-conversation-projector.ts` still creates or
  updates assistant messages whose lifecycle state is stored as
  `MessagePart.job_status`.
- `src/lib/jobs/deferred-job-runtime.ts`,
  `src/lib/jobs/deferred-job-worker.ts`,
  `src/lib/jobs/job-action-executor.ts`,
  `src/lib/jobs/manual-replay.ts`,
  `src/lib/admin/jobs/admin-jobs-actions.ts`, and
  `src/lib/platform/agent-platform-facade-root.ts` still depend on
  `DeferredJobConversationProjector` for worker, retry, cancel, requeue, or
  replay paths.
- `src/lib/chat/stream-execution.ts` still persists
  `deferredJobResultToMessagePart(...)` and
  `canonicalJobSnapshotToStatusPart(...)` into the assistant message parts for
  tool results, even though 09c made default presentation read job cards from
  canonical snapshots.
- `src/lib/jobs/job-publication.ts`, `src/lib/jobs/deferred-job-result.ts`,
  `src/lib/jobs/job-status-snapshots.ts`, and `src/lib/jobs/job-status.ts`
  still provide message-part publication/parsing helpers used by the legacy
  channels.
- `src/components/jobs/useJobsEventStream.ts`,
  `src/hooks/chat/useAssetResolutionIndex.ts`,
  `src/hooks/chat/useBrowserCapabilityRuntime.ts`,
  `src/lib/media/browser-runtime/job-snapshots.ts`, and
  `src/lib/media/media-composition-asset-identity.ts` still parse canonical API
  responses or tool results through `extractJobStatusSnapshots(...)`.
- `src/core/services/ConversationMessages.ts` still exports
  `upsertJobStatusMessage(...)` and
  `suppressStaleJobStatusMessages(...)`; current product chat no longer calls
  them, so 09d should delete them with their legacy tests unless a diagnostic
  namespace is created first.
- `src/lib/evals/runner.ts` still seeds deterministic scenarios with
  `deferredJobResultToMessagePart(...)`, `canonicalJobSnapshotToStatusPart(...)`,
  and `getJobMessageId(...)`; those scenarios should be rewritten to seed job
  tables/events/read-model snapshots instead of transcript lifecycle cards.
- `tests/chat-job-state-contract-guardrails.test.ts` intentionally locks these
  bridges as 09d removal inventory. 09d must shrink that inventory as files and
  imports are deleted, rather than adding compatibility exceptions.

Already moved by 09c and not a 09d blocker:

- `src/hooks/usePresentedChatMessages.ts` accepts
  `CanonicalJobSnapshot[]` separately from messages.
- `src/hooks/chat/useJobStateStore.ts` stores canonical snapshots keyed by
  `jobId`.
- `src/hooks/chat/useChatJobEvents.ts` reconciles `/api/chat/jobs` as
  canonical snapshots and no longer dispatches product `UPSERT_JOB_STATUS`.
- `src/adapters/ChatPresenter.ts` renders default job cards only from
  canonical snapshots passed to the presenter.

Do not delete raw job event history, job read model APIs, explicit status tools,
or admin diagnostics that inspect job records directly.

## Implementation QA Status

Status: implemented and verified.

Current code checks:

- `DeferredJobConversationProjector` and
  `createDeferredJobConversationProjector` are deleted.
- `DeferredJobWorker`, `executeJobAction(...)`,
  `performManualJobReplay(...)`, admin retry/requeue actions, and
  `AgentPlatformFacade.reviseJob(...)` append job events without writing
  assistant transcript lifecycle messages.
- `stream-execution.ts` still streams deferred job acknowledgements, but it no
  longer persists `job_status` lifecycle parts into assistant messages.
- Product jobs workspace, browser runtime recovery, asset resolution, and media
  composition asset identity no longer parse product data through
  `extractJobStatusSnapshots(...)`.
- `ConversationMessages.upsertJobStatusMessage(...)` and
  `ConversationMessages.suppressStaleJobStatusMessages(...)` are deleted with
  their legacy tests.
- `ComposeMediaRestoreHydration` is deleted; workspace restore no longer
  mutates restored transcript tool results by injecting nested `job_status`
  payloads.
- Eval seeds that previously built transcript job cards now use canonical job
  state/presenter input instead.
- Guardrails now assert the deleted bridges stay absent from production source.

Retained bridge classification:

- `JobStatusMessagePart` can remain as an internal card-renderer prop shape
  while the source input is `CanonicalJobSnapshot`.
- Explicit status stream/event helpers can serialize diagnostic status data for
  tools and admin surfaces.
- Raw transcript import/export and portability can preserve historical
  `job_status` parts without feeding default product chat.
- Browser-runtime local recovery helpers can normalize local tool/runtime
  payloads, but they cannot become persisted assistant lifecycle writers or
  default chat presentation sources.

## Original QA Findings

| Finding | Code-grounded proof | Required correction |
| --- | --- | --- |
| Worker/runtime paths still dual-write job lifecycle into assistant transcript messages. | `DeferredJobConversationProjector.project(...)` calls `messageRepo.create/update(...)` with `parts: [nextPart]`; it is wired from `deferred-job-runtime.ts`, `agent-platform-facade-root.ts`, admin retry/requeue actions, replay, and job actions. | Remove projector injection from worker/action/replay APIs. Runtime should append job events only; chat should recover through `/api/chat/jobs` and job event streams. |
| Main chat streaming still persists job lifecycle parts into the assistant message. | `stream-execution.ts` pushes `deferredJobResultToMessagePart(...)` and `canonicalJobSnapshotToStatusPart(...)` into `assistantParts`, then persists those parts via `appendMessage(...)`. | Stream job acknowledgements/events to the client and canonical job store, but do not persist lifecycle card parts into assistant messages. |
| Jobs workspace and browser/media helpers still use the transcript snapshot parser for canonical data. | `useJobsEventStream.ts` parses `/api/jobs` and `/api/jobs/[jobId]` payloads through `extractJobStatusSnapshots(...)`; browser/media helpers parse tool results the same way. | Replace with typed canonical response readers or asset/materialization readers. Keep `extractJobStatusSnapshots(...)` only in a diagnostic/raw-transcript module if needed. |
| Legacy message mutation helpers are now orphaned from product chat. | `ConversationMessages.ts` still exports `upsertJobStatusMessage(...)` and `suppressStaleJobStatusMessages(...)`, but 09c product hooks no longer call them. | Delete the helpers and their tests, or move them under a diagnostic-only namespace with explicit import guardrails. |
| Eval fixtures can still normalize the old behavior as acceptable. | `src/lib/evals/runner.ts` builds transcript job parts with `deferredJobResultToMessagePart(...)`, `canonicalJobSnapshotToStatusPart(...)`, and `getJobMessageId(...)`. | Rewrite affected eval seeds to create `job_requests`/`job_events` and assert canonical snapshot presentation/recovery. |
| 09d validation command references stale route/test names. | Current routes/tests are `src/app/api/chat/jobs/route.test.ts`, `src/app/api/chat/jobs/[jobId]/route.test.ts`, `src/app/api/jobs/[jobId]/events/route.test.ts`, `src/lib/jobs/deferred-job-runtime.test.ts`, and `tests/deferred-job-runtime.integration.test.ts`. | Use the current test files in 09d validation so the phase can be executed directly. |

## Target State

- Job worker/runtime writes `job_requests` and `job_events`.
- Job event stream publishes job events.
- Job read model builds snapshots.
- Chat restore loads messages and snapshots separately.
- Presenter attaches snapshots to messages.
- Assistant messages contain prose, tool calls, tool results, attachments, and
  control tags, but not product job-status lifecycle state.
- Explicit status tools return structured data to the model/user when asked,
  but their outputs are not the reliability mechanism for active chat.

## Architecture Principles

- SOLID:
  - Dependency inversion: chat UI depends on a snapshot interface, not on DB
    rows or transcript internals.
  - Liskov/interface segregation: diagnostic transcript readers can support raw
    history without affecting product chat.
- DRY:
  - Remove bridge code once the canonical path has tests.
  - Delete tests that assert legacy behavior rather than adapting them.
- GoF patterns:
  - Observer: EventSource observes job events; it does not write transcript
    messages.
  - Facade: product restore composes messages and snapshots.
  - Repository: job repositories own job state; message repositories own
    messages.

## Implementation Steps

1. Remove `DeferredJobConversationProjector` from every production job event,
   worker, action, retry, replay, requeue, and facade path.
2. Delete `src/lib/jobs/deferred-job-conversation-projector.ts` and
   `src/lib/jobs/deferred-job-projector-root.ts`. If raw transcript projection
   is truly needed, rebuild it under a diagnostic-only namespace with no
   product/runtime imports.
3. Refactor `DeferredJobWorker`, `executeJobAction(...)`, and
   `performManualJobReplay(...)` so their contracts depend only on
   `JobQueueRepository`, event appenders, notification dispatch, and
   materialization registration. Do not accept a message projector.
4. Replace product `messageRepo.create/update({ role: "assistant", parts:
   [job_status] })` paths with job-event/read-model updates only.
5. Remove job lifecycle part persistence from `stream-execution.ts`. It may
   enqueue SSE job events, but persisted assistant messages should contain
   prose, tool calls, tool results, attachments, and control tags only.
6. Delete `ConversationMessages.upsertJobStatusMessage(...)` and
   `ConversationMessages.suppressStaleJobStatusMessages(...)` with their legacy
   tests unless a diagnostic-only namespace is created.
7. Replace `extractJobStatusSnapshots(...)` product imports with typed canonical
   readers:
   - `/api/chat/jobs` and `/api/chat/jobs/[jobId]` return
     `CanonicalJobSnapshot` payloads.
   - `/api/jobs` and `/api/jobs/[jobId]` workspace routes return canonical job
     snapshots/interactions.
   - media/browser asset recovery should use canonical job snapshots,
     materialization records, or typed asset payloads, not transcript parsers.
8. Delete or quarantine `job-status-snapshots.ts`,
   `deferredJobResultToMessagePart(...)`, and direct product uses of
   `canonicalJobSnapshotToStatusPart(...)` once production imports are gone.
   A narrow presentation-boundary adapter can remain temporarily for existing
   card renderer props, but it must accept canonical snapshots as input and
   must not be used by persistence, restore, reconciliation, or read-model
   code. If a status tool needs a serializable response, return
   `CanonicalJobSnapshot` directly.
9. Rewrite eval and fixture seeds that create transcript job cards. Seed
   `job_requests` and `job_events`, then assert snapshot-driven recovery and
   presentation.
10. Update `tests/chat-job-state-contract-guardrails.test.ts` so 09d removal
   inventory shrinks to zero for production imports instead of preserving the
   old bridge list.
11. Remove stale docs and eval language that call transcript status polling or
   duplicate suppression a reliability strategy.
12. Add audit tests scanning production source for:
   - assistant-only `job_status` message creation
   - product imports of `JobStatusSnapshot`
   - product imports of `deferredJobResultToMessagePart`
   - product rendering from `extractJobStatusSnapshots`
13. Run full tests and update release evidence.

## Prune List

Delete when green:

- Assistant-message job event projection.
- Product transcript `job_status` compatibility rendering.
- Product `JobStatusSnapshot { messageId, part }` compatibility.
- Nested status snapshot product rendering.
- Deferred-job acknowledgement product rendering.
- Redundant latest-by-job candidate mergers that exist only for transcript
  fragmentation.
- Legacy fixture data whose only purpose is repeated visible status spam.
- Browser/runtime compatibility notes that are superseded by canonical
  snapshots.

Retain:

- `job_requests`
- `job_events`
- job event streams
- canonical job snapshot/read-model routes
- explicit status tools for user/admin inspection
- raw transcript export of original tool call/result history
- admin diagnostics over job records
- internal presentation adapters that convert canonical snapshots into legacy
  card-renderer props without becoming product state

## Validation Plan

Positive tests:

- New deferred job lifecycle creates no assistant-only job-status messages.
- EventSource updates active chat from job snapshots/events.
- Restore hydrates latest job state from read model.
- Jobs rail, chat card, jobs workspace, and notification surfaces agree.
- Production source has no persistence, restore, reducer, or read-model imports
  of message-part job snapshot adapters.
- Cancel, retry, admin requeue, and manual replay append job events without
  creating transcript lifecycle cards.

Negative tests:

- Audit test fails on new production assistant-only `job_status` writes.
- Status-tool polling is not required for completion recovery.
- Duplicate `jobId` snapshots cannot produce duplicate product cards.
- Unauthorized users cannot read another user's job snapshots.
- Tool results containing legacy `deferred_job` or nested `job_status` payloads
  do not produce default product job cards or persisted lifecycle parts.

Edge-case tests:

- Job queued before assistant stream completes.
- Job completes before the client subscribes to EventSource.
- Job fails after partial artifact creation.
- Job belongs to an anonymous conversation that is later migrated.
- Conversation is deleted/purged while a job is running.
- Retry dedupes to an already-active replay job.
- Admin requeue resets job state and appends a canonical event without writing a
  message.

Run:

```bash
npm run typecheck
npm exec vitest run \
  src/lib/jobs/deferred-job-worker.test.ts \
  src/lib/jobs/deferred-job-runtime.test.ts \
  src/app/api/chat/jobs/route.test.ts \
  'src/app/api/chat/jobs/[jobId]/route.test.ts' \
  'src/app/api/jobs/[jobId]/events/route.test.ts' \
  src/hooks/chat/useChatJobEvents.test.tsx \
  src/hooks/usePresentedChatMessages.test.tsx \
  src/hooks/useGlobalChat.test.tsx \
  src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts \
  src/frameworks/ui/useChatSurfaceState.test.tsx \
  src/adapters/ChatPresenter.test.ts \
  tests/deferred-blog-job-flow.test.ts \
  tests/deferred-job-runtime.integration.test.ts \
  tests/deferred-job-status.tool.test.ts \
  tests/chat-job-state-contract-guardrails.test.ts \
  tests/chat-job-event-baseline.test.ts
npm test
```

## Done Checklist

- [x] New production job events do not create assistant `job_status` messages.
- [x] Default product chat renders job cards only from canonical snapshots.
- [x] Explicit status tools remain available for inspection but are not a wait
  loop or rendering dependency.
- [x] Legacy transcript product code is deleted. Any raw transcript inspection
  that remains is diagnostic-only and cannot feed default chat rendering.
- [x] Tests no longer rely on visible duplicate transcript job-status cards.
- [x] Docs and eval incentives no longer recommend assistant status polling for
  active-chat correctness.
- [x] Full typecheck and full test suite pass.

## QA Evidence

```bash
npm exec vitest run \
  src/lib/jobs/deferred-job-worker.test.ts \
  src/lib/jobs/deferred-job-runtime.test.ts \
  src/app/api/chat/jobs/route.test.ts \
  'src/app/api/chat/jobs/[jobId]/route.test.ts' \
  'src/app/api/jobs/[jobId]/events/route.test.ts' \
  src/hooks/chat/useChatJobEvents.test.tsx \
  src/hooks/usePresentedChatMessages.test.tsx \
  src/hooks/useGlobalChat.test.tsx \
  src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts \
  src/frameworks/ui/useChatSurfaceState.test.tsx \
  src/adapters/ChatPresenter.test.ts \
  tests/deferred-blog-job-flow.test.ts \
  tests/deferred-blog-publish-flow.test.ts \
  tests/deferred-job-runtime.integration.test.ts \
  tests/deferred-job-status.tool.test.ts \
  tests/chat-job-state-contract-guardrails.test.ts \
  tests/chat-job-event-baseline.test.ts \
  tests/deferred-job-worker.test.ts \
  src/lib/jobs/job-action-executor.test.ts \
  src/lib/admin/jobs/admin-jobs-actions.test.ts \
  src/lib/jobs/deferred-job-result.test.ts \
  tests/conversation-messages.test.ts \
  tests/chat/chat-stream-route.test.ts \
  tests/job-visibility-cohesion.test.ts
```

Result: 24 files passed, 246 tests passed.

```bash
npm run typecheck
```

Result: passed.

```bash
npm test
```

Result: 652 files passed, 4755 tests passed, 2 skipped.
