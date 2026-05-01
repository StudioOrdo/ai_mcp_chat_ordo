# Phase 02 - Search Index Execution

## Objective
Remove product-path fetch-all search behavior. Corpus search, conversation recall,
and MCP embedding search must use bounded indexed retrieval. Node should
orchestrate query processing, reciprocal-rank fusion, policy, and formatting; it
should not deserialize every matching embedding row to score search in process.

## Current Code Grounding

### Current Strengths
- `src/core/search/HybridSearchEngine.ts` is already the canonical hybrid-search
  orchestrator and uses `ReciprocalRankFusion`, `ResultFormatter`, and query
  processors.
- `src/core/search/EmbeddingPipeline.ts` owns chunk -> embed -> normalize ->
  store for corpus and conversation sources.
- `src/core/search/EmbeddingPipelineFactory.ts` already uses a factory/strategy
  shape for source-specific chunkers (`markdown`, `conversation`).
- `src/adapters/SQLiteVectorStore.ts` persists embeddings in one durable table
  with source/type/level indexes.
- `src/lib/chat/embed-conversation.ts` indexes archived conversations through
  the same embedding pipeline instead of a separate conversation-search store.
- `src/lib/chat/search-pipeline.ts` and `mcp/operations-server.ts` both assemble
  search through the same `HybridSearchEngine`/handler-chain stack.

### Current Gaps
| Finding | Evidence | Required Change |
| --- | --- | --- |
| Hybrid search fetches all candidate embeddings into Node. | `HybridSearchEngine.search(...)` calls `vectorStore.getAll(...)`, maps every embedding through `dotSimilarity(...)`, and loops the same records for BM25. | Replace with bounded vector and keyword candidate retrieval ports. |
| SQLite vector retrieval deserializes every matching embedding row. | `SQLiteVectorStore.getAll(...)` selects `*` and `mapRow(...)` deserializes every embedding BLOB. | Add an indexed/bounded query path that returns ranked candidate ids first and hydrates only final ids. |
| BM25 fallback still full-scans embedding records. | `BM25SearchHandler.search(...)` calls `vectorStore.getAll(...)` and scores content in JavaScript. | Replace fallback with the same indexed keyword candidate path or remove fallback after FTS is active. |
| Conversation search full-scans all conversation embeddings. | `search-my-conversations.tool.ts` calls `vectorStore.getAll({ sourceType: "conversation", chunkLevel: "passage" })`, filters by `sourceId.startsWith(userId)`, then scores vectors in Node. | Add owner-scoped indexed conversation retrieval; do not filter ownership after fetch-all. |
| BM25 index is stats-only, not executable retrieval. | `SQLiteBM25IndexStore` stores aggregate stats JSON in `bm25_stats`; there is no FTS-backed candidate table. | Introduce FTS5 keyword index synchronized from embedding rows/chunks. |
| Legacy keyword fallback duplicates search core. | `LegacyKeywordHandler` scans corpus documents/sections when BM25 is unavailable. | Greenfield hard cutoff: delete or demote this from product search once SQL-backed search is active. |
| Change detection orphan cleanup uses full row hydration. | `ChangeDetector.findOrphaned(...)` calls `vectorStore.getAll({ sourceType })` only to read source ids. | Add a metadata-only `listSourceIds(...)` port method. |

## Target Architecture

### Search Ports
Replace product search dependence on `getAll(...)` with explicit retrieval ports:

```ts
interface VectorSearchStore {
  searchSimilar(query: {
    embedding: Float32Array;
    filters: SearchFilters;
    limit: number;
  }): RankedSearchCandidate[];

  hydrateByIds(ids: readonly string[]): EmbeddingRecord[];
  listSourceIds(sourceType: string): string[];
}

interface KeywordSearchStore {
  searchKeyword(query: {
    terms: readonly string[];
    rawQuery: string;
    filters: SearchFilters;
    limit: number;
  }): RankedSearchCandidate[];

  rebuildKeywordIndex(records: readonly SearchIndexDocument[]): void;
}
```

`RankedSearchCandidate` should carry only `id`, `rank`, `score`, and branch
metadata. Full `EmbeddingRecord` hydration happens after RRF selects final ids.

### SQLite Adapter
- Keep `embeddings` as the durable source of chunk content, metadata, and vector
  bytes.
- Add `embedding_fts` using FTS5 over `content`, `heading`, and enough untrusted
  text metadata to support keyword retrieval.
- Add synchronization in `SQLiteVectorStore.upsert(...)` and `delete(...)` so
  embedding rows and FTS rows cannot drift.
- Add filter indexes needed for bounded retrieval:
  - `source_type`
  - `chunk_level`
  - `source_id`
  - conversation owner prefix or explicit owner metadata extraction
  - metadata class/audience/persona if those filters remain product-supported
