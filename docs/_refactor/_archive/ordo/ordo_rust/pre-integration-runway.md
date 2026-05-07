# Ordo Rust Pre-Integration Runway

Status: Paused
Date: 2026-05-06

## Purpose

This runway defines the Rust work that is safe to do while the Node/Next
application is still actively changing.

The goal is to prepare native runtime foundations without taking ownership of
production behavior. Rust can become ready; TypeScript remains the live product
runtime until an explicit later integration phase flips a feature flag with
parity evidence.

## Pause Decision

As of 2026-05-07, the dormant `ordo-daemon` package is sufficient preparation
for now. Do not add more Rust-only meta proofs, inventories, or drift guards
unless they unlock a concrete integration decision.

Resume this runway only when there is a specific activation question to answer,
such as process supervision, native executor adapter parity, generated schema
parity, crash/report integration, or a feature-flagged handoff from the current
Node-owned runtime.

## Current Work Mode

Use this mode only if the runway is explicitly resumed while Node product work
is active:

- build Rust crates and binaries that are not wired into production startup;
- add Rust-only tests, fixtures, and contract proofs;
- add TypeScript schema export utilities only when they do not change runtime
  behavior;
- add local CLI proofs that can be run manually or in focused tests;
- avoid Docker entrypoint, live worker, search, realtime, and route behavior
  changes unless a phase explicitly exits this runway.

## Safe Now

- Rust workspace inventory and crate layout cleanup.
- Placeholder binaries such as `ordo-daemon` and `ordo-supervisor` when they are
  inert by default.
- Shared contract fixtures for jobs, health, crash reports, events, and search.
- JSON-in/JSON-out executor harnesses modeled on `ordo-backup`.
- Redaction utilities and unit tests.
- Daemon health server proof on a non-production port.
- Supervisor CLI proof using dummy child commands.
- Documentation and evidence describing future integration points.

## Not Yet

- Replacing the Docker entrypoint.
- Running `ordo-daemon` as part of normal `npm run dev` or production startup.
- Taking over `job_queue` execution from Node.
- Replacing SSE, websocket, search, media composition, scheduler, or TLS flows.
- Changing existing job payloads to make Rust easier.
- Removing Node dependencies or fallbacks.
- Publishing crash telemetry by default.

## Readiness Gates

Before any Rust component becomes part of live runtime startup, the package must
show:

- generated or fixture-backed contract parity with TypeScript schemas;
- feature flag defaults that preserve current Node behavior;
- focused Rust tests and TypeScript adapter tests;
- a rollback path that is one config/flag change;
- evidence that secrets are redacted from logs and crash payloads;
- no product-facing UI exposure of Rust implementation nouns;
- no unreviewed Docker or compose behavior change.

## Recommended First Work

Completed for the dormant preparation package. Do not continue with additional
meta-proof slices by default.

Start with Phase 00 plus a narrow Phase 03 slice:

1. refresh the Rust/Node boundary map;
2. inspect `Cargo.toml` and existing `crates/ordo-backup` patterns;
3. add inert crate/binary scaffolding only if the current workspace supports it;
4. add a health/version proof for `ordo-daemon` without integrating it;
5. record evidence and exact commands run.

This creates a native foundation that can wait patiently for Node integration
instead of fighting it.
