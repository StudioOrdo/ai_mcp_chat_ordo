# Implementation Plan: Media Platform Surfaces, Storage Accounting, And Capacity Controls

**Status:** Draft Plan — Ready for Execution
**Planning Basis:** [my-media-route.md](./my-media-route.md), [media-storage-accounting.md](./media-storage-accounting.md), [media-operations-workspace.md](./media-operations-workspace.md), [media-capacity-and-quotas.md](./media-capacity-and-quotas.md)
**Primary Goal:** Deliver user media browsing, operator media supervision, storage accounting, and quota or capacity reporting without weakening the current clean architecture or RBAC posture.

---

## Verified Codebase Findings

The plan below is grounded in the current implementation, not just the specs:

- `UserFileRepository` currently exposes only per-file lookup, per-conversation listing, per-user listing, attachment assignment, and deletion primitives.
- `UserFileDataMapper` persists `file_size`, `file_type`, `mime_type`, `conversation_id`, and `metadata_json`, but it has no aggregate or admin-wide listing methods.
- `user_files` currently has only these indexes: `idx_uf_user`, `idx_uf_hash`, and `idx_uf_conv`.
- Canonical media metadata vocabularies already exist in `src/core/entities/media-asset.ts`: source is `uploaded | generated | derived`, retention is `ephemeral | conversation | durable`.
- `/api/user-files/[id]` is already the governed delivery path and already enforces owner-only access plus byte-range playback.
- `/api/chat/uploads` is already the canonical upload ingestion path.
- Shared `STAFF | ADMIN` workspace access already exists via `requireJournalWorkspaceAccess()`, but the current `/admin/layout.tsx` is still globally admin-only.
- The app and media worker already share the same writable `.data` mount through Docker, so host-capacity reporting is technically feasible.

These findings imply two hard constraints:

1. The first user-facing route can be built with minimal schema change.
2. The staff or admin operations workspace needs explicit query seams and a dedicated shell instead of piggybacking on the existing `/admin` layout.

---

## Architecture Invariants

These invariants should govern every phase.

1. Keep repository contracts in `src/core/use-cases` and database-specific logic in `src/adapters`.
2. Keep page files thin. Parse filters and build view models in dedicated loader modules, following the existing admin and jobs patterns.
3. Reuse `/api/user-files/[id]` for preview and delivery. Do not create a parallel file-serving stack.
4. Do not weaken the current `/admin/*` admin-only guard to satisfy the shared staff or admin workspace requirement.
5. Use canonical media metadata vocabularies from `src/core/entities/media-asset.ts`; do not invent a second source or retention taxonomy in UI code.
6. Keep filesystem scanning out of request paths. Runtime surfaces should use persisted accounting data; disk reconciliation belongs in scripts or operator diagnostics.
7. Favor additive seams over route monoliths: repository contract, adapter implementation, loader module, page, presentational component, and route tests should stay clearly separated.

---

## Test Philosophy

Every phase should ship with three test classes.

### Positive tests

Prove the intended flow works for the happy path.

### Negative tests

Prove that invalid filters, unauthorized access, unsupported operations, and invalid state fail closed.

### Edge tests

Prove that empty states, null metadata, boundary thresholds, stale rows, and pagination edges behave predictably and remain user-friendly.

The repository already uses this discipline in route tests, data mapper tests, RBAC tests, and architecture audit tests. The media work should extend that pattern, not invent a lighter standard.

---

## Phase 0: Query Contracts And Guardrails

### Phase 0 Purpose

Establish canonical types, repository seams, and query guardrails before any new route work begins.

### Phase 0 Scope

- Extend `src/core/use-cases/UserFileRepository.ts` with explicit user-list, admin-list, and summary contracts.
- Add dedicated query and summary types instead of passing anonymous records around.
- Add indexes needed for paged list performance.

### Phase 0 File Changes

Update:

- `src/core/use-cases/UserFileRepository.ts`
- `src/adapters/UserFileDataMapper.ts`
- `src/adapters/UserFileDataMapper.test.ts`
- `src/lib/db/tables.ts`
- `src/lib/db/migrations.ts`

