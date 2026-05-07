# Phase 08 - Factory Work Order Operation Migration

Status: Implemented and QA verified on 2026-05-03

## Implementation Closeout

Phase 08 now has an operation-first factory work-order path:

- Factory work orders are linked to `Operation` records through
  `WorkOrder.operationId` and `factory_work_orders.operation_id`.
- `produce_product` now launches a governed `factory_work_order` operation from
  user-facing catalog/runtime surfaces instead of directly running the legacy
  factory deferred handler.
- Factory create, pause, refine, resume, retry, cancel, and checkpoint approval
  are typed operation actions with payload validators.
- The factory operation executor is registered in the operation dispatch root
  and calls factory internals behind one policy boundary.
- The operation dispatch root lazy-loads backup, media, and factory executors
  only when their action type is dispatched, so unrelated operation actions do
  not fail because another feature root is unavailable.
- The factory reconciler projects work-order status, DAG stages, factory
  events, outputs, artifacts, checkpoints, and available next actions into the
  operation read model.
- Admin factory revision POST now dispatches operation actions using
  `operationRevision`, `idempotencyKey`, payload, and confirmation instead of
  calling `AgentPlatformFacade.reviseExecution`.
- Bespoke factory mutation buttons were removed from timeline/revision
  projections; operation action buttons are now the mutation surface.
- `produce_product` is excluded from prompt-visible direct tool routing.
- Existing SQLite databases that predate `factory_work_orders.operation_id`
  now self-heal during schema startup before the unique operation index is
  created.

Verification completed:

```bash
npx vitest run \
  src/core/use-cases/operations/FactoryWorkOrderOperationActions.test.ts \
  src/core/use-cases/operations/OperationActionPolicy.test.ts \
  src/core/use-cases/operations/OperationDraftFactory.test.ts \
  src/core/use-cases/operations/OperationStatusMapping.test.ts \
  src/lib/factory/factory-work-order-operation-launcher.test.ts \
  src/lib/factory/factory-work-order-operation-executor.test.ts \
  src/lib/factory/factory-work-order-operation-reconciler.test.ts \
  src/core/capability-catalog/runtime-tool-binding.test.ts \
  'src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.test.ts' \
  'src/app/api/operations/[operationId]/actions/[actionId]/route.test.ts' \
  src/lib/operations/operation-action-api.test.ts \
  src/lib/operations/operation-action-view-model.test.ts \
  src/lib/operations/operation-action-markdown.test.ts \
  src/adapters/FactoryDataMapper.test.ts \
  src/lib/factory/factory-work-order-operation-architecture-guardrails.test.ts \
  src/core/platform/execution/ExecutionTimelineProjector.test.ts \
  src/core/platform/revision/RevisionProjector.test.ts \
  src/core/platform/revision/RevisionReader.test.ts \
  src/core/platform/execution/ExecutionTimelineReader.test.ts \
  tests/factory/produce-product-tool.test.ts \
  tests/factory/production-orchestrator.test.ts \
  tests/factory/qa-runtime.test.ts \
  tests/factory/revision-control-service.test.ts \
  tests/factory/stage-executors.test.ts \
  tests/factory/types.test.ts
```

Result: 25 test files passed, 164 tests passed, 2 expected skips.

Additional verification:

```bash
npm run typecheck
npm run lint
git diff --check
```

Result: typecheck passed, lint exited with 0 errors, and diff-check passed.
Lint still reports existing repository warnings outside this phase.

## Goal

Move software factory work orders, DAG stages, QA checkpoints, issue drafts,
evidence, and release artifacts behind the operation kernel so complex factory
requests are durable, inspectable, recoverable, and governed before execution.

This phase is not a rewrite of the factory engine. The existing factory planner,
orchestrator, repositories, stage executors, and revision services remain the
factory subsystem internals. The product-facing contract changes: user-facing
factory creation and revision must create or dispatch typed operation actions
first, then factory internals execute under that operation.

## Prior Phase Lessons Applied

