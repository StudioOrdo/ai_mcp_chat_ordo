# Phase 12: Pruning, Evals, And Closeout

Status: Planned

## Goal

Prove the new Ordo product shape works end to end, remove replaced surfaces, and
leave durable evidence for future development.

## Current Code To Refresh

- `src/core/capability-catalog/**`
- `src/lib/tools/tool-availability-service.ts`
- `src/lib/chat/tool-composition-root.ts`
- `src/lib/evals/**`
- `tests/evals/**`
- all routes touched by prior phases.

## Implementation Scope

- Run deterministic regression tests for public site, feed, offers, referrals,
  research, review, workflows, media, agent views, Rust boundaries, and access
  control.
- Add live/eval scenarios only where deterministic tests cannot verify the
  product behavior.
- Produce durable eval artifacts for the flagship workflow.
- Remove prompt-visible tools and routes that have tested replacements.
- Update package docs and phase closeouts with final evidence.

## Required Tests

Positive:

- first flagship workflow creates inspectable artifacts and feed output;
- public site routes pass;
- admin/staff/user/public access checks pass;
- eval artifacts are written and readable.

Negative:

- private corpus/admin/workflow/asset data is not public;
- replaced prompt-visible tools are unavailable after pruning;
- failed workflow steps produce inspectable errors.

Edge:

- empty feed;
- no configured offers;
- failed media generation;
- missing Rust executor when optional;
- stale blog/journal/library URLs after deletion.

## Cleanup

- Delete replaced feature-specific tool entries after replacement tests pass.
- Delete replaced public `/library`, `/journal`, and `/blog` routes after feed,
  offers, about, and internal corpus/asset replacements pass.
- Remove unused docs that point users to old product surfaces.

## Exit Criteria

- The new Ordo product shape is implemented, tested, documented, and smaller at
  the prompt/tool surface than the starting point.
