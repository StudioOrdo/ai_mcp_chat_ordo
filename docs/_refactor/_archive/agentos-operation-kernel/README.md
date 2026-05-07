# AgentOS Operation Kernel Refactor

Status: Implemented through Phase 11 closeout on 2026-05-03
Reference package: `docs/_refactor/appliance-lifecycle-proof`

## Purpose

This package turned Ordo from a chat application with capable subsystems into an
AgentOS appliance with one canonical operation kernel for complex work.

The implementation contract is now:

1. compile complex intent into a typed operation or a clarifying question,
2. expose next actions as operation buttons,
3. execute deterministic state transitions through the operation dispatcher,
4. persist events, steps, actions, artifacts, and read models in SQLite,
5. project the current operation truth back into chat, admin, health, and help,
6. keep Rust behind structured native command/result contracts.

The conversation is a projection of operation truth. It is not the source of
truth for work that changes state, needs confirmation, produces artifacts, or
can fail asynchronously.

## Implemented Kernel

Current implementation grounding:

- Operation domain: `src/core/entities/operation.ts`
- State and policy: `src/core/use-cases/operations/*`
- SQLite mapper and repository: `src/adapters/OperationDataMapper.ts`,
  `src/lib/db/migrations.ts`, `src/lib/db/tables.ts`
- Operation APIs: `src/app/api/operations/**`
- Action dispatch root: `src/lib/operations/operation-action-dispatch-root.ts`
- Intent and prompt grounding: `src/lib/operations/operation-intent-*`,
  `src/lib/operations/operation-prompt-grounding*`
- Operation cards/buttons: `src/frameworks/ui/operations/*`,
  `src/frameworks/ui/RichContentRenderer.tsx`
- Backup/restore migration: `src/lib/appliance/backup/*`,
  `src/lib/appliance/native/*`, `crates/ordo-backup/src/native_contract.rs`
- Media migration: `src/lib/media/workflows/media-workflow-operation-*`
- Factory migration: `src/lib/factory/factory-work-order-operation-*`
- Help/onboarding: `src/lib/operations/help-flow-operation.ts`,
  `src/lib/operations/onboarding-flow-operation.ts`
- Role-gated handbook: `docs/_corpus/system-docs`
- Appliance image/runtime contracts: `Dockerfile`, `compose.yaml`,
  `scripts/start-server.mjs`, release and lifecycle tests.

## Architecture Principles

- SOLID: operation policy, state, persistence, execution, presentation, and
  native execution are separate responsibilities.
- Clean Architecture: domain contracts live in `src/core`; Next, React, SQLite,
  feature adapters, and Rust are outer layers.
- GoF patterns:
  - Command: `OperationAction`
  - State: `OperationStateMachine`
  - Strategy: operation executors selected by action type/kind
  - Adapter: backup, media, factory, corpus, Docker, and Rust boundaries
  - Observer/projection: chat, admin, health, docs, and logs read operation truth
- DRY: backup, restore, media, factory, help, and onboarding share the same
  confirmation, action, event, artifact, and stale-button contracts.

## Residual Scope

The following operation kinds are registered but not yet full feature
migrations:

- `system_diagnostic`
- `tool_task`
- `content_publish`

Scheduled automatic backups are an explicit operation-null exception for this
package: policy and health are operation-aware, but the scheduler command itself
is not yet represented as an operation. That exception is documented for a
future migration and is not a prompt-visible user action.

## Package Contents

- `contract-spec.md`: implemented product and engineering contract.
- `phase-plan.md`: implemented dependency-ordered phase history.
- `validation-checklist.md`: final QA checklist and evidence pointers.
- `systemic-audit.md`: closed architectural audit and residual backlog.
- `qa-review.md`: closeout QA status.
- `rust-strategy-addendum.md`: implemented Rust boundary and future candidates.
- `phases/`: implementable phase specs and implementation status.
- `evidence/`: baseline and closeout evidence captured during implementation.

## Net Result

Ordo now has a real AgentOS operation layer for complex work:

- The model can suggest, explain, or classify intent, but it cannot make work
  true by saying it happened.
- Buttons execute typed operation actions, not synthetic chat text.
- Complex requests have durable state, role policy, idempotency, events,
  artifacts, and stale-action safety.
- Chat, `/operations`, admin operations, feature workspaces, health, and docs
  read from the same operation truth.
- Rust handles deterministic native backup/restore execution behind a narrow
  command/result boundary.
- The single Docker image remains the deployment unit.