- Phase 00 showed that complex requests fail when chat text, tool execution,
  runtime logs, and UI state are not all grounded in one durable execution
  model.
- Phase 01 and Phase 02 established `Operation`, `OperationStep`,
  `OperationAction`, `OperationArtifact`, and repository read models as the
  durable source of truth.
- Phase 03 proved that operation actions need one dispatch boundary with role,
  status, stale action, idempotency, and confirmation checks.
- Phase 04 added deterministic intent compilation. Factory intent already maps
  to `factory_work_order`, but the draft is still intentionally disabled until
  this phase supplies the executor.
- Phase 05 made prompt truth explicit. The assistant may describe factory state
  only from operation/read-model state, not from optimistic text.
- Phase 06 proved the migration pattern for dangerous work: typed action
  contracts, executor, reconciler, operation button projection, stale-action
  failure, and pruning of direct mutation paths.
- Phase 07 proved the anti-corruption pattern for existing deferred jobs:
  user-facing tools route through an operation launcher, while low-level job
  helpers remain executor internals only.

## Pre-Implementation Code Grounding

At grounding time, the factory code already had useful domain pieces, but they
were not operation-owned yet.

- `src/core/entities/operation.ts`
  - `factory_work_order` already exists as an operation kind.
- `src/core/use-cases/operations/OperationKindRegistry.ts`
  - `factory_work_order` is registered for `STAFF` and `ADMIN`, requires a
    conversation, uses handler key `factory.work_order`, and defaults to staff
    visibility.
- `src/core/use-cases/operations/OperationStatusMapping.ts`
  - Work order and stage status mapping already exists:
    `mapWorkOrderStatusToOperationStatus` and
    `mapStageRunStatusToOperationStepStatus`.
- `src/lib/operations/operation-intent-compiler.ts`
  - Deterministic factory language already compiles to
    `factory_work_order` intent.
- `src/core/use-cases/operations/OperationDraftFactory.ts`
  - Factory drafts currently emit a disabled generic `factory.work_order`
    action with `payloadSchemaKey: "none"` and the note that Phase 08 must
    register executors.
- `src/core/use-cases/operations/OperationActionPolicy.ts`
  - Only `factory.approve_stage` has a validator today. The create, pause,
    resume, refine, cancel, retry, and approve/release actions are missing.
- `src/lib/operations/operation-action-dispatch-root.ts`
  - Backup/restore and media operation executors are registered. Factory is not.
- `src/core/use-cases/tools/factory-production.tool.ts`
  - `produce_product` parses a `ProductBrief` and calls
    `ProduceProductDeferredJobHandler.handle(...)` directly through the tool
    path.
- `src/lib/factory/produce-product-deferred-job.ts`
  - The handler creates a `WorkOrder`, generates the DAG, saves it, runs
    `ProductionOrchestrator.execute(...)`, and returns release/composition
    output ids. It currently owns work-order creation directly.
- `src/lib/factory/production-orchestrator.ts`
  - The orchestrator handles runnable DAG stages, stage retries, stage events,
    checkpoints, pause handling, progress callbacks, and terminal status.
- `src/core/entities/work-order.ts`
  - `WorkOrder` tracks status, DAG, stage runs, execution log, paused state,
    user, conversation, and revisions. It has no operation link yet.
- `src/core/use-cases/FactoryRepository.ts`
  - Factory persistence supports work orders, DAGs, stage runs, outputs,
    checkpoints, and factory events. It does not yet support
    `findWorkOrderByOperationId`.
- `src/lib/factory/pause-work-order-service.ts`
  - Pause currently mutates factory state directly.
- `src/lib/factory/asset-refinement-service.ts`
  - Asset refinement currently mutates a paused work order/checkpoint directly.
- `src/lib/factory/resume-work-order-service.ts`
  - Resume currently prepares the frontier and calls the orchestrator directly.
- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`
  - Admin POST still accepts bespoke `pause`, `refine`, and `resume` actions and
    calls `getAgentPlatformFacade().reviseExecution(...)`.
- `src/core/platform/execution/ExecutionTimelineProjector.ts`
  - Work-order timelines currently expose bespoke `nextActions` with
    `kind: "factory"` instead of operation action buttons.
- `src/core/capability-catalog/runtime-tool-binding.ts`
  - The `produce_product` catalog binding still creates the direct factory
    production tool. This must become an operation launcher like Phase 07 media.

## Current Failure Mode

The factory subsystem can create and mutate durable factory records, but the
system can still present or execute factory work outside the operation kernel.
That creates the same class of problem seen in the backup/restore conversation:
chat can imply a governed sequence happened while the real state lives somewhere
else.

Five whys:

1. Why can the assistant overstate factory progress?
   - Because factory tool execution and chat narration are not forced through
     one operation state machine.
2. Why is there no single state machine?
   - Because `produce_product` and admin revision routes still call factory
     services directly.
3. Why do those services bypass operation policy?
   - Because factory actions do not yet have typed operation actions,
     validators, dispatchers, and stale-action semantics.
4. Why are UI buttons weak for factory work?
   - Because the work-order timeline projects bespoke factory actions instead
     of reusable operation actions with risk, confirmation, disabled reason, and
     status constraints.
5. Why is recovery hard after a failure?
   - Because factory events, outputs, checkpoints, and operation artifacts are
     not reconciled into one read model that chat, admin, diagnostics, and logs
     all share.

## Target Architecture

Factory operations use the same clean boundary as backup/restore and media:

1. User intent or tool request creates a `factory_work_order` operation.
2. Typed operation actions validate role, payload, stale state, confirmation,
   idempotency, and allowed status.
3. The factory operation executor calls factory internals.
4. A reconciler maps factory work order status, DAG stages, checkpoints, events,
   outputs, and release artifacts back to operation state.
5. Chat, admin pages, diagnostics, and buttons render only operation state.

### Boundaries

- Core operation contracts live under `src/core/use-cases/operations`.
- Factory execution adapters live under `src/lib/factory`.
- Operation dispatch registration lives in
  `src/lib/operations/operation-action-dispatch-root.ts`.
- The capability catalog and chat job routes call a factory operation launcher,
  not `ProduceProductDeferredJobHandler` directly. If `/api/chat/jobs` remains
  media-only, add an assertion that factory tools are not accepted there.
- Existing factory repository/orchestrator services remain domain internals.
  They must not know about React, chat UI, prompt text, or assistant narration.

## Operation Data Contract

Because this is greenfield, add an explicit operation link instead of preserving
legacy ambiguity:

- Add `operationId` to `WorkOrder`.
- Persist `operation_id` on `factory_work_orders`.
- Add an indexed repository lookup:
  `FactoryRepository.findWorkOrderByOperationId(operationId)`.
- New work orders created by Phase 08 require `operationId`.
- Operation artifacts reference factory outputs through stable resource refs:
  `factory_output`, `factory_release`, `factory_composition`,
  `factory_issue_draft`, and `factory_evidence`.

Do not add broad duplicate operation ids to every factory table unless a real
query requires it. Stage runs and outputs are reachable from the work order and
can be reconciled into deterministic operation step/artifact ids.

## Operation Lifecycle Contract

Factory operations must follow deterministic operation status transitions:

- Natural-language factory intent creates a `draft` operation.
- If the request cannot produce a complete `ProductBrief`, the operation remains
  `blocked` with missing-input details and no executable create action.
- `factory.work_order.create` creates the linked work order and moves the
  operation to `queued` or `running` before factory execution starts.
- A running work order keeps the operation `running`.
- A paused work order, failed stage checkpoint, missing executor, missing brief,
  or missing factory capability gate maps to `blocked`.
- A succeeded work order maps to `succeeded`.
- A canceled work order maps to `cancelled`.
- A work order that cannot be resumed and has no active corrective action maps
  to `failed`.

The operation status must not advance based on assistant text or optimistic
tool output. It advances only from repository writes and reconciler projection.

## Typed Actions

Create a dedicated action contract module, for example:

`src/core/use-cases/operations/FactoryWorkOrderOperationActions.ts`

The module owns action type constants, payload schemas, action creation helpers,
and validator registration. No stringly typed factory actions should remain in
routes or UI code.

Required action types:

- `factory.work_order.create`
  - Creates the work order from a validated `ProductBrief`.
  - Allowed from `draft` and `blocked`.
  - Requires `STAFF` or `ADMIN`.
  - Risk: `medium`.
  - Confirmation: single click for complete briefs; explicit confirmation if
    the action will publish externally or create GitHub issues.
- `factory.work_order.pause`
  - Requests a pause for a running work order.
  - Allowed from `running`.
  - Idempotent if the work order is already paused or pause has already been
    requested.
- `factory.work_order.refine_asset`
  - Applies an asset refinement to the active checkpoint.
  - Allowed from `blocked`.
  - Requires active checkpoint and a valid refinement mode:
    `metadata_fix`, `replace_with_upload`, or `regenerate`.
- `factory.work_order.resume`
  - Resumes from a checkpoint.
  - Allowed from `blocked`.
  - Requires the active checkpoint revision and optional stage frontier.
- `factory.work_order.retry_stage`
  - Retries a failed or blocked stage from a known stage key.
  - Allowed from `blocked` and `failed`.
  - Requires `stageKey`.
- `factory.work_order.cancel`
  - Cancels planned, running, or blocked factory work.
  - Allowed from `draft`, `running`, and `blocked`.
  - Requires explicit confirmation for running work.
- `factory.work_order.approve_checkpoint`
  - Approves a QA/release checkpoint before irreversible external action.
  - Allowed from `blocked`.
  - Requires checkpoint id/revision.

Payload validators must cover positive, negative, and edge cases:

- Missing or malformed `ProductBrief`.
- Unsupported target channel or output type.
- Missing `stageKey` for retry.
- Missing checkpoint for resume/refine/approve.
- Stale checkpoint revision.
- User file id required for `replace_with_upload`.
- Cancel requested after terminal status.

## Product Brief Rules

The current `produce_product` tool already requires a structured
`ProductBrief`. Keep that strictness.

- The intent compiler may create a `factory_work_order` draft from natural
  language.
- Execution must not call the factory handler with raw text.
- If the draft lacks a complete `ProductBrief`, the operation becomes
  `blocked` with a required-information action or assistant prompt.
- Once the brief is complete, `factory.work_order.create` becomes enabled.

This prevents the model from improvising a vague software factory run.

## Role And Prompt Exposure Contract

The current `produce_product` catalog entry lives in the admin capability
family, while `factory_work_order` in `OperationKindRegistry` allows `STAFF`
and `ADMIN`. Phase 08 must make this explicit:

- Factory operation actions allow `STAFF` and `ADMIN` through the operation
  kind registry.
- If `produce_product` remains in the capability catalog, update
  `src/core/capability-catalog/families/admin-capabilities.ts` and
  `src/core/capability-catalog/catalog-input-schemas.ts` so the description and
  result contract say it returns an operation projection, not a completed
  factory release.
- Add `produce_product` to `OPERATION_BACKED_CHAT_EXCLUDED_TOOLS` in
  `src/lib/chat/tool-capability-routing.ts` if natural-language factory
  requests are handled by operation intent instead of direct prompt-visible
  tools.
- User-facing chat should expose factory execution through operation action
  buttons rendered by the existing operation action UI, not through free-form
  "say yes" or "say fire it" text.
- Staff/admin access should be tested through both the generic operation action
  API and the factory admin surface.

## Executor And Reconciler

Add factory operation integration modules:

- `src/lib/factory/factory-work-order-operation-launcher.ts`
  - Anti-corruption launcher for catalog/chat/API entry points.
  - Creates or updates a `factory_work_order` operation.
  - Returns operation projection and buttons, not low-level factory output.
- `src/lib/factory/factory-work-order-operation-executor.ts`
  - Handles typed factory operation actions.
  - Calls `DAGPlanner`, `FactoryRepository`, `ProductionOrchestrator`,
    `PauseWorkOrderService`, `AssetRefinementService`,
    `ResumeWorkOrderService`, and new cancel/retry services as needed.
  - Never writes assistant messages directly.
  - Does not claim a running work order is canceled until the durable work order
    has reached `canceled`.
  - If `ProduceProductDeferredJobHandler` remains as an internal adapter,
    extend its payload to require `operationId`; it must reject operation-less
    work-order creation.
- `src/lib/factory/factory-work-order-operation-reconciler.ts`
  - Maps work-order state to operation status.
  - Maps DAG stages and stage runs to operation steps.
  - Maps factory outputs to operation artifacts.
  - Maps checkpoints to blocked operation actions.
  - Emits deterministic, idempotent operation events.

Register the executor and reconciler in:

- `src/lib/operations/operation-action-dispatch-root.ts`
- `src/lib/operations/operation-intent-root.ts`

### Running Cancellation

Current factory execution does not expose a durable abort controller outside the
orchestrator call. Do not fake immediate cancellation for running stages.

Implement cancellation in two levels:

- Planned or paused work orders may be marked `canceled` immediately.
- Running work orders append a durable `revision_cancel_requested` factory
  event. The orchestrator must check that event before starting each stage and
  after each stage completes. If an active abort handle is introduced, it may
  abort the current stage, but the operation remains `running` or `blocked`
  until reconciliation sees the work order status become `canceled`.

This avoids the restore-pipeline class of bug where the UI says an irreversible
operation completed before the underlying state proves it.

## Stage And Artifact Projection

Use existing mappings from `OperationStatusMapping` as the canonical status
translation.

- DAG stage keys become operation step ids derived from
  `{operationId}:{stageKey}`.
- Stage run records update the matching operation step status.
- Factory events append operation events with stable source ids.
- Factory outputs append artifacts with stable source ids.
- Checkpoints set the operation to `blocked` and expose the correct next
  actions.
- Release, GitHub issue draft, QA report, composition, and media outputs are
  operation artifacts, not free text.

The assistant can summarize those artifacts only after reconciliation.

## User-Facing Surface Changes

### Capability Catalog

Replace the direct `produce_product` runtime binding with the launcher:

- Keep `ProductBrief` parsing at the boundary.
- Create or dispatch the factory operation.
- Return operation status and action buttons.
- Do not call `ProduceProductDeferredJobHandler.handle(...)` from catalog or
  chat user-facing paths.
- If the tool descriptor remains `executionMode: "deferred"`, ensure the
  deferred wrapper does not enqueue the old factory job. The observable result
  must still be the operation snapshot/projection.
- Update catalog descriptions that currently promise `workOrderId`,
  `releaseId`, `compositionId`, and output ids for a completed run.

### Admin Routes

Update `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`:

- GET may continue to return the timeline/read model.
- POST must dispatch typed operation actions using the same request contract as
  `/api/operations/[operationId]/actions/[actionId]`: `operationRevision`,
  `idempotencyKey`, optional `payload`, and optional `confirmation`.
- Remove direct `getAgentPlatformFacade().reviseExecution(...)` mutation for
  pause/refine/resume.
- Buttons should carry operation action ids, not bespoke `kind: "factory"`.

### Timeline Projection

Update `ExecutionTimelineProjector` so factory next actions are operation
actions. Bespoke factory action projection should be removed or reduced to a
read-only timeline without mutation buttons during the migration.

## Pruning Rules

Remove or restrict these direct user-facing paths:

- Direct catalog execution of `createProduceProductTool(...)`.
- Direct `ProduceProductDeferredJobHandler.handle(...)` calls from routes,
  catalog bindings, or UI-facing use cases.
- Direct admin revision mutation through `AgentPlatformFacade.reviseExecution`
  for factory pause/refine/resume.
- `ExecutionTimelineNextAction` values with `kind: "factory"` when a matching
  operation action exists.
- The disabled placeholder action in `OperationDraftFactory`.
- Factory operation actions using `payloadSchemaKey: "none"`.

Keep these internals:

- `ProduceProductDeferredJobHandler` as an executor-internal adapter if useful.
- `ProductionOrchestrator`.
- `DAGPlanner`.
- `FactoryRepository`.
- Factory event/output/checkpoint tables.
- Stage executor registry and default stage services.

## Files To Update

Core operation contracts:

- `src/core/use-cases/operations/FactoryWorkOrderOperationActions.ts`
- `src/core/use-cases/operations/FactoryWorkOrderOperationActions.test.ts`
- `src/core/use-cases/operations/OperationActionPolicy.ts`
- `src/core/use-cases/operations/OperationActionPolicy.test.ts`
- `src/core/use-cases/operations/OperationDraftFactory.ts`
- `src/core/use-cases/operations/OperationDraftFactory.test.ts`
- `src/core/use-cases/operations/OperationStatusMapping.test.ts`

Factory operation integration:

- `src/lib/factory/factory-work-order-operation-launcher.ts`
- `src/lib/factory/factory-work-order-operation-launcher.test.ts`
- `src/lib/factory/factory-work-order-operation-executor.ts`
- `src/lib/factory/factory-work-order-operation-executor.test.ts`
- `src/lib/factory/factory-work-order-operation-reconciler.ts`
- `src/lib/factory/factory-work-order-operation-reconciler.test.ts`
- `src/lib/factory/cancel-work-order-service.ts`
- `src/lib/factory/retry-work-order-stage-service.ts`

Persistence and entities:

- `src/core/entities/work-order.ts`
- `src/core/use-cases/FactoryRepository.ts`
- `src/adapters/FactoryDataMapper.ts`
- `src/adapters/FactoryDataMapper.test.ts`
- `src/adapters/RepositoryFactory.ts`
- `src/lib/db/tables.ts`
- `src/lib/db/migrations.ts`

Surface migration:

- `src/core/capability-catalog/families/admin-capabilities.ts`
- `src/core/capability-catalog/catalog-input-schemas.ts`
- `src/core/capability-catalog/runtime-tool-binding.ts`
- `src/core/capability-catalog/runtime-tool-binding.test.ts`
- `src/lib/chat/tool-capability-routing.ts`
- `src/app/api/chat/jobs/route.ts` if factory job submission is supported
  there; otherwise add tests proving it remains media-only.
- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`
- `src/app/api/operations/[operationId]/actions/[actionId]/route.ts`
- `src/core/platform/execution/ExecutionTimelineProjector.ts`
- Any factory admin component that renders bespoke factory actions.

