# Conversation System Refactor

## Overview

This document captures the current-state findings for the conversation system
and gives direct greenfield advice.

The goal is not to preserve the current architecture. The goal is to keep the
parts that are already strong, identify the parts that are fundamentally
mis-modeled, and define the right architecture for a system that is supposed to
support one long-lived customer relationship per user.

This writeup is intentionally blunt.

The current system has strong building blocks, but the conversation model is
still too transcript-centric. That is the root problem.

## Status

- Research: complete
- Completion date: 2026-04-28
- Scope covered: conversation restore, long-thread handling, browser runtime
  recovery, deferred jobs, media reuse, search/indexing, auth migration,
  prompt runtime, upload and asset lifecycle, and adjacent continuity seams

## Package Contents

1. `README.md`: research summary and direct greenfield advice.
2. `architecture-audit.md`: current-state map of the conversation, job, asset,
  memory, prompt, and migration seams.
3. `target-architecture.md`: proposed greenfield architecture and canonical
  platform surfaces.
4. `domain-model-spec.md`: high-level contracts for workspace state, memory,
  jobs, assets, transcript, prompt binding, and identity migration.
5. `restore-and-experience-spec.md`: target return-user experience and restore
  read model.
6. `jobs-assets-materialization-spec.md`: job ledger, asset catalog, reuse, and
  materialization policy.
7. `relationship-memory-and-search-spec.md`: memory projection and search split.
8. `governance-identity-and-migration-spec.md`: prompt binding, identity
  conversion, ownership repair, privacy, and audit requirements.
9. `validation-strategy.md`: acceptance tests and proof requirements for the
  greenfield design.
10. `ROADMAP.md`: phase-shaping roadmap used to create implementation phases.

## Recommended Reading Order

1. `README.md`
2. `architecture-audit.md`
3. `target-architecture.md`
4. `domain-model-spec.md`
5. `restore-and-experience-spec.md`
6. `jobs-assets-materialization-spec.md`
7. `relationship-memory-and-search-spec.md`
8. `governance-identity-and-migration-spec.md`
9. `validation-strategy.md`
10. `ROADMAP.md`

## Executive Summary

The system already has a good job ledger, a decent asset model, and a governed
prompt/runtime stack.

What it does not have is a strong canonical model for customer relationship
state.

Today too much important state is reconstructed indirectly from transcript
messages and message parts:

- active work can be inferred from prior message content
- reusable media can be rediscovered from tool results embedded in messages
- browser-runtime recovery can be triggered by restored transcript parts
- conversation memory is still too dependent on archived transcript indexing

That is the wrong center of gravity for a greenfield design.

The transcript should be history.
It should not be the operational truth of the workspace.

## What Is Already Strong

### 1. The Job System Is Real Infrastructure

The deferred job stack is already much closer to a durable source of truth than
the conversation stack.

Strengths:

- explicit job lifecycle and event types
- durable persistence in `job_requests` and `job_events`
- lease-based worker recovery
- user-scoped SSE stream plus reconcile fallback
- retry, replay, and cancellation concepts already exist

Conclusion:

Keep the job ledger.
Do not fold job state back into transcript replay.

### 2. Asset Storage Already Has Useful Governance

The user-file and media stack already has real policy:

- quota enforcement
- retention classes
- source classification
- derivative lineage metadata
- conversation assignment
- stale upload cleanup

Conclusion:

Keep the asset catalog idea.
Promote it into a first-class product surface instead of leaving it scattered
across user files, message parts, and tool payloads.

### 3. The Prompt Runtime Is More Mature Than It Looks

The prompt layer is not just a template string. It already has:

- governed slots
- role directives
- fallback behavior
- version activation and rollback
- request-specific overlays
- summary, routing, and task-origin context blocks

Conclusion:

Prompt binding needs to be treated as part of continuity, not as incidental
request assembly.

### 4. Long-Thread Handling Already Accepts That Raw Transcript Is Not Enough

