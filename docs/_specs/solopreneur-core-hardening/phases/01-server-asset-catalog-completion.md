# Phase 01 - Server Asset Catalog Completion

## Objective
Make the server-side Asset Catalog the product authority for reusable media assets across chat restore, Media Composer, and governed media discovery.

Browser transcript scanning may remain only as a narrow browser-runtime bridge for chart/graph payloads that have not yet been projected into durable asset catalog state. Audio, video, image, and deferred-job generated assets must come from durable files, materializations, and `AssetCatalogReader`.

## Current Code Grounding

### Already Good
- `src/core/use-cases/AssetCatalogReader.ts` defines the asset catalog port.
- `src/core/platform/asset-catalog/AssetCatalogReader.ts` reads from `user_files`, `materialization_records`, and blog assets.
- `src/core/platform/asset-catalog/AssetCatalogProjector.ts` projects `AssetCatalogEntry` and `ConversationMediaAssetCandidate`.
- `src/core/use-cases/tools/list-conversation-media-assets.tool.ts` exposes governed discovery through `AssetCatalogReader`.
- `src/lib/media/server/compose-media-worker-runtime.ts` already resolves compose inputs through `getAssetCatalogReader().findByAssetId(...)` during server execution.
- `src/core/platform/conversation-workspace/WorkspaceSnapshotReader.ts` is already constructed with `assetCatalogReader` through `RepositoryFactory`.
- Audio has already been hard-cut to canonical deferred jobs and durable materialization by phases 10a-10c.

### Original Findings And Current QA Status
| Finding | Current Evidence | Current Status |
| --- | --- | --- |
| Workspace restore returned only `WorkspaceAssetRef[]`, not full catalog entries. | `WorkspaceRestorePayload` now includes `reusableMediaAssets: ConversationMediaAssetCandidate[]`; `WorkspaceRestoreReader` loads them from `AssetCatalogReader.listReusableMediaAssets(...)`. | Resolved. `assets` remains lightweight workspace highlights only. |
| Browser compose-media local path depended on transcript-derived candidate scanning. | `useBrowserCapabilityRuntime.ts` now executes current `compose_media` browser candidates, skips restored historical message ids, and canonicalizes plans against `WorkspaceRestorePayload.reusableMediaAssets` before falling back to transcript bridge candidates. | Resolved. Browser composition works again without making historical transcripts the product asset authority. |
| `buildMediaCompositionCanonicalizationOptionsFromChatMessages` accepted generated chart/graph/blog-image tool results as asset candidates. | It still supports chart/graph/blog-image and `list_conversation_media_assets`; it explicitly excludes direct `generate_audio` transcript payloads. | Accepted bridge behavior. Server/product composition should continue to use catalog entries or `list_conversation_media_assets`, not transcript audio payloads. |
| Browser compose-media recovery was stale against the canonical job route. | `composeMediaMaterializationCore.ts` and `useBrowserCapabilityRuntime.ts` validate `CanonicalJobSnapshot` and convert with `canonicalJobSnapshotToStatusPart(...)`. | Resolved. Guardrail test forbids `job.part` client assumptions from returning. |
| Asset Catalog restore/client contract gap. | Restore now includes reusable candidate metadata from `AssetCatalogReader`; route empty-workspace detection accounts for `reusableMediaAssets`; `ChatProvider` passes restored reusable media into browser composition. | Resolved. Browser composition uses restored catalog candidates for alias repair before transcript bridge candidates. |

## Target Architecture

### Single Source Of Truth
- Durable media truth: `user_files`, `materialization_records`, and blog assets.
- Product read model: `AssetCatalogEntry`.
- Product discovery port: `AssetCatalogReader`.
- Media Composer canonicalization: `AssetCatalogEntry -> ConversationMediaAssetCandidate -> MediaCompositionAssetIdentityCandidate`.

### SOLID / Clean Boundaries
- Single Responsibility: `AssetCatalogReader` reads durable asset catalog state; it does not parse chat transcripts.
- Open/Closed: new asset source types are added through projector/reader adapters, not by branching inside UI hooks.
- Liskov/Interface Segregation: UI restore consumers should depend on a read DTO, not repository implementations.
- Dependency Inversion: Media Composer and restore should depend on `AssetCatalogReader`/use-case facades, not `UserFileDataMapper` directly.

### DRY
- Use `AssetCatalogProjector` as the one place that maps durable asset sources into catalog/candidate DTOs.
- Reuse `buildMediaCompositionCanonicalizationOptionsFromAssetCatalogEntries(...)` instead of duplicating alias generation in UI code.
- Keep transcript bridge helpers small and explicitly named so they cannot become a second product path.

### GoF Patterns
- Adapter: map `user_files`, blog assets, and materialization rows into `AssetCatalogEntry`.
- Facade: expose reusable media discovery through `list_conversation_media_assets` and workspace restore payloads.
- Strategy: keep browser-runtime chart/graph source resolution separate from durable server asset resolution.
- Repository: keep durable persistence behind existing repository ports/factory boundaries.

