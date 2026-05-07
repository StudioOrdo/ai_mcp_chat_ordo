# Systemic Audit

Date: 2026-04-30
Status: Phase 08 cleanup implemented and validated

## Purpose

This audit looks beyond the April 30 Keith incident to identify similar legacy
issues and fragmented attempts that could weaken the chat job event delivery
refactor if they are left outside the implementation scope.

The goal is not to broaden the refactor into every job or media feature. The
goal is to make the implementation holistic enough that it removes the old
pressure to use assistant status polling as a synchronization mechanism.

## Fragmentation Findings

### 1. Freshness And Dedupe Logic Is Split Across Layers

Current surfaces:

- `src/lib/chat/JobRenderCandidateMerger.ts`
- `src/adapters/ChatPresenter.ts`
- `src/core/services/ConversationMessages.ts`
- `src/hooks/chat/useJobStateStore.ts`
- `src/components/jobs/job-snapshot-reducer.ts`
- `src/frameworks/ui/jobs-rail/resolve-jobs-rail.ts`

Risk:

- Several files solve related but not identical versions of latest-by-`jobId`
  freshness selection.
- Phase 08 verified there is no remaining source `renderedJobIds` first-wins
  path in `src/**`.
- `JobRenderCandidateMerger.ts` owns presenter-level candidate freshness and
  media truth text; Phase 08 moved shared job-status part freshness into
  `src/lib/jobs/job-status-part-merge.ts` so transcript suppression and
  presenter comparison use the same smaller primitive.
- The Jobs workspace reducer has its own snapshot freshness comparison.

Refactor requirement:

- Treat `JobRenderCandidateMerger.ts` as the preferred consolidation point for
  presenter-level render candidates.
- Treat `compareJobStatusPartFreshness()` as the shared smaller primitive for
  job-status part sequence, timestamp, terminal-state, and result freshness.
- Keep nested status-tool snapshot selection through pure helpers before
  visible `ToolRenderEntry` objects are created.
- Do not force the Jobs workspace reducer to import presenter types; instead,
  share only small freshness primitives if practical.

### 2. Cursor Support Exists But Is Not Symmetric

Phase 01 inventory result:

- `JobQueueDataMapper.listConversationEvents()` returns conversation-scoped
  `job_events.sequence` values.
- `JobQueueDataMapper.listUserEvents()` filters by signed-in user ownership and
  returns `job_events.rowid` as the stream-facing `sequence`.
- `/api/chat/events` and `/api/jobs/events` both accept `afterSequence` and
  `Last-Event-ID`, but those cursors intentionally mean different things.
- `useChatJobEvents()` still opens a cursorless EventSource URL; Phase 03 owns
  that behavior change.

Current surfaces:

- `src/app/api/chat/events/route.ts`
- `src/app/api/jobs/events/route.ts`
- `src/app/api/jobs/_lib.ts`
- `src/hooks/chat/useChatJobEvents.ts`
- `src/components/jobs/useJobsEventStream.ts`
- `src/adapters/JobQueueDataMapper.ts`

Risk:

- The chat route accepts `afterSequence` and `Last-Event-ID`, but the active chat
  hook opens the stream without a cursor.
- The jobs workspace hook already tracks `lastSequenceRef` and ignores older or
  equal sequence events.
- Conversation streams use job event `sequence`; user-scoped streams use rowid
  style `user_sequence` semantics. These must remain named separately in tests.

Refactor requirement:

- Add active chat cursor tracking using the Jobs workspace hook as the reference
  pattern.
- Keep conversation and user cursor semantics explicit; do not create a generic
  cursor abstraction that hides the source sequence meaning.

### 3. Status Tools Remain Valid But Should Stop Being A Wait Loop

Current surfaces:

- `src/core/entities/job-status-response-strategy.ts`
- `src/core/use-cases/tools/deferred-job-status.tool.ts`
- `src/core/capability-catalog/families/job-capabilities.ts`
- `src/lib/evals/scenarios.ts`
- `src/lib/evals/runner.ts`
- `src/lib/evals/live-runner.ts`

Risk:

- Tool descriptions say status reads should be summarized and should not rerun
  work, but they do not explicitly say repeated unchanged status reads are not
  the waiting strategy.