Add:

- `src/core/entities/user-file-query.ts`
- `src/core/entities/user-file-storage.ts`

### Contract additions

Add user-scoped list and summary contracts:

```ts
listForUser(userId: string, filters: UserFileListFilters): Promise<UserFileListPage>;
getUserStorageSummary(userId: string): Promise<UserFileStorageSummary>;
```

Add operator-scoped contracts:

```ts
listForAdmin(filters: AdminUserFileListFilters): Promise<UserFileAdminPage>;
countForAdmin(filters: AdminUserFileCountFilters): Promise<number>;
getFleetStorageSummary(): Promise<FleetFileStorageSummary>;
listLargestUsersByStorage(limit: number): Promise<UserStorageLeaderboardEntry[]>;
```

### Query design

For user-facing listing, use cursor pagination keyed by `(created_at, id)` to avoid unstable pages when files are added mid-session.

Recommended index additions:

- `(user_id, created_at DESC, id DESC)` for user route pagination.
- `(created_at DESC, id DESC)` for operator inventory.

Do not promote `retentionClass`, `source`, or `derivativeOfAssetId` into first-class columns in this phase. Keep phase 0 focused on contracts, list pagination, and basic totals.

### Phase 0 Positive Tests

- `UserFileDataMapper` returns stable cursor pages ordered by `created_at DESC, id DESC`.
- User summary totals match seeded fixture rows.
- Fleet summary totals match seeded fixture rows across multiple users.

### Phase 0 Negative Tests

- Unknown filter values are rejected or ignored by the parsing layer rather than interpolated into SQL.
- Empty result sets still return valid summary and page envelopes.

### Phase 0 Edge Tests

- Multiple files with the same timestamp still paginate correctly because `id` is part of the cursor.
- `file_size = 0` rows are still counted correctly.
- Rows with null `conversation_id` are correctly classified as unattached.

### Phase 0 Exit Criteria

- Query contracts exist and are adapter-backed.
- Pagination and totals are proven by mapper tests.
- No UI route depends on loading all user files into memory.

---

## Phase 1: Storage Accounting Foundation

### Phase 1 Purpose

Create a reusable accounting layer for user totals, fleet totals, and reconciliation without coupling route code to raw SQL.

### Phase 1 Scope

- Build summary loaders on top of the phase 0 repository contracts.
- Standardize retention and source interpretation using the existing media metadata projection utilities.
- Add a reconciliation script for DB totals versus `.data/user-files` bytes on disk.

### Phase 1 File Changes

Update:

- `src/lib/media/media-asset-projection.ts`
- `src/adapters/UserFileDataMapper.ts`
- `src/adapters/UserFileDataMapper.test.ts`

Add:

- `src/lib/media/user-file-storage-summary.ts`
- `src/lib/media/user-file-storage-summary.test.ts`
- `scripts/report-media-storage.ts`
- `tests/media-storage-report.test.ts`

### Implementation details

1. Create a storage-summary facade in `src/lib/media/user-file-storage-summary.ts` that accepts a `UserFileRepository` and exposes user and fleet summary calls.
2. Keep raw SQL aggregation in `UserFileDataMapper`; keep projection, formatting, and fallback normalization in the summary facade.
3. Use canonical metadata normalization from `buildUserFileMetadata` or sibling helpers so summary code does not parse `metadata_json` ad hoc.
4. Reconciliation should walk `.data/user-files` only in the script path, never in route loaders.

### Phase 1 Positive Tests

- Per-user bytes and counts are correct across mixed file types.
- Fleet summary correctly separates attached and unattached bytes.
- Reconciliation script reports zero delta against a seeded fixture directory.

### Phase 1 Negative Tests

- Missing or malformed metadata JSON does not crash the summary layer.
- Reconciliation reports a non-zero delta clearly when a disk file is missing or extra.

### Phase 1 Edge Tests

