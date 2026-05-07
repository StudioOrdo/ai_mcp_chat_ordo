# Phase 03 Prompt: GitHub Community Surface

Implement `/Users/kwilliams/Projects/ordoSite/docs/_documentation_project/phases/03-github-community-surface.md`.

Before executing, read `docs/_documentation_project/prompts/semi-autonomous-phase-execution.md` and use it as the standing operating contract for this documentation phase.

Heads down.

Phase 01 rewrote the README and created `docs/state-of-the-project.md`. Phase 02 repaired `docs/README.md` and deferred the stale `CONTRIBUTING.md` link to this phase. Phase 03 customizes the GitHub-facing contribution surface so QA volunteers, careful readers, and serious builders can submit useful evidence without being pulled into broad code-PR work.

## Governing Contracts

- `docs/_documentation_project/README.md`
- `docs/_documentation_project/editorial-standard.md`
- `docs/_documentation_project/phase-plan.md`
- `docs/_documentation_project/github-customization-plan.md`
- `docs/_documentation_project/prompts/semi-autonomous-phase-execution.md`
- `docs/_documentation_project/evidence/00-inventory-and-editorial-map.md`
- `docs/_documentation_project/evidence/01-root-readme-and-state-of-project.md`
- `docs/_documentation_project/evidence/02-docs-index-and-archive-cleanup.md`
- `README.md`
- `docs/README.md`
- `docs/state-of-the-project.md`
- `CONTRIBUTING.md`

## Core Invariant

GitHub should feel like the front desk of a serious open-source workshop.

A QA volunteer should know what to file. A careful reader should know how to report docs drift. A serious builder should understand why code PRs are constrained during alpha shaping. The maintainer should receive evidence, not ambiguity.

## Phase Scope

- Rewrite `CONTRIBUTING.md` so it matches the README, state ledger, and current issue-first contribution posture.
- Fix the stale `CONTRIBUTING.md` link to the missing `docs/operations/release-gates-and-evidence.md` path.
- Add or update concise issue templates for:
  - alpha feedback
  - bug reports
  - QA reports
  - docs feedback
  - issue-template config
- Preserve `.github/ISSUE_TEMPLATE/agent-runtime-integrity.yml` unless there is a clear, documented reason to adjust it.
- Clarify that public GitHub issue automation is alpha-track direction, not shipped behavior.
- Keep code PR expectations bounded unless the current contribution policy changes.

## Non-Goals

- Do not add automatic GitHub issue creation.
- Do not claim Ordo automatically files or resolves GitHub issues.
- Do not invite broad code PRs unless the contribution policy explicitly changes.
- Do not add social/community files that are not connected to the current alpha path.
- Do not rewrite the root README, docs index, state ledger, or business canon except for tiny link corrections strictly required by this phase.

## Current GitHub And Public-Doc Anchors

- `README.md`
- `docs/README.md`
- `docs/state-of-the-project.md`
- `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE/agent-runtime-integrity.yml`
- `.github/ISSUE_TEMPLATE/alpha-feedback.yml` if created
- `.github/ISSUE_TEMPLATE/bug-report.yml` if created
- `.github/ISSUE_TEMPLATE/qa-report.yml` if created
- `.github/ISSUE_TEMPLATE/docs-feedback.yml` if created
- `.github/ISSUE_TEMPLATE/config.yml` if created
- `docs/_documentation_project/github-customization-plan.md`
- `docs/_documentation_project/evidence/02-docs-index-and-archive-cleanup.md`

## Required Outputs

- Updated `CONTRIBUTING.md`.
- New or updated `.github/ISSUE_TEMPLATE/alpha-feedback.yml`.
- New or updated `.github/ISSUE_TEMPLATE/bug-report.yml`.
- New or updated `.github/ISSUE_TEMPLATE/qa-report.yml`.
- New or updated `.github/ISSUE_TEMPLATE/docs-feedback.yml`.
- New or updated `.github/ISSUE_TEMPLATE/config.yml`.
- Updated Phase 03 status from Planned to Complete when acceptance criteria are met.
- Phase 03 evidence file at `docs/_documentation_project/evidence/03-github-community-surface.md`.
- Phase 04 prompt in `docs/_refactor/ordo/prompts/next.md`.
- Matching Phase 04 archived prompt in `docs/_documentation_project/prompts/archive/04-public-prose-polish-and-cognitive-load-pass.md`.

