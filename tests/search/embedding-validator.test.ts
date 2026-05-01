// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { localEmbedder } from "@/adapters/LocalEmbedder";
import { validateEmbeddingQuality } from "@/core/search/EmbeddingValidator";

describe("EmbeddingValidator", () => {
  const embedder = localEmbedder;

  // TEST-VS-54 + TEST-VS-55: All validation pairs pass their thresholds
  it("all validation pairs pass quality thresholds", { timeout: 120_000 }, async () => {
    const originalWarn = console.warn.bind(console);
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation((message?: unknown, ...args: unknown[]) => {
      if (typeof message === "string" && message.includes('dtype not specified for "model"')) {
        return;
      }
      originalWarn(message, ...args);
    });

    const result = await validateEmbeddingQuality(embedder).finally(() => {
      consoleWarnSpy.mockRestore();
    });

    expect(result.failed).toBe(0);
    expect(result.passed).toBe(5);
    for (const detail of result.details) {
      expect(detail).toMatch(/^PASS/);
    }
  });
});
