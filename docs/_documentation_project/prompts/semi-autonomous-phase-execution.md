# Semi-Autonomous Documentation Phase Execution Prompt

Use this prompt when the operator asks you to execute the next documentation phase.

Your job is to implement the active phase perfectly enough that the operator can run the process by saying: read the prompt, execute the phase, and hand off the next one.

This is semi-autonomous development. You are expected to read, research, implement, validate, document evidence, update status, and write the next prompt without needing the operator to restate the process.

## Operating Contract

Treat documentation as product work.

The public documentation and GitHub surface must become as serious, alive, grounded, and useful as the code. Do not treat the work as copy cleanup. Treat it as a bounded implementation phase with evidence, QA, and deterministic handoff.

The operator should not need to manage the phase mechanics. They provide intent and review outcomes. You manage execution.

## Start Here

1. Read `docs/_documentation_project/README.md`.
2. Read `docs/_documentation_project/editorial-standard.md`.
3. Read `docs/_documentation_project/phase-plan.md`.
4. Read `docs/_documentation_project/github-customization-plan.md`.
5. Read the active phase file named by the current handoff prompt.
6. Read `docs/_refactor/ordo/prompts/next.md` if it exists.
7. Read the latest archived prompt in `docs/_documentation_project/prompts/archive/` if the active prompt is missing or stale.
8. Check git status before editing and preserve unrelated worktree changes.

If `docs/_refactor/ordo/prompts/next.md` is missing but the correct archived prompt exists, restore `next.md` from the latest intended archived prompt before executing. Do not invent a different phase.

## Phase Execution Model

For each phase, do the work in this order:

1. Understand the phase.
2. Gather evidence.
3. Decide what is true.
4. Implement only the phase scope.
5. Run QA pass 1.
6. Fix issues found in QA pass 1.
7. Run QA pass 2.
8. Fix issues found in QA pass 2.
9. Update evidence and phase status.
10. Write the next phase prompt.
11. Archive the same next prompt.
12. Stop only when the phase acceptance criteria are met.

Do not skip evidence gathering because the answer seems obvious. The point of this project is disciplined prose grounded in the current repo.

## Claim Discipline

Every public-facing claim must be sorted into one of these categories:

- Implemented: supported by current code, tests, release evidence, or current docs.
- Active refactor: partially implemented or governed by active phase work.
- Alpha track: intended for the July 31, 2026 alpha but not currently claimable as shipped.
- Vision: strategic direction, not current product behavior.

Do not blur these categories.

Do not claim automatic GitHub issue creation, automatic triage, production readiness, or complete platform behavior unless the repo proves it with code and validation.

## Editorial Contract

Use Keith's register:

- direct
- civic
- ambitious
- practical
- human
- technically serious
- impatient with fluff
- protective of quality

The prose should be succinct, powerful, inspirational, real, and grounded.

Avoid generic marketing defaults. In particular, avoid unsupported uses of:

- revolutionary
- seamless
- cutting-edge
- unlock
- empower
- world-class
- AI-powered
- production ready
- complete platform

Use high editorial discipline, not imitation of any publication.

## Scope Control

Do only the current phase.

If the phase is an inventory phase, do not rewrite public docs.
If the phase is a README phase, do not redesign all GitHub issue templates.
If the phase is a GitHub surface phase, do not reopen the whole prose strategy.
If the phase is closeout, do not invent more phases.

Small fixes are allowed only when they are necessary to satisfy the phase acceptance criteria and do not widen the work.

## Required Phase Artifacts

Every phase must produce or update:

- the phase's required output files
- the phase evidence file, when required
- the phase status line
- `docs/_refactor/ordo/prompts/next.md`
- the matching archived prompt in `docs/_documentation_project/prompts/archive/`

The active prompt and archived prompt must contain the same next-phase instructions.

## Prompt Handoff Standard

At the end of every phase before Phase 05, write the next prompt so another agent can continue without asking the operator what to do.

The next prompt must include:

- exact phase file path
- governing docs
- phase-specific scope boundaries
- current code and public doc anchors
- required outputs
- editorial rules
- claim discipline rules
- QA pass 1 instructions
- QA pass 2 instructions
- required commands or searches
- static scans
- prompt handoff requirement for the following phase
- deterministic stop criteria
- final answer requirements

At the end of Phase 05, replace `docs/_refactor/ordo/prompts/next.md` with the stop prompt defined by `docs/_documentation_project/phases/05-closeout-and-stop.md`. Do not create Phase 06.

## QA Pass 1

Run the phase's required commands and searches.

Then verify:

- all named anchors exist or are explicitly marked missing
- public claims have evidence or direction labels
- docs do not contradict current code
- stale docs are not treated as active contracts
- GitHub customization is bounded by current truth
- prose changes match the editorial standard
- links point to real files or intentional documented placeholders

Fix every issue found before moving to QA pass 2.

## QA Pass 2

Re-read the changed files as a first-time public reader, a serious builder, a QA volunteer, and the maintainer.

Then verify:

- no overclaims remain
- no unsupported hype remains
- no repeated capability dumping remains
- every public surface has a clear next step
- evidence files match what was actually done
- phase status is accurate
- active and archived prompts match
- the next prompt points to the correct next phase

Fix every issue found.

## Final Answer Standard

When the phase is complete, answer the operator with a concise closeout:

- files changed
- evidence created or updated
- commands and scans run
- claims promoted
- claims downgraded or rejected
- QA pass 1 fixes
- QA pass 2 fixes
- next prompt files written
- remaining explicit risks

Do not bury the outcome in process narration. The operator needs to know what changed, what was proven, and what to do next.

## Deterministic Stop

Stop only when the current phase acceptance criteria are met and the next prompt handoff is complete.

If a blocker prevents completion, stop with:

- the blocker
- what was completed
- what remains
- the exact file or decision needed from the operator

Do not keep expanding the project to avoid stopping.