Architecture guardrails:

- Add a factory operation architecture guardrail test under
  `src/lib/factory`.
- The guardrail must fail if user-facing catalog/routes import
  `createProduceProductDeferredJobHandler`, `ProduceProductDeferredJobHandler`,
  or direct factory revision services.

## Required Tests

Positive tests:

- Natural-language factory request compiles to `factory_work_order`.
- Complete `ProductBrief` creates a `factory_work_order` operation and then a
  linked `WorkOrder`.
- Incomplete `ProductBrief` creates a blocked operation and does not create a
  work order.
- DAG stages project to operation steps.
- Stage success/failure/retry updates operation steps and status.
- Factory outputs project to operation artifacts.
- Pause, refine, resume, retry, cancel, and approve checkpoint actions dispatch
  through operation action dispatch.
- Catalog `produce_product` returns operation projection/buttons.
- Catalog `produce_product` metadata no longer promises completed release ids.
- Prompt-visible tools exclude `produce_product` when operation intent is the
  factory entry point.
- Admin revision route dispatches operation actions.

Negative tests:

- Incomplete brief blocks execution and asks for missing information.
- Direct stale action id fails safely.
- Pause after terminal status is rejected.
- Resume without active checkpoint is rejected.
- Refinement without required uploaded file is rejected.
- Retry without `stageKey` is rejected.
- Cancel after terminal status is rejected.
- Non-staff/non-admin user cannot create or revise a factory operation.
- Missing factory executor/gate turns into blocked operation state, not chat
  hallucination.

