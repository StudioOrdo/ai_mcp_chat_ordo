# AgentOS Operation Kernel Phase Plan

Status: Phases 00 through 11 implemented and closeout-grounded on 2026-05-03

## Phase Sequence

1. `00-baseline-evidence.md`
   Captured current chat, job, backup, media, factory, Docker, Rust, corpus, and
   operation evidence before implementation.

2. `01-operation-kernel-contract.md`
   Implemented domain types, state machine, policies, and kind registry.

3. `02-operation-storage-and-read-models.md`
   Implemented SQLite operation tables, repositories, mappers, and read models.

4. `03-operation-action-dispatch.md`
   Replaced fragile text action execution with typed operation actions,
   role-gated API dispatch, stale-action safety, and evidence events.

5. `04-intent-compiler-and-router.md`
   Added validated intent compilation/routing for operation drafts,
   clarifying questions, and deterministic routing.

6. `05-chat-grounding-and-prompt-truth.md`
   Added operation state and tool evidence grounding so chat cannot lose active
   operation truth.

7. `06-backup-restore-operation-migration.md`
   Migrated backup/restore self-service onto operation actions and native result
   reconciliation.

8. `07-media-workflow-operation-migration.md`
   Projected media workflows and media worker state through operations.

9. `08-factory-work-order-operation-migration.md`
   Projected factory work orders, stages, retry/refinement, and outputs through
   operations.

10. `09-admin-and-conversation-operation-surfaces.md`
    Built operation-backed conversation/admin/workspace surfaces plus role-gated
    help and onboarding flows with operation buttons.

11. `10-rust-runtime-boundary-expansion.md`
    Hardened the Rust backup executor boundary with native command/result
    contracts, reconciliation, binary registry checks, and release gates.

12. `11-qa-docs-and-product-closeout.md`
    Updates package docs, hardens the system handbook, records closeout
    evidence, and runs the full operation-kernel QA matrix.

## Dependency Rules

- Phase 03 depends on Phase 01 and 02.
- Phase 04 depends on Phase 01 through 03.
- Phase 05 depends on Phase 01 through 04.
- Phases 06 through 08 depend on Phase 05.
- Phase 09 depends on migrated operation families from Phases 06 through 08.
- Phase 10 depends on Phase 02 and writes native results through TypeScript
  operation reconciliation.
- Phase 11 depends on every prior implementation phase.

## Residual Backlog

The package intentionally leaves these as named future operation migrations:

- `system_diagnostic`
- `tool_task`
- `content_publish`
- scheduled automatic backup operation records

## Implementation Posture

This was greenfield work. The implemented posture is one clean operation model,
small adapters where source subsystems still own detail records, and explicit
pruning pressure against obsolete text-command or subsystem-specific action
paths.
