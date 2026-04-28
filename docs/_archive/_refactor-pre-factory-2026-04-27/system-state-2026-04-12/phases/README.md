# Phase Packets

Date: 2026-04-12

## Purpose

These phase packets are the execution control layer for the refactor program.

They exist to reduce coding-agent drift, stale assumptions, hallucinated progress, and false confidence on a large codebase.

The intent is simple:

1. create a stub
2. refresh it against current code
3. run pre-implementation QA
4. write the detailed implementation plan from verified state
5. implement
6. run post-implementation QA
7. update the packet and hand off cleanly to the next phase

This is stricter than a normal sprint note on purpose.

## Why Phase Packets Instead Of Loose Sprint Notes

Phase packets are more reliable here because they anchor the work to architecture shifts rather than calendar assumptions.

Each packet is expected to survive multiple agent sessions and multiple implementation loops.

## Required Loop

### 1. Stub Creation

- Start from a packet file in this folder.
- Do not add implementation details yet.
- Keep the goal, source anchors, drift traps, and exit criteria intact.

### 2. Refresh Against Current Code

- Re-read the listed source anchors.
- Update the packet's verified-state section.
- Record any new constraints, regressions, or resolved assumptions.
- If the repo moved, adjust the phase scope before writing the detailed plan.

### 3. Pre-Implementation QA

- Capture current diagnostics for the touched area.
- Capture the relevant tests and baseline failures.
- Record exact verification commands and expected outputs.
- Do not write a detailed implementation plan until this step is complete.

### 4. Detailed Implementation Plan

- Fill in the packet's detailed plan section using only refreshed, verified state.
- Break work into small patches or checkpoints.
- Record explicit non-goals.
- Record rollback or containment strategy if the change is risky.

### 5. Implementation

- Execute the plan.
- Update the implementation record as changes land.
- Do not silently expand scope without updating the packet.

### 6. Post-Implementation QA

- Run targeted tests.
- Run changed-file diagnostics.
- Record any residual risk or intentionally deferred work.
- Verify exit criteria, not just passing tests.

### 7. Handoff

- Update the packet's status.
- Record what changed in the codebase.
- Record what the next phase should now assume.

## Hard Rules

1. Do not treat a stub as truth until its verified-state section has been refreshed.
2. Do not write implementation details before baseline QA is recorded.
3. Do not mark a phase complete without post-implementation QA evidence.
4. Do not delete old assumptions silently; move them to a superseded or resolved note if they mattered.
5. Do not let a phase packet turn into a changelog with no code anchors.
6. Do not move a phase between loop states without updating the status board.

## Packet Contents

Each packet includes:

- phase intent
- source anchors to refresh before planning
- current-state questions
- drift traps
- pre-implementation QA gate
- suggested verification commands
- expected evidence artifacts
- detailed implementation plan section
- implementation record
- post-implementation QA section
- exit criteria
- handoff section

## Status Board

- [status-board.md](./status-board.md)

## Template

- [_template.md](./_template.md)

## Phase Files

| Phase | File | Purpose |
| --- | --- | --- |
| 0 | [phase-0-guardrails-and-parity-gates.md](./phase-0-guardrails-and-parity-gates.md) | establish baseline QA, parity tests, and drift checks |
| 1 | [phase-1-chat-pipeline-decomposition.md](./phase-1-chat-pipeline-decomposition.md) | break the stream pipeline into explicit stages |
| 2 | [phase-2-provider-runtime-unification.md](./phase-2-provider-runtime-unification.md) | unify provider policy and runtime behavior |
| 3 | [phase-3-capability-catalog-and-registration-decomposition.md](./phase-3-capability-catalog-and-registration-decomposition.md) | decompose capability metadata and reduce registration drift |
| 4 | [phase-4-prompt-runtime-contracts-and-invalidation.md](./phase-4-prompt-runtime-contracts-and-invalidation.md) | tighten prompt-runtime contracts and invalidation |
| 5 | [phase-5-chat-and-job-event-separation.md](./phase-5-chat-and-job-event-separation.md) | separate assistant-state and job-state convergence |
| 6 | [phase-6-platform-delivery-boundary-cleanup.md](./phase-6-platform-delivery-boundary-cleanup.md) | clean up platform, route, and admin delivery seams |
| 7 | [phase-7-execution-target-abstraction-and-mcp-sidecars.md](./phase-7-execution-target-abstraction-and-mcp-sidecars.md) | add execution-target abstraction and container-ready MCP sidecars |
| 8 | [phase-8-core-pack-separation-and-heavy-runtime-externalization.md](./phase-8-core-pack-separation-and-heavy-runtime-externalization.md) | split core from packs and move heavy runtimes out of the main host |
| 9 | [phase-9-canonicalization-closeout-and-runtime-promotion.md](./phase-9-canonicalization-closeout-and-runtime-promotion.md) | close residual Phase 8 seams and choose the next non-host runtime |

## Recommended Use

If an agent is about to start a phase, open that phase packet first and update it before writing code.
