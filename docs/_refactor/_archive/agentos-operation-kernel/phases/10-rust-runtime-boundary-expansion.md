# Phase 10: Rust Runtime Boundary Expansion

Status: Implemented and QA closed on 2026-05-03

## QA Certification

This document was updated after Phases 00 through 09 were implemented and QA
verified. It is grounded in the current operation kernel, appliance backup
executor, Docker image, health facade, and release verification code.

Key corrections from the original Phase 10 draft:

- Rust must not become a second operation ledger. The current clean boundary is
  `system_commands` plus TypeScript reconciliation into `OperationRepository`.
- Operation-aware Rust already exists in part: `ordo-backup` accepts optional
  operation metadata and TypeScript passes it from backup/restore operation
  actions.
- The missing piece is a stable native command/result envelope and a strict
  reconciler contract, not broad Rust rewrites of policy, UI, prompts, or routes.
- Runtime resource checks already exist in TypeScript. Phase 10 should add native
  probes only where Node/JavaScript cannot reliably answer permissions, disk,
  executable, manifest, or filesystem-integrity questions.
- The single-image appliance contract is already enforced by Docker tests. Phase
  10 must preserve one image and add only packaged binaries that are supervised
  or invoked through existing runtime seams.

## Goal

Expand Rust only where it makes Ordo a more reliable appliance:

- hard-state local I/O,
- archive and restore integrity,
- native runtime guardrails,
- release/image verification,
- structured executor result contracts.

TypeScript remains the product brain: operation policy, authorization, prompt
truth, corpus access, UI, provider choice, route composition, and operation-ledger
state transitions stay in TypeScript.

## Inputs From Phase 00 Through Phase 09

- Phase 00 proved complex requests fail when runtime state is scattered across
  chat text, tool output, jobs, and logs.
- Phase 01 defined the operation domain, including steps, events, actions,
  artifacts, risk, confirmation, and stale-action behavior.
- Phase 02 created the durable SQLite operation ledger through
  `OperationRepository` and `OperationDataMapper`.
- Phase 03 created typed operation action dispatch as the only visible mutation
  path after operation creation.
- Phase 04 routed complex intents through deterministic draft creation.
- Phase 05 made operation truth part of chat grounding.
- Phase 06 moved backup and restore onto operation actions and reconciled Rust
  command outcomes back into operation state.
- Phase 07 projected media workflows through operations while leaving worker
  execution in Node/ffmpeg/WASM seams.
- Phase 08 projected factory work orders through operations and proved feature
  executors must be lazy-loaded.
- Phase 09 made operations visible through chat cards, `/operations`,
  `/admin/system/operations`, governed help, and onboarding.

Phase 10 should harden the native execution boundary that these phases now
expose. It should not introduce a second control plane.

## Current Code Grounding

### Current Rust Workspace

Existing Rust files:

- `Cargo.toml`
- `Cargo.lock`
- `rust-toolchain.toml`
- `crates/ordo-backup/Cargo.toml`
- `crates/ordo-backup/src/main.rs`
- `crates/ordo-backup/src/command.rs`
- `crates/ordo-backup/src/command_store.rs`
- `crates/ordo-backup/src/daemon.rs`
- `crates/ordo-backup/src/backup_executor.rs`
- `crates/ordo-backup/src/restore_executor.rs`
- `crates/ordo-backup/tests/governed_executor.rs`

Current binary:

- `ordo-backup daemon --db-path ...`
- `ordo-backup run-once --db-path ...`

Current responsibilities:

- Claims pending `system_commands` rows where `target = 'rust_daemon'`.
- Executes `backup.create` and `restore.request`.
- Updates `system_commands` status/result/error.
- Writes backup snapshot/restore side effects through Node-owned SQLite tables.
- Validates command payload shape and rejects obsolete command names.

Important current limitation:

- Rust does not append `operation_events` directly. TypeScript reconciles
  `system_commands` into operation steps, artifacts, actions, and status.
  Preserve that boundary unless there is a measured reason to change it.

### Current TypeScript Native Boundary

Use these files as the TypeScript side of the boundary:

- `src/lib/appliance/backup/types.ts`
- `src/lib/appliance/backup/backup-command-payload.ts`
- `src/lib/appliance/backup/backup-command-validation.ts`
- `src/lib/appliance/backup/backup-command-service.ts`
- `src/adapters/BackupSystemCommandDataMapper.ts`
- `src/lib/appliance/backup/backup-restore-operation-executor.ts`
- `src/lib/appliance/backup/backup-restore-operation-reconciler.ts`
- `src/lib/operations/operation-action-dispatch-root.ts`

Current flow:

1. User-visible operation action dispatch accepts a typed operation action.
2. `BackupRestoreOperationExecutor` creates or advances operation steps.
3. It passes `OperationCommandMetadata` into backup/restore command payloads.
4. `BackupSystemCommandDataMapper` enqueues a `system_commands` row for
   `rust_daemon`.
5. `ordo-backup` claims and executes the row.
6. `BackupRestoreOperationReconciler` maps command status and result payload back
   into operation steps, artifacts, actions, and final operation status.

This is the pattern Phase 10 should generalize: TypeScript owns operation state;
Rust owns deterministic native execution; a reconciler joins them.

Current gap:

- `executor_event_received` exists in the operation event contract and is already
  used by lightweight help/onboarding executors, but backup/restore native
  reconciliation does not yet append structured native executor evidence. Phase
  10 must add that evidence through TypeScript reconciliation, not direct Rust
  writes to operation tables.

### Current Operation Ledger And Events

Use:

- `src/core/entities/operation.ts`
- `src/core/use-cases/operations/OperationRepository.ts`
- `src/adapters/OperationDataMapper.ts`
- `src/core/use-cases/operations/OperationActionDispatch.ts`

Current event types include:

- `operation_created`
- `operation_status_changed`
- `step_status_changed`
- `action_exposed`
- `action_requested`
- `action_rejected`
- `artifact_attached`
- `executor_event_received`
- `operation_completed`

Phase 10 should use `executor_event_received` for native result evidence rather
than adding native-specific event types unless the domain contract first changes.

### Current Health And Resource Probes

Use:

- `src/lib/appliance/health-facade.ts`
- `src/lib/appliance/health-types.ts`
- `src/lib/appliance/probes/backup-restore-probe.ts`
- `src/lib/appliance/probes/resource-pressure-probe.ts`
- `src/lib/appliance/resources/resource-pressure-service.ts`
- `src/lib/appliance/resources/resource-pressure.ts`
- `src/lib/storage/volume-capacity.ts`

Current coverage:

- Backup executor binary availability is surfaced as health.
- Backup policy and failed Rust command counts are surfaced as health.
- Disk/resource pressure is checked in TypeScript using the data volume capacity
  path.
- Backup/restore self-service gates use resource pressure before queueing work.

Phase 10 native probes should augment this, not replace it blindly.

### Current Single-Image Runtime

Use:

- `Dockerfile`
- `compose.yaml`
- `scripts/start-server.mjs`
- `scripts/dev.mjs`
- `scripts/install-backup-executor.mjs`
- `tests/docker-runtime-contract.test.ts`
- `tests/docker-appliance-lifecycle.contract.test.ts`
- `tests/image-runtime-bundle-contract.test.ts`

Current Docker shape:

- Single app image.
- Rust builder stage builds `ordo-backup`.
- Runner stage copies `./bin/ordo-backup`.
- `scripts/start-server.mjs` supervises Next.js, deferred jobs, media worker,
  backup executor, and backup scheduler.
- Local dev auto-builds `bin/ordo-backup` when missing.

Phase 10 must keep this shape. No second service, no second image, no separate
native daemon image.

