# Spec 06: Brief Generation And Background Intelligence

Status: Draft spec

Evidence date: 2026-05-05

## Problem

The desired UX depends on intelligent section overviews, but those overviews
must be durable, evidence-backed, and inspectable.

The long-term goal is not static dashboards. The goal is Ordo periodically
reviewing work and relationships, then updating concise briefs that the owner
can inspect and act on.

## Product Principle

The user is the CEO. Ordo is the staff.

Chat is where the user gives direction.

Briefs are where the staff reports:

- what matters,
- what changed,
- what needs approval,
- what is blocked,
- what worked,
- what should happen next,
- where the evidence is.

## Current Code Anchors

Existing evidence/event foundations:

- `activity_receipts`
- `job_events`
- `operation_events`
- `referral_events`
- conversation events and summaries
- people read model
- Studio Ordo cards
- admin loaders and dashboard blocks
- backup/restore command records

Code areas:

- `src/lib/dashboard/load-user-dashboard.ts`
- `src/lib/studio/load-studio-workspace.ts`
- `src/lib/business/load-business-workspace.ts`
- `src/lib/offers/load-offers-workspace.ts`
- `src/lib/operator/loaders/*`
- `src/lib/admin/*`
- `src/lib/ordo-cards/*`
- `src/lib/appliance/backup/backup-restore-operation-executor.ts`
- `src/lib/appliance/backup/backup-restore-operation-reconciler.ts`
- `crates/ordo-backup/src/command_store.rs`
- `crates/ordo-backup/src/backup_executor.rs`
- `crates/ordo-backup/src/restore_executor.rs`
- `crates/ordo-backup/src/native_contract.rs`

## Target Brief Types

Section briefs:

- Today Brief
- Production Brief
- People Brief
- Offers Brief
- About/Profile Brief
- System Brief

Object briefs:

- Relationship Brief for people,
- Work Brief for jobs/workflows,
- Media Brief for assets,
- Offer Brief,
- Campaign Brief,
- Link/QR Brief.

## Brief Contract

A brief must include:

- generatedAt or asOf timestamp,
- source object or section id,
- scope:
  - section,
  - object,
  - evidence window,
  - user/account/business context,
- summary bullets,
- recommended next action,
- evidence references,
- excluded evidence with reason when privacy or role rules remove it,
- confidence or limitation when data is incomplete,
- version/history.

A brief must not:

- invent metrics,
- hide that evidence is missing,
- use raw technical language in owner surfaces,
- overwrite prior brief history without trail events.

## Background Job Model

Future background jobs should:

1. gather section/object evidence,
2. synthesize a brief,
3. store the brief as a durable artifact,
4. store evidence references,
5. emit activity/receipt event,
6. update section overview,
7. expose changed brief in the UI.

Jobs can be scheduled or event-triggered.

Examples:

- nightly People Brief update,
- after media workflow completes, update Production Brief,
- after offer accepted, update Offers Brief and People Brief,
- after backup fails, update System Brief,
- after new public content performance arrives, update Studio/Results Brief.

## Backup/Restore-Inspired Execution Pattern

The backup/restore architecture gives the brief system its operating model.

### Current Backup/Restore Pattern

The existing Rust boundary works because it is explicit and durable:

1. TypeScript creates a command in `system_commands`.
2. Command payloads are schema-versioned and validated.
3. Rust claims commands with a lease.
4. Rust stages work in a bounded data boundary.
5. Rust emits audit events.
6. Rust returns a structured native result with status, artifacts, metrics,
   operation refs, and errors.
7. TypeScript reconciles the result back into operation steps and owner/admin
   surfaces.

### Brief Update Pattern

Brief updates should follow the same contract:

1. Create a durable `brief.update` request or operation-backed job.
2. Include schema version, section/object id, evidence window, visibility
   policy, actor, and desired brief type.
3. Claim the job with a lease and recover stale running work.
4. Gather evidence through loaders/read models, not direct component queries.
5. Validate that every generated claim has evidence or is marked as a
   limitation.
6. Stage a draft brief with evidence refs before publishing it to the read
   model.
7. Emit brief audit/activity events:
   - `brief_update_started`,
   - `brief_update_succeeded`,
   - `brief_update_failed`,
   - `brief_superseded`.
8. Store artifacts:
   - brief id/version,
   - source evidence manifest,
   - generated summary,
   - recommended action,
   - limitations.
9. Reconcile the result into the section/object read model.
10. Preserve the prior brief on failure.

This can start in TypeScript. Rust becomes appropriate when a brief job needs
high-integrity local scanning, filesystem manifests, long-running local model
execution, or native performance isolation.

### Evidence Manifest

Every brief should have a manifest similar to a backup manifest:

- schema version,
- brief id/version,
- generated by,
- input sources,
- included evidence refs,
- excluded evidence refs,
- visibility policy,
- model/provider or local executor used,
- generated artifacts,
- warnings,
- compatibility/version notes.

The manifest is what lets a user ask "why did Ordo say this?" and lets the UI
show source links without exposing raw logs in owner surfaces.

## Customization Model

The owner should eventually be able to say:

- "Show me fewer metrics."
- "Prioritize people who need follow-up."
- "Make Studio focus on content."
- "Only alert me about failed work."

The system should store those preferences as brief configuration, not ad hoc
component state.

## Evidence Links

Every insight should link to why:

- object detail,
- relationship trail event,
- provenance item,
- job/work history,
- offer event,
- content performance,
- backup command,
- admin diagnostic.

If there is no evidence, the brief should say so.

## Acceptance Criteria

- Base section route can show a brief object.
- Brief includes as-of time and evidence references.
- Brief updates are represented as durable activity/history.
- Owner UI uses plain product language.
- Admin/System brief can expose diagnostics, but remains role-gated.
- Brief generation follows command/result/reconcile semantics.
- Failed brief generation keeps the previous brief and emits admin-visible
  failure evidence.
- Today Brief can be produced from the same read-model/evidence manifest
  contract instead of dashboard blocks.

## Tests

Positive:

- stored brief renders with as-of timestamp and evidence links.
- updated brief creates history/trail event.
- section brief changes when source evidence changes.

Negative:

- brief cannot include ungrounded fake metric fields.
- owner brief does not expose raw job/provider/log details.
- private evidence does not leak into public surfaces.

Edge:

- missing evidence renders a limitation state.
- stale brief renders stale marker or refresh action.
- failed brief generation keeps prior brief and emits admin-visible failure.
- executor lease expiry marks the update as failed or stale without losing the
  previous brief.
