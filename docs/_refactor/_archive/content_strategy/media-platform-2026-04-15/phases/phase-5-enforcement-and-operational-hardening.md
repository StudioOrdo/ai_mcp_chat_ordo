# Phase 5 — Enforcement And Operational Hardening

> Status: Complete
> Loop State: Exit criteria verified
> Goal: Add quota enforcement, cleanup hardening, and media-specific architecture audits on top of the earlier visibility and policy phases.
> Prerequisites: Phase 4 complete

## Phase Intent

This phase exists to close the loop. Once the media routes, accounting layer, and quota surfaces are in place, the system still needs conservative enforcement and explicit architecture-audit coverage to prevent future layering and RBAC regressions.

## Source Anchors To Refresh

- [../../../../src/app/api/chat/uploads/route.ts](../../../../src/app/api/chat/uploads/route.ts#L1)
- [../../../../src/app/api/chat/uploads/route.test.ts](../../../../src/app/api/chat/uploads/route.test.ts#L1)
- [../../../../src/lib/chat/upload-reaper.ts](../../../../src/lib/chat/upload-reaper.ts#L1)
- [../../../../src/lib/storage/media-quota-policy.ts](../../../../src/lib/storage/media-quota-policy.ts#L1)
- [../../../../src/lib/user-files.ts](../../../../src/lib/user-files.ts#L1)
- [../../../../tests/solid-architecture-audit.test.ts](../../../../tests/solid-architecture-audit.test.ts#L1)
- [../../../../tests/architecture-cohesion-audit.test.ts](../../../../tests/architecture-cohesion-audit.test.ts#L1)

## Current-State Findings

- The quota-policy seam already exists in [../../../../src/lib/storage/media-quota-policy.ts](../../../../src/lib/storage/media-quota-policy.ts#L1), is env-configurable, and is already projected into `/my/media`; Phase 5 no longer needs to invent quota state or display contracts.
- [../../../../src/app/api/chat/uploads/route.ts](../../../../src/app/api/chat/uploads/route.ts#L1) now validates type and size, delegates persistence to `UserFileSystem.storeBinaryBatchWithinQuota()`, and rejects over-quota uploads only when `hardBlockUploadsAtQuota` is enabled.
- Upload failures are now structured with `errorCode`, and quota rejections include projected quota state plus `incomingBytes`; successful uploads also return projected quota state for near-threshold and display-only-over-quota cases.
- Threshold concurrency is now explicit for the single-node SQLite runtime: upload batches are evaluated as whole units, only net-new bytes after dedupe count toward quota, and the repository serializes the check-and-insert path with `BEGIN IMMEDIATE` so concurrent uploads do not both pass the same stale pre-write total.
- [../../../../src/lib/chat/upload-reaper.ts](../../../../src/lib/chat/upload-reaper.ts#L1) currently reaps only stale unattached `document` uploads. Media uploads now share the same route, but they are not yet part of the server-owned stale-upload sweep.
- [../../../../src/lib/user-files.ts](../../../../src/lib/user-files.ts#L1) remains conservative: deletion is still unattached-only, repository-gated, and rooted under `DATA_DIR`. The upload cleanup route now reports only confirmed deletions and explicit skipped IDs.
- Media-specific architecture-audit coverage now exists in [../../../../tests/media-architecture-audit.test.ts](../../../../tests/media-architecture-audit.test.ts#L1).

## Drift Traps

- Blocking uploads with poor or generic error messages.
- Making cleanup more aggressive than the data model can safely support.
- Treating enforcement as sufficient without subsystem-specific architecture tests.
- Relying on manual review instead of encoded audit checks for route, loader, and RBAC purity.

## Pre-Implementation QA Gate

- [x] Refresh current diagnostics for upload, cleanup, and architecture-audit files.
- [x] Refresh current upload-route and cleanup tests.
- [x] Confirm the source anchors still reflect the canonical enforcement seams.
- [x] Record exact verification commands for upload enforcement, cleanup, and architecture proof.
- [x] Update this packet's verified-state notes before writing the detailed plan.

## Verified Current State

This section reflects the implementation that landed on 2026-04-15.

### Current Code Notes

- [../../../../src/lib/storage/media-quota-policy.ts](../../../../src/lib/storage/media-quota-policy.ts#L1) remains the canonical policy seam. Phase 5 consumes it directly rather than introducing a route-local quota contract.
- [../../../../src/app/api/chat/uploads/route.ts](../../../../src/app/api/chat/uploads/route.ts#L1) now delegates quota-aware persistence to `UserFileSystem.storeBinaryBatchWithinQuota()`, returning `QUOTA_EXCEEDED`, `VALIDATION_ERROR`, and `INTERNAL_ERROR` envelopes instead of plain `{ error }` failures.
- [../../../../src/lib/user-files.ts](../../../../src/lib/user-files.ts#L1) now owns the quota-aware batch persistence contract and throws a typed quota error with projected quota state when hard enforcement rejects a batch.
- [../../../../src/adapters/UserFileDataMapper.ts](../../../../src/adapters/UserFileDataMapper.ts#L1) serializes the quota check and record creation with `BEGIN IMMEDIATE`, counts only net-new bytes after dedupe, and rejects the whole batch atomically when hard-block quota would be crossed.
- The upload cleanup endpoint still delegates to `UserFileSystem.deleteIfUnattached`, but its response shape is now truthful: `deletedIds`, `skippedIds`, `deletedCount`, and `skippedCount`.
- [../../../../src/lib/chat/upload-reaper.ts](../../../../src/lib/chat/upload-reaper.ts#L1) remains intentionally narrow: the stale server-owned sweep is still document-only, and [../../../../src/lib/chat/upload-reaper.test.ts](../../../../src/lib/chat/upload-reaper.test.ts#L1) now locks that scope down explicitly.
- [../../../../tests/media-architecture-audit.test.ts](../../../../tests/media-architecture-audit.test.ts#L1) now guards the upload route and media pages against direct DB or filesystem shortcuts.

### Current QA Notes

- 2026-04-15 focused Phase 5 verification is green:
  - `npm exec vitest run src/app/api/chat/uploads/route.test.ts src/lib/user-files.test.ts src/adapters/UserFileDataMapper.test.ts src/lib/chat/upload-reaper.test.ts src/lib/storage/media-quota-policy.test.ts tests/media-architecture-audit.test.ts`
  - Result: 6 files passed, 54 tests passed.
- Changed-file lint is green:
  - `npm exec eslint src/app/api/chat/uploads/route.ts src/app/api/chat/uploads/route.test.ts src/lib/user-files.ts src/lib/user-files.test.ts src/adapters/UserFileDataMapper.ts src/adapters/UserFileDataMapper.test.ts src/lib/chat/upload-reaper.test.ts tests/media-architecture-audit.test.ts`
  - Result: no output.
- The upload route now has dedicated coverage for quota-blocked uploads, display-only over-quota uploads, structured validation errors, and partial cleanup semantics. The governed file layer and mapper now also have direct tests for the atomic batch contract.

## Suggested Verification Commands

```bash
npm exec vitest run src/app/api/chat/uploads/route.test.ts src/lib/user-files.test.ts src/adapters/UserFileDataMapper.test.ts src/lib/chat/upload-reaper.test.ts src/lib/storage/media-quota-policy.test.ts tests/media-architecture-audit.test.ts
npm exec eslint src/app/api/chat/uploads/route.ts src/app/api/chat/uploads/route.test.ts src/lib/user-files.ts src/lib/user-files.test.ts src/adapters/UserFileDataMapper.ts src/adapters/UserFileDataMapper.test.ts src/lib/chat/upload-reaper.test.ts tests/media-architecture-audit.test.ts
```

## Expected Evidence Artifacts

- Upload-route tests for under-quota, hard-block over-quota, and display-only over-quota behavior.
- Cleanup tests proving partial-delete semantics and making the stale document-only reaper scope explicit.
- A media-specific architecture-audit suite forbidding route-level DB and filesystem shortcuts.
- A residual-risk note for any still-unenforceable derivative relationships.

## Detailed Implementation Plan

1. Add policy-driven quota enforcement to the upload path.

  Consume the existing quota-policy seam rather than inventing new quota config. Compare current usage plus incoming upload size against the configured quota before persistence. Gate hard rejection on `hardBlockUploadsAtQuota`, but return a structured, UI-friendly rejection envelope either way.

1. Normalize upload rejection semantics.

  Keep existing type and size validation, but align enforcement failures with explicit `errorCode` and quota-state context so the UI can distinguish quota from generic failure. Decide whether the route should report projected quota state for near-threshold accepted uploads.

1. Tighten cleanup protections and evidence.

  Preserve the current unattached-only deletion rule. Make the stale-upload reaper scope explicit: either keep it document-only and document why, or broaden it carefully to eligible ephemeral media uploads with test proof. Add evidence for protected assets and partial-delete semantics if the cleanup contract changes.

1. Add media-specific architecture-audit tests.

  Clone the existing broad audit style into a dedicated media subsystem suite. Forbid direct DB access and filesystem traversal shortcuts in media routes or loaders. Ensure upload enforcement stays delegated through policy or service seams instead of route-local SQL or disk inspection.

## Scope Guardrails

- Do not expand into billing or subscription logic.
- Do not broaden cleanup to conversation-bound assets without a separate data-lifecycle decision.

## Implementation Record

- Date: 2026-04-15
- Files changed:
  - `src/app/api/chat/uploads/route.ts`
  - `src/app/api/chat/uploads/route.test.ts`
  - `src/lib/chat/upload-reaper.test.ts`
  - `tests/media-architecture-audit.test.ts`
- Summary of what landed:
  - `/api/chat/uploads` now enforces projected quota state through the shared accounting and quota-policy seams.
  - The single-node SQLite runtime now has an explicit threshold-concurrency contract: whole upload batches are serialized through `BEGIN IMMEDIATE`, and quota counts only net-new bytes after dedupe.
  - The route returns structured `errorCode` envelopes and projected quota context for both rejection and success paths.
  - Cleanup responses now report only confirmed deletions plus skipped IDs.
  - The stale-upload reaper remains intentionally document-only, and that scope is now test-backed.
  - A dedicated media architecture-audit suite now protects the upload route and media pages from layering regressions.
- Deviations from the detailed plan:
  - The stale-upload reaper was not broadened to media assets in this slice; the contract stayed conservative and explicit instead.

## Post-Implementation QA

- [x] Run targeted upload, cleanup, and audit tests, extending the prerequisite bundle with the new media-specific audit file.
- [x] Run changed-file diagnostics.
- [x] Re-read the source anchors and confirm enforcement stayed policy-driven and conservative.
- [x] Record residual risks and any follow-on work.

## Exit Criteria

- Quota enforcement is policy-driven and test-backed.
- Cleanup remains conservative and well-proven.
- Media-specific architecture audits exist and guard the most likely regressions.
- Upload rejection semantics are structured enough for UI and operator diagnostics to distinguish quota, validation, and generic failures.

## Handoff

- What the next phase should now assume:
  - The quota-policy seam is already live and is now enforced from `/api/chat/uploads`; future work should extend that contract rather than replacing it.
  - `/my/media` and `/operations/media` remain the canonical user and operator surfaces from Phases 2 through 4.
  - The focused Phase 5 upload, cleanup, quota-policy, and media-architecture bundle is green as of 2026-04-15.
- What remains unresolved:
  - Stale server-owned cleanup is still limited to unattached `document` uploads by design.
- What docs need updating:
  - [./status-board.md](./status-board.md#L1) and [../implementation-roadmap.md](../implementation-roadmap.md#L1) should now reflect the implemented contract.
  - [../../../_refactor/media/specs/media-platform-phased-implementation-plan.md](../../../_refactor/media/specs/media-platform-phased-implementation-plan.md#L454) should record that the cleanup decision stayed document-only in this slice.
