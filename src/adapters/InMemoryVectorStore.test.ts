import { describe, expect, it } from "vitest";

import { InMemoryVectorStore } from "./InMemoryVectorStore";
import type { EmbeddingRecord } from "@/core/search/ports/VectorStore";

function makeRecord(
  id: string,
  metadata: {
    audience?: string;
    contentClass?: string;
    rolePersona?: string;
  },
): EmbeddingRecord {
  return {
    id,
    sourceType: "document_chunk",
    sourceId: `src-${id}`,
    chunkIndex: 0,
    chunkLevel: "passage",
    heading: null,
    content: `content ${id}`,
    embeddingInput: `content ${id}`,
    contentHash: `hash-${id}`,
    modelVersion: "test",
    embedding: new Float32Array([1, 0, 0]),
    metadata: { sourceType: "document_chunk", ...metadata },
  };
}

describe("InMemoryVectorStore Phase 4 filters", () => {
  it("filters by allowedAudiences and excludes chunks without an audience tag", () => {
    const store = new InMemoryVectorStore();
    store.upsert([
      makeRecord("a", { audience: "public" }),
      makeRecord("b", { audience: "account" }),
      makeRecord("c", { audience: "premium" }),
      makeRecord("d", {}), // no audience
    ]);

    const results = store.getAll({
      allowedAudiences: ["public", "account"],
    });
    const ids = results.map((r) => r.id).sort();
    expect(ids).toEqual(["a", "b"]);
  });

  it("filters by class when provided", () => {
    const store = new InMemoryVectorStore();
    store.upsert([
      makeRecord("a", { audience: "public", contentClass: "manual" }),
      makeRecord("b", { audience: "public", contentClass: "guide" }),
      makeRecord("c", { audience: "public", contentClass: "reference" }),
    ]);

    const results = store.getAll({
      classes: ["guide", "reference"],
    });
    const ids = results.map((r) => r.id).sort();
    expect(ids).toEqual(["b", "c"]);
  });

  it("filters by rolePersonas when provided", () => {
    const store = new InMemoryVectorStore();
    store.upsert([
      makeRecord("a", { audience: "public", rolePersona: "sales" }),
      makeRecord("b", { audience: "public", rolePersona: "scheduling" }),
      makeRecord("c", { audience: "public" }), // no persona
    ]);

    const results = store.getAll({ rolePersonas: ["sales"] });
    expect(results.map((r) => r.id)).toEqual(["a"]);
  });

  it("combines audience + class + persona filters", () => {
    const store = new InMemoryVectorStore();
    store.upsert([
      makeRecord("ok", {
        audience: "account",
        contentClass: "manual",
        rolePersona: "sales",
      }),
      makeRecord("wrong-audience", {
        audience: "premium",
        contentClass: "manual",
        rolePersona: "sales",
      }),
      makeRecord("wrong-class", {
        audience: "account",
        contentClass: "reference",
        rolePersona: "sales",
      }),
      makeRecord("wrong-persona", {
        audience: "account",
        contentClass: "manual",
        rolePersona: "front_desk",
      }),
    ]);

    const results = store.getAll({
      allowedAudiences: ["public", "account"],
      classes: ["manual"],
      rolePersonas: ["sales"],
    });
    expect(results.map((r) => r.id)).toEqual(["ok"]);
  });

  it("returns all records when no Phase 4 filters are supplied", () => {
    const store = new InMemoryVectorStore();
    store.upsert([
      makeRecord("a", { audience: "public" }),
      makeRecord("b", { audience: "premium" }),
    ]);
    expect(store.getAll({}).length).toBe(2);
  });
});