- For vector search on SQLite, register a deterministic similarity function when
  available and query with `ORDER BY vector_similarity(embedding, ?) DESC LIMIT ?`.
  If this SQLite runtime cannot score BLOB vectors in SQL, isolate the temporary
  fallback behind an adapter-only `SQLiteVectorSearchStore` implementation and
  keep product code on the bounded port.

### Hybrid Orchestration
`HybridSearchEngine` remains the one canonical search orchestrator:
1. Process the query for vector and keyword branches.
2. Embed the vector query.
3. Ask `VectorSearchStore.searchSimilar(...)` for vector top-K ids.
4. Ask `KeywordSearchStore.searchKeyword(...)` for FTS top-K ids.
5. Fuse candidate ids with `reciprocalRankFusion(...)`.
6. Hydrate final ids only.
7. Format/dedupe results with the existing formatter helpers.

### Conversation Recall
`search_my_conversations` must use the same indexed retrieval shape:
- query `sourceType = "conversation"`;
- enforce owner scope before retrieval, not after hydration;
- use `ConversationChunker` metadata for `conversationId` and `turnIndex`;
- format results exactly as today unless the output contract is intentionally
  changed.

### MCP
`mcp/operations-server.ts` currently assembles the same search stack directly.
After this phase it should either:
- call a shared `createSearchHandler(...)` factory used by app and MCP, or
- receive the same indexed stores through the dependency graph.

Do not leave MCP embedding search on the old full-scan stack.

## SOLID / Clean Boundaries
- Single Responsibility: stores retrieve candidates and hydrate rows; the engine
  fuses and formats; tools validate and present.
- Open/Closed: new search sources add filter/index mappings without creating a
  second search engine.
- Interface Segregation: product search depends on bounded candidate retrieval,
  while indexing/change detection uses source-id and content-hash methods.
- Dependency Inversion: tools and MCP depend on search ports/factories, not
  `SQLiteVectorStore` internals.

## DRY Rules
- Keep one `HybridSearchEngine`; do not create separate corpus, MCP, and
  conversation search engines.
- Reuse query processors, RRF, and result formatter helpers.
- Reuse one indexed SQLite adapter path for app and MCP.
- Keep in-memory search behavior only as a test double implementing the same
  ports.

## GoF Patterns
- Strategy: vector retrieval and keyword retrieval are interchangeable storage
  strategies behind ports.
- Adapter: SQLite adapts the `embeddings` and FTS tables into search candidate
  ports.
- Chain of Responsibility: keep handler-chain degraded routing only for real
  capability degradation, not as a permanent product full-scan fallback.
- Factory: centralize construction of search handlers/stores for app and MCP.
- Facade: expose search through `SearchHandler`/tool descriptors, not low-level
  stores.

## Hard Cutover Rules
1. Product search code must not call `vectorStore.getAll(...)`.
2. `getAll(...)` may remain only for test utilities or non-search diagnostics, or
   be deleted if the new ports cover all remaining use.
3. Do not leave `BM25SearchHandler` as a JavaScript full-scan fallback.
4. Do not leave `LegacyKeywordHandler` in the production search chain after FTS
   keyword retrieval is available.
5. Do not filter conversation ownership after loading all conversation
   embeddings.
6. Do not create a parallel search core beside `HybridSearchEngine`.

## Implementation Steps

### Step 1 - Search Port Split
1. Add `RankedSearchCandidate`, `SearchFilters`, vector candidate retrieval,
   keyword candidate retrieval, `hydrateByIds(...)`, and `listSourceIds(...)`
   contracts.
2. Update `ChangeDetector.findOrphaned(...)` to use `listSourceIds(...)`, not
   hydrated records.
3. Keep `EmbeddingPipeline` writes behind the existing vector-store upsert/delete
   contract, or split indexing writes into an explicit `EmbeddingIndexWriter`.

### Step 2 - SQLite Indexed Retrieval
1. Extend `src/lib/db/tables.ts` with `embedding_fts` and any supporting indexes.
2. Update `SQLiteVectorStore.upsert(...)` to write embedding rows and FTS rows in
   one transaction.
3. Update `SQLiteVectorStore.delete(...)` to delete both embedding and FTS rows.
4. Implement `searchSimilar(...)` with bounded SQL retrieval.
5. Implement `searchKeyword(...)` with FTS5 `MATCH`, `bm25(...)`, filters, and
   `LIMIT`.
6. Implement `hydrateByIds(...)` preserving fused-rank id order.

### Step 3 - Hybrid Engine Cutover
1. Rewrite `HybridSearchEngine.search(...)` to use candidate ports instead of
   `getAll(...)`.
2. Fuse ids only, then hydrate final rows.
3. Preserve current `HybridSearchResult` output fields.
4. Preserve vector-only and keyword-only result behavior.

### Step 4 - Product And MCP Cutover
1. Replace `search_my_conversations` full scan with owner-scoped indexed
   retrieval.
2. Replace `BM25SearchHandler` full scan with indexed keyword retrieval or remove
   it if `HybridSearchEngine` handles keyword-only degradation.
3. Remove `LegacyKeywordHandler` from app/MCP product search chains after FTS is
   active.
