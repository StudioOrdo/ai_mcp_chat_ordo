# Phase 04B - Manifest Archive And Validation

Status: Complete

## Goal

Implement the manifest-backed backup artifact contract and validation service around the Phase 02 data boundary and Phase 04A governance schema.

This phase proves that a backup artifact is understandable and trustworthy before restore execution exists. It should create and validate backup artifacts in tests and service boundaries, but it must not restore live data.

The v1 design deliberately avoids a heavy cryptographic file manifest. It uses a small manifest plus archive-level integrity, SQLite integrity checks, and strict path safety. That keeps the appliance simple while still preventing blind restores.

## Current Code Grounding

- Phase 00 proved `.data` is the durable appliance boundary and found no governed appliance restore.
- Phase 01 added prompt exposure controls; backup/restore implementation helpers must stay out of `default_chat`.
- Phase 02 added `src/lib/appliance/data-boundary.ts`:
  - `getApplianceDataBoundary()` resolves `dataDir`, `sqlitePath`, `sqliteWalPath`, `sqliteShmPath`, `blogAssetRoot`, `userFileRoot`, include paths, exclude paths, and warnings.
  - `requiredIncludePaths` currently includes `DATA_DIR`, SQLite DB/WAL/SHM, blog assets, and user files.
  - `defaultExcludePaths` excludes `.server.lock`, runtime logs, `.next`, build output, and temp paths.
- Phase 02 added `src/lib/appliance/runtime-profile.ts`:
  - `getApplianceRuntimeProfile()` exposes `profileId`, Docker/compose status, process role, data dir, SQLite path, and warnings.
- Phase 03 added `src/lib/appliance/health-facade.ts` and the placeholder `backup_restore` probe. 04B should not make that probe healthy yet; Phase 04F owns health integration.
- Phase 04A added Node-owned governance contracts under `src/lib/appliance/backup`:
  - command statuses: `pending`, `running`, `succeeded`, `failed`, `cancelled`, `superseded`
  - backup kinds: `manual`, `scheduled`, `pre_restore`
  - snapshot statuses: `pending`, `validating`, `validated`, `succeeded`, `failed`, `deleted`
  - compact `backup_snapshots` metadata with `archive_path`, `archive_hash`, `archive_size_bytes`, `manifest_schema_version`, `app_version`, and `validated_at`
  - `SystemCommandRepository`, `BackupSnapshotRepository`, `BackupPolicyRepository`, and audit repository seams
- `src/adapters/BackupSnapshotDataMapper.ts` currently only supports `createPending()` and `findById()`. 04B needs explicit snapshot update methods for validation results instead of ad hoc SQL.
- `src/lib/db/tables.ts` already owns the compact `backup_snapshots` schema. 04B should not add a per-file manifest table.
- `src/lib/db/data-access-canary.test.ts` enforces that new SQLite-backed repositories are built through `src/adapters/RepositoryFactory.ts`.
- `crates/ordo-backup/src/backup.rs` currently:
  - snapshots SQLite with `rusqlite::backup`
  - writes a zip directly under `${data_dir}/backups`
  - archives `local.db`, `blog-assets`, and `user-files`
  - reads each file fully into memory
  - writes archive entries without the `data/` prefix
  - does not write `manifest.json`
  - does not compute archive-level hash
  - does not reject symlinks explicitly
- `crates/ordo-backup/src/restore.rs` currently calls `ZipArchive::extract()`, which is not acceptable for the final restore path. 04B must provide validation primitives that Phase 04C/04D use before any extraction or live writes.
- `crates/ordo-backup/src/db.rs` and `main.rs` still use prototype command names/statuses (`backup`, `restore`, `complete`). Phase 04D owns bringing Rust polling under the 04A command contract.
- `package.json` currently includes `adm-zip`. That is acceptable for small validation fixtures and tests, but it should not become the production large-archive writer because it is not the streaming Rust I/O path this appliance ultimately needs.

## Design

Add Node-owned artifact contracts under `src/lib/appliance/backup`:

- `backup-manifest.ts`
- `backup-archive-paths.ts`
- `backup-archive-integrity.ts`
- `backup-archive-validator.ts`
- `backup-archive-service.ts`

Suggested contracts:

- `BACKUP_MANIFEST_SCHEMA_VERSION = "1"`
- `BackupManifest`
- `BackupManifestRoot`
- `BackupManifestSqlite`
- `BackupManifestArchive`
- `BackupCompatibilityReport`
- `BackupArchiveEntry`
- `ArchiveReader`
- `ArchiveIntegrityService`
- `BackupArchiveValidator`
- `BackupArchiveService`

Do not put these contracts in the Rust crate as the only source of truth. Rust can mirror or consume them in Phase 04D, but Node remains the contract owner because admin UI, command governance, health, and restore confirmation all run through TypeScript.

Recommended manifest fields:

- `schemaVersion`
- `appVersion`
- `createdAt`
- `backupId`
- `kind`: `manual | scheduled | pre_restore`
- `sourceRuntimeProfileId`
- `sourceDataRoot`
- `sqlite`:
  - `pathPolicy`: `sqlite_backup_api_snapshot`
  - `relativePath`: `data/local.db`
  - `quickIntegrityCheck`: `ok | failed | skipped`
  - `pageCount` where safely available
  - `userVersion` where safely available
- `roots`:
  - `local.db` mapped to `data/local.db`
  - `blog-assets` mapped to `data/blog-assets/`
  - `user-files` mapped to `data/user-files/`
- `exclusions`:
  - normalized names or summaries from `getApplianceDataBoundary().defaultExcludePaths`
  - `symlinks: rejected`
  - `runtimeLogs: excluded`
  - `existingBackups: excluded`
- `archive`:
  - `hashAlgorithm`: `sha256`
- `compatibility`:
  - `warnings`
  - `requiresRestorePlanVersion`

The manifest should not include a file-by-file checksum list in v1. It can include compact root metadata such as root names, expected relative destinations, and empty-root markers.

Important integrity rule: the manifest must not contain the final archive hash value or finalized archive byte size for the archive that contains the manifest. That creates a circular artifact contract. The final archive SHA-256 and byte size belong in `backup_snapshots.archive_hash`, `backup_snapshots.archive_size_bytes`, command result payloads, and validation inputs. The manifest declares artifact identity and the hash algorithm; the snapshot metadata stores the digest and size of the finalized archive bytes.

Archive layout:

```text
manifest.json
data/local.db
data/blog-assets/...
data/user-files/...
```

The Rust prototype currently writes `local.db` at the zip root. 04B should define `data/local.db` as the contract. Phase 04D must update Rust to match it.

Do not archive:

- `.server.lock`
- `.restore_staging`
- `.backup_staging`
- temporary files
- runtime logs
- `.next`
- caches
- existing backup archives unless explicitly exported later

## Responsibilities

### TypeScript

TypeScript owns the manifest schema, validation rules, compatibility report, snapshot metadata transitions, and audit messages.

Required TypeScript work:

- Add manifest and archive validation contracts under `src/lib/appliance/backup`.
- Add path safety helpers that reject:
  - absolute paths
  - empty paths
  - `.` and `..`
  - traversal through `..`
  - backslash traversal on Windows-shaped archive names
  - entries outside the allowed archive layout
  - symlink entries
- Add archive-level SHA-256 validation from the final archive bytes.
- Add manifest validation:
  - exactly one `manifest.json`
  - supported `schemaVersion`
  - `backupId` matches the expected snapshot where provided
  - `kind` is a Phase 04A `BackupKind`
  - archive SHA-256 and byte size match trusted snapshot metadata or explicit validation input
  - root paths match the allowed layout
  - no secret-like manifest keys
- Add a compatibility report rather than a boolean-only result so admin UI and conversation tools can explain failures later.
- Extend `BackupSnapshotRepository` with focused update methods:
  - `markValidating(id)`
  - `markValidated(input)`
  - `markFailed(input)`
  - optionally `markSucceeded(input)` only if the archive was created and validated by the same service path
