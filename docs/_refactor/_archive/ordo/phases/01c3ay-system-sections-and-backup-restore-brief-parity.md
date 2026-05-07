# Phase 01c3ay: System Sections And Backup/Restore Brief Parity

Status: Implemented

Parent package:

- `02-ui-surface-realignment/09-implementation-phase-plan.md`

## Goal

Make System the admin governance surface for health, jobs, backups, restore
plans, visibility, prompts, operations, logs, keys, and provider/tool
diagnostics while preserving backup/restore as the model for durable background
brief work.

## Governing Docs

- `docs/_refactor/ordo/letters/refactor1.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/08-studio-jobs-and-background-briefs.md`

## Current Code Grounding

Code anchors:

- `src/app/admin/system/page.tsx`
- `src/components/admin/system/AdminSystemWorkspace.tsx`
- `src/lib/admin/system/load-admin-system-workspace.ts`
- `src/app/admin/system/backups/page.tsx`
- `src/app/admin/system/keys/page.tsx`
- `src/app/admin/system/operations/page.tsx`
- `src/app/admin/system/tools/page.tsx`
- `src/app/admin/jobs/page.tsx`
- `src/app/admin/prompts/page.tsx`
- `src/app/admin/content-visibility/page.tsx`
- `src/lib/appliance/backup/*`
- `crates/ordo-backup`

## Verified Current State

- Admin System already uses `GovernanceSectionFrame`.
- System sections include overview, health, providers, tools, capabilities,
  visibility, prompts, backups, restore plans, jobs, operations, logs, and keys.
- Backups and restore plans use durable service/command patterns.
- Jobs diagnostics are available under admin routes.
- System is role-gated through admin navigation.

## Implementation Closeout

Implemented on 2026-05-07.

- `/admin/system` remains admin-gated and renders the System Brief at the base
  route.
- The System second column selects admin sections.
- The System section list now includes explicit Tools coverage and links to
  `/admin/system/tools`.
- Backups and restore plans continue to embed `BackupSelfServiceManager` inside
  selected System sections, preserving existing confirmation and command
  semantics.
- Jobs diagnostics remain admin-only in the selected Jobs section and linked
  `/admin/jobs` route.
- The System Brief and overview document backup/restore
  request/result/reconcile semantics as the reliability model for background
  brief updates.
- System remains absent from the account menu, public nav, and owner rail.

## Target Behavior

- System base route renders System Brief.
- Second column selects System sections.
- Selected section renders linked page content or an embedded admin-safe summary.
- Backups and restore plans render full admin controls from System.
- Raw diagnostics stay inside admin routes only.
- Backup/restore command shape is documented as the model for brief background
  updates.

## Implementation Steps

1. Audit each System section for linked content and target route.
2. Ensure backups and restore plans are usable from the System selected section.
3. Ensure jobs section surfaces queue/failed status admin-only.
4. Ensure visibility/prompts/keys/operations link to existing admin pages.
5. Add role-gate tests for System and linked sections.
6. Add copy/tests documenting backup/restore command parity for brief work.
7. Update docs/evidence.

## Positive Tests

- Admin can select each System section from second column.
- Backups section renders backup manager with backup table/actions.
- Restore plans section renders restore controls and destructive warnings.
- Jobs section renders admin job diagnostics.
- Owner/non-admin cannot access System.

## Negative Tests

- Owner UI does not show raw System diagnostics.
- Account menu does not show System.
- Public nav does not show System.
- Restore execution requires confirmation and admin authorization.

## Edge Tests

- Backup loader failure renders limited System brief and load error.
- No backups renders empty backup table state.
- Existing restore plan with destructive status renders warning.
- Missing System section renders shared missing-detail state.
- Provider diagnostics missing key renders admin-only review state.

## Acceptance Criteria

- System is the single admin surface for diagnostics.
- Backup/restore and jobs are accessible from System sections.
- Admin-only diagnostics remain role-gated.
- Backup/restore command semantics are preserved as the brief reliability model.

## Non-Goals

- No owner System exposure.
- No new backup engine.
- No prompt editing redesign.
- No raw logs in owner surfaces.

## Required Commands

```bash
npx vitest run src/components/admin/system/AdminSystemWorkspace.test.tsx src/lib/admin/system/load-admin-system-workspace.test.ts src/app/admin/system/backups/page.test.tsx src/lib/appliance/backup/backup-command-service.test.ts src/app/api/admin/system/backups/route.test.ts src/app/api/admin/system/restore-plans/[planId]/execute/route.test.ts src/lib/shell/shell-navigation.test.ts
npm run typecheck
npm run lint:css
npm run lint -- src/components/admin/system/AdminSystemWorkspace.tsx src/lib/admin/system/load-admin-system-workspace.ts src/app/admin/system/backups/BackupSelfServiceManager.tsx src/lib/appliance/backup/backup-command-service.ts src/lib/shell/shell-navigation.ts
```

## Static Scans

```bash
rg -n "System|Backups|Restore|Jobs|Provider|Keys|Logs|Operations|payload|command" src/app src/components src/lib
```

## Closeout Evidence Required

- System desktop/mobile screenshots for overview, backups, restore plans, jobs.
- Role-gate test output.
- Backup/restore command parity notes.
- Static scan proving System is not in account/public nav.
