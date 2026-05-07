# Phase 04F - Automatic Backup Policy And Health

Status: Complete

## Goal

Add configurable automatic backups, retention, overdue detection, and real
health integration so a non-technical admin can know whether the appliance is
protected without reading logs or shelling into the container.

This phase turns backup from a manual emergency action into a continuously governed appliance capability.

## Dependencies

- Phase 02 defines the appliance data boundary and runtime profile.
- Phase 03 provides the appliance health facade and existing `backup_restore` health component.
- Phase 04A defines backup policy, command, snapshot, and audit contracts.
- Phase 04B validates archives and manifests.
- Phase 04C defines restore safety and `pre_restore` backup requirements.
- Phase 04D executes durable filesystem and SQLite work.
- Phase 04E exposes admin and conversation controls.

## Current Code Grounding

The implementation must not depend on external cron, external databases,
external queues, or external backup services.

Use the existing self-contained runtime shape:

- `scripts/start-server.mjs`
  - supervises Next, deferred jobs, media worker, and the Rust backup executor.
  - already owns production startup/shutdown and is the right production home
    for an in-image scheduler child.
- `scripts/dev.mjs`
  - supervises the same local development process family and auto-builds
    `bin/ordo-backup` when missing.
  - must start the same scheduler path in development so local behavior matches
    Docker behavior.
- `scripts/process-deferred-jobs.ts`
  - is a durable job worker, not the backup scheduler. Do not hide scheduled
    appliance backup policy inside the deferred content job loop.
- SQLite is the durable coordination store.
- `src/lib/appliance/backup/types.ts`
  - already defines `BackupPolicy`, `BackupInterval`, `scheduled` backup kind,
    `deleted` snapshot status, and `BackupPolicyRepository`.
- `src/adapters/BackupPolicyDataMapper.ts`
  - already implements `getOrCreateDefaultPolicy()` and
    `updateDefaultPolicy()`.
  - `updateDefaultPolicy()` rewrites the full singleton row. Any policy service
    that changes one field must first read the current policy and merge fields
    explicitly so `latestSuccessfulBackupId`, `lastScheduledAt`, or
    `nextScheduledAt` are not accidentally cleared.
- `src/lib/appliance/backup/backup-policy-defaults.ts`
  - defaults automatic backups to `enabled: true`, `interval: "daily"`, and
    `retentionCount: 7`.
- `src/lib/appliance/backup/backup-command-service.ts`
  - currently creates manual backup commands only. 04F should add scheduled
    command creation here or through a sibling scheduler command service so all
    backup command construction stays in one application-service layer.
- `src/lib/appliance/backup/backup-command-payload.ts`
  - already builds the Rust executor payload for any `BackupKind`, including
    `scheduled`.
- `src/adapters/BackupSnapshotDataMapper.ts`
  - already creates pending snapshots, reads snapshots, lists recent snapshots,
    finds latest successful/attempted snapshots, and marks validation states.
  - it does not yet expose retention-specific list/delete mutations.
- `src/adapters/BackupSystemCommandDataMapper.ts`
  - already enqueues `backup.create`, enqueues guarded `restore.request`, lists
    recent backup/restore commands, and counts Rust command statuses.
  - it does not yet expose scheduler conflict queries such as pending/running
    backup or restore work by command name.
- `src/lib/appliance/backup/backup-self-service.ts`
  - is the 04E facade used by admin pages and tools. 04F should extend this
    facade for policy display/update and dashboard projection, not duplicate
    backup SQL in UI code.
- `src/lib/appliance/probes/backup-restore-probe.ts`
  - currently reports executor disabled/missing, pending/running/failed command
    counts, and latest successful snapshot metadata.
  - 04F must extend it to report policy freshness and overdue state.
- `src/app/admin/system/backups/page.tsx` and
  `src/app/admin/system/backups/BackupSelfServiceManager.tsx`
  - already render the admin backup dashboard and manual restore controls.
  - 04F should add policy controls and schedule health to this surface.
- `src/core/use-cases/tools/appliance-backup.tool.ts`
  - already exposes operator-only backup/restore conversation actions.
  - 04F should add policy inspection/update actions without exposing them to
    `default_chat`.
- `crates/ordo-backup/src/command.rs`
  - already accepts `backup.create` payloads with `kind: "scheduled"`.
  - 04F should not add scheduling policy to Rust; Rust remains the raw I/O
    executor.