Edge tests:

- Idempotent create does not create duplicate work orders for the same
  operation/action id.
- Duplicate factory events do not duplicate operation events.
- Duplicate outputs do not duplicate operation artifacts.
- Stage retry preserves prior failed evidence and creates a new stage attempt
  event/artifact trail.
- Resume with stale checkpoint revision is rejected.
- Work order already paused returns an idempotent paused response.
- Running cancel request does not mark the operation terminal until the durable
  work order reaches `canceled`.
- Planned or paused cancel marks the durable work order and operation
  `canceled`/`cancelled` without calling the orchestrator.

Guardrail tests:

- User-facing catalog/routes cannot import direct factory deferred handlers.
- Admin factory mutation routes cannot import direct pause/refine/resume
  services.
- `OperationDraftFactory` no longer emits disabled placeholder factory actions.
- Factory operation actions never use `payloadSchemaKey: "none"`.
- Bespoke `kind: "factory"` next actions are not projected when operation
  actions exist.
- `produce_product` is not available as a prompt-visible direct tool when the
  deterministic operation intent path owns factory requests.

## Verification Commands

Run the focused suite first:

```bash
npx vitest run \
  src/core/use-cases/operations/FactoryWorkOrderOperationActions.test.ts \
  src/core/use-cases/operations/OperationActionPolicy.test.ts \
  src/core/use-cases/operations/OperationDraftFactory.test.ts \
  src/lib/factory/factory-work-order-operation-launcher.test.ts \
  src/lib/factory/factory-work-order-operation-executor.test.ts \
  src/lib/factory/factory-work-order-operation-reconciler.test.ts \
  src/core/capability-catalog/runtime-tool-binding.test.ts
```

