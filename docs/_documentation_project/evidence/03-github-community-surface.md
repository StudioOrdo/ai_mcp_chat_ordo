# Phase 03 Evidence: GitHub Community Surface

Date: 2026-05-07

Status: Complete

## Outputs

- Rewrote `CONTRIBUTING.md` around the current issue-first alpha contribution posture.
- Removed the stale `docs/operations/release-gates-and-evidence.md` link from `CONTRIBUTING.md`.
- Created `.github/ISSUE_TEMPLATE/alpha-feedback.yml`.
- Created `.github/ISSUE_TEMPLATE/bug-report.yml`.
- Created `.github/ISSUE_TEMPLATE/qa-report.yml`.
- Created `.github/ISSUE_TEMPLATE/docs-feedback.yml`.
- Created `.github/ISSUE_TEMPLATE/config.yml`.
- Preserved `.github/ISSUE_TEMPLATE/agent-runtime-integrity.yml` unchanged.
- Updated `docs/state-of-the-project.md` with a narrow factual correction so the public ledger reflects the newly created GitHub issue-template surface.
- Updated `docs/_documentation_project/phases/03-github-community-surface.md` to `Status: Complete`.
- Wrote the Phase 04 handoff to `docs/_refactor/ordo/prompts/next.md`.
- Archived the same Phase 04 handoff at `docs/_documentation_project/prompts/archive/04-public-prose-polish-and-cognitive-load-pass.md`.

## GitHub Surfaces Created

- Alpha feedback: for concrete feedback from trying Ordo, seeing a demo, or discussing alpha direction.
- Bug report: for product, install, command, workflow, and UI failures.
- QA report: for structured evidence that can become a deterministic test, reproduction, or work order.
- Docs feedback: for stale, confusing, broken, or overclaiming documentation.
- Issue-template config: disables blank issues and points readers to the state ledger and contribution guide.

## Claims Bounded Or Rejected

- GitHub automation remains not shipped. `CONTRIBUTING.md` says public GitHub automation is not a shipped product claim.
- QA reports are framed as alpha intake material for human and agent validation, not as automatic GitHub issue emission.
- Broad code PRs remain constrained during alpha shaping.
- No claim was added that Ordo automatically files or resolves GitHub issues.

## QA Pass 1

- Ran `/usr/bin/find .github -maxdepth 3 -type f | /usr/bin/sort`.
- Ran the required automation/contribution-language scan with grep fallback because `rg` is unavailable. Matches were expected alpha/QA language; no `automatically files`, `automatically resolves`, or old `submit Pull Requests` phrase remained.
- Checked diagnostics for `CONTRIBUTING.md` and all GitHub issue-template YAML files: no errors reported.
- Parsed all `.github/ISSUE_TEMPLATE/*.yml` files with Ruby/Psych: all parsed successfully.
- Checked issue forms, excluding `config.yml`, for required top-level fields: `name`, `description`, `title`, `labels`, and `body`.
- Scanned changed contribution/GitHub files for `docs/operations`: no matches.
- Scanned changed contribution/GitHub files for unsupported automatic issue claims: no matches.
- Checked local markdown links in `CONTRIBUTING.md`: all local links resolve.

## QA Pass 2

- Re-read `CONTRIBUTING.md` as a first-time QA volunteer: it now explains what help is useful and which template to use.
- Re-read templates as a bug reporter, docs reporter, QA reporter, and alpha participant: fields stay short and evidence-first.
- Re-read as maintainer/agent: issue forms collect route/surface, evidence, reproduction, and expected/actual behavior where useful.
- Confirmed runtime-integrity template was preserved.
- Confirmed active and archived Phase 04 prompts match after handoff.

## Environment Notes

- `rg` is unavailable or not resolvable in this environment; grep fallback was used.
- Shell `PATH` has been unreliable, so absolute system binaries and a minimal PATH were used where needed.
- The worktree had unrelated dirty changes before this phase. This phase only touched the files listed above.
