# Phase 05 - Presenter Dedupe And Raw History

## Goal

Stop repeated nested status-tool snapshots from becoming repeated visible chat
cards while preserving raw transcript diagnostics.

## Post-09 Hard-Cutover Note

This phase is historical evidence for the containment layer before the
greenfield cutover. Phases 09b-09d moved default product job cards to
canonical snapshots and removed product rendering from transcript
`job_status`, nested status-tool snapshots, and `deferred_job`
acknowledgements. Raw transcript diagnostics remain available, but they are not
the default product-card source.

Historical commands and test-file references below are preserved as Phase 05
evidence only. Do not run deleted `tests/conversation-messages.test.ts`
as current validation; use the 09a-09d validation commands instead.

Phase 04 now owns explicit `job_status` merge authority before presentation:

- `src/lib/jobs/job-status-part-merge.ts` merges `JobStatusMessagePart` values
   for message-state and active-chat job-state entries.
- `src/core/services/ConversationMessages.ts` applies durable job truth into
   message state and suppresses stale explicit `job_status` messages without
   mutating raw messages.
- `src/hooks/usePresentedChatMessages.ts` applies `jobStateEntries` before
   calling `ChatPresenter.presentMany()`.

Phase 05 starts after that boundary. It should solve the remaining presenter
problem: nested job snapshots inside `tool_result` payloads, especially repeated
`get_deferred_job_status` reads, can still become visible job cards even when
the durable job truth is one job.

## Preparation Evidence

Current code shape on 2026-04-30:

| Surface | Current behavior | Phase 05 decision |
| --- | --- | --- |
| `ChatPresenter.present()` | Builds `toolRenderEntries` for explicit `job_status` parts first, then extracts nested snapshots with `extractJobStatusSnapshots(call.result)`. It uses local `renderedJobIds` to skip later snapshots for the same job within the same message. | Replace first-wins `renderedJobIds` with freshness-aware candidate selection before entries are emitted. |
| `ChatPresenter.presentMany()` | Currently returns `messages.map((m) => this.present(m))`, so it cannot suppress repeated nested status-tool cards across transcript messages. | Add transcript-level presenter/read-model dedupe here or through a small pure helper used by `presentMany()`. |
| `JobRenderCandidateMerger.ts` | Already defines `JobRenderCandidate`, `compareJobRenderCandidateFreshness()`, and `upsertRenderedJobCandidate()`. Freshness currently compares `sequence`, then `updatedAt`, then encounter order. | Promote this as the presenter candidate authority. Extend only if tests require terminal/result tie-breakers from the contract. |
| `ChatPresenter.ts` media truth helpers | Still has local `MEDIA_TOOL_NAMES`, `isMediaJobStatusPart()`, and `resolveTruthBoundMediaText()` even though `JobRenderCandidateMerger.ts` has equivalent helpers. | Consolidate imports from `JobRenderCandidateMerger.ts` if Phase 05 touches this path. Otherwise document why duplication remains. |
| `usePresentedChatMessages()` | Applies durable job state before presentation and preserves raw `messages`; tests prove explicit job truth does not mutate raw history. | Keep as the bridge. Do not move nested snapshot dedupe into React components. |
| `ToolPluginPartRenderer.tsx` | Renders presenter view models. | Do not hide duplicates here; Phase 05 must prevent duplicate view models before component rendering. |

Baseline tests already present:

- `src/adapters/ChatPresenter.test.ts` contains
   `it.fails("documents the Phase 00 transcript-level duplicate-card baseline")`.
   It uses `createKeithBaselineTranscript()` and proves raw status tool results
   remain five while the desired visible card count is one. Phase 05 should turn
   this into a passing test by fixing presenter/read-model behavior.
- `tests/fixtures/chat-job-event-baseline.ts` provides Keith-shaped constants,
   repeated status reads, and durable completed job state helpers.
- `src/hooks/usePresentedChatMessages.test.tsx` already proves explicit durable
   job truth is applied before presentation without raw history mutation; Phase
   05 should add nested status-tool coverage there only if the bridge must change.

Known drift to resolve or explicitly retain:

- `ChatPresenter.present()` first accepts the first nested snapshot it sees for a
   `jobId`; a later fresher nested snapshot in the same message can be skipped.
- `ChatPresenter.presentMany()` has no transcript-level awareness, so five
   separate status-tool messages can still produce five visible cards.
- `JobRenderCandidateMerger.ts` is not currently imported by `ChatPresenter.ts`,
   despite being the intended presenter freshness seam.
- The contract asks freshness to prefer highest `sequence`, latest `updatedAt`,
   terminal status on ties, and result payload on ties. The current helper covers
   only `sequence`, `updatedAt`, and encounter order.
- Raw transcript visibility must remain intact for export/admin diagnostics;
   dedupe must change `PresentedMessage.toolRenderEntries`, not delete
   `ChatMessage.parts`.

## Implementation Evidence

Implemented on 2026-04-30.

Changed presenter candidate authority:

