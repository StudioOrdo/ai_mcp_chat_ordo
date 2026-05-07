# Phase 08: Internal Asset Catalog And Media Short Extension

Status: Planned

Related specs:

- `../specs/08-media-shorts-and-internal-asset-catalog.md`

## Goal

Add the reusable internal asset catalog and extend the flagship workflow with
image and 30-second promo short production.

The asset catalog is a governed internal surface. Public users see only assets
explicitly projected into feed items, offers, or public profile metadata.

## Current Code To Research

- `src/core/entities/asset-catalog.ts`
- `src/core/platform/asset-catalog/AssetCatalogReader.ts`
- `src/core/entities/materialization.ts`
- `src/core/capability-catalog/families/media-capabilities.ts`
- `src/lib/media/workflows/*`
- `src/lib/media/ffmpeg/*`
- `src/components/media/*`

## Required Work

- Extend librarian service across current asset sources.
- Add image/short workflow extension.
- Store media outputs as assets and operation artifacts.
- Preserve exact source lineage.

## Tests

Positive:

- generated image/audio/video appear in the internal asset catalog.
- short uses correct asset IDs and profile.

Negative:

- private assets inaccessible.
- anonymous users cannot browse the internal asset catalog.
- compose blocked when dependencies missing.

Edge:

- browser runtime unavailable.
- server/native fallback.
- chart/graph direct assets.

## Cleanup

- Consolidate duplicated media asset discovery prompt hints behind workflow
  dependency resolution.

## Exit Criteria

- The flagship workflow can produce a reusable promo short after text/audio.
