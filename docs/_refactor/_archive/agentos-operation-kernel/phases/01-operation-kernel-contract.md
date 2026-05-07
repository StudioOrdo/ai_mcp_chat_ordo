# Phase 01: Operation Kernel Contract

Status: Implemented

## Goal

Define the canonical operation domain model, state machine, action policy, and
adapter contracts that all complex Ordo work must use.

Phase 01 is intentionally a pure domain/use-case phase. It must not add SQLite
tables, Next API routes, React UI, or Rust changes. Those come later. This phase
creates the compile-time contract that prevents every later phase from inventing
another one-off workflow state model.

## Phase 00 Inputs

Phase 00 evidence is the source of truth for this phase:

- `../evidence/phase-00-baseline.md`
- `../contract-spec.md`

Key findings carried forward:

- There are no `operation%` tables yet.
- `ExecutionTimeline` is close to the desired shape, but it is not universal and
  does not own state transitions.
- Chat persists `tool_call` and `tool_result` parts, but backend replay drops
  them in `chatSendPolicy.ts`.
- Custom buttons exist, but important appliance actions still use
  `actionType: "tool"` and natural-language text dispatch.
- Backup/restore, media, factory, and jobs each have durable state, but each
  owns a separate state contract.
- Rust backup execution is governed but not operation-aware.
- Tool/provider availability and role/content access are strong enough to feed
  operation policy.

## Current Code Grounding

### Existing Operation-Like Timeline

- `src/core/platform/execution/ExecutionTimeline.ts`
  - `ExecutionKind` currently covers `job`, `work_order`, `tool`,
    `chat_turn`, and `observability`.
  - `ExecutionTimeline` already has events, artifacts, checkpoints, and
    next actions.
  - It lacks operation kinds for backup/restore/media/help/onboarding and does
    not centralize state transitions.
- `src/core/platform/facade/AgentPlatformFacade.ts`
  - discovers capabilities,
  - executes capabilities,
  - reads execution timelines,
  - delegates revision actions for jobs/work orders.
- `src/lib/platform/agent-platform-facade-root.ts`
  - currently implements revision behavior directly for jobs and work orders.

Decision:

Use `ExecutionTimeline` as design input and projection output. Do not make it
the canonical operation domain. The operation contract must be lower-level and
more general.

### Capability Runtime

- `src/core/platform/capability-runtime/CapabilityRuntime.ts`
- `src/core/capability-catalog/catalog.ts`
- `src/core/capability-catalog/runtime-tool-binding.ts`
- `src/lib/tools/tool-availability-service.ts`

Phase 00 found 69 capabilities with these primary targets:

- `host_ts`: 50
- `deferred_job`: 12
- `browser_wasm`: 2
- `mcp_stdio`: 5

Decision:

The operation kernel must reference capabilities by name and execution target,
but capability runtime remains a registry/planner, not the source of operation
truth.

### Current Durable Ledgers

- Jobs:
  - `src/core/entities/job.ts`
  - `src/core/use-cases/JobQueueRepository.ts`
  - `src/adapters/JobQueueDataMapper.ts`
  - tables: `job_requests`, `job_events`
- Backup/restore:
  - `src/lib/appliance/backup/types.ts`
  - `src/lib/appliance/backup/backup-self-service.ts`
  - tables: `system_commands`, `backup_snapshots`, `restore_plans`,
    `backup_restore_audit_events`
- Media:
  - `src/lib/media/workflows/types.ts`
  - `src/lib/media/workflows/orchestrator.ts`
  - table family: `media_workflows`, `media_workflow_steps`
- Factory:
  - `src/core/entities/work-order.ts`
  - `src/core/entities/factory-constants.ts`
  - `src/core/entities/stage-run-record.ts`
  - `src/lib/factory/production-orchestrator.ts`
  - `src/adapters/FactoryDataMapper.ts`
  - table family: `factory_work_orders`, `factory_stage_runs`,
    `factory_events`, `factory_outputs`, `factory_checkpoints`

Decision:

Phase 01 must define adapter contracts that let these systems map into
operations without forcing storage migration yet. Phase 02 will add the
operation tables. Phases 06 through 08 will migrate backup, media, and factory.

### Action Dispatch Gap

- `src/core/entities/rich-content.ts`
  - current action types are `conversation`, `route`, `send`, `tool`, `corpus`,
    `external`, and `job`.
- `src/frameworks/ui/useChatSurfaceState.tsx`
  - structured `job` action exists,
  - `tool` actions still call `sendMessage(text)`.
- `src/core/use-cases/tools/appliance-backup.tool.ts`
  - creates backup/restore actions as natural-language `tool` actions.

