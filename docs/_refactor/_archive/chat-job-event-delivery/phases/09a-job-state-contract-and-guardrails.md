# Phase 09a - Job State Contract And Guardrails

## Goal

Make the product contract explicit: chat messages are speech, jobs are durable
state, and default product presentation must never render more than one job
card for one `jobId`.

This phase is the architecture lock before implementation. It should add
tests, lintable invariants, and code comments at ownership seams so later
phases can delete legacy paths without reintroducing the same duplicate
message/card problem. The target is a hard cutover, not a product compatibility
layer.

## Pre-Implementation Codebase Grounding

This was the baseline inventory before 09a-09d implementation. The system
allowed one job to enter chat presentation through multiple channels:

- `src/lib/jobs/deferred-job-conversation-projector.ts` writes job lifecycle
  updates as assistant messages containing `job_status` parts.
- `src/lib/jobs/deferred-job-projector-root.ts` creates that projector for
  production callers.
- `src/lib/platform/agent-platform-facade-root.ts` uses
  `createDeferredJobConversationProjector()` for manual cancel/retry revision
  actions.
- `src/lib/admin/jobs/admin-jobs-actions.ts` uses the same projector for admin
  job actions.
- `src/lib/chat/stream-execution.ts` appends
  `deferredJobResultToMessagePart(...)` to streamed assistant parts when a tool
  returns a `deferred_job` payload. This means the problem is not limited to
  assistant messages whose only part is `job_status`; contentful assistant
  messages can also carry renderable job state.
- `src/lib/jobs/deferred-job-result.ts` returns `deferred_job` acknowledgements
  through streamed tool results and can convert those acknowledgements into
  `job_status` parts or stream events.
- `src/lib/jobs/job-read-model.ts` currently exposes
  `JobStatusSnapshot { messageId, conversationId, part }`, where `messageId`
  is still `getJobMessageId(job.id)` rather than an origin message/turn id.
- `src/hooks/chat/useChatJobEvents.ts` receives durable events and reconciles
  `/api/chat/jobs` snapshots.
- `src/hooks/chat/useJobStateStore.ts` merges latest job state by `jobId`.
- `src/hooks/usePresentedChatMessages.ts` currently applies job state to
  messages by calling `upsertJobStatusMessage(...)`, which synthesizes or
  updates assistant message state before presentation.
- `src/adapters/ChatPresenter.ts` still has to understand explicit
  `job_status` parts, nested status snapshots, and deferred job acknowledgements.
- `src/lib/chat/JobRenderCandidateMerger.ts` is a containment seam for dedupe,
  but it exists because the upstream state model is fragmented.
- `src/core/platform/conversation-restore/WorkspaceRestoreReader.test.ts` and
  `src/core/platform/conversation-restore/ComposeMediaRestoreHydration.ts`
  still model restored jobs as `job_status` snapshots, so restore must be part
  of the contract and not treated as a separate cleanup.

The April 30, 2026 `keith@firehose360.com` image-generation incident proved the
problem precisely: `generate_blog_image` produced one correct durable image
result, but the product surface showed both a rich image card and the streamed
"Generating now" job acknowledgement/status surface for the same job.

## Implementation QA Status

Status: implemented and re-QA'd after the 09d hard cutover.

Current package truth:

- New production job lifecycle state is written to `job_requests` and
  `job_events`, then read through `CanonicalJobSnapshot`.
- `DeferredJobConversationProjector` and
  `createDeferredJobConversationProjector(...)` are deleted.
- `stream-execution.ts` no longer persists `job_status` lifecycle parts into
  assistant messages.
- `ConversationMessages.upsertJobStatusMessage(...)`,
  `ConversationMessages.suppressStaleJobStatusMessages(...)`, and their legacy
  test file are deleted.
- `extractJobStatusSnapshots(...)` is no longer a product presentation or
  restore dependency.
- Workspace restore no longer injects `job_status` payloads into restored
  transcript tool results; restored messages stay speech/history, and active
  jobs come from canonical snapshots.
