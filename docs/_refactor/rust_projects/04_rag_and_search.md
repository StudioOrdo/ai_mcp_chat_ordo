# Specification: RAG & Search Engine

**Audience:** Implementation AI Agent
**Context:** This specification details the strategy for moving Local Embeddings and Vector Math out of Node.js and into the memory-safe, hardware-accelerated Rust daemon.

## 1. The Bottleneck: Node.js Embeddings & JS Vector Math
Currently, OrdoSite uses `@xenova/transformers` in Node.js for embeddings and registers a custom JS SQLite User-Defined Function (UDF) for `vector_dot_similarity`.
*   Running neural networks in V8 consumes massive RAM and blocks the single-threaded event loop.
*   During a vector search, SQLite performs a brute-force linear scan, crossing the C++ to JS boundary on every single row to execute the float array dot product. This is catastrophically slow at scale.

## 2. The Rust Search Engine (`ordo-search` subsystem)
We will maintain the exact architectural boundaries defined in `src/core/search/ports/`, making this a seamless backend swap.

*   **Native Inference:** The Rust `ordo-daemon` natively loads the ONNX model (`all-MiniLM-L6-v2`) into memory upon startup using `ort` (ONNX Runtime) or `candle`. This utilizes hardware-accelerated SIMD instructions and completely bypasses V8.
*   **Vector Database:** We will eliminate the JS SQLite UDF. Instead:
    *   *Option A:* Use `sqlite-vss` (a native C SQLite extension for vector search).
    *   *Option B:* Use an embedded LanceDB or `hnsw.rs` implementation managed entirely by Rust.
*   **The Internal API:** The Rust daemon exposes a minimal, hyper-fast HTTP or UDS API to Node.js:
    *   `POST /embed`: Accepts strings, returns `Float32Array` embeddings.
    *   `POST /search`: Accepts an embedding vector, returns matching `source_id`s and scores.

## 3. Node.js Refactoring
*   **`LocalEmbedder.ts`:** Refactor to implement the `Embedder` interface by making a fast local HTTP/IPC call to the Rust `/embed` endpoint.
*   **`SQLiteVectorStore.ts`:** Refactor `searchSimilar` to call the Rust `/search` endpoint.
*   **Dependency Cleanup:** Uninstall `@xenova/transformers` from `package.json` to drastically shrink the Node.js memory footprint.

*Note on Keyword Search:* The `SQLiteBM25IndexStore.ts` implementation already relies on SQLite's native FTS5 engine in C. BM25/Hybrid rank fusion logic should remain in Node.js, only offloading the vector math and embedding inference to Rust.