Decision:

Phase 01 must define operation actions as first-class domain records with
revision, idempotency, role policy, risk, confirmation policy, and stale-action
handling. Phase 03 will add UI/API dispatch.

### Role And Access Inputs

- `src/core/entities/user.ts`
  - roles: `ANONYMOUS`, `AUTHENTICATED`, `APPRENTICE`, `STAFF`, `ADMIN`
- `src/lib/access/content-access.ts`
  - audiences: `public`, `member`, `account`, `premium`, `apprentice`,
    `staff`, `admin`
- `src/lib/operations/operations-access.ts`
  - existing operations workspace access is currently `STAFF` and `ADMIN`

Decision:

Operation role policy must use existing `RoleName` directly. Do not create a
second role system.

## Clean Architecture Shape

Implement Phase 01 in the core layer with no database dependency.

Expected files:

- `src/core/entities/operation.ts`
- `src/core/entities/operation.test.ts`
- `src/core/use-cases/operations/OperationStateMachine.ts`
- `src/core/use-cases/operations/OperationStateMachine.test.ts`
- `src/core/use-cases/operations/OperationActionPolicy.ts`
- `src/core/use-cases/operations/OperationActionPolicy.test.ts`
- `src/core/use-cases/operations/OperationKindRegistry.ts`
- `src/core/use-cases/operations/OperationKindRegistry.test.ts`
- `src/core/use-cases/operations/OperationStatusMapping.ts`
- `src/core/use-cases/operations/OperationStatusMapping.test.ts`

Do not create `src/core/policies` unless a wider project convention for that
folder is introduced. The current codebase places most business policy in
entities and use cases.

## Domain Contract

### Operation Entity

Required operation fields:

- `id`
- `kind`
- `revision`
- `title`
- `status`
- `riskLevel`
- `conversationId`
- `originMessageId`
- `createdByUserId`
- `createdByRole`
- `visibility`
- `currentStepId`
- `createdAt`
- `updatedAt`
- `completedAt`
- `summary`
- `input`
- `result`
- `error`

Rules:

- `revision` starts at `1`.
- Every domain mutation that can invalidate exposed actions must increment
  `revision`. At minimum, this includes operation status changes, current step
  changes, result changes, error changes, and available-action changes.
- `OperationAction.operationRevision` must match the current operation revision
  unless the same action request has already been accepted with the same
  `idempotencyKey`.
- Reusing an accepted action id with a different `idempotencyKey` must be
  rejected as stale unless a later phase has exposed a new action record.
- Phase 01 returns typed domain results for revision changes. It does not
  persist revisions.

### Operation Kind

Required initial kinds:

- `backup_create`
- `restore_execute`
- `media_workflow`
- `factory_work_order`
- `system_diagnostic`
- `tool_task`
- `content_publish`
- `onboarding_flow`
- `help_flow`

Each kind must register an `OperationKindDefinition`:

- `kind`
- `label`
- `description`
- `defaultRiskLevel`
- `defaultVisibility`
- `allowedRoles`
- `supportsRetry`
- `requiresConversation`
- `handlerKey`

### Operation Status

Use the contract statuses:

- `draft`
- `awaiting_confirmation`
- `queued`
- `running`
- `blocked`
- `succeeded`
- `failed`
- `cancelled`
- `expired`

Default transition rules:

- `draft` -> `awaiting_confirmation`
- `draft` -> `queued`
- `draft` -> `blocked`
- `draft` -> `cancelled`
- `awaiting_confirmation` -> `queued`
- `awaiting_confirmation` -> `blocked`
- `awaiting_confirmation` -> `cancelled`
- `awaiting_confirmation` -> `expired`
- `queued` -> `running`
- `queued` -> `blocked`
- `queued` -> `cancelled`
- `queued` -> `failed`
- `running` -> `blocked`
- `running` -> `succeeded`
- `running` -> `failed`
- `running` -> `cancelled`
- `blocked` -> `queued`
- `blocked` -> `running`
- `blocked` -> `cancelled`
- `blocked` -> `failed`
- `failed` -> `queued` only when kind policy explicitly supports retry

Terminal by default:

- `succeeded`
- `cancelled`
- `expired`

`failed` is terminal unless the operation kind explicitly exposes a retry action.

### Step Status

Use the contract step statuses:

- `pending`
- `ready`
- `running`
- `blocked`
- `succeeded`
- `failed`
- `skipped`
- `cancelled`

Canonical `ready` means eligible to start or resume execution. It does not mean
artifact-ready. Existing subsystem states with artifact-ready semantics must map
to canonical `succeeded`.