- `crates/ordo-backup/src/backup_executor.rs`
  - marks `backup_snapshots.status = 'succeeded'`, fills archive metadata, and
    marks the `system_commands` row succeeded.
  - it does not update `backup_policy.latest_successful_backup_id`; 04F must do
    that from TypeScript after observing a successful scheduled backup.
- `crates/ordo-backup/src/command_store.rs`
  - verifies the Node-owned tables Rust directly needs:
    `system_commands`, `backup_snapshots`, `restore_plans`, and
    `backup_restore_audit_events`.
  - it does not need `backup_policy` because scheduling and policy remain
    TypeScript-owned.

## Policy Contract

Automatic backup policy must be explicit and small:

```ts
type BackupInterval = "disabled" | "6h" | "12h" | "daily" | "weekly";

interface BackupPolicy {
  id: "default";
  enabled: boolean;
  interval: BackupInterval;
  retentionCount: number;
  latestSuccessfulBackupId: string | null;
  lastScheduledAt: string | null;
  nextScheduledAt: string | null;
  updatedByUserId: string | null;
  updatedAt: string;
}
```

Do not add `lastAttemptStatus` or `lastFailureMessage` columns to
`backup_policy`. Those values are projections derived from
`backup_snapshots`, `system_commands`, and `backup_restore_audit_events`.
Keeping policy small matters because policy is configuration, not history.

Policy rules:

- `enabled: false` or `interval: "disabled"` means no automatic backup is
  scheduled. The persisted policy should normalize both values so the UI cannot
  display a contradictory state.
- `6h`, `12h`, `daily`, and `weekly` create scheduled backups when due.
- `retentionCount` applies to scheduled backups only.
- Manual backups are retained until an admin deletes them in a later phase.
- `pre_restore` backups are retained at least until one later scheduled or manual backup succeeds and validates.
- The latest successful validated backup must never be deleted by retention cleanup.
- Retention cleanup may run only after a newly created scheduled backup validates successfully.
- Policy updates must append `backup_restore_audit_events` with
  `operationKind: "policy"` and redacted metadata.

## Scheduler Design

The scheduler is a small application service, not route-local logic.

Recommended contracts:

```ts
interface BackupScheduleService {
  evaluateDueBackup(now: Date): Promise<BackupScheduleDecision>;
}

interface BackupCommandScheduler {
  enqueueScheduledBackup(decision: BackupScheduleDecision): Promise<void>;
}

interface BackupRetentionService {
  pruneAfterValidatedBackup(snapshotId: string): Promise<BackupRetentionResult>;
}
```

Use the repository names that exist today:

```ts
interface BackupPolicyRepository {
  getOrCreateDefaultPolicy(): Promise<BackupPolicy>;
  updateDefaultPolicy(input: {
    enabled: boolean;
    interval: BackupInterval;
    retentionCount: number;
    latestSuccessfulBackupId?: string | null;
    lastScheduledAt?: string | null;
    nextScheduledAt?: string | null;
    updatedByUserId?: string | null;
  }): Promise<BackupPolicy>;
}
```

Add only the missing read/write ports required by scheduling:

```ts
interface BackupScheduleCommandQuery {
  hasActiveBackupOrRestoreCommand(): Promise<boolean>;
  findLatestScheduledCommand(): Promise<SystemCommand | null>;
}

interface RestorePlanScheduleQuery {
  hasRestoreInProgressOrArmed(): Promise<boolean>;
}

interface BackupSnapshotRetentionQuery {
  listPrunableScheduledSnapshots(retentionCount: number): Promise<BackupSnapshot[]>;
  countSucceededSnapshots(): Promise<number>;
}

interface BackupSnapshotRetentionRepository {
  markDeleted(id: string): Promise<BackupSnapshot>;
}

interface BackupArchiveStore {
  deleteArchive(archivePath: string): Promise<void>;
}
```

Evaluation rules:

- Enqueue at most one scheduled backup per due window.
- Do not enqueue when any `rust_daemon` `backup.create` command is `pending`
  or `running`.
- Do not enqueue while a `restore.request` command is `pending` or `running`.
- Do not enqueue while a restore plan is `confirmed` or `running`.
- Use SQLite state to make scheduling idempotent across process restarts.
- If the clock moves backward, do not create duplicate backups.
- If the clock moves forward and a backup is overdue, enqueue one catch-up
  backup, then compute `nextScheduledAt` from the enqueue time.
