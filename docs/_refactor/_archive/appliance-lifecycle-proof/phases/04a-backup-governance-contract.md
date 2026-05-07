# Phase 04A - Backup Governance Contract

Status: Complete

## Goal

Create the Node-owned backup/restore governance contract before any restore execution is trusted.

This phase defines the source of truth for backup commands, restore commands, backup policy, audit events, and role exposure. It does not need to create real archives or modify live data.

## Current Code Grounding

- `src/lib/appliance/data-boundary.ts` defines `DATA_DIR`, SQLite path, blog asset root, user file root, include paths, and exclude paths.
- `src/lib/appliance/health-facade.ts` already includes a `backup_restore` component.
- `src/lib/appliance/probes/backup-restore-probe.ts` currently reports `unknown` with `"Backup/restore service is not implemented yet."`
- `src/lib/db/schema.ts` calls `createTables(db)` and then `runMigrations(db)`.
- `src/lib/db/tables.ts` owns first-boot table creation.
- `src/lib/db/migrations.ts` owns additive table/column/index migration for future installs after this package ships.
- `src/lib/db/data-access-canary.test.ts` enforces that new DataMapper construction goes through `src/adapters/RepositoryFactory.ts` and that new direct `getDb()` callers are not casually added.
- `src/adapters/RepositoryFactory.ts` is the approved composition surface for SQLite-backed repositories.
- `crates/ordo-backup/src/db.rs` currently creates a prototype `system_commands` table, polls `target = 'rust_daemon' AND status = 'pending'`, and marks completion with status `complete`. This prototype schema should be replaced, not preserved.
- Phase 01 prompt exposure requires backup/restore tools to be `operator_only` or `internal_only`.
- `src/core/tool-registry/ToolRegistry.ts` hides `operator_only` tools from `default_chat` and exposes them only in `operator_chat`; `internal_only` tools are hidden except in internal projection mode.

## Design

Add application contracts under `src/lib/appliance/backup` or equivalent:

- `BackupCommand`
- `RestoreCommand`
- `RestoreCommandRequest`
- `BackupPolicy`
- `BackupSnapshot`
- `BackupOperationStatus`
- `BackupOperationAuditEvent`
- `SystemCommandRepository`
- `BackupPolicyRepository`

Recommended file shape:

- `src/lib/appliance/backup/types.ts`
- `src/lib/appliance/backup/backup-policy-defaults.ts`
- `src/lib/appliance/backup/backup-command-service.ts`
- `src/lib/appliance/backup/backup-command-validation.ts`
- `src/adapters/BackupSystemCommandDataMapper.ts`
- `src/adapters/BackupSnapshotDataMapper.ts`
- `src/adapters/BackupPolicyDataMapper.ts`
- `src/adapters/BackupRestoreAuditDataMapper.ts`

Repository construction must be added to `src/adapters/RepositoryFactory.ts`; do not add new direct `getDb()` callers outside approved data access seams.

Recommended command statuses:

- `pending`
- `running`
- `succeeded`
- `failed`
- `cancelled`
- `superseded`

Rust executor rule:

- Phase 04A should define `succeeded` as the Node-owned terminal success status.
- Rust must be updated in Phase 04D to use the Node-owned status vocabulary. Do not carry `complete` forward as a supported application status.

Recommended backup kinds:

- `manual`
- `scheduled`
- `pre_restore`

Recommended restore statuses:

- `draft`
- `validated`
- `confirmation_required`
- `confirmed`
- `running`
- `succeeded`
- `failed`
- `cancelled`

Restore status values are reserved contract values for Phase 04C. Phase 04A should define them in types and validation, but it should not persist restore plans or enqueue restore execution yet.

Recommended backup policy:

- `enabled: boolean`
- `interval: "disabled" | "6h" | "12h" | "daily" | "weekly"`
- `retentionCount: number`
- `lastScheduledAt: string | null`
- `nextScheduledAt: string | null`
- `latestSuccessfulBackupId: string | null`

Safe default policy:

- `enabled: true`
- `interval: "daily"`
- `retentionCount: 7`
- `lastScheduledAt: null`
- `nextScheduledAt: null`
- `latestSuccessfulBackupId: null`

This default does not create archives in Phase 04A. It only gives later phases a deterministic policy row.

## Schema

Node should create and migrate the command tables.

Implementation placement:

- Add first-boot `CREATE TABLE IF NOT EXISTS` statements to `src/lib/db/tables.ts`.
- Add only normal forward-compatible migration/index logic to `src/lib/db/migrations.ts`. This is greenfield; do not add compatibility branches for prototype Rust-created rows.
- Keep schema idempotent under repeated `ensureDbSchema()` calls.

Minimum tables:

- `system_commands`
- `backup_snapshots`
- `backup_restore_audit_events`
- `backup_policy`

`system_commands` is the executor bridge. It should include:

- `id`
- `target`
- `command`
- `status`
- `payload_json`
- `result_payload`
- `error_message`
- `requested_by_user_id`
- `requested_by_role`
- `requested_from`
- `lease_owner`
- `lease_expires_at`
- `created_at`
- `updated_at`

Recommended indexes:

- `idx_system_commands_target_status_created` on `(target, status, created_at)`
- `idx_system_commands_requested_by_created` on `(requested_by_user_id, created_at)`
- `idx_system_commands_updated` on `(updated_at)`