Default step transition rules:

- `pending` -> `ready`
- `pending` -> `blocked`
- `pending` -> `skipped`
- `pending` -> `cancelled`
- `ready` -> `running`
- `ready` -> `blocked`
- `ready` -> `skipped`
- `running` -> `succeeded`
- `running` -> `blocked`
- `running` -> `failed`
- `running` -> `cancelled`
- `blocked` -> `pending`
- `blocked` -> `ready`
- `blocked` -> `running`
- `blocked` -> `failed`
- `blocked` -> `cancelled`
- `failed` -> `ready` only when retry is allowed

### Operation Step

Required step fields:

- `id`
- `operationId`
- `sequence`
- `kind`
- `status`
- `dependsOnStepIds`
- `capabilityName`
- `jobId`
- `systemCommandId`
- `resourceRef`
- `input`
- `output`
- `error`
- `retryCount`
- `startedAt`
- `completedAt`

Step state is owned by the operation state machine. Source-specific step states
from media and factory must enter the operation model through
`OperationStatusMapping`.

Dependency rules:

- `dependsOnStepIds` defaults to an empty list.
- A step cannot become `ready` or `running` until all dependency steps are
  `succeeded` or `skipped`.
- Missing dependency steps are validation errors.
- Failed or cancelled dependency steps must block dependents unless the
  operation kind exposes an explicit recovery or skip action.
- These rules are grounded in current media `dependsOnStepIds` and factory
  `dependencyKeys` behavior.

### Risk Level

Define risk levels:

- `info`
- `low`
- `medium`
- `high`
- `destructive`

Examples:

- `help_flow`: `info`
- `system_diagnostic`: `low` or `medium`
- `backup_create`: `medium`
- `media_workflow`: `medium`
- `content_publish`: `high`
- `restore_execute`: `destructive`

### Visibility

Define operation visibility:

- `conversation`
- `user`
- `staff`
- `admin`
- `system`

Visibility must be separate from action authorization. A staff user may be able
to inspect an operation without being able to execute a destructive action.

### Confirmation Policy

Define confirmation policies:

- `none`
- `single_click`
- `phrase`
- `admin_reauth`

The contract must allow high-risk actions to require both operation state and
explicit confirmation material. Restore execution must be representable without
special-case code.

### Operation Action

Required action fields:

- `id`
- `operationId`
- `operationRevision`
- `actionType`
- `label`
- `riskLevel`
- `confirmPolicy`
- `allowedRoles`
- `allowedStatuses`
- `enabled`
- `disabledReason`
- `idempotencyKey`
- `expiresAt`
- `payload`
- `payloadSchemaKey`

Rules:

- `actionType` is the operation action key such as `backup.create` or
  `restore.execute`. It is not the current rich-content `ActionLinkType`.
- Action validation must check operation id, revision, `allowedStatuses`, role,
  risk, payload shape, expiry, and idempotency.
- A stale action must fail as a domain error that includes current operation
  status and available actions.
- Payload validation must be pluggable by `payloadSchemaKey`; Phase 01 must
  define the contract and enough in-memory validators for the required initial
  action examples without adding storage or UI code.
- Actions do not execute work in Phase 01; they define the contract Phase 03
  will dispatch through APIs.

### Operation Event

Events are append-only domain facts:

- `operation_created`
- `operation_status_changed`
- `step_status_changed`
- `action_exposed`
- `action_requested`
- `action_rejected`
- `artifact_attached`
- `executor_event_received`
- `operation_completed`

Phase 01 must define event types and helpers, but persistence belongs to Phase
02.

### Operation Artifact

Artifacts must be generic enough to represent:

- backup archive,
- restore plan,
- system command,
- deferred job,
- generated media asset,
- factory output,
- diagnostic report,
- documentation/help section,
- release evidence.

Artifacts must store references, not binary blobs.

## Existing Status Mapping Contract

Create pure mapping helpers in `OperationStatusMapping.ts`.

Required mappings:

- `JobStatus` from `src/core/entities/job.ts`
  - `queued` -> `queued`
  - `running` -> `running`
  - `succeeded` -> `succeeded`
  - `failed` and `dead_letter` -> `failed`
  - `canceled` -> `cancelled`
- `MediaWorkflowStatus` from `src/lib/media/workflows/types.ts`
  - `queued` -> `queued`
  - `running` -> `running`
  - `blocked` -> `blocked`
  - `failed` -> `failed`
  - `succeeded` -> `succeeded`
  - `canceled` -> `cancelled`
