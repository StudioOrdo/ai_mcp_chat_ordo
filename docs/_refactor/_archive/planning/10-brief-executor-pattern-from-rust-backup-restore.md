# Spec 10: Brief Executor Pattern From Rust Backup Restore

Status: Draft spec

Evidence date: 2026-05-05

## Purpose

Model durable section and object brief updates on the strongest existing
architecture in the codebase: the backup and restore command pipeline.

The goal is not to make every brief job Rust on day one. The goal is to copy
the reliability shape:

- explicit requests,
- validated payloads,
- leased execution,
- staged work,
- structured artifacts,
- audit events,
- reconciliation,
- safe failure behavior.

## Current Code Anchors

Rust crate:

- `crates/ordo-backup/src/command.rs`
- `crates/ordo-backup/src/command_store.rs`
- `crates/ordo-backup/src/daemon.rs`
- `crates/ordo-backup/src/backup_executor.rs`
- `crates/ordo-backup/src/restore_executor.rs`
- `crates/ordo-backup/src/audit.rs`
- `crates/ordo-backup/src/native_contract.rs`

TypeScript bridge:

- `src/lib/appliance/backup/backup-self-service.ts`
- `src/lib/appliance/backup/backup-restore-operation-executor.ts`
- `src/lib/appliance/backup/backup-restore-operation-reconciler.ts`
- `src/lib/appliance/native/native-command-contract.ts`
- `src/lib/appliance/native/native-result-reconciler.ts`

Tests:

- `crates/ordo-backup/tests/governed_executor.rs`
- `src/lib/appliance/backup/backup-restore-operation-executor.test.ts`
- `src/lib/appliance/backup/backup-restore-operation-reconciler.test.ts`
- `src/lib/appliance/backup/backup-self-service.test.ts`

## What Backup Restore Gets Right

### Explicit Commands

Backup and restore work starts as durable command intent.

The Rust daemon does not infer work from UI state. It claims rows from
`system_commands` and validates the command name.

Brief implication:

- A brief update should start from a durable `brief.update` request or an
  operation-backed job.
- The UI should not synthesize a "fresh" brief just because the component
  rendered.

### Validated Payloads

`command.rs` rejects missing ids, malformed hashes, unsupported command names,
bad operation metadata, and missing boundaries.

Brief implication:

- A brief request must validate:
  - brief type,
  - section/object id,
  - evidence window,
  - actor/visibility policy,
  - model/executor profile,
  - prior brief id/version if updating.

### Leased Execution

`CommandStore` claims pending work, marks it running with a lease, and recovers
expired running work.

Brief implication:

- Brief jobs need stale running recovery.
- A failed or expired update must not erase the previous brief.
- The UI should show stale/limited state rather than pretending the brief is
  current.

### Staging Before Commit

Backups stage SQLite and archive output before marking the snapshot succeeded.
Restores stage extracted data and validate it before replacing live data.

Brief implication:

- Brief generation should stage a draft brief and evidence manifest.
- The draft should not become the current brief until validation passes.
- Validation should prove every claim has an evidence ref or limitation.

### Audit Events

Rust writes backup/restore audit events for start, success, and failure.

Brief implication:

- Brief updates should emit:
  - `brief_update_started`,
  - `brief_update_succeeded`,
  - `brief_update_failed`,
  - `brief_superseded`.
- Object trails should show brief-created/brief-updated events where relevant.

### Structured Native Results

`NativeCommandResult` contains:

- schema version,
- command id,
- operation ref,
- status,
- summary,
- artifacts,
- metrics,
- errors.

Brief implication:

- Brief results should contain:
  - schema version,
  - request id,
  - section/object ref,
  - status,
  - summary,
  - brief artifact,
  - evidence manifest artifact,
  - metrics,
  - warnings,
  - errors.

### Reconciliation

The TypeScript reconciler reads native command results and projects them back
into operation steps, artifacts, resource refs, actions, and statuses.

Brief implication:

- Brief execution should have a reconciler that projects completed updates into:
  - section brief read model,
  - object brief read model,
  - activity receipts,
  - relationship/provenance trails,
  - admin failure diagnostics.

## Target Brief Request Contract

```ts
interface BriefUpdateRequest {
  schemaVersion: "1";
  requestId: string;
  briefType:
    | "today"
    | "production"
    | "people"
    | "offers"
    | "system"
    | "relationship"
    | "media"
    | "work"
    | "campaign"
    | "offer";
  scope: {
    sectionId?: string;
    objectKind?: string;
    objectId?: string;
    ownerUserId: string;
  };
  evidenceWindow: {
    from?: string;
    to: string;
  };
  visibilityPolicy: "owner" | "admin" | "public-safe";
  priorBriefId?: string;
  executorProfile: {
    kind: "deterministic" | "llm" | "local_model" | "rust_native";
    model?: string;
  };
  operation?: {
    operationId: string;
    stepId: string;
    actionId: string;
    operationKind: "brief_update";
  };
}
```

## Target Brief Result Contract

```ts
interface BriefUpdateResult {
  schemaVersion: "1";
  requestId: string;
  status: "succeeded" | "failed" | "limited";
  briefId: string | null;
  priorBriefId: string | null;
  summary: string;
  artifacts: Array<{
    kind: "brief" | "brief_manifest" | "brief_evidence";
    uri: string;
    label: string;
    metadata: Record<string, unknown>;
  }>;
  metrics: {
    evidenceRefs: number;
    includedSources: number;
    excludedSources: number;
    elapsedMs: number;
  };
  warnings: string[];
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

## Evidence Manifest Contract

Every generated brief needs a manifest:

- schema version,
- brief id/version,
- generated at,
- generated by,
- owner/user scope,
- visibility policy,
- included source refs,
- excluded source refs and reasons,
- claims and supporting evidence refs,
- limitations,
- model/executor metadata,
- warnings.

The manifest is the source of "why does Ordo say this?"

## Rust Versus TypeScript

Start in TypeScript when:

- the work is mostly database read-model aggregation,
- the executor calls an LLM provider,
- the phase needs fast iteration.

Use Rust when:

- local files need scanning or hashing,
- local models need efficient execution,
- long-running work must be resilient to Node event-loop pressure,
- brief evidence requires filesystem manifests,
- deterministic native validation is more important than speed of iteration.

The first implementation can be deterministic TypeScript. The architecture must
still leave a clean seam for Rust executors.

## Acceptance Criteria

- Brief updates are durable requests, not component side effects.
- Brief update payloads are schema-versioned and validated.
- Brief generation stages draft output before publishing.
- Successful updates produce a brief artifact and evidence manifest.
- Failed updates keep the previous brief.
- Reconciliation updates read models and trails.
- Owner UI sees plain brief language; admin/system can inspect executor
  diagnostics.

## Tests

Positive:

- valid brief request produces staged brief and manifest.
- successful result becomes current section brief.
- relationship brief update appears in relationship trail.
- Today Brief links to the evidence refs that drove its top priority.

Negative:

- invalid scope/evidence payload is rejected.
- generated claim without evidence is rejected or marked as limitation.
- private evidence cannot appear in public-safe brief.
- failed update does not overwrite prior brief.

Edge:

- executor lease expires and marks brief update stale/failed.
- prior brief is missing and generation fails, so UI shows limited empty brief.
- evidence source disappears between request and reconcile.
- admin can inspect failure details without leaking them to owner/public UI.