## Hard Cutover Rules
1. Do not add a `conversation_assets` table in this phase.
2. Do not reintroduce direct `generate_audio` transcript payloads as asset authority.
3. Do not let `job_` ids be accepted as media `assetId` values.
4. Do not make Media Composer scan entire chat history when a server asset catalog payload is available.
5. Do not preserve stale `payload.job.part` response assumptions after `/api/chat/jobs` returns `CanonicalJobSnapshot`.

## Implementation Plan (Completed)

### Step 1 - Restore Payload Asset Catalog
1. Extend the restore read model to include full reusable media asset metadata:
   - Option A: add `assetCatalog: AssetCatalogEntry[]` to `WorkspaceRestorePayload`.
   - Option B: add `reusableMediaAssets: ConversationMediaAssetCandidate[]` if the client should not know catalog internals.
2. Inject `AssetCatalogReader` into `WorkspaceRestoreReader`.
3. Load reusable media assets for the workspace conversation alongside jobs/workflow/memory.
4. Preserve `assets: WorkspaceAssetRef[]` only as lightweight workspace highlights.

### Step 2 - Media Composer Canonicalization From Catalog
1. Reuse `buildMediaCompositionCanonicalizationOptionsFromAssetCatalogEntries(...)` and `buildMediaCompositionCanonicalizationOptionsFromConversationAssets(...)` for durable catalog/candidate DTOs.
2. Keep server `compose_media` as the durable execution path; it resolves governed asset ids through `AssetCatalogReader.findByAssetId(...)`.
3. Allow browser `compose_media` execution for current pending browser candidates when the plan can be canonicalized against restored reusable assets and current-session bridge candidates.
4. Keep transcript-derived chart/graph candidates only as a browser-runtime bridge, not as durable product authority.

### Step 3 - Browser Recovery Contract Cleanup
1. Update `composeMediaMaterializationCore.ts` recovery enqueue to consume `CanonicalJobSnapshot` returned from `/api/chat/jobs`.
2. If the UI still needs a `JobStatusMessagePart`, convert with the existing canonical adapter at the edge.
3. Prefer removing browser fallback/rewrite branches that duplicate server job state if server compose is now the canonical path.

### Step 4 - Guardrails And Pruning
1. Add tests that forbid direct `generate_audio` transcript payloads in composition candidates.
2. Add tests that forbid `payload.job.part` assumptions in `/api/chat/jobs` client code.
3. Delete stale tests that assert transcript-derived audio/media asset authority.
4. Update docs and prompts only if needed to reinforce `list_conversation_media_assets` and exact `assetId` usage.

## Cleanup Targets
- `src/hooks/chat/useAssetResolutionIndex.ts`: rename or constrain to browser chart/graph bridge; no product audio/video/image authority.
- `src/lib/media/media-composition-asset-identity.ts`: ensure transcript-derived candidates are marked compatibility-only and lower priority than catalog candidates.
- `src/hooks/chat/composeMediaMaterializationCore.ts`: remove stale `payload.job.part` response handling.
- `src/core/platform/conversation-restore/*`: add asset catalog/candidate restore contract.
- Tests that use direct `generate_audio` tool results may remain as transcript facts only, never as composition/product asset authority.

## Positive Tests
- `WorkspaceRestoreReader` includes reusable media assets from `AssetCatalogReader` for the restored conversation.
- Restore payload preserves existing `WorkspaceAssetRef[]` while adding full asset/candidate metadata.
- Media Composer canonicalization uses server catalog entries for audio, image, video, chart, and graph assets.
- `list_conversation_media_assets` still returns governed candidates with materialization lineage.
- Server compose worker resolves catalog entries for governed asset IDs.

## Negative Tests
- Another user's asset is not returned by restore or reusable asset discovery.
- Direct `generate_audio` transcript payload does not become a media composition candidate.
- `job_...` values are rejected as media asset references.
- Missing `/api/chat/jobs` `job.part` no longer breaks browser recovery; code consumes canonical `job`.
- Malformed catalog entries or missing user files are skipped/reported deterministically.

## Edge Tests
- Blog hero assets and user files dedupe by `assetId`, newest update wins.
- Materialization references an asset not directly attached to the conversation; catalog still links it through materialization when owned by the user.
- Materialization references a missing file; restore/discovery does not crash.
- Browser chart/graph generated in the current session can still be composed before durable catalog projection arrives.
- Empty catalog returns an empty candidate set without falling back to unrelated historical transcript assets.

