# Phase 04: Public Prose Polish And Cognitive Load Pass

Status: Complete

## Goal

Run a high-care editorial pass across public docs so the writing becomes
succinct, powerful, inspirational, real, and grounded.

## Governing Docs

- `docs/_documentation_project/README.md`
- `docs/_documentation_project/editorial-standard.md`
- `README.md`
- `docs/README.md`
- `docs/state-of-the-project.md`
- `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE/*`

## Scope

- Tighten prose.
- Remove repetition.
- Reduce cognitive load.
- Preserve founder voice.
- Preserve technical trust and claim labels.
- Ensure the public docs feel connected rather than assembled.

## Non-Goals

- Do not introduce new product claims.
- Do not add new documentation sections unless a missing reader need is proven.
- Do not perform broad repo cleanup beyond public docs.

## QA Pass 1

- Read the full public surface set in order.
- Mark repetition, drag, hype, and unsupported claims.
- Edit for clarity and energy.

## QA Pass 2

- Read the first screen of each public surface as a new visitor.
- Confirm every page has a next step.
- Confirm the writing has rhythm without becoming decorative.
- Confirm the Phase 05 prompt is written and archived.

## Required Commands

```bash
rg -n "revolutionary|seamless|cutting-edge|unlock|empower|world-class|AI-powered|TODO|TBD|coming soon|fake|sample" README.md docs/README.md docs/state-of-the-project.md CONTRIBUTING.md .github
rg -n "Implemented|Active refactor|Alpha track|Vision|July 31, 2026|QA volunteer|AGPL" README.md docs/state-of-the-project.md CONTRIBUTING.md
```

## Acceptance Criteria

- Public prose is noticeably tighter and more human.
- No public page creates unnecessary cognitive load.
- No grounded claim is lost during polish.
- Phase 05 prompt is ready.
