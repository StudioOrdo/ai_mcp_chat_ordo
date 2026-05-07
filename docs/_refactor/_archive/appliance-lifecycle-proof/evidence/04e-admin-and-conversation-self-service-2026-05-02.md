# Phase 04E Evidence - Admin And Conversation Self Service

Date: 2026-05-02

## Result

Phase 04E is implemented.

Backup and restore now have a shared admin self-service facade, admin UI/API
surfaces, and operator-only conversation tools. Rust remains a governed
asynchronous executor behind Node-owned `system_commands`.

## Code Changes

Read models and facade:

- Extended backup governance types with query ports.
- Added recent/latest snapshot queries.
- Added backup/restore command correlation queries and Rust daemon status
  counts.
- Added restore plan list/active queries.
- Added audit timeline queries.
- Added `src/lib/appliance/backup/backup-self-service.ts`.
- Added `getBackupSelfService()` to `RepositoryFactory`.

Admin UI/API:

- Added `/admin/system/backups`.
- Added `BackupSelfServiceManager`.
- Added `/api/admin/system/backups`.
- Added backup validation and restore-plan creation routes.
- Added restore-plan safety-backup, confirm, execute, and cancel routes.
- Linked backups from `/admin/system`.

Conversation tools:

- Added `src/core/use-cases/tools/appliance-backup.tool.ts`.
- Added catalog schemas for appliance backup/restore tools.
- Added operator-only admin capability definitions.
- Added runtime bindings for all appliance backup/restore tools.
- Updated prompt exposure coverage for the new tools.

## Rust Boundary Properties

- 04E does not spawn `ordo-backup`.
- 04E does not shell out to Rust.
- 04E does not import Rust bindings.
- Backup and restore execution cross into Rust only through
  `system_commands.target = rust_daemon`.
- Queueing a command is represented as queued/running state, not completion.
- Disabled or missing executor state blocks new backup/restore execution
  enqueue from self-service paths.

## Verification

```text
npm run typecheck
passed
```

```text
npm test -- src/adapters/BackupGovernanceDataMapper.test.ts src/lib/appliance/backup/backup-self-service.test.ts src/app/api/admin/system/backups/route.test.ts 'src/app/api/admin/system/restore-plans/[planId]/execute/route.test.ts' src/core/use-cases/tools/appliance-backup.tool.test.ts src/lib/appliance/backup/backup-prompt-exposure.test.ts src/app/admin/system/backups/page.test.tsx
7 files passed
24 tests passed
```

```text
npm test -- src/core/capability-catalog/catalog.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/core/capability-catalog/schema-derivation.test.ts src/lib/tools/tool-settings-service.test.ts src/app/api/admin/system/tools/route.test.ts
5 files passed
85 tests passed
2 skipped
```

```text
npm test -- tests/core-policy.test.ts tests/system-prompt-assembly.test.ts tests/tool-registry.integration.test.ts src/lib/chat/tool-composition-root.test.ts
4 files passed
50 tests passed
```

```text
npm test
704 files passed
5059 tests passed
2 skipped
```

## Remaining Scope

04E does not implement automatic scheduled backups, retention pruning, overdue
backup health, or editable backup policy controls. That remains Phase 04F.

04E does not perform full Docker smoke restore verification. That remains Phase
05.
