# Phase 07: Content Campaign Workflow - Text And Audio

Status: Planned

Related specs:

- `../specs/07-article-script-audio-production.md`
- `../specs/12-evals-and-regression-artifacts.md`

## Goal

Implement the first flagship workflow:

`Research -> Synthesis -> Article -> Review -> Script -> Review -> Audio Episode -> Feed Draft`

## Current Code To Research

- `src/lib/blog/blog-article-production-service.ts`
- `src/core/capability-catalog/families/blog-capabilities.ts`
- `src/core/capability-catalog/families/media-capabilities.ts`
- `src/lib/audio/audio-generation-service.ts`
- `src/lib/jobs/generate-audio-deferred-job.ts`
- `src/lib/jobs/deferred-job-handler-factories.ts`
- `src/lib/operations/*`

## Required Work

- Add operation-backed content campaign workflow.
- Produce article, script, review artifacts, and audio asset.
- Create feed draft, not automatic publish.
- Expose operation action buttons for review, revise, and publish readiness.

## Tests

Positive:

- full workflow creates durable operation artifacts.
- audio job result is linked as asset.
- feed draft remains unpublished until action.

Negative:

- job ID cannot be used as audio asset ID.
- failed review blocks publish.
- anonymous user cannot run signed-in workflow.

Edge:

- provider disabled.
- low-confidence research.
- workflow cancellation/retry.

## Cleanup

- Mark `produce_blog_article` as a temporary internal wrapper after parity if
  current admin code still needs it. Do not keep blog/journal as public product
  names.

## Exit Criteria

- The text/audio flagship workflow passes unit and workflow eval coverage.
