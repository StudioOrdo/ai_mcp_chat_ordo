# Retrieval Engine: Hybrid Search and Contextual Chunking

## Overview

Studio Ordo utilizes a sophisticated retrieval engine to provide grounded and accurate responses based on any provided knowledge corpus. The engine combines semantic intuition with lexical precision through a multi-stage hybrid search strategy while preserving the product's all-in-one operational footprint.

---

## The Hybrid Search Engine

### 1. Dual-Path Retrieval
Every query is processed through two distinct pipelines:
*   **Vector Pipeline**: Utilizes local embeddings to capture the semantic intent and conceptual metadata of the query.
*   **Lexical Pipeline (BM25)**: Uses the Okapi BM25 algorithm to identify exact term matches and keyword-dense passages, ensuring technical precision.

Both paths are hosted locally inside the application runtime. This avoids the need for a separate search cluster or vector database service while preserving strong retrieval quality.

### 2. Reciprocal Rank Fusion (RRF)
The results from the Vector and BM25 pipelines are fused using the **Reciprocal Rank Fusion** algorithm. RRF prioritizes documents that score highly across both pipelines, providing a balanced and highly relevant set of passages for the reasoning loop.

### 3. Relevance Calibration
Every retrieved result is assigned a normalized relevance score and a quality label (`strong`, `partial`, or `none`). This metadata allows the agent to reason about the quality of its evidence and avoid hallucination when information is missing or weak.

---

## Contextual Chunking

The platform preserves the structural integrity of the knowledge corpus through an intelligent chunking strategy implemented in the `MarkdownChunker.ts`.

### 1. Structural Decomposition
Instead of fixed-window chunking, the system splits documents at natural boundaries (headings, sub-headings, and paragraph breaks). This ensures that chunks remain logically coherent and do not split atomic blocks like code examples, tables, or lists.

### 2. Contextual Prefixing
To prevent loss of context during isolated retrieval, every chunk is prepended with a "context string" derived from the document and section hierarchies (e.g., *Book Title > Chapter Title > Section Opening*). This ensures that the agent understands the origin and scope of the information it receives.

### 3. Navigable Metadata
Chunks are enriched with link metadata (previous/next chunk IDs, parent section IDs), allowing the retrieval engine or the agent to programmatically expand the context window by exploring the document's structure.

---

## Dynamic Session Memory

The retrieval engine is not limited to the static background knowledge. It actively manages **Dynamic Session Memory** to provide the agent with a "short-term recollection" of the current conversation.

### 1. Thread-Local Indexing
During an active session, every interaction (user query and assistant response) is automatically processed and indexed in the **Session Vector Manifold**. This ensures that the agent can retrieve specific details from earlier in the "thread" using semantic search, even if those details have been rotated out of the primary LLM context window.

### 2. Relevance Cross-Fusing
When a search is triggered, the engine performs a parallel retrieval across both the **Static Corpus** and the **Active Session History**. The results are cross-fused, allowing the agent to synthesize answers that bridge background knowledge with the immediate user context (e.g., "Based on the manual [Corpus], your specific file [Session] requires these settings...").

### 3. Context Recency Weighting
The retrieval engine applies a time-decay factor to session results. This ensures that the most recent and conversationally relevant passages are prioritized, maintaining the "flow" of the reasoning loop.

---

## Performance and Limits
*   **Vector Top N**: 20 results (default).
*   **BM25 Top N**: 20 results (default).
*   **RRF K-Constant**: 60.
*   **Target Chunk Size**: 400 words.

**Summary**: The retrieval engine provides the "senses" for the agentic platform. By combining hybrid search with structurally aware chunking inside one compact runtime, Studio Ordo keeps inference grounded without inheriting the infrastructure sprawl of a more traditional search stack.
