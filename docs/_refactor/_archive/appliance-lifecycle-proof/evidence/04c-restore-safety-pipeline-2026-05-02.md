# Phase 04C Evidence - Restore Safety Pipeline

Date: 2026-05-02

## Implemented

- Added restore plan persistence:
  - `restore_plans` table in `src/lib/db/tables.ts`
  - migration guard in `src/lib/db/migrations.ts`
  - compact JSON impact and validation warning fields
  - pre-restore command, pre-restore snapshot, and restore command linkage
- Added restore plan contracts:
  - `RestorePlan`
  - `RestorePlanRepository`
  - `RestorePlanImpactSummary`
  - `RestoreCommandRepository`
  - strengthened `RestoreCommandRequest`
- Added restore plan repository:
  - `src/adapters/RestorePlanDataMapper.ts`
  - explicit state transitions for draft, validated, confirmation required, confirmed, running, succeeded, failed, and cancelled
- Added restore planning and confirmation services:
  - `src/lib/appliance/backup/restore-plan-service.ts`
  - `src/lib/appliance/backup/restore-confirmation-service.ts`
  - `src/lib/appliance/backup/restore-impact-summary.ts`
- Added restore command authorization:
  - `src/lib/appliance/backup/restore-command-service.ts`
  - generic `SystemCommandRepository.enqueue()` still rejects raw `restore.request`
  - restore command enqueue is available only through `RestoreCommandRepository.enqueueRestoreRequest()`
- Hardened command payload validation:
  - `backup.create` with `kind: "pre_restore"` requires `restorePlanId`
  - `restore.request` requires restore plan id, snapshot id, archive path, expected archive hash, expected archive size, manifest schema version, restore plan version, and timestamp
- Added repository factory construction:
  - `getRestorePlanDataMapper()` in `src/adapters/RepositoryFactory.ts`
- Kept Phase 04C in scope:
  - no live restore writes
  - no Rust restore execution
  - no `ZipArchive::extract()` path
  - no default-chat restore tools

## Validation

Focused restore safety tests:

```text
npm test -- src/lib/appliance/backup/restore-safety-pipeline.test.ts

Test Files  1 passed (1)
Tests  7 passed (7)
```

Phase-related targeted tests:

```text
npm test -- src/lib/appliance/backup/restore-safety-pipeline.test.ts src/lib/appliance/backup/backup-command-validation.test.ts src/lib/appliance/backup/backup-command-service.test.ts src/lib/appliance/backup/backup-archive-validation.test.ts src/lib/appliance/backup/backup-archive-service.test.ts src/lib/appliance/backup/backup-prompt-exposure.test.ts src/adapters/BackupGovernanceDataMapper.test.ts src/lib/db/data-access-canary.test.ts

Test Files  8 passed (8)
Tests  50 passed (50)
```

Typecheck:

```text
npm run typecheck

tsc --noEmit
```

Full suite:

```text
npm test

Test Files  698 passed (698)
Tests  5042 passed | 2 skipped (5044)
```

## QA Notes

- Initial implementation review found that repository methods had named transitions but did not enforce allowed source states. `RestorePlanDataMapper` now enforces the restore plan state machine.
- The generic system command enqueue path intentionally still rejects `restore.request`. This preserves the Phase 04A safety latch and forces restore execution requests through the 04C restore service.
- The restore plan stores both pre-restore backup command linkage and pre-restore snapshot linkage. This keeps the safety backup auditable even before Phase 04D supplies real executor completion.
- 04C authorizes restore execution but does not perform restore I/O. The current Rust restore prototype remains blocked from governed restore until Phase 04D replaces its unsafe extraction and hardcoded path behavior.
