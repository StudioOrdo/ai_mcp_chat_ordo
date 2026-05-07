# Spec 06: Review Kernel And QA Depth

## Goal

Create a generic review contract for articles, scripts, images, audio
transcripts, video plans, feed items, and workflow runs.

## Current Code To Use

- `src/lib/blog/blog-article-production-service.ts` has article QA and
  resolution flow.
- `src/core/use-cases/BlogArticlePipelineModel` defines blog article QA model
  shapes.
- `tests/factory/qa-runtime.test.ts`, `tests/factory/qa-checks.test.ts`, and
  blog production tests cover existing QA behavior.
- `src/lib/operations/operation-prompt-grounding.ts` prevents chat from
  inventing operation truth.

## Required Work

- Define `Review` and `ReviewFinding`.
- Define `ReviewSubjectKind`:
  - `research_bundle`,
  - `synthesis_brief`,
  - `article`,
  - `script`,
  - `image_prompt`,
  - `image`,
  - `audio`,
  - `video_plan`,
  - `feed_item`,
  - `workflow_run`.
- Define `QaDepth`:
  - `none` -> 0 passes,
  - `standard` -> 1 pass,
  - `intermediate` -> 2 passes,
  - `aggressive` -> 3 passes.
- Store review results as operation artifacts initially.
- Support revision loop output.

## Cleanup After Replacement

- Demote `qa_blog_article` and `resolve_blog_article_qa` from prompt-facing
  tools once generic review powers content workflows.

## Positive Tests

- Standard review produces one review artifact.
- Findings include severity, evidence, required revision, and decision.
- Revision loop records before/after artifact references.

## Negative Tests

- `none` depth must not create fake review approval.
- Review cannot approve when blocking findings remain unresolved.
- Review payload cannot include secrets or raw env/log dumps.

## Edge Tests

- Multimodal review provider unavailable degrades to transcript/metadata/frame
  review with explicit limitation.
- Aggressive review produces multiple passes without overwriting prior results.
- Review of empty artifact fails with useful error.

