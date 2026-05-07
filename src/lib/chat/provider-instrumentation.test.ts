/**
 * Sprint 16 — Provider instrumentation verification.
 *
 * Verifies that every ProviderSurface value declared in provider-policy.ts
 * has at least one caller that either emits provider lifecycle events
 * directly or routes that surface through the shared provider runtime, and
 * that the ProviderRuntime facade can be instantiated.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { ProviderSurface } from "@/lib/chat/provider-policy";
import { createProviderRuntime, type ProviderRuntime } from "@/lib/chat/provider-runtime";

/**
 * Map of every declared ProviderSurface to the file(s) expected to emit
 * lifecycle events for that surface.
 */
const SURFACE_FILE_MAP: Record<ProviderSurface, string[]> = {
  stream: ["src/lib/chat/anthropic-stream.ts"],
  direct_turn: ["src/lib/chat/anthropic-client.ts"],
  summarization: ["src/adapters/AnthropicSummarizer.ts"],
  image_generation: ["src/adapters/OpenAiBlogImageProvider.ts"],
  tts: ["src/app/api/tts/route.ts"],
  blog_production: ["src/adapters/AnthropicBlogArticlePipelineModel.ts"],
  web_search: ["src/core/use-cases/tools/admin-web-search.tool.ts"],
};

const ALL_SURFACES = Object.keys(SURFACE_FILE_MAP) as ProviderSurface[];

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf-8");
}

describe("provider-instrumentation", () => {
  describe("surface coverage", () => {
    it.each(ALL_SURFACES)(
      "ProviderSurface '%s' has at least one instrumented file",
      (surface) => {
        const files = SURFACE_FILE_MAP[surface];
        expect(files.length).toBeGreaterThan(0);

        for (const file of files) {
          const source = readSource(file);

          // File must either emit events directly or route the surface through
          // the shared provider runtime.
          expect(
            source.includes("emitProviderEvent") || source.includes("runWithResilience"),
            `${file} must reference provider lifecycle instrumentation`,
          ).toBe(true);

          // File must reference the surface string
          expect(
            source.includes(`"${surface}"`),
            `${file} must reference surface "${surface}"`,
          ).toBe(true);
        }
      },
    );

    it("SURFACE_FILE_MAP covers all 7 declared ProviderSurface values", () => {
      expect(ALL_SURFACES).toHaveLength(7);
      expect(ALL_SURFACES).toEqual(
        expect.arrayContaining([
          "stream",
          "direct_turn",
          "summarization",
          "image_generation",
          "tts",
          "blog_production",
          "web_search",
        ]),
      );
    });
  });

  describe("ProviderRuntime facade", () => {
    it("createProviderRuntime returns an object with all required methods", () => {
      const runtime: ProviderRuntime = createProviderRuntime();

      expect(typeof runtime.resolvePolicy).toBe("function");
      expect(typeof runtime.emitEvent).toBe("function");
      expect(typeof runtime.classifyError).toBe("function");
      expect(typeof runtime.runWithResilience).toBe("function");
    });

    it("resolvePolicy returns a valid resilience policy", () => {
      const runtime = createProviderRuntime();
      const policy = runtime.resolvePolicy();

      expect(policy.timeoutMs).toBeGreaterThan(0);
      expect(policy.retryAttempts).toBeGreaterThan(0);
      expect(policy.retryDelayMs).toBeGreaterThan(0);
      expect(Array.isArray(policy.modelCandidates)).toBe(true);
    });

    it("classifyError classifies a timeout error", () => {
      const runtime = createProviderRuntime();
      const classification = runtime.classifyError(new Error("Request timed out"));

      expect(classification).toBe("timeout");
    });

    it("classifyError classifies an unknown error as fatal", () => {
      const runtime = createProviderRuntime();
      const classification = runtime.classifyError(new Error("some random error"));

      expect(classification).toBe("fatal");
    });

    it("emitEvent does not throw for a valid event", () => {
      const runtime = createProviderRuntime();

      expect(() => {
        runtime.emitEvent({
          kind: "attempt_start",
          provider: "anthropic",
          surface: "stream",
          model: "test-model",
          attempt: 1,
        });
      }).not.toThrow();
    });
  });
});
