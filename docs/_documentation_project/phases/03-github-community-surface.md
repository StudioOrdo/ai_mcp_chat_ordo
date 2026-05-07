# Phase 03: GitHub Community Surface

Status: Complete

## Goal

Customize GitHub-facing contribution surfaces so QA volunteers, careful readers,
and serious builders can provide useful evidence without drowning in process.

## Governing Docs

- `docs/_documentation_project/README.md`
- `docs/_documentation_project/editorial-standard.md`
- `docs/_documentation_project/github-customization-plan.md`
- `README.md`
- `docs/state-of-the-project.md`
- `CONTRIBUTING.md`

## Scope

- Update `CONTRIBUTING.md`.
- Add or update issue templates for alpha feedback, bug reports, QA reports,
  docs feedback, and issue-template config.
- Preserve the existing runtime integrity template unless there is a clear reason
  to adjust it.
- Clarify issue-first contribution expectations for the alpha path.

## Non-Goals

- Do not add automatic GitHub issue creation.
- Do not invite broad code PRs unless the contribution policy changes.
- Do not add social/community files that are not connected to the current alpha
  path.

## QA Pass 1

- Draft templates with short fields and evidence-first prompts.
- Validate YAML shape by inspection and, if available, repository tooling.
- Ensure labels and descriptions are clear.
- Update `CONTRIBUTING.md` to match README language.

## QA Pass 2

- Read the templates as a first-time QA volunteer.
- Remove fields that create friction without improving triage.
- Confirm GitHub automation is framed as alpha-track direction, not current
  product behavior.
- Confirm the Phase 04 prompt is written and archived.

## Required Commands

```bash
find .github -maxdepth 3 -type f | sort
rg -n "automatically files|automatically resolves|submit Pull Requests|QA volunteer|alpha" .github CONTRIBUTING.md README.md docs/state-of-the-project.md
```

## Acceptance Criteria

- GitHub templates are useful, concise, and aligned with current contribution
  policy.
- `CONTRIBUTING.md` is public-facing and not stale.
- Phase 04 prompt is ready.
