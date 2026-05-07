# Systemic Audit

Status: Initial architectural audit closed by the AgentOS operation kernel
package on 2026-05-03

## Summary

The original systemic problem was not backup, media, factory, tools, or chat in
isolation. The problem was that complex work could be represented as model text,
job rows, subsystem records, tool results, UI cards, logs, or disk state without
one canonical product truth.

The operation kernel fixes the architecture by making durable operations the
shared source of truth for complex work.

## Closed Structural Problems

### 1. No universal durable operation

Closed for implemented families. `backup_create`, `restore_execute`,
`media_workflow`, `factory_work_order`, `help_flow`, and `onboarding_flow` now
share operation state, actions, events, artifacts, read models, and UI
projection.

### 2. Tool truth is persisted but not reliably replayed

Closed for operation-backed flows. Operation prompt grounding injects current
operation state and relevant tool evidence into backend model context.

### 3. UI actions can degrade into text prompts

Closed for operation-backed actions. Operation buttons dispatch typed actions
through the API/action-dispatch path. Destructive work cannot rely on chat text
as the execution trigger.

### 4. Existing ledgers are good but isolated

Closed for migrated families. Backup, media, and factory retain detailed source
records where useful, but user-visible truth projects into operation state.

### 5. Rust boundary is useful but narrow

Closed for backup/restore. Rust is now a deterministic native executor behind
typed command/result contracts and TypeScript reconciliation.

## Current Strengths

- Unified operation domain in `src/core/entities/operation.ts`.
- SQLite operation ledger and read models.
- Typed action policy and dispatch.
- Intent compiler/router and prompt grounding.
- Operation-backed rich content cards and buttons.
- Role-gated system handbook in `docs/_corpus/system-docs`.
- Operation migrations for backup/restore, media, factory, help, and onboarding.
- Rust backup/restore executor with structured native result reconciliation.
- Single-image appliance runtime and release verification contracts.

## Residual Backlog

The following remain known future migrations, not hidden architecture defects:

- `system_diagnostic`
- `tool_task`
- `content_publish`
- scheduled automatic backup operations

These should use the same operation contract when implemented.

## Greenfield Rule Going Forward

Do not add new complex work paths as standalone chat actions, one-off job rows,
or subsystem-only state. New complex work must enter through the operation
kernel or explicitly document why it is read-only, diagnostic, or outside the
operation contract.
