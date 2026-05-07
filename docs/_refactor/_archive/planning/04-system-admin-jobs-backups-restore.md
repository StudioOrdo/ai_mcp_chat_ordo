# Spec 04: System, Admin, Jobs, Backups, And Restore

Status: Draft spec

Evidence date: 2026-05-05

## Problem

The system/admin area has strong capabilities but inconsistent UX.

The owner-facing shell should keep admin diagnostics separate and orderly.
The admin/system surfaces should still follow the same second-column and detail
pattern as People and Studio.

Backups and restore are especially important because they prove appliance-grade
reliability. They need a first-class System section with a table of backups and
clear restore actions.

## Current Code Anchors

Admin overview:

- `src/app/admin/page.tsx`

System:

- `src/app/admin/system/page.tsx`
- `src/app/admin/system/keys/page.tsx`
- `src/app/admin/system/tools/page.tsx`
- `src/app/admin/system/operations/page.tsx`

Jobs:

- `src/lib/admin/jobs/admin-jobs.ts`
- `src/lib/admin/jobs/admin-jobs-routes.ts`
- `src/frameworks/ui/jobs-rail/useJobsRailController.ts`

Backups/restore:

- `src/app/admin/system/backups/page.tsx`
- `src/app/admin/system/backups/BackupSelfServiceManager.tsx`
- `src/lib/appliance/backup/*`
- `src/app/api/admin/system/backups/*`
- `src/app/api/admin/system/restore-plans/*`
- `crates/ordo-backup/src/command.rs`
- `crates/ordo-backup/src/command_store.rs`
- `crates/ordo-backup/src/daemon.rs`
- `crates/ordo-backup/src/backup_executor.rs`
- `crates/ordo-backup/src/restore_executor.rs`
- `crates/ordo-backup/src/audit.rs`
- `crates/ordo-backup/src/native_contract.rs`

## Target Admin Navigation

Left rail admin group:

- Admin
- Jobs
- System

Rules:

- Rename visible `Factory` to `Jobs`.
- Keep lower-level operation/factory names internal where useful.
- Admin and System remain role-gated.
- Owner surfaces never need raw Jobs/Operations/Logs as primary navigation.

## Target System Sections

System second column:

1. Overview
2. Health
3. Providers
4. Capabilities
5. Visibility
6. Prompts
7. Backups
8. Restore Plans
9. Jobs
10. Operations
11. Logs
12. Keys

MVP section list can include:

1. Overview
2. Health
3. Providers
4. Capabilities
5. Backups
6. Restore Plans
7. Jobs
8. Operations
9. Keys

## System Brief

`/admin/system` base route shows a System Brief:

- health status,
- provider/capability status,
- backup readiness,
- failed jobs,
- security/config warnings,
- one obvious next action.

This brief can summarize diagnostics because it is an admin-only surface.

## Backups Section

`/admin/system?section=backups` or `/admin/system/backups` should present:

- Create Backup action,
- backup policy summary,
- backup readiness/status,
- backups table,
- selected backup detail.

Backups table columns:

- Backup
- Created
- Status
- Kind
- Version
- Size
- Validated
- Actions

Actions:

- Validate
- Prepare restore
- View detail

Rules:

- Destructive restore actions must not be inline row actions.
- Restore preparation can be row action.
- Restore execution requires restore-plan detail view and confirmation flow.

## Restore Plans Section

Restore plan detail shows:

- selected backup,
- restore plan status,
- confirmation phrase,
- safety backup state,
- execute restore action,
- cancel action,
- warnings about replacement of current business data.

Flow:

1. Prepare restore from backup.
2. View restore plan.
3. Type confirmation phrase.
4. Confirm plan.
5. Create safety backup.
6. Execute restore.
7. Show result and evidence.

No restore execution without:

- admin permission,
- confirmation phrase,
- safety backup where policy requires it,
- explicit destructive warning.

## Backup/Restore Architecture Pattern To Reuse

Backups and restore are the strongest current model for durable background
work.

The pattern:

1. TypeScript creates a durable command row.
2. The command payload carries schema/version, data boundary, operation
   metadata, and required inputs.
3. Rust claims the command with a lease and recovers expired running commands.
4. Rust validates the payload before touching data.
5. Rust stages work in a bounded filesystem location.
6. Rust writes audit events at start, success, and failure.
7. Rust records artifacts and metrics in a structured native command result.
8. TypeScript reconciles terminal command state back into operation steps,
   artifacts, actions, and user-visible status.

The brief generation system should copy this shape even if the first executor
is TypeScript:

- create a durable brief update request,
- validate section/object/evidence payloads,
- stage a draft brief,
- attach evidence references and metrics,
- emit audit/activity events,
- reconcile the result into the section or object read model,
- preserve the previous brief if generation fails.

For high-risk or local-file-heavy brief jobs, Rust can later become the
executor the same way it is for backups.

## Jobs Section

`Jobs` should be the user-visible admin name for queue and background work.

Jobs section includes:

- queued,
- running,
- failed,
- retryable,
- worker status,
- recent failures,
- links to raw logs/details for admin.

Owner surfaces should translate jobs into:

- work in motion,
- needs review,
- blocked,
- produced,
- provenance/history.

## Acceptance Criteria

- System/Admin uses second-column selector plus main detail pattern.
- System includes Backups and Restore Plans sections.
- Backups render as a table/list with validate and prepare restore actions.
- Restore plan requires explicit confirmation and safety backup flow.
- `Factory` is not visible in top-level admin nav; visible label is Jobs.
- System remains role-gated.

## Tests

Positive:

- admin sees System sections including Backups and Restore Plans.
- admin can open Backups section from second column.
- backups table renders recent backups.
- eligible backup exposes validate and prepare restore.
- restore plan detail requires confirmation phrase.
- safety backup action is required before execute when applicable.
- Rust-backed command results reconcile into operation steps and artifacts.
- System brief can summarize backup readiness from command/snapshot/plan state.

Negative:

- non-admin cannot access System/Backups/Restore Plans.
- restore execute is disabled until confirmation requirements are met.
- owner Today/Studio surfaces do not expose raw backup/restore diagnostics.
- brief generation cannot bypass evidence validation or overwrite a prior
  brief on failure.

Edge:

- no backups exist state gives create-backup next action.
- backup validation failure shows admin-visible error.
- restore plan failure shows state and safe recovery actions.
- expired running commands reconcile to a visible admin failure without
  corrupting owner surfaces.
