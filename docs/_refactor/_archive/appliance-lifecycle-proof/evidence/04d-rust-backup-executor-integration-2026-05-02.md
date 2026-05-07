# Phase 04D Evidence - Rust Backup Executor Integration

Date: 2026-05-02

## Result

Phase 04D is implemented.

The old Rust prototype was replaced with a governed executor that consumes Node-owned `system_commands`, writes 04B-valid backup archives, validates 04C restore requests before live mutation, updates compact backup/restore lifecycle rows, and runs as a supervised child in the single-image runtime.

## Code Changes

Rust:

- Added `crates/ordo-backup/src/lib.rs`.
- Added `crates/ordo-backup/src/command.rs`.
- Added `crates/ordo-backup/src/command_store.rs`.
- Added `crates/ordo-backup/src/artifact.rs`.
- Added `crates/ordo-backup/src/archive_writer.rs`.
- Added `crates/ordo-backup/src/archive_reader.rs`.
- Added `crates/ordo-backup/src/sqlite_snapshot.rs`.
- Added `crates/ordo-backup/src/backup_executor.rs`.
- Added `crates/ordo-backup/src/restore_executor.rs`.
- Added `crates/ordo-backup/src/daemon.rs`.
- Added `crates/ordo-backup/src/audit.rs`.
- Added `crates/ordo-backup/src/paths.rs`.
- Replaced `crates/ordo-backup/src/main.rs` with a thin CLI.
- Removed prototype `backup.rs`, `db.rs`, and `restore.rs`.
- Added Rust integration coverage in `crates/ordo-backup/tests/governed_executor.rs`.
- Added `sha2` and `walkdir` to `crates/ordo-backup/Cargo.toml`.

TypeScript:

- Extended `BackupCommandPayload` with `snapshotId`, data boundary, app version, and runtime profile id.
- Added `src/lib/appliance/backup/backup-command-payload.ts`.
- Updated `BackupCommandService` to create pending snapshots before enqueueing backup commands.
- Updated `RestorePlanService.requestPreRestoreBackup()` to create a pending pre-restore snapshot and include executor payload metadata.
- Updated backup command validation and tests.
- Added real backup/restore executor health in `src/lib/appliance/probes/backup-restore-probe.ts`.
- Added `src/lib/appliance/probes/backup-restore-probe.test.ts`.
- Updated appliance probe expectations.

Runtime:

- Updated `Dockerfile` to build and copy `ordo-backup` into the single image.
- Updated `scripts/start-server.mjs` to supervise the Rust backup executor.
- Added `DISABLE_BACKUP_EXECUTOR`, `ORDO_BACKUP_EXECUTOR_PATH`, poll interval, and lease timeout runtime controls.
- Added `npm run backup:executor`.
- Updated Docker runtime contract tests.

## Safety Properties Implemented

- Rust no longer creates production schema tables.
- Rust rejects old command names and old restore payload shape.
- Rust marks success as `succeeded`, not `complete`.
- Rust requires Node-created backup snapshot ids.
- Backup writes `manifest.json`, `data/local.db`, `data/blog-assets/...`, and `data/user-files/...`.
- Backup rejects symlinks and streams file contents.
- Backup computes final archive SHA-256 and byte size.
- Backup writes to a temporary archive path before final rename.
- Pre-restore backup success links the safety snapshot to the restore plan.
- Restore checks restore plan status and `restore_command_id`.
- Restore checks backup snapshot archive metadata.
- Restore verifies archive hash and byte size before extraction.
- Restore validates manifest and path layout before live mutation.
- Restore extracts through controlled staging, not `ZipArchive::extract()`.
- Restore requires `data/local.db`.
- Restore uses SQLite backup APIs for database restore.
- Restore replaces asset roots only after validation and staging.
- Restore failure marks the plan and command failed.

## Verification

Rust:

```text
cargo test -p ordo-backup
5 unit tests passed
9 integration tests passed
```

```text
cargo clippy -p ordo-backup --all-targets -- -D warnings
passed
```

TypeScript targeted:

```text
npm test -- src/lib/appliance/probes/backup-restore-probe.test.ts tests/docker-runtime-contract.test.ts src/lib/appliance/backup/backup-command-validation.test.ts src/lib/appliance/backup/backup-command-service.test.ts src/adapters/BackupGovernanceDataMapper.test.ts src/lib/appliance/backup/restore-safety-pipeline.test.ts
6 files passed
35 tests passed
```

Typecheck:

```text
npm run typecheck
passed
```

Full suite:

```text
npm test
699 files passed
5046 tests passed
2 skipped
```

## Remaining Scope

04D does not add admin UI or operator conversation tools. That remains Phase 04E.

04D does not add automatic scheduling or retention. That remains Phase 04F.

04D does not complete full Docker smoke restore verification. That remains Phase 05.
