# Phase 04C - Restore Safety Pipeline

Status: Complete

## Goal

Implement the Node-owned restore safety control plane: restore plans, archive revalidation, impact summaries, pre-restore backup gating, explicit confirmation, restore command authorization, and audit.

Restore is the dangerous operation. This phase should make it hard for an admin, AI agent, or implementation bug to destroy the only copy of a solopreneur's business data.

04C must not implement raw archive extraction or live file writes. Phase 04D owns the Rust executor that stages and applies the restore. 04C owns the contract that decides whether restore execution may be requested at all.

## Current Code Grounding

- Phase 00 proved `.data` is the durable appliance boundary and found no governed restore path.
- Phase 01 added prompt exposure controls. 04C must not add backup or restore tools to `default_chat`; operator-facing conversation restore belongs to Phase 04E.
- Phase 02 added `src/lib/appliance/data-boundary.ts`:
  - `getApplianceDataBoundary()` resolves `dataDir`, `sqlitePath`, WAL/SHM siblings, `blogAssetRoot`, `userFileRoot`, include paths, exclude paths, and warnings.
  - Restore plans must use this boundary for impact summaries and later executor payloads.
- Phase 03 added `src/lib/appliance/health-facade.ts` and `createBackupRestoreProbe()`.
  - Health may be referenced in plan metadata, but 04C should not mark restore healthy just because planning works.
  - Phase 04F owns full backup/restore health integration.
- Phase 04A added Node-owned governance contracts:
  - `src/lib/appliance/backup/types.ts` defines `RESTORE_STATUSES`, `BackupOperationKind = "backup" | "restore" | "policy"`, `SYSTEM_COMMAND_NAMES = ["backup.create", "restore.request"]`, and `RestoreCommandRequest`.
  - `BackupCommandPayload` currently contains only `kind` and `requestedAt`; 04C must extend or specialize the `pre_restore` backup payload with `restorePlanId` so the safety backup can be linked back to the plan.
  - `src/lib/db/tables.ts` contains `system_commands`, `backup_snapshots`, `backup_policy`, and `backup_restore_audit_events`.
  - `src/adapters/BackupSystemCommandDataMapper.ts` currently rejects `restore.request` with `Restore command enqueue is deferred until Phase 04C.`
  - `src/lib/appliance/backup/backup-command-service.ts` only validates restore payloads; it does not create restore commands.
  - `src/lib/appliance/backup/backup-command-validation.ts` currently requires only `snapshotId` and `requestedAt` for restore requests. 04C must strengthen this payload shape.
- Phase 04B added manifest and archive validation:
  - `BackupArchiveValidator` validates archive paths, exactly one `manifest.json`, manifest compatibility, optional expected integrity, and expected backup id.
  - `BackupArchiveService` marks snapshots `validating`, `validated`, `succeeded`, or `failed` and appends validation audit events.
  - `backup-archive-paths.ts` only allows `manifest.json`, `data/local.db`, `data/blog-assets/...`, and `data/user-files/...`, and rejects symlinks, absolute paths, null bytes, `.` and `..`.
  - `backup-manifest.ts` defines `BACKUP_RESTORE_PLAN_VERSION = "1"` and rejects unsupported restore plan versions.
  - `backup_snapshots.archive_hash` and `backup_snapshots.archive_size_bytes` are trusted metadata outside the archive.
- Existing Rust restore in `crates/ordo-backup/src/restore.rs` is still prototype code:
  - It calls `zip::ZipArchive::extract()`.
  - It assumes `{data_dir}/local.db`.
  - It looks for staged `local.db`, `blog-assets`, and `user-files` without the 04B `data/` archive prefix.
  - It removes live asset directories before replacement.
  - 04C must not route live restore traffic into this path until 04D replaces it with governed, path-safe staging.

## Design

Add a restore planning and authorization layer under `src/lib/appliance/backup`.

Recommended files:

- `restore-plan.ts`
- `restore-plan-service.ts`
- `restore-confirmation-service.ts`
- `restore-command-service.ts`
- `restore-impact-summary.ts`
- `restore-plan-repository.ts` types in `types.ts`

Recommended adapter:

- `src/adapters/RestorePlanDataMapper.ts`

Recommended repository factory change:

- expose `getRestorePlanRepository()` through `src/adapters/RepositoryFactory.ts`

### Restore Plan Persistence

Add a compact `restore_plans` table in `src/lib/db/tables.ts`.

Suggested schema:

```sql
CREATE TABLE IF NOT EXISTS restore_plans (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  status TEXT NOT NULL,
  archive_path TEXT NOT NULL,
  archive_hash TEXT NOT NULL,
  archive_size_bytes INTEGER NOT NULL,
  manifest_schema_version TEXT NOT NULL,
  app_version TEXT NOT NULL,
  restore_plan_version TEXT NOT NULL,
  impact_json TEXT NOT NULL DEFAULT '{}',
  validation_warnings_json TEXT NOT NULL DEFAULT '[]',
  confirmation_phrase TEXT NOT NULL,
  pre_restore_backup_command_id TEXT DEFAULT NULL,
  pre_restore_backup_snapshot_id TEXT DEFAULT NULL,
  restore_command_id TEXT DEFAULT NULL,
  confirmed_by_user_id TEXT DEFAULT NULL,
  confirmed_at TEXT DEFAULT NULL,
  failure_message TEXT DEFAULT NULL,
  created_by_user_id TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (snapshot_id) REFERENCES backup_snapshots(id),
  FOREIGN KEY (pre_restore_backup_command_id) REFERENCES system_commands(id) ON DELETE SET NULL,
  FOREIGN KEY (pre_restore_backup_snapshot_id) REFERENCES backup_snapshots(id) ON DELETE SET NULL,
  FOREIGN KEY (restore_command_id) REFERENCES system_commands(id) ON DELETE SET NULL,
  FOREIGN KEY (confirmed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

Indexes:

- `idx_restore_plans_snapshot_created` on `(snapshot_id, created_at)`
- `idx_restore_plans_status_created` on `(status, created_at)`
- `idx_restore_plans_pre_restore_command` on `(pre_restore_backup_command_id)`
- `idx_restore_plans_pre_restore_backup` on `(pre_restore_backup_snapshot_id)`
- `idx_restore_plans_restore_command` on `(restore_command_id)`

Do not add per-file restore-plan tables in v1. The 04B manifest and archive-level hash are the artifact contract. The restore plan stores the decision, impact summary, validation warnings, and confirmation state.

### Restore Plan Types

Extend `src/lib/appliance/backup/types.ts` with explicit restore-plan contracts:

- `RestorePlan`
- `RestorePlanRepository`
- `RestorePlanImpactSummary`
- `RestorePlanValidationWarnings`
- `RestorePlanCreateInput`
- `RestorePlanConfirmInput`

The `RestorePlan.status` vocabulary should reuse the existing `RESTORE_STATUSES`:

- `draft`
- `validated`
- `confirmation_required`
- `confirmed`
- `running`
- `succeeded`
- `failed`
- `cancelled`

Status transitions should be explicit repository methods, not ad hoc SQL:

- `createDraft(input)`
- `markValidated(input)`
- `markConfirmationRequired(input)`
- `markConfirmed(input)`
- `markPreRestoreBackupRequired(input)`
- `linkPreRestoreBackupSnapshot(input)`
- `markRunning(input)`
- `markSucceeded(input)`
- `markFailed(input)`
- `markCancelled(input)`
- `findById(id)`

### Restore Planning Flow

`RestorePlanService.createPlan()` should:

1. Require `ADMIN` role.
2. Load the selected `BackupSnapshot`.
3. Reject missing snapshots.
4. Reject snapshots not in `validated` or `succeeded`.
5. Require `archivePath`, `archiveHash`, `archiveSizeBytes`, `manifestSchemaVersion`, and `appVersion`.
6. Revalidate the archive with `BackupArchiveValidator` using:
   - expected backup id = `snapshot.id`
   - expected integrity from trusted snapshot metadata
   - `ZipBackupArchiveReader` or equivalent read-only reader
7. Reject invalid archives and append a `restore_plan_validation_failed` audit event.
8. Build an impact summary from the manifest and `getApplianceDataBoundary()`.
9. Create a restore plan in `confirmation_required` status.
10. Store the server-generated confirmation phrase.
11. Append `restore_plan_created` and `restore_plan_confirmation_required` audit events.

The impact summary should be compact and explainable:

- source snapshot id
- snapshot kind
- snapshot created time
- archive path
- archive hash
- archive size
- manifest schema version
- app version
- source runtime profile id
- source data root
- target data dir
- target SQLite path
- target blog asset root
- target user file root
- roots included: `local.db`, `blog-assets`, `user-files`
- manifest warnings
- data-boundary warnings
- note that provider keys and environment variables are not part of the backup artifact

### Confirmation Flow

`RestoreConfirmationService.confirmPlan()` should:

1. Require `ADMIN` role.
2. Load the restore plan.
3. Require status `confirmation_required`.
4. Require exact phrase match.
5. Revalidate that the backing snapshot still has the same archive path, hash, size, schema version, and app version captured by the plan.
6. Mark the plan `confirmed`.
7. Append `restore_plan_confirmed`.

Recommended confirmation phrase:

```text
RESTORE <restore plan short id>
```

Use the restore plan id instead of the snapshot id so repeated plans for the same snapshot do not share a confirmation phrase.

The assistant or admin UI may prepare and explain a restore. It must not create a confirmed restore command in the same conversational turn or one-click UI action that created the plan. Phase 04E owns the user-facing two-step experience.

### Pre-Restore Backup Guard

04C should encode the pre-restore guard even though 04D owns raw backup execution.

Normal restore authorization requires one of these conditions:

- a `pre_restore` backup snapshot linked to the plan is already `succeeded`; or
- a `backup.create` command with `kind: "pre_restore"` and `restorePlanId` has been created for the plan and the restore command remains blocked until the resulting snapshot is linked and `succeeded`.

04C must extend backup command payload validation so `kind: "pre_restore"` requires `restorePlanId`. Manual and scheduled backup payloads should not require that field.

Do not implement an emergency override in 04C. A later phase can add one with a separate explicit policy, stronger confirmation, and audit reason.

Required service behavior:

- `RestorePlanService.requestPreRestoreBackup(planId)` creates or links exactly one pre-restore backup requirement.
- The plan should store `pre_restore_backup_command_id` when it creates the backup command.
- The plan should store `pre_restore_backup_snapshot_id` only after the resulting pre-restore snapshot exists.
- Repeated calls must be idempotent for the same plan.
- Restore command authorization must fail while the linked pre-restore snapshot is missing or not `succeeded`.
- Restore command authorization must also fail while the linked pre-restore backup command is missing, `pending`, `running`, `failed`, `cancelled`, or `superseded`.
- Audit event names:
  - `restore_pre_restore_backup_required`
  - `restore_pre_restore_backup_linked`
  - `restore_pre_restore_backup_blocked`

If current backup execution is not yet available, the plan should remain `confirmed` but not be executable. That is acceptable in 04C; Phase 04D supplies the executor.

### Restore Command Authorization

Do not simply remove the unconditional `restore.request` rejection from the generic `SystemCommandRepository.enqueue()` path. That would recreate the unsafe direct enqueue path 04A intentionally blocked.

Use one of these implementation shapes:

- keep generic `SystemCommandRepository.enqueue()` rejecting `restore.request`, and add a narrower `RestoreCommandRepository.enqueueRestoreRequest()` port used only by `RestoreCommandService`; or
- replace the generic repository with segregated `BackupCommandRepository` and `RestoreCommandRepository` ports.

The preferred implementation is the first option because it is the smallest change from the current 04A/04B code while preserving the safety latch.

Do not allow arbitrary callers to enqueue restore commands directly with only `{ snapshotId, requestedAt }`.

Strengthen `RestoreCommandRequest` to include:

- `restorePlanId`
- `snapshotId`
- `archivePath`
- `expectedArchiveHash`
- `expectedArchiveSizeBytes`
- `manifestSchemaVersion`
- `restorePlanVersion`
- `requestedAt`

Optional, if useful for 04D payloads:

- `dataBoundary`
- `confirmationRef`

`RestoreCommandService.authorizeRestoreCommand()` should:

1. Require `ADMIN` role.
2. Load the restore plan.
3. Require status `confirmed`.
4. Verify the plan's pre-restore backup requirement is satisfied.
5. Recheck snapshot metadata against the plan.
6. Enqueue `restore.request` for `rust_daemon` with the strengthened payload through the restore-only command repository.
7. Store the resulting `restore_command_id` on the plan.
8. Mark plan `running` only after command enqueue succeeds.
9. Append `restore_command_enqueued`.

The data mapper should still validate payload shape and requester metadata. The important design point is that restore command creation flows through the restore service, not raw UI or chat code.

## Clean Architecture Notes

- Single Responsibility: archive validation validates artifacts, restore planning creates plans, confirmation verifies human intent, command service authorizes executor work, repository mappers persist state.
- Open/Closed: future restore plan versions can add validators without changing the v1 service contract.
- Liskov: test archive readers and filesystem readers must satisfy the same `ArchiveReader` contract.
- Interface Segregation: admin UI and conversation tools should not depend on raw zip, Rust, or SQL details.
- Dependency Inversion: restore services depend on repository, validator, data-boundary, and command ports.
- Command pattern: `restore.request` is an executor command produced from a confirmed restore plan.
- State pattern: restore-plan status transitions are explicit and testable.
- Facade pattern: Phase 04E should call a restore application facade, not individual repositories.
- Strategy pattern: restore plan version validators should be swappable by `restorePlanVersion`.
- Interface segregation: generic backup command enqueue should not also be the raw restore command escape hatch.

## Safety Rules

- No live data writes in 04C.
- No call path may invoke `crates/ordo-backup/src/restore.rs` from 04C.
- No `ZipArchive::extract()` semantics are acceptable for governed restore.
- Validate archive and manifest before creating a confirmation-required plan.
- Revalidate trusted snapshot metadata before confirmation.
- Revalidate trusted snapshot metadata before command enqueue.
- Require exact confirmation phrase.
- Require a pre-restore backup before restore command enqueue.
- Refuse restore if the pre-restore backup fails.
- Do not trust archive paths.
- Do not execute restore from an unvalidated, failed, deleted, or legacy archive.
- Do not store secrets in restore plan payloads or audit metadata.
- Write audit events for every meaningful state transition.
- Keep restore tools out of `default_chat`.

## Positive Use Cases

- Restore plan is created for a valid `validated` snapshot.
- Restore plan is created for a valid `succeeded` snapshot.
- Plan impact summary names the exact target data boundary and included roots.
- Exact confirmation phrase marks the plan confirmed.
- Pre-restore backup requirement is created once and reused on retry.
- Confirmed plan with a succeeded pre-restore backup enqueues a governed `restore.request`.
- Audit records plan creation, validation, confirmation, pre-restore backup requirement, and command enqueue.

## Negative Use Cases

- Restore rejects missing snapshot.
- Restore rejects snapshot with status `pending`, `validating`, `failed`, or `deleted`.
- Restore rejects snapshot missing archive metadata.
- Restore rejects archive hash mismatch.
- Restore rejects path traversal.
- Restore rejects unsupported manifest version.
- Restore rejects manifest backup id mismatch.
- Restore rejects confirmation phrase mismatch.
- Restore rejects command authorization before confirmation.
- Restore rejects command authorization without a succeeded pre-restore backup.
- Raw restore command enqueue without a restore plan is rejected.
- Raw generic `SystemCommandRepository.enqueue()` still rejects `restore.request`.
- Non-admin restore planning, confirmation, and authorization are rejected.

## Edge Use Cases

- Repeated plan creation for the same snapshot produces distinct confirmation phrases.
- Snapshot metadata changes after plan creation; confirmation or command authorization is blocked.
- Pre-restore backup command exists but has not completed; restore remains blocked with a retryable message.
- Pre-restore backup fails because SQLite is locked; restore is blocked with a clear retryable error.
- Archive is valid but from a newer incompatible app version; compatibility failure is shown in the plan error.
- Optional provider keys are absent after restore; appliance data restore planning still succeeds while provider health reports separately.
- `.data` warnings exist because custom paths resolve outside `DATA_DIR`; plan records the warnings and does not hide them.
- Audit metadata containing secret-like keys is redacted by the existing audit mapper.

## Required Tests

TypeScript tests:

- Restore plan repository creates and reads plans with compact JSON impact metadata.
- Restore plan repository enforces explicit status transitions.
- Planner rejects missing snapshots.
- Planner rejects snapshots that are not `validated` or `succeeded`.
- Planner rejects snapshots missing archive path, hash, size, schema version, or app version.
- Planner reuses `BackupArchiveValidator` and fails on archive hash mismatch.
- Planner fails on archive path traversal through the 04B archive reader/path validator.
- Planner records data-boundary and manifest warnings in the impact summary.
- Planner appends success and failure audit events with redacted metadata.
- Confirmation succeeds only with exact phrase.
- Confirmation rejects non-admin users.
- Confirmation rejects changed snapshot metadata after plan creation.
- Pre-restore backup requirement is idempotent.
- Pre-restore backup command id and linked snapshot id are persisted separately.
- `validateBackupCreatePayload()` requires `restorePlanId` for `kind: "pre_restore"` and does not require it for `manual` or `scheduled`.
- Command authorization rejects missing or non-`succeeded` linked pre-restore snapshots.
- Command authorization rejects missing, pending, running, failed, cancelled, or superseded pre-restore backup commands.
- Command authorization enqueues `restore.request` only for confirmed plans with satisfied pre-restore backup guard.
- Command authorization stores the resulting restore command id on the plan.
- Raw restore command enqueue without restore-plan payload is rejected.
- Generic `SystemCommandRepository.enqueue()` keeps rejecting `restore.request`; restore command enqueue goes through the restore-only repository/service seam.
- `validateRestoreRequestPayload()` requires the strengthened 04C payload.
- Prompt exposure test remains green; 04C does not add backup/restore tools to `default_chat`.
- Data-access canary remains green; new repositories are constructed through `RepositoryFactory`.

## Exit Criteria

- `restore_plans` schema and repository exist.
- Restore plan services validate snapshots and archives through the 04B contract.
- Restore plans produce compact impact summaries grounded in Phase 02 data boundary.
- Restore confirmation is exact, plan-specific, and admin-only.
- Pre-restore backup gating exists and blocks execution until satisfied.
- `restore.request` command enqueue is possible only through a restore-only repository/service seam and only from a confirmed, gated plan.
- Restore plans retain both pre-restore backup command linkage and restore command linkage for auditability.
- No 04C code performs live restore writes or calls the prototype Rust restore path.
- Positive, negative, and edge tests exist.
- Phase 04D can consume the confirmed restore command contract without changing restore planning semantics.

## Implementation Summary

Implemented in Phase 04C:

- Added `restore_plans` schema and indexes.
- Added restore plan contracts, impact summary type, restore command payload hardening, and restore-only command repository seam.
- Added `RestorePlanDataMapper` with explicit state transitions.
- Added `RestorePlanService` for archive revalidation, impact summaries, confirmation phrase generation, audit, and pre-restore backup requirement/linking.
- Added `RestoreConfirmationService` for exact admin confirmation and snapshot metadata recheck.
- Added `RestoreCommandService` for confirmed, pre-restore-gated `restore.request` authorization.
- Kept generic `SystemCommandRepository.enqueue()` rejecting raw `restore.request`.
- Extended `backup.create` validation so `kind: "pre_restore"` requires `restorePlanId`.
- Kept 04C free of live restore writes and free of calls to the prototype Rust restore path.

Evidence:

- `../evidence/04c-restore-safety-pipeline-2026-05-02.md`

## QA Certification

Reviewed against current code on 2026-05-02:

- `src/lib/appliance/backup/types.ts`
- `src/lib/appliance/backup/backup-command-service.ts`
- `src/lib/appliance/backup/backup-command-validation.ts`
- `src/lib/appliance/backup/backup-archive-validator.ts`
- `src/lib/appliance/backup/backup-archive-paths.ts`
- `src/lib/appliance/backup/backup-manifest.ts`
- `src/lib/appliance/backup/backup-archive-service.ts`
- `src/adapters/BackupSystemCommandDataMapper.ts`
- `src/adapters/BackupSnapshotDataMapper.ts`
- `src/adapters/BackupRestoreAuditDataMapper.ts`
- `src/lib/appliance/data-boundary.ts`
- `src/lib/appliance/health-facade.ts`
- `src/lib/db/tables.ts`
- `crates/ordo-backup/src/restore.rs`

Implemented and re-reviewed against the original phase objectives on 2026-05-02. The key implementation boundary is intentional: 04C authorizes restore execution; 04D makes the Rust executor safe enough to perform it.