- A scheduled command must create a `backup_snapshots` row with
  `kind: "scheduled"`, then enqueue a `system_commands` row:
  `target: "rust_daemon"`, `command: "backup.create"`,
  `payload.kind: "scheduled"`.
- Creating the scheduled snapshot, enqueuing the command, and advancing
  `lastScheduledAt` / `nextScheduledAt` must be one SQLite transaction. If any
  part fails, none of the three state changes may remain.
- Scheduled commands are system initiated:
  `requestedByUserId: null`, `requestedByRole: null`,
  `requestedFrom: "backup_scheduler"`.
- `assertRequesterMetadata()` already allows scheduled backups without
  `ADMIN`; keep manual and `pre_restore` admin-only.
- Back off after repeated failures by refusing to enqueue another scheduled
  backup while the latest scheduled command is failed inside the same due
  window. Health remains degraded until a later manual or scheduled backup
  succeeds.
- The scheduler must reconcile completed scheduled commands before evaluating
  new due work:
  - read succeeded `backup.create` commands where `payload.kind === "scheduled"`.
  - verify the linked snapshot is still `succeeded` and has archive metadata.
  - update `backup_policy.latestSuccessfulBackupId` to the newest valid
    scheduled snapshot unless a newer manual backup already became the latest
    successful snapshot.
  - append a `backup_restore_audit_events` event such as
    `scheduled_backup_reconciled`.
  - run retention only after reconciliation succeeds.

### TypeScript Ownership

04F is TypeScript orchestration over Rust execution.

Required TypeScript services:

- `BackupPolicyService`
  - reads/updates the singleton policy.
  - normalizes `enabled` and `interval: "disabled"`.
  - computes `nextScheduledAt` on policy changes.
  - appends policy audit events.
- `BackupScheduleService`
  - evaluates due work, conflict state, and catch-up behavior.
  - owns idempotency decisions.
- `BackupScheduledCommandService`
  - creates scheduled snapshots and `rust_daemon backup.create` commands.
  - shares payload creation with manual/pre-restore backup command code.
- `BackupScheduleReconciler`
  - observes Rust-completed scheduled commands and updates TypeScript-owned
    policy/read-model state.
- `BackupRetentionService`
  - prunes only eligible scheduled snapshots through `BackupArchiveStore`.

Do not let routes, React components, tools, or Rust mutate schedule policy
directly.

### Process Placement

Add a scheduler entrypoint that can run as a supervised child:

```text
scripts/process-backup-scheduler.ts
```

The process should:

- load local env like `scripts/process-deferred-jobs.ts`.
- enforce Node 22 for native SQLite consistency.
- run a deterministic polling loop with
  `ORDO_BACKUP_SCHEDULER_POLL_INTERVAL_MS`, defaulting to a conservative value
  such as 60 seconds.
- support `ORDO_BACKUP_SCHEDULER_RUN_ONCE=1` for tests and one-shot QA.
- respect `DISABLE_BACKUP_SCHEDULER=1`.
- be supervised by both `scripts/start-server.mjs` and `scripts/dev.mjs`.
- use the same restart-with-backoff posture as the existing backup executor:
  repeated scheduler crashes should degrade backup health and log clearly, not
  corrupt backup state or create duplicate commands.

Do not put scheduler logic in a Next route, React component, or Rust daemon.
The scheduler is Node policy orchestration; Rust only executes I/O commands.

### Rust Boundary

Rust changes should be minimal and contract-preserving:

- keep accepted command names as `backup.create` and `restore.request`.
- keep accepted backup kinds as `manual`, `scheduled`, and `pre_restore`.
- do not teach Rust about intervals, retention counts, overdue policy, admin
  preferences, or health freshness.
- do not make Rust update `backup_policy`; TypeScript owns that table.
- add or keep Rust tests proving `kind: "scheduled"` parses and executes
  through the same archive path as `manual`.
- if Rust schema verification changes, it may verify only tables Rust directly
  reads/writes. Adding `backup_policy` to Rust schema verification is optional
  and should not make Rust dependent on policy semantics.

## Health Integration

The Phase 03 `backup_restore` component must become real.

Health states:

- `healthy`: backup service is available and either automatic scheduling is
  intentionally disabled while manual backup remains usable, or the latest
  successful validated backup is inside the policy freshness window.
- `degraded`: automatic backup is enabled but overdue, the last scheduled
  attempt failed, the executor is temporarily unavailable, a scheduled command
  is stuck pending/running beyond the lease window, or validation warnings
  exist.
- `blocked`: backup is configured but cannot write archive storage, command schema is missing, the archive path is unsafe, validation cannot run, or restore safety prerequisites are missing.
- `disabled`: the backup service itself is explicitly disabled by configuration.

Health metadata should include:

- automatic policy interval
- latest successful backup timestamp
- latest successful backup id
- latest attempt status
- next scheduled backup timestamp
- retention count
- count of validated backups
- executor mode
- last failure message, redacted

Freshness rules:

- `disabled` policy reports scheduling disabled, not stale backups.
- `6h`, `12h`, `daily`, and `weekly` compare latest successful backup
  `validatedAt` against the interval plus a deterministic grace period.
- Use `max(15 minutes, interval * 0.10)` as the grace period so tests and
  operator expectations are stable.
- First boot with no successful backups is `degraded` after the first due time
  passes, not immediately blocked.
- Executor missing remains `degraded` in the current probe contract because
  manual restore history is still inspectable; only schema/data-boundary
  failures should be `blocked`.

Implementation rule:

- Extend `createBackupRestoreProbe()` through injectable read-only dependencies
  where possible. Tests should not need to open the real project database.
- Keep health read-only. Health may inspect policy, snapshots, commands, and
  executor presence, but it must never enqueue or mutate backup state.
- Health should use a shared `BackupHealthProjection` so admin UI, API, tools,
  and probes agree on policy freshness and failure wording.

## SOLID, Clean, And GoF Design

- Single Responsibility: scheduling, retention, policy storage, command enqueueing, and health reporting are separate services.
- Open/Closed: future intervals, storage adapters, or Rust executor modes are added through strategies.
- Interface Segregation: health checks depend on read-only policy/snapshot ports, not write-capable restore services.
- Dependency Inversion: routes, admin UI, and conversation tools call application services rather than manipulating SQLite directly.
- Facade: the appliance health facade presents a simple backup state while hiding scheduler details.
- Strategy: retention policy and archive store behavior are replaceable.
- Command: scheduled backups are durable commands, not in-memory callbacks.
- Template Method: backup creation always follows schedule decision, command enqueue, execution, validation, snapshot promotion, retention cleanup.

Recommended files:

```text
src/lib/appliance/backup/backup-schedule-service.ts
src/lib/appliance/backup/backup-retention-service.ts
src/lib/appliance/backup/backup-policy-service.ts
src/lib/appliance/backup/backup-schedule-reconciler.ts
src/lib/appliance/backup/backup-health-projection.ts
scripts/process-backup-scheduler.ts
```

Existing facades should then compose these services:

- `BackupSelfService.getDashboard()` adds policy health, next scheduled time,
  and latest scheduled attempt projection.
- `BackupSelfService.updatePolicy()` updates the singleton policy and writes a
  policy audit event.
- `createBackupRestoreProbe()` reuses the read-only projection rather than
  reconstructing policy logic.
- `BackupScheduleReconciler` updates policy and triggers retention after Rust
  finishes a scheduled backup.

## Safety Rules

- Automatic backup must never overwrite an existing backup archive in place.
- Automatic backup must never delete the only known-good validated backup.
- A failed scheduled backup must preserve the previous latest successful backup pointer.
- A failed retention cleanup must not mark the backup itself as failed.
- A restore in progress must pause scheduled backups.
- Health must prefer an explicit degraded/blocked state over a false healthy state.
- The scheduler must be safe to run in development, Docker, and tests without external infrastructure.
- Retention must mark snapshots `deleted` only after archive deletion succeeds,
  or record a failed retention audit event and leave the snapshot readable if
  filesystem deletion fails.
- Retention must ignore snapshots whose archive metadata is incomplete.
- Retention must never delete `manual` snapshots in 04F.
- Retention must not unlink paths outside the configured appliance backups
  directory. Path containment checks belong in `BackupArchiveStore`.
- Policy updates must preserve existing latest/schedule fields unless the
  update intentionally changes them.

## Positive Use Cases

- Admin enables daily automatic backups; one scheduled command is created when due.
- Admin disables automatic backups; health reports manual backup available and automatic scheduling disabled.
- A scheduled backup succeeds and becomes the latest successful backup.
- Rust completes a scheduled backup; the TypeScript reconciler promotes the
  snapshot into `backup_policy.latestSuccessfulBackupId`.
- Retention removes old scheduled backups after a new backup validates while preserving manual and latest successful backups.
- Admin sees latest backup status and next scheduled time in health/admin surfaces.
- Admin updates automatic backup interval from the admin backup page and sees
  the next scheduled timestamp change immediately.
- Operator asks in conversation for backup policy; the tool reports current
  policy and schedule state without exposing raw logs.

## Negative Use Cases

- Archive directory is unwritable; scheduled backup fails and health becomes blocked or degraded with a clear reason.
- Executor is not running; policy remains enabled and health becomes degraded.
- Manifest validation fails; the snapshot is not promoted as latest successful.
- Retention attempts to delete the only valid backup; service refuses.
- Restore is running; scheduler refuses to enqueue a competing scheduled backup.
- Non-admin user tries to update backup policy; route/tool rejects before
  touching policy state.
- Scheduler runs while executor is disabled; no command is enqueued and health
  explains that execution is disabled.
- `updateDefaultPolicy()` receives a partial admin change; the service preserves
  existing policy fields instead of clearing latest backup pointers.

## Edge Use Cases

- First boot with automatic backups enabled and no backups yet.
- Clock skew or host sleep causes missed schedule windows.
- App restarts while a scheduled command is pending.
- Large `.data` directory causes backup to run longer than one schedule interval.
- Disk fills during archive creation.
- Manual backup and scheduled backup become due at the same time.
- Automatic schedule is disabled but an admin still creates a manual backup.
- The app restarts after `lastScheduledAt` was updated but before Rust finishes;
  scheduler observes the pending command and does not enqueue a duplicate.
- A scheduled backup succeeds but retention cannot delete an old archive; latest
  backup remains successful and health includes a retention warning.
- Rust succeeds but the scheduler crashes before reconciliation; after restart,
  the reconciler promotes the completed scheduled snapshot exactly once.

## Exit Criteria

- Automatic backup policy can be read and changed through the application service.
- Scheduler enqueues due backups idempotently without external cron.
- Scheduled backup success promotes a validated snapshot to latest successful.
- Scheduled backup promotion is done by TypeScript reconciliation after Rust
  command success; Rust remains unaware of policy.
- Retention preserves manual backups, `pre_restore` safety backups, and the
  latest known-good backup.
- Phase 03 `backup_restore` health reports real backup policy, freshness, and failure state.
- Tests cover positive, negative, and edge scheduling, retention, and health behavior.
- Tests cover policy merge behavior so policy updates do not clear unrelated
  singleton fields.
- Tests cover TypeScript reconciliation of Rust-completed scheduled backups,
  including restart/idempotency behavior.
- Rust tests continue to prove `scheduled` backup payloads are valid executor
  input, without adding Rust policy ownership.
- Phase 04E admin and conversation surfaces can display policy, latest backup, next backup, and last failure without duplicating scheduler logic.
- `scripts/start-server.mjs` and `scripts/dev.mjs` supervise the scheduler, and
  shutdown drains it consistently with the existing worker process family.
- `ORDO_BACKUP_SCHEDULER_RUN_ONCE=1` can be used in tests/QA to prove one due
  backup is enqueued and no duplicate is created on a second pass.
- Documentation records that Phase 04 remains the umbrella and 04A-04F are the
  implementation sequence; no separate monolithic Phase 04 implementation is
  required after 04F.

## Implementation Closeout

Completed: 2026-05-03

Evidence: `../evidence/04f-automatic-backup-policy-and-health-2026-05-03.md`

Implemented surfaces:

- Policy application service, schedule math, due evaluation, scheduled command
  transaction, reconciliation, retention pruning, and shared health projection.
- Read/write mapper ports for active command conflict checks, latest scheduled
  attempts, prunable scheduled snapshots, deleted snapshot marking, and armed
  restore detection.
- Supervised scheduler process for local and production runtime with one-shot QA
  support.
- Admin API and admin backup UI controls for automatic backup enablement,
  interval, retention count, next scheduled time, latest attempt, and validated
  backup count.
- Operator-only conversation action for backup policy configuration.
- Health probe metadata and degraded-state detection for overdue or failed
  scheduled backups.

Verification completed:

- `npm run typecheck`
- focused backup, health, catalog, and tool-composition tests
- `npm test`
- one-shot scheduler smoke test with `ORDO_BACKUP_SCHEDULER_RUN_ONCE=1`
