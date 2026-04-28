# Phase 10 — Deferred Job Completion Reliability And Observability

> Status: In Progress
> Loop State: The audit is complete and two implementation cuts have landed: terminal transcript projection now updates in place on terminal events, progress reports now renew worker leases, chat rehydrate now pulls a broader deferred-job snapshot set, and the jobs workspace reducer now preserves fresher state during reconcile. Remaining work is still substantive: opaque long-running handlers can outlast a lease if they do not report progress, cancellation is still advisory rather than abortive, journal publish-readiness can still mix unrelated active jobs into one post check, and deferred-job forensics still require log hunting.
> Goal: Make deferred blog and journal workflows complete truthfully, avoid duplicate execution during long editorial runs, and leave behind one canonical operator-facing audit surface for completion, retry, and recovery incidents.
> Prerequisites: Phase 5 job-event separation must remain stable, Phase 7 execution-target routing must remain unchanged unless a real runtime defect forces it, and the Phase 8 plus Phase 9 deferred-job ownership cuts should stay intact.

## Phase Intent

Phase 10 exists because the deferred editorial pipeline is now good enough to reveal a more dangerous class of failures: the worker can finish a real `produce_blog_article` run, persist the draft, and still leave the operator with a transcript that looks incomplete or a queue record that can be reclaimed while the original work is still executing. That is worse than a simple hard failure because it creates ambiguity about whether the system is broken, duplicated work, or only misreported state. This phase should tighten the completion contract for deferred blog and journal work around three truths: terminal job state must replace live-progress state in the conversation surface, long-running editorial handlers must not drift outside their lease window, and completion forensics must be readable from one canonical audit surface without requiring operators to guess which log directory or snapshot channel contains the real answer.

## Source Anchors To Refresh

