# Phase 08 - Legacy Fragmentation Cleanup

## Goal

Remove or explicitly retain legacy compatibility paths after the new behavior is
proven. Phase 08 is a cleanup and ownership phase: it should not introduce a
new transport, a new job model, or another dedupe layer. It should verify that
Phases 00-07 removed the old pressure to use assistant status polling as the
normal synchronization mechanism, then remove or document remaining legacy
paths.

## Post-09 Hard-Cutover Note

Phase 08 was the compatibility cleanup before the greenfield hard cutover.
Phases 09a-09d supersede any Phase 08 retention decision that kept
transcript-shaped job lifecycle data in default product presentation. The
current state is stricter: default chat renders job cards from
`CanonicalJobSnapshot[]`; transcript `job_status`, nested status-tool
snapshots, and `deferred_job` acknowledgements are raw history/diagnostic data
or internal renderer adapter inputs only.

Historical commands and test-file references below are preserved as Phase 08
evidence only. Do not run deleted `tests/conversation-messages.test.ts`
as current validation; use the 09a-09d validation commands instead.

## Current State After Phase 07

Phases 00-07 are implemented and Phase 07 QA is closed. The current code has
already moved the largest reliability and presentation risks into durable event,
reconciliation, and presenter seams:

- `src/hooks/chat/useChatJobEvents.ts` owns active-chat EventSource delivery,
   conversation-scoped cursor tracking, and snapshot reconciliation.
- `src/app/api/chat/events/route.ts`, `src/app/api/jobs/events/route.ts`, and
   `src/lib/jobs/job-event-stream.ts` own durable replay through route-specific
   cursor semantics.
- `src/hooks/chat/useJobStateStore.ts` owns latest-by-`jobId` in-chat state and
   terminal-state non-regression.
- `src/adapters/ChatPresenter.ts` now routes explicit `job_status` parts and
   nested status-tool snapshots through `src/lib/chat/JobRenderCandidateMerger.ts`
   before `ToolRenderEntry` creation.
- `src/lib/chat/JobRenderCandidateMerger.ts` is the preferred presenter-level
   consolidation point for freshness comparison and media truth text.
- `src/frameworks/ui/jobs-rail/resolve-jobs-rail.ts` has Keith-style repeated
   status snapshot coverage and keeps one rail item/count for one durable job.
- `src/lib/evals/scenarios.ts`, `src/lib/evals/runner.ts`,
   `src/lib/evals/live-runner.ts`, and `src/lib/evals/seeding.ts` no longer use
   status tools as the missed-SSE or completion-recovery proof. Phase 07 retained
   status tools only for explicit status, reuse, diagnostic, and publish-handoff
   scenarios.
- `src/lib/media/browser-runtime/job-snapshots.ts` already suppresses
   transcript-derived `compose_media` browser runtime candidates, with coverage
   in `src/lib/media/browser-runtime/job-snapshots.test.ts`.

The open Phase 08 work is therefore targeted cleanup: remove stale compatibility
tests/docs/helpers where they are now obsolete, and write down ownership and
removal conditions for every retained path.

Current regression evidence to carry into implementation:

- `../keith-compose-video-5-whys.md` documents the April 30 Keith compose-media
   duplicate where a queued no-artifact `compose_media` transcript card remained
   visible beside the later succeeded durable artifact card for the same job.
   Phase 08 must cover this mixed explicit/nested/contentful-message case, not
   only repeated status-tool snapshots.

## Cleanup Decision Matrix

