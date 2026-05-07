# Phase 01c3an: Brief Executor Command, Result, And Reconcile

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3am-brief-read-model-storage-and-evidence-manifests.md`
- `01c3ak-system-admin-jobs-backups-restore-sections.md`
- `docs/_refactor/_archive/planning/10-brief-executor-pattern-from-rust-backup-restore.md`
- `docs/_refactor/agentos-operation-kernel/phases/10-rust-runtime-boundary-expansion.md`

Blocks:

- `01c3ao-canonical-ux-regression-closeout.md`

## Goal

Implement the first durable brief update execution path using the
backup/restore pattern:

- explicit request,
- schema validation,
- leased execution,
- staged result,
- structured artifacts,
- audit/activity events,
- reconciliation,
- safe failure.

This phase makes future background LLM/local-model brief updates reliable
instead of component-generated prose.

## Current Code Grounding

Grounding confirmed before implementation:

- Rust/native backup anchors exist in:
  - `crates/ordo-backup/src/command.rs`
  - `crates/ordo-backup/src/command_store.rs`
  - `crates/ordo-backup/src/backup_executor.rs`
  - `crates/ordo-backup/src/restore_executor.rs`
  - `crates/ordo-backup/src/native_contract.rs`
- TypeScript backup/restore command/result/reconcile anchors exist in:
  - `src/adapters/BackupSystemCommandDataMapper.ts`
  - `src/lib/appliance/native/native-command-contract.ts`
  - `src/lib/appliance/native/native-result-reconciler.ts`
  - `src/lib/appliance/backup/backup-restore-operation-executor.ts`
  - `src/lib/appliance/backup/backup-restore-operation-reconciler.ts`
- Brief read-model anchors from `01c3am` exist in:
  - `src/core/entities/brief.ts`
  - `src/adapters/BriefReadModelDataMapper.ts`
  - `src/components/governance/GovernanceSectionFrame.tsx`

Missing before this phase:

- no durable brief update request table;
- no durable brief update result table;
- no lease/claim/stale path for brief update work;
- no executor boundary that can later move to Rust/native or LLM execution;
- no reconciler that stages a generated brief and promotes it only after
  validation;
- no deterministic brief executor tests for failed generation, public-safe
  evidence exclusion, or missing evidence limitation behavior.

## Required Work

Add a brief update request/result contract:

```ts
interface BriefUpdateRequest {
  schemaVersion: "1";
  requestId: string;
  briefType: string;
  scope: { sectionId?: string; objectKind?: string; objectId?: string; ownerUserId: string };
  evidenceWindow: { from?: string; to: string };
  visibilityPolicy: "owner" | "admin" | "public-safe";
  priorBriefId?: string;
  executorProfile: { kind: "deterministic" | "llm" | "local_model" | "rust_native"; model?: string };
}
```

Implemented request/result behavior:

1. create durable request;
2. validate request payload;
3. claim request with lease;
4. gather evidence through an injected evidence seam;
5. stage deterministic draft brief and manifest;
6. validate claims, manifest visibility, and owner-safe copy;
7. emit durable brief read-model events during reconciliation;
8. reconcile result into current brief only after validation;
9. preserve prior brief on failure;
10. expose admin diagnostics in stored request/result records without rendering
    them in regular owner/public UI.

Rust seam:

- Implementation starts in TypeScript.
- `BriefUpdateRequest` and `BriefUpdateResult` form the command/result boundary
  for future Rust/native execution.
- `executorProfile.kind` already supports `rust_native`, `llm`, and
  `local_model` without requiring live execution in this phase.

## Implemented Scope

Code:

- Added `src/core/entities/brief-execution.ts`
  - request/result/status/executor contracts;
  - request validation;
  - result validation against staged brief and manifest;
  - scope-to-object and scope-to-section helpers.
- Added `brief_update_requests` and `brief_update_results` schema in:
  - `src/lib/db/tables.ts`
  - `src/lib/db/migrations.ts`
- Added `src/adapters/BriefUpdateRequestDataMapper.ts`
  - create request;
  - claim pending request with lease;
  - recover expired leases as stale;
  - stage succeeded/limited/failed result;
  - mark reconciled;
  - read recent requests and stored results.
- Updated `src/adapters/BriefReadModelDataMapper.ts`
  - exported scope input;
  - added `findCurrentForScope()` for object-scoped executor updates.
- Updated `src/adapters/RepositoryFactory.ts`
  - added `getBriefUpdateRequestDataMapper()`.
- Added `src/lib/briefs/brief-update-reconciler.ts`
  - validates staged result presence;
  - writes current/history brief through `BriefReadModelDataMapper`;
  - marks request reconciled only after save succeeds.
- Added `src/lib/briefs/brief-update-executor.ts`
  - claims pending request;
  - reads prior current brief;
  - gathers evidence through injected seam;
  - generates deterministic staged draft by default;
  - records limited briefs when evidence disappears;
  - excludes evidence outside visibility policy and redacts non-public
    excluded source labels outside admin visibility;
  - stages failure with diagnostics and leaves prior current brief intact.

## Tests

Positive:

- valid brief request produces staged brief and manifest.
- successful result becomes current section brief.
- relationship/object brief update appears in trail/provenance.
- Today Brief links to evidence refs that drove its top priority.

Negative:

- invalid scope/evidence payload is rejected.
- generated claim without evidence is rejected or marked as limitation.
- private evidence cannot appear in public-safe brief.
- failed update does not overwrite prior brief.

Edge:

- executor lease expires and marks update stale/failed.
- evidence source disappears between request and reconcile.
- admin can inspect failure details without leaking to owner/public UI.

Implemented test files:

- `src/core/entities/brief-execution.test.ts`
- `src/adapters/BriefUpdateRequestDataMapper.test.ts`
- `src/lib/briefs/brief-update-executor.test.ts`
- existing coverage preserved in `src/adapters/BriefReadModelDataMapper.test.ts`

## Non-Goals

- Do not require live LLM calls for deterministic tests.
- Do not rewrite the backup/restore executor.
- Do not make Rust mandatory for the first brief executor.
- Do not add regular owner UI that exposes raw update diagnostics.

## Closeout Evidence Required

- Brief request/result schemas.
- Reconciler evidence.
- Lease/stale/failure tests.
- Admin diagnostic and owner-safe UI proof.

## Closeout Evidence

Evidence doc:

- `docs/_refactor/ordo/evidence/phase-01c3an-brief-executor-command-result-reconcile.md`
