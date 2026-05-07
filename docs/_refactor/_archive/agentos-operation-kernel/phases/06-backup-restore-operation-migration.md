# Phase 06: Backup/Restore Operation Migration

Status: Implemented and QA verified on 2026-05-03

## Goal

Move appliance backup and restore self-service onto the operation kernel.

The net result of this phase is:

- backup and restore requests become durable `backup_create` and
  `restore_execute` operations before execution;
- all user-visible backup/restore mutations run through typed operation actions,
  not natural-language `tool` action text;
- restore execution is impossible until prepare, explicit confirmation, safety
  backup, and eligibility checks have succeeded in operation state;
- Rust backup/restore commands carry operation and step identifiers;
- command completion reconciles back into the operation ledger;
- chat, admin, health, disk state, system commands, and Rust executor state agree;
- legacy duplicate backup/restore mutation paths are pruned after tests pass.

This phase migrates backup/restore execution only. Media workflows, factory work
orders, help/onboarding, and broader admin operation surfaces remain later
phases.

## QA Certification

This document was QA reviewed against the current codebase on 2026-05-03.

Verified current-code anchors:

- existing backup/restore services and repositories exist;
- existing admin backup and restore routes exist;
- operation action dispatch currently registers only `diagnostic.run`;
- `OperationDraftFactory` currently creates disabled backup/restore actions;
- `OperationActionPolicy` currently lacks `backup.validate` and
  `restore.confirm` validators;
- Rust currently parses backup and restore payloads without operation metadata;
- `BackupSystemCommandDataMapper` currently lacks operation-metadata query
  helpers needed by the reconciler.

Issues corrected during QA:

- made action type vs step kind naming explicit;
- added the Phase 06 requirement to enable draft actions only when gates allow;
- added TypeScript validation requirements for optional operation metadata;
- added concrete system-command query requirements for reconciliation;
- added deterministic reconciliation invocation points.

Certification result:

- implemented through the operation kernel and re-QA'd against the current
  codebase;
- no unresolved placeholders;
- no known stale existing file references;
- expected-new files are present as implementation outputs.

## Implementation Evidence

Implemented on 2026-05-03.

Code outcomes:

- backup and restore operation action contracts now live in
  `src/core/use-cases/operations/BackupRestoreOperationActions.ts`;
- `OperationActionPolicy` validates `backup.validate` and `restore.confirm`;
- `OperationDraftFactory` exposes enabled backup/restore draft actions when
  current gates allow them;
- `src/lib/operations/operation-action-dispatch-root.ts` registers diagnostic
  and backup/restore executors outside the Next route;
- `src/lib/appliance/backup/backup-restore-operation-executor.ts` dispatches
  backup create/validate and restore prepare/confirm/safety/execute/cancel
  actions through the operation ledger;
- `src/lib/appliance/backup/backup-restore-operation-reconciler.ts` projects
  operation-backed `system_commands` results into operation steps, actions, and
  artifacts;
- backup command payloads and Rust executor payloads preserve optional operation
  metadata without breaking existing metadata-free commands;
- admin backup and restore routes now create or dispatch operation actions for
  mutations;
- the legacy appliance backup chat tool no longer emits natural-language
  mutation links for backup/restore.

Final verification evidence:

- `npx vitest run src/core/use-cases/operations/BackupRestoreOperationActions.test.ts src/core/use-cases/operations/OperationActionPolicy.test.ts src/core/use-cases/operations/OperationIntentRouter.test.ts src/lib/appliance/backup/backup-command-validation.test.ts src/adapters/BackupGovernanceDataMapper.test.ts src/lib/appliance/backup/backup-restore-operation-executor.test.ts src/lib/appliance/backup/backup-restore-operation-reconciler.test.ts`
  passed.
- `npx vitest run src/core/use-cases/operations/BackupRestoreOperationActions.test.ts src/lib/appliance/backup/backup-restore-operation-executor.test.ts src/lib/appliance/backup/backup-restore-operation-reconciler.test.ts src/core/use-cases/operations/OperationActionPolicy.test.ts src/core/use-cases/operations/OperationActionDispatch.test.ts src/lib/operations/operation-action-api.test.ts src/lib/operations/operation-action-view-model.test.ts src/lib/chat/stream-preparation.operation-grounding.test.ts src/lib/operations/operation-prompt-grounding.test.ts`
  passed.
- `npx vitest run src/lib/appliance/backup/backup-command-service.test.ts src/lib/appliance/backup/backup-self-service.test.ts src/lib/appliance/backup/restore-safety-pipeline.test.ts src/core/use-cases/tools/appliance-backup.tool.test.ts src/app/api/admin/system/backups/route.test.ts src/app/api/admin/system/restore-plans/[planId]/execute/route.test.ts`
  passed.