- Rows lacking explicit `retentionClass` fall back to `conversation` when `conversationId` exists and `ephemeral` otherwise.
- Rows lacking explicit `source` still normalize consistently through the existing projection rules.

### Phase 1 Exit Criteria

- The system can compute user totals, fleet totals, grouped totals, and disk delta through a dedicated accounting layer.
- The accounting layer is reusable by routes without exposing SQL or filesystem traversal to page code.

---

## Phase 2: My Media Route V1

### Phase 2 Purpose

Ship the first user-facing media surface on top of the accounting and repository seams.

### Phase 2 Scope

- Add `/my/media`.
- Show user-only assets, summaries, filters, and previews.
- Add single-asset delete for unattached user-owned assets only.

### Phase 2 File Changes

Add:

- `src/app/my/media/page.tsx`
- `src/app/my/media/page.test.tsx`
- `src/components/media/UserMediaWorkspace.tsx`
- `src/components/media/UserMediaWorkspace.test.tsx`
- `src/lib/media/user-media.ts`
- `src/lib/media/user-media.test.ts`

Update:

- `src/app/api/user-files/[id]/route.ts`
- `src/app/api/user-files/[id]/route.test.ts`
- `src/components/ShellWorkspaceMenu.tsx`
- `src/components/ShellWorkspaceMenu.test.tsx`

### Loader design

Mirror the established pattern used by jobs and admin pages:

- page file authenticates and reads `searchParams`,
- loader module parses filters and returns a typed view model,
- UI component renders the workspace.

Do not put filter parsing, pagination logic, or repository calls directly in `page.tsx`.

### Filter design

Use canonical values only:

- `type`: `image | chart | graph | audio | video | subtitle | waveform | document`
- `source`: `uploaded | generated | derived`
- `retention`: `ephemeral | conversation | durable`
- `attached`: `all | attached | unattached`

### Deletion design

Add `DELETE` to `src/app/api/user-files/[id]/route.ts` instead of creating a second user-file mutation route.

Deletion should require:

- current user owns the asset,
- `conversationId` is null,
- no derived child references are known.

Important current-state caveat:

`derivativeOfAssetId` exists in metadata but is not currently queryable. For phase 2, implement a fail-closed user-scoped reverse lookup by scanning the current user's candidate set in application code. If this proves awkward or slow, promote `derivative_of_asset_id` in phase 3 before broadening deletion behavior.

### UX design notes

- Use a server-rendered summary strip at the top.
- Use a responsive grid for visual media and a compact list for document-like assets.
- Preserve empty-state quality: no raw IDs or blank panels.
- Use `/api/user-files/[id]` directly for preview `src` values so range playback and authorization remain centralized.

### Phase 2 Positive Tests

- Signed-in user sees only their own assets.
- Filters update the list and counts correctly.
- Image, audio, and video previews render correctly.
- User can delete an unattached owned asset and the list updates.

### Phase 2 Negative Tests

- Anonymous visitors are redirected to login.
- Another user's asset cannot be viewed or deleted.
- Attached assets cannot be deleted.
- Invalid filter values yield a safe validation state rather than a broken page.

### Phase 2 Edge Tests

- Empty library state is graceful.
- Assets with missing width, height, or duration still render useful fallback metadata.
- Multiple assets with the same timestamp paginate correctly.
- Missing disk file behind a valid DB row resolves through the existing `UserFileSystem.getById()` cleanup behavior.

### Phase 2 Exit Criteria

- `/my/media` is production-usable.
- Summary, filtering, preview, and safe deletion are proven by page, route, and Playwright tests.
- No user can enumerate another user's media through the UI or route surface.

---

## Phase 3: Operations Workspace And Query Promotion

### Phase 3 Purpose

Add the staff or admin fleet media console without compromising the existing `/admin` authorization model.

### Phase 3 Scope

- Add a dedicated operations shell and `/operations/media` route.
- Add operator inventory, fleet summaries, top users, and cleanup candidates.
- Promote selected metadata fields out of JSON if needed for clean operator queries.

### Phase 3 File Changes

