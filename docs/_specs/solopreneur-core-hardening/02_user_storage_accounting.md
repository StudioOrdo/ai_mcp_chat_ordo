# User Storage Accounting Projection

## Status
- **Disposition**: Keep, rewritten.
- **Priority**: High when media volume grows or hard quotas are enforced.
- **Layer**: Persistence / Media Asset Pipeline.
- **Reviewed**: 2026-05-01.

## Current Code Grounding
- `src/adapters/UserFileDataMapper.ts#getUserStorageSummary` still computes one user summary with aggregate queries over `user_files`.
- `src/adapters/UserFileDataMapper.ts#getFleetStorageSummary` computes fleet/admin summaries with aggregate queries and optional filters.
- `src/lib/user-files.ts` and `src/lib/storage/media-quota-policy.ts` already use the repository summary to enforce/upload-report quota state.
- Current tests cover quota behavior and accounting correctness in `src/adapters/UserFileDataMapper.test.ts`, `src/lib/user-files.test.ts`, and `src/lib/storage/media-storage-accounting.test.ts`.

## Verdict
The old finding was directionally valid but too trigger-heavy and too JSON-blob oriented. For this greenfield system, the better design is a canonical storage usage projection maintained by the media write path, not ad hoc database triggers that hide accounting behavior from the domain layer.

## Target Architecture
- Add a `user_storage_usage` projection table with one row per user and explicit scalar columns:
  - `user_id`
  - `total_files`
  - `total_bytes`
  - `attached_files`
  - `attached_bytes`
  - `unattached_files`
  - `unattached_bytes`
  - `updated_at`
- Add a child `user_storage_usage_breakdowns` table for bounded dimensions:
  - `user_id`
  - `dimension` (`file_type`, `retention_class`, `source`)
  - `key`
  - `file_count`
  - `total_bytes`
- Update projections inside the same repository transaction that inserts, deletes, or reassigns `user_files`.
- Keep one explicit reconciliation command/test helper that rebuilds projections from `user_files` and compares them with the projected rows.

## What Not To Implement
- Do not use a generic JSON blob such as `by_type_json` as the primary read model.
- Do not put quota-critical accounting only in SQLite triggers. The repository/use-case boundary should make accounting updates visible and testable.
- Do not create a global `system_statistics` table for media usage.

## Required Tests
- Positive: upload batch increments totals and all breakdown dimensions atomically.
- Positive: generated media artifacts from deferred jobs increment generated/source and retention breakdowns.
- Negative: failed upload/job materialization does not change usage projections.
- Negative: hard quota rejection leaves both files and usage projections unchanged.
- Edge: replacing or reassigning a file updates old and new user/conversation attachment buckets.
- Edge: reconciliation rebuild produces byte-for-byte equivalent projection rows after mixed inserts/deletes.