4. Share app and MCP search construction so `mcp/operations-server.ts` cannot
   drift from `src/lib/chat/search-pipeline.ts`.

### Step 5 - Cleanup
1. Delete or quarantine JavaScript full-scan search helpers from production
   paths.
2. Keep `BM25Scorer` only if needed for deterministic unit parity or remove it
   after FTS `bm25(...)` owns keyword ranking.
3. Keep `InMemoryVectorStore` and `InMemoryBM25IndexStore` as test doubles only.
4. Add guardrail tests that fail if production search files call
   `vectorStore.getAll(...)`.

## Cleanup Targets
- `src/core/search/HybridSearchEngine.ts`
- `src/core/search/SearchHandlerChain.ts`
- `src/core/search/ports/VectorStore.ts`
- `src/core/search/ports/BM25IndexStore.ts`
- `src/adapters/SQLiteVectorStore.ts`
- `src/adapters/SQLiteBM25IndexStore.ts`
- `src/core/search/ChangeDetector.ts`
- `src/core/use-cases/tools/search-my-conversations.tool.ts`
- `src/lib/chat/search-pipeline.ts`
- `mcp/operations-server.ts`
- tests that assert JavaScript BM25 fallback as a product behavior

## Positive Tests
- Vector top-K returns the same top result as the current dot-product scorer on a
  deterministic fixture.
- FTS keyword query returns expected chunk ids and participates in RRF.
- Hybrid search preserves current `HybridSearchResult` shape.
- `search_corpus` output remains compatible with current tool formatter tests.
- `search_my_conversations` returns only the current user's conversation chunks.
- MCP `search_similar` uses the same indexed retrieval path as app search.

## Negative Tests
- Malformed filters are rejected before SQL execution.
- Product search does not call `vectorStore.getAll(...)`.
- Top-K search does not deserialize every embedding row.
- Conversation search does not fetch another user's chunks before filtering.
- Deleted embedding source removes matching FTS rows.
- Stale/missing FTS index does not fall back to full corpus scans.

## Edge Tests
- Vector-only matches still format correctly when keyword results are empty.
- Keyword-only matches still format correctly when vector embedder is unavailable.
- Empty index returns empty results without fallback scans.
- `ChangeDetector.findOrphaned(...)` handles thousands of source ids without
  hydrating embeddings.
- Large fixture with thousands of rows proves bounded hydration.

## Focused Validation Commands
```bash
npm exec vitest run \
  tests/search/hybrid-search-engine.test.ts \
  tests/search/search-handler-chain.test.ts \
  tests/search/sqlite-stores.test.ts \
  tests/search/tool-integration.test.ts \
  tests/search/mcp-embedding-tool.test.ts \
  tests/search/embedding-pipeline.test.ts \
  src/core/search/corpus-indexing.test.ts \
  src/core/use-cases/tools/search-my-conversations.tool.test.ts \
  src/lib/capabilities/shared/embedding-tool.test.ts \
  tests/mcp/transport/operations-mcp-stdio.test.ts

npm run typecheck
```

## Done Criteria
- Product search no longer performs full embedding scans in Node.
- Corpus, conversation, and MCP embedding search all use bounded indexed
  retrieval.
- FTS keyword retrieval replaces JavaScript BM25/full corpus fallback in product
  paths.
- Final hydration is limited to fused candidate ids.
- Search tests cover vector, keyword, hybrid, conversation ownership, empty,
  malformed, deletion sync, MCP parity, and large-fixture behavior.
- Typecheck and full suite pass.

## Implementation Notes
- `VectorStore` now exposes bounded candidate retrieval via
  `searchSimilar(...)`, `searchKeyword(...)`, final-row `hydrateByIds(...)`, and
  metadata-only `listSourceIds(...)`.
- `SQLiteVectorStore` writes `embeddings` and `embedding_fts` in one transaction
  and deletes both surfaces together.
- `HybridSearchEngine` no longer calls `getAll(...)`; it ranks vector and FTS
  candidates by id, applies RRF, and hydrates fused ids only.
- `BM25SearchHandler` now uses indexed keyword candidates instead of JavaScript
  scoring over hydrated embedding rows.
- `LegacyKeywordHandler` was removed from the production search chain and pruned
  from `SearchHandlerChain`.
- `search_my_conversations` now uses owner-scoped indexed vector retrieval with
  `sourceIdPrefix`, not fetch-all plus post-filtering.
- `ChangeDetector.findOrphaned(...)` now reads source ids with `listSourceIds`.
- App search and MCP operations search both use the indexed handler path.
- `tests/search/indexed-search-guardrails.test.ts` blocks product-path
  `VectorStore.getAll(...)` usage and legacy fallback reintroduction.

## Implementation Validation
- Focused Phase 02 suite: `11 files passed`, `77 tests passed`.
- Typecheck: passed.
- Full suite: `655 files passed`, `4,784 tests passed`, `2 skipped`.
