# Phase 11 - Release Evidence

## Goal

Collect enough evidence to trust the refactor as a release-quality behavior.

## Steps

1. Run focused unit tests from `validation-checklist.md`.
2. Run route and stream tests.
3. Run status tool guardrail tests.
4. Run eval tests affected by scenario rewrites.
5. Run browser proof.
6. Run lint or markdown diagnostics for changed docs.
7. Summarize command outputs, pass/fail counts, and skipped tests.
8. Summarize files touched by implementation.
9. Summarize dead code removed and retained compatibility paths.
10. Summarize residual risks and follow-up owners.

## Done

- Evidence covers code, tests, browser behavior, cleanup, and residual risk.
- Release evidence does not rely on the developer local DB.
