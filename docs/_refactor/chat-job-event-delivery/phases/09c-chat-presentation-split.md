# Phase 09c - Chat Presentation Split

## Goal

Change chat presentation from "messages with embedded job cards" to
`messages + jobSnapshots`, composed into one product view model at the boundary.

After this phase, `ChatPresenter` must not mine normal product job cards out of
`MessagePart.job_status` or `tool_result.deferred_job`.

## Pre-Implementation Codebase Grounding

Important surfaces:

- `src/hooks/usePresentedChatMessages.ts`
- `src/hooks/chat/useChatJobState.ts`
- `src/hooks/chat/useChatJobEvents.ts`
- `src/adapters/ChatPresenter.ts`
- `src/lib/chat/JobRenderCandidateMerger.ts`
- `src/lib/chat/StreamStrategy.ts`
- `src/core/services/ConversationMessages.ts`
- `src/hooks/chat/chatState.ts`
- `src/hooks/chat/useJobStateStore.ts`
- `src/hooks/useGlobalChat.tsx`
- `src/hooks/chat/useChatRestore.ts`
- `src/hooks/chat/workspaceRestoreApi.ts`
- `src/frameworks/ui/MessageList.tsx`
- `src/frameworks/ui/chat/bubbles/AssistantBubble.tsx`
- `src/frameworks/ui/chat/ToolPluginPartRenderer.tsx`
- `src/frameworks/ui/chat/registry/default-tool-registry.ts`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `src/frameworks/ui/product-experience-facade.ts`
- `src/frameworks/ui/product-experience-summary.ts`
- `src/frameworks/ui/jobs-rail/resolve-jobs-rail.ts`
- `tests/chat-job-state-contract-guardrails.test.ts`

09b hard-cut the backend read model to `CanonicalJobSnapshot`, but before 09c
default chat presentation still converted that canonical state back into
transcript-shaped `JobStatusMessagePart` values before rendering:

- `useChatJobState(...)` seeds restored canonical jobs by calling
  `canonicalJobSnapshotToStatusPart(snapshot)` and inventing `jobmsg_*`
  placement through `getJobMessageId(...)` when `originMessageId` is absent.
- `useJobStateStore(...)` stores `JobStateEntry { messageId, part }`, extracts
  `job_status` parts from raw transcript messages, and merges with
  `mergeJobStatusPart(...)`.
- `usePresentedChatMessages(...)` applies job truth by calling
  `upsertJobStatusMessage(...)`, then hides older synthetic messages with
  `suppressStaleJobStatusMessages(...)`.
- `useChatJobEvents(...)` reconciles `/api/chat/jobs` as if `jobs` were still
  `{ messageId, part }`, even though 09b made the route return
  `CanonicalJobSnapshot[]`.
- `chatState.ts` and `StreamStrategy.ts` still use `UPSERT_JOB_STATUS` to
  mutate chat message state from stream job events.
- `ChatPresenter.present(...)` still renders product job cards from explicit
  `MessagePart.job_status`, nested `extractJobStatusSnapshots(call.result)`,
  and `deferred_job` acknowledgements via `deferredJobResultToMessagePart(...)`.
- `MessageList` and `AssistantBubble` already render `PresentedMessage` view
  models and should not own duplicate suppression. The split should happen
  before these components receive data.
- Jobs rail and product-experience summary still consume `JobStateEntry`/parts.
  If 09c keeps their migration out of scope, the boundary must be explicit;
  otherwise they should consume canonical snapshots alongside chat.

That patch-level containment worked by deduping render candidates inside the
presenter and by mutating presented message state. The implemented target model
removes that logic from default product chat by keeping job snapshots outside
transcript messages until presentation assembly.

## Original QA Findings

