# Ordo Documentation Project

Status: Complete

This folder governs the public documentation and GitHub-facing writing work for
Ordo.

The goal is not to make more docs. The goal is to make the public face of the
project as careful, alive, grounded, and useful as the code.

## Core Claim

Great documentation is product work.

Ordo documentation should read like a serious product made by a serious builder:
succinct, powerful, inspirational, real, and specific.

The writing should carry Keith's voice: direct, civic, ambitious, practical,
technical without hiding behind jargon, and honest about what is built versus
what is still being shaped.

## Standard

Every public-facing document must pass four tests:

1. **Truth**: claims are grounded in repo evidence or clearly labeled as
   direction.
2. **Compression**: the reader gets the point without carrying the whole repo in
   their head.
3. **Energy**: the prose has conviction, rhythm, and human stakes.
4. **Usefulness**: every page gives the right next step for its audience.

This is documentation manufacturing. The same discipline used for code applies
to writing:

Collect -> Decide -> Draft -> QA -> Ground -> Revise -> Publish -> Review ->
Update

## Public Surfaces

The project owns these surfaces:

- `README.md`
- `docs/README.md`
- `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE/*`
- `.github` community metadata when added
- public state-of-project docs
- public alpha and QA volunteer docs
- docs archive manifests created during cleanup

## Active Inputs

- `docs/_business/01_founding_thesis.md`
- `docs/_business/02_the_bottega_model.md`
- `docs/_business/06_the_production_engine.md`
- `docs/_business/07_governance_and_process.md`
- `docs/_business/ordo_process.md`
- `docs/_business/ux/02-message-and-tone.md`
- `docs/_business/architecture/05-ordo-development-workflow.md`
- `docs/_documentation_project/prompts/semi-autonomous-phase-execution.md`
- `docs/_refactor/ordo/prompts/next.md`
- current code inventories for jobs, factory, QA, WASM/media, RAG/search,
  backup/restore, Rust/TypeScript boundaries, and public surfaces

## Operator Loop

The operator should be able to start each round with one instruction: read the
active prompt and execute the phase.

Agents use `prompts/semi-autonomous-phase-execution.md` as the standing
operating contract, then execute the phase named by
`docs/_refactor/ordo/prompts/next.md`. Each phase must update evidence, status,
the next prompt, and the archived prompt before stopping.

## Transition To GitHub Manufacturing

This documentation project closes the old markdown-first documentation phase
loop. The resulting public docs, issue templates, and evidence files become the
starting point for the GitHub-backed software manufacturing process.

After closeout:

- markdown remains the canon for product doctrine, UX contracts, architecture,
  and release evidence;
- GitHub issues become the visible intake and accepted-work ledger;
- pull requests become evidence-bearing implementation packages;
- the Studio Ordo organization repository becomes the target public home once
  branch state, issues, labels, templates, and release posture are aligned.

The governing process is now documented in
`docs/_business/08_software_manufacturing_loop.md`.

## Writing Rules

- Lead with the human promise, then prove it.
- Use short sections and strong nouns.
- Prefer one precise sentence over five explanatory ones.
- Do not turn the README into an architecture dump.
- Do not hide uncertainty; name what is implemented, active, planned, or not yet
  claimable.
- Do not use fake momentum language. Velocity must be tied to process and
  evidence.
- Do not over-explain internals to public readers.
- Preserve enough technical detail for serious builders to trust the project.

## Deterministic Stop Condition

This documentation project ends when all phases in `phase-plan.md` are marked
`Complete` and the active prompt contains the closeout stop message defined in
Phase 05.

At that point, agents must not invent more documentation phases. New writing
work requires a new explicit user request or a new project folder.
