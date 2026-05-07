# Architecture Audit

## Objective

Document the current conversation system as it actually exists. Identify what
should be preserved, what should be demoted, and what should be discarded before
implementation phases are written.

## Status

- Research: complete
- Completion date: 2026-04-28
- Exit criterion met: core seams for conversation restore, jobs, assets,
  search, prompt governance, identity migration, and browser runtime were
  mapped to current persistence and code paths

## Current System Map

### Conversation Persistence

Current storage centers on `conversations`, `messages`, and
`conversation_events`.

Current strengths:

- conversations have ownership, active/archived status, soft-delete fields,
  import metadata, referral metadata, routing fields, and message counts
- messages store ordered transcript content and structured `parts`
- conversation events provide an append-style activity stream for some actions

Current weakness:

- `messages.parts` carries too much domain state
- restore depends too much on transcript shape
- conversation records contain some workflow hints, but not enough to be a true
  workspace snapshot

Conclusion:

Keep transcript and conversation audit storage. Do not let either remain the
canonical workspace state model.

### Job System

Current storage centers on `job_requests` and `job_events`.

Current strengths:

- explicit statuses: queued, running, succeeded, failed, canceled, dead letter
- retries, replay links, supersession links, failure classes, checkpoints, and
  leases are already represented
- job events are append-only and sequenceable
- event publication is unified through a canonical job publication contract
- `/jobs` and job SSE already provide a real operational surface

Current weakness:

- dedupe only protects active jobs
- completed work is not treated as a materialized result cache
- job status is still projected back into chat message parts for visibility

Conclusion:

Keep the job ledger. Extend it with materialization lookup and workspace-level
projection. Do not rebuild it from scratch.

### Asset And Media Storage

Current storage centers on `user_files` plus metadata JSON.

Current strengths:

- user ownership
- conversation assignment
- content hashes
- file types and MIME types
- quota enforcement
- retention-class and source metadata
- derivative metadata

Current weakness:

- asset lineage is stored mostly in metadata JSON rather than indexed columns
- canonical asset state is not clearly separated from upload implementation
- reusable asset discovery still leans on conversation context and tool results

Conclusion:

Keep file storage and quota policy. Promote assets into a first-class catalog
with indexed lineage and materialization keys.

### Search And Memory

Current storage centers on `embeddings`.

Current strengths:

- SQLite vector storage exists
- content hashes and model versions exist
- conversation chunking exists
- hybrid vector/BM25 infrastructure exists for broader search

Current weakness:

- conversation search is mostly archival and transcript-shaped
- active conversation memory is not continuously projected
- `search_my_conversations` does direct vector recall instead of using a richer
  relationship memory model

Conclusion:

Keep search infrastructure. Do not treat embeddings as the memory model.

### Prompt Governance

Current storage centers on `system_prompts` and prompt runtime assembly.

Current strengths:

- prompt slots are versioned
- active prompt versions are explicit
- fallback behavior exists
- role directives, page context, routing context, summaries, task-origin
  handoff, and preferences are composed at runtime

Current weakness:

- important assistant turns are not strongly bound to the prompt slot versions
  and overlays that shaped them
- conversation continuity can drift when prompts change

Conclusion:

Keep the prompt control plane. Add explicit prompt binding for important
relationship state and executions.

### Identity And Migration

Current identity flow supports anonymous conversations through stable anonymous
cookies and migration to authenticated users.

Current strengths:

- anonymous conversations are real owned records
- login/registration migrates conversations
- job ownership transfer exists
- search ownership repair exists
- referral linkage is preserved

Current weakness:

- migration is spread across auth-adjacent code rather than modeled as a single
  domain event with verifiable repair tasks
- future workspace, asset, memory, and prompt-binding records would need to be
  included explicitly

Conclusion:

Treat identity conversion as a first-class migration workflow.

### Browser Runtime

Current browser runtime state lives partly in session storage.

Current strengths:

- local state can improve responsiveness
- browser and hybrid media capabilities are supported
- runtime can recover queued/running entries locally

Current weakness:

- local browser state can diverge from server truth
- restore can be driven by restored transcript candidates rather than durable
  server-owned state

Conclusion:

Browser runtime persistence should become a disposable cache. It must not own
restore decisions.

## Core Diagnosis

The current system has good infrastructure but the wrong top-level ownership.

Strong infrastructure:

- job ledger
- asset storage
- prompt governance
- summary markers
- SQLite search infrastructure
- anonymous migration foundations

Wrong ownership:

- transcript as state machine
- message parts as integration bus
- search embeddings as memory
- browser session storage as recovery authority

## Design Constraints

The greenfield design must preserve these facts:

1. The product wants one long-lived customer relationship per user.
2. Jobs are already durable enough to be operational truth.
3. Assets already have enough metadata to become a governed catalog.
4. Search infrastructure is useful, but memory needs a separate model.
5. Prompt governance is real and must be represented in continuity.
6. Anonymous-to-authenticated migration must include all new continuity models.

## Definition Of Done

This audit is complete when target specs can clearly answer:

- what owns restore state
- what owns active work
- what owns durable outputs
- what owns customer memory
- what owns prompt continuity
- what gets discarded from the current design
