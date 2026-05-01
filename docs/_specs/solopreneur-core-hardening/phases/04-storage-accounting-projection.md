# Phase 04 - Storage Accounting Projection

## Objective
Add explicit media usage projections so quota checks and media workspaces do not rely on repeated aggregate scans as media volume grows.

## Current Code Grounding
- `src/adapters/UserFileDataMapper.ts#getUserStorageSummary` aggregates `user_files` by user, type, retention class, and source.
- `src/lib/user-files.ts` uses this summary during upload/quota decisions.
- `src/lib/storage/media-quota-policy.ts` converts storage usage into quota state.

## Architecture
- Projection pattern: maintain `user_storage_usage` and `user_storage_usage_breakdowns` from media write operations.
- Unit of Work: update files and storage projections inside the same repository transaction.
- Reconciliation command: provide a deterministic rebuild/check path for projection integrity.
- Explicit schema over JSON blobs: bounded dimensions get normalized rows.

## Implementation Steps
1. Add storage usage projection tables and indexes.
2. Add projection update helpers in the user-file repository boundary.
3. Update create/delete/reassign paths to maintain projections transactionally.
4. Switch `getUserStorageSummary` to projection reads.
5. Keep a rebuild/reconcile helper for tests and admin repair.

## Cleanup
- Do not use hidden SQLite triggers as the only accounting authority.
- Do not store primary breakdowns as JSON blobs.
- Remove aggregate-query product paths after projection reads are covered.

## Tests
- Positive: successful upload batch increments totals and breakdowns atomically.
- Positive: generated media materialization increments generated/source buckets.
- Negative: failed upload leaves files and usage unchanged.
- Negative: hard quota rejection leaves projection unchanged.
- Edge: deleting or reassigning a file updates old buckets correctly.
- Edge: reconciliation rebuild matches projection rows after mixed operations.

## Done Criteria
- Quota and media workspace summary reads are projection-backed.
- Projection integrity tests cover positive, negative, and edge cases.
- Existing upload/quota browser and unit tests remain green.
