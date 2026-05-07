# Server-Side Conversation Asset Index

## Status
- **Disposition**: Keep, rewritten around the current Asset Catalog architecture.
- **Priority**: Medium.
- **Layer**: Asset Catalog / Chat Presentation / Media Composer.
- **Reviewed**: 2026-05-01.

## Current Code Grounding
- `src/hooks/chat/useAssetResolutionIndex.ts` still builds chart/graph runtime lookup maps from chat messages, but audio has been hard-cut to canonical job state and is not indexed from direct transcript payloads.
- `src/core/platform/asset-catalog/AssetCatalogReader.ts` already provides a repository-backed server asset catalog from `user_files`, `materialization_records`, and blog assets.
- `src/core/platform/asset-catalog/AssetCatalogProjector.ts` projects durable `AssetCatalogEntry` records into workspace/media candidates.
- `src/core/use-cases/tools/list-conversation-media-assets.tool.ts` exposes governed conversation media discovery.

## Verdict
The old finding was directionally valid but stale. The best system should not introduce a separate `conversation_assets` table as a second source of truth. The canonical server-side asset index is the Asset Catalog projection over durable files and materializations.

## Target Architecture
- Make server asset catalog data the default input to Media Composer and chat restore surfaces.
- Keep `useAssetResolutionIndex` only as a browser-runtime bridge for chart/graph payloads that are still generated client-side.
- Move any remaining product asset discovery off transcript scanning and onto `AssetCatalogReader`.
- If query volume requires materialization, project into an `asset_catalog_entries` table from `user_files`, `materialization_records`, and blog assets, not a narrow `conversation_assets` table.

## Greenfield Cutoff
- Do not support direct `generate_audio` transcript payloads as product asset authority.
- Do not add another relationship table unless Asset Catalog projection queries prove insufficient.
- Browser transcript scans should be treated as compatibility bridges for browser-generated chart/graph assets only.

## Required Tests
- Positive: conversation assets list includes audio/image/video artifacts produced by deferred jobs through materialization records.
- Positive: Media Composer resolves reusable assets from `AssetCatalogReader`.
- Negative: direct historical `generate_audio` transcript payloads are ignored as product composition input.
- Negative: assets owned by another user are not returned.
- Edge: blog hero assets and conversation user files dedupe by asset id.
- Edge: materialized asset with missing file is skipped or reported deterministically.
