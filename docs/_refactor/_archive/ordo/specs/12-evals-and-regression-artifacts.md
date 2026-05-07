# Spec 12: Evals And Regression Artifacts

## Goal

Make the refactor provable by producing tests and durable conversation/eval
artifacts that humans can inspect.

## Current Code To Use

- `src/lib/evals/tool-coverage.ts`
- `src/lib/evals/tool-workflow-coverage.ts`
- `src/lib/evals/eval-artifacts.ts`
- `tests/evals/*`
- `scripts/run-live-tool-coverage-eval.ts`
- `scripts/run-live-tool-workflow-eval.ts`

## Required Work

- Add workflow eval for the flagship workflow:
  - research,
  - synthesis,
  - article,
  - review,
  - script,
  - review,
  - audio,
  - feed draft/publish action.
- Add artifact writer output for workflow run timeline.
- Add negative evals for hallucinated completion, job ID as asset ID, missing
  evidence, disabled provider, and blocked publish.
- Add public-route regression tests for `/`, `/feed`, `/offers`, `/about`,
  `/feed.xml`, `/feed.json`, and absence of public library/journal/blog
  surfaces.

## Cleanup After Replacement

- Remove eval scenarios that test only deprecated prompt-facing blog internals
  once generic workflow coverage exists.

## Positive Tests

- Evals leave `summary.md`, raw redacted JSON, and per-scenario timeline.
- Final assistant message references real operation/artifact IDs.
- Feed output is verifiable after workflow completion.

## Negative Tests

- Eval fails if assistant claims publication without operation state.
- Eval fails if unsupported tools are called.
- Eval fails if private data appears in artifact output.

## Edge Tests

- Live LLM produces extra prose but required completion token and tool sequence
  are still validated.
- Provider unavailable creates blocked artifact, not a test hang.
- Eval fixture can simulate media/audio completion quickly.
