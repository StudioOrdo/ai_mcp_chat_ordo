# Phase 2 Implementation Spec — Knowledge Access Split

## Objective

Turn Phase 2 of the platform roadmap into a code-facing implementation plan
that starts from the completed Phase 1 runtime seam and cleanly separates
grounded retrieval from discovery search.

This phase should not introduce a new search engine. It should establish two
clear platform seams over the existing production-proven search core:

- `KnowledgeAccessService` for grounded retrieval, citations, evidence
  packaging, and section prefetch
- `DiscoverySearchService` for route search, admin entity lookup, corpus
  browsing, and shell discovery

## Phase 1 Handoff

Phase 1 closed the capability-side ownership problem by introducing a canonical
runtime seam. Phase 2 should apply the same rule to search ownership.

Phase 1 now provides:

- one canonical runtime surface in `src/core/platform/capability-runtime/`
- explainable execution planning on the runtime surface
- runtime-driven registry assembly and validation

Phase 2 should preserve that shape by introducing service seams beside current
search consumers rather than rebuilding retrieval behavior in tool commands,
global search helpers, or agent-facing code.

## Current Code Grounding

Grounded retrieval is already centered on the hybrid search stack, but result
shaping and prefetch policy are currently mixed into corpus tools.

Current grounded retrieval owners:

- `src/core/search/HybridSearchEngine.ts` is the canonical hybrid retrieval
  core
- `src/core/search/SearchHandlerChain.ts` composes the hybrid/BM25/keyword
  fallback stack
- `src/core/use-cases/LibrarySearchInteractor.ts` applies role-aware audience
  filtering over retrieval results
- `src/core/use-cases/tools/CorpusTools.ts` currently owns grounded result
  shaping, canonical citation references, retrieval quality, follow-up state,
  and top-result prefetch behavior via `SearchCorpusCommand` and
  `GetSectionCommand`
- `src/lib/corpus-library.ts` exposes a lighter public corpus facade with its
  own result mapping layer

Discovery search is already centered on a separate set of helpers, but the
seam is implicit rather than contractual.

Current discovery search owners:

- `src/lib/search/global-search.ts` composes route discovery, corpus browsing,
  corpus section search, and admin entity search into one result list
- `src/lib/admin/search/admin-search.ts` owns admin entity lookup and SQL
  shaping
- `src/lib/shell/shell-navigation.ts` owns route resolution for command and
  shell discovery

## Current Problem Statement

Today the codebase has a strong search core but unclear ownership above it.

The main overlap is:

1. grounded retrieval and citation shaping are embedded in corpus tool command
   logic
2. discovery search composes route, corpus, and admin search in a product
   helper rather than behind a dedicated service
3. corpus search result shaping exists in more than one surface
4. audience filtering, canonical path building, retrieval quality, and
   follow-up guidance are not yet owned by one explicit platform seam

This makes agent grounding and UI discovery harder to reason about than they
need to be.

## Scope

### In Scope

- introduce `KnowledgeAccessService` beside current corpus tools
- introduce `DiscoverySearchService` beside current global/admin/shell search
  surfaces
- migrate corpus prefetch and grounded result shaping behind
  `KnowledgeAccessService`
- preserve the hybrid search engine as the canonical retrieval core
- add focused parity and migration tests for grounded retrieval and discovery
  search

### Out of Scope

- replacing `HybridSearchEngine`
- rewriting corpus indexing, embedding, or retrieval storage
- agent facade work
- execution timeline work
- revision platform work

## Canonical Files To Touch

### Existing Files

- `src/core/search/HybridSearchEngine.ts`
- `src/core/use-cases/LibrarySearchInteractor.ts`
- `src/core/use-cases/tools/CorpusTools.ts`
- `src/lib/corpus-library.ts`
- `src/lib/search/global-search.ts`
- `src/lib/admin/search/admin-search.ts`
- `src/lib/shell/shell-navigation.ts`

### New Files

- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`
- `src/core/platform/discovery-search/DiscoverySearchService.ts`
- `src/core/platform/knowledge-access/KnowledgeAccessService.test.ts`
- `src/core/platform/discovery-search/DiscoverySearchService.test.ts`

The exact filenames can move slightly, but the ownership boundary should stay
the same.

## Target Service Shape

Phase 2 should introduce two read-oriented platform seams.

### Knowledge Access

This service should answer:

1. what evidence best matches a query?
2. what citations or canonical references support it?
3. whether a section should be prefetched automatically
4. what retrieval quality and next-step guidance should be surfaced?

The initial implementation should be derived from current search and shaping
behavior, not rewritten independently.

Compatibility rule for the first migration slices:

- `KnowledgeAccessService` may adopt the broader platform contract from
  `contracts-and-interfaces.md`, but `SearchCorpusCommand` and
  `GetSectionCommand` must continue to expose the current external
  compatibility payloads during Phase 2 rollout
- the initial adapter boundary must preserve current
  `SearchCorpusPayload`/`GetSectionPayload` fields, including
  `groundingState`, `followUp`, `retrievalQuality`, `results`, and
  `prefetchedSection`
- platform-shaped `citations`, `evidence`, and `prefetchedSections` should be
  introduced behind the service seam first and only replace external payloads
  in a later explicitly approved migration

### Discovery Search

This service should answer:

1. what routes, admin entities, documents, or sections match a discovery query?
2. what product-facing links should be shown?
3. how should mixed discovery results be ranked and deduplicated?

Discovery search should stay intentionally simpler than grounded retrieval and
must not absorb citation or evidence-packaging behavior.

Compatibility rule for the first migration slices:

- `DiscoverySearchService` must preserve current route/admin/corpus result
  ranking and deduplication behavior before introducing any contract cleanup
- the initial service must preserve the current role-resolution behavior from
  `searchGlobalEntities()`: shell/admin discovery uses the full role set,
  while corpus discovery currently derives visibility from the first available
  role or `ANONYMOUS`

## Corrected Phase 2 Assumptions

The roadmap and target docs are directionally right, but implementation should
start from these grounded assumptions:

- the hybrid search engine is already the canonical retrieval core and should
  remain unchanged in the first slices
- `SearchCorpusCommand` is the smallest grounded-retrieval seam because it
  already centralizes retrieval quality, follow-up guidance, canonical result
  shaping, and prefetch policy
- `searchGlobalEntities()` is the smallest discovery seam because it already
  composes shell routes, corpus browsing, corpus section hits, and admin entity
  results into one ranked result list
- `LibrarySearchInteractor` should remain a retrieval/filtering dependency of
  the new knowledge-access layer rather than becoming the service boundary by
  itself
- corpus-library helpers should become adapters over `KnowledgeAccessService`
  where practical, rather than a parallel canonical shaping layer
- the current `SearchCorpusPayload` and `GetSectionPayload` contracts are
  already consumed by tool formatters, evals, and search tests, so the first
  service-backed slices must preserve them exactly
- the current `searchGlobalEntities()` role normalization is a behavioral
  contract for Phase 2 parity even if it is later redesigned

## Implementation Slices

### Slice 1: Introduce Read-Only KnowledgeAccessService

Tasks:

- create `KnowledgeAccessService` as a read-only platform seam
- wrap current corpus retrieval, citation shaping, and prefetch decision logic
  without changing behavior
- keep `SearchCorpusCommand` and `GetSectionCommand` as initial adapters over
  the new service
- explicitly define adapter helpers that map service-native responses back to
  the current tool payload contracts

Acceptance criteria:

- grounded retrieval can be requested through one service boundary
- current tool outputs remain behaviorally stable
- `SearchCorpusPayload` and `GetSectionPayload` remain wire-compatible for
  existing callers and tests
- no retrieval engine code is replaced

### Slice 2: Move Prefetch And Grounded Result Shaping Behind KnowledgeAccessService

Tasks:

- migrate top-result prefetch policy from `CorpusTools.ts` into the new service
- migrate canonical path / citation-ready result shaping into the new service
- centralize retrieval quality and follow-up guidance there as well

Acceptance criteria:

- `SearchCorpusCommand` becomes a thin adapter over `KnowledgeAccessService`
- grounded retrieval output shape remains stable across tool and library
  consumers
- anonymous-role restrictions stay explicit and tested
- tool formatter behavior for anonymous users remains unchanged

### Slice 3: Introduce Read-Only DiscoverySearchService

Tasks:

- create `DiscoverySearchService` over current route, corpus-browse, and admin
  entity discovery paths
- move ranking and deduplication ownership behind the new service
- keep `searchGlobalEntities()` as the initial adapter consumer
- explicitly preserve current role normalization and corpus visibility behavior
  for parity before redesigning it

Acceptance criteria:

- one service can power global discovery search without changing UX behavior
- discovery results remain ranked and deduplicated as before
- route and admin entity coverage do not regress
- current role-sensitive discovery results remain behaviorally stable

### Slice 4: Split Corpus Browsing From Grounded Retrieval In Consumer Surfaces

Tasks:

- migrate `global-search.ts` to consume `DiscoverySearchService`
- migrate corpus-library search shaping toward `KnowledgeAccessService`
- leave product-facing contracts stable while reducing duplicate shaping logic

Acceptance criteria:

- discovery consumers stop reaching directly into grounded retrieval shaping
- corpus-library search behavior stays stable for current callers
- mixed search ownership is reduced rather than increased

### Slice 5: Add Contract And Migration Parity Coverage

Tasks:

- add focused contract tests for knowledge access and discovery search
- add migration tests that compare current and service-backed outputs
- document the intentional remaining raw ownership boundaries

Acceptance criteria:

- grounded retrieval and discovery search both have explicit focused gates
- service-backed outputs are parity-tested before old shaping logic is deleted
- deletion decisions are backed by tests, not confidence alone

## Coding Rules For This Phase

1. Do not replace the hybrid search engine in Phase 2.
2. Do not conflate route discovery with grounding.
3. Do not move evidence-packaging logic into UI helpers or global-search code.
4. Do not create a second canonical search core beside `HybridSearchEngine`.
5. Prefer service adapters during migration over broad search rewrites.

## Review Checklist

Every Phase 2 PR should answer yes to all of these:

1. Does this strengthen one canonical knowledge or discovery owner?
2. Does this reduce duplicate shaping logic instead of moving it around?
3. Are grounded retrieval and discovery search more distinct after the change?
4. Is focused validation present for the migrated slice?
5. Did this preserve the existing retrieval engine and current product
   behavior?

## Focused Validation Targets

Phase 2 should close slices with focused validation for:

- grounded retrieval parity tests
- knowledge-access contract tests
- discovery search regression tests
- global search and corpus tool migration tests

Representative current files that should stay in the validation orbit:

- `src/core/use-cases/tools/CorpusTools.ts`
- `src/lib/search/global-search.ts`
- `src/lib/admin/search/admin-search.ts`
- `src/lib/corpus-library.ts`

Representative current regression suites that should remain in scope:

- `src/core/use-cases/tools/search-corpus.tool.test.ts`
- `src/core/use-cases/tools/get-section.tool.test.ts`
- `tests/search/tool-integration.test.ts`
- `src/core/tool-registry/ToolResultFormatter.test.ts`
- `tests/global-search.test.ts`

The initial service-backed slices should also add explicit parity coverage for:

- service response to tool-payload adapter mapping
- anonymous formatting behavior after knowledge-access delegation
- current discovery role normalization and corpus visibility behavior

No Phase 2 slice should be closed using doc-only or diff-only validation.

## Definition Of Done

Phase 2 is complete only when:

- `KnowledgeAccessService` exists as the canonical grounded retrieval seam
- `DiscoverySearchService` exists as the canonical discovery seam
- corpus prefetch and grounded result shaping are owned by
  `KnowledgeAccessService`
- global discovery search consumes `DiscoverySearchService`
- existing tool and discovery payloads remain compatibility-stable throughout
  the migration until an explicit contract migration lands
- grounded retrieval is distinct from discovery search without changing the
  underlying hybrid search core

## Current Implementation Status

The current codebase has completed Phase 2 for the current roadmap scope.

Implemented service seams:

- `src/core/platform/knowledge-access/KnowledgeAccessService.ts` now exposes a
  canonical `KnowledgeAccessResponse` for grounded retrieval and keeps
  compatibility adapters for existing `search_corpus` and `get_section`
  payloads during rollout
- `src/core/platform/discovery-search/DiscoverySearchService.ts` now owns the
  current discovery composition behavior for routes, corpus browsing, corpus
  section hits, and admin entity results, and now exposes the documented
  `DiscoverySearchRequest` / `DiscoverySearchResponse` contract with the
  legacy array-returning search surface retained only as an adapter

Implemented consumer migrations:

- `src/core/use-cases/tools/CorpusTools.ts` now delegates `SearchCorpusCommand`
  and `GetSectionCommand` to `KnowledgeAccessService`, with
  `SearchCorpusCommand` using the explicit compatibility adapter surface
- `src/lib/corpus-library.ts` now routes corpus search and full-section reads
  through `KnowledgeAccessService` while preserving current facade outputs via
  shared adapters instead of rebuilding canonical links or section content
  normalization locally; the stale pre-migration section interactor has been
  removed
- `src/lib/search/global-search.ts` now delegates discovery composition to
  `DiscoverySearchService`

Implemented parity and regression coverage:

- `src/core/platform/knowledge-access/KnowledgeAccessService.test.ts` covers
  the canonical grounded retrieval response, compatibility payload adapter
  mapping, and anonymous no-prefetch behavior
- `src/core/platform/discovery-search/DiscoverySearchService.test.ts` covers
  current discovery role normalization, admin-only discovery behavior, and the
  contract-shaped discovery response
- `src/lib/corpus-library.test.ts` covers the legacy corpus facade adapters
  after migrating search and section reads onto `KnowledgeAccessService`
- `src/core/use-cases/tools/search-corpus.tool.test.ts` and
  `src/core/use-cases/tools/get-section.tool.test.ts` remained green after the
  service extraction
- `tests/search/tool-integration.test.ts` remained green after migrating the
  corpus facade onto `KnowledgeAccessService`
- `src/core/tool-registry/ToolResultFormatter.test.ts` remained green after the
  grounded retrieval migration, preserving anonymous formatting behavior
- `tests/global-search.test.ts` and `tests/global-search-actions.test.ts`
  remained green after migrating `global-search` to `DiscoverySearchService`

Focused validation currently in use:

- `npm test -- "src/core/platform/knowledge-access/KnowledgeAccessService.test.ts" "src/lib/corpus-library.test.ts" "src/core/use-cases/tools/search-corpus.tool.test.ts"`
- `npm test -- "src/core/platform/discovery-search/DiscoverySearchService.test.ts" "tests/global-search.test.ts" "tests/global-search-actions.test.ts" "src/lib/corpus-library.test.ts"`
- `npm test -- "src/core/platform/knowledge-access/KnowledgeAccessService.test.ts" "src/core/platform/discovery-search/DiscoverySearchService.test.ts" "src/lib/corpus-library.test.ts" "src/core/use-cases/tools/search-corpus.tool.test.ts" "src/core/use-cases/tools/get-section.tool.test.ts" "tests/search/tool-integration.test.ts" "src/core/tool-registry/ToolResultFormatter.test.ts" "tests/global-search.test.ts" "tests/global-search-actions.test.ts"`
- `npm test -- "src/core/platform/knowledge-access/KnowledgeAccessService.test.ts" "src/core/platform/discovery-search/DiscoverySearchService.test.ts"`
- `npm test -- "src/core/platform/knowledge-access/KnowledgeAccessService.test.ts" "src/core/platform/discovery-search/DiscoverySearchService.test.ts" "src/core/use-cases/tools/search-corpus.tool.test.ts" "src/core/use-cases/tools/get-section.tool.test.ts" "tests/search/tool-integration.test.ts" "src/core/tool-registry/ToolResultFormatter.test.ts" "tests/global-search.test.ts" "tests/global-search-actions.test.ts"`

Remaining follow-up work after Phase 2 should be limited to future explicit
contract migrations that replace the current compatibility payloads with the
broader platform contracts. That follow-up is beyond this phase.
