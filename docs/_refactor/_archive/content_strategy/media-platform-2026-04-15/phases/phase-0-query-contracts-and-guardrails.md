# Phase 0 — Query Contracts And Guardrails

> Status: Complete
> Loop State: Exit criteria verified
> Goal: Establish user-file listing, pagination, and summary contracts before any user or operator route work lands.
> Prerequisites: None

## Phase Intent

This phase is complete.

The `user_files` seam now has explicit browse and summary contracts before any route work lands. The repository surface is no longer limited to point lookup and cleanup behavior, the mapper now supports filtered browse plus aggregate summaries, and the chosen pagination and index strategy is written into the code rather than left implicit.

## Source Anchors To Refresh

- [../../../../src/core/use-cases/UserFileRepository.ts](../../../../src/core/use-cases/UserFileRepository.ts#L1)
- [../../../../src/adapters/UserFileDataMapper.ts](../../../../src/adapters/UserFileDataMapper.ts#L1)
- [../../../../src/adapters/UserFileDataMapper.test.ts](../../../../src/adapters/UserFileDataMapper.test.ts#L1)
- [../../../../src/lib/db/tables.ts](../../../../src/lib/db/tables.ts#L267)
- [../../../../src/lib/db/migrations.ts](../../../../src/lib/db/migrations.ts#L111)
- [../../../../tests/solid-architecture-audit.test.ts](../../../../tests/solid-architecture-audit.test.ts#L1)
- [../../../../tests/architecture-cohesion-audit.test.ts](../../../../tests/architecture-cohesion-audit.test.ts#L1)

## Current-State Questions

- What pagination strategy best fits the current SQLite-backed `user_files` table?
- Which user and admin query surfaces are missing from `UserFileRepository` today?
- Are the existing `user_files` indexes sufficient for filtered list surfaces?
- Which architecture-audit patterns already exist that this subsystem should mirror?

## Drift Traps

- Solving route needs by loading all files into memory and filtering in page code.
- Adding broad admin-query helpers without defining a user-scoped equivalent first.
- Introducing metadata parsing logic in more than one layer.
- Promoting schema columns before proving the query pressure that requires them.

## Pre-Implementation QA Gate

- [x] Refresh current diagnostics for repository, mapper, and DB files.
- [x] Refresh current `UserFileDataMapper` tests and baseline results.
- [x] Confirm the listed source anchors are still the correct seam for query and index work.
- [x] Record exact verification commands for mapper, diagnostics, and architecture checks.
- [x] Update this packet's verified-state notes before writing the detailed plan.

## Verified Current State

Fill this section in at phase start.

### Current Code Notes

- [../../../../src/core/use-cases/UserFileRepository.ts](../../../../src/core/use-cases/UserFileRepository.ts#L1) now exposes the Phase 0 browse seams: `listForUser`, `getUserStorageSummary`, `listForAdmin`, `countForAdmin`, `getFleetStorageSummary`, and `listLargestUsersByStorage`, while preserving the older point-lookup and cleanup primitives for existing callers.
- [../../../../src/core/entities/user-file-query.ts](../../../../src/core/entities/user-file-query.ts#L1) and [../../../../src/core/entities/user-file-storage.ts](../../../../src/core/entities/user-file-storage.ts#L1) now hold the route-ready query and aggregate contracts outside the route layer. This keeps loader and mapper work type-safe without pushing browse concerns into page files.
- [../../../../src/adapters/UserFileDataMapper.ts](../../../../src/adapters/UserFileDataMapper.ts#L1) now implements filtered user browse queries with cursor pagination, admin inventory listing plus count, user storage summary, fleet storage summary, and largest-user aggregation. Browse ordering is now explicitly `datetime(created_at) DESC, id DESC`.
- Media metadata is still JSON-backed in this phase. The mapper uses SQL only for filtering and totals while keeping metadata normalization centralized through `buildUserFileMetadata()`. This preserves a single canonical parser and defers schema promotion until the operator query phase can justify it.
- [../../../../src/lib/db/tables.ts](../../../../src/lib/db/tables.ts#L267) and [../../../../src/lib/db/migrations.ts](../../../../src/lib/db/migrations.ts#L153) now both define the browse-oriented indexes `idx_uf_user_created_id` and `idx_uf_created_id`. That gives user browse and global inventory queries explicit index support without promoting metadata columns prematurely.
- The current table shape still does not justify promoting `retentionClass`, `assetSource`, or `derivativeOfAssetId` out of JSON in Phase 0. The browse seam is now strong enough to support Phase 1 accounting and Phase 2 route work without that schema expansion.

### Current QA Notes

- Changed-file diagnostics for [../../../../src/core/use-cases/UserFileRepository.ts](../../../../src/core/use-cases/UserFileRepository.ts#L1), [../../../../src/adapters/UserFileDataMapper.ts](../../../../src/adapters/UserFileDataMapper.ts#L1), [../../../../src/lib/db/tables.ts](../../../../src/lib/db/tables.ts#L267), and [../../../../src/lib/db/migrations.ts](../../../../src/lib/db/migrations.ts#L111) are clean.
- Focused mapper and filesystem baseline now passes through `npm exec vitest run src/adapters/UserFileDataMapper.test.ts src/lib/user-files.test.ts`: 2 files passed, 31 tests passed.
- Changed-file lint baseline passed through `npm exec eslint src/core/entities/user-file.ts src/core/entities/user-file-query.ts src/core/entities/user-file-storage.ts src/core/use-cases/UserFileRepository.ts src/adapters/UserFileDataMapper.ts src/adapters/UserFileDataMapper.test.ts src/lib/db/tables.ts src/lib/db/migrations.ts` with no output.
- The broader architecture-audit baseline passed cleanly through `npm exec vitest run tests/solid-architecture-audit.test.ts tests/architecture-cohesion-audit.test.ts`: 2 files passed, 59 tests passed.
- The mapper test suite now covers lifecycle, `findByHash`, existing cleanup selection, metadata JSON round-trip, user cursor pagination with a created-at plus id tie-break, typed filter application, user storage summary, admin inventory listing plus count, fleet storage summary, and largest-user aggregation.
- The architecture-audit runs remain useful signal for the phase even when green: they show the repo already uses audit-style tests as architectural enforcement, but it still has no media-specific audit coverage. That remains a known Phase 5 hardening item rather than a Phase 0 blocker.

## Suggested Verification Commands

```bash
npm exec vitest run src/adapters/UserFileDataMapper.test.ts src/lib/user-files.test.ts
npm exec eslint src/core/entities/user-file.ts src/core/entities/user-file-query.ts src/core/entities/user-file-storage.ts src/core/use-cases/UserFileRepository.ts src/adapters/UserFileDataMapper.ts src/adapters/UserFileDataMapper.test.ts src/lib/db/tables.ts src/lib/db/migrations.ts
npm exec vitest run tests/solid-architecture-audit.test.ts tests/architecture-cohesion-audit.test.ts
```

## Expected Evidence Artifacts

- A contract table for new `UserFileRepository` list, count, and summary methods.
- A recorded pagination decision with ordering and cursor rules.
- An index decision note for `user_files` list performance.
- Mapper tests proving stable ordering, filtered browse behavior, and aggregate summaries.

## Detailed Implementation Plan

1. Add explicit query and summary types before changing the repository contract.
   - Introduce typed filter and result shapes for user browse queries, admin inventory queries, and storage summaries.
   - Keep these types out of route modules so they can be shared by loaders and mapper tests.
2. Extend `UserFileRepository` with route-ready browse and summary seams.
   - Add filtered user listing with stable pagination.
   - Add user storage summary.
   - Add admin list, count, and fleet summary seams.
   - Keep existing point-lookup and cleanup methods intact so no current caller regresses.
3. Implement the new seams in [../../../../src/adapters/UserFileDataMapper.ts](../../../../src/adapters/UserFileDataMapper.ts#L1) using SQL-backed list, count, and aggregate queries.
   - Use `(created_at DESC, id DESC)` as the canonical browse ordering.
   - Preserve media metadata normalization through `buildUserFileMetadata()` and avoid ad hoc JSON parsing in route-facing code.
   - Keep metadata promotion out of scope unless the query implementation proves it is already unavoidable.
4. Add browse-oriented indexes and document the decision in this packet.
   - Add a user browse index compatible with the chosen pagination order.
   - Add an admin inventory index compatible with global browse ordering.
   - Record why the chosen indexes are enough for Phase 0 and why metadata-promotion indexes are deferred.
5. Expand the mapper test suite to cover the new browse contract.
   - Add pagination tests with same-timestamp rows to prove the `id` tie-breaker.
   - Add filtered-list tests for user and admin surfaces.
   - Add aggregate tests for user totals and fleet totals.
6. Leave architecture-audit expansion for Phase 5, but note the gap now.
   - Phase 0 should record that no media-specific audit currently prevents route-level filtering or DB shortcuts.
   - That gap becomes a planned hardening item later rather than a hidden assumption.

## Scope Guardrails

- Do not build `/my/media` yet.
- Do not promote metadata out of JSON in this phase unless the refresh proves it is immediately required.

## Implementation Record

- Date: 2026-04-15
- Files changed: [../../../../src/core/entities/user-file.ts](../../../../src/core/entities/user-file.ts#L1), [../../../../src/core/entities/user-file-query.ts](../../../../src/core/entities/user-file-query.ts#L1), [../../../../src/core/entities/user-file-storage.ts](../../../../src/core/entities/user-file-storage.ts#L1), [../../../../src/core/use-cases/UserFileRepository.ts](../../../../src/core/use-cases/UserFileRepository.ts#L1), [../../../../src/adapters/UserFileDataMapper.ts](../../../../src/adapters/UserFileDataMapper.ts#L1), [../../../../src/adapters/UserFileDataMapper.test.ts](../../../../src/adapters/UserFileDataMapper.test.ts#L1), [../../../../src/lib/db/tables.ts](../../../../src/lib/db/tables.ts#L267), [../../../../src/lib/db/migrations.ts](../../../../src/lib/db/migrations.ts#L153), this packet, and the media phase status board.
- Summary of what landed: Added explicit user-file browse and storage-summary types, extended `UserFileRepository` with filtered list plus aggregate seams, implemented those seams in `UserFileDataMapper`, added browse-oriented indexes for user and admin ordering, and expanded the mapper tests to prove cursor pagination, typed filters, user summaries, admin inventory browsing, fleet totals, and leaderboard aggregation.
- Deviations from the detailed plan: none. The phase landed the full contract, index, and mapper-test slice without needing metadata promotion.

## Post-Implementation QA

- [x] Run targeted mapper tests.
- [x] Run changed-file diagnostics.
- [x] Re-read the source anchors and confirm the intended query seam changed.
- [x] Record residual risks and any still-open performance concerns.

## Exit Criteria

- `UserFileRepository` exposes explicit filtered list and summary seams.
- `UserFileDataMapper` proves stable ordering, pagination, and totals through tests.
- The chosen pagination and index strategy is documented in this packet.

## Handoff

- What the next phase should now assume: user browse, admin browse, user summary, fleet summary, and leaderboard seams already exist at the repository layer; the canonical browse ordering is `(created_at DESC, id DESC)`; and `user_files` now has explicit browse-oriented indexes for both user and global inventory queries.
- What remains unresolved: metadata is still JSON-backed, so richer grouped accounting by source or retention and stronger derivative-aware query behavior remain later-phase work.
- What docs need updating: [status-board.md](./status-board.md) and [../implementation-roadmap.md](../implementation-roadmap.md) only if a later phase materially changes the browse-contract or schema-promotion assumptions.
