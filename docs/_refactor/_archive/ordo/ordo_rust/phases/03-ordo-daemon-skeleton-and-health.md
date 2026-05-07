# Phase 03: Ordo Daemon Skeleton And Health

Status: Planned

## Goal

Introduce the single `ordo-daemon` process as a feature-flagged runtime shell
with health reporting, internal task ownership, SQLite connection policy, and no
product behavior migration yet.

During active Node work, this phase should produce an inert daemon binary that
can be built and tested directly but is not launched by Node, Docker, or compose.

## Current Code To Refresh

- `Cargo.toml`
- `crates/**`
- Docker build and runtime scripts.
- Next.js health endpoint and admin diagnostics.
- SQLite connection configuration in TypeScript and Rust.

## Implementation Scope

- Add daemon crate or binary structure.
- Add `/health` and `/ready` endpoints or equivalent local IPC checks.
- Define internal modules for jobs, realtime, search, scheduler, and appliance
  networking without activating them.
- Document SQLite pool and write ownership expectations.
- Add feature flags for each daemon subsystem.
- Keep all subsystems disabled and avoid connecting to production data unless a
  test explicitly provides a fixture database.

## Out Of Scope

- Replacing job execution, SSE, search, or networking.
- Adding multiple Rust daemons.
- Exposing daemon implementation details to regular owner UI.
- Starting the daemon from `npm run dev`, Docker, compose, or production boot.

## Required Tests

Positive:

- daemon starts and reports healthy with subsystems disabled;
- health endpoint reports version and enabled subsystem states;
- Docker image can include daemon binary.

Negative:

- invalid config reports degraded/unready state;
- health output does not leak secrets.

Edge:

- graceful shutdown closes SQLite and HTTP listeners;
- repeated start/stop does not leave ports occupied.

## Exit Criteria

- `ordo-daemon` exists as one process boundary.
- Subsystems are disabled by default until their phases prove behavior.
- Node and admin diagnostics have a documented future observation path, but no
  live dependency is introduced during runway mode.
