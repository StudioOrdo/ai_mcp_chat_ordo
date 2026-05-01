# Search Index Execution Plan

## Status
- **Disposition**: Keep, consolidated from old vector and FTS5 findings.
- **Priority**: Critical before corpus or conversation search is allowed to grow materially.
- **Layer**: Search / RAG Pipeline.
- **Reviewed**: 2026-05-01.

## Current Code Grounding
- `src/core/search/HybridSearchEngine.ts` currently calls `vectorStore.getAll(...)`, scores vector similarity in Node, then loops the same records for BM25.
- `src/adapters/SQLiteVectorStore.ts#getAll` deserializes every matching embedding row into Node memory.
- `src/core/search/BM25Scorer.ts` computes keyword scores in JavaScript.
- `mcp/operations-server.ts` builds the same hybrid search stack for MCP embedding tools.

## Verdict
The old vector-search finding was valid. The old standalone FTS5 finding was also valid, but it duplicated the same root issue. The real fix is one search-index execution plan: push candidate retrieval and scoring into indexed storage, then keep Node responsible for orchestration, ranking fusion, formatting, and policy.

## Target Architecture
- Extend the `VectorStore` port with a top-K vector query method, for example `searchSimilar(queryEmbedding, filters, limit)`.
- Implement SQLite-side vector candidate retrieval first with a registered deterministic similarity function if the current SQLite deployment supports it.
- Add an FTS5-backed keyword index for searchable text content.
- Replace `HybridSearchEngine` fetch-all behavior with:
  - vector top-K candidates from `VectorStore.searchSimilar`
  - keyword top-K candidates from an FTS-backed keyword store
  - reciprocal rank fusion over candidate ids only
  - row hydration only for final selected ids
- Keep `HybridSearchEngine` as the orchestrator. Do not create a second canonical search core.

## Greenfield Cutoff
- It is acceptable to break the current `VectorStore` and `BM25IndexStore` interfaces.
- Remove the JavaScript full-scan fallback from product paths once the SQL-backed implementation is in place.
- Keep tiny in-memory stores only for focused unit tests.

## Required Tests
- Positive: vector top-K returns the same top result as the current dot-product implementation on a deterministic fixture.
- Positive: FTS keyword query returns expected section/chunk ids and participates in reciprocal-rank fusion.
- Negative: malformed query/filter inputs are rejected before SQL execution.
- Negative: search does not deserialize every embedding row for a limited top-K query.
- Edge: no vector matches but keyword matches still return formatted results.
- Edge: no FTS matches but vector matches still return formatted results.
- Performance: fixture with thousands of embeddings proves bounded row hydration.
