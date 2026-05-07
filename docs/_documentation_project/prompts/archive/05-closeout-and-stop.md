# Phase 05 Prompt: Closeout And Stop

Implement `/Users/kwilliams/Projects/ordoSite/docs/_documentation_project/phases/05-closeout-and-stop.md`.

Before executing, read `docs/_documentation_project/prompts/semi-autonomous-phase-execution.md` and use it as the standing operating contract for this documentation phase.

Heads down.

Phase 05 closes the documentation project. It does not start another documentation phase. Verify the evidence trail, public prose, GitHub surface, phase statuses, and final stop prompt. Then replace the active prompt with the exact stop message required by Phase 05.

## Governing Contracts

- `docs/_documentation_project/README.md`
- `docs/_documentation_project/editorial-standard.md`
- `docs/_documentation_project/phase-plan.md`
- `docs/_documentation_project/github-customization-plan.md`
- `docs/_documentation_project/prompts/semi-autonomous-phase-execution.md`
- `docs/_documentation_project/phases/05-closeout-and-stop.md`
- `docs/_documentation_project/evidence/00-inventory-and-editorial-map.md`
- `docs/_documentation_project/evidence/01-root-readme-and-state-of-project.md`
- `docs/_documentation_project/evidence/02-docs-index-and-archive-cleanup.md`
- `docs/_documentation_project/evidence/03-github-community-surface.md`
- `docs/_documentation_project/evidence/04-public-prose-polish-and-cognitive-load-pass.md`

## Core Invariant

This is the closeout phase.

Do not invent Phase 06. Do not reopen strategy. Do not add new public docs unless a final QA check proves a tiny correction is necessary for closeout.

## Phase Scope

- Verify all prior phase evidence exists.
- Verify public surfaces are coherent:
  - `README.md`
  - `docs/README.md`
  - `docs/state-of-the-project.md`
  - `CONTRIBUTING.md`
  - `.github/ISSUE_TEMPLATE/*.yml`
- Verify docs/GitHub surfaces are aligned.
- Verify all phase status lines are complete or explicitly documented.
- Record remaining risks or deferred work.
- Replace `docs/_refactor/ordo/prompts/next.md` with the exact final stop prompt.

## Non-Goals

- Do not start another documentation phase.
- Do not perform broad prose rewrites.
- Do not add new issue templates.
- Do not move archive material.
- Do not rewrite business canon.
- Do not edit product code.

## Public Surface Anchors

- `README.md`
- `docs/README.md`
- `docs/state-of-the-project.md`
- `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE/alpha-feedback.yml`
- `.github/ISSUE_TEMPLATE/bug-report.yml`
- `.github/ISSUE_TEMPLATE/qa-report.yml`
- `.github/ISSUE_TEMPLATE/docs-feedback.yml`
- `.github/ISSUE_TEMPLATE/agent-runtime-integrity.yml`
- `.github/ISSUE_TEMPLATE/config.yml`

## Required Outputs

- Updated Phase 05 status from Planned to Complete when acceptance criteria are met.
- Final closeout evidence file at `docs/_documentation_project/evidence/05-closeout-and-stop.md`.
- `docs/_refactor/ordo/prompts/next.md` replaced with the exact final stop prompt below.

## Exact Final Stop Prompt

Write exactly this to `docs/_refactor/ordo/prompts/next.md` at closeout:

```text
Documentation project complete. Do not start a new documentation phase unless the user explicitly asks for one.

Completed sequence:
- docs/_documentation_project/phases/00-inventory-and-editorial-map.md
- docs/_documentation_project/phases/01-root-readme-and-state-of-project.md
- docs/_documentation_project/phases/02-docs-index-and-archive-cleanup.md
- docs/_documentation_project/phases/03-github-community-surface.md
- docs/_documentation_project/phases/04-public-prose-polish-and-cognitive-load-pass.md
- docs/_documentation_project/phases/05-closeout-and-stop.md

If the user asks to resume product implementation, inspect the current repo state and write a fresh product phase prompt before editing code.
```

## QA Pass 1

- Review every changed public surface.
- Confirm final evidence files exist for Phases 00-04.
- Confirm phase files 00-04 are marked `Status: Complete`.
- Confirm Phase 05 has not been marked complete until final checks are done.
- Confirm no stale phase prompt remains in `docs/_refactor/ordo/prompts/next.md` after closeout.
- Confirm no public docs contradict the state ledger or contribution posture.

## QA Pass 2

- Run final static scans.
- Confirm all phases are marked `Complete` after closeout evidence is written.
- Confirm the exact stop prompt is present in `docs/_refactor/ordo/prompts/next.md`.
- Confirm public links still resolve.
- Confirm GitHub issue-template YAML still parses.

## Required Commands

Run these after any final edits, adapting only if the local tool is unavailable:

```bash
find docs/_documentation_project -maxdepth 4 -type f | sort
rg -n "revolutionary|seamless|cutting-edge|automatically files|automatically resolves|production ready|TODO|TBD" README.md docs .github CONTRIBUTING.md
rg -n "Documentation project complete" docs/_refactor/ordo/prompts/next.md
```

If `rg` is unavailable, use `grep -RInE` with the same patterns and record the fallback. If shell `PATH` is unreliable, use absolute system binaries such as `/usr/bin/find`, `/usr/bin/sort`, and `/usr/bin/grep`.

## Static Scans

- Scan public docs/templates for unsupported hype and unsupported automation/readiness claims.
- Scan public markdown links and verify local targets exist.
- Parse `.github/ISSUE_TEMPLATE/*.yml`.
- Verify final stop prompt exactness.

## Do Not Stop Until

- The documentation project has a closed evidence trail.
- All six phase files are marked `Status: Complete`.
- Final closeout evidence exists.
- Public docs/GitHub surfaces are aligned.
- Required final scans have run.
- `docs/_refactor/ordo/prompts/next.md` contains the exact final stop prompt.
- Final answer lists completed phases, changed files, checks run, and explicit remaining risks.
