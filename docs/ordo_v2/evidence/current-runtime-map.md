# Current Runtime Map

Issue: https://github.com/StudioOrdo/ai_mcp_chat_ordo/issues/1

Status: initial archaeology evidence

## Summary

The repo already has the start of the runtime shape we want:

- TypeScript can enqueue native commands.
- Rust can claim leased backup/restore commands from SQLite.
- Rust writes command results back to SQLite.
- TypeScript can parse and reconcile native command results into operation
  evidence.
- `ordo-daemon` exists, but it is still mostly a dormant harness/health crate.
- The app does not yet have one shared product event spine.

## Rust Runtime

### `crates/ordo-backup`

Status: implemented, narrow scope

Code anchors:

- `crates/ordo-backup/src/daemon.rs`
- `crates/ordo-backup/src/command_store.rs`
- `crates/ordo-backup/src/backup_executor.rs`
- `crates/ordo-backup/src/restore_executor.rs`
- `crates/ordo-backup/src/native_contract.rs`
- `crates/ordo-backup/tests/governed_executor.rs`

What is real:

- `run_once` recovers expired running commands, claims one pending command, and
  executes backup or restore.
- `CommandStore` opens SQLite, verifies required Node-owned tables, claims
  `target = 'rust_daemon'` commands, sets leases, and marks succeeded/failed.
- Expired running commands are recovered by marking them failed.
- Backup writes archives and updates `backup_snapshots`.
- Restore validates archive safety before live mutation.
- Rust serializes native command results with `schemaVersion`, `commandId`,
  operation metadata, status, summary, artifacts, metrics, and error.

Tests:

- `cargo test --manifest-path crates/ordo-backup/Cargo.toml`
- Passed on 2026-05-07.
- Coverage includes command parsing, native result serialization, backup success,
  backup failure, restore validation, restore success, and stale lease recovery.

Limitations:

- This is backup/restore-specific.
- It polls SQLite in a loop.
- It is not yet merged into one `ordo-daemon` runtime.
- Rust/TypeScript schemas are manually mirrored.

### `crates/ordo-daemon`

Status: partial/dormant

Code anchors:

- `crates/ordo-daemon/src/main.rs`
- `crates/ordo-daemon/src/http.rs`
- `crates/ordo-daemon/src/health.rs`
- `crates/ordo-daemon/src/executor_harness.rs`
- `crates/ordo-daemon/src/runway_fixtures.rs`
- `crates/ordo-daemon/src/runway_schema_snapshots.rs`

What is real:

- Health/readiness endpoints exist.
- Redaction and safe crash-report surfaces exist.
- Executor contract fixtures and schema snapshots exist.
- Tests prove these surfaces are safe and deterministic.

Tests:

- `cargo test --manifest-path crates/ordo-daemon/Cargo.toml`
- Passed on 2026-05-07.

Limitations:

- The daemon is not yet the active owner of backup/restore, realtime, media
  execution, or brief execution.
- It has fixture parity work but not production broker/worker ownership.

## TypeScript Native Runtime Boundary

Status: implemented for backup/restore, partial as a general runtime contract

Code anchors:

- `src/lib/appliance/native/native-command-contract.ts`
- `src/lib/appliance/native/native-result-reconciler.ts`
- `src/lib/appliance/backup/backup-command-service.ts`
- `src/adapters/BackupSystemCommandDataMapper.ts`
- `src/adapters/BackupGovernanceDataMapper.test.ts`

What is real:

- TypeScript validates native command results.
- TypeScript redacts native results before operation evidence is recorded.
- `NativeResultReconciler` appends executor events once and attaches artifacts
  once.
- `BackupCommandService` admin-gates manual backup commands and enqueues
  `target = 'rust_daemon'` commands.
- Backup governance schema tests prove command, snapshot, restore plan, policy,
  and audit tables exist.

Limitations:

- Native operation kinds are currently limited to:
  - `backup_create`
  - `restore_execute`
  - `system_diagnostic`
- The schema sync path from TypeScript/Zod to Rust structs is not automated.
- No shared runtime command table exists yet for all produced work.

## Node Runtime

### Jobs

Status: implemented, jobs-specific

Code anchors:

- `src/lib/jobs/deferred-job-runtime.ts`
- `src/lib/jobs/deferred-job-worker.ts`
- `src/lib/jobs/job-event-history.ts`
- `src/lib/jobs/job-event-stream.ts`
- `src/lib/jobs/job-event-bus.ts`
- `src/adapters/JobQueueDataMapper.ts`

What is real:

- Jobs have durable requests and durable job events.
- Job events have conversation-local sequence numbers.
- There are APIs that stream job events to chat and job consumers.
- There is in-process cancellation fanout through `EventEmitter`.

Limitations:

- This is not a product-wide event system.
- It is centered on jobs, not all product changes.
- `EventEmitter` state is process-local and not durable.

## Runtime Conclusion

The strongest existing pattern is:

```text
TypeScript enqueues durable command
-> Rust claims with lease
-> Rust executes
-> Rust writes result
-> TypeScript reconciles result into product evidence
```

That pattern should be reused for more background work.

The missing runtime layer is:

```text
durable product event log
-> read model/stale marking
-> realtime invalidation
-> UI refetch
```