- `npx vitest run src/frameworks/ui/useChatSurfaceState.test.tsx src/frameworks/ui/chat/ToolPluginPartRenderer.test.tsx src/frameworks/ui/chat/primitives/capability-card-primitives.test.tsx`
  passed.
- `npm test` passed: 745 test files, 5313 tests passed, 2 skipped.
- `npm run typecheck` passed.
- `npm run lint` passed with existing warnings and 0 errors.
- `cargo test -p ordo-backup` passed.
- `npm run rust:clippy --if-present` passed with `-D warnings`.

Full-suite QA found and fixed two follow-up issues:

- the operation action route test still mocked the old direct repository factory
  shape instead of the shared dispatch root dependency surface;
- the resource pressure probe test used tiny fake byte values with default GiB
  thresholds, so the test now supplies a tiny explicit policy.

QA re-run on 2026-05-03 found and fixed one documentation defect:

- the minimum verification command referenced
  `src/app/admin/system/backups/route.test.ts`, but the actual admin API route
  test is `src/app/api/admin/system/backups/route.test.ts`; the corrected
  command now runs the intended six backup/admin test files.

QA re-run evidence after that correction:

- targeted Phase 06 operation tests passed: 10 files, 54 tests.
- corrected backup/admin test command passed: 6 files, 24 tests.
- `cargo test -p ordo-backup` passed.
- `npm run typecheck` passed.
- `npm run lint` passed with existing warnings and 0 errors.
- `npm run rust:clippy --if-present` passed with `-D warnings`.
- `git diff --check` passed.
- Phase 06 regression greps returned no matches.
- `npm test` passed: 745 test files, 5313 tests passed, 2 skipped.

## Inputs From Phase 00 Through Phase 05

Phase 00 evidence:

- `../evidence/phase-00-baseline.md`
- `../evidence/initial-code-grounding.md`

Phase 01 implementation:

- `src/core/entities/operation.ts`
- `src/core/use-cases/operations/OperationActionPolicy.ts`
- `src/core/use-cases/operations/OperationStateMachine.ts`
- `src/core/use-cases/operations/OperationKindRegistry.ts`
- `src/core/use-cases/operations/OperationStatusMapping.ts`

Phase 02 implementation:

- `src/core/use-cases/operations/OperationRepository.ts`
- `src/core/use-cases/operations/OperationReadModel.ts`
- `src/adapters/OperationDataMapper.ts`
- `src/adapters/RepositoryFactory.ts`

Phase 03 implementation:

- `src/core/use-cases/operations/OperationActionDispatch.ts`
- `src/lib/operations/operation-action-api.ts`
- `src/lib/operations/operation-action-view-model.ts`
- `src/lib/operations/operation-action-markdown.ts`
- `src/app/api/operations/[operationId]/actions/[actionId]/route.ts`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `src/frameworks/ui/chat/primitives/CapabilityActionRail.tsx`

Phase 04 implementation:

- `src/core/use-cases/operations/OperationIntent.ts`
- `src/core/use-cases/operations/OperationIntentRouter.ts`
- `src/core/use-cases/operations/OperationDraftFactory.ts`
- `src/lib/operations/operation-intent-compiler.ts`
- `src/lib/operations/operation-intent-root.ts`
- `src/lib/operations/operation-intent-ingress.ts`
- `src/lib/operations/operation-intent-projection.ts`

Phase 05 implementation:

- `src/core/use-cases/operations/OperationPromptGrounding.ts`
- `src/lib/operations/operation-prompt-grounding-root.ts`
- `src/lib/operations/operation-prompt-grounding.ts`
- `src/lib/operations/operation-tool-evidence.ts`
- `src/lib/chat/stream-preparation.ts`

Key constraints carried forward:

- `OperationRepository` is the only read/write boundary for operation truth.
- `OperationActionDispatchService` routes by stored `operationId + actionId`.
- `OperationActionPolicy` owns stale action, idempotency, confirmation, role,
  disabled action, and payload validation.
- Phase 04 creates backup/restore operation drafts but intentionally leaves their
  actions disabled until Phase 06 registers real executors.
- Phase 05 makes current operation state and relevant tool evidence visible to
  chat, so Phase 06 must update operation state instead of patching prompts.
- The Rust executor is already a narrow native boundary. Do not replace it with
  TypeScript filesystem logic.

## Current Code Grounding

### Existing Backup/Restore Service Boundary

Current orchestrator:

- `src/lib/appliance/backup/backup-self-service.ts`

Relevant methods:

- `createManualBackup(requester)`
- `validateBackup(snapshotId, requester)`
- `createRestorePlan(snapshotId, requester)`
- `confirmRestorePlan(planId, confirmationPhrase, requester)`
- `requestPreRestoreBackup(planId, requester)`
- `executeConfirmedRestore(planId, requester)`
- `cancelRestorePlan(planId, requester)`
- `getDashboard()`

Decision:

Keep `BackupSelfService` as the subsystem anti-corruption adapter for Phase 06.
Do not duplicate archive validation, restore safety checks, resource pressure,
executor availability, policy, or audit logic in operation executors. Operation
executors should call focused methods or extracted backup application services,
then project the result into `OperationRepository`.

### Existing Durable Backup Tables

Current contracts:

- `src/lib/appliance/backup/types.ts`
- `src/adapters/BackupSystemCommandDataMapper.ts`
- `src/adapters/BackupSnapshotDataMapper.ts`
- `src/adapters/RestorePlanDataMapper.ts`
- `src/adapters/BackupRestoreAuditDataMapper.ts`

Current tables:

- `system_commands`
- `backup_snapshots`
- `restore_plans`
- `backup_restore_audit_events`

Current command names are already canonical:

- `backup.create`
- `restore.request`

Decision:

Do not rename system command names. The legacy to prune is the user-facing
mutation path that emits `actionType: "tool"` links and natural-language values,
not the existing Rust command names.

### Existing Rust Boundary

Current Rust contract:

- `crates/ordo-backup/src/command.rs`
- `crates/ordo-backup/src/daemon.rs`
- `crates/ordo-backup/src/command_store.rs`
- `crates/ordo-backup/src/restore_executor.rs`

Current payloads:

- `BackupCreatePayload`
  - `kind`
  - `requestedAt`
  - `snapshotId`
  - `dataBoundary`
  - `appVersion`
  - `sourceRuntimeProfileId`
  - optional `restorePlanId`
- `RestoreRequestPayload`
  - `restorePlanId`
  - `snapshotId`
  - `archivePath`
  - `expectedArchiveHash`
  - `expectedArchiveSizeBytes`
  - `manifestSchemaVersion`
  - `restorePlanVersion`
  - `requestedAt`
  - `dataBoundary`
  - optional `confirmationRef`

Decision:

Extend these payloads with optional operation metadata:

- `operationId`
- `stepId`
- `actionId`
- `operationKind`

Rust should parse, validate, and preserve these fields, but TypeScript remains
the writer of the operation ledger. The Rust daemon should continue to update
`system_commands`, `backup_snapshots`, and `restore_plans`; a TypeScript
reconciler projects those command outcomes into operations.

### Existing Legacy Chat Tool Path

Current file:

- `src/core/use-cases/tools/appliance-backup.tool.ts`

Current behavior:

- `toolAction()` creates `actionType: "tool"` links.
- Backup and restore actions send text such as:
  - `Create appliance backup`
  - `Prepare appliance restore from backup ...`
  - `Confirm appliance restore ...`
  - `Create safety backup for appliance restore ...`
  - `Execute appliance restore ...`
- `ApplianceBackupCard` renders those actions through
  `CapabilityActionRail`.

Decision:

After Phase 06 tests pass, backup/restore mutation buttons must be operation
buttons. No new dangerous backup/restore path may send natural-language text
back into chat.

Read-only backup listing may remain available as a tool or admin API, but any
listed mutation action must create or dispatch an operation action.

### Existing Admin Path

Current files:

- `src/app/admin/system/backups/BackupSelfServiceManager.tsx`
- `src/app/api/admin/system/backups/route.ts`
- `src/app/api/admin/system/backups/[snapshotId]/validate/route.ts`
- `src/app/api/admin/system/backups/[snapshotId]/restore-plans/route.ts`
- `src/app/api/admin/system/restore-plans/[planId]/confirm/route.ts`
- `src/app/api/admin/system/restore-plans/[planId]/pre-restore-backup/route.ts`
- `src/app/api/admin/system/restore-plans/[planId]/execute/route.ts`
- `src/app/api/admin/system/restore-plans/[planId]/cancel/route.ts`

Current behavior:

- Admin buttons call backup self-service endpoints directly.
- The admin UI has useful safety affordances, but it is not operation-backed.
- A stale browser tab can call a route that does not know the operation revision.

Decision:

Admin backup/restore buttons must either:

1. create an operation through an admin operation creation endpoint and render
   the returned operation actions; or
2. dispatch an existing operation action through
   `/api/operations/[operationId]/actions/[actionId]`.

Direct admin self-service mutation routes should be removed or downgraded to
internal adapters once operation routes cover the same behavior.

### Existing Operation Dispatch Gap

Current file:

- `src/app/api/operations/[operationId]/actions/[actionId]/route.ts`

Current production executor registry:

- `diagnostic.run` only.

Decision:

Phase 06 must introduce a real operation executor composition root. Do not keep
the backup/restore executor list hard-coded in the route. The route should call
a factory such as `createOperationActionDispatchService()` from a lib/root file
that registers diagnostic and backup/restore executors together.

### Existing Draft Action Limit

Current file:

- `src/core/use-cases/operations/OperationDraftFactory.ts`

Current behavior:

- `backup_create` and `restore_execute` drafts are created by Phase 04.
- `OperationDraftFactory.action()` always sets `enabled: false`.
- The disabled reason says backup/restore executors arrive in Phase 06.

Decision:

Phase 06 must update the draft/action factory so backup and restore draft
actions are enabled when gates allow execution, and disabled only when a current
gate explains why. Do not work around this in React or route code.

## Clean Architecture Shape

### Core

Expected core additions or modifications:

- `src/core/use-cases/operations/BackupRestoreOperationActions.ts`
- `src/core/use-cases/operations/BackupRestoreOperationActions.test.ts`
- `src/core/use-cases/operations/OperationActionPolicy.ts`
- `src/core/use-cases/operations/OperationDraftFactory.ts`

Core owns:

- action type constants;
- action payload schemas;
- pure action factory helpers;
- operation step identifiers and labels;
- payload validation rules.

The implementation should make the action/step distinction explicit:

- action type `restore.create_safety_backup` is the user action;
- step kind `restore.safety_backup` is the durable operation step;
- action type `restore.execute` is the user action;
- step kind `restore.execute` is the execution step.

Tests must assert this mapping so implementers do not drift between action and
step names.

Core must not import:

- `BackupSelfService`;
- SQLite mappers;
- Next route helpers;
- Rust command store code;
- React components.

### Infrastructure/Application Layer

Expected new files:

- `src/lib/operations/operation-action-dispatch-root.ts`
- `src/lib/appliance/backup/backup-restore-operation-executor.ts`
- `src/lib/appliance/backup/backup-restore-operation-executor.test.ts`
- `src/lib/appliance/backup/backup-restore-operation-reconciler.ts`
- `src/lib/appliance/backup/backup-restore-operation-reconciler.test.ts`

This layer owns:

- wiring `OperationActionDispatchService`;
- registering backup/restore executors;
- calling `BackupSelfService` and backup repositories;
- projecting subsystem results into operation steps, events, actions, and
  artifacts;
- reconciling `system_commands` completion back into operations.

### Routes And UI

Expected modified files:

- `src/app/api/operations/[operationId]/actions/[actionId]/route.ts`
- `src/app/api/admin/system/backups/route.ts`
- `src/app/api/admin/system/backups/[snapshotId]/restore-plans/route.ts`
- `src/app/admin/system/backups/BackupSelfServiceManager.tsx`
- `src/frameworks/ui/chat/plugins/custom/ApplianceBackupCard.tsx`
- `src/core/use-cases/tools/appliance-backup.tool.ts`

Expected new admin operation creation API when restore is started from a backup
list row:

- `src/app/api/admin/system/backups/[snapshotId]/restore-operations/route.ts`

This endpoint creates a `restore_execute` operation for a concrete snapshot and
returns the current operation snapshot plus available operation actions. It does
not execute restore work directly.

## Operation State Design

### `backup_create`

Initial draft from Phase 04:

- kind: `backup_create`
- initial action: `backup.create`
- risk: `medium`
- confirmation: `single_click`

Implementation rules:

1. If executor/resource gates are blocked, keep the operation `blocked` and
   expose no executable create action.
2. When `backup.create` is accepted:
   - upsert step `backup.create` as `running` or `ready` then `running`;
   - call backup self-service to enqueue `backup.create`;
   - attach the pending `backup_snapshots.id` and `system_commands.id` to the
     step;
   - update operation to `queued`;
   - replace actions with status/check or no mutation actions.
3. When Rust command succeeds:
   - transition step `backup.create` to `succeeded`;
   - attach an artifact for the backup snapshot/archive;
   - update operation to `succeeded`.
4. When Rust command fails:
   - transition step `backup.create` to `failed`;
   - update operation to `failed` with structured error.

The operation is complete only when the Rust-backed command outcome is known.
Queuing a command is not success.

### `restore_execute`

Initial draft from Phase 04:

- kind: `restore_execute`
- initial action: `restore.prepare`
- risk: `destructive`
- payload: `{ snapshotId }`

Required steps:

1. `restore.prepare`
2. `restore.confirm`
3. `restore.safety_backup`
4. `restore.execute`
5. `restore.verify`

Implementation rules:

1. `restore.prepare`
   - validates the target snapshot;
   - creates a restore plan through existing restore services;
   - attaches a `restore_plan` artifact;
   - updates operation to `awaiting_confirmation`;
   - replaces actions with `restore.confirm` and `restore.cancel`.
2. `restore.confirm`
   - requires the exact restore plan confirmation phrase;
   - marks the restore plan confirmed;
   - transitions `restore.confirm` to `succeeded`;
   - updates operation to `blocked` or `awaiting_confirmation` with clear
     message that safety backup is required;
   - exposes `restore.create_safety_backup` and `restore.cancel`.
3. `restore.create_safety_backup`
   - enqueues a `backup.create` command with kind `pre_restore`;
   - records command and future snapshot ids on the step;
   - updates operation to `queued` or `running`;
   - does not expose `restore.execute` until the reconciler confirms the safety
     backup command and linked snapshot succeeded.
4. `restore.execute`
   - is enabled only when:
     - restore plan status is `confirmed`;
     - pre-restore backup command exists and is `succeeded`;
     - pre-restore backup snapshot exists, is linked, and is `succeeded`;
     - executor/resource gates are not blocked;
     - the operation revision matches the action revision.
   - enqueues `restore.request`;
   - transitions `restore.execute` to `running`;
   - updates operation to `running`.
5. `restore.verify`
   - runs after Rust marks restore command succeeded;
   - confirms the restore plan state and command result agree;
   - transitions operation to `succeeded` or `failed`.
6. `restore.cancel`
   - cancels the restore plan if possible;
   - transitions operation to `cancelled`;
   - disables all further destructive actions.

Restore execution before safety backup is a hard policy error. It must fail in
operation action dispatch/executor code before any `restore.request` command is
enqueued.

Step dependency rules:

- `restore.confirm` depends on `restore.prepare`.
- `restore.safety_backup` depends on `restore.confirm`.
- `restore.execute` depends on `restore.safety_backup`.
- `restore.verify` depends on `restore.execute`.

Use `OperationStep.dependsOnStepIds` and the Phase 01 state machine to enforce
these dependencies. Do not duplicate dependency checks in the UI.

## Action Contract

Required action types:

- `backup.create`
- `backup.validate`
- `restore.prepare`
- `restore.confirm`
- `restore.create_safety_backup`
- `restore.execute`
- `restore.cancel`

Payload schemas:

- `backup.create`: no required fields.
- `backup.validate`: `snapshotId`.
- `restore.prepare`: `snapshotId`.
- `restore.confirm`: `restorePlanId`.
- `restore.create_safety_backup`: `restorePlanId`.
- `restore.execute`: `restorePlanId`.
- `restore.cancel`: `restorePlanId`.

`OperationActionPolicy.DEFAULT_OPERATION_PAYLOAD_VALIDATORS` must be updated for
new payload schema keys:

- `backup.validate`
- `restore.confirm`

Existing validators already cover:

- `backup.create`
- `restore.prepare`
- `restore.create_safety_backup`
- `restore.execute`
- `restore.cancel`

Confirmation policy:

- `backup.create`: `single_click`
- `backup.validate`: `single_click`
- `restore.prepare`: `single_click`; this creates and validates a restore plan
  but does not execute data replacement.
- `restore.confirm`: `phrase`, with `confirmationText` equal to the restore
  plan confirmation phrase.
- `restore.create_safety_backup`: `single_click`
- `restore.execute`: `phrase`, with `confirmationText` equal to
  `EXECUTE ${restorePlanId.slice(0, 16)}`.
- `restore.cancel`: `single_click`

All destructive restore actions must be `allowedRoles: ["ADMIN"]`.

## Rust And System Command Contract

Extend TypeScript payloads:

- `BackupCommandPayload`
- `RestoreCommandRequest`
- `createBackupExecutorPayload()`
- restore command payload construction in `RestoreCommandService`

Add optional operation metadata:

```ts
operation?: {
  operationId: string;
  stepId: string;
  actionId: string;
  operationKind: "backup_create" | "restore_execute";
}
```

The nested shape is preferred over four top-level fields because it keeps the
existing executor payload stable and makes it clear this data is orchestration
metadata, not archive/restore input.

TypeScript validation must reject malformed operation metadata before enqueue:

- `operation` must be an object when present;
- `operation.operationId`, `operation.stepId`, and `operation.actionId` must be
  non-empty strings;
- `operation.operationKind` must be `backup_create` or `restore_execute`;
- `backup.create` with `kind: "manual"` and operation metadata must use
  `operationKind: "backup_create"`;
- `backup.create` with `kind: "pre_restore"` and operation metadata must use
  `operationKind: "restore_execute"`;
- `restore.request` with operation metadata must use
  `operationKind: "restore_execute"`.

This validation belongs in `src/lib/appliance/backup/backup-command-validation.ts`
and must be covered by tests. Rust validation is a second boundary, not the
first place malformed metadata should be caught.

Extend Rust payload structs to parse and preserve this optional `operation`
field. Rust should reject malformed operation metadata if present, but should
continue to process old commands that lack it until Phase 06 command tests prove
all new enqueue paths include it.

Reconciliation rule:

- TypeScript writes operation events and step transitions.
- Rust writes command/snapshot/restore-plan results.
- The reconciler reads `system_commands.payload.operation` and command result
  state, then idempotently updates `OperationRepository`.

Rust must not write operation rows directly in Phase 06.

Repository/query additions needed for reconciliation:

- add `SystemCommandQuery.listRecentOperationBackedCommands(limit, offset?)`, or
  an equivalent query that selects commands where
  `json_type(payload_json, '$.operation') = 'object'`;
- add `SystemCommandQuery.listByOperationId(operationId, limit?)`, or a focused
  query with `json_extract(payload_json, '$.operation.operationId')`;
- test the JSON query path in `BackupSystemCommandDataMapper.test.ts`.

Filtering `listRecentBackupRestore()` in memory is acceptable only for a tiny
temporary test helper. The production reconciler should have an indexed or
bounded SQL read path.

## Reconciler Design

Create `BackupRestoreOperationReconciler`.

Inputs:

- operation repository;
- system command query;
- snapshot repository/query;
- restore plan repository/query;
- backup audit query if needed;
- current time.

Responsibilities:

- find recent or changed `system_commands` with `payload.operation`;
- map pending/running/succeeded/failed command state to operation step state;
- link pre-restore backup snapshot success to `restore.safety_backup`;
- enable `restore.execute` only after safety backup is complete;
- attach snapshot/archive/restore-plan artifacts;
- mark failed operations with structured errors;
- be idempotent when run repeatedly by scheduler, admin dashboard refresh, chat
  status check, or health probe.

Invocation points:

- after a backup/restore operation action enqueues a command, run a bounded
  reconciliation pass before returning the action response;
- before admin backup dashboard render, run a bounded reconciliation pass so the
  page shows current operation truth;
- inside backup health/probe paths, run read-safe reconciliation or expose stale
  state explicitly;
- in any scheduled backup worker loop after Rust command polling, run
  reconciliation before policy promotion/retention decisions.

Do not make chat turns responsible for reconciliation. Chat may call a read path
that triggers a safe reconciliation sweep, but operation correctness must not
depend on the model asking the right follow-up question.

## UI And Conversation Contract

### Conversation

Conversation backup/restore actions must render as `actionType: "operation"`.

The assistant may summarize current state from Phase 05 grounding, but it must
not instruct the user to type magic phrases such as `fire it` or send text
actions like `Create safety backup for appliance restore ...`.

Button labels should be direct:

- `Create backup`
- `Prepare restore`
- `Confirm restore`
- `Create safety backup`
- `Execute restore`
- `Cancel restore`
- `Check status`

Dangerous buttons should render with the operation danger treatment already
supported by `CapabilityActionRail` and operation rich content.

### Admin

Admin backup pages should show the same operation truth:

- current operation status;
- backing `system_commands` ids;
- snapshot/archive artifacts;
- available actions;
- disabled reasons;
- stale action failures.

Admin buttons should either create an operation or dispatch an operation action.
They should not call backup self-service mutation endpoints directly after the
migration is complete.

### Read-Only Listing

Listing backups is not destructive. It can remain a read-only tool/admin API as
long as every mutation action attached to a listed snapshot is operation-backed.

## Pruning Plan

After operation-backed tests pass:

1. Remove natural-language backup/restore mutation links from
   `src/core/use-cases/tools/appliance-backup.tool.ts`.
2. Update `ApplianceBackupCard` tests so backup/restore mutation actions are
   operation links or absent.
3. Keep read-only list/status behavior only if it does not expose mutation
   `tool` links.
4. Replace direct admin mutation routes with operation creation/dispatch routes
   or mark them internal and remove UI usage.
5. Remove any Phase 04 disabled reason that says backup/restore executors are
   unavailable once executors are registered.

Do not remove:

- backup snapshots;
- restore plans;
- backup audit events;
- system commands;
- Rust backup executor;
- backup health/resource probes.

Those are the subsystem substrate that operations coordinate.

## Files To Modify

Expected new files:

- `src/core/use-cases/operations/BackupRestoreOperationActions.ts`
- `src/core/use-cases/operations/BackupRestoreOperationActions.test.ts`
- `src/lib/operations/operation-action-dispatch-root.ts`
- `src/lib/appliance/backup/backup-restore-operation-executor.ts`
- `src/lib/appliance/backup/backup-restore-operation-executor.test.ts`
- `src/lib/appliance/backup/backup-restore-operation-reconciler.ts`
- `src/lib/appliance/backup/backup-restore-operation-reconciler.test.ts`

Expected modified files:

- `src/core/use-cases/operations/OperationActionPolicy.ts`
- `src/core/use-cases/operations/OperationDraftFactory.ts`
- `src/app/api/operations/[operationId]/actions/[actionId]/route.ts`
- `src/lib/operations/operation-intent-root.ts`
- `src/lib/appliance/backup/types.ts`
- `src/lib/appliance/backup/backup-command-payload.ts`
- `src/lib/appliance/backup/backup-command-validation.ts`
- `src/lib/appliance/backup/backup-command-service.ts`
- `src/lib/appliance/backup/restore-command-service.ts`
- `src/lib/appliance/backup/restore-plan-service.ts`
- `src/adapters/BackupSystemCommandDataMapper.ts`
- `src/core/use-cases/tools/appliance-backup.tool.ts`
- `src/frameworks/ui/chat/plugins/custom/ApplianceBackupCard.tsx`
- `src/app/admin/system/backups/BackupSelfServiceManager.tsx`
- backup/restore admin API routes as needed;
- `crates/ordo-backup/src/command.rs`;
- Rust command tests in `crates/ordo-backup/tests`.

## Tests Required

### Core Action Tests

- `backup.create` action payload validates with no extra input.
- `restore.prepare` requires `snapshotId`.
- `restore.confirm` requires `restorePlanId` and phrase confirmation.
- `restore.create_safety_backup` requires `restorePlanId`.
- `restore.execute` requires `restorePlanId` and phrase confirmation.
- `restore.cancel` requires `restorePlanId`.
- disabled backup/restore draft actions are enabled when no gates block them.
- blocked executor/resource gates keep actions disabled with clear reasons.

### Executor Tests

- create backup operation queues a `backup.create` command and records snapshot
  and command ids on the operation step.
- missing Rust binary blocks the operation with clear state and no command.
- resource pressure blocks backup and restore before command enqueue.
- restore prepare creates a restore plan artifact and exposes confirm/cancel
  actions.
- wrong restore confirmation phrase is rejected before state mutation.
- restore confirmation succeeds and exposes safety-backup action.
- safety backup enqueue records command id and does not enable execute yet.
- restore execute before safety backup success is rejected and enqueues no
  `restore.request`.
- restore execute after safety backup success enqueues `restore.request`.
- cancel restore removes all destructive actions.
- stale action revision fails through `OperationActionDispatchService`.
- duplicate idempotency key does not enqueue duplicate commands.

### Reconciler Tests

- succeeded backup command marks backup operation succeeded and attaches
  snapshot artifact.
- failed backup command marks step and operation failed with command error.
- running command keeps operation running or queued without false success.
- pre-restore backup command success links/recognizes the safety snapshot and
  enables `restore.execute`.
- restore command success transitions execute/verify steps and operation to
  succeeded.
- restore command failure transitions execute step and operation to failed.
- commands without operation metadata are ignored or logged without mutating
  unrelated operations.
- repeated reconciliation is idempotent.

### Rust Tests

- Rust parses backup payloads with operation metadata.
- Rust parses restore payloads with operation metadata.
- Rust rejects malformed operation metadata when present.
- existing payloads without operation metadata still parse during migration.
- `cargo test -p ordo-backup` passes.

### UI/API Tests

- operation action route registers backup/restore executors through a shared
  dispatch root, not an inline diagnostic-only list.
- admin create backup uses operation creation/dispatch path.
- admin prepare/confirm/safety/execute/cancel restore uses operation
  creation/dispatch path.
- `ApplianceBackupCard` renders backup/restore mutation actions as operation
  buttons or omits them until operation state exists.
- stale operation button returns current operation state and available actions.
- action buttons are visually button-like and carry operation params:
  `operationId`, `actionId`, `idempotencyKey`, `operationRevision`.

### Chat/Grounding Tests

- after backup create, Phase 05 grounding shows queued/running state and command
  id.