The lease columns are included now because Phase 04D needs atomic Rust claiming. Phase 04A does not need to run the daemon, but it should avoid another schema migration immediately afterward.

Recommended command targets:

- `rust_daemon` for Rust-executed backup/restore commands.
- `node_scheduler` for scheduler-created governance commands when Phase 04F is implemented.

Recommended command names in Phase 04A:

- `backup.create` for manual or scheduled backup command requests.
- `restore.request` may be validated as a domain request but must not be enqueued as executable until Phase 04C.

`backup_snapshots` should stay intentionally compact. It should include snapshot identity and validation metadata, not one row per archived file:

- `id`
- `kind`
- `status`
- `archive_path`
- `archive_hash`
- `archive_size_bytes`
- `manifest_schema_version`
- `app_version`
- `created_by_user_id`
- `created_at`
- `validated_at`
- `failure_message`

Do not add a file-entry table in v1. The archive manifest is the place for artifact structure; SQLite is the place for lifecycle state.

`backup_policy` should be a singleton table with one row:

- `id` with value `default`
- `enabled`
- `interval`
- `retention_count`
- `latest_successful_backup_id`
- `last_scheduled_at`
- `next_scheduled_at`
- `updated_by_user_id`
- `updated_at`

`backup_restore_audit_events` should be append-only:

- `id`
- `operation_id`
- `operation_kind`
- `event_type`
- `actor_user_id`
- `actor_role`
- `metadata_json`
- `created_at`

Metadata JSON must be redacted and must not contain secrets, full env dumps, API keys, bearer tokens, or raw archive contents.

## Safety Rules

- Only admin/operator flows can enqueue backup/restore commands.
- Restore commands cannot be inserted as directly executable until Phase 04C creates a validated restore plan.
- `system_commands` payloads must be typed and validated before insert.
- All command records must be auditable.
- No secrets in command payloads.
- Do not store per-file checksums or per-file path inventories in SQLite for v1.
- Phase 04A must not create, validate, delete, or restore archive files.
- Phase 04A must not expose any backup/restore tool in `default_chat`.

## Service Rules

- `BackupCommandService.createManualBackupCommand()` may create only a `manual` backup command with `status = pending`.
- `BackupCommandService.validateRestoreRequest()` may validate restore request shape, but it must not persist a restore plan or enqueue a Rust restore command in this phase.
- `BackupPolicyRepository.getOrCreateDefaultPolicy()` must create the singleton default policy if missing.
- `SystemCommandRepository.enqueue()` must validate command type, target, status, payload shape, and requester metadata.
- `BackupSnapshotRepository` can create/read/update snapshot metadata, but Phase 04A should only use statuses needed for governance tests; archive success is introduced in Phase 04B/04D.

## Positive Use Cases

- Admin creates a manual backup command.
- Scheduler-facing command validation accepts a scheduled backup command shape for Phase 04F.
- Restore request shape is validated but not executable.
- Backup policy can be read and updated.
- Missing default policy row is initialized deterministically.
- Rust prototype schema assumptions are removed from the product contract.

## Negative Use Cases

- Non-admin cannot create backup/restore commands.
- Invalid interval is rejected.
- Restore command without a snapshot id is rejected.
- Direct restore execution without confirmation is rejected.
- Persisting a restore plan is out of scope and rejected/deferred until Phase 04C.
- Unknown command target is rejected.
- Command payload containing a secret-like key is rejected or redacted before audit.
- Non-operator prompt projection does not include backup/restore tools.

## Edge Use Cases

- Missing policy row initializes to a safe default.
- Backups disabled means scheduled commands are not created, but manual backups remain available to admins.
- Data-access canary remains green after adding new repositories.

## Required Tests

- Schema test: `ensureSchema()` creates all four backup governance tables on an empty DB.
- Migration test: repeated `ensureSchema()` calls are idempotent and keep the clean Node-owned schema intact.
- Repository test: manual backup command insert/read works and records requester metadata.
- Repository test: invalid command status, interval, target, or payload is rejected.
- Validation test: restore execution command is rejected in Phase 04A.
- Validation test: scheduled backup command shape is valid but no scheduler loop runs in Phase 04A.
- Policy test: missing singleton policy row initializes to the safe default.
- Policy test: invalid interval and invalid retention count are rejected.
- Audit test: events append with redacted metadata.
- Data-access canary: no new unapproved `getDb()` callers.
- Prompt exposure test: future backup/restore descriptors must be `operator_only` or `internal_only`; no Phase 04A tool descriptor is visible in `default_chat`.

## Exit Criteria

- Node owns the backup/restore command schema.
- Typed repositories exist with focused tests.
- Backup policy defaults are defined.
- Admin/operator-only exposure rule is documented and testable.
- No live data mutation happens in this phase.
- Rust prototype schema ownership is superseded by a clean Node-owned contract.
- Phase 04B can consume `backup_snapshots` and `system_commands` without another governance rewrite.
- Phase 04C can add restore-plan persistence without changing Phase 04A command, policy, snapshot, or audit contracts.

## Implementation Evidence

- Evidence file: `../evidence/04a-backup-governance-contract-2026-05-02.md`
