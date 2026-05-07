# Chat Job Event Delivery Phase Plan

This file is the executive phase overview. Detailed implementation steps live in
[phases/](phases/README.md).

## Detailed Phase Index

0. [Phase 00 - Baseline Evidence](phases/00-baseline-evidence.md)
1. [Phase 01 - Contract And Surface Inventory](phases/01-contract-and-surface-inventory.md)
2. [Phase 02 - Cursor Semantics And Route Hardening](phases/02-cursor-semantics-and-route-hardening.md)
3. [Phase 03 - Active Chat Event Hook](phases/03-active-chat-event-hook.md)
4. [Phase 04 - Job State Merge Authority](phases/04-job-state-merge-authority.md)
5. [Phase 05 - Presenter Dedupe And Raw History](phases/05-presenter-dedupe-and-raw-history.md)
6. [Phase 06 - Status Tool Guardrails](phases/06-status-tool-guardrails.md)
7. [Phase 07 - Eval And Fixture Rewrite](phases/07-eval-and-fixture-rewrite.md)
8. [Phase 08 - Legacy Fragmentation Cleanup](phases/08-legacy-fragmentation-cleanup.md)
9. [Phase 09a - Job State Contract And Guardrails](phases/09a-job-state-contract-and-guardrails.md)
10. [Phase 09b - Canonical Job Read Model](phases/09b-canonical-job-read-model.md)
11. [Phase 09c - Chat Presentation Split](phases/09c-chat-presentation-split.md)
12. [Phase 09d - Stop Dual Writes And Prune](phases/09d-stop-dual-writes-and-prune.md)
13. [Phase 09 - Push Notification Boundary](phases/09-push-notification-boundary.md)
14. [Phase 10 - Browser And Runtime Proof](phases/10-browser-and-runtime-proof.md)
15. [Phase 11 - Release Evidence](phases/11-release-evidence.md)
16. [Phase 12 - Closeout And Handoff](phases/12-closeout-and-handoff.md)

## Phase 0: Baseline Evidence And Current-State Map

Goal: lock the current behavior before changing it.

Tasks:

- Reproduce the Keith web-search transcript shape from local DB or a fixture.
- Record job rows, job events, message parts, and visible presentation behavior.
- Map current flows through `admin_web_search`, `get_deferred_job_status`,
  `/api/chat/events`, `useChatJobEvents`, `useJobStateStore`, and
  `ChatPresenter`.
- Identify which duplicate cards are explicit `job_status` parts versus nested
  status-tool snapshots.

Exit criteria:

- A failing test or fixture demonstrates repeated unchanged status snapshots.
- The test proves the Jobs rail already sees one durable job.

## Phase 1: SSE Cursor And Reconciliation Hardening

Goal: make the in-chat event stream the reliable primary delivery path.

Tasks:

- Ensure `useChatJobEvents` passes and advances a conversation-scoped
  `afterSequence` cursor.
- Use `useJobsEventStream` as the existing reference pattern for `lastSequenceRef`
  tracking, duplicate-event suppression, and reconnect reconciliation.
- Ensure reconnect and error paths reconcile before continuing.
- Confirm duplicate or older events do not regress job state.
- Document the difference between conversation sequence and user sequence if it
  remains intentional.

Exit criteria:

- Route tests prove `/api/chat/events?afterSequence=N` emits only newer events.
- Hook tests prove reconnect and focus reconciliation update the same job entry
  in place.

## Phase 2: Chat Presentation Dedupe

Goal: suppress duplicate visible job cards for repeated status snapshots.

Tasks:

- Extend presentation reconciliation to account for nested job snapshots inside
  `get_deferred_job_status` and `list_deferred_jobs` results.
- Select the freshest nested snapshot per `jobId` before creating render entries;
  do not accept the first repeated snapshot just because `renderedJobIds` is
  empty.
- Reuse or promote `JobRenderCandidateMerger.ts` freshness helpers before adding
  another presentation-level latest-by-job comparator.