| Finding | Code-grounded proof | Required correction |
| --- | --- | --- |
| Backend job reads are canonical, but chat state is still part-shaped. | `useChatJobState.ts` calls `canonicalJobSnapshotToStatusPart(...)`; `useJobStateStore.ts` stores `JobStateEntry { messageId, part }`. | Replace chat job state with `CanonicalJobSnapshot` entries keyed by `jobId`; do not convert snapshots back into `JobStatusMessagePart` for default chat. |
| Reconciliation is stale relative to 09b. | `useChatJobEvents.ts` declares `/api/chat/jobs` as `jobs?: Array<{ messageId; part }>` and dispatches `UPSERT_JOB_STATUS`. | Parse `CanonicalJobSnapshot[]` from `/api/chat/jobs`; update job snapshot state directly; stop dispatching message-part upserts for product reconciliation. |
| Streaming still mutates transcript state for job updates. | `StreamStrategy.ts` dispatches `UPSERT_JOB_STATUS`; `chatState.ts` handles it by calling `upsertJobStatusMessage(...)`. | Route streaming job updates into canonical snapshot state for product chat. Leave message mutation only for explicitly diagnostic/export flows if still needed before 09d. |
| Restore still invents job-message placement. | `useChatJobState.ts` falls back to `getJobMessageId(snapshot.jobId)`. | Use `snapshot.origin.originMessageId`, `originTurnId`, or deterministic chronological fallback in a presentation association function. |
| Default presentation mutates messages to apply job truth. | `usePresentedChatMessages.ts` calls `upsertJobStatusMessage(...)` and `suppressStaleJobStatusMessages(...)`. | Make `usePresentedChatMessages` accept `messages + CanonicalJobSnapshot[]` and attach job cards without changing `ChatMessage.parts`. |
| Presenter still mines product job cards from transcript/tool payloads. | `ChatPresenter.ts` reads explicit `job_status`, `extractJobStatusSnapshots(call.result)`, and `isDeferredJobResultPayload(call.result)`. | Remove these from default product rendering. Keep raw tool call/result rendering only for non-job capabilities and diagnostics. |
| Guardrails already classify these bridges as replacement targets. | `tests/chat-job-state-contract-guardrails.test.ts` marks `extractJobStatusSnapshots`, `upsertJobStatusMessage`, `suppressStaleJobStatusMessages`, and `deferredJobResultToMessagePart` for 09c/09d removal. | Update guardrails as each bridge is deleted so the inventory shrinks rather than moves. |

## Implementation QA Status

Status: implemented and verified.

Current code checks:

- `useChatJobState(...)` seeds `CanonicalJobSnapshot[]` directly from workspace
  restore active/attention jobs.
- `useJobStateStore(...)` stores `CanonicalJobSnapshot` entries and merges by
  canonical freshness through `mergeJobSnapshots(...)`.
- `useChatJobEvents(...)` reconciles `/api/chat/jobs` as
  `CanonicalJobSnapshot[]` and converts live SSE job events into canonical
  snapshots at the event boundary.
- `chatState.ts` no longer exposes `UPSERT_JOB_STATUS`; product stream job
  events no longer mutate `ChatMessage.parts`.
- `usePresentedChatMessages(...)` accepts `messages + jobSnapshots` and calls
  `ChatPresenter.presentMany(messages, jobSnapshots)`.
- `ChatPresenter` ignores transcript `job_status`, nested status-tool payloads,
  and `deferred_job` acknowledgements for default product cards. Product cards
  are rendered only from canonical snapshots.
- Jobs rail and product-experience summary consume canonical `JobStateEntry`
  snapshots.
- Guardrails confirm the removed 09c bridges no longer appear in default chat
  presenter/hooks/reducer paths.

Package QA after 09d:

- Default chat still receives `messages + CanonicalJobSnapshot[]` as separate
  inputs.
- Product presentation still ignores transcript `job_status`, nested
  status-tool snapshots, and `deferred_job` acknowledgements as product-card
  sources.
- Any remaining status-part shaped value is created inside the presentation
  adapter boundary for existing card renderers, not in hooks, restore,
  reconciliation, reducer state, or persisted assistant messages.
- Workspace restore no longer rewrites pending compose-media tool results into
  nested transcript `job_status` payloads. Restored transcript history remains
  unchanged, and restored job cards come from canonical `activeJobs` and
  `attentionNeededJobs`.

## Target Presentation Contract

`usePresentedChatMessages` should receive:

```ts
type ChatPresentationInput = {
  messages: ChatMessage[];
  jobSnapshots: CanonicalJobSnapshot[];
  isSending: boolean;
};
```

The presenter should output:

