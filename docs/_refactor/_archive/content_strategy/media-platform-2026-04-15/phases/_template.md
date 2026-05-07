# Phase N — Title

> Status: Stub
> Loop State: Not refreshed
> Goal: Replace with the phase goal
> Prerequisites: Replace with prerequisite phases or baseline assumptions

## Phase Intent

Write one paragraph explaining why this phase exists and what architectural change it is meant to accomplish.

## Source Anchors To Refresh

- [path/to/file.ts](path/to/file.ts#L1)
- [path/to/file.ts](path/to/file.ts#L1)
- [path/to/file.ts](path/to/file.ts#L1)

## Current-State Questions

- Which assumptions in this packet are still true?
- Which seams have already shifted?
- Which tests or route behaviors are most likely to drift?

## Drift Traps

- List the easiest ways an implementation could solve the wrong problem.
- List the main architecture blind spots.
- List any naming or documentation mismatches likely to mislead the phase.

## Pre-Implementation QA Gate

- [ ] Refresh current diagnostics for the touched files.
- [ ] Refresh current tests and baseline failures for the touched subsystem.
- [ ] Confirm the listed source anchors are still the right seam for this phase.
- [ ] Record exact verification commands for this phase.
- [ ] Update this packet's verified-state notes and evidence targets before writing the detailed plan.

## Verified Current State

Fill this section in at phase start.

### Current Code Notes

- To be filled.

### Current QA Notes

- To be filled.

## Suggested Verification Commands

```bash
# Replace with the exact commands for this phase.
```

## Expected Evidence Artifacts

- Replace with the concrete evidence an agent must leave behind.

## Detailed Implementation Plan

Fill this section in only after the refresh and QA gate are complete.

1. Step one
2. Step two
3. Step three

## Scope Guardrails

- Explicit non-goal
- Explicit non-goal

## Implementation Record

- Date:
- Files changed:
- Summary of what landed:
- Deviations from the detailed plan:

## Post-Implementation QA

- [ ] Run targeted tests.
- [ ] Run changed-file diagnostics.
- [ ] Re-read the source anchors and confirm the intended seam actually changed.
- [ ] Record residual risks and follow-on work.

## Exit Criteria

- Replace with the concrete phase exit criteria.

## Handoff

- What the next phase should now assume:
- What remains unresolved:
- What docs need updating:
