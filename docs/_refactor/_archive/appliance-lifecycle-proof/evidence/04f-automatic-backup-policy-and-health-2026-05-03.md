# Phase 04F Evidence - Automatic Backup Policy And Health

Captured: 2026-05-03T03:17:39Z

## Result

Phase 04F is complete.

Automatic backups are now a governed appliance capability instead of a manual
operator convention. The system can read and update the singleton backup
policy, enqueue due scheduled backups without external cron, reconcile
Rust-completed scheduled backups back into TypeScript-owned policy state, prune
old scheduled archives after validated success, and project health/admin state
without duplicating scheduler logic in routes or React components.

## Implementation Summary

- Added schedule math and policy normalization in
  `src/lib/appliance/backup/backup-schedule-time.ts` and
  `src/lib/appliance/backup/backup-policy-service.ts`.
- Added transactional scheduled command creation in
  `src/lib/appliance/backup/backup-scheduled-command-service.ts`.
- Added due evaluation and conflict checks in
  `src/lib/appliance/backup/backup-schedule-service.ts`.
- Added Rust completion reconciliation and policy promotion in
  `src/lib/appliance/backup/backup-schedule-reconciler.ts`.
- Added scheduled archive retention with path containment through
  `src/lib/appliance/backup/backup-retention-service.ts`.
- Added shared policy health projection in
  `src/lib/appliance/backup/backup-health-projection.ts`.
- Extended backup, restore, and command mapper ports for active command checks,
  latest scheduled attempt reads, prunable snapshot reads, deleted snapshot
  marking, and restore-in-progress checks.
- Extended `BackupSelfService` so admin/API/tool callers use a single facade for
  dashboard and policy updates.
- Extended `createBackupRestoreProbe()` with automatic backup policy,
  freshness, latest scheduled attempt, validated backup count, and failure
  metadata.
- Added `scripts/process-backup-scheduler.ts` and wired supervision into
  `scripts/dev.mjs` and `scripts/start-server.mjs`.
- Added admin policy API at
  `src/app/api/admin/system/backups/policy/route.ts`.
- Added automatic backup controls to
  `src/app/admin/system/backups/BackupSelfServiceManager.tsx`.
- Added operator-only `configure_backup_policy` capability and catalog/runtime
  binding updates.

## Safety Notes

- Rust remains raw I/O execution only. Scheduling, retention, policy, freshness,
  and latest-successful promotion stay TypeScript-owned.
- Scheduled snapshot creation, `system_commands` enqueue, and policy
  `lastScheduledAt` / `nextScheduledAt` advancement are performed in one SQLite
  transaction.
- Scheduler refuses to enqueue when backup/restore commands are active or a
  restore plan is armed/running.
- Retention deletes only eligible scheduled snapshots, preserves manual and
  `pre_restore` snapshots, preserves the latest known-good snapshot, checks
  archive path containment, and marks snapshots deleted only after filesystem
  deletion succeeds.
- Health is read-only. It does not enqueue work or mutate policy.

## Verification

QA correction captured: 2026-05-03T03:27:49Z

During the final QA pass, the backup/restore health probe was found to be
projecting policy freshness with local duplicated interval/grace logic instead
of using the shared `BackupHealthProjection` required by the phase contract.
The probe now delegates policy, freshness, latest attempt, validated count, and
failure wording to `createBackupHealthProjection()`. The affected probe tests
were updated for the async probe contract.

Passed:

```bash
npm run typecheck
```

Passed focused 04F and catalog coverage:

```bash
npm test -- src/lib/appliance/backup/backup-schedule-service.test.ts src/lib/appliance/backup/backup-self-service.test.ts src/lib/appliance/backup/backup-archive-service.test.ts src/lib/appliance/probes/backup-restore-probe.test.ts src/core/capability-catalog/catalog.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts
```

Passed focused tool-composition and registry coverage:

```bash
npm test -- tests/composition-root-decomposition.test.ts tests/registry-executor-unification.test.ts tests/core-policy.test.ts tests/system-prompt-assembly.test.ts tests/tool-registry.integration.test.ts src/lib/chat/tool-composition-root.test.ts
```

Passed UI hook regression after an earlier isolated full-suite flake:

```bash
npm test -- src/hooks/chat/useChatComposerController.test.tsx
```

Passed scheduler one-shot smoke:

```bash
tmpdir=$(mktemp -d)
DATA_DIR="$tmpdir" STUDIO_ORDO_DB_PATH="$tmpdir/local.db" ORDO_BACKUP_SCHEDULER_RUN_ONCE=1 DISABLE_BACKUP_EXECUTOR=1 npm run backup:scheduler
rm -rf "$tmpdir"
```

Passed full suite:

```text
Test Files  705 passed (705)
Tests       5072 passed | 2 skipped (5074)
Duration    202.34s
```

## Closeout Judgment

The phase meets the documented exit criteria. Remaining backup lifecycle work
now belongs to Phase 05, where the Docker and worker verification harness should
prove fresh install, restart, scheduler/executor readiness, and restored data
from the full appliance runtime.
