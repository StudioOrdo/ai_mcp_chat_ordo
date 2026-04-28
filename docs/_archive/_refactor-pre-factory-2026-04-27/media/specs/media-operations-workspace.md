# Feature Spec: Media Operations Workspace

**Status:** Draft Spec — Aligned With Live Phase 0 To Phase 2 Seams
**Priority:** Phase 3 (after My Media route)
**Execution Surface:** Shared staff or admin route + existing admin-wide media queries + accounting loader + governed asset preview
**Dependencies:** `UserFileRepository`, `UserFileDataMapper`, `media-storage-accounting.ts`, role access helpers modeled on the journal workspace split, governed file API

---

## Purpose

Provide a staff or admin workspace for supervising media across the whole system: uploads, generated artifacts, retention mix, storage hotspots, and orphaned assets. This is an operational console, not a user library.

---

## Current State

The system has good media persistence but no operator surface:

- `UserFileDataMapper` persists all core file metadata.
- `UserFileRepository` already exposes admin-wide listing and summary seams: `listForAdmin`, `countForAdmin`, `getFleetStorageSummary`, and `listLargestUsersByStorage`.
- `media-storage-accounting.ts` already provides reusable fleet summaries and top-file-type rollups via `getFleetMediaStorageAccount()`.
- `/my/media` is now live and proves the preferred thin-page plus loader plus route-owned workspace pattern for governed media surfaces.
- The current `/admin` layout calls `requireAdminPageAccess()`, which blocks staff users globally.
- `admin-journal.ts` already contains the best live access precedent: `requireJournalWorkspaceAccess()` allows `STAFF` and `ADMIN`, while `requireAdminPageAccess()` keeps `/admin` pages admin-only.

The main structural constraint is route shell access, not storage.

---

## Recommended Route Strategy

Do not place the first shared staff or admin media workspace under the current `/admin` shell unless that shell is generalized.

Recommended route:

`/operations/media`

Recommended access rule:

- allow `STAFF` and `ADMIN`,
- use a shared workspace layout backed by a new generalized operations access helper modeled on `requireJournalWorkspaceAccess()`.

If the team wants strict admin-only first, `/admin/media` is acceptable as a smaller phase. But that is not the same feature as the requested staff or admin workspace.

---

## Target Experience

The workspace should provide:

1. Global media inventory with pagination and search.
2. Breakdown by file type, source, retention class, and top storage consumers.
3. Filters for user, attachment state, retention class, source, and file type using the already-landed query contract.
4. Asset detail with governed preview, metadata, and source-conversation context. Deep links to conversation detail should stay admin-only until a shared conversation surface exists.
5. Orphan and ephemeral cleanup views.
6. Export-ready totals for audits and release evidence.

---

## Information Architecture

### Core panels

| Panel | Purpose |
| --- | --- |
| Fleet summary | Total files, total bytes, recent uploads, orphan count |
| Inventory table | Searchable list of assets across users |
| User impact | Largest users by bytes and file count |
| Retention view | Ephemeral vs conversation vs durable distribution |
| Cleanup queue | Candidate unattached files eligible for deletion |

### Initial filters

| Filter | Values |
| --- | --- |
| User | exact user id |
| File type | all supported `UserFileType` values |
| Retention | ephemeral, conversation, durable |
| Source | uploaded, generated, derived |
| Attachment state | attached, unattached |

---

## Implementation

### 1. Build a shared operations shell

If staff access is required, create a dedicated shell that does not inherit the current admin-only layout. The journal workspace already proves the pattern. Reuse that approach instead of weakening admin authorization globally.

### 2. Build on the existing admin-wide media seams

Do not re-add repository contracts that already landed. Phase 3 should compose:

- `listForAdmin()` for inventory rows,
- `countForAdmin()` for pagination totals,
- `getFleetMediaStorageAccount()` for fleet summary cards, top users, and top file types,
- the existing governed `/api/user-files/[id]` route for preview.

### 3. Keep metadata promotion as a decision gate

The current code derives `retentionClass` and `source` from `metadata_json` using SQL expressions. Promote metadata into indexed columns only if the operator route proves real query or indexing pressure.

### 4. Add controlled operational actions

V1 should support only safe actions:

- view asset,
- inspect metadata,
- inspect source conversation context,
- queue or execute cleanup of stale unattached assets.

Avoid destructive mutation of attached assets in the first release.

---

## Non-Goals

- User self-service media browsing.
- Cross-user editing of asset metadata.
- Manual reassignment of asset ownership.
- Bulk deletion of conversation-bound assets.
- Full DAM behavior such as tagging, collections, or publishing workflows.

---

## Acceptance Criteria

1. `STAFF` and `ADMIN` users can access the media operations workspace; non-privileged users cannot.
2. The inventory can filter and page through media across all users without loading the entire table into memory.
3. The summary panels show correct totals for files, bytes, retention classes, and unattached assets.
4. Operators can inspect an asset preview through the governed asset route, and admin-only conversation deep links do not leak to staff users.
5. Cleanup candidates are limited to assets that are unattached and older than the defined retention threshold.
6. The route does not weaken the current admin-only access guarantees for existing `/admin` pages.

---

## Validation

- Reuse and keep green the repository and accounting tests that already back admin-wide listing and summaries.
- Add route or loader tests for staff and admin access control.
- Add Playwright coverage for inventory filters and asset detail preview.
- Add a regression test proving `/admin/*` remains admin-only after the shared operations shell is introduced.

---

## Rollout Notes

This workspace should follow the My Media route because it depends on the same governed preview and loader composition pattern, but with broader visibility and stronger RBAC separation.

---

*Spec drafted by GitHub Copilot. Grounded in the current `admin-journal` access helpers and the existing admin layout constraint.*
