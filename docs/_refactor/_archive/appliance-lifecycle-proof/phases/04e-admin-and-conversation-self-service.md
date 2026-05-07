# Phase 04E - Admin And Conversation Self Service

Status: Complete

## Goal

Expose backup and restore as self-service workflows for admin users and
operator-only conversation tools.

The target user is a solopreneur, not a systems operator. The product should
make the safe path obvious:

- create a backup now
- see whether backups are working
- inspect backup history
- prepare a restore plan
- create the required safety backup
- confirm restore in a separate step
- execute restore only after confirmation and safety backup completion

04E must not add a second backup/restore engine. It is a thin presentation and
operator-action layer over the contracts completed in 00, 01, 02, 03, 04A, 04B,
04C, and 04D.

## Dependencies

- Phase 00 proved `.data` is the durable appliance boundary.
- Phase 01 created the runtime tool control plane and prompt exposure budget.
  Backup/restore tools must stay out of `default_chat`.
- Phase 02 added `getApplianceDataBoundary()` and
  `getApplianceRuntimeProfile()`.
- Phase 03 added the appliance health facade and health probes.
- Phase 04A added Node-owned backup governance tables and repositories.
- Phase 04B added archive manifest validation and backup artifact contracts.
- Phase 04C added restore planning, archive revalidation, explicit
  confirmation, pre-restore backup gating, and guarded restore command enqueue.
- Phase 04D added the Rust executor for real `backup.create` and
  `restore.request` I/O plus backup/restore executor health.

## Current Code Grounding

### Existing Admin Surfaces

The current admin system area already has a good home for backup/restore:

- `src/app/admin/system/page.tsx`
  - displays system health, provider configuration, capability providers, tool
    counts, and worker status.
  - links to `/admin/system/keys` and `/admin/system/tools`.
- `src/app/admin/system/tools/page.tsx`
  - requires admin access through `requireAdminPageAccess()`.
  - renders `ToolsManager`.
- `src/app/admin/system/tools/ToolsManager.tsx`
  - manages runtime tool availability from an effective manifest.
  - already shows protected and statically locked tools.
- `src/app/api/admin/system/tools/route.ts`
  - requires admin access.
  - rejects protected tool disablement.
  - rejects static-lock changes.

04E should add a sibling admin surface:

```text
/admin/system/backups
/api/admin/system/backups
/api/admin/system/backups/[snapshotId]/validate
/api/admin/system/backups/[snapshotId]/restore-plans
/api/admin/system/restore-plans/[planId]/pre-restore-backup
/api/admin/system/restore-plans/[planId]/confirm
/api/admin/system/restore-plans/[planId]/execute
/api/admin/system/restore-plans/[planId]/cancel
```

Do not put backup/restore controls into `/admin/system/tools`; tool settings and
data recovery are separate workflows.

### Existing Backup/Restore Services

04E must reuse these service seams:

- `src/lib/appliance/backup/backup-command-service.ts`
  - `createManualBackupCommand()` creates a pending snapshot, builds the 04D
    executor payload, and enqueues `backup.create`.
- `src/lib/appliance/backup/backup-archive-service.ts`
  - validates a snapshot archive and updates/audits the snapshot.
- `src/lib/appliance/backup/restore-plan-service.ts`
  - `createPlan()` validates backup archive, creates a restore plan, and moves
    it to `confirmation_required`.
  - `requestPreRestoreBackup()` creates the required `pre_restore` snapshot and
    enqueues the pre-restore backup command.
- `src/lib/appliance/backup/restore-confirmation-service.ts`
  - `confirmPlan()` enforces the exact confirmation phrase and rechecks snapshot
    metadata.
- `src/lib/appliance/backup/restore-command-service.ts`
  - `authorizeRestoreCommand()` is the only valid restore command execution seam.
  - requires confirmed plan, matching snapshot metadata, succeeded pre-restore
    command, and linked succeeded `pre_restore` snapshot.
- `src/lib/appliance/probes/backup-restore-probe.ts`
  - reports executor disabled, unavailable, processing, failed commands, and
    latest success metadata.
  - this is an availability/state probe over configuration, binary presence,
    SQLite command backlog, failures, and latest successful snapshot metadata.
    It is not a full Rust process heartbeat in 04E.

04E should compose these services through a small application service/facade
instead of letting routes and tools know individual repository details.

Recommended new facade:

