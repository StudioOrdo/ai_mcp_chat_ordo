# Phase 4 — Capacity And Quotas

> Status: Complete
> Loop State: Exit criteria verified
> Goal: Add stable user-facing quota reporting and operator-facing host-capacity reporting without conflating the two.
> Prerequisites: Phase 2 and Phase 3 complete

## Phase Intent

This phase exists to turn the now-live media visibility surfaces into understandable storage policy. It should expose user usage against a configured quota on `/my/media`, expose host-capacity state only in operator-only surfaces, and keep those two concepts separate in code, tests, and UI.

## Source Anchors To Refresh

- [../../../../compose.yaml](../../../../compose.yaml#L1)
- [../../../../src/lib/user-files.ts](../../../../src/lib/user-files.ts#L1)
- [../../../../src/lib/storage/media-storage-accounting.ts](../../../../src/lib/storage/media-storage-accounting.ts#L1)
- [../../../../src/lib/media/user-media.ts](../../../../src/lib/media/user-media.ts#L1)
- [../../../../src/components/media/UserMediaWorkspace.tsx](../../../../src/components/media/UserMediaWorkspace.tsx#L1)
- [../../../../src/app/my/media/page.tsx](../../../../src/app/my/media/page.tsx#L1)
- [../../../../src/lib/media/media-operations.ts](../../../../src/lib/media/media-operations.ts#L1)
- [../../../../src/components/media/MediaOperationsWorkspace.tsx](../../../../src/components/media/MediaOperationsWorkspace.tsx#L1)
- [../../../../src/app/operations/media/page.tsx](../../../../src/app/operations/media/page.tsx#L1)
- [../../../../src/app/api/chat/uploads/route.ts](../../../../src/app/api/chat/uploads/route.ts#L1)
- [../../../../src/app/admin/system/page.tsx](../../../../src/app/admin/system/page.tsx#L1)

## Current-State Questions

- Should the first host-capacity surface live on `/operations/media` now that the shared operator workspace exists, with `AdminSystemPage` as a secondary diagnostics fallback?
- Should quota remain display-only throughout this phase, leaving upload enforcement entirely to Phase 5?
- What configuration seam should own quota policy: env-backed defaults, a config file entry, or both behind one typed policy loader?
- How should unavailable filesystem-capacity results degrade in operator UI without looking like zero free space?

## Drift Traps

- Showing host free space on `/my/media` or any end-user surface.
- Hard-coding quota values directly into route or component code.
- Treating quota display as enforcement before `/api/chat/uploads` is explicitly wired for policy checks.
- Duplicating storage math in page loaders instead of composing the Phase 1 accounting layer.
- Assuming `fs.statfs` support without an explicit unavailable-state fallback.

## Pre-Implementation QA Gate

- [x] Refresh current diagnostics for upload, storage accounting, and operator media files.
- [x] Refresh the current user media, operator media, and upload-route tests.
- [x] Confirm the source anchors still reflect the writable storage volume and the actual operator surface.
- [x] Record exact verification commands for quota policy, capacity probe, and no-leak proof.
- [x] Update this packet's verified-state notes before writing the detailed plan.

## Verified Current State

### Current Code Notes

- `/my/media` remains the thin server page baseline through `src/app/my/media/page.tsx`, and `src/lib/media/user-media.ts` now composes both `getUserMediaStorageAccount()` and `buildMediaQuotaSnapshot()` so the user surface carries quota bytes, percent used, and warning or over-quota state without exposing host metrics.
- `/operations/media` remains the operator baseline through `src/app/operations/media/page.tsx`, and `src/lib/media/media-operations.ts` now composes both `getFleetMediaStorageAccount()` and `getMediaVolumeCapacity()` so the operator workspace shows host-capacity state separately from fleet media accounting.
- `src/lib/storage/media-storage-accounting.ts` already provides reusable fleet and user accounting plus DB-versus-disk reconciliation. Phase 4 should layer quota and capacity on top of those helpers rather than re-scan the filesystem from route code.
- `compose.yaml` confirms the app and media worker both mount `./.data:/app/.data` while otherwise running read-only, which keeps host-capacity reporting technically feasible and scoped to the real writable volume.
- `src/lib/user-files.ts` now resolves the writable data root through `DATA_DIR` before deriving `.data/user-files`, so the capacity probe and governed media paths share the same runtime base path.
- `/api/chat/uploads` currently validates file type and size, resolves the user, reaps stale unattached uploads, and persists files through `UserFileSystem`. It does not consult any quota policy yet and does not emit quota warnings or quota rejections.
- `src/app/admin/system/page.tsx` exists as an admin-only diagnostics surface, but there is no dedicated media capacity block there today. Because `/operations/media` now exists for `STAFF` and `ADMIN`, it is the more natural first operator surface for Phase 4 capacity visibility.
- `src/lib/storage/media-quota-policy.ts` and `src/lib/storage/volume-capacity.ts` now exist as the Phase 4 storage seams. The quota policy is env-configurable and typed, while the capacity probe is server-only and returns either an available or explicit unavailable state.

### Current QA Notes

- `npm exec vitest run 'src/app/my/media/page.test.tsx' 'src/components/media/UserMediaWorkspace.test.tsx' 'src/app/operations/media/page.test.tsx' 'src/components/media/MediaOperationsWorkspace.test.tsx' 'src/lib/storage/media-storage-accounting.test.ts' 'src/app/api/chat/uploads/route.test.ts'`
  - 6 files passed, 19 tests passed.
  - The reconciliation prerequisite is now clarified in `src/lib/storage/media-storage-accounting.test.ts`: `report.delta.files` measures net disk-versus-DB file-count difference, so a case with one missing DB-backed file and one disk-only orphan correctly reports `{ files: 0, bytes: -220 }` while the orphan counters still record the underlying drift.
- `npm exec vitest run 'src/lib/storage/media-quota-policy.test.ts' 'src/lib/storage/volume-capacity.test.ts' 'src/lib/media/user-media.test.ts' 'src/lib/media/media-operations.test.ts' 'src/app/my/media/page.test.tsx' 'src/components/media/UserMediaWorkspace.test.tsx' 'src/app/operations/media/page.test.tsx' 'src/components/media/MediaOperationsWorkspace.test.tsx'`
  - 8 files passed, 21 tests passed.
- `npm exec vitest run 'src/lib/user-files.test.ts' 'src/lib/storage/media-storage-accounting.test.ts' 'src/app/api/chat/uploads/route.test.ts'`
  - 3 files passed, 26 tests passed.
- `npm exec playwright test tests/browser-ui/media-capacity-quotas.spec.ts`
  - 1 file passed, proving `/my/media` shows quota messaging without host-capacity leakage and `/operations/media` shows writable-volume capacity for staff viewers.
- `npm exec eslint 'src/lib/user-files.ts' 'src/lib/storage/media-quota-policy.ts' 'src/lib/storage/media-quota-policy.test.ts' 'src/lib/storage/volume-capacity.ts' 'src/lib/storage/volume-capacity.test.ts' 'src/lib/media/user-media.ts' 'src/lib/media/user-media.test.ts' 'src/lib/media/media-operations.ts' 'src/lib/media/media-operations.test.ts' 'src/app/my/media/page.tsx' 'src/app/my/media/page.test.tsx' 'src/app/operations/media/page.tsx' 'src/app/operations/media/page.test.tsx' 'src/components/media/UserMediaWorkspace.tsx' 'src/components/media/UserMediaWorkspace.test.tsx' 'src/components/media/MediaOperationsWorkspace.tsx' 'src/components/media/MediaOperationsWorkspace.test.tsx'`
  - clean.
- There is currently no `src/app/admin/system/page.test.tsx`, so the earlier stub packet overstated the existing diagnostics-test surface.

## Suggested Verification Commands

```bash
npm exec vitest run 'src/app/my/media/page.test.tsx' 'src/components/media/UserMediaWorkspace.test.tsx' 'src/app/operations/media/page.test.tsx' 'src/components/media/MediaOperationsWorkspace.test.tsx' 'src/lib/storage/media-storage-accounting.test.ts' 'src/app/api/chat/uploads/route.test.ts'
npm exec eslint 'src/app/my/media/page.tsx' 'src/lib/media/user-media.ts' 'src/components/media/UserMediaWorkspace.tsx' 'src/app/operations/media/page.tsx' 'src/lib/media/media-operations.ts' 'src/components/media/MediaOperationsWorkspace.tsx' 'src/lib/storage/media-storage-accounting.ts' 'src/app/api/chat/uploads/route.ts' 'src/app/admin/system/page.tsx'
npm exec vitest run 'src/lib/storage/media-quota-policy.test.ts' 'src/lib/storage/volume-capacity.test.ts' 'src/app/my/media/page.test.tsx' 'src/components/media/UserMediaWorkspace.test.tsx' 'src/app/operations/media/page.test.tsx' 'src/components/media/MediaOperationsWorkspace.test.tsx'
npm exec playwright test tests/browser-ui/media-capacity-quotas.spec.ts
```

## Expected Evidence Artifacts

- A quota policy service with typed configuration and deterministic warning-state math.
- A server-only capacity probe with explicit unavailable-state behavior for the `.data` volume.
- Tests proving user surfaces never show host-capacity metrics.
- Operator UI proof for both available and unavailable host-capacity states.
- Storage-drift-aware proof that continues to respect the clarified net-delta reconciliation contract.

## Detailed Implementation Plan

1. Add `src/lib/storage/media-quota-policy.ts` as the single typed quota seam for route loaders, returning configured quota bytes, warning threshold, percent-used math, and whether the current phase is display-only versus enforcement-capable.
2. Extend `src/lib/media/user-media.ts` and `src/components/media/UserMediaWorkspace.tsx` to render quota-aware user usage from the existing `summary.totalBytes`, without exposing any host-volume metrics or inventing plan-management behavior.
3. Add `src/lib/storage/volume-capacity.ts` as a server-only helper that measures the backing `.data` volume via `fs.statfs`, and returns an explicit unavailable state when the platform cannot provide reliable capacity data.
4. Prefer `/operations/media` as the first operator-facing capacity surface because it is already the shared `STAFF` or `ADMIN` media workspace. Use `AdminSystemPage` only if a secondary diagnostics view is needed after the operator workflow is live.
5. Keep `/api/chat/uploads` display-only in this phase unless the refresh proves that a non-blocking policy hook is nearly free. Hard upload blocking should remain a Phase 5 concern.

## Scope Guardrails

- Do not expose host free space to end users.
- Do not move upload enforcement into this phase by accident.
- Do not bypass the existing accounting helpers with route-local storage scans.
- Do not anchor the plan to `profile` or other unrelated user surfaces now that `/my/media` exists.
- Do not treat display-only quota messaging as equivalent to upload enforcement.

## Implementation Record

- Date: 2026-04-15
- Files changed:
  - `src/lib/user-files.ts`
  - `src/lib/storage/media-quota-policy.ts`
  - `src/lib/storage/media-quota-policy.test.ts`
  - `src/lib/storage/volume-capacity.ts`
  - `src/lib/storage/volume-capacity.test.ts`
  - `src/lib/media/user-media.ts`
  - `src/lib/media/user-media.test.ts`
  - `src/lib/media/media-operations.ts`
  - `src/lib/media/media-operations.test.ts`
  - `src/app/my/media/page.tsx`
  - `src/app/my/media/page.test.tsx`
  - `src/app/operations/media/page.tsx`
  - `src/app/operations/media/page.test.tsx`
  - `src/components/media/UserMediaWorkspace.tsx`
  - `src/components/media/UserMediaWorkspace.test.tsx`
  - `src/components/media/MediaOperationsWorkspace.tsx`
  - `src/components/media/MediaOperationsWorkspace.test.tsx`
  - `tests/browser-ui/media-capacity-quotas.spec.ts`
  - `docs/content_strategy/media-platform-2026-04-15/phases/phase-4-capacity-and-quotas.md`
  - `docs/content_strategy/media-platform-2026-04-15/phases/status-board.md`
- Summary of what landed:
  - Added a typed, env-configurable quota policy seam and derived quota snapshots for the user media route.
  - Added a server-only writable-volume capacity probe with explicit unavailable-state handling.
  - Extended `/my/media` to show quota usage and warning or over-quota messaging without exposing host metrics.
  - Extended `/operations/media` to show writable-volume capacity without mixing host metrics into end-user surfaces.
  - Added focused tests for the quota service, capacity probe, user loader, operator loader, and both updated media workspaces.
- Deviations from the detailed plan:
  - Host-capacity visibility landed on `/operations/media` only in this slice; `AdminSystemPage` was intentionally left unchanged.
  - `/api/chat/uploads` remains untouched in this phase beyond existing prerequisite coverage, so quota stays display-only.

## Post-Implementation QA

- [x] Run targeted quota and capacity tests.
- [x] Run changed-file diagnostics.
- [x] Re-read the source anchors and confirm user and operator concerns remain separated.
- [x] Record whether the storage reconciliation delta contract was clarified or left unchanged.
- [x] Record residual risks around future enforcement and platform-capacity availability.

## Exit Criteria

- `/my/media` displays quota-based usage without showing host-capacity metrics.
- An operator-only surface displays host-capacity state when available and an explicit unavailable state when it is not.
- Quota and host capacity remain separated in code, tests, and UI.
- Phase 5 can consume the quota-policy seam for enforcement without reworking Phase 4 display contracts.

## Handoff

- What the next phase should now assume:
  - `/my/media` and `/operations/media` are already the canonical user and operator media surfaces.
  - Phase 1 accounting remains the basis for quota and capacity presentation work.
  - `src/lib/storage/media-quota-policy.ts` and `src/lib/storage/volume-capacity.ts` are now the canonical Phase 4 seams for user budgets and host-capacity reporting.
  - `/operations/media` is now the first shared operator capacity surface, not a widened `/admin` shell.
- What remains unresolved:
  - `/api/chat/uploads` still has no quota-policy hook.
  - There is still no dedicated admin-system diagnostics test surface, so any Phase 4 diagnostics-first slice should add that proof explicitly.
  - Browser proof is now focused rather than exhaustive; broader live coverage for warning and unavailable-capacity states is still open if Phase 5 needs it.
- What docs need updating:
  - Phase 5 should now reference the live quota-policy seam instead of describing quota as entirely pre-implementation.