- Guardrails now assert the deleted write/render bridges remain absent instead
  of preserving the original legacy inventory.

Remaining `JobStatusMessagePart` usage is explicitly outside the product state
contract: raw transcript portability/import-export, explicit diagnostic/status
stream shaping, browser-runtime local recovery helpers, and internal card
renderer adapters while the public product source remains canonical snapshots.

## Original QA Findings

The phase intent is correct, but implementation must address these concrete
risks:

| Finding | Code-grounded proof | Required correction |
| --- | --- | --- |
| The current guardrail "assistant-only `job_status` message" is too narrow. | `src/lib/chat/stream-execution.ts` appends a `job_status` part to a contentful assistant message when a deferred job acknowledgement is returned. | Guardrails must detect any new production persisted assistant `job_status` lifecycle part, not only messages where `parts` is exactly `[job_status]`. |
| Projector removal has more than one production caller. | `agent-platform-facade-root.ts` and `admin-jobs-actions.ts` both create/use `DeferredJobConversationProjector`. | 09a inventory must list every caller and classify each as delete or replace with read-model/event updates. Diagnostic-only code must be separate from product paths. |
| Current job snapshots still use message-shaped ids. | `buildJobStatusSnapshot()` returns `messageId: getJobMessageId(job.id)`. | 09b must replace the product DTO with `CanonicalJobSnapshot` and durable origin metadata instead of treating deterministic job-message ids as product anchors. |
| Product presentation still mutates messages with job truth. | `usePresentedChatMessages()` reduces `jobStateEntries` through `upsertJobStatusMessage(...)`. | 09c must replace mutation/upsert with a pure `messages + jobSnapshots` association step. |
| Restore is still tied to `job_status` snapshot shape. | Workspace restore tests and compose-media restore hydration create/read `job_status` snapshots. | 09a must include restore in the watchlist so 09c/09d do not only fix live chat. |
| Explicit status tools are legitimate but dangerous as default rendering input. | Evals still intentionally use `list_deferred_jobs`, `get_deferred_job_status`, and `get_my_job_status` for explicit status/reuse/admin scenarios. | Keep the tools, but test that status-tool results do not become active-chat reliability or duplicate-card mechanisms. |

## Target Contract

1. `messages` are conversation speech and assistant reasoning/prose.
2. `job_requests` and the job read model are operational truth.
3. `job_events` are immutable lifecycle history.
4. `tool_result.deferred_job` is an acknowledgement only, not a renderable
   product card.
5. `job_status` lifecycle parts are not allowed in new production-persisted
   assistant messages. The hard-cutover target is to remove
   `JobStatusMessagePart` from default product job rendering entirely, not to
   adapt canonical jobs back into message parts.
6. `get_my_job_status`, `get_deferred_job_status`, and related tools can return
   structured job data for explicit inspection, but normal chat rendering must
   not depend on assistant polling.
7. Default chat presentation receives `messages + jobSnapshots` as separate
   inputs and projects one visible job card per `jobId`.
8. Every job snapshot intended for product rendering has an origin anchor:
   durable `originMessageId`, `originTurnId`, or `toolInvocationId`. Fallback
   placement is only for system/repaired jobs where no chat origin exists by
   design.

## Architecture Principles

- SOLID: the message repository owns speech persistence; the job repository and
  job read model own job state; the presenter composes view models without
  mutating either source.
- DRY: one job freshness comparator remains shared; no independent
  latest-by-job implementation in React components, presenter code, and rail
  code.
- GoF patterns:
  - Adapter: API/read-model adapters translate DB rows into canonical job
    snapshots.
  - Strategy: render strategies choose the correct card for a job snapshot
    based on capability presentation descriptors.
  - Facade: the chat restore facade exposes a single `messages + jobSnapshots`
    contract to product surfaces.
  - Repository: message and job persistence remain separate repositories.

## Implementation Steps

