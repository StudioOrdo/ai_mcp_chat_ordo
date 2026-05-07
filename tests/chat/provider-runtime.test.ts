import { describe, expect, it, vi } from "vitest";

const { logEventMock } = vi.hoisted(() => ({
  logEventMock: vi.fn(),
}));

vi.mock("@/lib/observability/logger", () => ({
  logEvent: logEventMock,
}));

import { createProviderRuntime } from "@/lib/chat/provider-runtime";

describe("provider-runtime", () => {
  it("falls back to the next model when the handler requests next-model", async () => {
    const runtime = createProviderRuntime();
    const attempts: string[] = [];

    const result = await runtime.runWithResilience({
      surface: "stream",
      policy: {
        provider: "anthropic",
        timeoutMs: 1000,
        retryAttempts: 1,
        retryDelayMs: 0,
        modelCandidates: ["missing-model", "fallback-model"],
      },
      runAttempt: async ({ model }) => {
        attempts.push(model);
        if (model === "missing-model") {
          throw new Error('404 {"type":"error","error":{"type":"not_found_error","message":"model:"}}');
        }

        return "ok";
      },
      handleError: ({ error }) => {
        if (runtime.classifyError(error) === "model_not_found") {
          return { type: "next-model" };
        }

        return { type: "throw", error: new Error("unexpected") };
      },
      onExhausted: (lastError) => new Error(`exhausted: ${String(lastError)}`),
    });

    expect(result).toBe("ok");
    expect(attempts).toEqual(["missing-model", "fallback-model"]);
    expect(logEventMock.mock.calls).toEqual(
      expect.arrayContaining([
        [
          "warn",
          "provider.model_fallback",
          expect.objectContaining({
            surface: "stream",
            model: "missing-model",
            attempt: 1,
            errorClassification: "model_not_found",
          }),
        ],
      ]),
    );
  });

  it("retries the same model when the handler requests retry", async () => {
    const runtime = createProviderRuntime();
    const attempts: Array<{ model: string; attempt: number }> = [];

    const result = await runtime.runWithResilience({
      surface: "stream",
      policy: {
        provider: "anthropic",
        timeoutMs: 1000,
        retryAttempts: 2,
        retryDelayMs: 0,
        modelCandidates: ["stable-model"],
      },
      runAttempt: async ({ model, attempt }) => {
        attempts.push({ model, attempt });
        if (attempt === 1) {
          throw new Error("503 temporarily unavailable");
        }

        return "recovered";
      },
      handleError: ({ attempt, policy, error }) => {
        if (runtime.classifyError(error) === "transient" && attempt < policy.retryAttempts) {
          return { type: "retry" };
        }

        return { type: "throw", error: new Error("unexpected") };
      },
      onExhausted: (lastError) => new Error(`exhausted: ${String(lastError)}`),
    });

    expect(result).toBe("recovered");
    expect(attempts).toEqual([
      { model: "stable-model", attempt: 1 },
      { model: "stable-model", attempt: 2 },
    ]);
    expect(logEventMock.mock.calls).toEqual(
      expect.arrayContaining([
        [
          "warn",
          "provider.attempt_retry",
          expect.objectContaining({
            surface: "stream",
            model: "stable-model",
            attempt: 1,
            errorClassification: "transient",
          }),
        ],
      ]),
    );
  });

  it("throws the mapped failure error when the handler returns throw", async () => {
    const runtime = createProviderRuntime();

    await expect(
      runtime.runWithResilience({
        surface: "direct_turn",
        policy: {
        provider: "anthropic",
          timeoutMs: 1000,
          retryAttempts: 1,
          retryDelayMs: 0,
          modelCandidates: ["stable-model"],
        },
        runAttempt: async () => {
          throw new Error("permission denied");
        },
        handleError: () => ({
          type: "throw",
          error: new Error("normalized failure"),
        }),
        onExhausted: () => new Error("should not exhaust"),
      }),
    ).rejects.toThrow("normalized failure");

    expect(logEventMock.mock.calls).toEqual(
      expect.arrayContaining([
        [
          "error",
          "provider.attempt_failure",
          expect.objectContaining({
            surface: "direct_turn",
            model: "stable-model",
            attempt: 1,
            error: "normalized failure",
            errorClassification: "fatal",
          }),
        ],
      ]),
    );
  });

  it("calls onExhausted with the last error after all models are exhausted", async () => {
    const runtime = createProviderRuntime();
    const onExhausted = vi.fn((lastError: unknown) => new Error(`exhausted: ${String(lastError)}`));

    await expect(
      runtime.runWithResilience({
        surface: "stream",
        policy: {
        provider: "anthropic",
          timeoutMs: 1000,
          retryAttempts: 1,
          retryDelayMs: 0,
          modelCandidates: ["model-a", "model-b"],
        },
        runAttempt: async ({ model }) => {
          throw new Error(`${model} unavailable`);
        },
        handleError: () => ({ type: "next-model" }),
        onExhausted,
      }),
    ).rejects.toThrow("exhausted: Error: model-b unavailable");

    expect(onExhausted).toHaveBeenCalledWith(expect.any(Error));
    expect((onExhausted.mock.calls[0]?.[0] as Error).message).toBe("model-b unavailable");
  });

  it("throws onNoModels when no candidates are available", async () => {
    const runtime = createProviderRuntime();

    await expect(
      runtime.runWithResilience({
        surface: "stream",
        policy: {
        provider: "anthropic",
          timeoutMs: 1000,
          retryAttempts: 1,
          retryDelayMs: 0,
          modelCandidates: [],
        },
        runAttempt: async () => "never",
        handleError: () => ({ type: "throw", error: new Error("never") }),
        onExhausted: () => new Error("never"),
        onNoModels: () => new Error("no models configured"),
      }),
    ).rejects.toThrow("no models configured");
  });
});