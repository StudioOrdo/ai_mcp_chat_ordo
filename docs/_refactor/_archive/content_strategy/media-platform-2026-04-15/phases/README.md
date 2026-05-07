# Media Platform Phase Packets

Date: 2026-04-15

## Purpose

These packets are the execution control layer for the media platform workstream.

They exist to reduce stale assumptions, architecture drift, and under-tested route work while the media specs move from design into code.

The loop is the same as the refactor packets:

1. create a stub
2. refresh it against current code
3. run pre-implementation QA
4. write the detailed implementation plan from verified state
5. implement
6. run post-implementation QA
7. update the packet and hand off cleanly

## Why Packets Instead Of Loose Sprint Notes

The media work crosses schema, RBAC, route, UI, and storage-policy seams. Loose sprint notes make it too easy to solve the visible UI problem while silently weakening the underlying architecture.

These packets keep the work tied to source anchors, verification commands, and explicit guardrails.

## Required Loop

### 1. Stub Creation

- Start from the packet file in this folder.
- Do not assume the stub is current truth.
- Leave the verified-state section empty until current code has been re-read.

### 2. Refresh Against Current Code

- Re-read the listed source anchors.
- Update the verified-state notes.
- Record any schema, RBAC, or route changes that affect the phase.

### 3. Pre-Implementation QA

- Capture current diagnostics for the touched files.
- Capture the relevant baseline tests and failures.
- Record exact verification commands and evidence targets.

### 4. Detailed Implementation Plan

- Fill the packet only from verified state.
- Break the work into small patches.
- Record explicit non-goals and risky rollback points.

### 5. Implementation

- Implement the packet.
- Update the implementation record as changes land.
- Do not silently expand scope.

### 6. Post-Implementation QA

- Run targeted tests.
- Run changed-file diagnostics.
- Verify exit criteria, not just green tests.

### 7. Handoff

- Update packet status.
- Update the status board.
- Record what the next phase should now assume.

## Hard Rules

1. Do not widen `/admin` authorization just to make the media workspace easier.
2. Do not add a second media preview or delivery path when `/api/user-files/[id]` already owns that contract.
3. Do not scan `.data/user-files` in request-time route loaders.
4. Do not let page files become query and formatting monoliths.
5. Do not add schema columns before recording the query pressure that justifies them.
6. Do not mark a phase complete without positive, negative, and edge-case evidence.

## Packet Contents

Each packet includes:

- phase intent
- source anchors to refresh
- current-state questions
- drift traps
- pre-implementation QA gate
- verified current state
- suggested verification commands
- expected evidence artifacts
- detailed implementation plan section
- scope guardrails
- implementation record
- post-implementation QA
- exit criteria
- handoff

## Status Board

- [status-board.md](./status-board.md)

## Template

- [_template.md](./_template.md)

## Phase Files

| Phase | File | Purpose |
| --- | --- | --- |
| 0 | [phase-0-query-contracts-and-guardrails.md](./phase-0-query-contracts-and-guardrails.md) | define query seams, pagination rules, and architecture guardrails |
| 1 | [phase-1-storage-accounting-foundation.md](./phase-1-storage-accounting-foundation.md) | turn persisted bytes into reusable summaries and reconciliation |
| 2 | [phase-2-my-media-route-v1.md](./phase-2-my-media-route-v1.md) | ship the first user-facing media route |
| 3 | [phase-3-operations-workspace-and-metadata-promotion.md](./phase-3-operations-workspace-and-metadata-promotion.md) | add the staff or admin workspace and decide metadata promotion |
| 4 | [phase-4-capacity-and-quotas.md](./phase-4-capacity-and-quotas.md) | expose quota and host-capacity behavior safely |
| 5 | [phase-5-enforcement-and-operational-hardening.md](./phase-5-enforcement-and-operational-hardening.md) | add enforcement, cleanup hardening, and subsystem architecture audits |
| 6 | [phase-6-portability-and-delivery-baseline.md](./phase-6-portability-and-delivery-baseline.md) | lock governed delivery and cross-runtime artifact continuity onto one portable baseline |
