# Stage 14 - Cleanup And Cutover

## Goal

Retire duplicate concepts and route existing workflows through the core model.

## Build

- Identify duplicate artifact, workflow, QA, and projection code.
- Fold blog/journal production into content recipe vocabulary.
- Fold factory workflow screens into work-order projections.
- Replace private ad hoc status models with core states where safe.
- Update old docs to point to the architecture plan.

## Done

- New workflows have one obvious place to integrate.
- Old vertical systems still work but no longer define competing platform
  primitives.

## Guardrails

- Do not break shipped flows for vocabulary purity.
- Do not perform broad refactors without reviewable migration slices.
