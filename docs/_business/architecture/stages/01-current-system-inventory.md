# Stage 01 - Current System Inventory

## Goal

Map the current codebase before changing platform shape.

## Build

- Inventory capability catalog and runtime projections.
- Inventory jobs, work orders, stage runs, events, and timelines.
- Inventory artifacts, user files, materialization records, blog assets, and
  factory outputs.
- Inventory blog/journal production workflows.
- Inventory QA reporting and development process surfaces.
- Inventory QR/referral/lead/consult/deal/training process state.
- Mark every kernel primitive as `exists`, `partial`, `exists under another
  name`, or `new concept`.
- List duplicate concepts before implementation begins.
- Record where current code should be reused instead of replaced.

## Current Inventory Result

The initial inventory found:

- `Capability` exists and should be reused.
- `Recipe` is a new concept.
- `WorkOrder` exists as a factory aggregate but is not yet recipe-aware.
- `StageRun` exists and should be reused.
- `Artifact`, `Evidence`, and `QAReport` are partial and currently spread across
  several domain-specific shapes.
- `Release` is partial: factory release exists, but platform release mapping is
  not complete.
- `Projection` exists as timeline and business workflow read-model patterns.
- `Governance` is partial and should be split by policy domain.

## Positive Cases

- A planned primitive maps to one or more real code files.
- A planned primitive that does not exist is labeled `new concept`.
- Existing domain-specific models are kept visible when they overlap with the
  new architecture.
- The inventory makes the next implementation phase smaller.

## Negative Cases

- Do not write code during inventory.
- Do not create a new table or entity just because the architecture has a new
  name.
- Do not use `Recipe` as if it already exists in current source.
- Do not collapse artifact, evidence, QA, and materialization into one vague
  object.

## Edge Cases

- A primitive can be `partial` even when a similarly named file exists.
- A concept can exist under several domain-specific names and still need a
  shared adapter contract.
- Blog/journal production may be a better proof case for recipes than new
  scrollytelling code because it already has a full content workflow.
- Projections may be live projectors or materialized records; inventory should
  not force one storage strategy.

## Done

- Every planned kernel primitive has at least one current-code mapping or an
  explicit "new concept" label.
- Duplicate concepts are listed before implementation begins.
- The kernel and recipe docs say which concepts exist today and which are
  planned contracts.
- The next stage can define contracts without guessing at current code.

## Guardrails

- Do not implement new abstractions during inventory.
- Do not assume greenfield means ignoring shipped code.
- Do not let product ambition erase useful current implementation.