1. Add an inventory test or source audit that lists every production creation
   path for assistant messages containing `job_status`, including mixed
   contentful assistant messages.
2. Add a contract test that fails once 09d is complete if production code
   persists a new assistant message containing a `job_status` lifecycle part.
   Existing matches are explicit failure targets for 09b/09c/09d, not accepted
   compatibility behavior.
3. Add a test fixture for the April 30 image-generation failure shape:
   one streamed assistant acknowledgement, one completed `generate_blog_image`
   snapshot, one visible product job card.
4. Do not add tests that assert `tool_result.deferred_job` renders a queued
   product card. It is a legacy violation and must remain only in source
   inventories until removed.
5. Add an edge-case test for an active queued/running job where no terminal
   snapshot exists yet: one in-progress card is allowed from the job snapshot
   source.
6. Document all code paths that currently write, read, or render
   `job_status` message parts and classify them as `delete`, `replace`, or
   `explicit diagnostic only`.
7. Add an origin-anchor assertion for product-renderable snapshots. A snapshot
   with only `messageId: jobmsg_${jobId}` is not sufficient for the greenfield
   contract.
8. Update phase docs and QA notes to state that legacy transcript product
   compatibility is rejected for greenfield execution.

## Prune List

Mark these for deletion or replacement across 09b/09c/09d. They are not product
compatibility commitments:

- `DeferredJobConversationProjector` assistant-message writes for new job
  events.
- Product rendering from raw `job_status` message parts.
- Product rendering from `tool_result.deferred_job`.
- `stream-execution.ts` appending `deferredJobResultToMessagePart(...)` into
  assistant transcript parts.
- `usePresentedChatMessages.ts` using `upsertJobStatusMessage(...)` as the
  default product path.
- `buildJobStatusSnapshot()` using deterministic job-message ids as product
  placement anchors instead of origin metadata.
- `JobStatusSnapshot { messageId, conversationId, part }` as a product DTO.
- Tests that require duplicate transcript job-status messages to remain visible.
- Prompt/eval incentives that encourage status polling as a wait loop.

## Source Audit Targets

Run these searches during implementation and classify every match:

```bash
rg -n "messageRepo\\.create\\(|role: \"assistant\"|parts: \\[.*job_status|deferredJobResultToMessagePart|upsertJobStatusMessage|suppressStaleJobStatusMessages|createDeferredJobConversationProjector|extractJobStatusSnapshots|isDeferredJobResultPayload" src tests
rg -n "getJobMessageId\\(|JobStatusSnapshot|messageId: `?jobmsg_|originMessageId|originTurnId|toolInvocationId" src/lib src/core src/hooks src/adapters
```

Expected 09a classification categories:

- `delete`: product code that writes or renders job lifecycle as transcript
  state.
- `replace`: code that should consume canonical job snapshots instead.
- `diagnostic-only`: raw transcript export/admin inspection that remains
  outside default product chat.
- `legacy-removal-target`: current code that exists only because 09b/09c/09d
  have not hard-cut yet.

## Validation Plan

Positive tests:

- A completed job snapshot renders one card.
- An active job snapshot renders one in-progress card.
- Explicit job inspection still returns structured data to the assistant.

Negative tests:

- A `deferred_job` acknowledgement is inventoried as a legacy rendering path and
  has no test that blesses it as a product card.
- A production projector cannot persist assistant `job_status` lifecycle parts,
  including mixed contentful messages.
- Repeated status-tool results do not create product job cards.
- A product-renderable job snapshot without an origin anchor is rejected or
  placed only by the documented system/repaired-job fallback rule.

Edge-case tests:

- Snapshot arrives before the streamed assistant text.
- Snapshot arrives after reconnect reconciliation.
- Job fails or is canceled before the assistant stream finishes.
- Admin cancel/retry emits job events/read-model updates without writing
  transcript lifecycle messages.
- Restore hydrates active and attention jobs from snapshots without transcript
  mutation.
- Two jobs in one assistant turn render two distinct cards by different
  `jobId`s.

Run:

```bash
npm exec vitest run \
  tests/chat-job-state-contract-guardrails.test.ts \
  src/adapters/ChatPresenter.test.ts \
  src/hooks/usePresentedChatMessages.test.tsx \
  src/hooks/chat/useChatJobEvents.test.tsx \
  src/hooks/chat/useJobStateStore.test.tsx \
  src/lib/jobs/job-read-model.test.ts \
  src/app/api/chat/jobs/route.test.ts \
  tests/chat/chat-stream-route.test.ts \
  tests/job-visibility-cohesion.test.ts \
  src/lib/jobs/deferred-job-result.test.ts \
  src/lib/jobs/job-publication.test.ts \
  tests/chat-job-event-baseline.test.ts