- `WorkOrderStatus` from `src/core/entities/factory-constants.ts`
  - `planned` -> `draft`
  - `running` -> `running`
  - `paused` -> `blocked`
  - `succeeded` -> `succeeded`
  - `failed` -> `failed`
  - `canceled` -> `cancelled`
- `RestoreStatus` from `src/lib/appliance/backup/types.ts`
  - `draft` and `validated` -> `draft`
  - `confirmation_required` -> `awaiting_confirmation`
  - `confirmed` -> `blocked` until safety backup is satisfied, then `queued`
  - `running` -> `running`
  - `succeeded` -> `succeeded`
  - `failed` -> `failed`
  - `cancelled` -> `cancelled`
- `BackupCommandStatus` from `src/lib/appliance/backup/types.ts`
  - `pending` -> `queued`
  - `running` -> `running`
  - `succeeded` -> `succeeded`
  - `failed` -> `failed`
  - `cancelled` -> `cancelled`
  - `superseded` -> `cancelled`
- `MediaWorkflowStepStatus` from `src/lib/media/workflows/types.ts`
  - `pending` -> `pending`
  - `queued` -> `ready`
  - `running` -> `running`
  - `ready` -> `succeeded`
  - `blocked` -> `blocked`
  - `failed` -> `failed`
  - `skipped` -> `skipped`
- `StageRunStatus` from `src/core/entities/stage-run-record.ts`
  - `pending` -> `pending`
  - `running` -> `running`
  - `succeeded` -> `succeeded`
  - `failed` -> `failed`
  - `skipped` -> `skipped`
  - `paused` -> `blocked`
  - `canceled` -> `cancelled`

These mappings are adapters. They must not redefine the canonical operation
state machine.

## Error Contract

Define typed domain errors:

- `OperationNotFoundError`
- `OperationTransitionError`
- `OperationActionRejectedError`
- `OperationActionStaleError`
- `OperationAuthorizationError`
- `OperationPayloadValidationError`
- `OperationKindNotRegisteredError`

Errors must include stable machine-readable `code` values for APIs and UI.

## Implementation Tasks

1. Add `src/core/entities/operation.ts` with operation, step, event, action,
   artifact, policy, visibility, risk, and error types.
2. Add pure helper guards such as `isTerminalOperationStatus`,
   `isDestructiveOperation`, and `isOperationKind`.
3. Add `OperationStateMachine` with centralized transition validation,
   dependency-aware step validation, and revision increment behavior.
4. Add `OperationActionPolicy` with role, revision, expiry, risk, and
   idempotency checks plus pluggable payload validation.
5. Add `OperationKindRegistry` with required initial operation kinds.
6. Add `OperationStatusMapping` for jobs, media, factory, backup commands, and
   restore plans.
7. Add focused tests for all positive, negative, and edge cases.
8. Update this phase doc closeout after implementation.

## Non-Goals

- No SQLite schema changes.
- No repository/data mapper implementation.
- No Next API routes.
- No React card changes.
- No chat prompt grounding changes.
- No Rust payload changes.
- No migration of backup/media/factory behavior.

## Positive Use Cases

- A `backup_create` operation kind can be registered and exposes a
  `backup.create` action with `ADMIN` role and `medium` risk.
- A `restore_execute` operation kind can represent prepare, confirm, safety
  backup, execute, and verify without backup-specific state machine code.
- A media workflow status maps to canonical operation status.
- A media workflow step with local `ready` status maps to canonical `succeeded`
  because media currently uses `ready` to mean artifact-ready.
- A factory paused work order maps to a blocked operation.
- A factory paused stage maps to a blocked operation step.
- A job retry policy can be represented without duplicating job revision code.
- State transition returns an operation revision increment when exposed actions
  could become stale.
- A compose media step with successful/skipped dependencies can become `ready`.

## Negative Use Cases

- `running` -> `draft` is rejected.
- `succeeded` -> `running` is rejected.
- Non-admin cannot execute destructive restore action.
- Action with stale operation revision is rejected.
- Action with a valid revision but invalid payload shape is rejected.
- Unknown operation kind is rejected.
- Missing required payload field is rejected by action policy.
- Disabled action cannot be executed even if the label is visible.
- A dependent step cannot become `ready` while a required dependency is still
  `pending` or `running`.
- A step with a missing dependency id is rejected as invalid operation shape.

## Edge Use Cases

- Duplicate button click with the same idempotency key is treated as the same
  action request.
- Replaying the same action id with a different idempotency key is rejected
  unless the operation policy explicitly exposes a new action.
