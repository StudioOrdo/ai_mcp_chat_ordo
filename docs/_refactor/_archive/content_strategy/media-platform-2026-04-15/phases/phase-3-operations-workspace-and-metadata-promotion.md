# Phase 3 — Operations Workspace And Metadata Promotion

> Status: Complete
> Loop State: Exit criteria verified
> Goal: Add a staff or admin media operations workspace and make an explicit metadata-promotion decision for operator-scale queries.
> Prerequisites: Phase 2 complete

## Phase Intent

This phase exists to give operators a first-class media inventory surface without compromising the current admin RBAC model. It should also decide, from verified query pressure, whether `retentionClass`, `assetSource`, and `derivativeOfAssetId` should be promoted out of JSON into indexed columns.

## Source Anchors To Refresh

- [../../../../src/app/admin/layout.tsx](../../../../src/app/admin/layout.tsx#L1)
- [../../../../src/app/my/media/page.tsx](../../../../src/app/my/media/page.tsx#L1)
- [../../../../src/lib/media/user-media.ts](../../../../src/lib/media/user-media.ts#L1)
- [../../../../src/lib/storage/media-storage-accounting.ts](../../../../src/lib/storage/media-storage-accounting.ts#L1)
- [../../../../src/lib/journal/admin-journal.ts](../../../../src/lib/journal/admin-journal.ts#L1)
- [../../../../src/lib/journal/admin-journal.test.ts](../../../../src/lib/journal/admin-journal.test.ts#L1)
- [../../../../src/app/admin/journal/page.tsx](../../../../src/app/admin/journal/page.tsx#L1)
- [../../../../src/app/admin/journal/page.test.tsx](../../../../src/app/admin/journal/page.test.tsx#L1)
- [../../../../src/lib/shell/shell-navigation.ts](../../../../src/lib/shell/shell-navigation.ts#L1)
- [../../../../src/adapters/UserFileDataMapper.ts](../../../../src/adapters/UserFileDataMapper.ts#L1)
- [../../../../src/lib/db/tables.ts](../../../../src/lib/db/tables.ts#L267)
- [../../../../src/lib/db/migrations.ts](../../../../src/lib/db/migrations.ts#L111)

## Current-State Questions

- Should the shared workspace live under `/operations` or should an admin-only first slice land under `/admin`?
- Which metadata queries are still acceptable against JSON and which are not?
- What should the canonical shared access helper look like for an operations shell?
- Which existing admin workspace patterns can be reused without inheriting admin-only layout assumptions?

## Drift Traps

- Weakening `requireAdminPageAccess()` or the `/admin` shell to satisfy staff access.
- Promoting metadata columns before proving their operator-query need.
- Reusing admin components mechanically without respecting the different access and product posture of the operations workspace.
- Letting the operator workspace duplicate user-facing logic rather than composing shared loaders and presentation primitives.

## Pre-Implementation QA Gate

- [x] Refresh current diagnostics for admin-layout, RBAC, and mapper files.
- [x] Refresh current journal workspace and admin RBAC tests.
- [x] Confirm the source anchors still represent the best shared-workspace pattern.
- [x] Record exact verification commands for access, operator route behavior, and schema-migration proof.
- [x] Update this packet's verified-state notes before writing the detailed plan.

## Verified Current State

### Current Code Notes

- `src/app/operations/layout.tsx` and `src/app/operations/media/page.tsx` now establish the first shared operations media surface outside the admin-only shell.
- `src/lib/operations/operations-access.ts` now provides a dedicated `requireOperationsWorkspaceAccess()` seam for `STAFF` and `ADMIN`, preserving the existing `/admin` boundary.
- The best live access precedent is the journal split in `src/lib/journal/admin-journal.ts`: `requireJournalWorkspaceAccess()` allows `STAFF` and `ADMIN`, while `requireAdminPageAccess()` keeps `/admin` pages admin-only.
- The current `/admin` shell in `src/app/admin/layout.tsx` remains hard-gated by `requireAdminPageAccess()`. That shell must not be widened just to land media operations.
- Phase 0 and Phase 1 already provide the media seams Phase 3 should compose rather than reimplement: `listForAdmin`, `countForAdmin`, `getFleetStorageSummary`, `listLargestUsersByStorage`, and `getFleetMediaStorageAccount()`.
- Phase 2 remains the direct server-first precedent for thin pages and loader-owned media view models through `src/app/my/media/page.tsx` and `src/lib/media/user-media.ts`.
- `src/lib/media/media-operations.ts` now composes the existing admin-wide query contract and accounting layer rather than introducing route-local scans or a second preview endpoint.
- Metadata promotion is still not justified by the current schema. Phase 3 explicitly records a no-promotion decision for now: `retentionClass` and `source` remain derived from `metadata_json` via SQL expressions in `src/adapters/UserFileDataMapper.ts`, and there are still no dedicated promoted columns or indexes for those fields in `src/lib/db/tables.ts` or `src/lib/db/migrations.ts`.
- The older media operations spec under `docs/_refactor/media/specs/media-operations-workspace.md` has now been realigned with the live Phase 0 to Phase 2 seams and can be treated as supporting background rather than conflicting guidance.

### Current QA Notes

- `npm exec vitest run 'src/lib/operations/operations-access.test.ts' 'src/lib/media/media-operations.test.ts' 'src/components/media/MediaOperationsWorkspace.test.tsx' 'src/app/operations/media/page.test.tsx' 'src/lib/shell/shell-navigation.test.ts'`
  - 5 files passed, 19 tests passed.
- `npm exec eslint 'src/lib/operations/operations-access.ts' 'src/lib/operations/operations-access.test.ts' 'src/lib/media/media-operations.ts' 'src/lib/media/media-operations.test.ts' 'src/components/media/MediaOperationsWorkspace.tsx' 'src/components/media/MediaOperationsWorkspace.test.tsx' 'src/app/operations/layout.tsx' 'src/app/operations/media/page.tsx' 'src/app/operations/media/page.test.tsx' 'src/lib/shell/shell-navigation.ts' 'src/lib/shell/shell-navigation.test.ts'`
  - clean.
- `npm exec playwright test tests/browser-ui/operations-media.spec.ts`
  - 1 file passed, proving `STAFF` users can open `/operations/media` while conversation detail remains hidden, and `ADMIN` users see the `/admin/conversations/[id]` deep link for the same governed asset.

## Suggested Verification Commands

```bash
npm exec vitest run 'src/lib/journal/admin-journal.test.ts' 'src/app/admin/journal/page.test.tsx' 'src/adapters/UserFileDataMapper.test.ts' 'src/lib/storage/media-storage-accounting.test.ts' 'src/app/my/media/page.test.tsx' 'src/lib/shell/shell-navigation.test.ts'
npm exec eslint 'src/app/admin/layout.tsx' 'src/app/admin/journal/page.tsx' 'src/lib/journal/admin-journal.ts' 'src/adapters/UserFileDataMapper.ts' 'src/lib/storage/media-storage-accounting.ts' 'src/app/my/media/page.tsx' 'src/lib/media/user-media.ts' 'src/lib/shell/shell-navigation.ts'
npm exec vitest run 'src/app/operations/media/page.test.tsx' 'src/lib/media/media-operations.test.ts' 'src/lib/operations/operations-access.test.ts'
npm exec eslint 'src/app/operations/layout.tsx' 'src/app/operations/media/page.tsx' 'src/lib/operations/operations-access.ts' 'src/lib/media/media-operations.ts' 'src/lib/db/migrations.ts' 'src/lib/db/tables.ts'
npm exec playwright test tests/browser-ui/operations-media.spec.ts
```

## Expected Evidence Artifacts

- A dedicated shared operations access helper and route shell.
- A decision record on metadata promotion with concrete query justification.
- Operator inventory tests proving staff or admin access without weakening existing `/admin` boundaries.
- Schema migration notes only if metadata promotion is actually justified.

## Detailed Implementation Plan

1. Extract or add a dedicated `requireOperationsWorkspaceAccess()` seam that mirrors the journal workspace split for `STAFF` and `ADMIN` without touching `requireAdminPageAccess()` or the `/admin` layout.
2. Build `/operations/media` as a thin server page with a route-owned loader and workspace, reusing `listForAdmin`, `countForAdmin`, `getFleetMediaStorageAccount()`, and the governed asset-delivery route instead of adding route-local scans or preview endpoints.
3. Add operator-facing filters and summaries only where the current contracts already support them, and record any missing query pressure before changing the schema.
4. Promote metadata columns only if focused operator queries show that repeated JSON extraction is materially limiting correctness, indexing, or route performance.

## Scope Guardrails

- Do not weaken the current `/admin` shell.
- Do not reimplement Phase 2 user-media logic inside the operator route when the existing loader, accounting, and delivery seams can be composed.
- Do not bundle quota or host-capacity behavior into this phase unless the refresh shows unavoidable coupling.

## Implementation Record

- Date: 2026-04-15
- Files changed:
  - `docs/_refactor/media/specs/media-operations-workspace.md`
  - `src/lib/operations/operations-access.ts`
  - `src/lib/operations/operations-access.test.ts`
  - `src/lib/media/media-operations.ts`
  - `src/lib/media/media-operations.test.ts`
  - `src/components/media/MediaOperationsWorkspace.tsx`
  - `src/components/media/MediaOperationsWorkspace.test.tsx`
  - `src/app/operations/layout.tsx`
  - `src/app/operations/media/page.tsx`
  - `src/app/operations/media/page.test.tsx`
  - `src/lib/shell/shell-navigation.ts`
  - `src/lib/shell/shell-navigation.test.ts`
  - `docs/content_strategy/media-platform-2026-04-15/phases/phase-3-operations-workspace-and-metadata-promotion.md`
  - `docs/content_strategy/media-platform-2026-04-15/phases/status-board.md`
- Summary of what landed:
  - Aligned the older media operations spec with the already-landed Phase 0 to Phase 2 architecture before writing code.
  - Added a dedicated operations access helper and route shell so `STAFF` and `ADMIN` can open `/operations/media` without widening `/admin`.
  - Added an operations media loader and route-owned workspace that reuse the existing admin-wide media contracts, Phase 1 accounting layer, and governed asset route.
  - Added shell navigation exposure for the new operations media surface.
  - Recorded the explicit schema decision for this phase: keep metadata-derived filtering on `metadata_json` for now rather than promoting new indexed columns prematurely.
- Deviations from the detailed plan:
  - No metadata-promotion migration landed because the current query pressure did not justify schema expansion yet.
  - Browser proof now covers both role-sensitive conversation-link visibility and a combined-filter pagination flow on `/operations/media`.

## Post-Implementation QA

- [x] Run targeted RBAC, mapper, and operator-route prerequisite tests.
- [x] Run changed-file diagnostics on the current access and media seams.
- [x] Re-read the source anchors and confirm `/admin` access rules remain intact.
- [x] Record residual risks and remaining schema pressure.

## Exit Criteria

- A staff or admin workspace exists without weakening `/admin`.
- Operator inventory and summary queries are test-backed.
- The metadata-promotion decision is explicitly recorded and justified.

## Handoff

- What the next phase should now assume:
  - `/operations/media` now exists as the operator-facing baseline and already composes the admin-wide browse and accounting seams.
  - The safest access model remains a dedicated operations helper modeled on `requireJournalWorkspaceAccess()`, not a widened `/admin` shell.
  - `/my/media` and `/operations/media` now form the paired user and operator precedents for thin page plus loader plus route-owned media workspace composition.
- What remains unresolved:
  - Metadata promotion remains intentionally deferred. If future operator filters or performance needs outgrow the current JSON-derived expressions, Phase 4 or a follow-on refactor should reopen that decision with evidence.
  - Staff viewers still do not have a shared conversation detail route, so source conversation deep links remain admin-only.
  - The browser proof is still intentionally focused on `/operations/media`, but it now covers both role-sensitive access behavior and stable multi-filter pagination across page transitions.
- What docs need updating:
  - Phase 4 can now reference `/operations/media` as the operator-facing baseline when layering quota and capacity visibility.