Add:

- `src/app/operations/layout.tsx`
- `src/app/operations/media/page.tsx`
- `src/app/operations/media/page.test.tsx`
- `src/components/media/MediaOperationsWorkspace.tsx`
- `src/components/media/MediaOperationsWorkspace.test.tsx`
- `src/lib/operations/operations-access.ts`
- `src/lib/media/media-operations.ts`
- `src/lib/media/media-operations.test.ts`

Update:

- `src/core/use-cases/UserFileRepository.ts`
- `src/adapters/UserFileDataMapper.ts`
- `src/adapters/UserFileDataMapper.test.ts`
- `src/lib/db/tables.ts`
- `src/lib/db/migrations.ts`
- `src/lib/journal/admin-journal.test.ts`

### Schema decision checkpoint

This is the right phase to promote metadata fields into columns if operator queries need them frequently.

Recommended additions to `user_files`:

- `retention_class TEXT`
- `asset_source TEXT`
- `derivative_of_asset_id TEXT`

Recommended indexes:

- `(retention_class, created_at DESC, id DESC)`
- `(asset_source, created_at DESC, id DESC)`
- `(derivative_of_asset_id)`
- `(user_id, retention_class, created_at DESC, id DESC)`

Backfill values from `metadata_json` in migration code, then write both paths consistently on new inserts.

### Access design

Create a new shared workspace guard:

```ts
requireOperationsWorkspaceAccess(): Promise<SessionUser>
```

This can delegate to the same `STAFF | ADMIN` role logic used by the journal workspace, but it should live in an operations-specific module to avoid coupling unrelated workspaces together.

Do not change `src/app/admin/layout.tsx`.

### Cleanup design

Phase 3 may introduce operator cleanup actions, but keep them constrained to unattached files beyond the retention threshold. Bulk deletion of attached assets remains out of scope.

### Phase 3 Positive Tests

- Staff and admin can access `/operations/media`.
- Inventory pages and filters operate correctly across multiple users.
- Fleet summary and top-user panels reflect seeded fixture data.
- Operators can inspect an asset and navigate to its conversation when present.

### Phase 3 Negative Tests

- Authenticated non-staff, non-admin users receive a closed failure path.
- Existing `/admin/*` pages remain admin-only.
- Invalid filters do not trigger broad full-table scans or unsafe SQL.

### Phase 3 Edge Tests

- Large result sets page correctly.
- Unknown or legacy metadata values degrade to “unknown” labels rather than breaking rendering.
- Orphan candidate lists exclude any conversation-bound rows even if metadata is inconsistent.

### Phase 3 Exit Criteria

- `/operations/media` exists as a shared staff or admin surface.
- Admin layout purity is preserved.
- Operator queries are performant and test-backed.

---

## Phase 4: Capacity And Quota Surfaces

### Phase 4 Purpose

Expose stable user-facing quota information and operator-facing host capacity information as separate concerns.

### Phase 4 Scope

- Add quota policy service.
- Add quota summary to `/my/media`.
- Add host capacity probe to operator surfaces or system diagnostics.

### Phase 4 File Changes

Add:

- `src/lib/storage/media-quota-policy.ts`
- `src/lib/storage/media-quota-policy.test.ts`
- `src/lib/storage/volume-capacity.ts`
- `src/lib/storage/volume-capacity.test.ts`

Update:

- `src/lib/media/user-media.ts`
- `src/components/media/UserMediaWorkspace.tsx`
- `src/lib/media/media-operations.ts`
- `src/components/media/MediaOperationsWorkspace.tsx`
- `src/app/admin/system/page.tsx` or `src/app/operations/media/page.tsx`

### Phase 4 Implementation Details

1. `media-quota-policy.ts` should be config-driven and expose one typed contract to route loaders.
2. `volume-capacity.ts` should be server-only and use `fs.statfs` against `.data`.
3. Host-capacity failures must return an explicit unavailable state.
4. User-facing views should never render host free space.

### Phase 4 Positive Tests