```ts
type PresentedMessage = {
  id: string;
  role: string;
  content: RichContent;
  toolRenderEntries: ToolRenderEntry[];
};
```

Rules:

- Text comes from message content/text parts.
- Tool call/result history remains available for diagnostics, but normal
  deferred job acknowledgements are not renderable cards.
- Job cards are attached by `originMessageId`, `originTurnId`, or fallback
  chronological placement.
- Fallback placement must use canonical snapshot fields (`createdAt`,
  `updatedAt`, `conversationId`, `origin.fallback`) and nearby assistant message
  timestamps; it must not invent `jobmsg_${jobId}` as a product anchor.
- One `jobId` appears once in the default transcript.
- Multi-job turns can render multiple cards when they have distinct `jobId`s.
- Raw transcript `job_status` parts are ignored by default product chat. Do not
  dedupe them; do not render them. Diagnostic transcript viewers can expose raw
  history elsewhere.

## Architecture Principles

- SOLID:
  - ChatPresenter composes view models; it does not act as a job repository.
  - JobStateStore owns latest state; React components render already-deduped view
    models.
- DRY:
  - No React-component-level duplicate suppression.
  - No separate presenter and hook dedupe rules.
- GoF patterns:
  - Facade: `usePresentedChatMessages` becomes the facade over message and job
    state.
  - Composite: a presented message composes text, attachments, and zero-or-more
    job/tool entries.
  - Strategy: `ToolPluginPartRenderer` chooses card renderers from descriptors,
    not from transcript-specific branches.

## Implementation Steps

1. Consume the `CanonicalJobSnapshot` from 09b directly. Do not introduce a
   second chat-specific snapshot DTO.
2. Update `usePresentedChatMessages` to accept snapshots as a separate source,
   not by upserting synthetic assistant messages. The current call site in
   `useChatSurfaceState.tsx` must pass canonical snapshots instead of
   `jobStateEntries`.
3. Delete `upsertJobStatusMessage(...)` from the default product presentation
   path. Replace it with a pure association step that attaches snapshots to
   their origin message.
4. Replace `useJobStateStore`/`JobStateEntry` in default chat with a canonical
   snapshot store. Keep freshness comparison by `sequence`/`updatedAt`, not by
   message part merge.
5. Update `useChatJobEvents` to reconcile canonical `/api/chat/jobs` responses
   and EventSource job events into the snapshot store. If stream events are
   still message-part shaped during 09c, convert them only at the event adapter
   boundary and immediately normalize to `CanonicalJobSnapshot`.
6. Update `chatState.ts` and `StreamStrategy.ts` so product job updates do not
   call `UPSERT_JOB_STATUS` or mutate `ChatMessage.parts`.
7. Remove normal product rendering from `tool_result.deferred_job`.
8. Remove normal product rendering from explicit `job_status` parts. If an
   admin diagnostic transcript renderer remains, put it behind a separate
   diagnostic namespace and tests.
9. Update `AssistantBubble` and `MessageList` tests so they assert one card from
   the snapshot source.
10. Keep capability-card rendering, but feed card components from a
   snapshot-derived `JobCardViewModel`, not from transcript-derived parts.
11. Add a no-origin fallback: if origin metadata is absent, attach the job card
   after the closest assistant message in the conversation by job creation time.
12. Delete or rewrite presenter tests that seed product job cards via
   `MessagePart.job_status`, nested `job_status` snapshots, or
   `deferred_job` acknowledgements.
13. Decide whether jobs rail/product-experience summary move in 09c or remain
    a named 09d follow-up. Do not leave them silently consuming
    `JobStateEntry { part }` after chat has moved to canonical snapshots.

## Prune List

Remove or shrink:

- `ConversationMessages.upsertJobStatusMessage(...)` from default product chat
  restore/presentation flow.
- `ConversationMessages.suppressStaleJobStatusMessages(...)` from default
  product path after snapshots own rendering.
- `ChatPresenter` extraction of `deferred_job` acknowledgements for normal card
  rendering.
- `ChatPresenter` extraction of nested status snapshots for normal card
  rendering.
- `JobRenderCandidateMerger` from default product rendering if its only
  remaining purpose is deduping transcript fragmentation.
