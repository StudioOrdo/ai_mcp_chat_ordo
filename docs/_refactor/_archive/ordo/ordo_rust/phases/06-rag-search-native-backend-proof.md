# Phase 06: RAG Search Native Backend Proof

Status: Planned

## Goal

Prove native embedding and vector search behind existing search ports while
keeping retrieval orchestration, hybrid ranking, and product policy in
TypeScript.

## Current Code To Refresh

- `src/core/search/**`
- local embedder implementation.
- SQLite vector store implementation.
- BM25/FTS5 search implementation.
- search fixtures and relevance tests.
- package dependencies for local transformers.

## Implementation Scope

- Add Rust `/embed` and `/search` proof endpoints or local IPC equivalents.
- Load the selected local embedding model in Rust when the feature flag is set.
- Replace JS vector math behind the existing vector store interface.
- Preserve TypeScript hybrid ranking and caller contracts.
- Measure memory behavior before and after the native path.

## Out Of Scope

- Replacing BM25/FTS5 ranking in this phase.
- Rewriting retrieval product logic.
- Removing `@xenova/transformers` before native parity is proven.

## Required Tests

Positive:

- embedding shape and dimensions match expected contract;
- vector search returns stable fixture matches;
- TypeScript search callers do not change.

Negative:

- missing model reports actionable diagnostics;
- invalid input is rejected without daemon crash;
- disabled flag uses current TypeScript search path.

Edge:

- empty corpus;
- large document batch;
- repeated searches do not grow memory unbounded.

## Exit Criteria

- Native search proof is behind current search interfaces.
- Memory and latency observations are recorded.
- Dependency cleanup is deferred until replacement is proven.