The system already compensates for long conversations by adding:

- summary messages
- meta-summaries
- compaction markers
- reduced streaming windows
- context-window warnings and trimming

Conclusion:

The codebase already knows full transcript replay is not the right runtime
model. The architecture should catch up to that fact.

## What Is Fundamentally Wrong

### Problem 1: The Transcript Is Overloaded

Right now the transcript is trying to do too many jobs at once:

- user-visible conversation history
- tool invocation audit trail
- media continuity source
- browser-runtime recovery trigger
- partial job projection surface
- long-term memory fallback

This creates the exact class of bug that triggered this research:

- historical media work is restored as if it were recoverable active work
- old tool results can be treated as inputs to new runtime behavior
- completed outputs can be regenerated instead of reused

Brutal advice:

Stop using transcript state as the hidden control plane.

### Problem 2: Search Is Not Actually Conversation Continuity Yet

The current conversation search model is too weak to be the basis for customer
memory.

It is mostly:

- archived conversation serialization
- passage embedding
- basic vector retrieval for prior discussion recall

That is useful, but it is not a relationship memory system.

Brutal advice:

Do not confuse archived transcript search with customer memory.
They are different products.

### Problem 3: Browser Runtime State Lives on the Wrong Side of the Boundary

The browser runtime persists local entries in session storage and then tries to
reconcile them against server state.

That is acceptable as a UI accelerator.
It is not acceptable as a source of truth.

Brutal advice:

Demote browser runtime persistence to a cache.
All authoritative state should be server-owned.

### Problem 4: Historical Success and Active Execution Are Not Cleanly Separated

The system has strong active-job modeling, but it still lacks a clean product
split between:

- work that is running now
- work that finished before
- assets created by that work
- memory about why the work mattered

Brutal advice:

Never make the user pay operational cost twice because the system failed to
distinguish historical success from active execution.

### Problem 5: Identity Migration Is a Real Domain Event, Not a Login Detail

Anonymous-to-authenticated migration affects:

- conversation ownership
- search ownership
- jobs
- referrals
- potentially assets and future memory state

Brutal advice:

Treat identity conversion as a first-class state migration with explicit repair
and verification, not as incidental auth plumbing.

## Greenfield Advice

If this were a true greenfield rebuild, I would define five canonical models
and force the whole system to organize around them.

### 1. Workspace Snapshot

This is the canonical customer relationship state.

It should answer:

- who is this relationship for
- what are we working on now
- what is the next best action
- what open loops still exist
- what outputs matter right now
- what jobs are active or blocked

This is what the homepage should load first.

### 2. Job Ledger

This is the canonical operational history.

It should answer:

- what was requested
- what is running now
- what failed
- what succeeded
- what was retried, replayed, canceled, or superseded

This should remain append-only and durable.

### 3. Asset Catalog

This is the canonical durable output model.

It should answer:

- what assets exist for this customer relationship
- what generated them
- what they derive from
- whether they are reusable, canonical, superseded, or ephemeral

This should be the basis for reuse.
Not transcript scanning.

### 4. Relationship Memory

This is the canonical continuity model.

It should contain structured memory such as:

- goals
- preferences
- decisions
- commitments
- unresolved questions
- milestones
- important outputs and why they matter

This is not the raw transcript and not just vector search.

### 5. Prompt Binding

This is the canonical explanation of what governed context shaped an important
assistant decision.

At minimum it should retain:

- effective prompt hash
- slot refs and versions
- important overlays or routing blocks

Without this, resumed behavior can drift silently as prompts change.

## The Architecture I Would Build

### Principle 1: Conversation Is Narrative, Not State Ownership

The transcript remains useful for:

- trust
- audit
- export
- reading history
- user context

But it does not own:

- active jobs
- asset truth
- memory truth
- restore logic

### Principle 2: Restore Reads State, Not History

Homepage restore should load, in this order:

1. workspace snapshot
2. active jobs
3. reusable assets
4. recent transcript slice
5. relationship memory summary

The transcript should be rendered after the state model is already known.

### Principle 3: Reuse Beats Recompute

Every expensive media or transformation operation should first resolve against
historical materialization.

That requires a deterministic reuse key built from normalized inputs such as:

- user or workspace scope
- operation type
- canonical source asset ids
- normalized plan
- pipeline version

Outcomes should be:

- exact match: reuse
- near match: offer variant from prior asset
- no match: enqueue new job

### Principle 4: Browser Runtime Is an Optimization Layer Only

Browser runtime entries can improve perceived responsiveness, but they must be
derived from server state and discarded freely.

If the browser cache disappears, the system should still restore the customer
workspace correctly.

### Principle 5: Search Must Split Into Two Systems

The codebase should stop pretending there is only one kind of search.

There should be:

- relationship memory retrieval
- corpus or knowledge retrieval
- navigation or product discovery search
- transcript recall or forensic search

Those can share infrastructure, but not product semantics.

## Brutal Advice On What Not To Preserve

### Do Not Preserve Transcript-Driven Restore

This is the biggest architectural trap.

If restore behavior depends on scanning old tool calls and tool results inside
messages, the system will keep regenerating old mistakes in new forms.

### Do Not Preserve Message-Part Sprawl As The Main Integration Strategy

Message parts are useful for rendering rich chat output.
They are not a good substitute for domain models.

If everything important becomes a message part, the chat transcript becomes a
junk drawer for the entire platform.

### Do Not Treat Search Embeddings As Memory

Embeddings are an access strategy, not a memory model.

If the only memory system is "embed the transcript and search it later", the
product will always feel like a smart log viewer instead of a real customer
workspace.

### Do Not Let Prompt Drift Stay Implicit

If prompt slot versions can change while the conversation persists for weeks or
months, then the platform needs explicit binding or replay context for critical
continuity surfaces.

### Do Not Keep Historical Success Trapped Behind Active-Only Dedupe

Active dedupe is useful, but it solves the smaller problem.

The bigger problem is recognizing completed work and reusing it intentionally.

## What I Would Keep

If the system were being rebuilt cleanly, I would keep the following ideas:

- append-only durable job events
- lease-based worker recovery
- governed prompt slots and prompt control plane
- asset retention classes and quota enforcement
- summary and meta-summary concepts
- one active conversation per user as the product default

Those are good instincts.
They just need a better top-level model.

## What I Would Build First

### Phase 1: Canonical Read Models

Introduce durable read models for:

- `WorkspaceSnapshot`
- `RelationshipMemory`
- `AssetCatalogEntry`
- `PromptBinding`

Do this before changing the transcript renderer.

### Phase 2: Restore Rewrite

Make restore depend on the read models above, plus active jobs.

The restored transcript should become a view, not the source of restore
decisions.

### Phase 3: Historical Materialization Reuse

Add explicit reuse lookup for successful media and content outputs.

This is the clean way to eliminate accidental recomputation.

### Phase 4: Continuous Relationship Memory

Build memory as an actively maintained projection, not as something created
only after archive.

### Phase 5: Search Split

Separate:

- relationship memory retrieval
- transcript recall
- corpus grounding
- product navigation

That split will simplify both user experience and agent reasoning.

## Product Advice

For this product, the right mental model is:

- one ongoing customer relationship
- one active workspace
- many durable outputs
- many historical jobs
- one continuously maintained memory layer

When a customer returns, the system should say:

- here is what we were doing
- here is what is still running
- here is what already exists
- here is the next best move

It should not say:

- let me inspect old transcript internals and see what I might rerun

## Decision Summary

The honest advice is simple.

Do not center the greenfield architecture on the transcript.

Center it on:

- workspace state
- job ledger
- asset catalog
- relationship memory
- prompt binding

Then let the transcript be what it should have been all along:

- a readable history of the relationship
- not the hidden state machine that runs the product
