# AI Phase Delivery Process

Date: 2026-04-21
Status: Active operating process

## Purpose

This is the default delivery process for feature work when you tell GitHub Copilot to execute a spec in phases.

The goals are simple:

1. reduce drift between spec, implementation, and reported status
2. stop premature completion claims
3. keep QA mandatory but lightweight
4. give Copilot a narrow set of rails to follow every time

This process is intentionally simple. It is meant to be the railroad tracks.

## The three required rails

Every active feature track should have only these three active execution rails:

1. Product contract
   This is the current truth of what the feature is.
   Existing file names can stay as they are, such as `README.md` or `spec.md`.

2. Phase plan
   This is the ordered list of phases and the intended delivery sequence.
   Existing file names can stay as they are, such as `implementation-plan.md` or `implementation-phases.md`.

3. Canonical tracker
   This is the single place for status, blockers, QA state, and release-readiness truth.
   Existing file names can stay as they are, such as `production-readiness-checklist.md`.

Do not create parallel progress trackers.
Do not spread status across multiple active docs.

## Status markers

Use the existing simple markers:

- `[ ]` not started
- `[-]` implementation or verification is in progress
- `[x]` complete and verified
- `[!]` blocked or needs decision

Rule:

- A phase is never `[x]` until its QA gate is actually passed.
- If code landed but QA is still open, the phase stays `[-]`.

## The default execution loop

When you say `do Phase N`, Copilot should follow this exact loop.

### Step 1: Refresh the phase before coding

Before Phase N begins, update Phase N with the relevant truth inherited from previous phases.

That update should be small and concrete.

It must include:

- what is already shipped from earlier phases that Phase N depends on
- what assumptions changed since the phase was first written
- what open debt or blockers from earlier phases still constrain Phase N
- which files and tests are now the primary surface for Phase N

This is the anti-drift handoff step.

Do not start coding against stale phase text.

### Step 2: Lock the phase slice

State the smallest honest scope for the phase slice being executed now.

That means:

- what this slice will change
- what it will not change
- what counts as done for this slice

This prevents hidden scope growth.

### Step 3: Implement the slice

Make the smallest set of changes needed to satisfy the phase slice.

Do not mix unrelated cleanup into the same slice unless it is required for correctness.

### Step 4: Run the minimum QA gate

Every slice must have a QA gate.

Keep it simple. The default gate is only three checks:

1. Focused behavior check
   The narrowest test or executable validation that proves the phase behavior.

2. Relevant regression check
   One nearby test or check that proves the phase did not break the adjacent surface.

3. Truth check
   Confirm the system reports the real outcome honestly.
   Examples:
   - fallback says fallback
   - blocked state says blocked
   - server path is not claimed as browser success
   - partial implementation is not labeled complete

If only one executable check exists, use that plus a truth check.

### Step 5: Update the tracker from observed evidence

After QA runs, update the canonical tracker from what was observed, not from intention.

Record:

- what passed
- what failed
- what remains open
- whether the phase stays `[-]` or can move to `[x]`

Never update the tracker ahead of validation.

### Step 6: Report completion honestly

Allowed outcomes after a phase slice:

- `implemented and verified`
- `implemented but QA still open`
- `blocked`
- `partially landed; next slice identified`

Never compress `implemented but unverified` into `done`.

## Required phase shape

Each phase in the phase plan should use this compact structure.

```md
## Phase N: Name

Goal:
- one sentence

Carry-forward reality:
- shipped dependency from earlier phases
- changed assumption or discovered truth
- open debt or blocker that still matters here

This phase changes:
- item
- item

This phase does not change:
- item
- item

Primary files:
- path
- path

QA gate:
- focused behavior check
- relevant regression check
- truth check

Exit criteria:
- concrete behavior is true
- QA gate passed
```

The `Carry-forward reality` section is mandatory before phase work begins.

## Required tracker shape

The canonical tracker should have only four active sections.

### 1. Current summary

- overall status
- current phase
- last updated by
- last updated date

### 2. Reality check

Short bullets about what is definitely true right now.

Only include observed facts.

### 3. Per-phase checklist

For each phase:

- goal
- implementation checklist
- QA gate
- exit criteria
- blockers if any

### 4. Release conditions

Global conditions that must be true before the feature is considered production ready.

## Anti-drift rules

These rules are the core of the process.

1. One active contract, one active phase plan, one active tracker.
2. Before starting a phase, refresh the phase text with carry-forward reality from earlier phases.
3. If implementation reveals the phase is wrong, update the phase before continuing.
4. If runtime behavior and spec disagree, the tracker must reflect the runtime truth immediately.
5. If QA is not run, the work is not complete.
6. If QA is ambiguous, the phase stays `[-]`.
7. Evidence beats intention every time.

## Simple QA policy

The QA process must stay lightweight.

Default rule:

- one focused executable check is mandatory
- one nearby regression check is strongly preferred
- one truth check is always mandatory

Truth checks are especially important for this repo because drift often shows up as status drift, fallback drift, and surface-contract drift rather than raw test failures.

## What Copilot should do by default

When the user says `do it`, Copilot should assume this sequence:

1. identify the current phase
2. update that phase's `Carry-forward reality` using what shipped earlier
3. implement the smallest valid slice
4. run the minimum QA gate
5. update the canonical tracker from observed evidence
6. report one of the allowed honest outcomes

Copilot should not ask the user to manage the bookkeeping unless blocked.

## What the user should have to say

The intended command surface is simple.

Examples:

- `do Phase 2`
- `continue the current phase`
- `refresh the next phase and execute it`
- `close the QA gap for this phase`

The process assumes the user does not want to manage ceremony manually.

## Recommended file naming pattern

For new feature tracks, prefer:

- `README.md` for product contract summary
- `implementation-phases.md` for ordered phase plan
- `production-readiness-checklist.md` for canonical tracker

This matches the strongest pattern already present in the current specs.

## Minimal definition of done

A phase is done only when all three are true:

1. the intended behavior for that phase exists
2. the QA gate for that phase passed
3. the tracker has been updated from observed evidence

If any of those are missing, the phase is not done.

## Why this process is the recommended baseline

The current specs already contain the best ingredients:

- clear product contracts
- staged delivery
- canonical readiness tracking
- explicit QA gates
- anti-drift language

The problem was not missing structure. The problem was too much room for stale phase text, status optimism, and drift between runtime truth and reported truth.

This process keeps the good parts and removes the extra ceremony.

In practice, the whole system reduces to this:

- refresh the phase
- do the work
- run QA
- update the tracker from evidence
- only then claim completion

That is the rail line.