- [./phase-5-chat-and-job-event-separation.md](./phase-5-chat-and-job-event-separation.md#L1)
- [./phase-7-execution-target-abstraction-and-mcp-sidecars.md](./phase-7-execution-target-abstraction-and-mcp-sidecars.md#L1)
- [./phase-8-core-pack-separation-and-heavy-runtime-externalization.md](./phase-8-core-pack-separation-and-heavy-runtime-externalization.md#L1)
- [./phase-9-canonicalization-closeout-and-runtime-promotion.md](./phase-9-canonicalization-closeout-and-runtime-promotion.md#L1)
- [./phase-10-invariants-and-active-defects.md](./phase-10-invariants-and-active-defects.md#L1)
- [./status-board.md](./status-board.md#L1)
- [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L1)
- [../../../../src/lib/jobs/deferred-job-conversation-projector.ts](../../../../src/lib/jobs/deferred-job-conversation-projector.ts#L1)
- [../../../../src/lib/jobs/job-publication.ts](../../../../src/lib/jobs/job-publication.ts#L1)
- [../../../../src/lib/jobs/job-status.ts](../../../../src/lib/jobs/job-status.ts#L1)
- [../../../../src/lib/jobs/job-status-query.ts](../../../../src/lib/jobs/job-status-query.ts#L1)
- [../../../../src/lib/jobs/job-read-model.ts](../../../../src/lib/jobs/job-read-model.ts#L1)
- [../../../../src/adapters/JobQueueDataMapper.ts](../../../../src/adapters/JobQueueDataMapper.ts#L1)
- [../../../../src/lib/blog/blog-article-production-service.ts](../../../../src/lib/blog/blog-article-production-service.ts#L1)
- [../../../../src/core/use-cases/tools/journal-write.tool.ts](../../../../src/core/use-cases/tools/journal-write.tool.ts#L1)
- [../../../../src/core/capability-catalog/families/blog-capabilities.ts](../../../../src/core/capability-catalog/families/blog-capabilities.ts#L1)
- [../../../../src/lib/observability/runtime-audit-log.ts](../../../../src/lib/observability/runtime-audit-log.ts#L1)
- [../../../../src/lib/jobs/manual-replay.ts](../../../../src/lib/jobs/manual-replay.ts#L1)
- [../../../../src/hooks/chat/useChatJobEvents.ts](../../../../src/hooks/chat/useChatJobEvents.ts#L1)
- [../../../../src/components/jobs/useJobsEventStream.ts](../../../../src/components/jobs/useJobsEventStream.ts#L1)
- [../../../../src/components/jobs/job-snapshot-reducer.ts](../../../../src/components/jobs/job-snapshot-reducer.ts#L1)
- [../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts#L1)
- [../../../../src/components/NotificationFeed.tsx](../../../../src/components/NotificationFeed.tsx#L1)
- [../../../../scripts/start-server.mjs](../../../../scripts/start-server.mjs#L1)
- [../../../../scripts/process-deferred-jobs.ts](../../../../scripts/process-deferred-jobs.ts#L1)
- [../../../../scripts/run-live-blog-pipeline.ts](../../../../scripts/run-live-blog-pipeline.ts#L1)
- [../../../../src/components/jobs/JobsWorkspace.test.tsx](../../../../src/components/jobs/JobsWorkspace.test.tsx#L1)
- [../../../../src/components/jobs/useJobsEventStream.test.tsx](../../../../src/components/jobs/useJobsEventStream.test.tsx#L1)
- [../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.test.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.test.ts#L1)
- [../../../../src/hooks/useGlobalChat.test.tsx](../../../../src/hooks/useGlobalChat.test.tsx#L1)
- [../../../../tests/browser-ui/deferred-blog-jobs.spec.ts](../../../../tests/browser-ui/deferred-blog-jobs.spec.ts#L1)
- [../../../../tests/browser-ui/jobs-page.spec.ts](../../../../tests/browser-ui/jobs-page.spec.ts#L1)
- [../../../../src/app/api/auth/auth-routes.test.ts](../../../../src/app/api/auth/auth-routes.test.ts#L1)
- [../../../../src/app/api/jobs/[jobId]/route.test.ts](../../../../src/app/api/jobs/[jobId]/route.test.ts#L1)
- [../../../../tests/deferred-blog-job-flow.test.ts](../../../../tests/deferred-blog-job-flow.test.ts#L1)
- [../../../../tests/deferred-blog-publish-flow.test.ts](../../../../tests/deferred-blog-publish-flow.test.ts#L1)
- [../../../../tests/chat/chat-stream-route.test.ts](../../../../tests/chat/chat-stream-route.test.ts#L1)
- [../../../../.runtime-logs/live-seams/deferred_job.jsonl](../../../../.runtime-logs/live-seams/deferred_job.jsonl#L1)
- [../../../_archive/_qa/FEATURE_AUDIT.md](../../../_archive/_qa/FEATURE_AUDIT.md#L1)

## Current-State Questions

- Why can `get_deferred_job_status` and `list_deferred_jobs` report a terminal state while the persisted chat message still shows the same job as `running`?
- What exact lease or heartbeat rule should protect a three-minute `produce_blog_article` run from `lease_recovered` requeue during normal execution?
- Do we want cancellation to abort the underlying editorial and image-generation work, or only prevent later projection and notifications from surfacing it as successful?
- Should `prepare_journal_post_for_publish` report all active jobs for the user, or only active jobs that actually block the named post?
- Which editorial capabilities should keep manual-only retry, and which ones now have enough transient remote-service exposure that automatic retry is the truthful default?
- What single log or read-model surface should operators consult first when a deferred editorial job appears incomplete?
- Which current tests are protecting stale behavior instead of the intended completion contract?
- Should the chat rehydrate path keep a hard `limit=12`, or do we need a different fetch rule for busy conversations with more than twelve deferred jobs?
- Should the progress strip intentionally hide `succeeded` jobs, or do we need a short-lived completion affordance so a finished deferred job does not disappear before the operator can notice it?
- Which job surfaces are allowed to reconcile from independent fetches, and what sequence rule keeps the jobs workspace from overwriting newer state with older selected-job payloads?
- Which browser tests need the real worker enabled so we cover queue claim, lease renewal, cancellation, and terminal projection instead of only seeded rows and mocked SSE payloads?
- Which operator-facing copy, notification text, and archived audit notes still describe the obsolete "terminal updates stay out of chat" contract and need to change when Phase 10 lands?
- Which deferred-job lifecycle guarantees are already healthy enough to preserve as invariants, especially replay lineage and anonymous-to-signed-in ownership transfer?

## Drift Traps

- Treating this as only a UI bug when the real failure surface also includes lease expiry, duplicate execution risk, and cancellation semantics.
- Fixing the transcript card without fixing the status query, read-model, and notification assumptions that currently tolerate stale terminal projection.
- Extending the lease duration blindly instead of adding a measured renewal or checkpoint rule tied to real progress updates.
- Solving journal publish-readiness as a purely textual summary problem while still mixing unrelated active jobs into the same readiness result.
- Adding more ad hoc log files or debug prints instead of choosing one canonical deferred-job forensic path.
- Reopening execution-target planning or bundle composition even though the current audit points to worker lifecycle, read-model, and observability seams.
- Leaving tests that explicitly expect stale `running` projection in place after landing a terminal-state fix.
- Treating the signed-in jobs workspace as safe because the SSE hook filters stale events, while the reducer and reconcile path can still overwrite newer snapshots with older fetched state.
- Leaving the chat-side `limit=12` rehydrate rule untouched even if it means active or failed jobs fall off the conversation surface in long-running editorial threads.
- Assuming the progress strip is a completion surface when it currently drops `succeeded` jobs entirely and only retains queued, running, failed, and canceled work.
- Relying on browser coverage that disables the worker and injects idealized SSE payloads when the real incidents involve worker lifecycle and partially ordered events.
- Fixing terminal truth while leaving notification copy, admin guidance, or archived audits to keep telling operators that terminal updates intentionally stay out of chat.
- Regressing manual replay lineage or anonymous ownership-transfer behavior while changing projection, cancellation, or job-snapshot semantics.

## Pre-Implementation QA Gate

- [ ] Refresh current diagnostics for the deferred-job, editorial, and observability files touched by this phase.
- [ ] Refresh targeted deferred blog and journal tests plus the current baseline failures in the chat-stream route suite.
- [ ] Confirm the live-seam deferred-job audit log still reproduces a long-running `produce_blog_article` run with a lease window shorter than total runtime.
- [ ] Record exact verification commands for transcript projection, lease recovery, cancellation behavior, journal readiness, and log-path expectations before changing code.
- [ ] Update this packet's verified-state notes and expected evidence list before implementation starts.
- [ ] Capture the current chat rehydrate and jobs workspace reconcile limits, then decide whether the Phase 10 fix needs broader fetch coverage or stronger sequence guards.
- [ ] Record which browser and integration tests currently run with `DISABLE_DEFERRED_JOB_WORKER=1`, so the implementation loop can add at least one real worker-backed proof instead of only mocked streams.

## Verified Current State

This section is pre-populated from the 2026-04-14 deferred editorial audit and should be updated when Phase 10 implementation starts.

### Current Code Notes

- The first terminal-projection cut is now live in the conversation layer: [../../../../src/lib/jobs/deferred-job-conversation-projector.ts](../../../../src/lib/jobs/deferred-job-conversation-projector.ts#L28) still treats `result`, `failed`, and `canceled` events as terminal, but existing messages are now updated in place instead of being returned unchanged.
- Non-terminal progress updates and terminal updates now converge on the same replacement path through [../../../../src/lib/jobs/deferred-job-conversation-projector.ts](../../../../src/lib/jobs/deferred-job-conversation-projector.ts#L31) and [../../../../src/lib/jobs/deferred-job-conversation-projector.ts](../../../../src/lib/jobs/deferred-job-conversation-projector.ts#L51), which removes the known stale-`running` transcript defect for this surface.
- The shared read path is stricter than the conversation projector: [../../../../src/lib/jobs/job-status-query.ts](../../../../src/lib/jobs/job-status-query.ts#L17), [../../../../src/lib/jobs/job-status-query.ts](../../../../src/lib/jobs/job-status-query.ts#L26), [../../../../src/lib/jobs/job-status-query.ts](../../../../src/lib/jobs/job-status-query.ts#L50), and [../../../../src/lib/jobs/job-status-query.ts](../../../../src/lib/jobs/job-status-query.ts#L58) always rebuild snapshots from the latest renderable event.
- Synthetic fallback also preserves terminal truth in the snapshot layer through [../../../../src/lib/jobs/job-read-model.ts](../../../../src/lib/jobs/job-read-model.ts#L33) and [../../../../src/lib/jobs/job-read-model.ts](../../../../src/lib/jobs/job-read-model.ts#L54).
- The worker still claims jobs with a fixed initial lease window at [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L319), but healthy progress reports now renew that lease in place at [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L402). That closes the known "progress is being reported but the lease still expires" defect.
- Lease recovery remains live through [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L321) and [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L332). The remaining lease risk is narrower now: long opaque handler spans that do not emit progress can still outlast their original lease.
- Cancellation is advisory rather than abortive today. The worker re-checks cancellation at [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L342), [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L447), [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L482), and [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L534), but the editorial handlers do not receive an abort signal.
- The full editorial workflow still runs in one long handler call through [../../../../src/lib/blog/blog-article-production-service.ts](../../../../src/lib/blog/blog-article-production-service.ts#L127), traversing composition, QA, QA resolution, hero-image prompt design, image generation, and draft persistence before returning.
- `produce_blog_article` is still manual-retry only in [../../../../src/core/capability-catalog/families/blog-capabilities.ts](../../../../src/core/capability-catalog/families/blog-capabilities.ts#L860), while `prepare_journal_post_for_publish` still uses automatic editorial retry in [../../../../src/core/capability-catalog/families/blog-capabilities.ts](../../../../src/core/capability-catalog/families/blog-capabilities.ts#L915).
- `prepare_journal_post_for_publish` currently lists active jobs by user in [../../../../src/core/use-cases/tools/journal-write.tool.ts](../../../../src/core/use-cases/tools/journal-write.tool.ts#L450) and returns them in [../../../../src/core/use-cases/tools/journal-write.tool.ts](../../../../src/core/use-cases/tools/journal-write.tool.ts#L483), but that read is not scoped to the post being checked.
- The same readiness tool can also trigger fresh QA via [../../../../src/core/use-cases/tools/journal-write.tool.ts](../../../../src/core/use-cases/tools/journal-write.tool.ts#L455), which means a publish-readiness check is partly a new editorial analysis run rather than only a read-model summary.
- Deferred-job audit logs are best-effort and path-relative: [../../../../src/lib/observability/runtime-audit-log.ts](../../../../src/lib/observability/runtime-audit-log.ts#L17) writes under `process.cwd()` unless `ORDO_RUNTIME_AUDIT_LOG_DIR` is set, which makes log location sensitive to how the runtime was launched.
- Worker lifecycle is supervised in [../../../../scripts/start-server.mjs](../../../../scripts/start-server.mjs#L107) and [../../../../scripts/start-server.mjs](../../../../scripts/start-server.mjs#L115), but the restart logic does not itself solve in-flight lease continuity or log-path consistency.
- Manual replay and dedupe lineage are structurally in better shape than the terminal-projection path. [../../../../src/lib/jobs/manual-replay.ts](../../../../src/lib/jobs/manual-replay.ts#L52), [../../../../src/lib/jobs/manual-replay.ts](../../../../src/lib/jobs/manual-replay.ts#L69), and [../../../../src/lib/jobs/manual-replay.ts](../../../../src/lib/jobs/manual-replay.ts#L95) preserve `replayedFromJobId` and `supersededByJobId` metadata for replayed and deduped jobs. Phase 10 should preserve that lineage rather than re-open it casually.
- Anonymous-to-signed-in ownership transfer also looks like a healthy baseline rather than an active defect. [../../../../src/app/api/auth/auth-routes.test.ts](../../../../src/app/api/auth/auth-routes.test.ts#L439) proves migrated anonymous jobs move to the registered owner and emit an `ownership_transferred` audit event.
- Chat-side deferred-job rehydrate now pulls a broader snapshot set through [../../../../src/hooks/chat/useChatJobEvents.ts](../../../../src/hooks/chat/useChatJobEvents.ts#L16) and [../../../../src/hooks/chat/useChatJobEvents.ts](../../../../src/hooks/chat/useChatJobEvents.ts#L37). The remaining question is whether a wider fixed limit is sufficient long term, or whether active and failed jobs need an explicit prioritization rule.
- The signed-in jobs workspace reducer now applies freshness checks during reconcile and selected-job refresh. [../../../../src/components/jobs/job-snapshot-reducer.ts](../../../../src/components/jobs/job-snapshot-reducer.ts#L15), [../../../../src/components/jobs/job-snapshot-reducer.ts](../../../../src/components/jobs/job-snapshot-reducer.ts#L58), and [../../../../src/components/jobs/job-snapshot-reducer.ts](../../../../src/components/jobs/job-snapshot-reducer.ts#L109) now preserve the fresher snapshot instead of blindly replacing state.
- The jobs workspace still reconciles selected job detail and history through independent fetches at [../../../../src/components/jobs/useJobsEventStream.ts](../../../../src/components/jobs/useJobsEventStream.ts#L78), [../../../../src/components/jobs/useJobsEventStream.ts](../../../../src/components/jobs/useJobsEventStream.ts#L87), and [../../../../src/components/jobs/useJobsEventStream.ts](../../../../src/components/jobs/useJobsEventStream.ts#L98), but the reducer is now the freshness boundary rather than the EventSource hook alone.
- The chat progress strip is intentionally not a completion surface: [../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts#L141) only keeps queued, running, failed, and canceled jobs, while [../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts#L198) also drops superseded jobs. That is defensible as a design choice, but it means successful deferred completion currently depends on the transcript card or jobs page remaining truthful and noticeable.
- Operator-facing copy has started to move with the new contract. [../../../../src/components/NotificationFeed.tsx](../../../../src/components/NotificationFeed.tsx#L34) now describes terminal deferred updates as staying consistent across chat, jobs, and notifications, and [../../../_archive/_qa/FEATURE_AUDIT.md](../../../_archive/_qa/FEATURE_AUDIT.md#L51) now marks the old notification-only description as historical.

### Current QA Notes

- A real editorial run was captured on 2026-04-14 in [../../../../.runtime-logs/live-seams/deferred_job.jsonl](../../../../.runtime-logs/live-seams/deferred_job.jsonl#L1). That log proves `produce_blog_article` can start, report phased progress, and succeed end to end.
- The same live log also proves lease drift today: the initial `leaseExpiresAt` is visible at [../../../../.runtime-logs/live-seams/deferred_job.jsonl](../../../../.runtime-logs/live-seams/deferred_job.jsonl#L1), while later progress and terminal success occur well after that lease window at [../../../../.runtime-logs/live-seams/deferred_job.jsonl](../../../../.runtime-logs/live-seams/deferred_job.jsonl#L3), [../../../../.runtime-logs/live-seams/deferred_job.jsonl](../../../../.runtime-logs/live-seams/deferred_job.jsonl#L5), [../../../../.runtime-logs/live-seams/deferred_job.jsonl](../../../../.runtime-logs/live-seams/deferred_job.jsonl#L7), and [../../../../.runtime-logs/live-seams/deferred_job.jsonl](../../../../.runtime-logs/live-seams/deferred_job.jsonl#L8).
- The first projector regression now asserts terminal truth instead of stale `running`: [../../../../tests/deferred-blog-publish-flow.test.ts](../../../../tests/deferred-blog-publish-flow.test.ts#L109) verifies that publish completion updates the existing chat job card to `succeeded`.
- Browser end-to-end coverage does not currently exercise real deferred completion because the worker is disabled in [../../../../playwright.config.ts](../../../../playwright.config.ts#L15).
- Current chat and jobs UI coverage is mostly happy-path only: [../../../../src/hooks/useGlobalChat.test.tsx](../../../../src/hooks/useGlobalChat.test.tsx#L322), [../../../../src/components/jobs/JobsWorkspace.test.tsx](../../../../src/components/jobs/JobsWorkspace.test.tsx#L246), and [../../../../src/components/jobs/useJobsEventStream.test.tsx](../../../../src/components/jobs/useJobsEventStream.test.tsx#L80) verify successful rehydrate, forward-moving progress, and fallback sync, but they do not yet cover duplicate events, stale reconcile payloads, out-of-order selected-job fetches, or high-volume conversation rehydrate.
- The progress-strip tests explicitly encode completion invisibility as current behavior: [../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.test.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.test.ts#L195) proves `succeeded` jobs are intentionally ignored.
- Browser specs validate idealized states rather than the live worker lifecycle. [../../../../tests/browser-ui/deferred-blog-jobs.spec.ts](../../../../tests/browser-ui/deferred-blog-jobs.spec.ts#L153) injects mocked chat SSE payloads, and [../../../../tests/browser-ui/jobs-page.spec.ts](../../../../tests/browser-ui/jobs-page.spec.ts#L223) renders seeded queue rows while the worker remains disabled. That leaves queue claim, lease renewal, cancellation during active execution, and terminal projection under real worker control outside current browser coverage.
- Replay and ownership-transfer baselines are already protected by focused tests: [../../../../src/app/api/jobs/[jobId]/route.test.ts](../../../../src/app/api/jobs/[jobId]/route.test.ts#L133) and [../../../../src/app/api/jobs/[jobId]/route.test.ts](../../../../src/app/api/jobs/[jobId]/route.test.ts#L189) cover replay lineage and deduped outcomes, while [../../../../src/app/api/auth/auth-routes.test.ts](../../../../src/app/api/auth/auth-routes.test.ts#L439) covers anonymous job migration with ownership-transfer audit events. Those protections should remain green through Phase 10 instead of being implicitly reworked.
- The first implementation cut is verified by targeted regression: `npx vitest run tests/deferred-blog-publish-flow.test.ts` passed on 2026-04-14 after the projector change.
- The second implementation cut is verified by a focused 5-file bundle: `npx vitest run tests/deferred-job-worker.test.ts tests/deferred-blog-job-flow.test.ts tests/deferred-blog-publish-flow.test.ts src/hooks/chat/useChatJobEvents.test.tsx src/components/jobs/job-snapshot-reducer.test.ts` passed on 2026-04-14 with 22 tests green.
- The current test-failure snapshot still contains chat-stream route failures around deferred job event promotion and editorial deferred-tool flows, including `publish_content` and explicit status-tool promotion evidence.

## Suggested Verification Commands

```bash
npx vitest run \
  src/lib/jobs/deferred-job-worker.test.ts \
  src/lib/jobs/deferred-job-runtime.test.ts \
  src/lib/jobs/job-status.test.ts \
  src/lib/jobs/job-publication.test.ts \
  src/core/use-cases/tools/journal-write.tool.test.ts \
  tests/deferred-blog-job-flow.test.ts \
  tests/deferred-blog-publish-flow.test.ts \
  tests/chat/chat-stream-route.test.ts

npm run build

# Optional live verification when editorial provider credentials are configured.
npx tsx scripts/run-live-blog-pipeline.ts --brief "Write a practical editorial article about turning chaotic support requests into a repeatable triage workflow."
```

## Expected Evidence Artifacts

- A canonical terminal-projection fix so an existing `job_status` message transitions from `running` to `succeeded`, `failed`, or `canceled` instead of staying stale.
- A lease-renewal, heartbeat, or equivalent continuity mechanism that prevents long-running editorial jobs from being requeued during healthy execution.
- A clear cancellation contract for deferred editorial work, including either true abort support or an explicit non-abortive decision documented in code and tests.
- A post-scoped publish-readiness result that does not imply unrelated active jobs block a specific journal post.
- A single canonical deferred-job forensic path, including log-location rules and operator guidance for where to look first during incidents.
- Sequence-safe jobs workspace reconciliation so stale fetches or duplicate snapshots cannot overwrite newer live or optimistic job state.
- A deliberate conversation rehydrate rule for deferred jobs in busy threads, with tests proving whether active and failed jobs remain visible past the first twelve snapshots.
- An explicit operator-facing decision on whether successful deferred jobs should remain briefly visible outside the transcript card, or whether Phase 10 relies solely on transcript and jobs-page truth.
- Updated operator-facing copy and audit notes so notification surfaces, archived guidance, and admin-facing language no longer describe the pre-Phase-10 terminal-state contract.
- Updated tests removing the current stale-running expectation and replacing it with terminal-state assertions.
- A rerun of the targeted deferred-job bundle, a green production build, and at least one live or simulated long-running editorial proof after the lease fix lands.

## Detailed Implementation Plan

1. Make terminal state replace live-progress state everywhere the operator can see it.
   - Update the conversation projector so terminal events replace the existing `job_status` part instead of preserving stale `running` state.
   - Re-check the publication chain so transcript projection, snapshot routes, and promoted in-stream job events all agree on the same terminal part.

2. Add real lease continuity for long-running editorial jobs.
   - Extend or renew the lease during progress reports, or add an explicit heartbeat API from the worker to the repository.
   - Keep the recovery semantics for crashed workers, but make healthy long-running `produce_blog_article` execution invisible to `lease_recovered` requeue.

3. Decide and codify cancellation semantics for editorial work.
   - Either thread an abort signal through model and image-generation calls or explicitly declare that cancellation only suppresses terminal projection while work may still finish in the background.
   - Align status projection, notifications, and operator wording with that choice.

4. Narrow journal publish-readiness to the actual post-level blocking contract.
   - Separate post-specific blockers from global user job activity.
   - Keep optional QA explicit as a fresh analysis step rather than silently blending it into a read-only readiness check.

5. Make deferred-job forensics canonical.
   - Choose one canonical log root and document it.
   - Ensure worker startup, live pipeline scripts, and standalone builds do not scatter equivalent deferred-job evidence across multiple directories without explanation.

6. Make the UI reconciliation contract explicit.
   - Add sequence-aware merging in the jobs workspace state layer so reconcile and selected-job fetches cannot regress newer state.
   - Decide whether chat rehydrate should page, widen its limit, or prioritize active and failed jobs over older succeeded jobs in long-running conversations.
   - Confirm whether the progress strip should stay non-terminal-only or gain a short-lived completion affordance, but do not leave the answer implicit.

7. Realign tests and docs with the fixed completion contract.
   - Replace stale-running assertions.
   - Add coverage for stale and duplicate workspace events, high-volume conversation rehydrate, and at least one worker-enabled browser or integration proof.
   - Update operator-facing copy that still claims terminal deferred updates stay out of chat, and keep replay-lineage plus ownership-transfer regressions explicitly covered.
   - Update this phase packet, the status board, and any Phase 5 or Phase 7 notes that still describe notification or projection behavior too loosely.

## Code-Level Implementation Notes

### Terminal Projection Contract

1. Fix the existing conversation projector instead of adding a parallel reconciliation path.
   - [../../../../src/lib/jobs/deferred-job-conversation-projector.ts](../../../../src/lib/jobs/deferred-job-conversation-projector.ts#L1) should stay the single write path for job-status message mutation.
   - Terminal events should update an existing message in the same way progress events already do, rather than creating a special post-hoc repair path elsewhere.

2. Keep the publication contract authoritative.
   - [../../../../src/lib/jobs/job-publication.ts](../../../../src/lib/jobs/job-publication.ts#L1) and [../../../../src/lib/jobs/job-status.ts](../../../../src/lib/jobs/job-status.ts#L1) already define how a renderable event becomes a `job_status` part.
   - Phase 10 should not fork terminal rendering logic between transcript projection and status-query snapshots.

### UI Reconcile And Rehydrate Contract

1. Put freshness checks in the state layer, not only at the SSE boundary.
   - [../../../../src/components/jobs/useJobsEventStream.ts](../../../../src/components/jobs/useJobsEventStream.ts#L203) already ignores stale live events.
   - [../../../../src/components/jobs/job-snapshot-reducer.ts](../../../../src/components/jobs/job-snapshot-reducer.ts#L1) should enforce the same sequence truth for reconcile payloads, selected-job fetches, and optimistic transitions so all workspace paths share one freshness rule.

2. Make chat rehydrate intentional for busy conversations.
   - [../../../../src/hooks/chat/useChatJobEvents.ts](../../../../src/hooks/chat/useChatJobEvents.ts#L1) currently asks for only twelve snapshots.
   - Phase 10 should decide whether that surface is meant to show all relevant deferred jobs, only recent jobs, or recent jobs biased toward active and failed state, then encode that rule in the route and tests.

3. Treat the progress strip as a policy surface, not an accident.
   - [../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts#L1) intentionally filters out `succeeded` jobs today.
   - If that policy stays, the transcript and jobs page must become trustworthy enough that completion does not disappear from the operator’s view during normal use.

4. Keep healthy lifecycle metadata stable while fixing the broken truth surfaces.
   - Replay lineage and supersession are already represented in the deferred-job model.
   - Phase 10 should preserve `replayedFromJobId`, `supersededByJobId`, and `ownership_transferred` semantics while fixing projection, lease, and UI freshness issues.

### Lease And Heartbeat Continuity

1. Prefer explicit renewal over larger static lease windows.
   - [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L1) already updates progress frequently during editorial work, so the natural place to renew the lease is beside those progress writes.
   - Avoid solving this by only increasing the default 30-second lease, because remote editorial calls can still exceed a longer fixed window.

2. Keep repository behavior small and explicit.
   - [../../../../src/adapters/JobQueueDataMapper.ts](../../../../src/adapters/JobQueueDataMapper.ts#L1) already owns claim, update, and recovery behavior.
   - If a renewal method is needed, add the smallest repository surface that preserves the current single-claim semantics.

### Cancellation And Editorial Runtime Semantics

1. Thread cancellation through the real long-running steps if feasible.
   - [../../../../src/lib/blog/blog-article-production-service.ts](../../../../src/lib/blog/blog-article-production-service.ts#L127) is the central orchestration path for `produce_blog_article`.
   - If full abort support is not practical for the current model or image providers, document the exact partial-cancel semantics and expose them honestly in operator status copy.

2. Keep retry policy decisions per workflow, not per phase label.
   - `produce_blog_article` currently spans multiple remote failure points but remains manual-only retry.
   - `prepare_journal_post_for_publish` already auto-retries even though it can invoke fresh QA.
   - Phase 10 should revisit those choices using the actual failure surface, not their historical names.

### Journal Readiness Scoping

1. Distinguish post-level blockers from ambient operator workload.
   - [../../../../src/core/use-cases/tools/journal-write.tool.ts](../../../../src/core/use-cases/tools/journal-write.tool.ts#L434) should produce a readiness summary that is truthful for the named post.
   - If broader operator load still matters, surface it as advisory context rather than as implicit post blockers.

2. Preserve the tool's operator value without hiding side effects.
   - If `run_qa` remains supported, the response should make it explicit that fresh QA was executed.
   - Avoid letting a readiness check silently mutate artifacts or editorial records without an explicit action boundary.

## Candidate File Changes

1. Existing files expected to change.
   - [../../../../src/lib/jobs/deferred-job-conversation-projector.ts](../../../../src/lib/jobs/deferred-job-conversation-projector.ts#L1)
   - [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L1)
   - [../../../../src/adapters/JobQueueDataMapper.ts](../../../../src/adapters/JobQueueDataMapper.ts#L1)
   - [../../../../src/lib/jobs/job-status.ts](../../../../src/lib/jobs/job-status.ts#L1)
   - [../../../../src/hooks/chat/useChatJobEvents.ts](../../../../src/hooks/chat/useChatJobEvents.ts#L1)
   - [../../../../src/components/jobs/useJobsEventStream.ts](../../../../src/components/jobs/useJobsEventStream.ts#L1)
   - [../../../../src/components/jobs/job-snapshot-reducer.ts](../../../../src/components/jobs/job-snapshot-reducer.ts#L1)
   - [../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts#L1)
   - [../../../../src/components/NotificationFeed.tsx](../../../../src/components/NotificationFeed.tsx#L1)
   - [../../../../src/core/use-cases/tools/journal-write.tool.ts](../../../../src/core/use-cases/tools/journal-write.tool.ts#L1)
   - [../../../../src/core/capability-catalog/families/blog-capabilities.ts](../../../../src/core/capability-catalog/families/blog-capabilities.ts#L1)
   - [../../../../src/lib/observability/runtime-audit-log.ts](../../../../src/lib/observability/runtime-audit-log.ts#L1)
   - [../../../../scripts/start-server.mjs](../../../../scripts/start-server.mjs#L1)
   - [../../../../scripts/process-deferred-jobs.ts](../../../../scripts/process-deferred-jobs.ts#L1)

2. Tests expected to change.
   - [../../../../tests/deferred-blog-job-flow.test.ts](../../../../tests/deferred-blog-job-flow.test.ts#L1)
   - [../../../../tests/deferred-blog-publish-flow.test.ts](../../../../tests/deferred-blog-publish-flow.test.ts#L1)
   - [../../../../src/components/jobs/JobsWorkspace.test.tsx](../../../../src/components/jobs/JobsWorkspace.test.tsx#L1)
   - [../../../../src/components/jobs/useJobsEventStream.test.tsx](../../../../src/components/jobs/useJobsEventStream.test.tsx#L1)
   - [../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.test.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.test.ts#L1)
   - [../../../../src/hooks/useGlobalChat.test.tsx](../../../../src/hooks/useGlobalChat.test.tsx#L1)
   - [../../../../src/components/NotificationFeed.test.tsx](../../../../src/components/NotificationFeed.test.tsx#L1)
   - [../../../../src/core/use-cases/tools/journal-write.tool.test.ts](../../../../src/core/use-cases/tools/journal-write.tool.test.ts#L1)
   - [../../../../tests/chat/chat-stream-route.test.ts](../../../../tests/chat/chat-stream-route.test.ts#L1)
   - [../../../../tests/browser-ui/deferred-blog-jobs.spec.ts](../../../../tests/browser-ui/deferred-blog-jobs.spec.ts#L1)
   - [../../../../tests/browser-ui/jobs-page.spec.ts](../../../../tests/browser-ui/jobs-page.spec.ts#L1)
   - Any targeted worker-process or read-model test that covers lease recovery, terminal-state projection, and stale reconcile protection.

## Test Notes

1. Add direct regression coverage for stale terminal projection.
   - Prove that a queued or running message is updated in place to terminal state once a terminal event arrives.

2. Add a long-running lease continuity test.
   - Simulate an editorial job whose runtime exceeds the original lease and prove it is not reclaimed during healthy progress reporting.

3. Add a post-scoped journal readiness test.
   - Include an unrelated active deferred job for the same user and prove that the readiness summary for one post does not falsely report that other job as a blocker unless explicitly designed to do so.

4. Keep at least one live or semi-live editorial proof.
   - The `run-live-blog-pipeline.ts` script already exercises the full stack and should remain usable for Phase 10 verification.

5. Add direct UI coverage for stale and partial-ordering risks.
   - Prove the jobs workspace ignores stale selected-job snapshots and duplicate event payloads instead of overwriting newer state.
   - Add a high-volume conversation rehydrate case so the chat surface is tested when more than twelve deferred jobs exist.
   - Keep at least one worker-enabled browser or integration path that covers real queue claim, terminal projection, and lease continuity under a live worker.

6. Keep lifecycle invariants under test while the truth surfaces move.
   - Preserve replay lineage and deduped-outcome tests so Phase 10 does not accidentally break `replayedFromJobId` or `supersededByJobId` behavior while fixing projection.
   - Preserve ownership-transfer audit coverage so anonymous-job migration remains stable while terminal-state surfaces are reworked.

## Scope Guardrails

- Do not reopen capability-catalog structure or execution-target planning unless the lease fix exposes a real repository or binding defect.
- Do not broaden this phase into a general jobs-dashboard redesign.
- Do not replace the shared job publication contract with bespoke transcript-only logic.
- Do not treat bigger static lease durations as the final fix unless the audit proves heartbeat renewal is impossible.
- Do not leave the current stale-running transcript expectation in tests after claiming completion is fixed.
- Do not hide journal-readiness side effects behind a tool that appears read-only.
- Do not fix stale workspace state only in the EventSource hook while leaving reconcile and selected-job fetch paths free to regress newer state.
- Do not quietly keep the `limit=12` chat rehydrate rule unless the final contract explicitly says older deferred jobs are allowed to disappear from the conversation surface.
- Do not claim completion UX is resolved if `succeeded` jobs still vanish from every transient surface before operators can reasonably notice them.
- Do not regress replay lineage, deduped-outcome semantics, or anonymous ownership-transfer audit trails while fixing the broken completion surfaces.
- Do not leave stale notification or archived audit copy telling operators that terminal deferred updates intentionally stay out of chat after Phase 10 changes that contract.

## Implementation Record

- Date: 2026-04-14
- Files changed:
  - `docs/_refactor/system-state-2026-04-12/phases/phase-10-deferred-job-completion-reliability-and-observability.md`
  - `docs/_refactor/system-state-2026-04-12/phases/status-board.md`
  - `docs/_refactor/system-state-2026-04-12/phases/phase-10-invariants-and-active-defects.md`
   - `docs/_refactor/system-state-2026-04-12/runtime-e2e-inventory-and-logging.md`
   - `playwright.config.ts`
   - `package.json`
  - `src/lib/jobs/deferred-job-conversation-projector.ts`
  - `src/lib/jobs/deferred-job-worker.ts`
   - `src/lib/jobs/deferred-job-handler-factories.ts`
  - `src/components/jobs/job-snapshot-reducer.ts`
  - `src/hooks/chat/useChatJobEvents.ts`
   - `src/core/use-cases/BlogArticlePipelineModel.ts`
   - `src/core/use-cases/BlogImageProvider.ts`
   - `src/lib/blog/blog-article-production-service.ts`
   - `src/lib/blog/blog-image-generation-service.ts`
   - `src/lib/blog/blog-production-root.ts`
   - `src/core/use-cases/tools/journal-write.tool.ts`
   - `src/core/use-cases/tools/journal-write.tool.test.ts`
   - `src/lib/admin/processes.ts`
   - `src/lib/observability/runtime-audit-log.ts`
   - `src/adapters/AnthropicBlogArticlePipelineModel.ts`
   - `src/adapters/AnthropicBlogArticlePipelineModel.test.ts`
   - `src/adapters/OpenAiBlogImageProvider.ts`
   - `src/adapters/OpenAiBlogImageProvider.test.ts`
  - `src/components/jobs/job-snapshot-reducer.test.ts`
  - `src/hooks/chat/useChatJobEvents.test.tsx`
   - `src/lib/jobs/deferred-job-runtime.test.ts`
  - `tests/deferred-blog-job-flow.test.ts`
  - `tests/deferred-blog-publish-flow.test.ts`
  - `tests/deferred-job-worker.test.ts`
   - `tests/deferred-job-runtime.integration.test.ts`
   - `tests/browser-ui/deferred-job-worker-live.spec.ts`
   - `tests/browser-ui/README.md`
   - `tests/admin-processes.test.ts`
  - `src/components/NotificationFeed.tsx`
  - `docs/_archive/_qa/FEATURE_AUDIT.md`
- Summary of what landed:
  - Added a new Phase 10 packet covering deferred blog and journal completion reliability, lease continuity, cancellation semantics, journal publish-readiness scoping, and operator forensics.
  - Added a matching Phase 10 entry to the status board so the current audit is visible in the folder-level roadmap.
  - Added a Phase 10 companion note splitting preserved deferred-job invariants from active defects.
  - Landed the first implementation cut by updating the conversation projector so terminal deferred-job events replace the existing chat message in place.
  - Landed the second implementation cut by renewing worker leases on healthy progress, widening chat rehydrate, and making jobs workspace reconcile preserve fresher state.
   - Landed the third implementation cut by threading abort signals through deferred handlers, teaching the editorial production service to stop at stage boundaries after cancellation, scoping journal readiness active jobs to the named post, and adding a runtime-loop integration proof that exercises claim, progress, projection, and terminal completion through the live worker.
   - Landed the fourth implementation cut by propagating cancellation into Anthropic and OpenAI provider calls, adding a worker-enabled Playwright proof that seeds and completes a real queued draft job in the browser, and exposing the canonical runtime-audit log directory and file paths through admin diagnostics.
  - Updated the worker-backed draft and publish regressions, added direct reducer and high-volume rehydrate coverage, and aligned the remaining operator-facing copy that still described the old notification-only terminal contract.
- Deviations from the detailed plan:
  - Lease continuity is now progress-driven rather than a standalone heartbeat API, so the remaining lease risk is limited to long opaque handler spans that do not emit progress.
   - Cancellation is now explicit through worker, editorial-stage, and provider-request boundaries, but any third-party surface that ignores abort signals can still only be interrupted when control returns.
   - The worker-enabled proof first landed at the runtime loop and now also exists as a browser proof; the remaining browser-owned forensic gap is limited to client-side runtimes that do not write server JSONL logs.

## Post-Implementation QA

- [x] Run the targeted deferred-job and journal verification bundle.
- [x] Run changed-file diagnostics.
- [x] Run the worker-enabled Playwright deferred-job proof.
- [ ] Re-run one long-running editorial proof and confirm lease continuity plus terminal transcript projection.
- [ ] Re-read the source anchors and confirm the intended seam changed instead of only a neighboring UI or test helper.
- [ ] Record any remaining retry-policy, cancellation, or observability follow-on work after the first Phase 10 cut.

## Exit Criteria

- A deferred editorial job that reaches `result`, `failed`, or `canceled` updates the existing transcript message to the truthful terminal state.
- Healthy long-running `produce_blog_article` execution no longer risks `lease_recovered` duplication during normal progress.
- Cancellation semantics for deferred editorial jobs are explicit, tested, and accurately reflected in operator-visible status.
- `prepare_journal_post_for_publish` reports blockers that are truthful for the named post instead of conflating unrelated active jobs.
- Operators have one documented canonical place to inspect deferred editorial job forensics.
- Phase 10 tests no longer encode the stale-running transcript behavior as expected.

## Handoff

- What the next implementation loop should now assume: transcript truth, progress-driven lease renewal, post-scoped readiness reporting, provider-level abort propagation, worker-backed integration coverage, worker-backed browser coverage, and operator-visible runtime-audit paths are live.
- What remains unresolved: any provider or downstream API that does not honor abort signals can still only be interrupted when control returns, browser-owned runtimes still need their own forensic attachment path, and completion-surface policy still needs a final decision.
- What docs need updating: [./status-board.md](./status-board.md#L1), any later Phase 5 note that still overstates terminal projection behavior, [../../../../src/components/NotificationFeed.tsx](../../../../src/components/NotificationFeed.tsx#L1), and any operator-facing deferred-job docs that imply one obvious log location or the old notification-only terminal contract.