- Presenter tests that seed product job cards only through transcript parts.
- `JobStateEntry { messageId, part }` from default chat once
  `CanonicalJobSnapshot` state owns chat job rendering.
- `getJobMessageId(...)` as a default product placement anchor in chat hooks.
- `UPSERT_JOB_STATUS` from default product chat state once stream/reconcile job
  updates feed canonical snapshot state.

Keep only if explicitly diagnostic:

- Raw transcript/export preservation of original tool calls/results.
- Admin diagnostic rendering of historical job status parts, if needed by admin
  pages.
- Stream/export compatibility helpers that still need `JobStatusMessagePart`
  until 09d deletes or quarantines the remaining message-shaped publication
  channels.

## Validation Plan

Positive tests:

- A completed image job snapshot attaches to the assistant turn and renders one
  image card.
- A running job snapshot attaches to the assistant turn and updates in place.
- Two distinct jobs from one turn render two cards.
- Assistant prose remains visible even when job cards update.

Negative tests:

- `deferred_job` acknowledgement does not render a product card.
- Raw `job_status` transcript part does not render in default chat when a
  canonical snapshot exists.
- Raw `job_status` transcript part also does not render in default chat when no
  canonical snapshot exists; missing snapshots should be fixed at the read
  model/event layer, not by falling back to transcript parts.
- React components do not dedupe duplicate job entries; they should never
  receive duplicates.
- `/api/chat/jobs` canonical snapshots are accepted by reconciliation without
  requiring `messageId` or `part`.
- `UPSERT_JOB_STATUS` is not dispatched for product `/api/chat/jobs`
  reconciliation.
- Streamed job progress/completion does not mutate `ChatMessage.parts`.

Edge-case tests:

- Snapshot has no origin message and falls back deterministically.
- User navigates away and restore returns messages before snapshots.
- Snapshot arrives via EventSource while assistant text is still streaming.
- Job completes with failure and replaces an active card without duplicating.
- Assistant turn has two canonical snapshots with the same `originTurnId` and
  distinct `toolInvocationId`s; both render once.
- Transcript contains stale `job_status` and nested status-tool output, while a
  fresher canonical snapshot exists; only the canonical card renders.

Run:

```bash
npm exec vitest run \
  src/hooks/usePresentedChatMessages.test.tsx \
  src/adapters/ChatPresenter.test.ts \
  src/frameworks/ui/MessageList.test.tsx \
  src/frameworks/ui/chat/bubbles/AssistantBubble.test.tsx \
  src/frameworks/ui/chat/ToolPluginPartRenderer.test.tsx \
  src/hooks/useGlobalChat.test.tsx \
  src/frameworks/ui/useChatSurfaceState.test.tsx \
  src/hooks/chat/useChatJobEvents.test.tsx \
  src/hooks/chat/useJobStateStore.test.tsx \
  src/lib/chat/StreamStrategy.test.ts \
  tests/chat-job-state-contract-guardrails.test.ts
```

## Done Checklist

- [x] Product presentation receives messages and job snapshots as separate
  sources.
- [x] Default chat no longer upserts synthetic assistant job-status messages.
- [x] Product stream/reconcile job updates feed canonical snapshot state instead
  of `UPSERT_JOB_STATUS`.
- [x] Default chat no longer renders `deferred_job` acknowledgements as product
  cards.
- [x] One job snapshot creates one product card by `jobId`.
- [x] Prose, suggestions, attachments, and job cards compose without hidden
  component-level dedupe.
- [x] Tests cover success, running, failed, canceled, no-origin fallback, and
  multi-job turns.

## QA Evidence

Focused verification:

```bash
npm test -- \
  src/adapters/ChatPresenter.test.ts \
  src/hooks/usePresentedChatMessages.test.tsx \
  src/hooks/chat/useChatJobEvents.test.tsx \
  src/hooks/chat/useJobStateStore.test.tsx \
  src/hooks/useGlobalChat.test.tsx \
  src/lib/chat/StreamStrategy.test.ts \
  tests/chat-job-state-contract-guardrails.test.ts
```

Result: 7 test files passed, 121 tests passed.

```bash
npm run typecheck
```

Result: passed.

Full package validation after 09d also passed:

```bash
npm test
```

Result: 652 files passed, 4755 tests passed, 2 skipped.
