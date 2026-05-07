# Software Manufacturing Loop: GitHub As The Visible Work Ledger

Status: Active operating direction

## Core Claim

Ordo should build software the same way it asks the product to run work:
through evidence, small contracts, reviewable execution, and visible closeout.

Markdown remains the canon. GitHub becomes the public work ledger.

## Why This Changes

The early Ordo process used markdown phase files because the system needed a
private drafting table: research, product canon, architecture contracts, and
agent handoff prompts could move quickly without pretending every thought was a
public commitment.

That stage has done its job.

The open-source project now needs a more visible manufacturing process:

- public issues for intake and accepted work;
- labels for status, surface, work type, and governance risk;
- pull requests as evidence-bearing work packages;
- closeout comments that record tests, screenshots, risks, and review state;
- release evidence that points back to closed issues and merged pull requests.

## Source Of Truth Split

### Markdown

Markdown owns durable doctrine:

- business canon;
- UX canon;
- architecture contracts;
- operating process;
- evidence standards;
- release notes and state ledgers;
- deep specs that are too large for an issue body.

Markdown should not become the primary queue for active public work.

### GitHub Issues

GitHub issues own visible work:

- QA reports;
- bugs;
- docs corrections;
- alpha feedback;
- accepted implementation slices;
- functional review findings;
- release-blocking regressions.

An issue is not just an inbox item. It is a manufacturing unit when accepted.

### Pull Requests

Pull requests own implementation evidence:

- linked issue;
- changed files;
- tests and commands run;
- screenshots or visual QA when relevant;
- QA pass 1 findings and fixes;
- QA pass 2 findings and fixes;
- explicit remaining risks.

## Manufacturing States

Use issue labels to make the state visible:

- `status:needs-triage`
- `status:needs-evidence`
- `status:accepted`
- `status:in-progress`
- `status:needs-functional-review`
- `status:blocked`
- `status:closed-with-evidence`

Use type labels to name the work:

- `type:qa-report`
- `type:bug`
- `type:docs`
- `type:ux`
- `type:architecture`
- `type:implementation`
- `type:regression`
- `type:alpha-feedback`

Use surface labels to route the work:

- `surface:chat`
- `surface:today`
- `surface:studio`
- `surface:people`
- `surface:offers`
- `surface:knowledge`
- `surface:system`
- `surface:install`
- `surface:docs`

Use governance labels when a change can affect trust:

- `governance:privacy`
- `governance:access`
- `governance:evidence`
- `governance:no-fake-intelligence`
- `governance:public-claim`

## Intake Loop

1. A person files an issue with evidence.
2. Maintainer or agent triages the report.
3. If evidence is missing, the issue receives `status:needs-evidence`.
4. If accepted, the issue receives `status:accepted` and a bounded scope.
5. Implementation happens in a branch and pull request.
6. The pull request links back to the issue.
7. Tests, static scans, and visual QA are recorded in the pull request.
8. Human functional review confirms the behavior.
9. The issue closes only when evidence and review agree.

## Accepted Issue Contract

An accepted implementation issue should include:

- goal;
- governing docs;
- current code anchors;
- source evidence;
- target behavior;
- non-goals;
- positive tests;
- negative tests;
- edge tests;
- static scans;
- visual QA expectations;
- closeout evidence required.

This is the GitHub-native version of the old phase spec.

## Agent Closeout Contract

Agent-assisted pull requests should close with:

- files changed;
- tests run;
- QA pass 1 issues found and fixed;
- QA pass 2 issues found and fixed;
- screenshots or visual QA status;
- docs/evidence updated;
- remaining explicit risks.

Do not close with vague success language.

## Automation Boundary

Do not claim Ordo automatically files or resolves GitHub issues until that path
is implemented and validated.

The current direction is:

- GitHub issues are the visible intake and work ledger.
- Agents can help draft issues, implement branches, and write evidence.
- Humans keep final authority over acceptance, merge, and release.

## Repository Direction

The Studio Ordo organization repository should become the public project home
when its branch state, issue settings, labels, templates, and release posture
are aligned.

Until cutover is complete, docs should clearly distinguish:

- current local/personal remote state;
- Studio Ordo organization target state;
- public issue process that is configured and available;
- automation that remains direction rather than shipped behavior.