- Keep repository construction in `src/adapters/RepositoryFactory.ts`.
- Append audit events for validation start, validation success, and validation failure.
- Do not build a production TypeScript zip writer around `adm-zip` for large appliance archives. If TypeScript needs an archive implementation in 04B, keep it to a fixture/test adapter behind the `ArchiveReader` interface and leave production streaming archive writes to Rust in Phase 04D.

### Rust

04B may add Rust archive primitives and tests, but it should not require the Rust daemon to be fully command-integrated. That is Phase 04D.

If Rust is touched in 04B, keep the scope to pure artifact behavior:

- create archive with `manifest.json`
- write `data/local.db`, `data/blog-assets/...`, and `data/user-files/...`
- stream file contents instead of reading entire files into memory
- reject symlink inputs
- compute final archive hash
- validate archive path layout before any extraction
- run SQLite quick integrity check against the snapshotted DB

Do not update Rust polling semantics in 04B unless needed by tests. Command names/status vocabulary belongs to Phase 04D.

## Safety Rules

- Archive paths must be relative and normalized.
- Archive writer must reject symlinks unless a later explicit policy safely handles them.
- Archive reader must reject absolute paths and `..` traversal before any extraction.
- Archive-level hash must be computed while streaming the final archive when possible.
- Archive-level hash must be stored outside the archive being hashed, normally in `backup_snapshots.archive_hash`.
- Rust does not need to compute file-by-file checksums in v1.
- Manifest must not contain environment variables or secrets.
- Backup archive must validate after creation before being marked successful.
- Restore must never trust the zip archive blindly. It must validate manifest version, archive hash, path safety, and SQLite integrity before live writes.
- SQLite WAL/SHM siblings must not be blindly copied. Use a SQLite backup snapshot for `data/local.db`.
- Empty asset roots should be represented intentionally, not treated as failure.
- Validation failure must leave the snapshot in `failed` with a concise failure message and an audit event.
- 04B must not expose backup/restore tools in `default_chat`.
- 04B must not mutate live data except creating a backup artifact under the governed backup location and updating compact backup metadata.

## Clean Architecture Notes

- Single Responsibility: manifest validation validates artifacts; snapshot repositories update metadata; archive writers write bytes; audit repositories record events.
- Open/Closed: future manifest versions can add validators without changing the v1 validator contract.
- Liskov: test archive readers/writers should satisfy the same interfaces as filesystem/zip implementations.
- Interface Segregation: do not force UI or command services to depend on raw zip/Rust details.
- Dependency Inversion: `BackupArchiveService` depends on `ArchiveReader`, `ArchiveIntegrityService`, `BackupSnapshotRepository`, and `BackupRestoreAuditRepository` ports. If 04B adds archive creation before Rust integration, the writer must sit behind an `ArchiveWriter` port and must not leak `adm-zip` into domain services.
- Facade pattern: later admin/conversation flows should call `BackupArchiveService`, not raw zip functions or SQL.
- Strategy pattern: manifest-version validators should be swappable by schema version.
- Factory pattern: concrete repositories still come from `RepositoryFactory`; concrete archive readers/writers can be composed at the service boundary.

## Positive Use Cases

- Create an archive from fixture `.data`.
- Manifest includes SQLite, blog assets, and user files.
- Empty optional asset directories are represented correctly.
- Validation succeeds for a newly created archive.
- Snapshot metadata is marked `validating` before validation and `validated` or `succeeded` only after validation passes.
- Audit records validation success with redacted compact metadata.

## Negative Use Cases

- Validation rejects archive hash mismatch.
- Validation rejects missing manifest.
- Validation rejects unsupported future manifest version.
- Validation rejects archive path traversal.
- Validation rejects absolute paths.
- Validation rejects `manifest.json` with secret-like keys.
- Validation rejects entries outside `data/local.db`, `data/blog-assets/`, and `data/user-files/`.
- Validation rejects symlink entries.
- Validation rejects `kind` outside the Phase 04A `BackupKind` vocabulary.
- Validation rejects a manifest `backupId` that does not match the expected snapshot id.
- Archive creation fails without marking a snapshot successful.

## Edge Use Cases