- User route shows used bytes versus quota and warning state.
- Operator surface shows host capacity when available.

### Phase 4 Negative Tests

- Host capacity never leaks into `/my/media`.
- Unavailable capacity probe renders a safe operator-facing fallback state.

### Phase 4 Edge Tests

- Warning threshold boundaries such as exactly 80 percent behave deterministically.
- Zero quota or misconfigured quota values fail safe and do not crash route rendering.

### Phase 4 Exit Criteria

- Quota and host capacity are modeled separately in code and UI.
- User messaging remains stable even when host free space changes.

---

## Phase 5: Enforcement And Operational Hardening

### Phase 5 Purpose

Turn display-only budgets and cleanup visibility into controlled enforcement.

### Phase 5 Scope

- Add optional upload blocking at quota using the live quota-policy seam.
- Improve cleanup tooling without weakening unattached-only safety.
- Add stronger audit and architecture tests for the media subsystem itself.

### Phase 5 File Changes

Update:

- `src/app/api/chat/uploads/route.ts`
- `src/app/api/chat/uploads/route.test.ts`
- `src/lib/chat/upload-reaper.ts`
- `src/lib/user-files.ts`
- `src/lib/storage/media-quota-policy.ts` or a shared enforcement helper that consumes it

Add:

- `tests/media-architecture-audit.test.ts`

### Phase 5 Implementation Details

1. Upload route checks current and projected usage against the existing quota policy before persisting new files.
2. Rejections should return structured, UI-friendly errors with no ambiguous generic failure text.
3. Cleanup actions should remain conservative and observable, and the stale-upload reaper scope should be explicit if it broadens beyond unattached documents.
4. Add architecture-level negative tests that forbid direct DB access from media page loaders, forbid page-level filesystem scanning, and forbid route-local quota logic that bypasses the policy seam.

### Phase 5 Positive Tests

- Upload succeeds under quota.
- Upload warns near threshold when warning mode is enabled.
- Cleanup path removes only eligible stale unattached files and preserves protected assets.

### Phase 5 Negative Tests

- Upload above hard cap is rejected predictably.
- Attached or derivative-linked assets still cannot be deleted through user surfaces.
- Page loaders do not import `getDb()` or filesystem traversal utilities directly.

### Phase 5 Edge Tests

- Concurrent uploads at the threshold behave deterministically enough for a single-node SQLite runtime.
- Quota enforcement still behaves correctly when prior usage equals the threshold exactly.

### Phase 5 Exit Criteria

- Enforcement is optional, observable, and well-tested.
- The implementation consumes the live quota-policy seam instead of inventing a second quota contract.
- Architecture audit coverage exists for the media subsystem itself, not just for adjacent systems.

Current implementation note: the landed Phase 5 slice keeps the stale-upload sweep document-only, returns structured upload error codes with projected quota state, serializes hard-block quota checks with `BEGIN IMMEDIATE` for the single-node SQLite runtime, and adds a dedicated `tests/media-architecture-audit.test.ts` suite.

## Phase 6: Portability And Delivery Baseline

### Phase 6 Purpose

Lock governed media delivery and cross-runtime artifact continuity onto one portable contract.

### Phase 6 Scope

- Keep `/api/user-files/[id]` as the single governed preview and delivery path.
- Ensure browser and deferred worker composition both return portable `assetId`-backed artifacts.
- Keep worker transport and deferred job enqueueing explicit and test-backed.
- Record any remaining generated-media policy asymmetry instead of hiding it.

### Phase 6 File Changes

Update:

- `src/app/api/user-files/[id]/route.ts`
- `src/app/api/user-files/[id]/route.test.ts`
- `src/lib/media/browser-runtime/ffmpeg-browser-executor.ts`
- `src/lib/media/server/compose-media-worker-runtime.ts`
- `src/lib/media/server/media-worker-http.ts`
- `src/lib/media/server/media-worker-client.ts`
- `src/lib/media/ffmpeg/media-execution-router.ts`
- `src/lib/jobs/compose-media-deferred-job.ts`