## Editorial Rules

- Keep the contribution path welcoming but bounded.
- Ask for evidence, not opinions alone.
- Use short issue-template fields.
- Use plain role/surface labels.
- Avoid making first-time testers learn the internal process before they can report something useful.
- Preserve Keith's register: direct, practical, serious, human, allergic to fluff.

## Claim Discipline Rules

- GitHub issue automation is alpha-track direction unless implementation evidence proves otherwise.
- QA reports exist as structured artifacts; public GitHub issue emission is not claimable as shipped.
- The broader issue template set becomes implemented only after this phase creates and validates it.
- Code PR limits are policy, not a dismissal of contributors; explain the architecture reason plainly.
- Do not use production-ready, complete-platform, or automatic-resolution language.

## QA Pass 1

- Read the Phase 03 spec, GitHub customization plan, Phase 02 evidence, README, docs index, state ledger, and current `CONTRIBUTING.md`.
- Inspect current `.github` files with `find .github -maxdepth 3 -type f | sort`.
- Draft issue templates with short fields and evidence-first prompts.
- Validate YAML shape by inspection and, if available, repository tooling.
- Update `CONTRIBUTING.md` to match current README/state-ledger language.
- Confirm the stale `docs/operations/release-gates-and-evidence.md` link is removed or replaced with a real current path.

## QA Pass 2

- Read `CONTRIBUTING.md` as a first-time QA volunteer.
- Read each issue template as a person filing from a live bug, confusing doc, runtime regression, or alpha conversation.
- Remove fields that create friction without improving triage.
- Confirm labels, descriptions, and field names are clear.
- Confirm GitHub automation is framed as alpha-track direction, not current product behavior.
- Confirm the Phase 04 prompt is written and archived.

## Required Commands

Run these after edits, adapting only if the local tool is unavailable:

```bash
find .github -maxdepth 3 -type f | sort
rg -n "automatically files|automatically resolves|submit Pull Requests|QA volunteer|alpha" .github CONTRIBUTING.md README.md docs/state-of-the-project.md
```

If `rg` is unavailable, use `grep -RInE` with the same pattern and record the fallback. If shell `PATH` is unreliable, use absolute system binaries such as `/usr/bin/find`, `/usr/bin/sort`, and `/usr/bin/grep`.

## Static Scans

- Scan `.github/ISSUE_TEMPLATE/*.yml` for required YAML fields: `name`, `description`, `title`, `labels`, and `body`.
- Scan changed docs for stale references to `docs/operations`.
- Scan changed docs/templates for unsupported automatic GitHub issue creation or resolution claims.
- Scan local markdown links in `CONTRIBUTING.md` and verify targets exist.

## Prompt Handoff Requirement

At closeout, write the next phase execution prompt to:

- `docs/_refactor/ordo/prompts/next.md`

Also copy the same prompt to:

- `docs/_documentation_project/prompts/archive/04-public-prose-polish-and-cognitive-load-pass.md`

The next prompt must target:

- `/Users/kwilliams/Projects/ordoSite/docs/_documentation_project/phases/04-public-prose-polish-and-cognitive-load-pass.md`

The next prompt must include exact phase path, governing docs, scope boundaries, public surface anchors, required outputs, editorial rules, claim discipline, QA pass 1 and QA pass 2, required commands/static scans, final answer requirements, prompt handoff requirement for Phase 05, and deterministic stop criteria.

## Do Not Stop Until

- `CONTRIBUTING.md` is public-facing, accurate, and no longer stale.
- Required issue templates exist and are concise.
- Existing runtime-integrity template is preserved or any change is justified in evidence.
- Changed markdown links resolve.
- YAML templates are valid by inspection and any available tooling.
- Phase 03 status is updated from Planned to Complete.
- QA pass 1 is complete.
- QA pass 2 is complete.
- `docs/_refactor/ordo/prompts/next.md` contains the Phase 04 prompt.
- `docs/_documentation_project/prompts/archive/04-public-prose-polish-and-cognitive-load-pass.md` contains the same Phase 04 prompt.
- Final answer lists files changed, commands/scans run, GitHub surfaces created, stale references fixed, claims downgraded/rejected, QA fixes, next prompt files written, and remaining explicit risks.
