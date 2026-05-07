# Media Platform Implementation Roadmap

Date: 2026-04-15

## Goal

Move the media subsystem from governed but mostly implicit storage toward explicit user, operator, and operational surfaces with clean query seams, durable accounting, and policy-driven quota or capacity behavior.

## Principles

1. Tighten contracts before widening surfaces.
2. Preserve the existing governed asset-delivery route as the single preview and download path.
3. Keep route files thin and put parsing plus view-model logic into loader modules.
4. Avoid schema expansion until query pressure justifies it.
5. Treat user-facing quota and operator-facing host capacity as separate concerns.
6. Add proof at every layer: repository, route, loader, UI, browser, and architecture audit.

## Recommended Order

Detailed execution packets live under [phases/README.md](./phases/README.md).

| Phase | Goal | Primary files | Exit criteria | Rough effort |
| --- | --- | --- | --- | --- |
| 0 | Establish user-file query contracts, pagination rules, and guardrails | `src/core/use-cases/UserFileRepository.ts`, `src/adapters/UserFileDataMapper.ts`, `src/lib/db/tables.ts`, `src/lib/db/migrations.ts` | filtered listing and summary contracts exist and are test-backed | 3 to 4 days |
| 1 | Build storage-accounting summaries and reconciliation | `src/adapters/UserFileDataMapper.ts`, `src/lib/media/media-asset-projection.ts`, `scripts/report-media-storage.ts` | per-user and fleet totals are reusable and disk delta can be reported | 3 to 4 days |
| 2 | Ship `/my/media` v1 | `src/app/my/media/page.tsx`, `src/lib/media/user-media.ts`, `src/components/media/*`, `src/app/api/user-files/[id]/route.ts` | user route supports summary, filter, preview, and safe deletion of eligible assets | 1 week |
| 3 | Add `/operations/media` and decide schema promotion | `src/app/operations/media/page.tsx`, `src/lib/media/media-operations.ts`, `src/lib/storage/*`, `src/lib/db/*` | staff or admin workspace exists without weakening `/admin`, and metadata promotion decision is explicit | 1 to 2 weeks |
| 4 | Add quota and host-capacity surfaces | `src/lib/storage/media-quota-policy.ts`, `src/lib/storage/volume-capacity.ts`, `src/components/media/*` | user quota and operator capacity are modeled separately and tested | 3 to 4 days |
| 5 | Add enforcement and operational hardening | `src/app/api/chat/uploads/route.ts`, `src/lib/chat/upload-reaper.ts`, `src/lib/storage/media-quota-policy.ts`, `tests/media-architecture-audit.test.ts` | upload enforcement consumes the live quota-policy seam, cleanup hardening is explicit, and subsystem architecture tests are in place | 1 week |
| 6 | Freeze portability and delivery baseline | `src/app/api/user-files/[id]/route.ts`, `src/lib/media/browser-runtime/ffmpeg-browser-executor.ts`, `src/lib/media/server/*`, `src/lib/media/ffmpeg/media-execution-router.ts`, `src/lib/jobs/compose-media-deferred-job.ts` | governed asset delivery and cross-runtime artifact continuity are explicit, portable, and test-backed | 3 to 4 days |

## Phase 0: Query Contracts And Guardrails

### Phase 0 Problem

The current `user_files` substrate is strong for point lookups and per-user listing, but it lacks the explicit pagination and summary contracts required by real product surfaces.

### Phase 0 Exit Criteria

`UserFileRepository` exposes explicit user and admin listing plus summary seams, and `UserFileDataMapper` proves stable ordering, pagination, and totals through focused tests.

## Phase 1: Storage Accounting Foundation

### Phase 1 Problem

The system persists `file_size`, but no dedicated accounting layer turns that persisted state into reusable product or operator summaries.

### Phase 1 Exit Criteria

Routes and diagnostics can consume a shared accounting layer without reimplementing SQL aggregation or filesystem scanning.

## Phase 2: My Media Route V1

### Phase 2 Problem

Users already own governed media, but there is no direct route to browse, preview, or safely clean up those assets.

### Phase 2 Exit Criteria

Signed-in users can browse only their own assets, preview them through the governed delivery path, and delete only assets that are explicitly eligible.

## Phase 3: Operations Workspace And Metadata Promotion

### Phase 3 Problem

Operators have no media inventory view today, and the current `/admin` layout cannot simply be widened to include staff.

### Phase 3 Exit Criteria

A dedicated operations workspace exists for `STAFF` and `ADMIN`, and the metadata-promotion decision is recorded based on actual query pressure rather than guesswork.

## Phase 4: Capacity And Quotas

### Phase 4 Problem

The product needs stable user-facing storage budgets and truthful operator-facing host-capacity visibility, but those concerns should not be conflated.

### Phase 4 Exit Criteria

User routes display quota-based usage, operator routes display host-capacity state when available, and the two concerns remain separated in code and UI.

## Phase 5: Enforcement And Operational Hardening

### Phase 5 Problem

Once visibility exists and the quota-policy seam is live, the system still needs enforcement, cleanup hardening, and subsystem-specific architecture audits to keep future changes honest.

### Phase 5 Exit Criteria

Quota enforcement is policy-driven and consumes the existing quota-policy seam, cleanup remains conservative and explicit, and architecture-audit tests explicitly forbid the common media-subsystem layering regressions. The current implementation keeps the stale-upload sweep document-only by design, adds structured upload failure codes, reports partial cleanup results truthfully, and serializes hard-block quota checks for whole upload batches in the single-node SQLite runtime.

## Phase 6: Portability And Delivery Baseline

### Phase 6 Problem

Once multiple media execution routes exist, delivery continuity becomes its own architecture concern. Browser-generated output, worker-generated output, and deferred compose-media jobs need one governed artifact contract and one preview or download path, or the UI and operator surfaces start drifting by execution route.

### Phase 6 Exit Criteria

Persisted media artifacts resolve through `/api/user-files/[id]`, browser and deferred worker execution both return portable `assetId`-backed artifacts, worker transport and deferred enqueueing are test-backed, and any remaining policy asymmetry is documented explicitly rather than hidden under “delivery complete” language.
