# Phase 01c3an Evidence: Brief Executor Command, Result, And Reconcile

Date: 2026-05-06

Status: Implemented

## Governing Contracts

- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`

Core invariant preserved:

> Chat is the operating interface. UI surfaces are the governance layer.

## Code Grounding

Confirmed current anchors before editing:

- Backup/restore command/result/reconcile pattern:
  - `crates/ordo-backup/src/command.rs`
  - `crates/ordo-backup/src/command_store.rs`
  - `crates/ordo-backup/src/backup_executor.rs`
  - `crates/ordo-backup/src/restore_executor.rs`
  - `crates/ordo-backup/src/native_contract.rs`
  - `src/adapters/BackupSystemCommandDataMapper.ts`
  - `src/lib/appliance/native/native-command-contract.ts`
  - `src/lib/appliance/native/native-result-reconciler.ts`
  - `src/lib/appliance/backup/backup-restore-operation-executor.ts`
  - `src/lib/appliance/backup/backup-restore-operation-reconciler.ts`
- Brief/read-model anchors:
  - `src/core/entities/brief.ts`
  - `src/adapters/BriefReadModelDataMapper.ts`
  - `src/components/governance/GovernanceSectionFrame.tsx`

The existing backup path already models durable command intake, execution
boundaries, staged result handling, and reconciliation. This phase reused that
shape for briefs without introducing a live LLM dependency.

## Implementation

Files changed:

- `src/core/entities/brief-execution.ts`
- `src/core/entities/brief-execution.test.ts`
- `src/adapters/BriefUpdateRequestDataMapper.ts`
- `src/adapters/BriefUpdateRequestDataMapper.test.ts`
- `src/adapters/BriefReadModelDataMapper.ts`
- `src/adapters/BriefReadModelDataMapper.test.ts`
- `src/adapters/RepositoryFactory.ts`
- `src/lib/db/tables.ts`
- `src/lib/db/migrations.ts`
- `src/lib/briefs/brief-update-executor.ts`
- `src/lib/briefs/brief-update-executor.test.ts`
- `src/lib/briefs/brief-update-reconciler.ts`
- `docs/_refactor/ordo/phases/01c3an-brief-executor-command-result-reconcile.md`
- `docs/_refactor/ordo/evidence/phase-01c3an-brief-executor-command-result-reconcile.md`

Implemented behavior:

- Added `BriefUpdateRequest` and `BriefUpdateResult` contracts in
  `src/core/entities/brief-execution.ts`.
- Added schema validation for:
  - request version/id/type;
  - section/object scope;
  - owner scope;
  - evidence windows;
  - visibility policy;
  - executor profile;
  - staged brief and manifest consistency;
  - result artifacts and metrics.
- Added durable request/result storage:
  - `brief_update_requests`
  - `brief_update_results`
- Added lease semantics:
  - pending requests claim to running with `lease_owner` and
    `lease_expires_at`;
  - expired running leases recover to `stale`;
  - successful staged results clear the lease;
  - failed results clear the lease and preserve diagnostics.
- Added deterministic executor/reconciler path:
  - `BriefUpdateExecutor` claims one request;
  - evidence is injected through a loader seam;
  - deterministic draft generation is used for tests and first execution;
  - generated briefs are staged as succeeded or limited;
  - failed drafts are stored as failed results without overwriting current
    brief;
  - `BriefUpdateReconciler` writes the staged brief through
    `BriefReadModelDataMapper` and marks the request reconciled after storage.
- Added public/owner/admin visibility preservation:
  - public-safe briefs include only public evidence;
  - excluded non-public evidence is redacted outside admin visibility;
  - owner briefs cannot include admin-only evidence;
  - missing/excluded evidence becomes a limitation rather than an invented
    claim.

## Request/Result Shape

```ts
interface BriefUpdateRequest {
  schemaVersion: "1";
  requestId: string;
  briefType: string;
  scope: {
    sectionId?: string;
    objectKind?: string;
    objectId?: string;
    objectLabel?: string;
    ownerUserId: string;
  };
  evidenceWindow: { from?: string; to: string };
  visibilityPolicy: "owner" | "admin" | "public-safe";
  priorBriefId?: string;
  executorProfile: {
    kind: "deterministic" | "llm" | "local_model" | "rust_native";
    model?: string;
  };
}
```

The stored result carries the staged `SectionBrief`, the
`BriefEvidenceManifest`, structured artifacts, metrics, warnings, and optional
admin diagnostics.

## QA Pass 1

Commands:

```bash
npx vitest run src/core/entities/brief-execution.test.ts src/adapters/BriefUpdateRequestDataMapper.test.ts src/lib/briefs/brief-update-executor.test.ts src/adapters/BriefReadModelDataMapper.test.ts
npx vitest run src/core/entities/brief.test.ts src/components/governance/GovernanceSectionFrame.test.tsx src/components/dashboard/UserDashboard.test.tsx src/lib/dashboard/today-brief-read-model.test.ts src/components/admin/system/AdminSystemWorkspace.test.tsx src/lib/admin/system/load-admin-system-workspace.test.ts src/lib/appliance/native/native-command-contract.test.ts src/lib/appliance/native/native-result-reconciler.test.ts src/lib/appliance/backup/backup-restore-operation-executor.test.ts src/lib/appliance/backup/backup-restore-operation-reconciler.test.ts
npm run typecheck
npm run lint -- src/core/entities/brief-execution.ts src/core/entities/brief-execution.test.ts src/adapters/BriefUpdateRequestDataMapper.ts src/adapters/BriefUpdateRequestDataMapper.test.ts src/adapters/BriefReadModelDataMapper.ts src/adapters/RepositoryFactory.ts src/lib/briefs/brief-update-executor.ts src/lib/briefs/brief-update-executor.test.ts src/lib/briefs/brief-update-reconciler.ts src/lib/db/tables.ts src/lib/db/migrations.ts
npx vitest run src/lib/briefs/brief-update-executor.test.ts
npm run lint -- src/core/entities/brief-execution.ts src/core/entities/brief-execution.test.ts src/adapters/BriefUpdateRequestDataMapper.ts src/adapters/BriefUpdateRequestDataMapper.test.ts src/adapters/BriefReadModelDataMapper.ts src/adapters/RepositoryFactory.ts src/lib/briefs/brief-update-executor.ts src/lib/briefs/brief-update-executor.test.ts src/lib/briefs/brief-update-reconciler.ts src/lib/db/tables.ts src/lib/db/migrations.ts
```

Results:

- Focused phase suite passed: 4 files, 26 tests.
- Focused related suite passed: 10 files, 41 tests.
- Typecheck passed.
- Focused lint passed after fixing the issue below.

Issues found and fixed:

- Removed an unused `BriefUpdateReconciler` import from
  `src/lib/briefs/brief-update-executor.test.ts`; reran the affected executor
  test and focused lint successfully.

## QA Pass 2

Commands:

```bash
npx vitest run src/core/entities/brief-execution.test.ts src/adapters/BriefUpdateRequestDataMapper.test.ts src/lib/briefs/brief-update-executor.test.ts src/adapters/BriefReadModelDataMapper.test.ts
npx vitest run src/core/entities/brief.test.ts src/components/governance/GovernanceSectionFrame.test.tsx src/components/dashboard/UserDashboard.test.tsx src/lib/dashboard/today-brief-read-model.test.ts src/components/admin/system/AdminSystemWorkspace.test.tsx src/lib/admin/system/load-admin-system-workspace.test.ts src/lib/appliance/native/native-command-contract.test.ts src/lib/appliance/native/native-result-reconciler.test.ts src/lib/appliance/backup/backup-restore-operation-executor.test.ts src/lib/appliance/backup/backup-restore-operation-reconciler.test.ts
npm run typecheck
npm run lint -- src/core/entities/brief-execution.ts src/core/entities/brief-execution.test.ts src/adapters/BriefUpdateRequestDataMapper.ts src/adapters/BriefUpdateRequestDataMapper.test.ts src/adapters/BriefReadModelDataMapper.ts src/adapters/RepositoryFactory.ts src/lib/briefs/brief-update-executor.ts src/lib/briefs/brief-update-executor.test.ts src/lib/briefs/brief-update-reconciler.ts src/lib/db/tables.ts src/lib/db/migrations.ts
npx vitest run src/core/entities/brief-execution.test.ts src/adapters/BriefUpdateRequestDataMapper.test.ts src/lib/briefs/brief-update-executor.test.ts src/adapters/BriefReadModelDataMapper.test.ts
npm run typecheck
npm run lint -- src/core/entities/brief-execution.ts src/core/entities/brief-execution.test.ts src/adapters/BriefUpdateRequestDataMapper.ts src/adapters/BriefUpdateRequestDataMapper.test.ts src/adapters/BriefReadModelDataMapper.ts src/adapters/RepositoryFactory.ts src/lib/briefs/brief-update-executor.ts src/lib/briefs/brief-update-executor.test.ts src/lib/briefs/brief-update-reconciler.ts src/lib/db/tables.ts src/lib/db/migrations.ts
npx vitest run src/core/entities/brief.test.ts src/components/governance/GovernanceSectionFrame.test.tsx src/components/dashboard/UserDashboard.test.tsx src/lib/dashboard/today-brief-read-model.test.ts src/components/admin/system/AdminSystemWorkspace.test.tsx src/lib/admin/system/load-admin-system-workspace.test.ts src/lib/appliance/native/native-command-contract.test.ts src/lib/appliance/native/native-result-reconciler.test.ts src/lib/appliance/backup/backup-restore-operation-executor.test.ts src/lib/appliance/backup/backup-restore-operation-reconciler.test.ts
rg -n --glob '!*.test.ts' --glob '!*.test.tsx' -P "job_(?!event\b)[0-9A-Za-z-]+|\b(raw job|raw log|provider|logs?|payload_json|system_commands|fake metrics|diagnostic|BriefUpdateRequest|BriefUpdateResult|brief_update_requests|brief_update_results)\b" src/components/governance src/components/dashboard src/components/studio src/components/offers src/components/about src/lib/dashboard src/lib/studio src/lib/offers src/lib/about
rg -n "BriefUpdateRequest|BriefUpdateResult|brief_update_requests|brief_update_results|BriefUpdateExecutor|BriefUpdateReconciler|recoverExpiredLeases|findCurrentForScope" src/core/entities/brief-execution.ts src/adapters/BriefUpdateRequestDataMapper.ts src/adapters/BriefReadModelDataMapper.ts src/adapters/RepositoryFactory.ts src/lib/briefs/brief-update-executor.ts src/lib/briefs/brief-update-reconciler.ts src/lib/db/tables.ts src/lib/db/migrations.ts src/core/entities/brief-execution.test.ts src/adapters/BriefUpdateRequestDataMapper.test.ts src/lib/briefs/brief-update-executor.test.ts
rg -n "Status: Implemented|Brief update request/result|lease|stale|failed|public-safe|diagnostics|Closeout Evidence" docs/_refactor/ordo/phases/01c3an-brief-executor-command-result-reconcile.md docs/_refactor/ordo/evidence/phase-01c3an-brief-executor-command-result-reconcile.md
```

Results:

- Phase suite passed: 4 files, 26 tests.
- Focused related suite passed: 10 files, 41 tests.
- Typecheck passed.
- Focused lint passed.
- Production owner/public UI leakage scan returned no matches. A broader scan
  that included tests matched sanitization fixtures; the production-only scan
  above is the governing proof.
- Static contract scan confirmed request/result schema, mapper, lease recovery,
  executor, reconciler, repository factory, and DB schema anchors.
- Phase/evidence doc scan confirmed implemented status and closeout coverage.

Issues found and fixed:

- Tightened public-safe/admin boundary behavior after review: excluded
  non-public evidence now stores a redacted source label/id outside admin
  visibility instead of carrying the original source label in the manifest.
  Reran the phase suite, typecheck, lint, related suite, production leakage
  scan, contract scan, and doc scan successfully.

## Remaining Risks / Deferred Work

- Live LLM/local-model execution is intentionally deferred. The command/result
  boundary supports `llm`, `local_model`, and `rust_native` executor profiles
  without requiring live model calls in this phase.
- Regular owner UI does not yet surface running brief-update state. That should
  remain owner-safe and brief-oriented when added later.
