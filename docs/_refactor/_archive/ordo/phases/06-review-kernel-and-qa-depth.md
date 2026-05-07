# Phase 06: Review Kernel And QA Depth

Status: Planned

Related specs:

- `../specs/06-review-kernel-and-qa-depth.md`

## Goal

Extract a generic review kernel from existing blog/factory QA behavior.

## Current Code To Research

- `src/lib/blog/blog-article-production-service.ts`
- `src/core/use-cases/BlogArticlePipelineModel`
- `tests/blog-article-production-service.test.ts`
- `tests/factory/qa-runtime.test.ts`
- `tests/factory/qa-checks.test.ts`

## Required Work

- Define `Review`, `ReviewFinding`, `ReviewSubjectKind`, and `QaDepth`.
- Add review service interface.
- Store review outputs as operation artifacts first.
- Support review/revise loop.

## Tests

Positive:

- standard depth creates one review.
- aggressive depth creates multiple review records.
- blocking findings prevent approval.

Negative:

- `none` depth cannot fake approval.
- review cannot cite missing artifact.

Edge:

- provider lacks multimodal support.
- empty subject.
- interrupted review run.

## Cleanup

- Keep blog QA wrappers until content workflow uses generic review.

## Exit Criteria

- Article/script workflow can depend on generic review.