- after backup command success, grounding shows operation succeeded from the
  ledger.
- restore follow-up asks use current restore operation state instead of chat
  prose.
- assistant cannot claim restore is executable when `restore.execute` is not an
  available action.
- legacy text actions such as `fire it` and `Create safety backup for appliance
  restore ...` are not emitted for operation-backed restore flow.

### Regression Greps

Run these after implementation:

```bash
rg -n "Create safety backup for appliance restore|Execute appliance restore|Confirm appliance restore" src/core/use-cases/tools src/frameworks/ui src/app
rg -n "actionType: \"tool\"|actionType: 'tool'" src/core/use-cases/tools/appliance-backup.tool.ts src/frameworks/ui/chat/plugins/custom/ApplianceBackupCard.tsx
rg -n "diagnosticRunExecutor|executors: \\[diagnosticRunExecutor\\]" 'src/app/api/operations/[operationId]/actions/[actionId]/route.ts'
rg -n "BackupSelfService" src/core/use-cases/operations
```

Expected result:

- no legacy natural-language mutation phrases remain in operation-backed backup
  and restore surfaces;
- no backup/restore core operation file imports `BackupSelfService`;
- the operation action route no longer owns a diagnostic-only executor list.

## Minimum Verification Commands

Run targeted tests:

```bash
npx vitest run \
  src/core/use-cases/operations/BackupRestoreOperationActions.test.ts \
  src/lib/appliance/backup/backup-restore-operation-executor.test.ts \
  src/lib/appliance/backup/backup-restore-operation-reconciler.test.ts \
  src/core/use-cases/operations/OperationActionPolicy.test.ts \
  src/core/use-cases/operations/OperationIntentRouter.test.ts \
  src/core/use-cases/operations/OperationActionDispatch.test.ts \
  src/lib/operations/operation-action-api.test.ts \
  src/lib/operations/operation-action-view-model.test.ts \
  src/lib/chat/stream-preparation.operation-grounding.test.ts \
  src/lib/operations/operation-prompt-grounding.test.ts
```

Run current backup tests:

```bash
npx vitest run \
  src/lib/appliance/backup/backup-command-service.test.ts \
  src/lib/appliance/backup/backup-self-service.test.ts \
  src/lib/appliance/backup/restore-safety-pipeline.test.ts \
  src/core/use-cases/tools/appliance-backup.tool.test.ts \
  src/app/api/admin/system/backups/route.test.ts \
  'src/app/api/admin/system/restore-plans/[planId]/execute/route.test.ts'
```

Run Rust tests:

```bash
cargo test -p ordo-backup
```

Run repo checks:

```bash
npm run typecheck
npm run lint
git diff --check
```

## Positive, Negative, And Edge Use Cases

Positive:

- admin asks chat to create a backup, clicks `Create backup`, Rust completes,
  chat later reports the exact succeeded snapshot.
- admin lists backups, clicks `Prepare restore`, confirms the exact phrase,
  creates safety backup, waits for success, then executes restore.
- admin dashboard and chat show the same restore operation state.

Negative:

- non-admin cannot create or execute backup/restore operations.
- missing `bin/ordo-backup` blocks the operation before command enqueue.
- resource pressure blocks backup and restore before command enqueue.
- malformed restore phrase does not mutate the restore plan.
- stale restore execute button returns current state and no side effects.

Edge:

- command succeeds after user refreshes the page; reconciler advances operation
  without relying on chat.
- pre-restore backup command succeeds but snapshot link is delayed; operation
  remains blocked with a clear disabled reason.
- command lacks operation metadata from old local data; reconciler ignores it
  instead of corrupting operation state.
- duplicate action POST reuses idempotency and does not create duplicate system
  commands.
- restore plan is cancelled after safety backup; execute remains unavailable.

## Exit Criteria

Phase 06 is complete when:

- `backup_create` and `restore_execute` operation actions execute through the
  Phase 03 action dispatch API;
- backup/restore operation executors are registered through a shared dispatch
  root;
- Rust command payloads include operation metadata for all new backup/restore
  operation commands;
- command completion is reconciled into operation steps, events, actions, and
  artifacts;
- restore execution is impossible before explicit confirmation and successful
  safety backup;
- admin and conversation backup/restore mutation buttons are operation-backed;
- legacy natural-language backup/restore mutation actions are removed or made
  read-only;
- Phase 05 grounding reflects backup/restore state without subsystem-specific
  prompt patches;
- all required TypeScript, Rust, lint, typecheck, and grep checks pass;
- this document is updated from `Grounded and QA-ready` to `Implemented` with
  verification evidence.
