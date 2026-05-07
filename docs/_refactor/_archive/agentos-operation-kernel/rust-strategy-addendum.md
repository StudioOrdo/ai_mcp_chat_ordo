# Rust Strategy Addendum

Status: Implemented for the backup/restore native boundary; future Rust
expansion remains scoped and evidence-driven

## Purpose

Rust should make Ordo more reliable where TypeScript and the Node event loop are
the wrong boundary: hard-state local I/O, native validation, resource probes,
release verification, and deterministic runtime checks.

Rust should not become a broad rewrite of the product. TypeScript owns product
policy, prompt assembly, UI, role access, provider selection, operation
definitions, and operation ledger writes.

## Implemented Rust Baseline

Current Rust implementation:

- `crates/ordo-backup/src/command.rs`
- `crates/ordo-backup/src/native_contract.rs`
- `crates/ordo-backup/src/backup_executor.rs`
- `crates/ordo-backup/src/restore_executor.rs`
- packaged into the single Docker image as `bin/ordo-backup`
- invoked by the appliance backup/restore pipeline
- validates typed command payloads
- rejects obsolete command names in tests
- emits structured native command results reconciled by TypeScript.

This is the right pattern: a narrow native executor, not a parallel
application.

## Implemented Boundary Rule

TypeScript sends operation-aware native command context and payloads. Rust
returns structured `NativeCommandResult` data. TypeScript reconciles the result
into:

- `executor_event_received` events,
- artifacts,
- operation/step status updates,
- error payloads,
- health and binary registry evidence.

Rust does not write `operations`, `operation_steps`, `operation_events`,
`operation_actions`, or `operation_artifacts` directly.

## Future Rust Candidates

### 1. Runtime Resource Guard

Use Rust for disk, memory, process, permission, and file-lock posture if Node
probes prove too weak or expensive.

### 2. Release And Image Verifier

Use Rust to verify release manifests, binary checksums, required runtime files,
and image metadata when the release gate needs stronger deterministic checks.

### 3. Media Probe/Executor

Move media probing, file inspection, and selected native transforms into Rust if
the Node/WASM path becomes unreliable or memory-heavy.

### 4. Token/Event/Search Primitives

Consider Rust only after the TypeScript operation ledger and local search/vector
contracts show measurable limits.

## What Not To Move To Rust

- React components
- Next.js route composition
- Prompt construction
- Provider/model selection
- Role and content policy
- Capability catalog authoring
- Admin page composition
- Operation policy/state semantics

## Integration Rule

Prefer structured JSON over process stdio/exit status for native command
results. Prefer SQLite/event reconciliation through TypeScript over Rust direct
database writes. Avoid Node FFI unless there is a measured reason; it increases
build and deployment friction.

## Rust QA Gates

- `cargo fmt --check`
- `cargo test -p ordo-backup`
- `cargo clippy -p ordo-backup -- -D warnings`
- Docker image includes every required Rust binary.
- Missing binary is reported through health and operation state.
- Rust command failures produce structured errors, not ambiguous logs.
