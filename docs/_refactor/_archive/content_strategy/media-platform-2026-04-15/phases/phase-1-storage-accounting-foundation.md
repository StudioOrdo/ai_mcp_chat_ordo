# Phase 1 — Storage Accounting Foundation

> Status: Complete
> Loop State: Exit criteria verified
> Goal: Turn persisted `user_files` state into reusable user and fleet storage summaries plus a reconciliation path.
> Prerequisites: Phase 0 complete

## Phase Intent

This phase exists to keep both product and operator surfaces honest. It should create one accounting layer for bytes, counts, and grouped totals so later routes do not invent their own SQL aggregates or walk the filesystem during request handling.

This phase is complete.

The storage-accounting layer now exists as a reusable service module rather than a route-local query pattern. User and fleet storage totals can be consumed from one canonical seam, grouped source and retention accounting reuses the existing media projection defaults, and operators now have a scriptable reconciliation command that compares DB-backed inventory with `.data/user-files` disk state without doing request-time scans.

## Source Anchors To Refresh

- [../../../../src/adapters/UserFileDataMapper.ts](../../../../src/adapters/UserFileDataMapper.ts#L1)
- [../../../../src/adapters/UserFileDataMapper.test.ts](../../../../src/adapters/UserFileDataMapper.test.ts#L1)
- [../../../../src/lib/media/media-asset-projection.ts](../../../../src/lib/media/media-asset-projection.ts#L1)
- [../../../../src/core/entities/user-file.ts](../../../../src/core/entities/user-file.ts#L1)
- [../../../../src/lib/user-files.ts](../../../../src/lib/user-files.ts#L1)
- [../../../../compose.yaml](../../../../compose.yaml#L1)

## Current-State Questions

- Which summary shapes should be domain types versus view-model types?
- Can retention and source grouping stay JSON-backed in this phase?
- What should the reconciliation script report as canonical evidence?
- Which parts of media metadata already normalize through `media-asset-projection` and should be reused directly?

## Drift Traps

- Re-parsing raw `metadata_json` differently in multiple loaders.
- Performing disk scans in routes instead of scripts or diagnostics.
- Returning anonymous summary blobs with no reusable type contract.
- Mixing route-facing formatting logic into mapper code.

## Pre-Implementation QA Gate

- [ ] Refresh current diagnostics for accounting-related files.
- [ ] Refresh current mapper and media-metadata tests.
- [ ] Confirm the source anchors still represent the canonical media metadata seam.
- [ ] Record exact verification commands for accounting and reconciliation proof.
- [ ] Update this packet's verified-state notes before writing the detailed plan.

## Verified Current State

Phase 1 was refreshed against the implemented storage-accounting code and verification bundle.

### Current Code Notes

- [../../../../src/lib/storage/media-storage-accounting.ts](../../../../src/lib/storage/media-storage-accounting.ts#L1) is now the canonical accounting seam for this workstream. It wraps the repository totals added in Phase 0, exposes `getUserMediaStorageAccount`, `getFleetMediaStorageAccount`, `reconcileMediaStorage`, and keeps top-user plus top-file-type ranking logic out of routes.
- The accounting layer reuses [../../../../src/lib/media/media-asset-projection.ts](../../../../src/lib/media/media-asset-projection.ts#L1) through `resolveUserFileSource()` and `resolveUserFileRetentionClass()`. Grouped totals by source and retention therefore inherit the existing canonical media defaults instead of re-parsing `metadata_json` differently in each caller.
- [../../../../src/core/entities/user-file-storage.ts](../../../../src/core/entities/user-file-storage.ts#L1) now serves as the reusable domain contract for user and fleet totals, including grouped `byType`, `byRetentionClass`, and `bySource` buckets. The accounting module adds operator-facing envelope types on top of those domain summaries rather than creating route-shaped blobs.
- [../../../../src/lib/user-files.ts](../../../../src/lib/user-files.ts#L1) now exports `getUserFilesRootPath()` so both application code and diagnostics resolve the same governed storage root. The reconciliation path stays aligned with the real storage location instead of duplicating path logic in scripts.
- [../../../../scripts/report-media-storage.ts](../../../../scripts/report-media-storage.ts#L1) is the script entrypoint for operator evidence. It uses [../../../../src/adapters/RepositoryFactory.ts](../../../../src/adapters/RepositoryFactory.ts#L1) and the shared accounting module rather than opening a custom DB connection or performing ad hoc aggregation in the script layer.
- [../../../../compose.yaml](../../../../compose.yaml#L1) still mounts `./.data` into `/app/.data` for both the app and media-worker containers, so the reconciliation command and the live runtime both point at the same governed on-disk asset root.

### Current QA Notes

- Changed-file diagnostics for [../../../../src/lib/storage/media-storage-accounting.ts](../../../../src/lib/storage/media-storage-accounting.ts#L1), [../../../../src/lib/storage/media-storage-accounting.test.ts](../../../../src/lib/storage/media-storage-accounting.test.ts#L1), and [../../../../scripts/report-media-storage.ts](../../../../scripts/report-media-storage.ts#L1) are clean.
- Focused accounting and supporting-seam verification passed through `npm exec vitest run src/lib/storage/media-storage-accounting.test.ts src/lib/media/media-asset-projection.test.ts src/adapters/UserFileDataMapper.test.ts src/lib/user-files.test.ts`: 4 files passed, 42 tests passed.
- Changed-file lint baseline passed through `npm exec eslint src/lib/storage/media-storage-accounting.ts src/lib/storage/media-storage-accounting.test.ts src/lib/media/media-asset-projection.ts src/lib/media/media-asset-projection.test.ts src/lib/user-files.ts scripts/report-media-storage.ts` with no output.
- The architecture-audit baseline passed through `npm exec vitest run tests/solid-architecture-audit.test.ts tests/architecture-cohesion-audit.test.ts`: 2 files passed, 59 tests passed.
- The reconciliation command now runs end-to-end through `npm exec tsx scripts/report-media-storage.ts` and emits a JSON report rather than throwing. In the current workspace it surfaced real drift signal rather than code failure: no DB rows are missing on disk, but the disk inventory contains 34 disk-only files totaling 23,004,219 bytes, with an aggregate delta of 31 files and 20,729,499 bytes beyond DB totals.

## Suggested Verification Commands

```bash
npm exec vitest run src/adapters/UserFileDataMapper.test.ts src/lib/media/media-asset-projection.test.ts src/lib/user-files.test.ts
npm exec vitest run src/lib/storage/media-storage-accounting.test.ts src/lib/media/media-asset-projection.test.ts src/adapters/UserFileDataMapper.test.ts src/lib/user-files.test.ts
npm exec eslint src/lib/storage/media-storage-accounting.ts src/lib/storage/media-storage-accounting.test.ts src/lib/media/media-asset-projection.ts src/lib/media/media-asset-projection.test.ts src/lib/user-files.ts scripts/report-media-storage.ts
npm exec tsx scripts/report-media-storage.ts
npm exec vitest run tests/solid-architecture-audit.test.ts tests/architecture-cohesion-audit.test.ts
```

## Expected Evidence Artifacts

- Domain types for user and fleet storage summaries.
- Mapper-backed grouped totals for files and bytes.
- A reconciliation command or script that compares DB totals to `.data/user-files` disk totals.
- Tests covering mixed file types, mixed retention states, and unattached versus attached assets.

## Detailed Implementation Plan

1. Add summary facades on top of the Phase 0 repository seams. Complete: [../../../../src/lib/storage/media-storage-accounting.ts](../../../../src/lib/storage/media-storage-accounting.ts#L1) now wraps repository totals into reusable user, fleet, ranking, and reconciliation surfaces.
2. Reuse canonical media metadata normalization for grouping and fallback behavior. Complete: source and retention grouping now flow through [../../../../src/lib/media/media-asset-projection.ts](../../../../src/lib/media/media-asset-projection.ts#L1) helpers instead of route-local JSON parsing.
3. Add a disk reconciliation script for operator evidence. Complete: [../../../../scripts/report-media-storage.ts](../../../../scripts/report-media-storage.ts#L1) now produces the reconciliation report directly from the shared accounting seam.

## Scope Guardrails

- Do not build route UI yet.
- Do not expose host free space yet.

## Implementation Record

- Date: 2026-04-15
- Files changed: [../../../../src/lib/storage/media-storage-accounting.ts](../../../../src/lib/storage/media-storage-accounting.ts#L1), [../../../../src/lib/storage/media-storage-accounting.test.ts](../../../../src/lib/storage/media-storage-accounting.test.ts#L1), [../../../../src/lib/media/media-asset-projection.ts](../../../../src/lib/media/media-asset-projection.ts#L1), [../../../../src/lib/media/media-asset-projection.test.ts](../../../../src/lib/media/media-asset-projection.test.ts#L1), [../../../../src/lib/user-files.ts](../../../../src/lib/user-files.ts#L1), [../../../../scripts/report-media-storage.ts](../../../../scripts/report-media-storage.ts#L1), this packet, and the media phase status board.
- Summary of what landed: Added a shared media storage accounting module with reusable user and fleet totals, grouped source and retention accounting, ranking helpers, and disk reconciliation; exported the governed user-files root for shared path resolution; added focused accounting tests; and added an operator script entrypoint that emits reconciliation evidence using the normal repository factory.
- Deviations from the detailed plan: none. The phase stayed inside the planned accounting and reconciliation scope and did not widen into route UI or host-capacity work.

## Post-Implementation QA

- [x] Run targeted accounting tests.
- [x] Run changed-file diagnostics.
- [x] Re-read the source anchors and confirm accounting now flows through one canonical seam.
- [x] Record residual risks and any schema pressure discovered.

## Exit Criteria

- User and fleet storage summaries are reusable and test-backed.
- Grouped totals for files and bytes exist without route-level SQL duplication.
- A reconciliation path exists for DB totals versus disk totals.

## Handoff

- What the next phase should now assume: user and fleet storage summaries are available through a shared service module, grouped source and retention accounting already reuse the canonical projection defaults, and operators have a scriptable reconciliation report for the governed media store.
- What remains unresolved: the current workspace already shows disk-only drift in `.data/user-files`, but Phase 1 intentionally reports that condition rather than auto-remediating it; host free-space reporting and quota policy are still later-phase work.
- What docs need updating: [status-board.md](./status-board.md) whenever Phase 2 begins, plus [../implementation-roadmap.md](../implementation-roadmap.md) only if later phases materially change how accounting or reconciliation are sourced.
