# AgentOS Operation Kernel Contract Spec

Status: Implemented and closeout-grounded on 2026-05-03

## Product Contract

Every complex Ordo request must become a durable operation before execution, or
the system must ask a clarifying question and avoid execution.

A complex request is any request that:

- changes files, data, configuration, backups, media, users, providers, tools, or
  published content,
- requires more than one step,
- needs confirmation,
- produces artifacts,
- can fail asynchronously,
- should survive refresh, restart, or model context loss.

The conversation, admin UI, operation workspaces, health surfaces, and docs are
projections of operation truth. They are not independent sources of truth.

## Non-Negotiables

1. The LLM may classify intent and draft plans, but deterministic code owns
   operation creation, validation, authorization, state transitions, execution,
   reconciliation, and audit.
2. Dangerous or multi-step actions must be invoked through typed operation
   actions, not by sending text such as `fire it` or `Create safety backup...`.
3. Current operation state and relevant tool evidence must be injected into
   prompt grounding so the assistant cannot lose the active truth.
4. Operation state must be visible from chat, `/operations`, admin surfaces,
   health, events, artifacts, and logs.
5. A stale, disabled, expired, unauthorized, or malformed button click fails
   safely with current-state evidence.
6. A missing provider, disabled tool, failed executor, or unavailable Rust binary
   becomes operation and health state, not a hallucinated success message.
7. The system remains a single-image appliance with SQLite and local file
   storage as the default substrate.

## Canonical Domain Model

The canonical fields, status lists, risk levels, visibility levels,
confirmation policies, and event types are defined in:

- `src/core/entities/operation.ts`
- `src/core/use-cases/operations/OperationKindRegistry.ts`

Implemented operation kinds:

- `backup_create`
- `restore_execute`
- `media_workflow`
- `factory_work_order`
- `onboarding_flow`
- `help_flow`

Registered future or partially migrated operation kinds:

- `system_diagnostic`
- `tool_task`
- `content_publish`

Those future kinds are valid domain vocabulary, but Phase 11 closeout does not
claim full end-to-end product migration for them.

## Storage Contract

SQLite operation truth lives in:

- `operations`
- `operation_steps`
- `operation_events`
- `operation_actions`
- `operation_artifacts`

The mapper/repository boundary is:

- `src/adapters/OperationDataMapper.ts`
- `src/core/use-cases/operations/OperationRepository.ts`
- `src/core/use-cases/operations/OperationReadModel.ts`

Feature-specific records such as backups, media workflows, factory work orders,
jobs, and native commands may retain their own operational details, but complex
user-facing truth must project into the operation ledger.

## State Contract

Allowed operation statuses:

- `draft`
- `awaiting_confirmation`
- `queued`
- `running`
- `blocked`
- `succeeded`
- `failed`
- `cancelled`
- `expired`

Allowed step statuses:

- `pending`
- `ready`
- `running`
- `blocked`
- `succeeded`
- `failed`
- `skipped`
- `cancelled`

State transitions are centralized in `OperationStateMachine` and repository
methods that append evidence events. UI components, prompts, API routes, workers,
and Rust executors must not infer independent status rules.

## Action Contract

`OperationAction` is the only supported path for user-visible operation
transitions.

Action policy enforces:

- role authorization,
- operation revision,
- operation status,
- action expiry,
- disabled state,
- confirmation policy,
- payload schema,
- idempotency key.

Operation cards and admin/workspace buttons post to:

- `POST /api/operations/:operationId/actions/:actionId`

They do not send synthetic chat text for execution.

## Intent Compiler Contract

The intent compiler may use an LLM, but its output is not trusted until schema
validation and deterministic routing pass.

Required behavior:

- create operation drafts for recognized complex requests,
- ask clarifying questions for ambiguous requests,
- reject unsafe or unauthorized requests,
- never execute actions directly.

## Chat Projection Contract

Operation-backed assistant messages are renderable from:

- operation state,
- available actions,
- latest events,
- artifacts,
- role-gated visibility rules.

Message text may summarize state, but the state lives in the operation ledger.
Primary actions render as visible operation buttons.

## Rust Boundary Contract

Rust is a deterministic executor boundary, not a second product brain.

Implemented boundary:

- TypeScript creates operation-aware native commands.
- `ordo-backup` validates backup/restore payloads and emits structured JSON.
- Rust result payloads follow `NativeCommandResult`.
- `native-result-reconciler` appends `executor_event_received`, artifacts,
  status updates, and error evidence into the TypeScript-owned operation ledger.

Rust does not write `operations`, `operation_steps`, or `operation_events`
directly.

Future Rust expansion should remain narrow: hard-state local I/O, resource
probes, image verification, media probing, and deterministic runtime guardrails.

## Documented Exception

Scheduled automatic backups remain the operation-null exception at closeout.
The backup policy and health surfaces are documented and tested, but the
scheduler command itself does not yet create a `backup_create` operation. This
is acceptable only because it is not a prompt-visible user action and is recorded
as future backlog.

## Greenfield Pruning Contract

When an operation-backed replacement exists and tests pass, remove or collapse:

- duplicate workflow-specific confirmation paths,
- text-only action paths for dangerous actions,
- obsolete command names,
- prompt-visible mutation tools that bypass operation launchers,
- direct UI flows that bypass operation state.

Retain only read-only diagnostics, tests that prove old paths are rejected,
greenfield migration scaffolding, and the documented scheduled-backup exception.
