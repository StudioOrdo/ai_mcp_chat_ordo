# Contributing To Ordo

Thank you for helping make Ordo clearer, sturdier, and more useful.

Ordo is in active development toward a July 31, 2026 alpha. The most useful help right now is evidence-rich QA: clear reports, reproducible failures, screenshots, command output, broken links, confusing docs, and examples where the project claims too much.

The public work process is becoming GitHub-native: issues are the visible
intake and accepted-work ledger, and pull requests are evidence-bearing
implementation packages.

## Current Contribution Posture

At this stage, Ordo is issue-first.

Please do not open code pull requests for fixes or features unless the maintainer has asked for that specific change. The architecture is still being shaped around governed capabilities, durable jobs, QA reports, local persistence, and a Rust/TypeScript boundary. Broad code changes can create more review work than they remove.

That is a quality gate, not a closed door. Good issues give the maintainer and agents enough evidence to turn a report into a deterministic test, reproduction, docs correction, or scoped implementation issue.

## What To File

Use the issue template that matches what you found:

- **Alpha Feedback**: use when you tried Ordo, watched a demo, or discussed the alpha path and have concrete feedback.
- **Bug Report**: use when a product surface, command, install path, or workflow fails.
- **QA Report**: use when you have structured evidence that can become a test, reproduction, or work order.
- **Docs Feedback**: use when a public doc is stale, confusing, broken, or overclaiming.
- **Runtime Integrity Regression**: use when prompt/runtime truth drifts, retrieval or citation is wrong, or a rendered output violates its contract.

## Good Evidence

A useful issue usually includes:

1. What you tried.
2. The route, command, file, or surface involved.
3. Your role or runtime context, if relevant.
4. Expected behavior.
5. Actual behavior.
6. Screenshots, logs, command output, failing assertions, or links to affected docs.
7. Enough detail to turn the report into a deterministic reproduction or docs correction.

Reports do not need to be polished. They do need to be concrete.

## Current Truth Boundaries

The project has real foundations: durable jobs, factory/work-order orchestration, structured QA reports, browser/WASM media execution, hybrid local search, SQLite persistence, and backup/native command boundaries.

GitHub automation is not a shipped product claim. During alpha, Ordo is shaping QA reports into the intake layer for GitHub issues and agent-assisted triage. Good reports include enough evidence for a human and agent to validate the issue before implementation.

For the current public truth ledger, see [docs/state-of-the-project.md](docs/state-of-the-project.md). For the docs map, see [docs/README.md](docs/README.md).

## Code Contributions

Code contributions may become easier later. For now, architecture-sensitive implementation work is handled through small, governed GitHub issues and pull requests with evidence, QA, and maintainer review.

If you believe a code change is necessary, open an issue first and include the smallest useful reproduction or proof. The maintainer can then decide whether to ask for a patch, write the fix directly, or route the work through an agent-assisted implementation issue.

Accepted implementation issues should name the goal, governing docs, current
code anchors, non-goals, tests, visual QA expectations when relevant, and
closeout evidence required.

Pull requests should link the accepted issue and include:

- files changed;
- tests and commands run;
- QA pass 1 findings and fixes;
- QA pass 2 findings and fixes;
- screenshots or visual QA status when relevant;
- remaining explicit risks.

## Conduct

Be direct, specific, and respectful. Ordo is built around human authority plus machine follow-through; the public contribution surface should follow the same standard.
