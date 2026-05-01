# Jobs Rail And Diagnostics Refactor

This package tracks the replacement of the chat chrome `Data` affordance with a
Swiss-minimal, real-time Jobs rail and a single downloadable diagnostic bundle
for conversation, job, runtime, and browser evidence.

Current status: partially implemented. The shell top-rail slice exists in code,
the diagnostic bundle route exists, and the user-mark/revise backend work is
still pending.

## Package Contents

1. [contract-spec.md](contract-spec.md): implementation-ready contract for
     product behavior, view models, actions, persistence, diagnostic bundle shape,
     API routes, component boundaries, phases, and acceptance tests.

## Where We Are

### Done

- Contract package created under this folder.
- Jobs rail pure projection exists at
    [src/frameworks/ui/jobs-rail/resolve-jobs-rail.ts](../../../src/frameworks/ui/jobs-rail/resolve-jobs-rail.ts).
- Jobs rail UI exists at
    [src/frameworks/ui/jobs-rail/JobsRail.tsx](../../../src/frameworks/ui/jobs-rail/JobsRail.tsx),
    [src/frameworks/ui/jobs-rail/JobsRailDrawer.tsx](../../../src/frameworks/ui/jobs-rail/JobsRailDrawer.tsx), and
    [src/frameworks/ui/jobs-rail/JobsRailRow.tsx](../../../src/frameworks/ui/jobs-rail/JobsRailRow.tsx).
- The primary shell nav renders Jobs directly in the top rail in
    [src/components/SiteNav.tsx](../../../src/components/SiteNav.tsx). The
    embedded chat surface no longer renders a separate Jobs/chat header rail.
- The Jobs rail trigger is now icon-led with a factory/work glyph, state tinting,
    and count badge in
    [src/frameworks/ui/jobs-rail/JobsRail.tsx](../../../src/frameworks/ui/jobs-rail/JobsRail.tsx).
- The old transcript-derived bottom progress rail has been removed from
    [src/frameworks/ui/ChatContentSurface.tsx](../../../src/frameworks/ui/ChatContentSurface.tsx),
    so job status has one primary rail position in the shell top rail.
- Conversation copy/export/import utilities are preserved inside the rail drawer
    overflow instead of the old visible `Data` button.
- `useJobsRailController` builds the shell rail model and handles rail actions in
    [src/frameworks/ui/jobs-rail/useJobsRailController.ts](../../../src/frameworks/ui/jobs-rail/useJobsRailController.ts).
- Composer-seeding rail actions are bridged through
    [src/lib/chat/chat-events.ts](../../../src/lib/chat/chat-events.ts), so the
    top shell rail can still target the live composer.
- Existing `open`, `cancel`, and `retry` job actions are preserved through the
    existing action dispatch path.
- Policy failures are presented as `Needs revision` with `Revise` as the primary
    rail action. This is currently a composer-seeding action, not yet a backend
    revise/rerun operation.
- Diagnostic bundle route exists at
    [src/app/api/diagnostics/conversations/[conversationId]/route.ts](../../../src/app/api/diagnostics/conversations/%5BconversationId%5D/route.ts).
- Redaction helper exists at
    [src/lib/diagnostics/redaction.ts](../../../src/lib/diagnostics/redaction.ts).
- Browser diagnostics recorder exists at
    [src/frameworks/ui/diagnostics/browser-diagnostics-recorder.ts](../../../src/frameworks/ui/diagnostics/browser-diagnostics-recorder.ts).
- Focused tests exist for rail projection, rail UI behavior, job route retry
    behavior, and diagnostics redaction.

### Partially Done

- Diagnostic bundle download is wired from the rail overflow, but the browser
    diagnostics recorder is not yet mounted into the app or passed into the bundle
    request.
- The diagnostic route assembles conversation export, job timelines, runtime
    logs, browser diagnostics when provided, and redaction metadata. Route-level
    tests for ownership, anonymous rejection, bundle shape, and redaction are not
    present yet.
- `revise`, `dismiss`, and `archive` exist in the rail action model, but only
    `cancel` and `retry` are accepted by the current job action route.
- Canceled jobs are hidden by the first rail projection, but this is not the same
    as durable user-scoped dismissal or archive.

### Not Implemented Yet

- No `job_user_marks` table or migration exists for `dismissed`, `archived`, or
    `pinned` job marks.
- No `JobUserMarkRepository` exists yet.
- `RevisionOperationKind` has not been extended with `dismiss`, `archive`, or
    `revise` in
    [src/core/platform/revision/RevisionContract.ts](../../../src/core/platform/revision/RevisionContract.ts).
- `POST /api/jobs/{jobId}` still rejects anything except `cancel` and `retry`.
- There is no durable dismiss/archive behavior that hides a job per user without
    changing job execution truth.
- There is no backend revise/rerun flow that creates a new job from edited input,
    records `replayedFromJobId`, and supersedes the source job.
- No motion polish phase has started.
- No browser-level verification has proved the diagnostic bundle download or
    final rail behavior end to end.

## Phase Status

| Phase | Contract Goal | Status |
| --- | --- | --- |
| 1 | Rail projection and shell top-rail replacement | Implemented |
| 2 | Diagnostic bundle | Partially implemented |
| 3 | User job marks | Not started |
| 4 | Revise and rerun | Not started, except UI prompt action |
| 5 | Motion polish | Not started |

## Next Work

1. Finish Phase 2 tests and browser diagnostics wiring.
2. Implement Phase 3 user-scoped job marks.
3. Add backend `dismiss` and `archive` operations without mutating job status or
     deleting job history.
4. Implement Phase 4 backend `revise` for the first policy/content failure path.
5. Add browser verification for rail state, diagnostic bundle download, and
     dismissed-job behavior.

## Guardrails

- Do not hard-delete jobs from the rail.
- Do not make transcript message parts the source of operational truth.
- Do not expose raw logs in the normal UI; diagnostics belong in the downloaded
    bundle.
- Do not remove conversation copy/export/import utilities; keep them demoted in
    overflow.
- Do not treat the current `Revise` composer prompt as the completed backend
    revise/rerun feature.

## Useful Validation Commands

Focused checks for the shell top Jobs rail, composer bridge, and bottom-rail
removal slice:

```bash
npm exec vitest run src/frameworks/ui/useChatSurfaceState.test.tsx src/frameworks/ui/ChatContentSurface.test.tsx src/components/SiteNav.test.tsx src/frameworks/ui/ChatSurface.test.tsx src/hooks/chat/useChatComposerController.test.tsx src/frameworks/ui/jobs-rail/JobsRail.test.tsx src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts
```

Last focused validation: 2026-04-29, 7 files passed, 51 tests passed for the
shell top Jobs rail and bottom-rail removal slice. Browser verification also
confirmed one Jobs control in the primary nav, zero embedded chat headers, and
zero bottom progress rails.

When Phase 2 route tests are added, include the diagnostics route test in the
same focused command.
