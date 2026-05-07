# Phase 06: Relationship Memory Projection

## Objective

Build the missing durable write-side and projection pipeline for structured
relationship memory so restore, workspace, and later retrieval surfaces consume
goals, preferences, decisions, commitments, questions, milestones, and asset
context from canonical records instead of transcript-era summaries, embeddings,
or prompt-only recall.

The current repo is no longer at zero for this phase.

It already has:

- a `RelationshipMemoryRecord` entity and repository contract
- workspace and restore readers that can consume active memory records
- a restore payload that already exposes a compact memory summary

What it does not yet have is the durable adapter and projection/update path that
actually produces and maintains those records.

Phase 06 is therefore not “invent the memory concept.” It is “finish the
relationship-memory slice so the read side stops depending on hypothetical
records and later phases stop treating summaries and embeddings as memory
substitutes.”

## Source Specs

- [../relationship-memory-and-search-spec.md](../relationship-memory-and-search-spec.md)
- [../domain-model-spec.md](../domain-model-spec.md)
- [../restore-and-experience-spec.md](../restore-and-experience-spec.md)
- [phase-02-workspace-snapshot-projection.md](phase-02-workspace-snapshot-projection.md)
- [phase-03-restore-read-model-and-idempotent-homepage.md](phase-03-restore-read-model-and-idempotent-homepage.md)
- [phase-05-asset-catalog-and-reusable-outputs.md](phase-05-asset-catalog-and-reusable-outputs.md)

## Collect

Research the current memory-shaped behavior and the places still carrying
relationship continuity indirectly:

- summaries and meta-summaries
- conversation events
- transcript indexing
- message chunking
- prompt runtime context sections
- user preferences and profile data
- workspace and restore memory readers

Current grounded starting points:

- `src/core/entities/relationship-memory.ts`
- `src/core/use-cases/RelationshipMemoryRepository.ts`
- `src/core/platform/conversation-workspace/WorkspaceSnapshotReader.ts`
- `src/core/platform/conversation-workspace/WorkspaceSnapshotProjector.ts`
- `src/core/platform/conversation-restore/WorkspaceRestoreReader.ts`
- `src/core/platform/conversation-restore/WorkspaceRestoreProjector.ts`
- `src/core/use-cases/SummarizationInteractor.ts`
- `src/adapters/ConversationEventDataMapper.ts`
- `src/lib/chat/prompt-runtime.ts`
- `src/lib/chat/embed-conversation.ts`
- `src/core/search/ConversationChunker.ts`
- `src/adapters/SQLiteVectorStore.ts`
- `src/adapters/UserPreferencesDataMapper.ts`

Collect and classify each surface as one of:

- true relationship memory substrate
- indirect continuity signal
- transcript/search infrastructure only
- prompt assembly input only

## Decide

Decide the first durable projection trigger and keep it deterministic.

Grounded current answer to test first:

- projection after durable conversation-turn changes, with repair/rebuild entry
  points for older conversations

Other triggers should be treated as extensions, not the initial ownership
surface:

- after each user or assistant turn
- after summarization
- after job completion
- as a repair/rebuild job first

Decide the first supported memory types. The entity already allows:

- goal
- preference
- decision
- commitment
- open question
- milestone
- asset context

Prefer a completion slice that lands a smaller proven subset first, then adds
the others through the same projection contract.

Minimum expected first slice:

- goal
- preference
- decision
- commitment
- open question

Rejected approaches must include:

- memory as embedding rows only
- memory as hidden prompt text only
- memory without evidence refs
- reading summaries or meta-summaries as if they were canonical memory records
- letting restore own memory synthesis inline
- treating user preferences as automatically equivalent to relationship memory

## Spec QA

Each memory record must have, and the current entity already proves most of
this contract explicitly:

- user and conversation ownership
- memory type
- summary
- status
- confidence
- evidence refs unless explicitly user-profile data
- migration behavior
- deletion behavior

Spec QA must also answer:

- what deterministic rule upgrades one memory record versus superseding it
- what evidence refs are allowed for turn-derived vs job-derived memory
- how confidence is assigned without turning projection into opaque heuristics
- how `asset_context` links to the Phase 05 asset catalog instead of raw file
  metadata or transcript snippets

## Ground

Before coding, identify the real write-side control points and the current read
side that is already waiting for this phase to finish:

- where new turns become durable events
- where job completion events can update memory
- where asset creation events can update memory
- where restore can read compact memory summary
- where prompt runtime can consume memory without raw dumps

Current grounded findings to preserve in the phase plan:

- `src/core/entities/relationship-memory.ts` already defines the canonical
  record shape and active-status rule
- `src/core/use-cases/RelationshipMemoryRepository.ts` already defines the
  reader/writer contract, including supersession
- `src/core/platform/conversation-workspace/WorkspaceSnapshotReader.ts` already
  pulls `listActiveByConversation(...)` and `WorkspaceSnapshotProjector` already
  projects `latestMemoryRef`
- `src/core/platform/conversation-restore/WorkspaceRestoreReader.ts` already
  loads active memory and projects the latest compact memory summary into the
  restore payload
- there is currently no durable adapter implementing
  `RelationshipMemoryRepository`
- there is currently no projection service or repair job that writes
  `RelationshipMemoryRecord` rows from turns, events, or job outcomes