- Prefer explicit latest `job_status` parts and `jobStateEntries` over nested
  stale snapshots.
- Preserve raw transcript parts for export/diagnostics.
- Keep custom cards working for terminal result payloads.

Exit criteria:

- Keith-style transcript fixture renders one visible `admin_web_search` card.
- Final `succeeded` result replaces repeated `running` cards.
- Tests cover equal sequence duplicate suppression and terminal replacement.

## Phase 3: Assistant Polling Guardrails

Goal: prevent the assistant from using status tools as a wait loop.

Tasks:

- Update job capability prompt hints to say that live job updates arrive through
  the app event stream.
- Add a runtime guard for repeated unchanged `get_deferred_job_status` results
  within one assistant turn if feasible.
- Ensure explicit user status requests still work.
- Ensure admin diagnostics can still inspect job history.
- Update deterministic and live eval expectations that currently require status
  tools for missed-SSE recovery. The new proof should validate event-stream
  delivery and reconciliation unless the user explicitly asks for status.

Exit criteria:

- Tests show repeated unchanged status reads do not produce repeated visible
  render entries.
- Prompt directive tests include the no-wait-loop guidance.

## Phase 3.5: Legacy Fragmentation Cleanup

Goal: remove obsolete polling-noise assumptions after the behavior is proven.

Tasks:

- Delete or rewrite stale tests that expect repeated visible status cards.
- Remove duplicate freshness helpers if implementation introduced more than one.
- Remove duplicate presenter media-truth helper logic if
  `JobRenderCandidateMerger.ts` becomes the canonical home.
- Rewrite eval runner fixtures that synthesize repeated status reads as the
  default recovery proof.
- Replace prompt hints that encourage repeated status reads as a wait strategy.
- Keep explicit status tools and diagnostics intact.
- Record any retained compatibility fallback with a reason and owner surface.
- Cross-check compose-media synthetic browser job behavior against
  `docs/_refactor/compose-media-execution-ownership/contract-spec.md` without
  merging that separate refactor into this package.

Exit criteria:

- No production path creates duplicate visible cards to compensate for assistant
  polling.
- Raw transcript/export behavior is still available for diagnostics.
- The package README and QA review list what was removed and what was retained.
- The systemic audit lists what was removed, rewritten, or intentionally handed
  off to another refactor package.

## Phase 4: Optional Browser Push Terminal Notifications

Goal: use browser push for away-from-chat completion/failure notices only.

Note: this phase is deferred until Phase 09a-09d remove the dual-write
message/job architecture. Push must not mask product correctness issues in the
active chat surface.

Tasks:

- Confirm subscription lifecycle and VAPID configuration are documented.
- Emit push notifications only for terminal or attention-worthy job states.
- Tag notifications by `jobId` so updates replace prior notification for the
  same job.
- Route notification clicks to `/jobs?jobId=...` or the conversation workspace.

Exit criteria:

- Push can be enabled without affecting active chat correctness.
- Push is not required for SSE or reconciliation tests to pass.

## Phase 5: Browser Proof And Release Evidence

Goal: prove the refactor as a product behavior, not just a unit contract.

Tasks:

- Browser-test one deferred job from queued/running to completed.
- Verify chat shows one job card and Jobs rail shows one item/count.
- Verify reload restores one completed card.
- Verify EventSource interruption falls back to reconciliation.
- Record release evidence with command outputs and scenario notes.

Exit criteria:

- Focused unit and route suites pass.
- Browser scenario passes against a dev server.
- Release evidence records before/after behavior and residual risks.

## Sequencing Notes

- Do Phase 2 before Phase 3 if the immediate product pain is transcript spam.
- Do Phase 1 before Phase 4 because browser push should not mask weak in-chat
  event delivery.
- Do Phase 3.5 before release evidence so the final proof validates the cleaned
  architecture, not a compatibility pile-up.
- Do not implement WebSockets unless SSE plus reconciliation cannot satisfy the
  reliability contract.
