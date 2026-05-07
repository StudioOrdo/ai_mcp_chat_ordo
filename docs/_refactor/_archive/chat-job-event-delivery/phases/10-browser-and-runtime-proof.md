# Phase 10 - Browser And Runtime Proof

## Goal

Prove the behavior in the product surface, not only in unit tests.

## Steps

1. Start a dev server with an isolated worker id and ports.
2. Use a deterministic browser scenario or controlled route fixture.
3. Start one deferred job from chat.
4. Confirm one running job card appears.
5. Confirm Jobs rail badge shows one active job.
6. Drive the job to completion through event or controlled fixture.
7. Confirm the same card updates to terminal state instead of appending.
8. Reload and confirm one completed card remains.
9. Simulate EventSource failure and confirm reconciliation restores latest state.
10. Confirm Push disabled does not change active chat result.

## Code Anchors

- `tests/browser-ui/job-event-delivery.spec.ts`
- `tests/browser-ui/deferred-blog-jobs.spec.ts`
- `tests/browser-ui/jobs-page.spec.ts`
- `playwright.config.ts`

## Done

- Browser scenario passes.
- Screenshot or trace evidence is recorded if UI changed.
