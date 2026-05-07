# Phase 00: Rust Runtime Baseline And Boundary Map

Status: Planned

## Goal

Ground the Rust appliance plan in the current codebase before implementation.
The output is a boundary map that names what TypeScript owns, what Rust may own,
what contracts cross between them, and which current runtime risks justify the
native boundary.

This phase is the required first step when Node/Next work is active. It should
make later Rust work safer without changing runtime behavior.

## Current Code To Refresh

- `Cargo.toml`
- `crates/**`
- `Dockerfile`
- `compose.yaml`
- `compose.hosted.yaml`
- `package.json`
- `scripts/process-deferred-jobs.ts`
- `scripts/process-backup-scheduler.ts`
- `src/core/search/**`
- `src/lib/**backup**`
- `src/lib/**job**`
- `src/app/api/**health**`
- `docs/_refactor/rust_projects/**`

## Implementation Scope

- Inventory current Rust crates, binaries, Docker inclusion, and build scripts.
- Inventory TypeScript job, backup, media, search, health, and realtime owners.
- Identify exact schema owners for job payloads, media plans, status updates,
  search payloads, and crash payloads.
- Produce the first boundary map and risk register.
- Identify the safe pre-integration Rust work that can be done while Node
    remains the live runtime.
- Name phase-specific test targets before code changes begin.

## Out Of Scope

- Adding new Rust runtime behavior.
- Moving any job, search, realtime, or supervisor path.
- Changing queue payloads or Docker entrypoints.
- Adding dormant crates or binaries. That belongs to a later implementation
    slice after the map is written.

## Required Tests

This phase is documentation-grounding only. Run existing fast checks only if the
grounding uncovers a stale claim that needs immediate verification.

## Exit Criteria

- Boundary map names exact files and owners.
- Each future Rust responsibility has a current TypeScript fallback named.
- Each cross-process contract has a schema source of truth named.
- Evidence records current risks, stale assumptions, and implementation order.
- Evidence names the first inert Rust implementation slice and the integration
    work that must wait.