### Current Release Verification

Use:

- `src/lib/appliance/release/appliance-image-release.ts`
- `scripts/run-appliance-image-release.ts`
- `scripts/generate-release-evidence.ts`
- `release/manifest.json`
- `tests/appliance-image-release-cli.test.ts`
- `tests/image-security-contract.test.ts`
- `tests/image-runtime-bundle-contract.test.ts`

Current release gates already run:

- native runtime check,
- environment validation,
- secret scan,
- typecheck,
- focused image tests,
- `cargo fmt --check`,
- `cargo test -p ordo-backup`,
- `cargo clippy -p ordo-backup -- -D warnings`,
- release manifest generation and verification,
- compose config validation.

Phase 10 should add native verification only for deterministic file/binary
integrity checks that are awkward or fragile in TypeScript.

## Target Architecture

### 1. Native Command Envelope

Create a shared TypeScript/Rust command/result contract for native work.

Suggested TypeScript files:

- `src/lib/appliance/native/native-command-contract.ts`
- `src/lib/appliance/native/native-command-contract.test.ts`

Suggested Rust files:

- `crates/ordo-backup/src/native_contract.rs`, or
- shared crate if adding more binaries: `crates/ordo-native-contract/src/lib.rs`

Contract:

```ts
interface NativeOperationRef {
  operationId: string;
  stepId: string;
  actionId: string;
  operationKind: "backup_create" | "restore_execute" | "system_diagnostic";
}

interface NativeCommandEnvelope<TPayload> {
  schemaVersion: "1";
  commandId: string;
  command: string;
  target: "rust_daemon";
  requestedAt: string;
  operation: NativeOperationRef | null;
  payload: TPayload;
}

interface NativeCommandResult {
  schemaVersion: "1";
  commandId: string;
  operation: NativeOperationRef | null;
  status: "succeeded" | "failed";
  summary: string;
  artifacts: Array<{ kind: string; uri: string; label: string; metadata: Record<string, unknown> }>;
  metrics: Record<string, number | string | boolean | null>;
  error: { code: string; message: string; details?: Record<string, unknown> } | null;
}
```

Rules:

- TypeScript validates the envelope before enqueueing.
- Rust validates the same envelope before execution.
- Rust result payloads use the result contract.
- Reconciliation maps result artifacts and metrics into operation artifacts,
  step output, and `executor_event_received` events.
- Scheduled backup commands may use `operation: null` until scheduled backups
  are operation-backed. Manual backup, pre-restore backup, and restore execution
  must include operation metadata.

This is the Adapter plus Anti-Corruption Layer pattern: native executors never
receive loose product state.

### 2. Operation-Aware Backup Executor Hardening

Tighten `ordo-backup` around the operation-aware command contract.

Target files:

- `crates/ordo-backup/src/command.rs`
- `crates/ordo-backup/src/command_store.rs`
- `crates/ordo-backup/src/backup_executor.rs`
- `crates/ordo-backup/src/restore_executor.rs`
- `crates/ordo-backup/tests/governed_executor.rs`
- `src/lib/appliance/backup/backup-command-validation.ts`
- `src/lib/appliance/backup/backup-restore-operation-reconciler.ts`

Implementation requirements:

- Require operation metadata for manual backup, pre-restore backup, and restore
  execution.
- Allow `operation: null` only for scheduler-originated `scheduled` backup
  commands until scheduled backups are migrated to operations.
- Include operation metadata in every success/failure result payload when present.
- Include native metrics: bytes read, bytes written, file count, archive hash,
  elapsed milliseconds, and restore target paths touched.
- Preserve the current lease and pending/running/succeeded/failed lifecycle.
- Never write `operations`, `operation_steps`, `operation_events`, or
  `operation_artifacts` directly from Rust in this phase.

### 3. Native Result Reconciler

Generalize the existing backup/restore reconciler to consume structured native
results.

Target files:

- `src/lib/appliance/native/native-result-reconciler.ts`
- `src/lib/appliance/native/native-result-reconciler.test.ts`
- `src/lib/appliance/backup/backup-restore-operation-reconciler.ts`

Responsibilities:

- Read a `SystemCommand` result payload.
- Validate it as `NativeCommandResult`.
- Append an `executor_event_received` event with command id, operation ref,
  native status, metrics, and redacted error details.
- Attach native artifacts exactly once.
- Mark operation steps `succeeded` or `failed` from structured result status.
- Keep backup/restore domain-specific transitions in
  `BackupRestoreOperationReconciler`.

This avoids copy-pasting result parsing when future Rust binaries are added.

### 4. Runtime Guard Probe Candidate

Add a native runtime guard only for checks that TypeScript cannot perform with
sufficient reliability.

Recommended shape:

- Add one binary, not many: `ordo-runtime`.
- Subcommands:
  - `ordo-runtime guard --data-dir ... --sqlite-path ... --json`
  - `ordo-runtime verify-release --manifest ... --bin-dir ... --json`

Suggested Rust files:

- `crates/ordo-runtime/Cargo.toml`
- `crates/ordo-runtime/src/main.rs`
- `crates/ordo-runtime/src/guard.rs`
- `crates/ordo-runtime/src/release_verify.rs`

Suggested TypeScript files:

- `src/lib/appliance/native/runtime-guard-client.ts`
- `src/lib/appliance/probes/native-runtime-probe.ts`
- `src/lib/appliance/probes/native-runtime-probe.test.ts`

Guard checks:

- data directory exists and is writable,
- SQLite file parent is writable,
- required data subdirectories can be created,
- required binaries exist and are executable,
- available disk bytes can be read from the mounted data volume,
- filesystem reports stable metadata for backup archives,
- optional: basic process uid/gid and readonly root hints.

Rules:

- If `ordo-runtime` is missing, health degrades with remediation, not a crash.
- TypeScript health facade remains the aggregation owner.
- The probe returns JSON only; no human parsing.
- Do not replace `ResourcePressureService` until the native guard proves better
  coverage in tests.

### 5. Release And Image Native Verification Candidate

Use Rust for deterministic integrity checks where it adds value.

Candidate `ordo-runtime verify-release` checks:

- `release/manifest.json` exists and parses.
- Required binaries listed in the manifest exist and are executable.
- Binary SHA-256 digests match expected values when present.
- Runtime corpus manifest files exist for active books.
- Docker runtime bundle does not contain forbidden directories when checked
  inside the image.

TypeScript still owns:

- orchestration of release gates,
- SBOM/scanner/cosign integration,
- evidence markdown/json generation,
- policy decisions about pass/fail.

### 6. Native Executor Registry

Add a small TypeScript registry for packaged native executables.

Suggested files:

- `src/lib/appliance/native/native-binary-registry.ts`
- `src/lib/appliance/native/native-binary-registry.test.ts`

Responsibilities:

- Resolve expected executable paths from env and defaults.
- Report missing/unexecutable binaries with structured status.
- Provide one place for Docker/runtime probes to know required binaries.
- Default binaries:
  - `ordo-backup` required for backup/restore execution unless disabled.
  - `ordo-runtime` required for native runtime guard only after added.

This removes path logic scattered between health probes, dev scripts, release
checks, and admin diagnostics.

## What Must Stay In TypeScript

Do not move these to Rust in Phase 10:

- operation state transitions,
- operation action dispatch,
- role authorization,
- confirmation policy,
- prompt assembly and grounding,
- corpus/content access,
- provider/model configuration,
- React UI and operation cards,
- Next.js API route composition,
- admin page composition,
- release evidence rendering.

## What Rust Owns After Phase 10

Rust owns:

- deterministic backup/archive/restore I/O,
- native file and archive integrity checks,
- native runtime guard readings when invoked,
- optional release binary/file verification,
- structured native command result payloads.

