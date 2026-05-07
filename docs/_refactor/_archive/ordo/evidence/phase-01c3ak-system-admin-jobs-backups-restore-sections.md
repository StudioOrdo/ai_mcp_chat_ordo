# Phase 01c3ak Evidence: System Admin, Jobs, Backups, And Restore Sections

Date: 2026-05-06

## Scope

Implemented the System admin governance phase:

- `/admin/system` now renders a System Brief on the base route;
- the System second column lists all required admin sections;
- Backups and Restore Plans are first-class System sections;
- backup/restore actions reuse the existing self-service manager and APIs;
- Jobs diagnostics are visible only inside the admin System surface;
- the Admin rail remains Admin, Jobs, System.

## Files Changed

- `src/app/admin/system/page.tsx`
- `src/app/admin/system/page.test.tsx`
- `src/app/admin/system/backups/BackupSelfServiceManager.tsx`
- `src/app/admin/system/backups/BackupSelfServiceManager.test.tsx`
- `src/components/admin/system/AdminSystemWorkspace.tsx`
- `src/components/admin/system/AdminSystemWorkspace.test.tsx`
- `src/lib/admin/system/load-admin-system-workspace.ts`
- `src/lib/admin/system/load-admin-system-workspace.test.ts`
- `docs/_refactor/ordo/phases/01c3ak-system-admin-jobs-backups-restore-sections.md`
- `docs/_refactor/ordo/evidence/phase-01c3ak-system-admin-jobs-backups-restore-sections.md`

## System Route Evidence

- `src/app/admin/system/page.tsx` calls `requireAdminPageAccess()` before
  loading System diagnostics.
- `src/lib/admin/system/load-admin-system-workspace.ts` projects current
  health, provider diagnostics, backup/restore state, and admin jobs into one
  read model.
- `src/components/admin/system/AdminSystemWorkspace.tsx` renders that read
  model through `GovernanceSectionFrame`.
- Base `/admin/system` renders `System Brief`.
- Query-selected routes such as `/admin/system?section=backups` and
  `/admin/system?section=restore-plans` render exactly one selected System
  detail.

## Backup And Restore Evidence

- Backups section renders:
  - create backup action;
  - policy/readiness summary;
  - backups list;
  - validate action;
  - prepare restore action.
- Restore Plans section renders:
  - destructive warning;
  - confirmation phrase input;
  - confirm action;
  - safety backup action;
  - execute restore action;
  - cancel action.
- `BackupSelfServiceManager` now accepts `initialView` so System can render
  backup controls and restore-plan controls without duplicating command logic.
- Existing restore safety remains in the current API and service layer.

## Role And Diagnostic Boundary Evidence

- `src/app/admin/system/page.test.tsx` verifies diagnostics are not loaded if
  admin access fails.
- `src/components/AuthenticatedWorkRail.test.tsx` verifies Admin, Jobs, and
  System show only for admin users and Factory/Profile are absent.
- Owner surfaces were not modified to include System diagnostics.

## QA Pass 1

Commands:

```bash
npx vitest run src/lib/admin/system/load-admin-system-workspace.test.ts src/components/admin/system/AdminSystemWorkspace.test.tsx src/app/admin/system/page.test.tsx src/app/admin/system/backups/BackupSelfServiceManager.test.tsx src/app/admin/system/backups/page.test.tsx src/app/admin/jobs/page.test.tsx src/components/AuthenticatedWorkRail.test.tsx
npm run typecheck
npx eslint src/lib/admin/system/load-admin-system-workspace.ts src/lib/admin/system/load-admin-system-workspace.test.ts src/components/admin/system/AdminSystemWorkspace.tsx src/components/admin/system/AdminSystemWorkspace.test.tsx src/app/admin/system/page.tsx src/app/admin/system/page.test.tsx src/app/admin/system/backups/BackupSelfServiceManager.tsx src/app/admin/system/backups/BackupSelfServiceManager.test.tsx
rg -n "\\bFactory\\b|factory" src/components/AuthenticatedWorkRail.tsx src/lib/shell/shell-navigation.ts src/app/admin/system src/components/admin/system
rg -n "raw job|provider details|job payload|requestPayload|resultPayload|rust_daemon|archiveHash|SystemCommand|restore command|backup command|\\b(log|logs)\\b" src/app/workspace src/app/studio src/app/business src/app/offers src/app/about src/components/dashboard src/components/studio src/components/business src/components/offers src/components/about src/components/AuthenticatedWorkRail.tsx src/components/AccountMenu.tsx
```

Result:

- 7 focused test files passed.
- 20 focused tests passed.
- Typecheck passed after fixture fixes.
- Focused lint passed after removing an unused helper.
- Factory scan passed with no matches.
- Owner diagnostic leakage scan found only negative test assertions for raw log
  language; no owner UI implementation matches were present.

Issues found and fixed:

- Test fixture used `ok` for appliance executor health where the runtime type
  expects `healthy`.
- Test fixture included obsolete backup snapshot fields.
- System workspace loader had an unused command-count helper.

## QA Pass 2

Commands:

```bash
npx vitest run src/lib/admin/system/load-admin-system-workspace.test.ts src/components/admin/system/AdminSystemWorkspace.test.tsx src/app/admin/system/page.test.tsx src/app/admin/system/backups/BackupSelfServiceManager.test.tsx src/app/admin/system/backups/page.test.tsx src/app/admin/jobs/page.test.tsx src/components/AuthenticatedWorkRail.test.tsx
npm run typecheck
npx eslint src/lib/admin/system/load-admin-system-workspace.ts src/lib/admin/system/load-admin-system-workspace.test.ts src/components/admin/system/AdminSystemWorkspace.tsx src/components/admin/system/AdminSystemWorkspace.test.tsx src/app/admin/system/page.tsx src/app/admin/system/page.test.tsx src/app/admin/system/backups/BackupSelfServiceManager.tsx src/app/admin/system/backups/BackupSelfServiceManager.test.tsx
rg -n "\\bFactory\\b|factory" src/components/AuthenticatedWorkRail.tsx src/lib/shell/shell-navigation.ts src/app/admin/system src/components/admin/system
rg -n "raw job|provider details|job payload|requestPayload|resultPayload|rust_daemon|archiveHash|SystemCommand|restore command|backup command|\\b(log|logs)\\b" src/app/workspace src/app/studio src/app/business src/app/offers src/app/about src/components/dashboard src/components/studio src/components/business src/components/offers src/components/about src/components/AuthenticatedWorkRail.tsx src/components/AccountMenu.tsx
```

Result:

- 7 focused test files passed.
- 20 focused tests passed.
- Typecheck passed.
- Focused lint passed.
- Static scans passed with no implementation leakage.

Issues found and fixed:

- Added explicit backup edge coverage for empty backup state and failed
  validation state.
- Focused lint then flagged a test-only non-null assertion in the new fixture;
  replaced it with an explicit guard before rerunning tests, typecheck, lint,
  and scans.

## Remaining Risks

- Logs are represented as an admin System section placeholder because there is
  not yet a dedicated logs page in this phase.
- Visibility, Prompts, Operations, and Keys link to their existing admin pages
  rather than fully embedding those page-specific UIs into the System detail
  pane.
- The Rust backup executor was intentionally reused and not rewritten.
