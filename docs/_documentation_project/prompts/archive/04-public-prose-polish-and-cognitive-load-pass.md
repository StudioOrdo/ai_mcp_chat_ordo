# Phase 04 Prompt: Public Prose Polish And Cognitive Load Pass

Implement `/Users/kwilliams/Projects/ordoSite/docs/_documentation_project/phases/04-public-prose-polish-and-cognitive-load-pass.md`.

Before executing, read `docs/_documentation_project/prompts/semi-autonomous-phase-execution.md` and use it as the standing operating contract for this documentation phase.

Heads down.

Phases 01-03 created the public front door, truth ledger, docs index, contribution guide, and GitHub issue-template surface. Phase 04 is the high-care editorial pass across the public surface set. Tighten prose, remove drag, preserve claim discipline, and make the surfaces feel connected without introducing new product claims.

## Governing Contracts

- `docs/_documentation_project/README.md`
- `docs/_documentation_project/editorial-standard.md`
- `docs/_documentation_project/phase-plan.md`
- `docs/_documentation_project/github-customization-plan.md`
- `docs/_documentation_project/prompts/semi-autonomous-phase-execution.md`
- `docs/_documentation_project/evidence/00-inventory-and-editorial-map.md`
- `docs/_documentation_project/evidence/01-root-readme-and-state-of-project.md`
- `docs/_documentation_project/evidence/02-docs-index-and-archive-cleanup.md`
- `docs/_documentation_project/evidence/03-github-community-surface.md`
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

## Core Invariant

This is a polish phase, not a new strategy phase.

The public docs should become more succinct, human, and connected. No grounded claim should be lost. No new product claim should appear unless the current evidence already supports it.

## Phase Scope

- Tighten prose across:
  - `README.md`
  - `docs/README.md`
  - `docs/state-of-the-project.md`
  - `CONTRIBUTING.md`
  - `.github/ISSUE_TEMPLATE/*.yml`
- Remove repetition and cognitive load.
- Preserve Keith's voice: direct, civic, ambitious, practical, serious, human, allergic to fluff.
- Preserve technical trust and claim labels.
- Ensure the public docs feel connected rather than assembled.
- Make small link/copy corrections only when needed to satisfy the polish standard.

## Non-Goals

- Do not introduce new product claims.
- Do not add new documentation sections unless a missing reader need is proven by the existing evidence.
- Do not add new GitHub templates.
- Do not perform broad repo cleanup beyond public docs.
- Do not move archive material.
- Do not rewrite business canon.

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
- `docs/_documentation_project/evidence/03-github-community-surface.md`

## Required Outputs

- Polished public docs/templates in the listed public surface anchors.
- Updated Phase 04 status from Planned to Complete when acceptance criteria are met.
- Phase 04 evidence file at `docs/_documentation_project/evidence/04-public-prose-polish-and-cognitive-load-pass.md`.
- Phase 05 prompt in `docs/_refactor/ordo/prompts/next.md`.
- Matching Phase 05 archived prompt in `docs/_documentation_project/prompts/archive/05-closeout-and-stop.md`.

## Editorial Rules

- Keep first screens light.
- Prefer one precise sentence over five explanatory ones.
- Cut repeated claims.
- Keep lists only where scanning helps.
- Keep issue-template fields short and purposeful.
- Replace abstraction with concrete nouns.
- Do not imitate any publication's style.
- Do not use unsupported hype terms.

## Claim Discipline Rules

- Preserve implemented, active refactor, alpha track, and vision boundaries.
- Do not claim automatic GitHub issue creation, automatic triage, automatic resolution, production readiness, or complete platform behavior.
- Do not blur archive/history with current truth.
- Do not turn business canon direction into shipped product behavior.
- If a sentence sounds stronger after polish, verify it still matches existing evidence.

## QA Pass 1

- Read the full public surface set in this order: `README.md`, `docs/state-of-the-project.md`, `docs/README.md`, `CONTRIBUTING.md`, then `.github/ISSUE_TEMPLATE/*.yml`.
- Mark repetition, drag, hype, unsupported claims, unclear next steps, and needless internal process detail.
- Edit for clarity and energy without widening scope.
- Confirm every edited link still points to a real local file or intentional external URL.
- Confirm issue-template YAML still parses after edits.

## QA Pass 2

- Read the first screen of each public doc as a new visitor.
- Read `docs/state-of-the-project.md` as a skeptical builder.
- Read `CONTRIBUTING.md` and issue templates as a QA volunteer.
- Confirm every page has a next step.
- Confirm the writing has rhythm without becoming decorative.
- Confirm no grounded claim was lost during polish.
- Confirm the Phase 05 prompt is written and archived.

## Required Commands

Run these after edits, adapting only if the local tool is unavailable:

```bash
rg -n "revolutionary|seamless|cutting-edge|unlock|empower|world-class|AI-powered|TODO|TBD|coming soon|fake|sample" README.md docs/README.md docs/state-of-the-project.md CONTRIBUTING.md .github
rg -n "Implemented|Active refactor|Alpha track|Vision|July 31, 2026|QA volunteer|AGPL" README.md docs/state-of-the-project.md CONTRIBUTING.md
```

If `rg` is unavailable, use `grep -RInE` with the same patterns and record the fallback. If shell `PATH` is unreliable, use absolute system binaries such as `/usr/bin/grep`.

## Static Scans

- Scan changed public markdown links and verify local targets exist.
- Parse `.github/ISSUE_TEMPLATE/*.yml` after edits.
- Scan public docs/templates for unsupported hype and unsupported automation claims.
- Scan for stale `docs/operations` references.

## Prompt Handoff Requirement

At closeout, write the next phase execution prompt to:

- `docs/_refactor/ordo/prompts/next.md`

Also copy the same prompt to:

- `docs/_documentation_project/prompts/archive/05-closeout-and-stop.md`

The next prompt must target:

- `/Users/kwilliams/Projects/ordoSite/docs/_documentation_project/phases/05-closeout-and-stop.md`

The next prompt must include exact phase path, governing docs, scope boundaries, public surface anchors, required outputs, QA pass 1 and QA pass 2, required commands/static scans, final answer requirements, the exact final stop prompt from Phase 05, and deterministic stop criteria.

## Do Not Stop Until

- Public prose is noticeably tighter and more human.
- No public page creates unnecessary cognitive load.
- No grounded claim is lost during polish.
- Changed markdown links resolve.
- YAML templates parse.
- Phase 04 status is updated from Planned to Complete.
- QA pass 1 is complete.
- QA pass 2 is complete.
- `docs/_refactor/ordo/prompts/next.md` contains the Phase 05 prompt.
- `docs/_documentation_project/prompts/archive/05-closeout-and-stop.md` contains the same Phase 05 prompt.
- Final answer lists files changed, commands/scans run, prose risks fixed, claims preserved, claims downgraded/rejected, QA fixes, next prompt files written, and remaining explicit risks.
