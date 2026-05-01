import { describe, expect, it, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { ensureSchema } from "@/lib/db/schema";
import { SQLiteVectorStore } from "@/adapters/SQLiteVectorStore";
import { SQLiteBM25IndexStore } from "@/adapters/SQLiteBM25IndexStore";
import type { EmbeddingRecord } from "@/core/search/ports/VectorStore";

function createDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function makeRecord(overrides: Partial<EmbeddingRecord> = {}): EmbeddingRecord {
  return {
    id: "book_chunk:ux/ch1:0",
    sourceType: "book_chunk",
    sourceId: "ux/ch1",
    chunkIndex: 0,
    chunkLevel: "passage",
    heading: "Introduction",
    content: "Test content about UX design.",
    embeddingInput: "UX Design: Chapter 1 > Introduction > Test content",
    contentHash: "abc123",
    modelVersion: "all-MiniLM-L6-v2@1.0",
    embedding: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]),
    metadata: {
      sourceType: "book_chunk",
      bookSlug: "ux",
      chapterSlug: "ch1",
      bookTitle: "UX Design",
      chapterTitle: "Chapter 1",
      chapterFirstSentence: "This chapter covers UX basics.",
    },
    ...overrides,
  };
}

describe("SQLite stores", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb();
  });

  // TEST-VS-18: Float32Array → Buffer → Float32Array round-trip preserves all values
  it("Float32Array round-trip through SQLite BLOB preserves values", () => {
    const store = new SQLiteVectorStore(db);
    const original = new Float32Array([0.123456, -0.789012, 0.0, 1.0, -1.0]);
    const record = makeRecord({ embedding: original });

    store.upsert([record]);
    const retrieved = store.getBySourceId("ux/ch1");

    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].embedding).toBeInstanceOf(Float32Array);
    expect(retrieved[0].embedding.length).toBe(5);
    for (let i = 0; i < original.length; i++) {
      expect(retrieved[0].embedding[i]).toBeCloseTo(original[i], 5);
    }
  });

  // TEST-VS-19: SQLiteVectorStore.upsert() stores and retrieves embedding records
  it("upsert stores and retrieves records", () => {
    const store = new SQLiteVectorStore(db);
    const records = [
      makeRecord({ id: "book_chunk:ux/ch1:0", chunkIndex: 0 }),
      makeRecord({ id: "book_chunk:ux/ch1:1", chunkIndex: 1, heading: "Principles" }),
    ];

    store.upsert(records);

    expect(store.count()).toBe(2);
    expect(store.count("book_chunk")).toBe(2);

    const all = store.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].content).toBe("Test content about UX design.");

    const bySource = store.getBySourceId("ux/ch1");
    expect(bySource).toHaveLength(2);
    expect(bySource[0].chunkIndex).toBe(0);
    expect(bySource[1].chunkIndex).toBe(1);
  });

  // TEST-VS-20: SQLiteVectorStore.delete() removes all chunks for a source_id
  it("delete removes all chunks for a source_id", () => {
    const store = new SQLiteVectorStore(db);
    store.upsert([
      makeRecord({ id: "book_chunk:ux/ch1:0", sourceId: "ux/ch1", chunkIndex: 0 }),
      makeRecord({ id: "book_chunk:ux/ch1:1", sourceId: "ux/ch1", chunkIndex: 1 }),
      makeRecord({ id: "book_chunk:ux/ch2:0", sourceId: "ux/ch2", chunkIndex: 0 }),
    ]);

    expect(store.count()).toBe(3);
    store.delete("ux/ch1");
    expect(store.count()).toBe(1);
    expect(store.getBySourceId("ux/ch1")).toHaveLength(0);
    expect(store.getBySourceId("ux/ch2")).toHaveLength(1);
  });

  it("keeps FTS keyword rows synchronized with embedding upserts and deletes", () => {
    const store = new SQLiteVectorStore(db);
    store.upsert([
      makeRecord({
        id: "book_chunk:ux/ch1:0",
        sourceId: "ux/ch1",
        heading: "Principles",
        content: "Functional design depends on clear hierarchy.",
      }),
      makeRecord({
        id: "book_chunk:ux/ch2:0",
        sourceId: "ux/ch2",
        heading: "Research",
        content: "Interview synthesis reveals customer language.",
      }),
    ]);

    expect(store.searchKeyword({
      rawQuery: "hierarchy",
      terms: ["hierarchy"],
      filters: { sourceType: "book_chunk", chunkLevel: "passage" },
      limit: 5,
    })).toEqual([
      expect.objectContaining({ id: "book_chunk:ux/ch1:0", rank: 1 }),
    ]);

    store.delete("ux/ch1");

    expect(store.searchKeyword({
      rawQuery: "hierarchy",
      terms: ["hierarchy"],
      filters: { sourceType: "book_chunk", chunkLevel: "passage" },
      limit: 5,
    })).toEqual([]);
  });

  it("returns bounded vector candidates and hydrates only requested ids in rank order", () => {
    const store = new SQLiteVectorStore(db);
    store.upsert([
      makeRecord({ id: "book_chunk:ux/ch1:0", embedding: new Float32Array([1, 0, 0]) }),
      makeRecord({ id: "book_chunk:ux/ch1:1", chunkIndex: 1, embedding: new Float32Array([0.8, 0.2, 0]) }),
      makeRecord({ id: "book_chunk:ux/ch1:2", chunkIndex: 2, embedding: new Float32Array([0, 1, 0]) }),
    ]);

    const candidates = store.searchSimilar({
      embedding: new Float32Array([1, 0, 0]),
      filters: { sourceType: "book_chunk", chunkLevel: "passage" },
      limit: 2,
    });

    expect(candidates).toEqual([
      expect.objectContaining({ id: "book_chunk:ux/ch1:0", rank: 1 }),
      expect.objectContaining({ id: "book_chunk:ux/ch1:1", rank: 2 }),
    ]);

    expect(store.hydrateByIds(candidates.map((candidate) => candidate.id)).map((record) => record.id)).toEqual([
      "book_chunk:ux/ch1:0",
      "book_chunk:ux/ch1:1",
    ]);
  });

  // TEST-VS-21: SQLiteVectorStore.getContentHash() returns stored hash
  it("getContentHash returns stored hash", () => {
    const store = new SQLiteVectorStore(db);
    store.upsert([makeRecord({ contentHash: "sha256_abcdef" })]);

    expect(store.getContentHash("ux/ch1")).toBe("sha256_abcdef");
    expect(store.getContentHash("nonexistent")).toBeNull();
    expect(store.getModelVersion("ux/ch1")).toBe("all-MiniLM-L6-v2@1.0");
    expect(store.getModelVersion("nonexistent")).toBeNull();
  });

  describe("SQLiteBM25IndexStore", () => {
    it("saves and retrieves BM25 index with Map round-trip", () => {
      const store = new SQLiteBM25IndexStore(db);

      expect(store.getIndex("book_chunk")).toBeNull();

      const index = {
        avgDocLength: 200,
        docCount: 50,
        docLengths: new Map([["doc1", 180], ["doc2", 220]]),
        termDocFrequencies: new Map([["design", 10], ["pattern", 5]]),
      };

      store.saveIndex("book_chunk", index);

      const retrieved = store.getIndex("book_chunk");
      expect(retrieved).not.toBeNull();
      expect(retrieved!.avgDocLength).toBe(200);
      expect(retrieved!.docCount).toBe(50);
      expect(retrieved!.docLengths.get("doc1")).toBe(180);
      expect(retrieved!.termDocFrequencies.get("design")).toBe(10);
    });
  });
});