- Extended `src/lib/chat/JobRenderCandidateMerger.ts` so presenter freshness now
   compares `sequence`, `updatedAt`, terminal status, result-bearing candidates,
   explicit-vs-nested source, and encounter order.
- Updated `src/adapters/ChatPresenter.ts` to route explicit `job_status` parts
   and nested status-tool snapshots through `JobRenderCandidateMerger.ts` before
   creating visible `ToolRenderEntry` objects.
- Updated `ChatPresenter.presentMany()` to suppress repeated visible job-status
   entries across transcript messages while preserving raw source messages.
- Removed presenter-local duplicate media truth helpers and now imports the
   shared helpers from `JobRenderCandidateMerger.ts`.

Added or updated focused tests:

- Added `src/lib/chat/JobRenderCandidateMerger.test.ts` for higher sequence,
   later `updatedAt`, terminal tie-break, result-bearing tie-break,
   explicit-source tie-break, and deterministic encounter-order behavior.
- Updated `src/adapters/ChatPresenter.test.ts` so same-message nested snapshots
   select the freshest candidate before rendering.
- Added exact same-message `get_deferred_job_status` duplicate coverage for
   repeated unchanged status reads with the same `jobId` and `sequence`.
- Converted the Keith Phase 00 transcript duplicate-card baseline from
   `it.fails` to a passing presenter-level test: five raw status-tool results are
   preserved while one visible job card is rendered.
- Added presenter coverage proving explicit durable `job_status` truth wins over
   equivalent nested status-tool snapshots.
- Added cross-message coverage proving explicit durable `job_status` truth keeps
   its source-precedence over equivalent later nested status-tool snapshots.

Verification command:

```bash
npm exec vitest run \
   src/lib/chat/JobRenderCandidateMerger.test.ts \
   src/adapters/ChatPresenter.test.ts \
   src/hooks/usePresentedChatMessages.test.tsx \
   tests/conversation-messages.test.ts \
   src/hooks/chat/useJobStateStore.test.tsx
```

Result:

- 5 test files passed.
- 83 tests passed.

QA follow-up on 2026-04-30:

- Audited Phase 05 Done items and validation checklist entries against
   executable tests.
- Found and fixed an evidence gap: the checklist specifically named repeated
   same-message `get_deferred_job_status` snapshots, while the initial
   same-message freshness test used `list_deferred_jobs` and the Keith fixture
   covered repeated status reads across messages.
- Found and fixed a source-precedence gap: `presentMany()` re-compared
   already-created job entries without preserving whether the entry originated
   from an explicit durable `job_status` part or a nested tool snapshot.
- Added `source` metadata to job-status `ToolRenderEntry` objects so
   explicit-vs-nested tie-breaking remains available during transcript-level
   dedupe.
- Tightened the Keith baseline test to assert raw status-tool history remains
   present after `presentMany()`.

Additional validation:

```bash
npm exec eslint \
   src/lib/chat/JobRenderCandidateMerger.ts \
   src/lib/chat/JobRenderCandidateMerger.test.ts \
   src/adapters/ChatPresenter.ts \
   src/adapters/ChatPresenter.test.ts \
   src/hooks/usePresentedChatMessages.test.tsx \
   tests/conversation-messages.test.ts \
   src/hooks/chat/useJobStateStore.test.tsx
```

Result: no findings.

## Steps

1. Add or promote tests for `JobRenderCandidateMerger.ts` freshness behavior:
    sequence, `updatedAt`, equal-sequence terminal-over-running, result payload
    over empty payload, and deterministic tie handling.
2. Add presenter tests for a single assistant message containing multiple nested
    snapshots for one `jobId`; the freshest snapshot must be selected before a
    `ToolRenderEntry` is created.
3. Convert the Keith baseline `it.fails` presenter test into a passing test:
    one durable job plus five unchanged nested status reads renders one visible
    job card while `countRawStatusToolResults(transcript)` remains five.
4. Route explicit `job_status` parts and nested status-tool snapshots through
    `JobRenderCandidateMerger.ts` or a small adjacent helper before emitting
    `ToolRenderEntry` objects.
5. Make `ChatPresenter.presentMany()` own transcript-level visible dedupe if the
    dedupe spans multiple assistant messages. Keep `present()` deterministic for
    single-message presentation.
6. Prefer explicit latest durable `job_status` parts over stale nested snapshots
    when both appear for the same `jobId` in the presented transcript.
7. Preserve terminal result payload actions, custom card behavior, and projected
    result envelopes for compose media, audio, chart, graph, editorial, and admin
    web-search jobs.
8. Preserve raw `tool_call` and `tool_result` history for export and admin
    diagnostics. Do not mutate `ChatMessage.parts` or remove tool results.
9. Remove local `renderedJobIds` first-wins behavior from `ChatPresenter.ts`, or
    document any remaining use as encounter bookkeeping after freshness selection
    has already happened.