### Phase 6 Implementation Details

1. Persisted media artifacts should resolve to `/api/user-files/[id]` regardless of whether they were uploaded, browser-generated, or worker-generated.
2. Execution-route differences should stay inside transport and orchestration layers, not leak into the UI artifact contract.
3. Worker transport should keep explicit progress, result, and error events.
4. Any generated-media path that still bypasses the upload-route quota seam should be documented as a follow-on policy gap.

### Phase 6 Positive Tests

- Governed asset delivery works for owner-owned media and supports byte ranges.
- Worker transport streams progress before returning a final result envelope.
- Browser and deferred worker composition both emit `assetId`-backed artifact references.

### Phase 6 Negative Tests

- Cross-user asset access remains forbidden.
- Invalid worker requests or missing `userId` fail predictably.
- Invalid compose-media plans are rejected before queue submission.

### Phase 6 Edge Tests

- Range requests reject invalid byte windows with `416`.
- Worker streams without a final result fail loudly instead of returning partial state.
- Execution routing remains delivery-neutral while still respecting browser capability limits.

### Phase 6 Exit Criteria

- Governed delivery and cross-runtime artifact continuity are explicit and test-backed.
- `/api/user-files/[id]` remains the single stored-media delivery path.
- Remaining generated-media policy asymmetry is documented clearly.

---

## Cross-Phase Testing Matrix

| Layer | Positive | Negative | Edge |
| --- | --- | --- | --- |
| Repository | list, count, summary, leaderboard | invalid filters, unauthorized query shape rejection | same-timestamp cursor ties, null metadata, zero-byte files |
| Route handlers | owned preview, delete eligible file | anonymous access, cross-user access, attached delete rejection | stale DB row, invalid range, unavailable capacity |
| Loader modules | correct filter parsing and view-model composition | invalid filter fallback | empty states, unknown metadata labels, threshold boundaries |
| UI components | preview rendering, summaries, controls | hidden destructive actions when not allowed | mobile layout, missing dimensions, large counts |
| Browser E2E | user preview and delete, operator browse | forbidden paths and hidden controls | playback continuity, empty states, pagination continuity |
| Architecture audits | correct layering and delegation | forbid direct DB or FS access in pages | preserve existing admin shell isolation |

---

## Architectural Purity Checks To Add

Add audit coverage specific to the media subsystem once the routes exist.

Recommended checks:

1. `src/app/my/media/page.tsx` and `src/app/operations/media/page.tsx` must not import `getDb` directly.
2. Media page files must not import `node:fs` or traverse `.data` directly.
3. Query parsing must live in loader modules, not page components.
4. `/operations/*` access helpers must not weaken `/admin/*` access helpers.
5. `/api/user-files/[id]` remains the only governed preview path for stored media.

These checks align with the style of the existing architecture audit tests already present in the repository.

---

## Recommended Delivery Order

1. Phase 0 and Phase 1 together.
2. Phase 2 after the storage summary seam is stable.
3. Phase 3 only after deciding whether metadata promotion is required for operator query performance.
4. Phase 4 once user and operator routes already exist.
5. Phase 5 only after the surfaces are proven and the team wants enforcement.
6. Phase 6 after enforcement is in place and multiple execution routes need one portable delivery contract.

This order gives the user-facing value early while keeping the heavier schema and operator work behind validated seams.

---

## Definition Of Done For The Whole Initiative

The initiative is complete only when all of the following are true:

1. Users can browse their media safely and predictably.
2. Staff or admin operators can supervise fleet media without using the admin shell as a loophole.
3. Storage totals are accurate at both user and fleet levels.
4. Quota information is stable for users and host capacity is visible only to operators.
5. Positive, negative, and edge tests exist at repository, route, loader, UI, browser, and architecture-audit levels.
6. The final implementation preserves the current separation of core contracts, adapter persistence, loader orchestration, and route rendering.

---

*Plan drafted by GitHub Copilot after reviewing the media specs and the current user-files, RBAC, loader, and test architecture in the repository.*
