# Media Evals And E2E Specs

This folder defines the evaluation program for system-level testing of media workflows in Studio Ordo.

The intent is to move from ad hoc workflow coverage toward an explicit, release-gated media-eval program with:

- a documented view of the existing testing infrastructure
- a scenario matrix for supported media combinations
- golden-path and recovery requirements for browser and deferred execution
- a gap analysis for missing surfaces and future architecture changes
- a regression prevention plan for pipeline bugs caught in live sessions

Documents in this folder:

- `media-testing-infrastructure.md` — verified current state of Playwright, Vitest, runtime-integrity, and release evidence (with ground-truth audits)
- `media-e2e-eval-program.md` — the proposed end-to-end eval program and acceptance requirements
- `media-combination-matrix.md` — the coverage matrix for media inputs, routes, outputs, and recovery behaviors
- `media-traceability-map.md` — matrix-to-test mapping showing which existing specs justify each status
- `journal-pipeline-dag-gap-analysis.md` — analysis of the current blog/journal pipeline and how to evolve toward DAG-style execution safely
- `pipeline-regression-plan.md` — regression prevention plan targeting bugs discovered in live session `conv_f5dd9a19` (NEW)

These specs are planning documents. They are intended to guide implementation of new eval scenarios, release checks, and future orchestration changes without breaking the current capability-catalog and deferred-job architecture.

## Last Audited

All infrastructure claims in `media-testing-infrastructure.md` and `media-traceability-map.md` were verified against the actual codebase on 2026-04-27. Claims have been corrected where the code diverged from the documentation.