- Expired action returns a stale/expired action error, not a generic failure.
- `failed` operation can retry only if kind policy permits it.
- Operation visibility does not imply action authorization.
- A blocked operation can expose a recovery action without claiming success.
- Local subsystem status names can have different semantics, and adapter tests
  prove the canonical mapping.
- Dependency validation handles skipped dependencies as satisfied and failed
  dependencies as blocked/recovery cases.
- Greenfield empty database does not matter because Phase 01 is pure domain
  code.

## Test Plan

Required test commands after implementation:

```bash
npx vitest run \
  src/core/entities/operation.test.ts \
  src/core/use-cases/operations/OperationStateMachine.test.ts \
  src/core/use-cases/operations/OperationActionPolicy.test.ts \
  src/core/use-cases/operations/OperationKindRegistry.test.ts \
  src/core/use-cases/operations/OperationStatusMapping.test.ts

npm run typecheck
```

Optional broader check:

```bash
npm run test -- src/core/use-cases/operations src/core/entities/operation.test.ts
```

## Pruning Candidates

No product behavior may be deleted in Phase 01.

Mark these for later pruning after operation-backed replacements exist:

- `actionType: "tool"` for backup/restore actions in
  `src/core/use-cases/tools/appliance-backup.tool.ts`.
- Natural-language action values for dangerous actions.
- Backup-specific action eligibility once operation action policy owns it.
- Duplicate status mapping logic spread across cards, tools, workers, and admin
  routes.

## Implementation Closeout

Implemented files:

- `src/core/entities/operation.ts`
- `src/core/entities/operation.test.ts`
- `src/core/use-cases/operations/OperationStateMachine.ts`
- `src/core/use-cases/operations/OperationStateMachine.test.ts`
- `src/core/use-cases/operations/OperationActionPolicy.ts`
- `src/core/use-cases/operations/OperationActionPolicy.test.ts`
- `src/core/use-cases/operations/OperationKindRegistry.ts`
- `src/core/use-cases/operations/OperationKindRegistry.test.ts`
- `src/core/use-cases/operations/OperationStatusMapping.ts`
- `src/core/use-cases/operations/OperationStatusMapping.test.ts`

Implementation notes:

- Added `allowedStatuses` to the operation action contract so action policy can
  deterministically reject actions that are stale for the current operation
  status.
- Added `revision`, `operationRevision`, `idempotencyKey`, and
  `payloadSchemaKey` to the implementation and shared contract so stale actions,
  duplicate clicks, and payload validation are first-class domain behavior.
- Added accepted-action-id replay protection so the same action id cannot be
  reused with a different idempotency key.
- Added `dependsOnStepIds` to the operation step contract so media and factory
  dependency semantics are preserved in the canonical state machine.
- Added operation-scoped step mutation output so step changes that can affect
  available actions return an incremented operation revision.
- Kept Phase 01 pure: no SQLite, Next API, React, prompt, worker, or Rust code
  was added.

Verification completed:

```bash
npx vitest run \
  src/core/entities/operation.test.ts \
  src/core/use-cases/operations/OperationStateMachine.test.ts \
  src/core/use-cases/operations/OperationActionPolicy.test.ts \
  src/core/use-cases/operations/OperationKindRegistry.test.ts \
  src/core/use-cases/operations/OperationStatusMapping.test.ts

npm run typecheck

npm run test -- src/core/use-cases/operations src/core/entities/operation.test.ts

npx eslint \
  src/core/entities/operation.ts \
  src/core/entities/operation.test.ts \
  src/core/use-cases/operations/OperationStateMachine.ts \
  src/core/use-cases/operations/OperationStateMachine.test.ts \
  src/core/use-cases/operations/OperationActionPolicy.ts \
  src/core/use-cases/operations/OperationActionPolicy.test.ts \
  src/core/use-cases/operations/OperationKindRegistry.ts \
  src/core/use-cases/operations/OperationKindRegistry.test.ts \
  src/core/use-cases/operations/OperationStatusMapping.ts \
  src/core/use-cases/operations/OperationStatusMapping.test.ts
```

Final QA result: 5 test files passed, 39 tests passed, typecheck passed, and
focused ESLint passed.

## Exit Criteria

- Operation contract exists as typed, tested domain code.
- State transitions are centralized and cannot be bypassed by operation use-case
  code.
- Action policy can reject unauthorized, stale, expired, disabled, and invalid
  action requests.
- Initial operation kinds are registered.
- Existing job, media, factory, backup command, and restore statuses map to the
  canonical operation statuses.
- Tests cover positive, negative, and edge cases.
- No storage, UI, API, or Rust implementation leaks into Phase 01.