```text
src/lib/appliance/backup/backup-self-service.ts
```

This facade should expose admin-safe use cases:

- `getDashboard()`
- `createManualBackup(requester)`
- `validateBackup(snapshotId, requester)`
- `createRestorePlan(snapshotId, requester)`
- `requestPreRestoreBackup(planId, requester)`
- `confirmRestorePlan(planId, confirmationPhrase, requester)`
- `executeConfirmedRestore(planId, requester)`
- `cancelRestorePlan(planId, requester)`

### Rust Executor Boundary

04E must treat Rust as an asynchronous governed executor, not as an RPC service.

The only valid crossing into Rust is a Node-owned `system_commands` row:

```text
target = rust_daemon
command = backup.create | restore.request
status = pending
payload_json = 04D contract payload
```

Required UI/tool behavior:

- creating a backup returns the pending snapshot and command immediately.
- requesting a pre-restore backup returns the restore plan and pre-restore
  backup command immediately.
- executing restore returns the running restore plan and restore command
  immediately.
- UI and tools then observe state through SQLite read models and health probes.
- no 04E route, React component, or tool may spawn `ordo-backup`, shell out to
  Rust, read Rust stdout, or call a Rust function directly.

Command correlation rules:

- manual backup progress is correlated through `backup.create.payload.snapshotId`
  and `system_commands.result_payload.snapshotId`.
- pre-restore backup progress is correlated through
  `backup.create.payload.restorePlanId`,
  `backup.create.payload.snapshotId`, `restore_plans.pre_restore_backup_command_id`,
  and `restore_plans.pre_restore_backup_snapshot_id`.
- restore execution progress is correlated through
  `restore.request.payload.restorePlanId`, `restore_plans.restore_command_id`,
  and `restore_plans.status`.
- read models must tolerate missing `result_payload` while commands are pending
  or running.

Executor availability rules:

- if `DISABLE_BACKUP_EXECUTOR=1`, 04E must not enqueue new `backup.create` or
  `restore.request` work from admin UI or conversation tools. The UI must show
  that backup/restore execution is disabled and explain how to re-enable it.
- if the binary is missing, 04E must not enqueue new `backup.create` or
  `restore.request` work from admin UI or conversation tools. The UI must show
  degraded/unavailable state and avoid implying that queued work is actively
  processing.
- API routes and tools should return a safe conflict/unavailable result for new
  execution requests while the executor is disabled or missing.
- failed `rust_daemon` commands must be visible before restore execution is
  offered, because stale failure state is a real operator warning.
- health state must not be used as authorization. The 04C/04D services and
  command payload validation remain the authority.

Restore execution rule:

- `executeConfirmedRestore()` may only enqueue `restore.request` by calling
  `RestoreCommandService.authorizeRestoreCommand()`.
- it must not try to confirm, safety-backup, and execute restore in one use case.
- it must return a "restore queued/running" state, not "restore complete".
- completion is observed later when Rust marks the command and plan `succeeded`
  or `failed`.

### Existing Data Access Gaps

The existing mappers are intentionally minimal:

- `BackupSnapshotDataMapper`
  - has `createPending()`, `findById()`, and status mutations.
  - does not yet list snapshots.
- `BackupSystemCommandDataMapper`
  - has `enqueue()`, `findById()`, and guarded `enqueueRestoreRequest()`.
  - does not yet list commands by snapshot, restore plan, target, or status.
- `RestorePlanDataMapper`
  - has `createDraft()`, `findById()`, and state transitions.
  - does not yet list plans.
- `BackupPolicyDataMapper`
  - has default get/update only.
- `BackupRestoreAuditDataMapper`
  - has append/find-by-id only.

04E should add query ports/read models rather than raw SQL in pages or tools:

```text
BackupSnapshotQuery
- listRecent(limit, offset)
- findLatestSuccessful()
- findLatestAttempt()

SystemCommandQuery
- listRecentBackupRestore(limit, offset)
- listBySnapshotId(snapshotId)
- listByRestorePlanId(planId)
- countByStatusForRustDaemon()

RestorePlanQuery
- listRecent(limit, offset)
- findActiveBySnapshotId(snapshotId)

BackupRestoreAuditQuery
- listByOperationId(operationId, limit)
```

These may be implemented by extending the existing data mapper classes or by
adding separate read-model classes. Prefer separate read-model classes if the
write repositories start accumulating presentation-only queries.

### Existing Tool Exposure Rules

The prompt exposure and tool availability machinery is already in place:

- `src/core/tool-registry/ToolRegistry.ts`
  - hides `operator_only` tools from `default_chat`.
  - exposes them only in `operator_chat`.
- `src/lib/appliance/backup/backup-prompt-exposure.test.ts`
  - already asserts backup/restore tool names are not visible in default chat.
- `src/lib/tools/tool-default-profile.ts`
  - defines protected tools and install groups.
- `src/core/capability-catalog/families/admin-capabilities.ts`
  - is the right catalog family for appliance backup/restore admin tools.
- `src/core/capability-catalog/catalog-input-schemas.ts`
  - should own schemas for any new tool names.
- `src/core/capability-catalog/runtime-tool-binding.ts`
  - should bind new tools to concrete executors.

04E should register operator-only tools, not default chat tools:

- `create_appliance_backup`
- `list_appliance_backups`
- `validate_appliance_backup`
- `prepare_appliance_restore`
- `request_pre_restore_backup`
- `confirm_appliance_restore`
- `execute_appliance_restore`
- `cancel_appliance_restore`

`configure_backup_policy` should remain in Phase 04F because automatic backup
scheduling and retention are not implemented until 04F.

## Implementation Design

### Clean Architecture

Use four layers:

1. Entity/contracts:
   - existing `types.ts` stays the source of backup command, snapshot, policy,
     restore plan, and audit event types.
2. Application facade:
   - add `backup-self-service.ts` for use cases and user-facing workflow
     results.
3. Adapters:
   - add read-model query ports and mappers for dashboard/list views.
   - route handlers call the facade, not raw mappers.
4. Presentation:
   - admin page renders read models.
   - conversation tools call the same facade.

### SOLID/DRY Requirements

- Single Responsibility:
  - routes parse HTTP and require admin access only.
  - facade coordinates service calls.
  - mappers read/write SQLite.
  - UI renders dashboard state and submits actions.
- Open/Closed:
  - adding scheduled backup state in 04F should extend dashboard data without
    rewriting restore flows.
- Interface Segregation:
  - list/query ports should not be forced onto write repositories unless the
    mapper remains cohesive.
- Dependency Inversion:
  - facade depends on repository/service interfaces, not concrete mappers.
- DRY:
  - admin routes and tools share the same facade methods.
  - confirmation copy and phrase checks live in one place.
- Facade pattern:
  - `BackupSelfService` becomes the main surface for admin UI and tools.
- Command pattern:
  - UI/tool actions enqueue governed `system_commands`; they never call Rust
    directly.
- State pattern:
  - restore plan status determines which UI actions are available.
- Strategy pattern:
  - tool executors map action names to facade methods without branching through
    route code.

## Admin UX Requirements

### Admin Navigation

- Add a visible link from `/admin/system` to `/admin/system/backups`.
- Keep it in the system area because this is appliance operations, not content.

### Dashboard Summary

The backups page must show:

- backup executor state from `backup_restore` health probe.
- executor path, disabled/configured/available flags, and remediation when
  degraded.
- latest successful backup.
- latest backup attempt.
- number of pending/running/failed Rust backup/restore commands.
- active restore plans.
- default backup policy summary as read-only until 04F.

Clear states:

- Backup is current.
- No backups exist.
- Backup is running.
- Backup failed.
- Backup executor is disabled.
- Backup executor binary is missing.
- Restore is waiting for confirmation.
- Restore is waiting for a safety backup.
- Restore is ready to execute.
- Restore is running.
- Restore failed.
- Restore completed.

### Backup List

List recent backup snapshots with:

- snapshot id
- kind
- status
- created at
- archive size
- app version
- manifest schema version
- validated at
- failure message
- created by
- related command status where available

Actions:

- create manual backup
- validate succeeded/validated backup archive
- prepare restore from eligible backup

Eligibility:

- only `validated` or `succeeded` snapshots with complete archive metadata can
  start restore planning.
- failed/pending/running snapshots are visible but not restoreable.

### Restore Plan List

List recent restore plans with:

- plan id
- snapshot id
- status
- created at
- updated at
- app version
- warnings count
- confirmation phrase
- pre-restore backup command id/status
- pre-restore backup snapshot id/status
- restore command id/status
- restore command error message when failed
- failure message

Actions by status:

- `confirmation_required`: confirm or cancel.
- `confirmed`: request pre-restore backup or cancel.
- `confirmed` with completed pre-restore backup: execute restore.
- `running`: read-only progress.
- `succeeded` / `failed` / `cancelled`: read-only audit.

Do not allow execute from `confirmation_required`.
Do not allow execute without a succeeded pre-restore backup.
Do not show restore as complete until both `restore_plans.status` and the
correlated `restore.request` command have reached a terminal state consistent
with success.

### Restore Impact Screen

Restore UI must show:

- selected snapshot id
- archive path
- archive hash
- archive size
- app version
- source runtime profile
- source data root
- current target data boundary
- included roots
- manifest warnings
- data boundary warnings
- current executor availability and any failed-command warning
- plain-language impact:
  - "Restore will replace your current business data with this backup."
  - "A safety backup will be created first."
  - "Type RESTORE <id> to confirm."

The confirmation phrase must be displayed only after restore impact has been
shown.

The execute action must be visually and logically separate from the confirmation
action. A confirmed plan should still show the safety backup requirement before
execution is available.

### Safety Copy Standard

Avoid technical jargon in primary user-facing copy.

Good copy:

- "Backup is current."
- "Backup is overdue."
- "Restore will replace your current business data with this backup."
- "A safety backup will be created first."
- "Type RESTORE <id> to confirm."
- "Restore is waiting for the safety backup to finish."

Technical details such as hashes, paths, command ids, and manifest versions may
appear in compact detail sections for support/debugging.

## Conversation UX Requirements

Allowed admin/operator requests:

- "Create a backup now."
- "List my backups."
- "When was my latest successful backup?"
- "Validate this backup."
- "Prepare a restore to the last backup."
- "Create the safety backup for this restore."
- "Confirm restore plan X with RESTORE X."
- "Execute the confirmed restore plan."
- "Cancel this restore plan."

Conversation restore rules:

- The assistant can prepare a restore plan.
- The assistant can explain impact.
- The assistant must ask for explicit confirmation.
- The assistant must not execute restore in the same response that proposes it.
- The assistant must not execute restore unless the plan is already confirmed
  and the pre-restore backup has succeeded.
- The assistant must not claim a backup or restore has completed just because a
  command was queued.
- The assistant must summarize the current restore state after every restore
  action.

Use tool output summaries that are short and operational:

- `status`
- `summary`
- `nextAction`
- `backupId` or `restorePlanId`
- `commandId` when an executor command was queued
- `executorState`
- `warnings`

## API Design

Recommended route behavior:

- `GET /api/admin/system/backups`
  - returns dashboard/read model.
- `POST /api/admin/system/backups`
  - creates a manual backup command.
- `POST /api/admin/system/backups/[snapshotId]/validate`
  - validates an existing archive through `BackupArchiveService`.
- `POST /api/admin/system/backups/[snapshotId]/restore-plans`
  - creates a restore plan.
- `POST /api/admin/system/restore-plans/[planId]/pre-restore-backup`
  - requests the required safety backup.
- `POST /api/admin/system/restore-plans/[planId]/confirm`
  - body: `{ confirmationPhrase }`.
- `POST /api/admin/system/restore-plans/[planId]/execute`
  - calls `RestoreCommandService.authorizeRestoreCommand()`.
- `POST /api/admin/system/restore-plans/[planId]/cancel`
  - cancels only non-running/non-succeeded plans.

All routes:

- require `requireAdminPageAccess()`.
- return user-safe errors.
- must not leak secrets, full environment, or raw stack traces.
- must not call Rust directly.
- must return current command/plan state after writes so the UI can render the
  next safe action without guessing.

## Tool Design

Add catalog schemas and tool executors for:

- `create_appliance_backup`
  - no required input.
  - returns command id, snapshot id, executor state, and queued/running status.
- `list_appliance_backups`
  - optional `limit`.
  - returns latest success, latest attempt, recent backups, failed command
    warning, and executor state.
- `validate_appliance_backup`
  - input: `snapshot_id`.
  - returns validation status and warnings/errors.
- `prepare_appliance_restore`
  - input: `snapshot_id`.
  - returns restore plan id, impact summary, and confirmation phrase.
- `request_pre_restore_backup`
  - input: `restore_plan_id`.
  - returns command id, safety snapshot id when known, status, executor state,
    and next action.
- `confirm_appliance_restore`
  - input: `restore_plan_id`, `confirmation_phrase`.
  - returns confirmed state and whether safety backup is still needed.
- `execute_appliance_restore`
  - input: `restore_plan_id`.
  - returns restore command id and running/queued state. It must not report
    restore success until observed in a later read.
- `cancel_appliance_restore`
  - input: `restore_plan_id`.
  - returns cancelled state.

Tool registration requirements:

- all tools live in `ADMIN_OPERATIONS_CAPABILITIES`.
- `promptExposure.exposure = "operator_only"`.
- `core.roles = ["ADMIN"]`.
- no backup/restore tool may be protected by default unless disabling it would
  make recovery impossible. For 04E, prefer operator-only but configurable.
- `backup-prompt-exposure.test.ts` must be updated to include all new tool
  names and verify they remain absent from `default_chat`.
- tool result copy must distinguish "queued", "running", "succeeded", and
  "failed"; never collapse queued executor work into success.

## Positive Use Cases

- Admin opens `/admin/system/backups` and sees no backups plus a clear create
  action.
- Admin creates a backup from the admin page; page shows pending/running command
  and pending snapshot.
- Rust executor completes; page shows latest successful backup.
- Admin asks in conversation for latest backup; tool returns current state.
- Admin prepares restore; plan moves to `confirmation_required` and shows impact.
- Admin enters exact confirmation phrase; plan moves to `confirmed`.
- Admin requests safety backup; command is enqueued and shown as pending/running.
- After safety backup succeeds, admin executes restore; restore command is
  enqueued and plan moves to `running`.
- Admin refreshes later and sees Rust has marked restore `succeeded` or
  `failed`.

## Negative Use Cases

- Non-admin cannot access admin backup routes or pages.
- Non-admin cannot execute conversation backup/restore tools.
- Backup/restore tools do not appear in `default_chat`.
- Restore confirmation phrase mismatch fails closed.
- Restore execute from `confirmation_required` fails closed.
- Restore execute without succeeded pre-restore backup fails closed.
- Restore execute for unknown plan fails closed.
- Backup creation and restore execution while executor is disabled/missing fail
  closed with a clear unavailable message.
- Validate backup with missing archive metadata fails closed.
- Page/action errors return safe messages, not stack traces.
- A queued command with malformed or stale payload is surfaced as failed and not
  hidden by the dashboard.

## Edge Use Cases

- Backup executor unavailable; admin sees disabled/degraded state and actions
  explain that queued work will not run until the executor is available.
- No backups exist; UI explains how to create one.
- Latest backup failed; UI shows latest successful backup separately from latest
  attempt.
- Pre-restore backup command succeeded but snapshot link has not appeared yet;
  UI shows "waiting for safety backup result" rather than allowing execute.
- Restore plan is already running; UI disables cancel/confirm/execute.
- Restore plan failed; UI shows failure and audit timeline.
- Archive validation fails during restore plan creation; no restore plan is
  executable.
- Two browser tabs submit the same restore action; service state transitions
  determine the winner and the loser receives a safe state error.
- Rust marks an expired running command failed through lease recovery; dashboard
  shows the failure and does not present that work as in-progress.
- Rust succeeds a backup command but the browser still has stale page state; the
  next dashboard read is authoritative.

## Required Tests

### Unit / Service Tests

- `BackupSelfService.getDashboard()` returns latest success, latest attempt,
  recent snapshots, active restore plans, policy, command counts, failed command
  warnings, and executor health.
- `createManualBackup()` requires admin and returns snapshot/command ids.
- `validateBackup()` requires admin and uses `BackupArchiveService`.
- `createRestorePlan()` requires admin and returns impact/confirmation state.
- `requestPreRestoreBackup()` requires admin and returns the updated plan.
- `confirmRestorePlan()` rejects bad phrase and accepts exact phrase.
- `executeConfirmedRestore()` refuses unconfirmed plans.
- `executeConfirmedRestore()` refuses plans without completed pre-restore backup.
- `createManualBackup()` and `executeConfirmedRestore()` refuse to enqueue new
  executor work when executor health says disabled or binary missing.
- `executeConfirmedRestore()` returns queued/running state and does not report
  success synchronously.
- `cancelRestorePlan()` refuses running/succeeded plans.

### Adapter Tests

