# Phase 02: Docs Index And Archive Cleanup

Status: Complete

## Goal

Rewrite `docs/README.md` so it reflects the current docs tree and reduces
cognitive load. Move only clearly legacy material into an archive with a
manifest.

## Governing Docs

- `docs/_documentation_project/README.md`
- `docs/_documentation_project/editorial-standard.md`
- `docs/_documentation_project/phase-plan.md`
- `docs/_documentation_project/evidence/00-inventory-and-editorial-map.md`
- `docs/state-of-the-project.md`

## Scope

- Update `docs/README.md` around active docs, business canon, refactor docs,
  corpus material, and archive boundaries.
- Archive legacy files only when the evidence map marks them as safe to move.
- Create an archive manifest for any moves.
- Keep `docs/_business` and `docs/_refactor/ordo` discoverable.

## Non-Goals

- Do not rewrite the business canon.
- Do not delete historical material.
- Do not move active governing docs.

## QA Pass 1

- Verify current docs tree.
- Rewrite `docs/README.md` for the actual tree.
- Move archive candidates, if any, with a manifest.
- Fix links created or changed by this phase.

## QA Pass 2

- Re-read the docs index for cognitive load.
- Confirm first-time readers can find the public entry point, state of project,
  business canon, active refactor material, and archive.
- Confirm the Phase 03 prompt is written and archived.

## Required Commands

```bash
find docs -maxdepth 3 -type f | sort
rg -n "_specs|_reference|operations/" docs/README.md README.md CONTRIBUTING.md
rg -n "docs/_business|docs/_refactor/ordo|docs/state-of-the-project" README.md docs/README.md
```

## Acceptance Criteria

- `docs/README.md` is accurate.
- Archive moves, if any, have a manifest.
- No active governing docs are hidden by cleanup.
- Phase 03 prompt is ready.
