# Phase 04D - Rust Backup Executor Integration

Status: Complete

## Goal

Replace the `crates/ordo-backup` prototype with a governed Rust executor for hard-state backup and restore I/O.

Node remains the source of truth for schema, policy, roles, restore authorization, data-boundary selection, manifest rules, health projection, and admin/conversation behavior. Rust owns the raw I/O once Node has created a valid `system_commands` row.

This phase must make backup creation and restore execution real, but only through the contracts completed in Phases 00, 01, 02, 03, 04A, 04B, and 04C.

## Dependencies

- Phase 00 proved `.data` is the durable appliance boundary.
- Phase 01 requires backup/restore tools and executor controls to stay out of `default_chat`.
- Phase 02 added `getApplianceDataBoundary()` and `getApplianceRuntimeProfile()`.
- Phase 03 added the appliance health facade and placeholder `backup_restore` probe.
- Phase 04A added the Node-owned governance schema:
  - `system_commands`
  - `backup_snapshots`
  - `backup_policy`
  - `backup_restore_audit_events`
  - command statuses: `pending`, `running`, `succeeded`, `failed`, `cancelled`, `superseded`
  - command names: `backup.create`, `restore.request`
  - target: `rust_daemon`
- Phase 04B added the artifact contract:
  - `manifest.json`
  - `data/local.db`
  - `data/blog-assets/...`
  - `data/user-files/...`
  - archive-level SHA-256 stored outside the archive
  - strict archive path validation
  - no file-by-file checksum table in v1
- Phase 04C added the restore safety pipeline:
  - `restore_plans`
  - restore plan confirmation
  - pre-restore backup requirement
  - guarded `RestoreCommandRepository.enqueueRestoreRequest()`
  - strengthened `RestoreCommandRequest` payload with `restorePlanId`, `snapshotId`, archive integrity, schema version, restore plan version, and data boundary

## Current Code Grounding

### Rust Prototype

`crates/ordo-backup/src/main.rs` currently:

- runs a polling daemon with `ordo-backup daemon --data-dir .data`
- polls `system_commands`
- dispatches old command names `backup` and `restore`
- expects restore payload `{ "snapshot_path": "..." }`
- marks success through `mark_command_complete()`

`crates/ordo-backup/src/db.rs` currently:

- opens `{data_dir}/local.db`
- creates a prototype `system_commands` table itself
- polls `target = 'rust_daemon' AND status = 'pending'`
- exposes mock insert helpers for old commands
- marks success with status `complete`, which is not a valid Node-owned status
- does not use `lease_owner`, `lease_expires_at`, `error_message`, requester metadata, or command result metadata

`crates/ordo-backup/src/backup.rs` currently:

- snapshots SQLite with `rusqlite::backup`
- writes zip archives under `{data_dir}/backups`
- writes `local.db`, `blog-assets`, and `user-files` at zip root
- reads each file fully into memory
- does not emit `manifest.json`
- does not compute or return archive-level hash/size
- does not reject symlinks explicitly
- does not create/update `backup_snapshots`

`crates/ordo-backup/src/restore.rs` currently:

- uses `ZipArchive::extract()`
- expects staged `local.db`, `blog-assets`, and `user-files` at zip root
- removes live asset directories before replacement
- does not validate the 04B manifest contract
- does not verify archive hash/size from the command
- does not enforce restore plan status or pre-restore backup gating
- has no real integration test

This prototype shape must be replaced, not preserved.

### Node Contracts To Consume

`src/lib/appliance/backup/types.ts` currently defines the pre-04D payloads:

- `BackupCommandPayload`
  - `kind: "manual" | "scheduled" | "pre_restore"`
  - `requestedAt`
  - optional `restorePlanId`
