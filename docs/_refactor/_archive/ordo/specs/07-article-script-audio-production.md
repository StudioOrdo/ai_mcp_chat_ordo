# Spec 07: Article, Script, And Audio Production

## Goal

Implement the first flagship workflow slice:

`Research -> Synthesis -> Article -> Review -> Script -> Review -> Audio Episode -> Feed Publish`

## Current Code To Use

- `src/lib/blog/blog-article-production-service.ts` contains the current
  article production donor behavior.
- `src/core/capability-catalog/families/blog-capabilities.ts` owns journal/blog
  capabilities.
- `src/core/capability-catalog/families/media-capabilities.ts` owns
  `generate_audio`.
- `src/lib/audio/audio-generation-service.ts` and
  `src/lib/jobs/generate-audio-deferred-job.ts` own audio generation.
- `src/lib/jobs/deferred-job-handler-factories.ts` wires job handlers.
- `src/lib/evals/tool-workflow-coverage.ts` has blog and media workflow evals.

## Required Work

- Build generic content workflow steps:
  - `produce_article`,
  - `produce_script`,
  - `produce_audio_episode`.
- Use `ReviewKernel` for article and script.
- Produce audio via existing audio job infrastructure.
- Attach outputs to operations/materialization/asset catalog.
- Publish only by explicit action.

## Cleanup After Replacement

- Retire `produce_blog_article` as the flagship path once generic content
  workflow passes.
- Keep a temporary internal wrapper only if current admin code still needs it;
  do not preserve journal/blog as public product names.

## Positive Tests

- Workflow produces article draft, reviewed script, audio asset, and feed draft.
- Audio job status must be checked before publication.
- Operation artifacts include all generated content and review results.

## Negative Tests

- Workflow cannot publish failed or unreviewed content unless QA depth is
  explicitly `none`.
- Audio job ID cannot be treated as an asset ID.
- Anonymous users cannot start signed-in content production.

## Edge Tests

- TTS provider unavailable creates blocked operation with actionable message.
- Script exceeds target duration and review requests shortening.
- Research has low confidence and article production requires confirmation.
