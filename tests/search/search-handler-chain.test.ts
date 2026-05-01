import { describe, it, expect, vi } from "vitest";
import {
  HybridSearchHandler,
  BM25SearchHandler,
  EmptyResultHandler,
} from "@/core/search/SearchHandlerChain";
import { HybridSearchEngine } from "@/core/search/HybridSearchEngine";
import { QueryProcessor } from "@/core/search/QueryProcessor";
import { LowercaseStep } from "@/core/search/query-steps/LowercaseStep";
import { InMemoryVectorStore } from "@/adapters/InMemoryVectorStore";
import type { Embedder } from "@/core/search/ports/Embedder";
import type { VectorStore, EmbeddingRecord } from "@/core/search/ports/VectorStore";
function makeMockEmbedder(ready: boolean): Embedder {
  return {
    embed: vi.fn().mockResolvedValue(new Float32Array(384)),
    embedBatch: vi.fn().mockResolvedValue([new Float32Array(384)]),
    dimensions: () => 384,
    isReady: () => ready,
  };
}

function makeVectorRecord(id: string, content: string): EmbeddingRecord {
  return {
    id,
    sourceType: "document_chunk",
    sourceId: "book-1",
    chunkIndex: 0,
    chunkLevel: "passage",
    heading: null,
    content,
    embeddingInput: content,
    contentHash: "hash",
    modelVersion: "test",
    embedding: new Float32Array(384),
    metadata: {
      sourceType: "document_chunk",
      documentTitle: "Book One",
      documentId: "1",
      documentSlug: "book-1",
      sectionTitle: "Ch",
      sectionSlug: "ch-1",
      sectionFirstSentence: content,
      bookTitle: "Book One",
      bookSlug: "book-1",
      bookNumber: "1",
      chapterTitle: "Ch",
      chapterSlug: "ch-1",
      chapterFirstSentence: content,
    },
  };
}

function makeVectorStore(records: EmbeddingRecord[]): VectorStore {
  const store = new InMemoryVectorStore();
  store.upsert(records);
  return store;
}

describe("SearchHandlerChain", () => {
  // TEST-VS-26
  it("embeddings table empty → BM25-only results via fallback", async () => {
    const embedder = makeMockEmbedder(false);
    const engine = {} as HybridSearchEngine; // won't be called
    const bm25Processor = new QueryProcessor([new LowercaseStep()]);

    const vectorStore = makeVectorStore([
      makeVectorRecord("doc1", "The Bauhaus movement was important."),
    ]);

    const hybrid = new HybridSearchHandler(engine, embedder, "document_chunk");
    const bm25 = new BM25SearchHandler(vectorStore, bm25Processor, "document_chunk");
    const empty = new EmptyResultHandler();

    hybrid.setNext(bm25);
    bm25.setNext(empty);

    const results = await hybrid.search("Bauhaus");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].vectorRank).toBeNull(); // no vector used
  });

  // TEST-VS-27
  it("embedding model fails → BM25-only results via fallback", async () => {
    const embedder = makeMockEmbedder(false);
    const engine = {} as HybridSearchEngine;
    const bm25Processor = new QueryProcessor([new LowercaseStep()]);

    const vectorStore = makeVectorStore([
      makeVectorRecord("doc1", "The Bauhaus movement was important."),
    ]);

    const hybrid = new HybridSearchHandler(engine, embedder, "document_chunk");
    const bm25 = new BM25SearchHandler(vectorStore, bm25Processor, "document_chunk");
    const empty = new EmptyResultHandler();

    hybrid.setNext(bm25);
    bm25.setNext(empty);

    const results = await hybrid.search("Bauhaus");
    expect(results.length).toBeGreaterThan(0);
  });

  // TEST-VS-28
  it("empty keyword index returns empty results without legacy corpus scans", async () => {
    const embedder = makeMockEmbedder(false);
    const engine = {} as HybridSearchEngine;
    const bm25Processor = new QueryProcessor([new LowercaseStep()]);
    const vectorStore = makeVectorStore([]);

    const hybrid = new HybridSearchHandler(engine, embedder, "document_chunk");
    const bm25 = new BM25SearchHandler(vectorStore, bm25Processor, "document_chunk");
    const empty = new EmptyResultHandler();

    hybrid.setNext(bm25);
    bm25.setNext(empty);

    const results = await hybrid.search("Bauhaus");
    expect(results).toEqual([]);
  });

  // TEST-VS-45
  it("chain delegates to BM25SearchHandler when embedder unavailable", async () => {
    const embedder = makeMockEmbedder(false); // not ready
    const engine = {} as HybridSearchEngine;
    const bm25Processor = new QueryProcessor([new LowercaseStep()]);

    const vectorStore = makeVectorStore([
      makeVectorRecord("doc1", "Test content for testing."),
    ]);

    const hybrid = new HybridSearchHandler(engine, embedder, "document_chunk");
    const bm25 = new BM25SearchHandler(vectorStore, bm25Processor, "document_chunk");

    hybrid.setNext(bm25);
    bm25.setNext(new EmptyResultHandler());

    const results = await hybrid.search("test");
    // Should get BM25 results (vectorRank is null)
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].vectorRank).toBeNull();
    expect(results[0].bm25Rank).not.toBeNull();
  });

  // TEST-VS-46
  it("chain delegates to EmptyResultHandler when keyword candidates are unavailable", async () => {
    const embedder = makeMockEmbedder(false);
    const engine = {} as HybridSearchEngine;
    const bm25Processor = new QueryProcessor([new LowercaseStep()]);
    const vectorStore = makeVectorStore([]);

    const hybrid = new HybridSearchHandler(engine, embedder, "document_chunk");
    const bm25 = new BM25SearchHandler(vectorStore, bm25Processor, "document_chunk");
    const empty = new EmptyResultHandler();

    hybrid.setNext(bm25);
    bm25.setNext(empty);

    const results = await hybrid.search("Walter Gropius");
    expect(results).toEqual([]);
  });
});
