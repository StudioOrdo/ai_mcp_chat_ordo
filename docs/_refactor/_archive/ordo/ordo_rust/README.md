# Ordo Rust Governance Package

Status: Paused
Created: 2026-05-06

## Purpose

This package turns the Rust appliance research into an executable Ordo runtime
plan.

The target is not a Rust rewrite of Ordo. The target is a bounded native runtime
that protects the local appliance from memory pressure, long-lived connection
load, subprocess leaks, and schema drift while preserving the TypeScript product
layer.

Rust owns deterministic runtime pressure:

- process supervision and container lifecycle,
- native job execution for memory-heavy or cancellation-sensitive work,
- realtime fanout and websocket connection management,
- local embeddings and vector math after search contracts are stable,
- recurring task insertion into the existing job queue,
- optional local networking, TLS termination, and appliance discovery.

TypeScript owns product meaning:

- UI, navigation, and governance presentation,
- access control and role policy,
- prompt construction and workflow rules,
- Zod schemas and cross-process contract source of truth,
- queue insertion and business read models.

## Governing Contracts

- `../rust-strategy.md`
- `../phases/11-rust-runtime-boundary-and-local-ai.md`
- `../../rust_projects/00_architecture_manifesto.md`
- `../../rust_projects/01_supervisor_and_lifecycle.md`
- `../../rust_projects/02_realtime_broker.md`
- `../../rust_projects/03_execution_engine.md`
- `../../rust_projects/04_rag_and_search.md`
- `../../rust_projects/05_data_contracts.md`
- `../../rust_projects/06_job_scheduler_spec.md`
- `../../rust_projects/07_appliance_networking_spec.md`

## Package Shape

This package follows the strongest pattern from the canonical UX governance
package:

- one README that names purpose, boundaries, and rules;
- one dependency-ordered phase plan;
- one validation checklist with closeout evidence requirements;
- one small phase file per implementable slice.

The Rust work is intentionally organized by risk boundary, not by technology
enthusiasm. Each phase must leave Ordo more observable and easier to roll back.

## Active Node Work Rule

When the Node/Next application is actively changing, use the pre-integration
runway.

Rust work may prepare isolated crates, binaries, schemas, fixtures, adapter
proofs, health checks, redaction utilities, and local CLI tests. Rust work must
not replace production Node behavior, Docker entrypoints, workers, realtime,
search, scheduler, or TLS paths until a later integration phase explicitly
passes the readiness gates in `pre-integration-runway.md`.

## Package Contents

- `boundary-map.md` - current Node/Rust ownership map for the runway.
- `phase-plan.md` - dependency-ordered runtime execution plan.
- `pre-integration-runway.md` - safe Rust work while Node remains the active
   product runtime.
- `validation-checklist.md` - package-level QA, safety, and closeout checks.
- `evidence/2026-05-06-pre-integration-daemon-proof.md`
- `phases/00-rust-runtime-baseline-and-boundary-map.md`
- `phases/01-contract-generation-and-adapter-baseline.md`
- `phases/02-supervisor-and-lifecycle-proof.md`
- `phases/03-ordo-daemon-skeleton-and-health.md`
- `phases/04-job-engine-first-native-strategies.md`
- `phases/05-realtime-broker-feature-flag.md`
- `phases/06-rag-search-native-backend-proof.md`
- `phases/07-scheduler-and-recurring-jobs.md`
- `phases/08-appliance-networking-tls-prototype.md`
- `phases/09-runtime-hardening-and-closeout.md`

## Implementation Rule

Do not build parallel product logic in Rust.

Every Rust phase must either:

1. make a native runtime boundary explicit and tested,
2. move a memory-heavy or concurrency-heavy execution path behind an existing
   TypeScript contract,
3. improve crash recovery, cancellation, or observability,
4. generate or verify shared schemas from TypeScript/Zod,
5. or close out stale Node runtime pressure after parity tests pass.

If a phase cannot answer "what does TypeScript still own, what does Rust own,
what schema crosses the boundary, what is observable, and how do we roll back?"
it is not ready to implement.

During the pre-integration runway, also ask: "Can this Rust work be merged and
left dormant while Node continues to evolve?" If the answer is no, defer it.

## Pause Decision

As of 2026-05-07, the current dormant `ordo-daemon` package is enough Rust
preparation. Do not add more Rust-only meta proofs unless they unlock a concrete
integration decision or de-risk an actual feature-flagged handoff.