- snapshot query lists recent snapshots and latest successful snapshot.
- command query lists backup/restore commands by snapshot and restore plan.
- command query tolerates missing/null result payloads for pending/running work.
- command query exposes concise failure messages without raw stack traces.
- restore plan query lists recent/active plans.
- audit query lists operation events in chronological order.

### API Tests

- every route requires admin access.
- manual backup route enqueues `backup.create`.
- manual backup route refuses enqueue when executor is disabled or missing.
- restore plan route creates `confirmation_required` plan.
- confirm route rejects phrase mismatch.
- execute route calls guarded restore command service only.
- execute route refuses enqueue when executor is disabled or missing.
- cancel route cannot cancel running/succeeded plans.
- safe JSON errors are returned for service exceptions.
- routes return refreshed dashboard/action state after mutations.
- no route shells out to `ordo-backup` or imports Rust bindings.

### UI Tests

- page renders empty backup state.
- page renders latest successful backup and latest failed attempt separately.
- page shows executor disabled/unavailable warning from health.
- page shows queued/running/succeeded/failed as distinct command states.
- restore impact view displays phrase and safety backup requirement.
- action buttons are disabled/enabled based on restore status.
- execute button is separate from confirmation and remains unavailable until
  pre-restore backup completion is observed.

### Tool Tests

- each backup/restore tool requires ADMIN.
- tools call `BackupSelfService`, not raw mappers.
- `prepare_appliance_restore` returns a confirmation-required state and does
  not execute restore.
- `execute_appliance_restore` refuses unsafe states through the service.
- create/execute tools refuse enqueue when executor is disabled or missing.
- tool outputs distinguish queued/running/succeeded/failed executor states.
- tools never claim executor completion from enqueue success.
- `backup-prompt-exposure.test.ts` proves all backup/restore tools are absent
  from `default_chat`.
- operator mode projection exposes the tools only for ADMIN.

### Rust Boundary Tests

- API and tool code never invokes `ordo-backup` directly.
- manual backup action enqueues `backup.create` with `target = rust_daemon` and
  the 04D payload shape.
- restore execute action enqueues `restore.request` only through
  `RestoreCommandService`.
- dashboard read model shows pending/running/failed/succeeded command states
  from SQLite without requiring the Rust process to be running in the test.
- disabled/missing executor health states are rendered clearly.
- disabled/missing executor health states block new execution command enqueue.
- failed Rust commands are shown and do not disappear behind latest success.

## Exit Criteria

- Admin self-service backup/restore page exists under `/admin/system/backups`.
- Admin API routes exist and call the shared self-service facade.
- Operator-only conversation tools exist for backup list/create/validate and
  restore prepare/confirm/safety-backup/execute/cancel.
- Restore remains a two-step workflow and execution cannot happen in the same
  action that prepares the plan.
- Restore execution still goes only through `RestoreCommandService`.
- 04E never directly spawns, imports, or invokes Rust; all Rust work flows
  through `system_commands`.
- UI and tools represent Rust execution as asynchronous command state, not
  synchronous completion.
- Default chat prompt does not expose backup/restore tools.
- Query/read models avoid raw table reads in UI/tool code.
- Positive, negative, and edge tests pass.
- Phase 04F can add automatic scheduling/policy editing without rewriting 04E.

## Implementation Summary

Implemented on 2026-05-02.

- Added backup/restore read-model query ports for snapshots, commands, restore
  plans, and audit events.
- Extended the SQLite backup governance mappers with recent-list, latest,
  command correlation, status-count, and audit timeline queries.
- Added `BackupSelfService` as the shared admin/tool facade over the existing
  04A-04D services.
- Added `/admin/system/backups` and a client manager for backup creation,
  validation, restore planning, restore confirmation, safety backup request,
  restore execution, and cancellation.
- Added admin API routes under `/api/admin/system/backups` and
  `/api/admin/system/restore-plans`.
- Added a system page link to the backup self-service surface.
- Added operator-only catalog tools for backup list/create/validate and restore
  prepare/safety-backup/confirm/execute/cancel.
- Kept all Rust execution behind `system_commands`; 04E code does not spawn,
  import, shell out to, or synchronously call Rust.
- Added tests for the self-service facade, read models, admin routes, tool
  execution, catalog membership, prompt exposure, and admin page rendering.

Evidence: `../evidence/04e-admin-and-conversation-self-service-2026-05-02.md`.