```

## Implementation Evidence

Phase 09a now has an executable guardrail suite:

- `tests/chat-job-state-contract-guardrails.test.ts` now asserts the hard
  cutover remains intact. Production source must not reintroduce:
  - `DeferredJobConversationProjector`
  - `createDeferredJobConversationProjector(...)`
  - `deferredJobResultToMessagePart(...)` product presentation/persistence
  - `upsertJobStatusMessage(...)`
  - `suppressStaleJobStatusMessages(...)`
  - `extractJobStatusSnapshots(...)` product parsing
  - persisted assistant `job_status` lifecycle writers
  - restore-time transcript mutation that injects nested `job_status` payloads
- The suite keeps a narrow allowlist for non-product bridge usage and documents
  why each retained status-part helper is not a product source of truth:
  - `src/adapters/ChatPresenter.ts`
  - `src/hooks/chat/useBrowserCapabilityRuntime.ts`
  - `src/lib/jobs/job-status-snapshots.ts`
  - `src/lib/media/browser-runtime/job-snapshots.ts`
  - `src/lib/media/media-composition-asset-identity.ts`
- The suite no longer asserts that a `tool_result.deferred_job`
  acknowledgement renders as a queued product card.
- `getJobMessageId(...)` is no longer a product placement anchor; canonical
  snapshots carry durable origin metadata and documented fallback placement.

Focused validation passed:

```bash
npm exec vitest run \
  tests/chat-job-state-contract-guardrails.test.ts \
  src/adapters/ChatPresenter.test.ts \
  src/hooks/usePresentedChatMessages.test.tsx \
  src/hooks/chat/useChatJobEvents.test.tsx \
  src/hooks/chat/useJobStateStore.test.tsx \
  src/lib/jobs/job-read-model.test.ts \
  src/app/api/chat/jobs/route.test.ts \
  tests/chat/chat-stream-route.test.ts \
  tests/job-visibility-cohesion.test.ts \
  src/lib/jobs/deferred-job-result.test.ts \
  src/lib/jobs/job-publication.test.ts \
  tests/chat-job-event-baseline.test.ts
```

Result: package guardrails remain green after the hard-cutover QA cleanup.

Previous full validation for this phase package also passed:

```bash
npm run typecheck
npm test
```

Result: TypeScript passed; 652 Vitest files passed, 4755 tests passed, 2
skipped.

## Done Checklist

- [x] The new contract is documented in this package and linked from the phase
  index.
- [x] Every current source-audit target for job-status write, read, render, and
  mutation bridges is covered by an executable inventory test.
- [x] Tests or source audits fail if new production code persists assistant
  `job_status` lifecycle parts, including contentful assistant messages.
- [x] Tests do not encode `deferred_job` acknowledgement rendering as accepted
  product behavior.
- [x] All current legacy job-status surfaces are classified for deletion,
  replacement, or explicit diagnostic-only use.
- [x] Projector callers in platform revision and admin job actions are included
  in the removal/replacement inventory.
- [x] Product-renderable snapshots have an origin-anchor requirement documented
  for 09b.
- [x] Restore/hydration surfaces are included in the watchlist.
- [x] The implementation plan for 09b-09d has no reliance on duplicate
  transcript job cards.
