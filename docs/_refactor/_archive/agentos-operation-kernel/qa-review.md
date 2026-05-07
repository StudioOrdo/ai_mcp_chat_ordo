# AgentOS Operation Kernel QA Review

Status: Phase 11 closeout implemented on 2026-05-03; final command evidence is
recorded in `evidence/phase-11-closeout.md`

## Package QA Gate

The operation kernel package is closed when the Phase 11 matrix passes and the
closeout evidence distinguishes passed tests, intentional exceptions, warnings,
and residual backlog.

The package now has:

- a canonical operation domain and state machine,
- SQLite operation storage and read models,
- typed action dispatch and stale-action safety,
- intent compilation and prompt grounding,
- operation-backed backup/restore, media, factory, help, and onboarding flows,
- operation cards/buttons across chat and workspace surfaces,
- role-gated system handbook documentation,
- Rust native command/result reconciliation for backup/restore,
- single-image appliance runtime and release checks.

## Closed Findings

### F1: Operation state is not canonical yet

Status: Closed for implemented operation families.

Backup/restore, media workflows, factory work orders, help, and onboarding now
project complex user-visible work through operation state. Registered future
kinds remain documented backlog, not hidden claims.

### F2: Backend prompt grounding loses tool evidence

Status: Closed for operation-backed flows.

Operation state and relevant tool evidence are injected through the operation
prompt grounding layer. The assistant is expected to summarize from operation
truth, not lost chat context.

### F3: Some buttons are not real commands

Status: Closed for operation-backed actions.

High-risk and multi-step workflows use `OperationAction` records and typed API
dispatch. Phase 11 guardrails search for synthetic chat text paths and classify
remaining matches.

### F4: Existing subsystems have useful state but separate contracts

Status: Closed for migrated families; residual backlog named.

Backup/restore, media, and factory systems keep their detailed source records
but project user-visible truth into operations.

### F5: Rust integration belongs behind operations, not ad hoc paths

Status: Closed for backup/restore native execution.

Rust emits structured native command results and TypeScript reconciles them into
operation events/artifacts/status. Rust does not own product policy or write the
operation ledger directly.

## Residual Backlog

These are not Phase 11 defects:

- `system_diagnostic`: registered operation kind, future full migration.
- `tool_task`: registered operation kind, future full migration.
- `content_publish`: registered operation kind, future full migration.
- Scheduled automatic backups: documented operation-null exception until a
  future scheduler-operation migration.
- Lint warnings: accepted only if `npm run lint` exits with zero errors and the
  warning count is recorded in closeout evidence.

## QA Exit Criteria

- Final test matrix results are recorded.
- Package docs match implemented code.
- Role-gated handbook tests cover every role.
- Guardrail searches produce no unclassified unsafe hits.
- No open high-severity findings remain.
