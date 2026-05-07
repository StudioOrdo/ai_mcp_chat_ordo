# Phase 04A Evidence - Backup Governance Contract

Date: 2026-05-02

## Implemented

- Added Node-owned backup governance contracts under `src/lib/appliance/backup`.
- Added backup command validation, admin-only command service, default backup policy, and audit metadata redaction.
- Added repository-level requester validation so manual backup commands require an admin requester and a non-empty request source.
- Added clean SQLite tables for:
  - `system_commands`
  - `backup_snapshots`
  - `backup_policy`
  - `backup_restore_audit_events`
- Added SQLite data mappers for command, snapshot, policy, and audit records.
- Added `RepositoryFactory` exports for all new backup governance data mappers.
- Kept Phase 04A within governance scope:
  - no archive creation
  - no archive validation
  - no restore execution
  - no restore-plan persistence
  - no file-by-file checksum table

## Validation

Targeted tests:

```text
npm test -- src/lib/appliance/backup/backup-command-validation.test.ts src/lib/appliance/backup/backup-command-service.test.ts src/lib/appliance/backup/backup-prompt-exposure.test.ts src/adapters/BackupGovernanceDataMapper.test.ts

Test Files  4 passed (4)
Tests  17 passed (17)
```

Data-access canary:

```text
npm test -- src/lib/db/data-access-canary.test.ts

Test Files  1 passed (1)
Tests  2 passed (2)
```

Typecheck:

```text
npm run typecheck

tsc --noEmit
```

Full suite:

```text
npm test

Test Files  695 passed (695)
Tests  5011 passed | 2 skipped (5013)
```

## QA Notes

- The first test pass exposed a schema ordering issue when a prototype `system_commands` table exists locally. The implementation was corrected so system command indexes are created after migration repair, not before it.
- The second spec pass found that `restore.request` enqueue was too permissive for Phase 04A. The data mapper now rejects restore command enqueue until Phase 04C; restore request shape validation remains available.
- The final QA pass found that the mapper validated command shape but did not enforce requester authority tightly enough. Manual backup enqueue now requires `requestedByRole = ADMIN` and a non-empty `requestedFrom`.
- The repeated closeout pass found the schema smoke test was too weak. The mapper suite now asserts exact `system_commands` columns, required command indexes, and `backup_snapshots` columns so future schema drift is caught before Phase 04B.
- Existing Rust `complete` status is intentionally not supported by the Node contract. Phase 04D must update Rust to the Node-owned status vocabulary.