| Surface | Current code state | Phase 08 action |
| --- | --- | --- |
| `ChatPresenter` local first-wins behavior | Replaced for current job render candidates by `upsertRenderedJobCandidate()` and `compareJobRenderCandidateFreshness()` in `JobRenderCandidateMerger.ts`; `presentMany()` also uses the freshness comparator across messages. | Verify no stale `renderedJobIds` or equivalent first-wins helper remains. If a local set/map exists only for freshness, remove it; otherwise document why it has a different boundary. |
| Nested status-tool snapshots | Historical Phase 08 behavior extracted snapshots through `extractJobStatusSnapshots()`. | Superseded by 09c/09d. Default product chat no longer renders job cards from nested status-tool snapshots. |
| Media truth text helper | `resolveTruthBoundMediaText()` lives in `JobRenderCandidateMerger.ts` and is imported by `ChatPresenter`. | Treat this as canonical unless inspection finds another duplicate helper. Remove duplicates or record their separate owner/boundary. |
| Jobs rail latest/count behavior | `resolve-jobs-rail.test.ts` includes Keith-style repeated status snapshot coverage. | Keep rail reducer/model ownership separate from presenter types. Do not force UI rail code to import `ToolRenderEntry`; share only small pure primitives if duplication becomes harmful. |
| Explicit job-status message suppression | Historical Phase 08 behavior suppressed stale explicit message parts in derived presentation. | Superseded by 09c/09d. Product chat no longer upserts or suppresses transcript job-status messages; it consumes canonical snapshots. |
| Eval recovery expectations | Phase 07 changed missed-SSE/completion recovery to `recover` with empty status-tool `toolIds`; tests assert no recovery status tool observations. | Mark completed in Phase 08 closeout. Keep explicit/reuse/publish status-tool scenarios with rationale. |
| Deterministic/live runner fixtures | Missed-SSE recovery now records durable reconciliation state; live completion recovery can pass with no status tool calls. | Search for stale fixture text such as `snapshot recovery path`, status-tool recovery as reliability proof, or default repeated status reads. Update only stale language. |
| Legacy route coverage | `tests/deferred-job-events-route.test.ts` still covers `/api/chat/events`; canonical route tests also exist under `src/app/api/chat/events/route.test.ts` and `src/app/api/jobs/events/route.test.ts`. | Decide whether to consolidate old route tests or retain them as broader legacy coverage. If retained, record owner, reason, and removal condition. |
| Browser runtime synthetic jobs | `compose_media` transcript-derived candidates are already blocked; other browser-capable media tools still intentionally create runtime candidates. | Do not solve compose-media ownership here. Add/verify compatibility evidence that durable server job snapshots outrank transcript-derived synthetic candidates when both exist. Cross-reference `docs/_refactor/compose-media-execution-ownership/contract-spec.md`. |
| Queued compose transcript card vs final artifact card | The current Keith conversation stores a queued `compose_media` tool result and queued `job_status` part in a contentful assistant message, while the durable succeeded job artifact is a separate status surface for the same `jobId`. | Add a regression fixture and suppress stale queued nested/explicit compose surfaces against newer canonical job truth without deleting the explanatory assistant text or raw history. |
| Raw transcript and admin diagnostics | Raw history must remain available for export, incident review, and admin diagnostics. | Retain explicitly. Dedupe only default product presentation, not source transcript/tool history. |
| Browser Push APIs | Push infrastructure remains optional and user/session scoped. | Retain for Phase 09. Phase 08 should only ensure docs do not describe Push as active-chat correctness. |

## Implementation Steps

1. Re-scan the watchlist in `systemic-audit.md` and classify each item as
    removed, retained, already completed, or deferred.
2. Search code and tests for stale repeated-status expectations:
    `renderedJobIds`, `repeated visible`, `status-tool recovery`,
    `snapshot recovery path`, `must_use`, `list_deferred_jobs`, and
    `get_deferred_job_status`.
3. Confirm `ChatPresenter` has no obsolete local first-wins job dedupe path and
    that both same-message and cross-message nested snapshots still use
    `JobRenderCandidateMerger.ts` freshness semantics.
4. Confirm `resolveTruthBoundMediaText()` has one presenter-level owner. Remove
    duplicate media-truth helpers or document a separate boundary.
5. Review eval scenario and runner fixtures after Phase 07. Keep status-tool
    `must_use` only for explicit status, reuse/diagnostic, or publish-handoff
    scenarios; do not use them as missed-SSE recovery proof.
6. Decide whether `tests/deferred-job-events-route.test.ts` should be folded
    into the app-route tests or retained as legacy route coverage. Record the
    decision in this phase closeout.
7. Verify browser runtime synthetic job behavior. Keep the existing
    `compose_media` exclusion and document any remaining compatibility handoff to
    the compose-media execution ownership package.
8. Search package and prompt docs for stale wording that calls assistant status
    polling the reliability strategy. Update active guidance only; preserve
    historical incident descriptions when they are clearly framed as history.
9. Record every retained fallback with owner, reason, and removal condition.

## Retention Record Template

Use this table in the implementation evidence section before marking Phase 08
done:

| Retained path | Owner | Reason | Removal condition |
| --- | --- | --- | --- |
| Example: raw transcript status-tool history | Admin diagnostics / transcript export | Needed for incident review and auditability while default presentation is deduped. | Only remove if a replacement audit surface preserves original tool-call history. |

## Do Not Change

- Do not remove `get_deferred_job_status`, `list_deferred_jobs`,
   `get_my_job_status`, or `list_my_jobs`.
- Do not remove raw transcript export, admin diagnostics, or original tool-call
   history.
- Do not make Browser Push the active-chat delivery mechanism.
- Do not fold Jobs rail presentation into `ChatPresenter` types.
- Do not rewrite browser-runtime or compose-media execution ownership inside
   this phase beyond compatibility evidence and handoff notes.
- Do not delete historical incident notes merely because they describe the old
   failure mode; update only guidance that still recommends obsolete behavior.

## Validation Plan

Run focused tests that cover the cleanup boundaries:

```bash
npm exec vitest run \
   src/adapters/ChatPresenter.test.ts \
   src/hooks/usePresentedChatMessages.test.tsx \
   src/hooks/chat/useJobStateStore.test.tsx \
   src/hooks/chat/useChatJobEvents.test.tsx \
   src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts \
   src/app/api/chat/events/route.test.ts \
   src/app/api/jobs/events/route.test.ts \
   tests/deferred-job-events-route.test.ts \
   src/lib/evals/scenarios.test.ts \
   tests/evals/eval-runner.test.ts \
   tests/evals/eval-live-runner.test.ts \
   src/lib/media/browser-runtime/job-snapshots.test.ts
```

