# Phase 01c3ak: System Admin, Jobs, Backups, And Restore Sections

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3ae-shared-governance-section-framework.md`
- `01c3ad-chat-first-shell-grid-and-mobile-menu.md`
- `docs/_refactor/planning/04-system-admin-jobs-backups-restore.md`
- `docs/_refactor/planning/10-brief-executor-pattern-from-rust-backup-restore.md`

Blocks:

- `01c3an-brief-executor-command-result-reconcile.md`
- `01c3ao-canonical-ux-regression-closeout.md`

## Goal

Convert Admin/System into role-gated governance surfaces using the same
second-column pattern while preserving diagnostic depth.

Backups and restore must become first-class System sections.

## Current Code Grounding

- `src/app/admin/page.tsx`
- `src/app/admin/system/page.tsx`
- `src/app/admin/system/keys/page.tsx`
- `src/app/admin/system/tools/page.tsx`
- `src/app/admin/system/operations/page.tsx`
- `src/app/admin/system/backups/page.tsx`
- `src/app/admin/system/backups/BackupSelfServiceManager.tsx`
- `src/lib/admin/jobs/admin-jobs.ts`
- `src/lib/appliance/backup/**`
- `src/app/api/admin/system/backups/**`
- `src/app/api/admin/system/restore-plans/**`
- `crates/ordo-backup/src/**`

Implementation grounding:

- `src/lib/admin/system/load-admin-system-workspace.ts`
  - Projects health, provider, backup/restore, and admin-job diagnostics into a
    System workspace read model.
  - Keeps raw diagnostic meaning in the admin read model instead of deriving it
    inside React components.
- `src/components/admin/system/AdminSystemWorkspace.tsx`
  - Renders System through the shared `GovernanceSectionFrame`.
  - Base route renders `System Brief`.
  - Query-selected sections render one selected System detail.
- `src/app/admin/system/page.tsx`
  - Requires admin access, loads the System read model, and renders the
    governance workspace.
- `src/app/admin/system/backups/BackupSelfServiceManager.tsx`
  - Reused as the durable backup/restore action surface.
  - Added section modes so System can expose Backups and Restore Plans without
    duplicating backup/restore action architecture.

## Required Work

1. Admin rail uses Admin, Jobs, System.
   **Done. Existing rail contract preserved.**
2. System base route renders System Brief.
   **Done.**
3. System second column lists:
   - Overview,
   - Health,
   - Providers,
   - Capabilities,
   - Visibility,
   - Prompts,
   - Backups,
   - Restore Plans,
   - Jobs,
   - Operations,
   - Logs,
   - Keys.
   **Done.**
4. Backups section renders:
   - create backup action,
   - readiness/policy summary,
   - backups table,
   - validate/prepare restore actions,
   - selected backup detail.
   **Done. Backup actions are exposed through the existing backup self-service
   manager in Backups mode.**
5. Restore Plans section renders:
   - plan status,
   - destructive warning,
   - confirmation phrase,
   - safety backup state,
   - execute/cancel actions.
   **Done. Restore actions are exposed through the existing backup self-service
   manager in Restore Plans mode.**
6. Jobs section exposes queued/running/failed/retryable details to admins.
   **Done.**
7. Owner surfaces link to System only through owner-safe translations.
   **Done. This phase did not add owner System diagnostics; scans confirm no
   new owner-facing diagnostic leaks.**

## Tests

Positive:

- admin sees System sections including Backups and Restore Plans.
- backups table renders recent backups.
- eligible backup exposes validate and prepare restore.
- restore plan requires confirmation phrase and safety backup where applicable.
- Jobs section exposes admin queue diagnostics.

Negative:

- non-admin cannot access System/Backups/Restore Plans/Jobs diagnostics.
- owner Today/Studio does not expose raw backup/restore command payloads.
- restore execute is disabled until confirmation requirements pass.

Edge:

- no backups exist state offers create-backup next action.
- backup validation failure shows admin-visible repair state.
- expired running command reconciles to admin failure without corrupting owner
  surfaces.

## Non-Goals

- Do not rewrite the Rust backup executor.
- Do not weaken restore safety confirmation.
- Do not expose admin diagnostics in regular owner UI.

## Closeout Evidence Required

- System section route evidence.
- Backup/restore role and confirmation tests.
- Static scans for Factory label and raw diagnostic leakage.

Evidence:

- `docs/_refactor/ordo/evidence/phase-01c3ak-system-admin-jobs-backups-restore-sections.md`

## Implementation Notes

- `/admin/system` now renders a role-gated System workspace using the shared
  governance section pattern.
- The base route shows `System Brief` with health, provider, backup/restore,
  and job status translated into admin-level summary bullets.
- The second column lists:
  - Overview;
  - Health;
  - Providers;
  - Capabilities;
  - Visibility;
  - Prompts;
  - Backups;
  - Restore Plans;
  - Jobs;
  - Operations;
  - Logs;
  - Keys.
- Backups and Restore Plans reuse the existing backup self-service action
  manager so restore safety rules remain enforced by existing APIs and
  services.
- Jobs summary uses the admin job read model, including queued, running,
  failed, and retryable states.
- The visible owner rail still exposes only owner governance links; Admin,
  Jobs, and System remain admin-only.

## QA Status

QA pass 1 checks:

- `npx vitest run src/lib/admin/system/load-admin-system-workspace.test.ts src/components/admin/system/AdminSystemWorkspace.test.tsx src/app/admin/system/page.test.tsx src/app/admin/system/backups/BackupSelfServiceManager.test.tsx src/app/admin/system/backups/page.test.tsx src/app/admin/jobs/page.test.tsx src/components/AuthenticatedWorkRail.test.tsx`
- `npm run typecheck`
- `npx eslint src/lib/admin/system/load-admin-system-workspace.ts src/lib/admin/system/load-admin-system-workspace.test.ts src/components/admin/system/AdminSystemWorkspace.tsx src/components/admin/system/AdminSystemWorkspace.test.tsx src/app/admin/system/page.tsx src/app/admin/system/page.test.tsx src/app/admin/system/backups/BackupSelfServiceManager.tsx src/app/admin/system/backups/BackupSelfServiceManager.test.tsx`
- static scans for `Factory` and owner-facing raw diagnostic leakage.

QA pass 1 found and fixed:

- Test fixture type mismatches for appliance health and backup snapshot fields.
- An unused helper in the System workspace loader.

QA pass 2 repeated the focused tests, typecheck, focused lint, and static
scans. QA pass 2 found a test-only non-null assertion warning after adding
backup edge coverage; the fixture was rewritten to guard explicitly.
