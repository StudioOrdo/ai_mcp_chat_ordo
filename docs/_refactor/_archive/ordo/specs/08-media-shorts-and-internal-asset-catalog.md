# Spec 08: Media Shorts And Internal Asset Catalog

## Goal

Extend the flagship workflow with reusable assets and 30-second promo shorts
without turning media into a pile of one-off tools.

## Current Code To Use

- `src/core/entities/asset-catalog.ts`
- `src/core/platform/asset-catalog/AssetCatalogReader.ts`
- `src/core/entities/materialization.ts`
- `src/core/capability-catalog/families/media-capabilities.ts`
- `src/lib/media/workflows/*`
- `src/lib/media/ffmpeg/*`
- `src/lib/media/server/*`
- `src/lib/media/browser-runtime/*`
- `tests/evals/tool-workflow-coverage-eval.test.ts`

## Required Work

- Add internal asset-catalog read model over current user files, blog assets,
  materializations, feed items, and operation artifacts.
- Add reusable librarian query service.
- Define short preset:
  - 30 seconds,
  - 9:16 portrait default,
  - one image or simple visual sequence,
  - narration around 75 words max at 150 wpm,
  - captions optional,
  - CTA metadata.
- Use existing `compose_media` and media workflow operation path.

## Cleanup After Replacement

- Remove prompt hints that ask the model to manually stitch asset discovery
  rules once the workflow owns asset dependency resolution.
- Collapse duplicate asset lookup paths behind librarian service.

## Positive Tests

- Internal asset search returns generated article, script, image, audio, and video
  artifacts for the same workflow.
- Short uses exact asset IDs and never job IDs.
- Composed media is cataloged and reusable.

## Negative Tests

- User cannot access another user's private asset.
- Compose cannot run before visual/audio dependencies are ready.
- Missing asset produces blocked operation, not invented success.

## Edge Tests

- Browser media runtime unavailable falls back to server/native where allowed.
- Chart/graph assets can be used directly in composition.
- Existing blog hero image assets remain reusable during migration.
