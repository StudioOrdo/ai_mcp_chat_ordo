/**
 * @vitest-environment node
 *
 * LocalEmbedder requires native ONNX Runtime which needs the real Node.js
 * Float32Array (not jsdom's). This file uses node environment.
 */
import { describe, expect, it, vi } from "vitest";
import { localEmbedder } from "@/adapters/LocalEmbedder";

describe("LocalEmbedder (real ONNX model)", () => {
  const embedder = localEmbedder;

  async function withSuppressedDefaultDtypeWarning<T>(operation: () => Promise<T>): Promise<T> {
    const originalWarn = console.warn.bind(console);
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation((message?: unknown, ...args: unknown[]) => {
      if (typeof message === "string" && message.includes('dtype not specified for "model"')) {
        return;
      }
      originalWarn(message, ...args);
    });

    try {
      return await operation();
    } finally {
      consoleWarnSpy.mockRestore();
    }
  }

  it("embed() returns 384-dimensional Float32Array", async () => {
    const vec = await withSuppressedDefaultDtypeWarning(() =>
      embedder.embed("test embedding text"),
    );

    expect(vec).toBeInstanceOf(Float32Array);
    expect(vec.length).toBe(384);
    // Should not be all zeros
    const sum = vec.reduce((a: number, b: number) => a + Math.abs(b), 0);
    expect(sum).toBeGreaterThan(0);
  }, 60_000);

  it("embedBatch() returns array of 384-dim vectors", async () => {
    const vecs = await embedder.embedBatch([
      "first text about design",
      "second text about accessibility",
    ]);

    expect(vecs).toHaveLength(2);
    for (const vec of vecs) {
      expect(vec).toBeInstanceOf(Float32Array);
      expect(vec.length).toBe(384);
    }

    // Different texts should produce different embeddings
    let diff = 0;
    for (let i = 0; i < 384; i++) {
      diff += Math.abs(vecs[0][i] - vecs[1][i]);
    }
    expect(diff).toBeGreaterThan(0.1);
  }, 60_000);

  it("isReady() returns true after first embed() call", async () => {
    // After the previous tests, pipeline should be loaded
    expect(embedder.isReady()).toBe(true);
    expect(embedder.dimensions()).toBe(384);
  });
});
