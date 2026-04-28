# Feature Spec: Media Storage Accounting

**Status:** Draft Spec — Ready for Execution
**Priority:** Phase 1 (shared foundation)
**Execution Surface:** Repository aggregates + storage summary service + route view models
**Dependencies:** `user_files` persistence, `UserFileRepository`, `UserFileDataMapper`, upload pipeline, cleanup jobs

---

## Purpose

Turn existing `file_size` persistence into a first-class accounting layer that supports user-facing totals, operator reporting, quota enforcement, and retention planning.

The system already records enough data to do this. What is missing is a deliberate aggregate surface.

---

## Current State

The database already stores the raw data needed for accounting:

- `file_size` per asset,
- `file_type`,
- `user_id`,
- `conversation_id`,
- `created_at`,
- retention and source metadata inside `metadata_json`.

The gaps are:

- no user storage summary method,
- no admin fleet storage summary method,
- no grouped byte totals by type or retention class,
- no reconciliation check against the actual `.data/user-files` volume.

---

## Target State

The application should be able to answer, cheaply and correctly:

1. How many bytes does this user currently own?
2. How many files does this user currently own?
3. How much storage is tied to conversation assets versus ephemeral assets?
4. Which file types dominate storage?
5. Which users account for the largest share of storage?
6. Does the database accounting approximately match the bytes actually present on disk?

---

## Implementation

### 1. Add storage summary domain types

Introduce explicit summary shapes instead of returning anonymous records.

Recommended types:

```ts
interface UserFileStorageSummary {
  totalFiles: number;
  totalBytes: number;
  byType: Record<UserFileType, { files: number; bytes: number }>;
  attachedBytes: number;
  unattachedBytes: number;
}

interface FleetFileStorageSummary {
  totalFiles: number;
  totalBytes: number;
  unattachedFiles: number;
  unattachedBytes: number;
  byRetentionClass: Record<string, { files: number; bytes: number }>;
  bySource: Record<string, { files: number; bytes: number }>;
}
```

### 2. Add repository aggregate methods

Recommended additions:

```ts
getUserStorageSummary(userId: string): Promise<UserFileStorageSummary>;
getFleetStorageSummary(): Promise<FleetFileStorageSummary>;
listLargestUsersByStorage(limit: number): Promise<Array<{
  userId: string;
  totalFiles: number;
  totalBytes: number;
}>>;
```

These methods should be backed by SQL `SUM`, `COUNT`, and grouped queries on `user_files`.

### 3. Normalize retention extraction

Retention class currently lives in metadata JSON. The accounting layer should define one canonical extractor so route code and reporting code do not each parse raw metadata in slightly different ways.

If JSON extraction becomes awkward in SQLite, promote `retention_class` and `asset_source` into first-class columns later. That is a valid phase 2 optimization, not a v1 prerequisite.

### 4. Add reconciliation command

Add a script that compares:

- total bytes from `user_files`,
- total bytes physically present under `.data/user-files`.

This should not block runtime features, but it is important as an operational guardrail.

Recommended script:

`scripts/report-media-storage.ts`

Outputs:

- DB total bytes,
- disk total bytes,
- delta bytes,
- top users,
- top file types,
- orphan candidate totals.

---

## Consumer Surfaces

The accounting layer supports multiple features:

| Consumer | Uses |
| --- | --- |
| My Media route | total bytes and total files for current user |
| Media operations workspace | fleet totals and top users |
| Future quotas | used bytes versus allowed bytes |
| Release or ops evidence | storage trend and orphan totals |

---

## Non-Goals

- Real-time filesystem scanning on every request.
- Billing integration.
- Per-folder or per-project accounting.
- Historical trend warehousing in v1.

---

## Acceptance Criteria

1. The application can compute per-user file count and byte totals directly from persisted `user_files` records.
2. The application can compute fleet-wide file count and byte totals, including unattached totals.
3. Grouped storage totals by file type are available for both user and fleet reporting.
4. The accounting API is reusable by both the user-facing media route and the operator workspace.
5. A reconciliation script can report the delta between DB totals and on-disk totals for `.data/user-files`.

---

## Validation

- Add data-mapper tests for summary queries and grouped totals.
- Add fixture-driven tests covering mixed file types, mixed retention classes, and attached or unattached rows.
- Run the reconciliation script against a seeded local `.data` directory and verify a zero or explainable delta.

---

## Rollout Notes

This spec is the shared foundation under the route work. It should be implemented either immediately before or together with the My Media route.

---

*Spec drafted by GitHub Copilot. Grounded in the existing `file_size` persistence and governed `.data/user-files` storage model.*
