# Phase 01 Evidence: Root README And State Of Project

Date: 2026-05-07

Status: Complete

## Outputs

- Rewrote `README.md` as the public front door.
- Created `docs/state-of-the-project.md` as the public truth ledger.
- Updated `docs/_documentation_project/phases/01-root-readme-and-state-of-project.md` to `Status: Complete`.
- Wrote the Phase 02 handoff to `docs/_refactor/ordo/prompts/next.md`.
- Archived the same Phase 02 handoff at `docs/_documentation_project/prompts/archive/02-docs-index-and-archive-cleanup.md`.

## Public Claim Changes

### Promoted

- Ordo as an AGPL AI business appliance / operator system for solopreneurs.
- Chat as the working surface and governed workflows as the engine.
- Software manufacturing as the development and operating method.
- Implemented foundations: deferred jobs, factory/work orders, QA reports, browser/WASM media execution, hybrid RAG/vector search, local SQLite persistence, backup/native command boundaries, and Rust/TypeScript foundation.
- July 31, 2026 alpha direction and evidence-rich QA volunteer participation.

### Downgraded Or Bounded

- Backup and restore are described as foundations, not complete end-user restore guarantees.
- GitHub issue automation is alpha-track direction, not shipped behavior.
- Broader GitHub issue-template coverage is planned for Phase 03, not claimed as current.
- YouTube follow path was not listed because no verified public path was found in this phase.

### Rejected

- Global production-readiness claims.
- Complete-platform claims.
- Claims that Ordo files or resolves GitHub issues without human review.
- Treating all `docs/_business` material as shipped product behavior.
- Treating archive material as current roadmap.

## QA Pass 1

- Checked changed docs with diagnostics: no errors reported for `README.md` or `docs/state-of-the-project.md`.
- Ran `npm run lint -- README.md docs/state-of-the-project.md` with a repaired PATH. ESLint reported both markdown files are ignored because no matching configuration was supplied; no lint errors were produced.
- Ran the required overclaim scan. `rg` is unavailable in this environment, so `/usr/bin/grep -nE` was used with the same pattern. Final result: no matches.
- Ran the required proof-term scan. Required terms are present across the README and state ledger.
- Ran a local markdown link checker against `README.md` and `docs/state-of-the-project.md`. Result: all local markdown links resolve.

## QA Pass 2

- Re-read the README as a first-time public reader: the first screen explains Ordo before capability detail.
- Re-read the state ledger as a serious builder: implemented, active refactor, alpha track, vision, and non-claims are separated.
- Re-read the participation language as a QA volunteer: help is framed around evidence-rich reports, not broad code PRs.
- Re-read the handoff as a maintainer/agent: active and archived Phase 02 prompts match and point to the correct phase.

## Environment Notes

- The terminal shell had an unreliable `PATH`; commands were run with a minimal PATH including `/opt/homebrew/bin`, `/usr/local/bin`, and system binaries.
- `rg` is not installed or not resolvable; grep fallback was used.
- The worktree had unrelated dirty changes before this phase. This phase only touched the files listed above.
