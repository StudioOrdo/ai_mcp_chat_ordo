# Phase 07: Search Surface Split

## Objective

Finish the product-level retrieval split on top of the search infrastructure we
already have so four different meanings stop sharing one ambiguous
conversation-era contract:

- relationship memory retrieval
- transcript recall
- corpus grounding
- product discovery

The repo is no longer at zero for this phase.

It already has:

- durable relationship memory records from Phase 06
- transcript embedding and vector search infrastructure
- a distinct corpus grounding service with structured payloads
- a distinct discovery search service for routes, corpus pages, and admin
  entities

What it does not yet have is a clean product-surface split for conversation
retrieval. `search_my_conversations` still means transcript-vector recall while
the product language around "memory" now refers to canonical relationship
memory. That drift is the real Phase 07 target.

Phase 07 is therefore not "build search." It is "separate retrieval products,
stabilize their contracts, and remove the old ambiguous seams that still let
transcript search masquerade as continuity."

## Source Specs

- [../relationship-memory-and-search-spec.md](../relationship-memory-and-search-spec.md)
- [../target-architecture.md](../target-architecture.md)
- [../validation-strategy.md](../validation-strategy.md)
- [phase-06-relationship-memory-projection.md](phase-06-relationship-memory-projection.md)

## Collect

Research current retrieval surfaces and classify each one before changing any
contract.

Current grounded starting points:

- `src/core/use-cases/tools/search-my-conversations.tool.ts`
- `src/lib/chat/embed-conversation.ts`
- `src/lib/chat/search-pipeline.ts`
- `src/core/search/HybridSearchEngine.ts`
- `src/core/use-cases/tools/CorpusTools.ts`
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`
- `src/core/platform/discovery-search/DiscoverySearchService.ts`
- `src/core/capability-catalog/families/conversation-capabilities.ts`
- `src/core/capability-catalog/families/corpus-capabilities.ts`
- `src/core/capability-catalog/runtime-tool-binding.ts`
- `src/frameworks/ui/chat/plugins/custom/WebSearchCard.tsx`
- `src/lib/chat/stream-preparation.ts`
- `src/lib/chat/relationship-memory-context.ts`

Collect and classify each surface as one of:

- relationship continuity substrate
- transcript recall infrastructure
- corpus grounding product service
- discovery/navigation product service
- compatibility wrapper or presentation drift

## Ground

Before coding, preserve the current codebase truths this phase must build on.

### Relationship Memory Already Exists, But Only As Canonical Continuity Data

- Phase 06 now projects durable `RelationshipMemoryRecord` rows.
- `src/lib/chat/stream-preparation.ts` injects compact relationship memory into
  prompt assembly through `withSection(...)`.
- Relationship memory is already the continuity substrate for active
  conversations.

This means Phase 07 must not re-route continuity back through transcript search
or embeddings.

### Transcript Recall Still Lives Behind `search_my_conversations`

- `src/core/use-cases/tools/search-my-conversations.tool.ts` performs vector
  similarity over `VectorStore` conversation passages.
- `src/lib/chat/embed-conversation.ts` serializes entire conversations and
  indexes them as transcript search documents.
- The current tool returns formatted excerpts, not structured relationship
  memory results.

This is transcript recall infrastructure and contract shape, not memory
retrieval.

### Corpus Grounding Is Already A Separate Service

- `src/core/platform/knowledge-access/KnowledgeAccessService.ts` already owns
  grounded corpus retrieval.
- `search_corpus` returns a structured payload with retrieval quality,
  grounding state, follow-up guidance, and optional prefetched section content.
- `src/lib/chat/search-pipeline.ts` and `src/core/search/HybridSearchEngine.ts`
  are reusable infrastructure feeding this product surface.

Phase 07 should preserve this separation rather than fold corpus answers back
into generic search results.

### Product Discovery Is Already A Separate Service

- `src/core/platform/discovery-search/DiscoverySearchService.ts` already
  aggregates shell routes, corpus discovery matches, and admin entities.
- The prior app-facing global-search wrapper has been removed; discovery now
  remains available as a product service boundary without a dedicated shell
  search UI.

This is a navigation and discovery surface, not a grounding or continuity
surface.

### The Dedicated Shell Search UI Is Optional And Should Be Removed

- The shell-owned global search bar is app-shell UI plumbing, not a core
  retrieval capability.
- The agent already has tool-routed access to transcript recall, corpus
  grounding, and discovery.
- Keeping a separate search bar and controller adds UI maintenance without
  adding a new domain capability.

Phase 07 should keep discovery as a service boundary but remove the dedicated
search UI surface unless a later operator workflow proves it is necessary.

### Tool Catalog And UI Still Carry Ambiguous Search Language

- `src/core/capability-catalog/families/conversation-capabilities.ts` still
  teaches the model that `search_my_conversations` is the recall tool when the
  user asks what was discussed before.
- `src/frameworks/ui/chat/plugins/custom/WebSearchCard.tsx` still renders
  multiple semantically different search tools through one generic search card
  family.
- `src/core/capability-catalog/runtime-tool-binding.ts` still binds
  `search_my_conversations` directly to vector-store transcript recall.

These are the primary compatibility seams that Phase 07 must clean up.

## Decide

Decide the public product contracts first, then map current tools and
infrastructure into them.

### 1. Relationship Memory Retrieval

Purpose:

- answer continuity questions such as goals, preferences, decisions,
  commitments, milestones, and unresolved questions
- return canonical memory records with evidence-aware summaries
- support prompt continuity and future next-action reasoning

Primary data:

- `RelationshipMemoryRecord`
- workspace/restore memory projections
- evidence refs from messages, jobs, and assets

### 2. Transcript Recall

Purpose:

- answer forensic "what did we say before" questions
- search archived or active conversation transcript passages
- cite prior turns without pretending they are canonical memory

Primary data:

- embedded conversation transcript passages
- vector index rows
- transcript metadata such as conversation id and turn index

### 3. Corpus Grounding

Purpose:

- answer library and business-corpus questions with grounding metadata
- keep locate-first and cite-first behavior intact
- continue prefetched section support where allowed

Primary data:

- corpus sections and documents
- hybrid search output
- canonical corpus paths and access rules

### 4. Product Discovery

Purpose:

- find routes, admin entities, product destinations, and discoverable corpus
  entries
- support shell navigation and operator workflows

Primary data:

- route metadata
- admin search entities
- corpus summary and section discovery entries

Rejected approaches must include:

- one generic search API for all product meanings
- using transcript recall as the continuity model
- using corpus grounding to answer relationship memory questions
- using discovery results as if they were grounded knowledge
- preserving `search_my_conversations` as the canonical long-term product name
  if it still means two different things to the model and the team

## Build

Expected deliverables:

- a relationship-memory retrieval contract backed by Phase 06 records
- a transcript-recall contract that explicitly owns transcript/vector recall
- corpus grounding preserved behind `KnowledgeAccessService`
- product discovery preserved behind `DiscoverySearchService`
- capability catalog and prompt hints updated to reflect the split
- compatibility plan for old `search_my_conversations` callers
- UI presentation updates where agent tool results still collapse distinct
  retrieval meanings into one generic search card language
- removal of the shell-owned global search UI and its controller/action
  plumbing

### Target Architecture

The clean shape for Phase 07 should separate product services from shared
infrastructure.

- shared infrastructure may continue to include embeddings, vector stores,
  hybrid retrieval, scoring, and index stores
- product services should expose different request and response contracts for
  memory retrieval, transcript recall, corpus grounding, and discovery
- catalog/runtime binding should depend on those product services instead of
  binding tool names directly to low-level stores or formatters
- prompt assembly should consume compact memory context from the relationship
  memory surface, never raw transcript-search dumps

Recommended first components:

- `RelationshipMemorySearchService` or equivalent read-side application service
- `TranscriptRecallService` or equivalent wrapper around transcript search
  infrastructure
- continued ownership of corpus retrieval by `KnowledgeAccessService`
- continued ownership of discovery by `DiscoverySearchService`
- thin capability and presentation adapters that translate tool calls into the
  correct product service

### Specific Architectural Patterns Required

This phase should explicitly use these patterns.

#### Application Service Pattern

Each product surface should have its own application service. Tool bindings,
route handlers, and prompt builders should call those services, not vector
stores, repositories, or hybrid engines directly.

#### Facade Pattern

If `search_my_conversations` must survive temporarily, keep it as a narrow
compatibility facade over the new transcript recall service or memory retrieval
service. Do not let it remain the place where product meaning is decided.

#### Strategy Pattern

Ranking and shaping rules differ by product surface. Transcript recall,
relationship-memory lookup, corpus grounding, and discovery should each own
their own ranking and result-shaping strategies rather than sharing one generic
formatter.

#### Adapter Pattern

Capability catalog bindings and UI cards should adapt service-specific payloads
for chat/runtime consumption without collapsing those payloads into one common
search blob.

#### Anti-Corruption Layer

Transcript chunks, relationship-memory records, corpus sections, and discovery
entities are different models. Phase 07 must stop those models from leaking
into one another through ambiguous naming and shared presentation contracts.

## What Phase 07 Must Remove

Phase 07 is not complete until the codebase removes the main sources of
retrieval ambiguity.

### Remove Memory-Vs-Transcript Ambiguity From `search_my_conversations`

Today `search_my_conversations` is transcript-vector recall only, but its name
and prompt hint encourage continuity-style use. The phase must either rename it
to a transcript-specific contract or reduce it to a temporary compatibility
wrapper with explicit deprecation.

### Remove Direct Tool Binding To Transcript Infrastructure

`src/core/capability-catalog/runtime-tool-binding.ts` currently binds
`search_my_conversations` straight to `VectorStore` and the embedder. The phase
should replace that with a product-service dependency so tool binding no longer
decides product meaning.

### Remove Generic Search Presentation Drift

`src/frameworks/ui/chat/plugins/custom/WebSearchCard.tsx` currently renders
multiple search meanings under one generic presentation family. The phase
should stop treating transcript recall, corpus grounding, and discovery as if
they were the same result type.

### Remove The Dedicated Shell Search UI

The shell-level global search bar is not required once the agent owns search as
an internal capability. Phase 07 should remove the shell search bar, its action
wrapper, and its controller plumbing so discovery remains a service, not a
standalone UI feature.

### Remove Prompt-Level Dependency On Transcript Search For Continuity

Prompt continuity already uses compact relationship memory in
`src/lib/chat/stream-preparation.ts`. Phase 07 must preserve that direction and
remove any remaining prompt instructions or retrieval assumptions that teach the
system to use transcript recall as the primary continuity answer.

### Remove Shared Vocabulary That Hides Product Boundaries

Capability docs, prompt hints, and tests should stop using "search" as a single
meaning when the real behavior is memory retrieval, transcript recall, corpus
grounding, or discovery.

## Implementation Sequence

Build this phase in the smallest clean slices.

1. Introduce a relationship-memory retrieval service over Phase 06 records with
   a structured response and evidence-aware summaries.
2. Introduce a transcript recall service that wraps current transcript indexing
   and vector lookup without changing corpus or discovery contracts.
3. Rebind capability catalog/runtime wiring so conversation-memory and
   transcript-recall tools target those new services instead of raw search
   infrastructure.
4. Update prompt hints and tool directives so the model reaches for the correct
   retrieval surface.
5. Split UI/result presentation where generic search rendering currently hides
   semantically different results.
6. Add compatibility coverage for old tool names, then deprecate or remove the
   ambiguous contract.

## Spec QA

Each retrieval surface must prove a different contract.

- a user asks what they decided before and receives memory-backed results,
  not transcript excerpts
- a user asks what was said in an old turn and receives transcript recall with
  turn evidence
- a user asks a corpus question and receives grounded corpus results with the
  current `KnowledgeAccessService` semantics preserved
- an operator searches for a route, document, or admin entity and receives
  discovery results, not grounding or memory payloads

## Phase QA

Before implementation, confirm that this phase does not rewrite the entire
embedding stack unless a local contract change requires it. Shared
infrastructure is allowed. Shared product meaning is not.

Also confirm that:

- restore and stream preparation continue to treat relationship memory as the
  continuity substrate
- transcript recall remains available for archived/history use cases
- corpus grounding and discovery keep their existing service owners

## Implementation QA

Required validation:

- unit tests for each new service contract
- focused tests proving relationship-memory retrieval does not fall back to
  transcript passages
- focused tests proving transcript recall does not return canonical memory
  records
- regression tests for `KnowledgeAccessService` and `search_corpus`
- regression tests for `DiscoverySearchService` and any current discovery
  consumers
- capability-catalog/runtime-binding tests for renamed or compatibility tool
  contracts
- prompt/runtime tests proving memory context still comes from relationship
  memory, not transcript recall
- UI presentation tests if search cards are split by semantic family

## Update

After completion, update Phase 08 so prompt binding and retrieval context refs
record which product surface supplied continuity, transcript evidence,
grounding, or discovery results.
