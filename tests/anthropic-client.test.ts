import { describe, expect, it, vi } from "vitest";
import { createMessageWithModelFallback } from "@/lib/chat/anthropic-client";

describe("createMessageWithModelFallback", () => {
  it("falls back to next model when first model is not found", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('404 {"type":"error","error":{"type":"not_found_error","message":"model:"}}'))
      .mockResolvedValueOnce({ content: [{ type: "text", text: "ok" }] });

    const client = { messages: { create } };

    const response = await createMessageWithModelFallback({
      client: client as never,
      messages: [{ role: "user", content: "hello" }] as never,
      toolChoice: { type: "auto" },
      options: { retryAttempts: 1, retryDelayMs: 0 },
      systemPrompt: "system",
      tools: [],
    });

    expect(response.content[0].type).toBe("text");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("does not swallow non-model errors", async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error("401 unauthorized"));
    const client = { messages: { create } };

    await expect(
      createMessageWithModelFallback({
        client: client as never,
        messages: [{ role: "user", content: "hello" }] as never,
        toolChoice: { type: "auto" },
        options: { retryAttempts: 1, retryDelayMs: 0 },
        systemPrompt: "system",
        tools: [],
      }),
    ).rejects.toThrow("Intelligence provider error: 401 unauthorized");

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("retries transient upstream failures", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error("503 temporarily unavailable"))
      .mockResolvedValueOnce({ content: [{ type: "text", text: "ok" }] });

    const client = { messages: { create } };

    const response = await createMessageWithModelFallback({
      client: client as never,
      messages: [{ role: "user", content: "hello" }] as never,
      toolChoice: { type: "auto" },
      options: { retryAttempts: 2, retryDelayMs: 0, timeoutMs: 500 },
      systemPrompt: "system",
      tools: [],
    });

    expect(response.content[0].type).toBe("text");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("throws timeout-normalized error", async () => {
    const create = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ content: [{ type: "text", text: "late" }] }), 50);
        }),
    );

    const client = { messages: { create } };

    await expect(
      createMessageWithModelFallback({
        client: client as never,
        messages: [{ role: "user", content: "hello" }] as never,
        toolChoice: { type: "auto" },
        options: { retryAttempts: 1, retryDelayMs: 0, timeoutMs: 1 },
        systemPrompt: "system",
        tools: [],
      }),
    ).rejects.toThrow("Intelligence provider error: Provider request timed out.");
  });

  it("does not retry timeout errors even with multiple retry attempts", async () => {
    const create = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ content: [{ type: "text", text: "late" }] }), 50);
        }),
    );

    const client = { messages: { create } };

    await expect(
      createMessageWithModelFallback({
        client: client as never,
        messages: [{ role: "user", content: "hello" }] as never,
        toolChoice: { type: "auto" },
        options: { retryAttempts: 3, retryDelayMs: 0, timeoutMs: 1 },
        systemPrompt: "system",
        tools: [],
      }),
    ).rejects.toThrow("Intelligence provider error: Provider request timed out.");

    // Should only attempt once — timeouts are not retried
    expect(create).toHaveBeenCalledTimes(1);
  });
});