- `RestoreCommandRequest`
  - `restorePlanId`
  - `snapshotId`
  - `archivePath`
  - `expectedArchiveHash`
  - `expectedArchiveSizeBytes`
  - `manifestSchemaVersion`
  - `restorePlanVersion`
  - `requestedAt`
  - optional `dataBoundary`
  - optional `confirmationRef`
- `SystemCommandRepository`
- `RestoreCommandRepository`
- `BackupSnapshotRepository`
- `RestorePlanRepository`

`src/adapters/BackupSystemCommandDataMapper.ts` currently:

- allows generic `backup.create` enqueue
- intentionally rejects generic `restore.request` enqueue
- exposes `enqueueRestoreRequest()` as the only restore command insertion seam

`src/lib/appliance/backup/restore-command-service.ts` currently:

- requires ADMIN
- requires restore plan status `confirmed`
- rechecks snapshot metadata against the plan
- requires the pre-restore backup command to be `succeeded`
- requires a linked `pre_restore` snapshot with status `succeeded`
- writes a `restore.request` command for `target = "rust_daemon"`
- moves the plan to `running`

04D must consume that command. It must not create a second unsafe restore enqueue path.

## Implementation Design

### Rust Architecture

Refactor `crates/ordo-backup` into explicit modules with small ports:

- `command.rs`
  - Node-owned command DTOs.
  - `backup.create` and `restore.request` payload parsing.
  - status vocabulary aligned to TypeScript.
- `command_store.rs`
  - SQLite command claiming, completion, and failure updates.
  - No production table creation. Rust may verify required tables/columns at startup and fail closed with a clear error.
  - Test-only schema helpers may exist behind test support modules.
- `artifact.rs`
  - manifest DTOs mirroring the 04B TypeScript contract.
  - archive layout constants.
  - archive hash/size calculation.
- `archive_writer.rs`
  - streaming zip writer for `manifest.json`, `data/local.db`, `data/blog-assets/...`, and `data/user-files/...`.
- `archive_reader.rs`
  - path-safe zip reader/extractor for restore staging.
  - no `ZipArchive::extract()`.
- `sqlite_snapshot.rs`
  - SQLite backup API snapshot and restore helpers.
  - quick integrity checks.
- `backup_executor.rs`
  - executes `backup.create`.
- `restore_executor.rs`
  - executes `restore.request`.
- `daemon.rs`
  - polling loop, lease expiration recovery, and graceful shutdown.

Keep `main.rs` thin: parse CLI args, build dependencies, run the daemon or test/dev subcommands.

Required Rust dependencies should be explicit and minimal:

- keep `rusqlite` with `bundled` and `backup`.
- keep `zip`.
- add `sha2` or equivalent for streaming SHA-256.
- add `walkdir` only if it keeps traversal safer and simpler than recursive `std::fs` code.
- avoid async runtimes in 04D; the executor is a small blocking daemon over SQLite and filesystem I/O.
- keep `#![deny(clippy::all)]`; fix or justify `pedantic` warnings rather than suppressing broad modules.

### Command Claiming

Use `system_commands.lease_owner` and `lease_expires_at`.

Required behavior:

1. Claim only `target = 'rust_daemon'`, `status = 'pending'`.
2. Use SQLite busy timeout and short transactions. Do not hold a transaction while copying files, hashing archives, or restoring live data.
3. Claim atomically with a compare-and-set update:
   - set `status = 'running'`
   - set `lease_owner`
   - set `lease_expires_at`
   - update `updated_at`
   - only if current status is still `pending`
4. Ignore unknown command names by marking them `failed` with a concise `error_message`.
5. Mark successful commands `succeeded`, never `complete`.
6. Mark failed commands `failed` with `error_message` and compact `result_payload` where useful.
7. Do not claim `restore.request` unless its payload validates against the Phase 04C shape.
8. Store command result payloads as valid JSON objects. Do not write raw strings, logs, stack traces, secrets, or full file inventories.

Recommended stale-running behavior for 04D:

- if a command is `running` and `lease_expires_at` is in the past, mark it `failed` with a recovery error before claiming new work.
- do not silently re-run a restore after process crash in v1.
- backup commands may later become retryable, but 04D should be conservative.

### Backup Execution

For `backup.create`, Rust should:

1. Parse and validate `BackupCommandPayload`.
2. Require a Node-created `snapshotId` in the command payload.
   - 04D should extend the Node backup command service first so it creates the pending `backup_snapshots` row, then enqueues `backup.create` with `snapshotId`.
   - Rust may update that snapshot row, but it must not invent a second snapshot identity path.
3. Require executor metadata in the command payload:
   - `dataBoundary.dataDir`
   - `dataBoundary.sqlitePath`
   - `dataBoundary.blogAssetRoot`
   - `dataBoundary.userFileRoot`
   - `appVersion`
   - `sourceRuntimeProfileId`
4. Canonicalize payload paths and require them to sit inside the declared data boundary.
5. Create a backup staging directory outside live roots and outside the final archive path.
6. Create a SQLite backup API snapshot at a staging path.
7. Run `PRAGMA quick_check` or equivalent on the staged SQLite file.
8. Build `manifest.json` matching `BackupManifest`:
   - `schemaVersion = "1"`
   - `appVersion`
   - `backupId = snapshotId`
   - `kind`
   - `sourceRuntimeProfileId`
   - `sourceDataRoot`
   - `sqlite.relativePath = "data/local.db"`
   - required roots for `local.db`, `blog-assets`, and `user-files`
   - exclusions summary
   - `archive.hashAlgorithm = "sha256"`
   - `compatibility.requiresRestorePlanVersion = "1"`
9. Write the archive to a temporary path first, then atomically rename it to the final archive path when complete.
10. Write archive layout:

```text
manifest.json
data/local.db
data/blog-assets/...
data/user-files/...
```

11. Reject symlinks. Do not follow them.
12. Stream file contents; do not read whole files into memory.
13. Represent empty asset roots intentionally. Empty roots may be directory entries, manifest root metadata, or both, but restore tests must prove empty roots round-trip.
14. Exclude:
    - existing backup archives
    - backup staging directories
    - restore staging directories
    - `.server.lock`
    - runtime logs
    - build/cache directories already listed by the Phase 02 data boundary
15. Compute final archive SHA-256 and byte size after the archive is finalized.
16. Update `backup_snapshots` to `succeeded` with:
    - `archive_path`
    - `archive_hash`
    - `archive_size_bytes`
    - `manifest_schema_version`
    - `app_version`
    - `validated_at`
17. If `kind = "pre_restore"` and `restorePlanId` is present, link `restore_plans.pre_restore_backup_snapshot_id` to `snapshotId` after the snapshot succeeds.
18. Append backup audit events for executor start, success, and failure unless a later Node service owns the same events in-process. Do not silently skip lifecycle evidence.
19. Update `system_commands.result_payload` with compact metadata:
    - `snapshotId`
    - `archivePath`
    - `archiveHash`
    - `archiveSizeBytes`
    - `manifestSchemaVersion`
    - `appVersion`
20. Mark the command `succeeded`.

If backup fails:

- mark the command `failed`.
- mark the snapshot `failed` with a concise `failure_message`.
- if the command was a pre-restore backup for a plan, leave the restore plan confirmed but still blocked by 04C authorization rules.
- preserve failed staging paths only when useful and clearly outside live roots; otherwise clean them.

04D may call the TypeScript `BackupArchiveService` after Rust writes the archive only if the runtime already has a stable internal boundary for doing so. The simpler v1 path is for Rust to write the artifact according to the 04B contract and prove with both Rust tests and existing TypeScript validation tests that the artifact validates.

### Restore Execution

For `restore.request`, Rust should:

1. Parse and validate the full `RestoreCommandRequest`.
2. Require `dataBoundary` in the payload even though the TypeScript type is currently optional.
3. Canonicalize the data-boundary paths and require the live SQLite path and asset roots to sit inside the declared data dir.
4. Load the referenced `restore_plans` row.
5. Require:
   - plan id matches payload `restorePlanId`
   - plan status is `running`
   - plan `restore_command_id` matches the current command id
   - plan snapshot id, archive path, hash, size, schema version, and restore plan version match the payload
6. Load the referenced `backup_snapshots` row and verify the same archive metadata.
7. Compute the archive SHA-256 and byte size before extraction.
8. Reject mismatches before touching live data.
9. Read and validate `manifest.json`.
10. Reject unsupported schema version or restore plan version.
11. Reject unsafe archive paths before extraction:
   - absolute paths
   - drive-prefixed paths
   - null bytes
   - `.`
   - `..`
   - backslash traversal
   - anything outside `manifest.json`, `data/local.db`, `data/blog-assets/...`, `data/user-files/...`
   - symlinks
12. Extract into a fresh restore staging directory under the data boundary.
13. Require staged `data/local.db`; a restore archive without SQLite is invalid in v1.
14. Run SQLite quick integrity check on staged `data/local.db`.
15. Restore SQLite through `rusqlite::backup`, not by copying over the live DB.
16. Replace asset roots through staged directory swaps:
    - do not delete live roots until staged roots are fully validated.
    - keep rollback-safe temporary names for the duration of the operation where practical.
    - when an archive root is intentionally empty, replace the live root with an empty directory.
17. Clean staging on success.
18. Mark the `restore_plans` row `succeeded`.
19. Mark the command `succeeded`.
20. Append restore audit events for executor start, success, and failure unless a later Node service owns the same events in-process.

If restore fails after live mutation begins:

- mark command `failed`.
- mark plan `failed`.
- preserve as much diagnostic context as possible in `error_message` and `result_payload`.
- do not attempt an automatic rollback in 04D unless it can be proven with integration tests. The required pre-restore backup from 04C is the recovery artifact.

Dangerous restore ordering rule:

- validation, hash checks, manifest checks, path checks, staging extraction, and staged SQLite integrity checks must complete before live SQLite or live asset roots are touched.
- the first live mutation must happen only after all non-mutating checks pass.

### TypeScript Changes Required In 04D

04D should add only the Node code needed to support the Rust executor cleanly:

- Extend `BackupCommandPayload` with executor metadata required by the 04D service path:
  - `snapshotId`
  - `dataBoundary`
  - `appVersion`
  - `sourceRuntimeProfileId`
- Add a dedicated backup command creation service method that creates a pending snapshot first, then enqueues `backup.create` with `snapshotId`.
- Make executor-required backup payload fields required by the new 04D service path, even if the base interface remains temporarily compatible during implementation.
- Keep generic restore enqueue blocked.
- Add repository methods needed by health/admin later only if Rust cannot update rows directly.
- Add tests proving the `backup.create` payload that Rust receives is sufficient to create a 04B-valid archive.
- Add tests proving `restore.request` remains only available through the 04C authorization service.

Do not add admin UI or conversation tools in 04D. That belongs to 04E.

### Docker And Runtime Integration

Decision for this phase:

- Rust should run as a supervised child in the single-image container, started by `scripts/start-server.mjs`.
- Local development may run it through an explicit npm script or CLI command.
- Compose sidecar is not the default for 04D because the product goal is a self-contained appliance image.

Required runtime work:

- Build the Rust binary into the production image.
- Make startup report executor availability without failing the whole app when disabled for local development.
- Add env/config controls:
  - `DISABLE_BACKUP_EXECUTOR=1`
  - `ORDO_BACKUP_EXECUTOR_PATH`
  - optional poll interval and lease timeout envs
- Make Phase 03 health distinguish:
  - executor configured
  - executor disabled
  - executor binary missing
  - command backlog/failures present
  - last successful backup metadata