Rust does not own:

- whether an operation is allowed,
- whether a user can see an action,
- whether an operation should continue,
- how the assistant describes the result,
- how admin pages render state.

## Implementation Slices

1. Add TypeScript `native-command-contract` and tests.
2. Add Rust native contract structs/tests for command and result envelopes.
3. Tighten `ordo-backup` validation so operation-backed manual/pre-restore/restore
   commands require operation metadata and scheduled backups are the only
   allowed operation-null backup path.
4. Extend `ordo-backup` result payloads with schema version, operation ref,
   metrics, artifacts, and structured errors.
5. Add `native-result-reconciler` and wire backup/restore reconciliation through
   it for `executor_event_received` events and artifact idempotency.
6. Add `native-binary-registry` and migrate backup executor path lookup in health,
   dev, release, and diagnostics where practical.
7. Add `ordo-runtime guard` if the native guard is still justified after slices
   1 through 6; otherwise document why TypeScript resource probes are sufficient.
8. Add `native-runtime-probe` to the health facade only after `ordo-runtime guard`
   exists and is packaged.
9. Add `ordo-runtime verify-release` only after runtime guard packaging is stable.
10. Update Dockerfile to copy every required Rust binary from the Rust builder.
11. Update release gates and appliance smoke evidence to include native binary
    registry and native guard results.
12. Run full Rust, TypeScript, Docker contract, operation, backup/restore, and
    appliance lifecycle QA.

## Dead Code And Simplification Targets

Remove or collapse:

- duplicated binary path resolution outside a native binary registry,
- ad hoc Rust result parsing in backup/restore code after native result contract
  exists,
- stringly typed command result payload checks,
- any obsolete migration allowance that lets operation-backed manual backup or
  restore execute without operation metadata,
- any health probe text parsing of native output.

Keep:

- `system_commands` as the native work queue,
- `BackupRestoreOperationReconciler` for backup/restore domain transitions,
- TypeScript resource-pressure checks until native guard coverage is proven,
- one Docker image and one app service,
- local dev auto-install for `bin/ordo-backup`.

## Positive Use Cases

- Admin clicks a backup operation action; TypeScript enqueues a validated native
  command; Rust writes a structured result; TypeScript appends an
  `executor_event_received` event and marks the operation succeeded.
- Restore execution fails integrity validation in Rust; the command result
  includes structured error details; TypeScript marks the restore step failed and
  shows the exact operation state in chat and admin surfaces.
- `ordo-backup` is missing locally; health reports backup/restore degraded with a
  build/install remediation instead of letting chat claim backup availability.
- Docker image contains `ordo-backup` and, if implemented, `ordo-runtime`; release
  gates fail if required binaries are missing or not executable.
- Native runtime guard detects that `/app/.data` is not writable; readiness or
  admin health reports blocked/degraded before destructive work starts.

## Negative Use Cases

- Rust cannot execute a manual backup command without operation metadata.
- Rust cannot execute a restore command without operation metadata.
- Rust cannot write operation tables directly in Phase 10.
- A malformed native result cannot mark an operation succeeded.
- A failed native command cannot be hidden as a healthy operation.
- Missing native binary cannot crash the app server; it must surface as health
  and operation state.
- Adding `ordo-runtime` cannot introduce a second Docker service or image.

## Edge Cases

- Scheduled backup command has no operation metadata.
- Manual backup command has missing operation metadata.
- Restore command has mismatched operation kind.
- Rust command succeeds but result payload is malformed.
- Rust command fails after writing a partial archive.
- Rust daemon crashes with a running lease.
- Reconciler runs twice for the same command.
- Operation was cancelled before native command completes.
- Native guard is missing in local dev.
- Docker image has `ordo-backup` but not executable permissions.
- Release manifest references a binary that is not packaged.

## Tests Required

Baseline Phase 10 suite after slices 1 through 6:

```bash
npx vitest run \
  src/lib/appliance/native/native-command-contract.test.ts \
  src/lib/appliance/native/native-result-reconciler.test.ts \
  src/lib/appliance/native/native-binary-registry.test.ts \
  src/lib/appliance/probes/backup-restore-probe.test.ts \
  src/lib/appliance/probes/resource-pressure-probe.test.ts \
  src/lib/appliance/backup/backup-command-service.test.ts \
  src/lib/appliance/backup/backup-command-validation.test.ts \
  src/lib/appliance/backup/backup-restore-operation-executor.test.ts \
  src/lib/appliance/backup/backup-restore-operation-reconciler.test.ts \
  src/lib/operations/operation-action-dispatch-root.test.ts \
  tests/docker-runtime-contract.test.ts \
  tests/docker-appliance-lifecycle.contract.test.ts \
  tests/image-runtime-bundle-contract.test.ts \
  tests/appliance-lifecycle-smoke.test.ts \
  tests/appliance-image-release-cli.test.ts
```

Additional suite after `ordo-runtime guard` is implemented:

```bash
npx vitest run \
  src/lib/appliance/native/runtime-guard-client.test.ts \
  src/lib/appliance/probes/native-runtime-probe.test.ts
```

Rust checks:

```bash
cargo fmt --check
cargo test -p ordo-backup
cargo clippy -p ordo-backup -- -D warnings
```

If `ordo-runtime` is added:

```bash
cargo test -p ordo-runtime
cargo clippy -p ordo-runtime -- -D warnings
```

Repository checks:

```bash
npm run typecheck
npm run lint
git diff --check
```

Guardrail searches:

```bash
rg -n "operation_events|operation_steps|operations" crates/ordo-backup
rg -n "operation: Option|operation\\?: OperationCommandMetadata" crates/ordo-backup/src src/lib/appliance/backup
rg -n "ORDO_BACKUP_EXECUTOR_PATH|bin/ordo-backup|ordo-runtime" Dockerfile scripts src/lib tests
rg -n "executor_event_received" src/lib/appliance src/lib/operations src/core/use-cases/operations
```

If `crates/ordo-runtime` is added, include it in the first Rust ledger-write
guardrail.

Expected guardrail outcomes:

- Rust crates do not write operation ledger tables directly.
- Optional operation metadata remains only where the native envelope explicitly
  allows `operation: null` for scheduled backup work. Manual backup, pre-restore
  backup, and restore execution paths must reject missing operation metadata.
- Binary path resolution is centralized or explicitly listed as a migration
  target.
- Native result reconciliation appends `executor_event_received` evidence.

## Exit Criteria

- Rust expands appliance reliability without becoming a second product brain.
- Native command/result contracts are explicit and tested on both sides of the
  boundary.
- Backup/restore native results include operation refs, metrics, artifacts, and
  structured errors.
- TypeScript reconciliation turns native results into operation events, steps,
  artifacts, and visible operation status.
- Missing or unhealthy Rust binaries surface through health and operation state,
  not chat guesses or ambiguous logs.
- Docker still produces one app image with all required native binaries packaged.
- Release gates verify Rust formatting, tests, clippy, packaging, and binary
  availability.
- No operation state transition is owned by Rust.

## Implementation Closeout

Phase 10 was implemented as the native boundary hardening phase, not as a broad
Rust rewrite.

Implemented:

- Added the TypeScript native command/result contract in
  `src/lib/appliance/native/native-command-contract.ts`.
- Added the idempotent TypeScript native result reconciler in
  `src/lib/appliance/native/native-result-reconciler.ts`.
- Added the TypeScript native binary registry in
  `src/lib/appliance/native/native-binary-registry.ts`.
- Tightened backup/restore command validation so manual backup, pre-restore
  backup, and restore execution require operation metadata before enqueueing.