Also run targeted lint/diagnostics for touched files and `git diff --check`.

## Implementation Evidence

Phase 08 core cleanup is implemented for the Keith compose-media duplicate
regression target.

Code changes:

- `src/lib/jobs/job-status-part-merge.ts` now exports
   `compareJobStatusPartFreshness()` as the shared job-status freshness
   primitive.
- `src/core/services/ConversationMessages.ts` now suppresses stale explicit
   `job_status` transcript parts by job freshness instead of latest transcript
   position.
- `src/lib/chat/JobRenderCandidateMerger.ts` now reuses the shared job-status
   freshness primitive before applying presenter-only result/source/encounter
   tie-breakers.
- `tests/conversation-messages.test.ts` covers the Keith-style case
   where a later contentful assistant message contains a stale queued
   `compose_media` status while an earlier message contains the succeeded
   artifact truth.
- `src/hooks/usePresentedChatMessages.test.tsx` covers the rendered hook path
   so default presentation shows one succeeded compose artifact card and
   preserves the explanatory assistant text.

Focused validation passed:

```bash
npm exec vitest run \
   tests/conversation-messages.test.ts \
   src/hooks/usePresentedChatMessages.test.tsx \
   src/adapters/ChatPresenter.test.ts
```

Result: 3 test files passed, 72 tests passed.

Broader Phase 08 validation passed:

```bash
npm exec vitest run \
   src/adapters/ChatPresenter.test.ts \
   src/hooks/usePresentedChatMessages.test.tsx \
   src/hooks/chat/useJobStateStore.test.tsx \
   src/hooks/chat/useChatJobEvents.test.tsx \
   src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts \
   src/app/api/chat/events/route.test.ts \
   src/app/api/jobs/events/route.test.ts \
   tests/deferred-job-events-route.test.ts \
   src/lib/evals/scenarios.test.ts \
   tests/evals/eval-runner.test.ts \
   tests/evals/eval-live-runner.test.ts \
   src/lib/media/browser-runtime/job-snapshots.test.ts \
   tests/deferred-job-status.tool.test.ts \
   tests/job-status-summary-tools.test.ts
```

Result: 14 test files passed, 159 tests passed.

Diagnostics passed:

- `get_errors` found no errors in touched Phase 08 code or docs.
- `git diff --check` produced no whitespace errors for the tracked Phase 08
   diff.

## Retention Record

| Retained path | Owner | Reason | Removal condition |
| --- | --- | --- | --- |
| Raw transcript status-tool and compose-media history | Admin diagnostics / transcript export | Needed for incident review and auditability while default presentation is deduped. | Only remove if a replacement audit surface preserves original tool-call history. |
| Explicit status tools | Job status tool owners | Still needed for user-requested inspection, diagnostics, reuse checks, and admin workflows. | Only remove if all explicit inspection workflows have a replacement with equal auditability and access control. |
| Nested status-tool snapshot extraction | Chat presenter read model | Preserves historical tool results while presenting the freshest visible job truth. | Remove only if historical tool results are no longer rendered through chat presentation. |
| Jobs rail reducer freshness | Jobs workspace / rail UI | Rail state is not a `ToolRenderEntry` projection and should not import presenter types. | Replace only with a smaller shared primitive that does not couple rail UI to chat presenter view models. |
| Browser runtime synthetic jobs for non-`compose_media` browser tools | Browser media runtime | Some browser-capable tools still intentionally produce local runtime candidates. | Remove when those tools have durable server job ownership or an explicit runtime job-claim contract. |
| Browser Push APIs | Notification subsystem | Push is useful for terminal away/background notification but not active-chat correctness. | Remove only if product drops away/background notification support. |

## Done Checklist

- [x] The cleanup watchlist in `systemic-audit.md` is classified as removed,
   retained, already completed, or deferred.
- [x] No compatibility path recreates repeated visible transcript job spam for
   repeated unchanged status-tool snapshots.
- [x] No test expects repeated unchanged status-tool outputs to produce repeated
   visible cards.
- [x] Presenter freshness remains consolidated through `JobRenderCandidateMerger.ts`
   or a documented smaller primitive.
- [x] Duplicate media-truth helper logic is removed or explicitly retained with
   a boundary reason.
- [x] Eval recovery proof remains durable reconciliation/event state, not
   assistant status-tool polling.
- [x] Explicit status-tool requests and diagnostic/reuse scenarios still work
   and have retained-rationale coverage.
- [x] Raw transcript/export and admin diagnostics still expose original tool
   history where intended.
- [x] Browser runtime synthetic job compatibility is documented or handed off to
   the compose-media execution ownership package.
- [x] Push remains optional and outside active-chat correctness.
- [x] Every retained legacy behavior has owner, reason, and removal condition.