Full Docker verification can remain Phase 05, but 04D must at least make the runtime path explicit and testable.

## Safety Rules

- Rust must never create policy, role, admin, or conversational authority.
- Rust must never create production schema tables. Node owns schema creation and migrations.
- Rust must never bypass `restore_plans`.
- Rust must never accept old `restore` payload `{ snapshot_path }`.
- Rust must never use `ZipArchive::extract()` for live restore.
- Rust must never write archive entries at zip root except `manifest.json`.
- Rust must never store secrets in command result payloads or error messages.
- Rust must not add file-by-file checksums to SQLite in v1.
- Rust must reject symlinks.
- Rust must canonicalize filesystem paths before comparing boundaries.
- Rust must use streaming file I/O for archive contents.
- Rust must mark success as `succeeded`.
- Rust must use concise failures and leave failed artifacts inspectable.
- Rust must not expose backup/restore tools in `default_chat`.

## Clean Architecture Notes

- Single Responsibility: command store claims work; backup executor writes artifacts; restore executor applies artifacts; archive modules validate path safety.
- Open/Closed: manifest version validation should be isolated so schema v2 can be added without rewriting daemon flow.
- Liskov: test archive readers/writers and filesystem implementations should satisfy the same executor contracts.
- Interface Segregation: daemon code should not know archive internals; archive code should not know SQLite command claim semantics.
- Dependency Inversion: executors should depend on small traits for command store, filesystem, archive, clock, and ids so tests do not need a real daemon loop.
- Facade pattern: the daemon composes command store + executors behind one run loop.
- Strategy pattern: dispatch command names to executor strategies.
- Template Method: backup and restore should share the claim/run/succeed/fail command lifecycle without sharing I/O internals.
- Factory pattern: production CLI builds concrete SQLite, filesystem, archive, and clock implementations.

## Positive Use Cases

- Node enqueues `backup.create`; Rust creates a 04B-valid archive, updates snapshot metadata, and marks the command `succeeded`.
- Node authorizes `restore.request` through Phase 04C; Rust validates the command against `restore_plans`, restores staged data, marks the command `succeeded`, and marks the plan `succeeded`.
- Rust daemon can process commands while Node handles normal request load because communication is through SQLite.
- Empty `blog-assets` and `user-files` roots are represented intentionally and restore correctly.

## Negative Use Cases

- Rust rejects old command names `backup` and `restore`.
- Rust rejects malformed backup payloads.
- Rust rejects `restore.request` that does not match a running restore plan.
- Rust rejects archive hash mismatch before extraction.
- Rust rejects archive path traversal.
- Rust rejects symlinks.
- Rust marks failed commands with useful `error_message`.
- Rust does not mutate live data when restore validation fails.

## Edge Use Cases

- Node and Rust contend for SQLite; Rust uses busy timeout and short transactions for command claim/update.
- Rust process exits while a command is running; stale lease recovery marks the command failed rather than silently replaying a dangerous restore.
- Docker image does not contain Rust binary; health reports backup executor unavailable.
- Archive creation fails after staging SQLite snapshot; staging files are cleaned or left in a clearly named failed staging directory outside live roots.
- Restore fails after SQLite restore but before asset replacement; failure is recorded, plan is failed, and the pre-restore backup remains the recovery point.
- Source archive has no asset files; restore creates empty asset roots rather than treating them as missing data.

## Required Tests

### Rust Unit Tests

- command parser accepts valid `backup.create`.
- command parser accepts valid `restore.request`.
- command parser rejects old `backup` / `restore` command names.
- command parser rejects missing archive integrity fields.
- archive path validator rejects traversal, absolute paths, drive prefixes, null bytes, backslash traversal, and symlinks.
- archive writer emits `manifest.json`, `data/local.db`, `data/blog-assets/...`, and `data/user-files/...`.
- archive writer streams file contents without whole-file buffering in the helper API.

