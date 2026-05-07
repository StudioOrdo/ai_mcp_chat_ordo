# GitHub Customization Plan

Status: Active setup

This plan defines how Ordo's public GitHub surface should invite useful
participation without overwhelming the maintainer or diluting the architecture.

## Goal

Make GitHub feel like the front desk of a serious open-source workshop.

People should understand:

- what Ordo is
- what kind of help is useful now
- how to report QA evidence
- why code PRs may be limited during alpha shaping
- how agents and humans turn reports into validated fixes
- how to follow the project without needing the entire internal doc tree

## Surfaces

- `.github/ISSUE_TEMPLATE/alpha-feedback.yml`
- `.github/ISSUE_TEMPLATE/bug-report.yml`
- `.github/ISSUE_TEMPLATE/qa-report.yml`
- `.github/ISSUE_TEMPLATE/docs-feedback.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `CONTRIBUTING.md`
- root `README.md`
- optional `.github/PULL_REQUEST_TEMPLATE.md` if code PR guidance becomes
  necessary

## Current Truth

The local repo now has the planned issue-template set:

- `.github/ISSUE_TEMPLATE/alpha-feedback.yml`
- `.github/ISSUE_TEMPLATE/bug-report.yml`
- `.github/ISSUE_TEMPLATE/qa-report.yml`
- `.github/ISSUE_TEMPLATE/docs-feedback.yml`
- `.github/ISSUE_TEMPLATE/agent-runtime-integrity.yml`
- `.github/ISSUE_TEMPLATE/config.yml`

The Studio Ordo organization repository is available at
`StudioOrdo/ai_mcp_chat_ordo`. At the time this plan was updated, the GitHub CLI
reported admin permission for the current operator. Issues are enabled, the
manufacturing label set has been created, and the organization repository is
behind the local personal remote. The repository cutover should not be treated
as complete until branch state and release posture are aligned.

The docs describe a future QA-to-GitHub-to-agent triage loop. The code has real
QA report and factory/work-order entities, but automatic public GitHub issue
emission is not yet wired as a claimable product feature.

## Public Wording Rule

Use this framing until the bridge is implemented:

> During alpha, we are shaping QA reports into the intake layer for GitHub issues
> and agent-assisted triage. Good reports should include enough evidence to turn
> the issue into a deterministic test, reproduction, or docs correction.

Do not claim that Ordo automatically files or resolves GitHub issues until the
integration exists and is validated.

## Manufacturing Direction

GitHub should become the visible work ledger:

- issues hold public intake and accepted work;
- labels make state, type, surface, and governance risk visible;
- pull requests carry implementation evidence;
- closeout comments record tests, QA passes, visual review, and remaining risks;
- release evidence points back to closed issues and merged pull requests.

The detailed operating contract lives in
`docs/_business/08_software_manufacturing_loop.md`.

## Issue Template Principles

- Ask for evidence, not opinions alone.
- Use role/surface fields so reports can become deterministic work.
- Keep forms short enough for volunteers.
- Give a free-text path for meetup conversations and first-time testers.
- Label templates so triage can sort QA, bug, docs, install, and idea reports.

## Acceptance Standard

The final GitHub surface should feel welcoming but bounded:

- QA volunteers know exactly what to file.
- AI consultants and product engineers understand where they fit.
- Code contributors understand why architecture-sensitive PRs are gated.
- The maintainer gets actionable evidence, not a new inbox full of ambiguity.