Then run the broader checks:

```bash
npm run typecheck
npm run lint
git diff --check
```

Also run guardrail searches:

```bash
rg -n "createProduceProductDeferredJobHandler|ProduceProductDeferredJobHandler|executeProduceProduct" \
  src/core/capability-catalog src/app src/frameworks/ui src/components

rg -n "getAgentPlatformFacade\\(\\)\\.reviseExecution|kind: \"factory\"" \
  src/app src/core src/lib src/components
```

The first search should have no user-facing matches. The second search should
have no factory mutation/action matches except explicitly documented read-only
compatibility code. The `payloadSchemaKey: "none"` factory-action rule should
be enforced by the action contract unit tests because that literal is valid for
some unrelated low-risk operations.

## Exit Criteria

- Factory work-order creation and revision are operation-first.
- Every user-visible factory action is a typed operation action with role,
  status, stale-action, idempotency, payload validation, and risk metadata.
- `produce_product` no longer executes the factory handler directly from the
  capability catalog or chat route.
- Factory admin pause/refine/resume/cancel/retry routes dispatch operation
  actions.
- Work orders are linked to operation ids.
- DAG stages, checkpoints, factory events, outputs, issue drafts, QA reports,
  and releases are reconciled into operation steps/artifacts/events.
- Chat and admin surfaces render operation state and action buttons.
- Direct legacy mutation paths are pruned or restricted to executor internals.
- Positive, negative, edge, and guardrail tests pass.
- Typecheck, lint, and `git diff --check` pass.

## Non-Goals

- Do not replace the factory DAG planner in this phase.
- Do not rewrite all stage executors.
- Do not introduce a database server or external queue.
- Do not move the factory orchestrator into Rust in this phase.
- Do not make the LLM the authority for operation state. LLMs may draft,
  summarize, and ask for missing information; deterministic operation code owns
  state and execution.
