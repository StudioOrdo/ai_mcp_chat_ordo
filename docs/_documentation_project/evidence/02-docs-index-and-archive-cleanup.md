# Phase 02 Evidence: Docs Index And Archive Cleanup

Date: 2026-05-07

Status: Complete

## Outputs

- Rewrote `docs/README.md` as the current docs index.
- Kept `README.md` and `docs/state-of-the-project.md` as the public front door and truth ledger.
- Kept `docs/_business` and `docs/_refactor/ordo` discoverable.
- Listed `docs/_archive` as archive/history only.
- Listed standalone root docs that need future classification without moving them.
- Made no archive moves in this phase.
- Updated `docs/_documentation_project/phases/02-docs-index-and-archive-cleanup.md` to `Status: Complete`.
- Wrote the Phase 03 handoff to `docs/_refactor/ordo/prompts/next.md`.
- Archived the same Phase 03 handoff at `docs/_documentation_project/prompts/archive/03-github-community-surface.md`.

## Archive Decision

No files were moved.

Phase 00 identified stale index paths and archive risk, but it did not prove ownership for the standalone root docs strongly enough to relocate them safely during this pass. The new index names those files as needing future classification instead of hiding or deleting them.

## Stale References Fixed Or Deferred

### Fixed

- Removed stale `docs/README.md` references to active top-level `docs/_specs`, `docs/_reference`, and `docs/operations`.
- Removed stale start-here routing to missing `operations/agentic-delivery-playbook.md`, `operations/architecture-diagrams.md`, and `_specs/README.md`.
- Replaced the old folder table with the actual current tree: `_archive`, `_business`, `_corpus`, `_debug`, `_documentation_project`, `_refactor`, and current standalone docs.

### Deferred

- `CONTRIBUTING.md` still links to `docs/operations/release-gates-and-evidence.md`, which is no longer present as an active path. Phase 03 owns `CONTRIBUTING.md` and should fix this while updating the GitHub-facing contribution surface.

## QA Pass 1

- Ran `/usr/bin/find docs -maxdepth 3 -type f | /usr/bin/sort` to verify the current docs tree.
- Ran the stale-path scan with grep fallback because `rg` is unavailable. Result: `docs/README.md` no longer matches stale active-path references; the remaining hit is in `CONTRIBUTING.md` and is deferred to Phase 03.
- Ran the active-path scan with grep fallback. Result: `README.md` and `docs/README.md` expose `docs/state-of-the-project`, `docs/_business`, and `docs/_refactor/ordo` paths.
- Checked `docs/README.md` diagnostics: no errors reported.
- Ran a local markdown link checker against `docs/README.md`: all local links resolve.

## QA Pass 2

- Re-read `docs/README.md` as a first-time reader: the top path now points to README, state ledger, business canon, and contributing.
- Re-read as a serious builder: state ledger and source-of-truth order are clear.
- Re-read as a QA volunteer: contributing remains visible, with the known stale link deferred to Phase 03.
- Re-read as a maintainer/agent: documentation project and active handoff prompt are discoverable.
- Confirmed active and archived Phase 03 prompts match after handoff.

## Environment Notes

- `rg` is unavailable or not resolvable in this environment; grep fallback was used.
- Shell `PATH` has been unreliable, so absolute system binaries were used for `find`, `sort`, `grep`, `cmp`, and focused git checks where needed.
- The worktree had unrelated dirty changes before this phase. This phase only touched the files listed above.
