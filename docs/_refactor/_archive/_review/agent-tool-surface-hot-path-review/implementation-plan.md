# Implementation Plan

## Status

- Phase A is implemented through `docs/_refactor/appliance-lifecycle-proof/phases/01-prompt-exposure-budget-prerequisite.md`.
- Closeout evidence: `docs/_refactor/appliance-lifecycle-proof/evidence/01-prompt-exposure-budget-2026-05-02.md`.

## Phase A - Tool Surface Classification
Goal: make prompt exposure explicit without changing behavior.

Tasks:
- Add a catalog prompt exposure policy:
  - `default_prompt`
  - `intent_gated`
  - `operator_only`
  - `internal_only`
- Project default Anthropic tool schemas from that policy instead of role alone.
- Add tests proving executable tools can be hidden from the default prompt.
- Mark diagnostics and workflow internals as non-default where appropriate.

Expected candidates for non-default prompt exposure:
- `inspect_runtime_context`
- `inspect_runtime_logs`
- `inspect_theme`
- `adjust_ui`
- admin workflow internals unless operator mode is active

## Phase B - Job Query Tool Consolidation
Goal: remove duplicate self/admin job tools.

Tasks:
- Introduce one canonical job query service/read model.
- Replace `get_my_job_status` and `get_deferred_job_status` with one
  role-scoped `get_job_status` contract, or route both names through a single
  implementation before hard deletion.
- Replace `list_my_jobs` and `list_deferred_jobs` with one role-scoped
  `list_jobs` contract.
- Update catalog, runtime bindings, prompt hints, tests, and presentation.
- Hard delete stale tool names after tests are moved.

## Phase C - Blog/Journal Work-Order Consolidation
Goal: reduce 20 blog/journal tools to a smaller workflow surface.

Tasks:
- Define a work-order summary read model for journal/blog production.
- Collapse step-level journal mutation tools behind workflow commands.
- Keep direct admin UI actions where useful, but stop exposing all of them as
  agent tools.
- Decide whether `draft_content` and `publish_content` are superseded by the
  journal/blog workflow tools.
- Delete stale tests tied to old tool names after the new product flow is green.

## Phase D - Corpus Search Surface Simplification
Goal: make corpus retrieval one coherent read path.

Tasks:
- Keep `search_corpus` as the main tool.
- Confirm whether `get_section` is needed for exact citation/deep-link fetches.
- Move `get_corpus_summary`, `get_checklist`, and `list_practitioners` behind
  typed search modes or product read models if they are derived views.
- Align with Phase 02 search index execution.

## Phase E - Theme/Profile Preference Cleanup
Goal: avoid small UI tools polluting the main agent surface.

Tasks:
- Fold theme/preference operations into a profile/preferences boundary.
- Keep UI command handlers for direct UI interactions.
- Hide inspection/adjustment tools from default prompt unless there is an active
  UI customization request.

## Phase F - Registry Helper Prune
Goal: delete old abstraction left from pre-catalog registration.

Tasks:
- Remove unused generic bundle registration helpers if production code no longer
  needs them.
- Keep catalog-bound bundle registration only.
- Add guardrail test that production bundles are catalog-bound.

## Phase G - MCP Surface Review
Goal: keep the MCP architecture clean after Phase 03.

Tasks:
- Keep catalog-owned MCP exports behind the adapter registry.
- Review standalone MCP servers for duplication with `operations-server.ts`.
- Delete or document standalone MCP servers that are still intentionally separate.
- Keep exact adapter coverage and protocol round-trip tests.
