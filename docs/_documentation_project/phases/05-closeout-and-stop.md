# Phase 05: Closeout And Stop

Status: Complete

## Goal

Close the documentation project with final evidence, final prose QA, and a
deterministic stop prompt.

## Scope

- Verify all prior phase evidence exists.
- Verify public surfaces are coherent.
- Verify docs/GitHub surfaces are aligned.
- Record remaining risks or deferred work.
- Replace `docs/_refactor/ordo/prompts/next.md` with the final stop message.

## Required Final Stop Prompt

Write exactly this to `docs/_refactor/ordo/prompts/next.md`:

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
- Confirm final evidence files exist.
- Confirm no stale phase prompts remain in `next.md`.

## QA Pass 2

- Run final static scans.
- Confirm all phases are marked `Complete` or documented as explicitly deferred.
- Confirm the stop prompt is present.

## Required Commands

```bash
find docs/_documentation_project -maxdepth 4 -type f | sort
rg -n "revolutionary|seamless|cutting-edge|automatically files|automatically resolves|production ready|TODO|TBD" README.md docs .github CONTRIBUTING.md
rg -n "Documentation project complete" docs/_refactor/ordo/prompts/next.md
```

## Acceptance Criteria

- The documentation project has a closed evidence trail.
- The active prompt has a deterministic stop condition.
- The final answer lists completed phases, changed files, checks run, and
  explicit remaining risks.
