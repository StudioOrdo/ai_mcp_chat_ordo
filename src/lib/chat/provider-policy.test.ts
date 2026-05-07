import { describe, expect, it } from "vitest";
import {
  classifyProviderError,
  delay,
  emitProviderEvent,
  isModelNotFoundError,
  isTimeoutError,
  isTransientProviderError,
  resolveProviderPolicy,
  toErrorMessage,
  type ProviderAttemptEvent,
} from "@/lib/chat/provider-policy";

describe("provider-policy", () => {
  describe("resolveProviderPolicy", () => {
    it("returns a valid policy with all required fields", () => {
      const policy = resolveProviderPolicy();
      expect(policy.provider).toBeDefined();
      expect(policy.timeoutMs).toBeGreaterThan(0);
      expect(policy.retryAttempts).toBeGreaterThan(0);
      expect(policy.retryDelayMs).toBeGreaterThan(0);
      expect(Array.isArray(policy.modelCandidates)).toBe(true);
      expect(policy.modelCandidates.length).toBeGreaterThan(0);
    });

    it("uses selected-provider candidates without mixing Claude fallbacks into DeepSeek", () => {
      const policy = resolveProviderPolicy({
        provider: {
          key: "AI_PROVIDER",
          value: "deepseek",
          source: "sqlite",
        },
        apiKey: {
          key: "DEEPSEEK_API_KEY",
          value: "secret",
          source: "sqlite",
          configured: true,
        },
        model: {
          key: "DEEPSEEK_MODEL",
          value: "deepseek-v4-pro",
          source: "sqlite",
        },
        baseUrl: {
          key: "DEEPSEEK_BASE_URL",
          value: "https://api.deepseek.com/anthropic",
          source: "default",
        },
        modelCandidates: ["deepseek-v4-pro", "deepseek-v4-flash"],
        timeoutMs: {
          key: "DEEPSEEK_REQUEST_TIMEOUT_MS",
          value: 45_000,
          source: "default",
        },
        retryAttempts: {
          key: "DEEPSEEK_RETRY_ATTEMPTS",
          value: 3,
          source: "default",
        },
        retryDelayMs: {
          key: "DEEPSEEK_RETRY_DELAY_MS",
          value: 150,
          source: "default",
        },
        warnings: [],
      });

      expect(policy.provider).toBe("deepseek");
      expect(policy.modelCandidates).toEqual(["deepseek-v4-pro", "deepseek-v4-flash"]);
      expect(policy.modelCandidates.some((model) => model.includes("claude"))).toBe(false);
    });

    it("returns consistent values on repeated calls", () => {
      const a = resolveProviderPolicy();
      const b = resolveProviderPolicy();
      expect(a.timeoutMs).toBe(b.timeoutMs);
      expect(a.retryAttempts).toBe(b.retryAttempts);
      expect(a.retryDelayMs).toBe(b.retryDelayMs);
      expect(a.modelCandidates).toEqual(b.modelCandidates);
    });
  });

  describe("toErrorMessage", () => {
    it("extracts message from Error instances", () => {
      expect(toErrorMessage(new Error("test error"))).toBe("test error");
    });

    it("returns a fallback for non-Error values", () => {
      expect(toErrorMessage("string")).toBe("Unexpected provider error.");
      expect(toErrorMessage(42)).toBe("Unexpected provider error.");
      expect(toErrorMessage(null)).toBe("Unexpected provider error.");
    });
  });

  describe("isModelNotFoundError", () => {
    it("detects not_found_error in message", () => {
      expect(isModelNotFoundError(new Error("not_found_error: model xyz"))).toBe(true);
    });

    it("detects model: in message", () => {
      expect(isModelNotFoundError(new Error("Invalid model: claude-3"))).toBe(true);
    });

    it("rejects unrelated errors", () => {
      expect(isModelNotFoundError(new Error("rate limit exceeded"))).toBe(false);
      expect(isModelNotFoundError(new Error("timeout"))).toBe(false);
    });
  });

  describe("isTimeoutError", () => {
    it("detects 'timed out'", () => {
      expect(isTimeoutError(new Error("Request timed out"))).toBe(true);
    });

    it("detects 'timeout'", () => {
      expect(isTimeoutError(new Error("Connection timeout"))).toBe(true);
    });

    it("rejects unrelated errors", () => {
      expect(isTimeoutError(new Error("rate limit exceeded"))).toBe(false);
      expect(isTimeoutError(new Error("not_found_error"))).toBe(false);
    });
  });

  describe("isTransientProviderError", () => {
    it.each([
      "Request timed out",
      "Connection timeout",
      "rate limit exceeded",
      "HTTP 429",
      "HTTP 500",
      "HTTP 502",
      "HTTP 503",
      "network error occurred",
      "fetch failed",
      "Service temporarily unavailable",
    ])("classifies '%s' as transient", (message) => {
      expect(isTransientProviderError(new Error(message))).toBe(true);
    });

    it.each([
      "not_found_error: model xyz",
      "Invalid API key",
      "Permission denied",
      "Bad request format",
    ])("rejects '%s' as non-transient", (message) => {
      expect(isTransientProviderError(new Error(message))).toBe(false);
    });
  });

  describe("delay", () => {
    it("resolves after the specified time", async () => {
      const start = Date.now();
      await delay(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40); // allow timer jitter
    });
  });

  describe("classifyProviderError", () => {
    it("classifies abort errors", () => {
      const err = new Error("request aborted");
      err.name = "AbortError";
      expect(classifyProviderError(err)).toBe("abort");
    });

    it("classifies abort-like errors by message", () => {
      expect(classifyProviderError(new Error("The operation was aborted"))).toBe("abort");
    });

    it("classifies model not found errors", () => {
      expect(classifyProviderError(new Error("not_found_error: model xyz"))).toBe("model_not_found");
    });

    it("classifies timeout errors", () => {
      expect(classifyProviderError(new Error("Request timed out"))).toBe("timeout");
    });

    it("classifies transient errors", () => {
      expect(classifyProviderError(new Error("HTTP 503"))).toBe("transient");
    });

    it("classifies unknown errors as fatal", () => {
      expect(classifyProviderError(new Error("Permission denied"))).toBe("fatal");
    });
  });

  describe("emitProviderEvent", () => {
    it("accepts a well-formed attempt_start event without throwing", () => {
      expect(() =>
        emitProviderEvent({
          kind: "attempt_start",
          provider: "anthropic",
          surface: "stream",
          model: "claude-sonnet-4-20250514",
          attempt: 1,
        }),
      ).not.toThrow();
    });

    it("accepts a well-formed attempt_success event with duration", () => {
      expect(() =>
        emitProviderEvent({
          kind: "attempt_success",
          provider: "anthropic",
          surface: "direct_turn",
          model: "claude-sonnet-4-20250514",
          attempt: 1,
          durationMs: 1234,
        }),
      ).not.toThrow();
    });

    it("accepts a well-formed attempt_failure event with error classification", () => {
      expect(() =>
        emitProviderEvent({
          kind: "attempt_failure",
          provider: "anthropic",
          surface: "stream",
          model: "claude-sonnet-4-20250514",
          attempt: 2,
          durationMs: 500,
          error: "Connection timeout",
          errorClassification: "timeout",
        }),
      ).not.toThrow();
    });
  });

  describe("shared module stability", () => {
    it("resolveProviderPolicy returns identical values across calls", () => {
      const a = resolveProviderPolicy();
      const b = resolveProviderPolicy();
      expect(a.timeoutMs).toBe(b.timeoutMs);
      expect(a.retryAttempts).toBe(b.retryAttempts);
      expect(a.retryDelayMs).toBe(b.retryDelayMs);
      expect(a.modelCandidates).toEqual(b.modelCandidates);
    });

    it("classifyProviderError is deterministic for the same input", () => {
      const errors = [
        new Error("not_found_error: model xyz"),
        new Error("Request timed out"),
        new Error("HTTP 429"),
        new Error("fetch failed"),
        new Error("Permission denied"),
      ];
      for (const error of errors) {
        const first = classifyProviderError(error);
        const second = classifyProviderError(error);
        expect(first).toBe(second);
      }
    });

    it("ProviderAttemptEvent type accepts all surface values", () => {
      const surfaces: ProviderAttemptEvent["surface"][] = [
        "stream",
        "direct_turn",
        "summarization",
        "image_generation",
        "tts",
        "blog_production",
        "web_search",
      ];
      for (const surface of surfaces) {
        const event: ProviderAttemptEvent = {
          kind: "attempt_start",
          provider: "anthropic",
          surface,
          model: "test-model",
          attempt: 1,
        };
        expect(event.surface).toBe(surface);
      }
    });

    it("emitProviderEvent accepts all Sprint 7 surface values without throwing", () => {
      const surfaces: ProviderAttemptEvent["surface"][] = [
        "summarization",
        "image_generation",
        "tts",
        "blog_production",
        "web_search",
      ];
      for (const surface of surfaces) {
        expect(() =>
          emitProviderEvent({
            kind: "attempt_start",
            provider: "anthropic",
            surface,
            model: "test-model",
            attempt: 1,
          }),
        ).not.toThrow();
      }
    });
  });

  describe("cross-path import verification", () => {
    it("anthropic-stream.ts uses provider-runtime for shared attempt execution", async () => {
      const fs = await import("node:fs");
      const source = fs.readFileSync("src/lib/chat/anthropic-stream.ts", "utf-8");
      expect(source).toContain("createProviderRuntime");
      expect(source).toContain("runWithResilience");
      expect(source).toContain("from \"@/lib/chat/provider-runtime\"");
      // Verify no local policy constants
      expect(source).not.toContain("DEFAULT_TIMEOUT_MS");
      expect(source).not.toContain("DEFAULT_RETRY_ATTEMPTS");
      expect(source).not.toContain("DEFAULT_RETRY_DELAY_MS");
    });

    it("anthropic-client.ts uses provider-runtime for shared attempt execution", async () => {
      const fs = await import("node:fs");
      const source = fs.readFileSync("src/lib/chat/anthropic-client.ts", "utf-8");
      expect(source).toContain("createProviderRuntime");
      expect(source).toContain("runWithResilience");
      expect(source).toContain("from \"@/lib/chat/provider-runtime\"");
      // Verify no local policy constants
      expect(source).not.toContain("DEFAULT_TIMEOUT_MS");
      expect(source).not.toContain("DEFAULT_RETRY_ATTEMPTS");
      expect(source).not.toContain("DEFAULT_RETRY_DELAY_MS");
    });

    it("anthropic-stream.ts no longer emits provider events directly", async () => {
      const fs = await import("node:fs");
      const source = fs.readFileSync("src/lib/chat/anthropic-stream.ts", "utf-8");
      expect(source).not.toContain("emitProviderEvent");
      expect(source).not.toContain("classifyProviderError");
      // Verify no local classifier definitions
      expect(source).not.toMatch(/^function isModelNotFoundError/m);
      expect(source).not.toMatch(/^function isTransientProviderError/m);
      expect(source).not.toMatch(/^function isTimeoutError/m);
    });

    it("anthropic-client.ts no longer emits provider events directly", async () => {
      const fs = await import("node:fs");
      const source = fs.readFileSync("src/lib/chat/anthropic-client.ts", "utf-8");
      expect(source).not.toContain("emitProviderEvent");
      expect(source).not.toContain("classifyProviderError");
      // Verify no local classifier definitions
      expect(source).not.toMatch(/^function isModelNotFoundError/m);
      expect(source).not.toMatch(/^function isTransientProviderError/m);
      expect(source).not.toMatch(/^function isTimeoutError/m);
    });

    it("chat-turn.ts does not use withProviderTiming or withProviderErrorMapping", async () => {
      const fs = await import("node:fs");
      const source = fs.readFileSync("src/lib/chat/chat-turn.ts", "utf-8");
      expect(source).not.toContain("withProviderTiming");
      expect(source).not.toContain("withProviderErrorMapping");
    });

    it("both paths throw ChatProviderError, not raw Error", async () => {
      const fs = await import("node:fs");
      const stream = fs.readFileSync("src/lib/chat/anthropic-stream.ts", "utf-8");
      const client = fs.readFileSync("src/lib/chat/anthropic-client.ts", "utf-8");
      expect(stream).toContain("ChatProviderError");
      expect(client).toContain("ChatProviderError");
    });

    // Sprint 7: Verify non-chat callers import from provider-policy
    it("AnthropicSummarizer imports emitProviderEvent from provider-policy", async () => {
      const fs = await import("node:fs");
      const source = fs.readFileSync("src/adapters/AnthropicSummarizer.ts", "utf-8");
      expect(source).toContain("emitProviderEvent");
      expect(source).toContain("from \"@/lib/chat/provider-policy\"");
      expect(source).toContain("surface: \"summarization\"");
    });

    it("OpenAiBlogImageProvider imports emitProviderEvent from provider-policy", async () => {
      const fs = await import("node:fs");
      const source = fs.readFileSync("src/adapters/OpenAiBlogImageProvider.ts", "utf-8");
      expect(source).toContain("emitProviderEvent");
      expect(source).toContain("from \"@/lib/chat/provider-policy\"");
      expect(source).toContain("surface: \"image_generation\"");
    });

    it("TTS route imports emitProviderEvent from provider-policy", async () => {
      const fs = await import("node:fs");
      const source = fs.readFileSync("src/app/api/tts/route.ts", "utf-8");
      expect(source).toContain("emitProviderEvent");
      expect(source).toContain("from \"@/lib/chat/provider-policy\"");
      expect(source).toContain("surface: \"tts\"");
    });
  });
});