- `SummarizationInteractor`, transcript chunking, embeddings, and prompt
  runtime still carry continuity-adjacent behavior, but they are not the right
  canonical ownership surface for relationship memory

## Build

Expected deliverables:

- durable repository adapter for `RelationshipMemoryRepository`
- schema/storage support for relationship memory records if not already present
- projection service for turn- and event-derived memory updates
- repair/rebuild path for backfilling existing conversations
- evidence-ref normalization rules for relationship memory projection
- restore/workspace integration finalized against real persisted records
- tests for continuous projection, supersession, retraction, and restore
  continuity before archive

### Target Architecture

The clean shape for Phase 06 is parallel to Phase 05:

- repositories own durable reads and writes
- a projector owns the deterministic transformation from durable evidence to
  memory records
- a projection coordinator or application service owns when projection runs
- restore/workspace read models only read canonical memory records
- prompt/search/summarization surfaces consume memory secondarily and never
  synthesize canonical memory on their own

Recommended first components:

- `RelationshipMemoryDataMapper` or equivalent durable adapter
- `RelationshipMemoryProjector` for pure record derivation and supersession
  decisions
- `RelationshipMemoryProjectionService` or `RelationshipMemoryProjectionJob`
  for turn/event driven updates and rebuilds
- optional `RelationshipMemorySummaryProjector` only if restore needs a more
  compact summary model than the current latest-record read

### Specific Architectural Patterns Required

This phase should explicitly use these patterns.

#### Repository Pattern

All writers and readers should depend on `RelationshipMemoryRepository`, not on
message repositories, event tables, and user-preference tables all at once.

#### Projector Pattern

Memory derivation and supersession rules must live in a pure projector so the
logic is deterministic, testable, and separate from database concerns.

#### Application Service / Orchestrator Pattern

One projection coordinator should own when relationship memory is recomputed or
updated after durable conversation changes. Route handlers, restore readers,
and prompt builders must not orchestrate this logic ad hoc.

#### Strategy Pattern

Memory-type extraction, confidence assignment, and supersession policy should be
expressed as narrow strategies rather than one opaque if/else chain. Good first
strategies:

- summary-to-memory exclusion strategy
- turn-derived memory extraction strategy
- job-derived memory extraction strategy
- supersession vs append strategy

#### Anti-Corruption Layer

User preferences, summaries, chunk embeddings, and prompt overlays each have
their own semantics. Phase 06 must normalize those inputs into relationship
memory evidence rather than leaking their raw shapes into the memory model.

## What Phase 06 Must Remove

Phase 06 is not complete until the codebase removes the major sources of memory
ownership drift.

### Remove Hypothetical Read-Side-Only Memory Wiring

`WorkspaceSnapshotReader` and `WorkspaceRestoreReader` already accept
`RelationshipMemoryReader`, but the phase is incomplete until a real durable
adapter exists and those readers are fed by actual persisted records rather than
test-only or optional stubs.

### Remove Summary-As-Memory Ambiguity

`src/core/use-cases/SummarizationInteractor.ts` should remain transcript
compaction infrastructure. It must not become the durable authority for goals,
decisions, commitments, or open questions.

### Remove Embeddings-As-Memory Ambiguity

`src/lib/chat/embed-conversation.ts`, `src/core/search/ConversationChunker.ts`,
and `src/adapters/SQLiteVectorStore.ts` should remain retrieval infrastructure.
They must not be treated as the canonical store for relationship memory.

### Remove Prompt-Only Continuity Ownership

`src/lib/chat/prompt-runtime.ts` may consume compact memory summaries, but it
must stop being a hidden fallback place where relationship continuity is carried
only through raw summaries, preferences, or ad hoc overlay sections.

### Remove Event-Only Memory Semantics

`src/adapters/ConversationEventDataMapper.ts` records conversation events, but
events must be evidence inputs to projection, not the final memory model.

## Implementation Sequence

1. Add or confirm durable storage and adapter support for
   `RelationshipMemoryRepository`.
2. Implement a pure projector that derives canonical memory records and
   supersession decisions from durable evidence.
3. Implement a projection coordinator that runs after the chosen durable turn
   boundary and supports rebuild/repair.
4. Integrate job and asset events only through that projection boundary, not as
   direct restore or prompt-runtime logic.
5. Finalize workspace/restore reads against real persisted memory records.
6. Add prompt-runtime and later-search consumption only as read-side clients of
   the canonical memory surface.
7. Add repair evidence and migration behavior for older conversations with no
   relationship-memory records yet.

## Phase QA

Before implementation, review whether memory extraction requires model calls.
If so, define deterministic tests around parser/projection boundaries and use
fixtures for model-dependent behavior.

## Implementation QA

Required validation:

- unit tests for projector rules by memory type and supersession behavior
- integration tests for durable repository persistence and reader behavior
- restore/workspace tests proving real memory records flow through the existing
  read models
- evidence-ref tests for turn-derived, job-derived, and asset-derived memory
- negative tests for correction, retraction, and supersession
- rebuild or repair tests for older conversations with missing memory rows
- proof that restore continuity no longer depends on transcript embeddings,
  summaries, or prompt-only continuity hacks for relationship facts

## Update

After completion, update Phase 07 with memory retrieval contracts and any
remaining transcript recall dependencies, including the exact boundary between
relationship memory retrieval and general conversation search.