- Large media file is archived without loading the whole archive into memory.
- SQLite WAL/SHM siblings are handled through the safe SQLite snapshot path, not copied blindly.
- Custom `STUDIO_ORDO_DB_PATH` and `STUDIO_ORDO_BLOG_ASSET_ROOT` remain governed by the Phase 02 data boundary.
- Archive contains many small files; validation stays archive-level and does not require per-file SQLite rows.
- `blog-assets` or `user-files` does not exist yet.
- `STUDIO_ORDO_DB_PATH` resolves outside `DATA_DIR`; manifest records the policy warning and the archive still uses `data/local.db`.
- Repeated validation of the same archive is idempotent.
- Unsupported future manifest version returns a compatibility report instead of throwing an opaque error.
- Corrupt SQLite snapshot fails integrity validation before any restore plan can be created.

## Required Tests

TypeScript tests:

- Manifest type/validator test: valid v1 manifest passes.
- Manifest validator test: unsupported future version returns incompatible report.
- Manifest validator test: secret-like keys fail or are redacted before audit.
- Archive path safety test: absolute paths, `..`, backslash traversal, empty names, and disallowed roots are rejected.
- Archive integrity test: SHA-256 and byte size are computed from archive bytes, compared to trusted snapshot metadata or validation input, and mismatch fails.
- Manifest integrity test: manifest declares `hashAlgorithm` but does not contain the final archive hash value or finalized archive byte size.
- Archive validator test: missing `manifest.json` fails.
- Archive validator test: duplicate or malformed manifest fails.
- Archive validator test: path traversal entry fails before extraction.
- Snapshot repository test: `markValidating`, `markValidated`, and `markFailed` update only the intended compact metadata.
- Service test: successful validation updates snapshot metadata and appends audit.
- Service test: failed validation marks snapshot failed and appends audit without secrets.
- Data-access canary remains green.
- Prompt exposure test remains green; 04B does not add default-chat tools.

Rust tests if Rust archive code is touched in 04B:

- Archive creates `manifest.json` and `data/local.db`.
- Archive includes nested `data/blog-assets/...` and `data/user-files/...`.
- Archive skips or rejects configured excluded paths.
- Archive rejects symlink input.
- Archive writes a large file by streaming.
- Validator rejects traversal and absolute archive paths.
- SQLite snapshot passes `PRAGMA quick_check`.

## Exit Criteria

- Manifest types and validation service exist.
- Archive creation and validation tests cover positive, negative, and edge cases.
- Backup creation does not mark a snapshot successful until validation passes.
- No file-entry table or file-by-file checksum requirement is introduced in v1.
- No restore writes live data in this phase.
- `backup_snapshots` compact metadata can record validated archive path, SHA-256 hash, size, manifest version, app version, validation timestamp, and failure message.
- Phase 04C can build restore planning on top of the validator without changing the artifact contract.
- Phase 04D can update Rust to execute `backup.create` using this manifest/archive contract without changing Node governance.

## Relationship To Phase 04

`04-backup-restore-service.md` is now the parent index for the 04x series, not a separate implementation phase. Do not implement a separate monolithic Phase 04 after 04A-04F. Implementing 04A through 04F is the implementation of Phase 04.

## QA Certification

Reviewed against current code on 2026-05-02.

- Grounded in Phase 00 durable data evidence, Phase 01 prompt exposure controls, Phase 02 data-boundary/runtime-profile contracts, Phase 03 health placeholder behavior, and Phase 04A backup governance schema.
- Corrected the archive integrity contract so final archive SHA-256 and byte size are stored outside the archive in snapshot metadata/validation inputs, avoiding a circular manifest hash.
- Scoped TypeScript to contract ownership, validation, snapshot state transitions, and audit.
- Scoped Rust to optional pure artifact primitives in 04B, with daemon command integration deferred to Phase 04D.
- Confirmed `04-backup-restore-service.md` is an index implemented by 04A-04F, not a separate monolithic implementation phase.

## Implementation Evidence

- Evidence file: `../evidence/04b-manifest-archive-and-validation-2026-05-02.md`