### Rust Integration Tests

- backup against a temporary `.data` tree creates an archive that contains the 04B layout.
- backup computes final `sha256:<hex>` and byte size.
- backup updates `backup_snapshots` and `system_commands` to `succeeded`.
- pre-restore backup success links `restore_plans.pre_restore_backup_snapshot_id`.
- backup failure marks both command and snapshot failed.
- restore from a generated archive restores SQLite rows and asset files into a temporary `.data` tree.
- restore rejects archive hash mismatch before live data changes.
- restore rejects unsafe archive entry before live data changes.
- restore rejects missing `data/local.db`.
- restore rejects a payload whose data-boundary paths escape the data dir.
- restore requires a `restore_plans` row in `running` status with matching `restore_command_id`.
- restore failure marks both command and plan failed.
- stale running command recovery marks expired work `failed`.

### TypeScript Tests

- `backup.create` payload includes the data needed by Rust, including a Node-created `snapshotId`.
- pre-restore backup command payload includes `restorePlanId` and the Rust success path can link the snapshot back to the plan.
- generic `restore.request` enqueue remains blocked.
- 04C `RestoreCommandService` still creates the only executable restore command path.
- TypeScript `BackupArchiveValidator` validates a Rust-produced archive fixture.
- data-access canary remains green.

### Runtime Tests

- production image build includes the Rust binary or reports executor unavailable in health when disabled/missing.
- local dev command can run the daemon against a temp data dir.
- health can distinguish disabled, unavailable, idle, processing, failed, and last-success states at least at the contract level.

## Exit Criteria

- Rust follows the Node-owned schema and status vocabulary.
- Old Rust command names and status `complete` are gone from production paths.
- Rust writes 04B-valid backup archives.
- Rust validates 04C restore commands before live writes.
- Rust restore uses safe staging and rejects unsafe archive entries.
- Backup and restore integration tests pass against temporary data directories.
- TypeScript validation can read a Rust-produced backup artifact.
- Docker/runtime integration path is explicit and testable.
- Phase 04E can build admin/conversation self-service on top of real command state without adding unsafe execution shortcuts.

## Implementation Summary

Implemented on 2026-05-02.

- Replaced the old `crates/ordo-backup` prototype modules with a governed Rust executor:
  - `command.rs`
  - `command_store.rs`
  - `artifact.rs`
  - `archive_writer.rs`
  - `archive_reader.rs`
  - `sqlite_snapshot.rs`
  - `backup_executor.rs`
  - `restore_executor.rs`
  - `daemon.rs`
- Removed the prototype `backup.rs`, `db.rs`, and `restore.rs` paths.
- Added a Rust library surface plus a thin CLI with:
  - `daemon`
  - `run-once`
- Added Node-created backup snapshot identity to `BackupCommandPayload`.
- Added executor-required backup payload metadata:
  - data boundary
  - app version
  - source runtime profile id
- Updated manual backup command creation to create the pending snapshot before enqueueing `backup.create`.
- Updated pre-restore backup requests to create a pending `pre_restore` snapshot and include `restorePlanId`.
- Implemented Rust command claiming against Node-owned `system_commands` using `pending`, `running`, `succeeded`, and `failed`.
- Implemented 04B archive layout and manifest generation in Rust.
- Implemented archive-level SHA-256 and byte size result metadata.
- Implemented path-safe restore staging without `ZipArchive::extract()`.
- Implemented restore plan and snapshot metadata checks before live mutation.
- Implemented pre-restore snapshot linking after successful `pre_restore` backup execution.
- Added backup/restore executor health that distinguishes disabled, unavailable, idle, processing, failed, and last-success states.
- Added single-image Docker build and startup supervision for the Rust executor.
- Added `npm run backup:executor` as the local Rust executor entrypoint.

Evidence: `../evidence/04d-rust-backup-executor-integration-2026-05-02.md`.