## Focused Validation Commands
```bash
npm exec vitest run \
  src/core/platform/asset-catalog/AssetCatalogReader.test.ts \
  src/core/platform/asset-catalog/AssetCatalogProjector.test.ts \
  src/core/platform/conversation-restore/WorkspaceRestoreReader.test.ts \
  src/core/platform/conversation-restore/WorkspaceRestoreProjector.test.ts \
  src/core/platform/conversation-workspace/WorkspaceSnapshotReader.test.ts \
  src/core/use-cases/tools/list-conversation-media-assets.tool.test.ts \
  src/lib/media/media-composition-asset-identity.test.ts \
  src/hooks/chat/useAssetResolutionIndex.test.tsx \
  src/lib/media/server/compose-media-worker-runtime.test.ts \
  src/lib/media/compose-media-preflight.test.ts \
  tests/audio-job-contract-guardrails.test.ts \
  src/lib/media/browser-runtime/job-snapshots.test.ts \
  src/hooks/chat/useBrowserCapabilityRuntime.test.tsx \
  src/hooks/useGlobalChat.test.tsx
```

## Done Criteria
- Restore delivers durable reusable media metadata from `AssetCatalogReader`.
- Server Media Composer resolves governed asset ids from the server catalog.
- Browser Media Composer executes current browser candidates and canonicalizes plans from restored `reusableMediaAssets` before transcript bridge candidates.
- Restored historical transcript messages remain non-executable.
- Browser-runtime transcript scans are isolated to chart/graph bridge behavior.
- Stale `/api/chat/jobs` `job.part` handling is removed or converted at the canonical edge.
- Focused validation and full test suite pass.

## Implementation Notes
- `WorkspaceRestorePayload` now includes `reusableMediaAssets` sourced from `AssetCatalogReader.listReusableMediaAssets(...)`.
- Existing lightweight `assets: WorkspaceAssetRef[]` remains for workspace highlights.
- `RepositoryFactory.getWorkspaceRestoreReader()` injects `getAssetCatalogReader()`.
- `ChatProvider` passes `workspaceRestore.reusableMediaAssets` into `useBrowserCapabilityRuntime(...)`.
- `composeMediaMaterializationCore.ts` and `useBrowserCapabilityRuntime.ts` now consume canonical `/api/chat/jobs` `job: CanonicalJobSnapshot` responses and convert at the UI edge with `canonicalJobSnapshotToStatusPart(...)`.
- `tests/audio-job-contract-guardrails.test.ts` blocks the legacy `job.part` client response assumption from returning in chat job clients.
- `getBrowserRuntimeCandidates(...)` creates `compose_media` candidates only for executable compose payloads, not inline discovery/error payloads.
- `useBrowserCapabilityRuntime.ts` executes current browser `compose_media` candidates, keeps restored historical message ids non-executable, and retains persisted compose runtime ownership for browser planning.
- Browser compose plan repair uses restored reusable media assets first, then current transcript bridge candidates.
- `useAssetResolutionIndex.ts` remains a limited chart/graph browser bridge; it does not expose audio payload lookup or promote direct `generate_audio` transcript results.
- Removed the unused duplicate `src/hooks/chat/browserCapabilityRuntimeCore.ts` so there is no stale second runtime path disabling browser composition.

## Post-Implementation QA
- Pass: restore payload carries reusable media candidates from `AssetCatalogReader`.
- Pass: restore empty-workspace detection includes `reusableMediaAssets`.
- Pass: `/api/chat/jobs` clients consume canonical job snapshots instead of `job.part`.
- Pass: direct transcript `generate_audio` payloads are not composition candidates.
- Pass: browser composition works for current pending `compose_media` candidates.
- Pass: browser composition canonicalizes restored reusable media aliases to governed `assetId` values before execution.
- Pass: restored historical `compose_media` transcript candidates remain non-executable.

## Implementation Validation
- Final focused Phase 01 suite: `14 files passed`, `94 tests passed`.
- Final typecheck: passed.
- Final full suite at Phase 01 close-out: `654 files passed`, `4780 tests passed`, `2 skipped`.
- Current full-suite regression after Phase 03: `656 files passed`, `4,788 tests passed`, `2 skipped`.

## Final QA Close-Out
- Pass: server restore is grounded in `AssetCatalogReader` and returns `WorkspaceRestorePayload.reusableMediaAssets`.
- Pass: `RepositoryFactory.getWorkspaceRestoreReader()` injects the server asset catalog reader.
- Pass: `/api/workspace/restore` treats `reusableMediaAssets` as durable workspace state for empty-restore detection.
- Pass: browser composition executes only current pending `compose_media` candidates; restored historical message ids are non-executable.
- Pass: browser composition canonicalizes against restored reusable media candidates before transcript bridge candidates.
- Pass: direct transcript `generate_audio` payloads do not become browser runtime candidates or product asset-resolution candidates.
- Pass: stale duplicate `browserCapabilityRuntimeCore.ts` has been removed.
- Pass: `/api/chat/jobs` client recovery consumes canonical job snapshots, not legacy `job.part` response assumptions.
