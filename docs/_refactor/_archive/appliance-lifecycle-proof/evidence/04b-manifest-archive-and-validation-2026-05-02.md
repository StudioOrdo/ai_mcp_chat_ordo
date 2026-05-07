# Phase 04B Evidence - Manifest Archive And Validation

Date: 2026-05-02

## Implemented

- Added Node-owned backup manifest contract and compatibility report:
  - `src/lib/appliance/backup/backup-manifest.ts`
- Added archive path safety validation:
  - rejects absolute paths
  - rejects `..` traversal
  - rejects Windows drive paths and backslash traversal
  - rejects empty, `.`, and disallowed roots
  - rejects symlink entries
- Added archive-level SHA-256 integrity service:
  - `src/lib/appliance/backup/backup-archive-integrity.ts`
  - final hash and byte size remain outside the archive in snapshot metadata / validation input
- Added read-only zip archive reader:
  - `src/lib/appliance/backup/backup-zip-archive-reader.ts`
  - reads central-directory entries and `manifest.json`
  - does not extract archive contents
  - does not introduce a production `adm-zip` dependency path
- Added backup archive validator and service:
  - `src/lib/appliance/backup/backup-archive-validator.ts`
  - `src/lib/appliance/backup/backup-archive-service.ts`
- Extended compact backup snapshot repository methods:
  - `markValidating`
  - `markValidated`
  - `markSucceeded`
  - `markFailed`
- Kept Phase 04B in scope:
  - no restore writes
  - no file-entry table
  - no file-by-file checksum rows
  - no default-chat backup/restore tools
  - no Rust daemon command integration

## Validation

Targeted tests:

```text
npm test -- src/lib/appliance/backup/backup-archive-validation.test.ts src/lib/appliance/backup/backup-archive-service.test.ts src/adapters/BackupGovernanceDataMapper.test.ts src/lib/appliance/backup/backup-prompt-exposure.test.ts

Test Files  4 passed (4)
Tests  30 passed (30)
```

Final QA targeted tests:

```text
npm test -- src/lib/appliance/backup/backup-archive-validation.test.ts src/lib/appliance/backup/backup-archive-service.test.ts src/adapters/BackupGovernanceDataMapper.test.ts src/lib/appliance/backup/backup-prompt-exposure.test.ts src/lib/db/data-access-canary.test.ts

Test Files  5 passed (5)
Tests  34 passed (34)
```

Typecheck:

```text
npm run typecheck

tsc --noEmit
```

Data-access canary:

```text
npm test -- src/lib/db/data-access-canary.test.ts

Test Files  1 passed (1)
Tests  2 passed (2)
```

Full suite:

```text
npm test

Test Files  697 passed (697)
Tests  5034 passed | 2 skipped (5036)
```

## QA Notes

- The implementation pass found and avoided a circular manifest integrity trap: `manifest.json` must not contain the final archive hash or finalized byte size because the archive contains the manifest.
- The concrete zip reader was implemented as read-only central-directory parsing instead of relying on `adm-zip`, which behaved inconsistently under the current ESM/Vitest path and would be a poor production large-archive dependency.
- SQLite quick integrity result `failed` makes the manifest incompatible. `skipped` is still representable for future controlled cases, but restore planning can decide whether to allow it.
- Rust archive execution remains Phase 04D. 04B supplies the Node-owned artifact contract that Rust must obey.
- Final QA found malformed manifest JSON could escape as an exception instead of a structured validation failure. The validator now catches reader parse failures and reports them as validation errors; duplicate manifest entries and malformed manifest payloads are covered explicitly.
