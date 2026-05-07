# Phase 01c3ay Evidence: System Sections And Backup/Restore Brief Parity

Date: 2026-05-07

Status: Implemented

## Governing Product Contract

- Chat remains the operating interface.
- UI surfaces remain the governance layer.
- System is admin-only.
- `/admin/system` is the canonical admin governance surface for diagnostics,
  backups, restore plans, jobs, operations, logs, keys, providers, and tools.
- Regular owner/public UI must not expose System controls, raw jobs, providers,
  logs, operation ids, payloads, keys, or diagnostic internals.
- Backup/restore durable command semantics are the reliability model for future
  background brief updates.

## Code Files Changed

- `src/lib/admin/system/load-admin-system-workspace.ts`
- `src/components/admin/system/AdminSystemWorkspace.tsx`
- `src/lib/admin/system/load-admin-system-workspace.test.ts`
- `src/components/admin/system/AdminSystemWorkspace.test.tsx`

## Documentation Files Changed

- `docs/_refactor/ordo/phases/01c3ay-system-sections-and-backup-restore-brief-parity.md`
- `docs/_refactor/ordo/evidence/phase-01c3ay-system-sections-and-backup-restore-brief-parity.md`
- `docs/_refactor/ordo/prompts/next.md`
- `docs/_refactor/ordo/prompts/archive/01c3az-brief-storage-and-background-intelligence-closeout.md`

## Verified Current State

- `/admin/system` already used `GovernanceSectionFrame`.
- `/admin/system` already required admin access through `requireAdminPageAccess`.
- Backups and restore plans already used durable backup self-service and
  confirmation flows.
- Jobs diagnostics already loaded through the admin jobs read model.
- `System` is admin rail only. It is not in public top navigation, account menu,
  or owner work rail.

## Implementation Evidence

- Added `tools` as an explicit System section in the System read model.
- Added tool counts, protected tool counts, and tool warning counts to the
  System summary.
- Added selected Tools detail that links to `/admin/system/tools` and summarizes
  tool availability from provider diagnostics.
- Added System Brief evidence reference for tool availability.
- Added System Brief limitation that background brief updates must follow the
  backup/restore durable request, executor result, evidence manifest, and
  reconcile pattern.
- Added System overview copy documenting the same backup/restore command model.

## Backup/Restore Command Parity Notes

The preserved model is:

1. Create a durable request/command.
2. Execute outside the UI.
3. Persist result payload and evidence/artifact references.
4. Reconcile successful results into read models.
5. Keep prior evidence/read models intact on failure.

This phase documents that model for future brief/background intelligence work
and does not redesign the backup engine.

## QA Pass 1

Commands run:

```bash
npx vitest run src/components/admin/system/AdminSystemWorkspace.test.tsx src/lib/admin/system/load-admin-system-workspace.test.ts src/app/admin/system/backups/page.test.tsx src/lib/appliance/backup/backup-command-service.test.ts src/app/api/admin/system/backups/route.test.ts 'src/app/api/admin/system/restore-plans/[planId]/execute/route.test.ts' src/lib/shell/shell-navigation.test.ts
npm run typecheck
npm run lint:css
npm run lint -- src/components/admin/system/AdminSystemWorkspace.tsx src/lib/admin/system/load-admin-system-workspace.ts src/app/admin/system/backups/BackupSelfServiceManager.tsx src/lib/appliance/backup/backup-command-service.ts src/lib/shell/shell-navigation.ts
```

Results:

- Required phase test suite passed after one fixture fix: 7 files, 39 tests.
- Typecheck passed.
- CSS lint passed.
- Focused lint passed.

Issues found and fixed:

- Initial shell invocation needed the `[planId]` path quoted for zsh.
- The new Tools section test fixture did not mirror the production target link
  to `/admin/system/tools`; the fixture was fixed and the required suite passed.

## QA Pass 2

Commands run:

```bash
npx vitest run src/components/admin/system/AdminSystemWorkspace.test.tsx src/lib/admin/system/load-admin-system-workspace.test.ts src/app/admin/system/backups/page.test.tsx src/lib/appliance/backup/backup-command-service.test.ts src/app/api/admin/system/backups/route.test.ts 'src/app/api/admin/system/restore-plans/[planId]/execute/route.test.ts' src/lib/shell/shell-navigation.test.ts
npm run typecheck
npm run lint:css
npm run lint -- src/components/admin/system/AdminSystemWorkspace.tsx src/lib/admin/system/load-admin-system-workspace.ts src/app/admin/system/backups/BackupSelfServiceManager.tsx src/lib/appliance/backup/backup-command-service.ts src/lib/shell/shell-navigation.ts
rg -n "System|Backups|Restore|Jobs|Provider|Keys|Logs|Operations|payload|command" src/app src/components src/lib
rg -n "System|Backups|Restore|Jobs|Provider|Keys|Logs|Operations|payload|command" src/components src/app | grep -v "src/components/admin" | grep -v "src/app/admin" || true
```

Results:

- Required phase test suite passed: 7 files, 39 tests.
- Additional navigation/admin backstop suite passed: 7 files, 33 tests.
- Typecheck passed.
- CSS lint passed.
- Focused lint passed.
- Prompt handoff files match byte-for-byte.
- Static scans were reviewed. Broad scans include expected matches in admin
  routes, backup/restore services, implementation payload variables, tests,
  and hidden/donor owner job routes. Focused navigation scan confirms System is
  in admin rail only; primary nav is Home/Feed/Offers/About and account menu is
  Profile/Referrals.

Issues found and fixed:

- Focused navigation backstop found stale rail/mobile drawer test expectations
  that omitted Knowledge Base from the owner navigation list. The tests were
  updated to match the canonical route registry from the prior Knowledge Base
  phase.

## Visual QA

The local dev server was reachable, but `/admin/system` returned a `307`
redirect to `/install` in this shell context. Authenticated screenshot evidence
was therefore blocked. DOM/render/route/static evidence was used instead.

## Prompt Handoff

The next phase prompt was written to:

- `docs/_refactor/ordo/prompts/next.md`
- `docs/_refactor/ordo/prompts/archive/01c3az-brief-storage-and-background-intelligence-closeout.md`

Both files target:

- `docs/_refactor/ordo/phases/01c3az-brief-storage-and-background-intelligence-closeout.md`