- Several eval scenarios still mark `list_deferred_jobs` and
  `get_deferred_job_status` as `must_use` for recovery paths after missed SSE.
  Those scenarios were useful for older reliability work, but after this
  refactor they can preserve the wrong incentive: model-driven polling instead
  of event delivery plus reconciliation.

Refactor requirement:

- Keep status tools for explicit user requests, diagnostics, admin inspection,
  and deterministic eval fixtures.
- Update prompt/tool descriptions to forbid repeated unchanged reads as a wait
  loop.
- Rewrite eval expectations so missed-SSE recovery is proven by the chat event
  hook and reconciliation path, not by requiring the assistant to call status
  tools unless the user explicitly asks.

### 4. Browser Runtime Synthetic Jobs Are Adjacent Debt

Phase 01 inventory result:

- The current workspace code excludes `compose_media` from transcript-derived
  browser runtime candidates in `getBrowserRuntimeCandidates()`.
- Browser runtime synthetic ids still exist for other browser-capable media
  tools, so Phase 10 should keep the compatibility proof requirement.
- Compose-media execution ownership remains delegated to
  `docs/_refactor/compose-media-execution-ownership/contract-spec.md`.

Current surfaces:

- `src/lib/media/browser-runtime/job-snapshots.ts`
- `docs/_refactor/compose-media-execution-ownership/contract-spec.md`
- `src/lib/jobs/job-read-model.ts`

Risk:

- Browser runtime discovery has historically inferred synthetic job-like
  candidates from transcript parts.
- The compose-media ownership refactor documents duplicate synthetic/canonical
  job problems. That is not the primary cause of the Keith incident, but it is
  the same family of issue: transcript-derived runtime truth competing with
  durable job truth.

Refactor requirement:

- Do not expand this package into the compose-media ownership refactor.
- Add a compatibility check proving durable server job snapshots suppress or
  outrank transcript-derived synthetic candidates when both exist for the same
  work.
- Cross-reference the compose-media ownership package during implementation
  closeout.

### 5. Push Notification Infrastructure Is Present But Not The Active-Chat Source

Current surfaces:

- `src/hooks/useChatPushNotifications.ts`
- `src/app/api/notifications/push/route.ts`
- `src/lib/jobs/deferred-job-notifications.ts`
- `src/adapters/PushNotificationChannel.ts`
- `public/push-worker.js`

Risk:

- Browser Push support can be mistaken for the active-chat delivery mechanism.
- Push permissions and service worker behavior are less reliable than active
  EventSource delivery and cannot replace in-page reconciliation.

Refactor requirement:

- Keep Push as optional terminal-state away/background notification only.
- Active chat correctness must pass with Push unavailable, denied, or disabled.

## Dead-Code And Cleanup Watchlist

Cleanup candidates after implementation:

- local `renderedJobIds` first-wins behavior in `ChatPresenter` if replaced by
  candidate freshness helpers
- duplicate `resolveTruthBoundMediaText` logic if the helper in
  `JobRenderCandidateMerger.ts` becomes canonical
- eval scenarios that require status tools for non-user-initiated recovery
- deterministic runner fixtures that synthesize repeated status reads as the
  normal recovery proof
- tests that assert repeated unchanged status-tool outputs produce repeated
  visible cards
- old docs that describe status polling as the reliability strategy rather than
  a diagnostic/user-request path

Retain explicitly:

- raw transcript and tool-call visibility
- status tools for explicit requests and diagnostics
- Jobs workspace event stream and reducer
- browser Push subscription API
- compose-media ownership package as a separate but related cleanup track

## Additional Test Requirements

- Keith scenario: one durable job plus five unchanged status reads produces one
  default visible job card and preserved raw transcript history.
- Presenter consolidation: repeated nested snapshots in one assistant message
  choose the freshest snapshot before `ToolRenderEntry` creation.
- Eval behavior: non-user-initiated missed-SSE recovery is covered by hook route
  tests, not by model `must_use` status-tool expectations.
- Cursor semantics: conversation `sequence` and user `user_sequence`/rowid
  cursor behavior are tested separately.
- Push fallback: active chat job updates still reconcile when Push is disabled
  or unavailable.

## Closeout Standard

Implementation closeout must list:

- consolidated freshness helpers retained or removed
- eval scenarios rewritten or explicitly retained
- status-tool prompt text updated
- browser-runtime synthetic job compatibility result
- Push boundary result
- raw-history preservation result
