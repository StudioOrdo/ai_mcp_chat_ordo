# Phase 02 Prompt: Docs Index And Archive Cleanup

Implement `/Users/kwilliams/Projects/ordoSite/docs/_documentation_project/phases/02-docs-index-and-archive-cleanup.md`.

Before executing, read `docs/_documentation_project/prompts/semi-autonomous-phase-execution.md` and use it as the standing operating contract for this documentation phase.

Heads down.

Phase 01 rewrote the root README and created `docs/state-of-the-project.md`. Phase 02 repairs the docs index and archive boundaries so public readers do not treat stale folders or old phase packets as current product truth.

## Governing Contracts

- `docs/_documentation_project/README.md`
- `docs/_documentation_project/editorial-standard.md`
- `docs/_documentation_project/phase-plan.md`
- `docs/_documentation_project/github-customization-plan.md`
- `docs/_documentation_project/prompts/semi-autonomous-phase-execution.md`
- `docs/_documentation_project/evidence/00-inventory-and-editorial-map.md`
- `docs/_documentation_project/evidence/01-root-readme-and-state-of-project.md`
- `README.md`
- `docs/state-of-the-project.md`
- `docs/_business/01_founding_thesis.md`
- `docs/_business/02_the_bottega_model.md`
- `docs/_business/07_governance_and_process.md`
- `docs/_business/ordo_process.md`
- `docs/_business/ux/02-message-and-tone.md`

## Core Invariant

`docs/README.md` must become a truthful map of the current docs tree.

First-time readers should find the public entry point, state ledger, business canon, active refactor material, corpus material, and archive without being sent into stale paths as if they were current contracts.

## Phase Scope

- Rewrite `docs/README.md` around the actual docs tree.
- Keep `README.md` and `docs/state-of-the-project.md` as the public front door and truth ledger.
- Keep `docs/_business` and `docs/_refactor/ordo` discoverable.
- Classify current docs areas by audience and truth status.
- Move only clearly legacy material into an archive when Phase 00 evidence and current tree checks make the move safe.
- Create or update an archive manifest for any archive moves made in this phase.
- Fix links created or changed by this phase.

## Non-Goals

- Do not rewrite the root `README.md`; Phase 01 owns it.
- Do not rewrite `CONTRIBUTING.md`; Phase 03 owns it.
- Do not add or redesign GitHub issue templates; Phase 03 owns GitHub community surface.
- Do not rewrite the business canon.
- Do not delete historical material.
- Do not move active governing docs.
- Do not treat old archive/spec material as current product truth.

## Current-Code And Public-Doc Anchors

- `README.md`
- `docs/README.md`
- `docs/state-of-the-project.md`
- `CONTRIBUTING.md`
- `docs/_documentation_project/evidence/00-inventory-and-editorial-map.md`
- `docs/_documentation_project/evidence/01-root-readme-and-state-of-project.md`
- `docs/_documentation_project/phases/02-docs-index-and-archive-cleanup.md`
- `docs/_business/README.md`
- `docs/_business/01_founding_thesis.md`
- `docs/_business/02_the_bottega_model.md`
- `docs/_business/06_the_production_engine.md`
- `docs/_business/07_governance_and_process.md`
- `docs/_business/ordo_process.md`
- `docs/_corpus`
- `docs/_refactor/ordo`
- `docs/_archive`
- `.github/ISSUE_TEMPLATE/agent-runtime-integrity.yml`

## Required Outputs

- Updated `docs/README.md`.
- Archive manifest if any files are moved during this phase.
- Updated Phase 02 status from Planned to Complete when acceptance criteria are met.
- Phase 03 prompt in `docs/_refactor/ordo/prompts/next.md`.
- Matching Phase 03 archived prompt in `docs/_documentation_project/prompts/archive/03-github-community-surface.md`.

## Editorial Rules

- Lead with orientation, not folder trivia.
- Keep the docs index short and navigable.
- Use plain labels: public entry point, truth ledger, business canon, active process, source material, archive.
- Name stale or historical material honestly.
- Do not make readers carry old project history before they understand where to go.
- Preserve enough context for maintainers and agents to find the right operating docs.

## Claim Discipline Rules

- Public docs must distinguish current truth from archive/history.
- `docs/_business` is active north star and doctrine, not a claim that every idea is shipped.
- `docs/_documentation_project` is active governance for this docs project, not general product documentation.
- GitHub issue automation remains alpha-track direction unless new implementation evidence exists.
- Do not claim archive cleanup removed risk unless links and manifests prove it.

## QA Pass 1

- Read the Phase 02 spec and all governing docs.
- Verify the current docs tree with `find docs -maxdepth 3 -type f | sort`.
- Rewrite `docs/README.md` against the actual tree, not the stale prior index.
- If moving files, move only clearly legacy material and create/update a manifest explaining what moved and why.
- Verify every link created or changed by the phase.
- Confirm no active governing docs were hidden or moved.

## QA Pass 2

- Re-read `docs/README.md` as a first-time public reader.
- Re-read it as a serious builder looking for implementation truth.
- Re-read it as a QA volunteer looking for how to report useful evidence.
- Re-read it as a maintainer/agent looking for active process docs.
- Remove cognitive load, stale path references, and archive ambiguity.
- Confirm the Phase 03 prompt is written and archived.

## Required Commands

Run these after edits, adapting only if the local tool is unavailable:

```bash
find docs -maxdepth 3 -type f | sort
rg -n "_specs|_reference|operations/" docs/README.md README.md CONTRIBUTING.md
rg -n "docs/_business|docs/_refactor/ordo|docs/state-of-the-project" README.md docs/README.md
```

If `rg` is unavailable, use `grep -RInE` with the same patterns and record the fallback. If shell `PATH` is unreliable, use absolute system binaries such as `/usr/bin/find`, `/usr/bin/sort`, and `/usr/bin/grep`.

## Static Scans

- Scan changed docs for stale references to missing active top-level paths such as `docs/_specs`, `docs/_reference`, and `docs/operations`.
- Scan changed docs for archive/history language and verify it does not present historical specs as current contracts.
- Scan changed markdown links and verify local targets exist.
- Scan any archive manifest for clear move rationale.

## Prompt Handoff Requirement

At closeout, write the next phase execution prompt to:

- `docs/_refactor/ordo/prompts/next.md`

Also copy the same prompt to:

- `docs/_documentation_project/prompts/archive/03-github-community-surface.md`

The next prompt must target:

- `/Users/kwilliams/Projects/ordoSite/docs/_documentation_project/phases/03-github-community-surface.md`

The next prompt must include exact phase path, governing docs, scope boundaries, current GitHub/public-doc anchors, required outputs, editorial rules, claim discipline, QA pass 1 and QA pass 2, required commands/static scans, final answer requirements, prompt handoff requirement for Phase 04, and deterministic stop criteria.

## Do Not Stop Until

- `docs/README.md` is accurate against the current docs tree.
- Any archive moves have a manifest, or the phase explicitly records that no files were moved.
- Changed markdown links resolve.
- Phase 02 status is updated from Planned to Complete.
- QA pass 1 is complete.
- QA pass 2 is complete.
- `docs/_refactor/ordo/prompts/next.md` contains the Phase 03 prompt.
- `docs/_documentation_project/prompts/archive/03-github-community-surface.md` contains the same Phase 03 prompt.
- Final answer lists files changed, commands/scans run, archive moves or deferrals, stale references fixed, QA fixes, next prompt files written, and remaining explicit risks.