10. Remove duplicate media truth helper logic from `ChatPresenter.ts` by
    importing the helpers from `JobRenderCandidateMerger.ts`, or document why it
    remains separate.

## Required Test Additions

Add or expand `src/lib/chat/JobRenderCandidateMerger.test.ts` to prove:

1. Higher `sequence` beats lower `sequence`.
2. Later valid `updatedAt` beats earlier `updatedAt` when sequence ties.
3. Terminal status beats active status when sequence and `updatedAt` tie.
4. A candidate with `resultPayload` or `resultEnvelope` beats an otherwise equal
    empty candidate.
5. Stable encounter order is deterministic when candidates are otherwise equal.

Extend `src/adapters/ChatPresenter.test.ts` to prove:

1. Repeated nested `get_deferred_job_status` snapshots for the same `jobId` and
    same `sequence` create one visible job-status render entry.
2. A later nested `succeeded` snapshot replaces earlier nested `running`
    snapshots for the same `jobId` in the same message.
3. A transcript with five Keith-style status-tool reads presents one visible
    card while raw status tool results remain five.
4. An explicit durable `job_status` part beats stale nested status-tool snapshots
    for the same `jobId`.
5. Terminal result payload actions and projected envelopes still render for the
    existing compose-media/editorial/admin job cases.

Extend `src/hooks/usePresentedChatMessages.test.tsx` only if the implementation
needs bridge-level changes. If `ChatPresenter.presentMany()` owns the transcript
dedupe, a presenter-level test is enough for raw-history preservation, and the
existing bridge immutability test should remain passing.

Suggested focused command:

```bash
npm exec vitest run \
   src/lib/chat/JobRenderCandidateMerger.test.ts \
   src/adapters/ChatPresenter.test.ts \
   src/hooks/usePresentedChatMessages.test.tsx \
   tests/conversation-messages.test.ts \
   src/hooks/chat/useJobStateStore.test.tsx
```

If the candidate merger test is covered through `ChatPresenter.test.ts` instead
of a new file, record that explicitly in implementation evidence.

## Code Anchors

- `src/lib/chat/JobRenderCandidateMerger.ts`
- `src/lib/chat/JobRenderCandidateMerger.test.ts`
- `src/adapters/ChatPresenter.ts`
- `src/adapters/ChatPresenter.test.ts`
- `src/hooks/usePresentedChatMessages.ts`
- `src/hooks/usePresentedChatMessages.test.tsx`
- `src/core/services/ConversationMessages.ts`
- `src/lib/jobs/job-status-part-merge.ts`
- `tests/fixtures/chat-job-event-baseline.ts`
- `src/frameworks/ui/chat/ToolPluginPartRenderer.tsx`

## Positive Cases

- One durable job with five unchanged nested status reads renders one visible
  job card.
- A later `succeeded` snapshot replaces earlier `running` snapshots.
- A later nested snapshot in the same message is selected over an earlier stale
   nested snapshot.
- Explicit durable `job_status` truth wins over stale nested status-tool output.
- Custom job cards and computed actions still render after candidate selection.

## Negative Cases

- Deduping default view must not delete raw transcript parts.
- Component-level hiding is not sufficient.
- Do not use assistant polling, SSE routes, repositories, SQLite, Push, or job
   queue behavior to solve Phase 05.
- Do not remove `get_deferred_job_status`; Phase 06 owns status-tool guardrails.
- Do not dedupe unrelated jobs that happen to use the same tool name; identity is
   `jobId`.

## Edge Cases

- Missing `sequence` values in nested snapshots.
- Invalid or missing `updatedAt` values.
- Equal sequence with later `updatedAt`.
- Equal sequence and `updatedAt` with terminal versus active status.
- Equal sequence and `updatedAt` with result payload versus no result payload.
- One message containing multiple snapshots for the same `jobId`.
- Multiple messages containing repeated snapshots for the same `jobId`.
- Explicit `job_status` part and nested tool snapshot for the same `jobId` in
   one presented transcript.
- Media jobs that rely on `resolveTruthBoundMediaText()` to align text with the
   selected job truth.

## Done

- [x] `JobRenderCandidateMerger.ts` or an explicitly documented adjacent helper
   owns presenter candidate freshness.
- [x] `ChatPresenter.ts` no longer relies on first-wins `renderedJobIds` before
   freshness selection.
- [x] `ChatPresenter.presentMany()` or an equivalent read-model helper dedupes
   repeated nested status-tool snapshots across transcript messages.
- [x] Keith-style fixture passes at presenter level with one visible job card
   and five raw status tool results preserved.
- [x] Same-message nested snapshots choose the freshest candidate.
- [x] Explicit durable `job_status` parts outrank stale nested status-tool
   snapshots.
- [x] Raw history remains inspectable and source `ChatMessage.parts` are not
   mutated.
- [x] Custom job cards, result envelopes, and computed actions still pass their
   existing presenter tests.
- [x] No route, EventSource, repository, SQLite, Push, status-tool availability,
   or prompt behavior changes are included in this phase.