- Preserved scheduled backup as the explicit operation-null path.
- Added the Rust native result contract in
  `crates/ordo-backup/src/native_contract.rs`.
- Updated `ordo-backup` backup and restore executors to return structured native
  results with schema version, command id, operation ref, metrics, artifacts,
  and structured errors.
- Wired backup/restore reconciliation through the native result reconciler so
  terminal native command results append `executor_event_received` evidence and
  attach native artifacts exactly once.
- Centralized app-side backup executor availability checks through the native
  binary registry in health, operation gate, and scheduler code.
- Added native boundary tests to the release-focused test set.

Not added:

- `ordo-runtime guard` was not added in this phase. After the native command
  contract, native result reconciliation, and binary registry were implemented,
  the remaining runtime checks are still covered by the existing TypeScript
  health/resource probes. Adding a second Rust binary now would add packaging and
  release surface before there is a measured native-only gap. The registry keeps
  `ordo-runtime` as an optional future binary, not a required runtime dependency.
- `ordo-runtime verify-release` was not added for the same reason. Release
  orchestration remains TypeScript-owned, with Rust formatting, tests, clippy,
  Docker bundle tests, and binary packaging checks already in the release path.

Intentional residual direct path usage:

- `scripts/dev.mjs` and `scripts/start-server.mjs` still resolve
  `ORDO_BACKUP_EXECUTOR_PATH` directly because they are JavaScript supervisor
  entrypoints that run before the TypeScript app runtime is loaded. They remain
  listed as a future migration target if a shared JS/TS runtime config module is
  introduced.
- Docker and release checks still assert `/app/bin/ordo-backup` directly because
  that is the single-image packaging contract.

QA run:

- `npx vitest run src/lib/appliance/native/native-command-contract.test.ts src/lib/appliance/native/native-result-reconciler.test.ts src/lib/appliance/native/native-binary-registry.test.ts src/lib/appliance/probes/backup-restore-probe.test.ts src/lib/appliance/probes/resource-pressure-probe.test.ts src/lib/appliance/backup/backup-command-service.test.ts src/lib/appliance/backup/backup-command-validation.test.ts src/lib/appliance/backup/backup-restore-operation-executor.test.ts src/lib/appliance/backup/backup-restore-operation-reconciler.test.ts src/lib/operations/operation-action-dispatch-root.test.ts tests/docker-runtime-contract.test.ts tests/docker-appliance-lifecycle.contract.test.ts tests/image-runtime-bundle-contract.test.ts tests/appliance-lifecycle-smoke.test.ts tests/appliance-image-release-cli.test.ts`
  - passed, 15 files, 54 tests.
- `cargo fmt --check`
  - passed.
- `cargo test -p ordo-backup`
  - passed, 19 tests.
- `cargo clippy -p ordo-backup -- -D warnings`
  - passed.
- `npm run typecheck -- --pretty false`
  - passed.
- `npm run lint`
  - passed with pre-existing warnings.
- `git diff --check`
  - passed.

Guardrail outcomes:

- `rg -n "operation_events|operation_steps|operations" crates/ordo-backup`
  returned no matches, so Rust still does not write the operation ledger.
- `rg -n "operation: Option|operation\\?: OperationCommandMetadata" crates/ordo-backup/src src/lib/appliance/backup`
  now returns only Rust native/result envelope optional operation fields. Those
  are required for the scheduled-backup operation-null exception and native
  result `operation: null` handling.
- `rg -n "ORDO_BACKUP_EXECUTOR_PATH|bin/ordo-backup|ordo-runtime" Dockerfile scripts src/lib tests`
  shows the centralized TypeScript registry plus the intentional supervisor,
  Docker, release, and test contract references listed above.
- `rg -n "executor_event_received" src/lib/appliance src/lib/operations src/core/use-cases/operations`
  shows native backup/restore reconciliation now appends executor evidence
  alongside the existing help/onboarding executor evidence paths.
