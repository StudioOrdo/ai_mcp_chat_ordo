import { describe, expect, it, vi } from "vitest";

import { runClaudeAgentLoopStream } from "@/lib/chat/anthropic-stream";

function createStreamDouble(finalMessage: () => Promise<{ stop_reason: string | null; content: Array<{ type: string }> }>, onText?: (emit: (text: string) => void) => void) {
  return {
    on: (event: string, handler: (text: string) => void) => {
      if (event === "text" && onText) {
        onText(handler);
      }
    },
    finalMessage,
  };
}

describe("runClaudeAgentLoopStream", () => {
  it("passes the provided abort signal through to the Anthropic stream request", async () => {
    const abortController = new AbortController();
    const stream = vi.fn().mockImplementation((_payload, options: { signal?: AbortSignal }) => {
      expect(options.signal).toBeDefined();
      expect(options.signal).not.toBe(abortController.signal);
      return createStreamDouble(async () => ({ stop_reason: "end_turn", content: [] }), (emit) => emit("ok"));
    });

    const result = await runClaudeAgentLoopStream({
      messages: [{ role: "user", content: "hello" }],
      callbacks: {},
      signal: abortController.signal,
      systemPrompt: "system",
      tools: [],
      toolExecutor: vi.fn(),
      client: { messages: { stream } } as never,
      modelCandidates: ["stable-model"],
      retryAttempts: 1,
      retryDelayMs: 0,
    });

    expect(result.assistantText).toBe("ok");
    expect(stream).toHaveBeenCalledTimes(1);
  });

  it("throws an AbortError immediately when the incoming signal is already aborted", async () => {
    const abortController = new AbortController();
    abortController.abort("request_disconnected");
    const stream = vi.fn();

    await expect(
      runClaudeAgentLoopStream({
        messages: [{ role: "user", content: "hello" }],
        callbacks: {},
        signal: abortController.signal,
        systemPrompt: "system",
        tools: [],
        toolExecutor: vi.fn(),
        client: { messages: { stream } } as never,
        modelCandidates: ["stable-model"],
        retryAttempts: 1,
        retryDelayMs: 0,
      }),
    ).rejects.toMatchObject({
      name: "ChatProviderError",
      message: "Stream provider error: request_disconnected",
    });

    expect(stream).not.toHaveBeenCalled();
  });

  it("falls back to the next model when the first model is not found", async () => {
    const stream = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('404 {"type":"error","error":{"type":"not_found_error","message":"model:"}}');
      })
      .mockImplementationOnce(() => createStreamDouble(async () => ({ stop_reason: "end_turn", content: [] }), (emit) => emit("ok")));

    const result = await runClaudeAgentLoopStream({
      messages: [{ role: "user", content: "hello" }],
      callbacks: {},
      systemPrompt: "system",
      tools: [],
      toolExecutor: vi.fn(),
      client: { messages: { stream } } as never,
      modelCandidates: ["missing-model", "fallback-model"],
      retryAttempts: 1,
      retryDelayMs: 0,
    });

    expect(result.model).toBe("fallback-model");
    expect(result.assistantText).toBe("ok");
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it("retries transient streaming failures before succeeding", async () => {
    const stream = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("503 temporarily unavailable");
      })
      .mockImplementationOnce(() => createStreamDouble(async () => ({ stop_reason: "end_turn", content: [] }), (emit) => emit("recovered")));

    const result = await runClaudeAgentLoopStream({
      messages: [{ role: "user", content: "hello" }],
      callbacks: {},
      systemPrompt: "system",
      tools: [],
      toolExecutor: vi.fn(),
      client: { messages: { stream } } as never,
      modelCandidates: ["stable-model"],
      retryAttempts: 2,
      retryDelayMs: 0,
    });

    expect(result.model).toBe("stable-model");
    expect(result.assistantText).toBe("recovered");
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it("does not retry timeout after a tool round succeeded", async () => {
    let callCount = 0;
    const stream = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First round succeeds with tool_use
        return createStreamDouble(async () => ({
          stop_reason: "tool_use",
          content: [
            { type: "text", text: "let me calculate" },
            { type: "tool_use", id: "tool_1", name: "calculator", input: { expression: "1+1" } },
          ],
        }));
      }
      // Second round times out
      throw new Error("Provider request timed out after 45000ms.");
    });

    await expect(
      runClaudeAgentLoopStream({
        messages: [{ role: "user", content: "what is 1+1?" }],
        callbacks: { onDelta: vi.fn(), onToolCall: vi.fn(), onToolResult: vi.fn() },
        systemPrompt: "system",
        tools: [{ name: "calculator", description: "calc", input_schema: { type: "object", properties: {} } }],
        toolExecutor: vi.fn().mockResolvedValue("2"),
        client: { messages: { stream } } as never,
        modelCandidates: ["test-model"],
        retryAttempts: 3,
        retryDelayMs: 0,
        timeoutMs: 45000,
      }),
    ).rejects.toThrow("Stream provider timed out after 45000ms (round 1).");

    // Should NOT have retried — only 2 stream calls (round 1 + round 2)
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it("rethrows aborted tool execution instead of converting it to a tool_result", async () => {
    const abortError = new Error("request_disconnected");
    abortError.name = "AbortError";
    const toolExecutor = vi.fn().mockRejectedValue(abortError);
    const onToolResult = vi.fn();
    const stream = vi.fn().mockImplementation(() => createStreamDouble(async () => ({
      stop_reason: "tool_use",
      content: [
        { type: "tool_use", id: "tool_1", name: "calculator", input: { expression: "1+1" } },
      ],
    })));

    await expect(
      runClaudeAgentLoopStream({
        messages: [{ role: "user", content: "what is 1+1?" }],
        callbacks: { onToolResult },
        systemPrompt: "system",
        tools: [{ name: "calculator", description: "calc", input_schema: { type: "object", properties: {} } }],
        toolExecutor,
        client: { messages: { stream } } as never,
        modelCandidates: ["stable-model"],
        retryAttempts: 1,
        retryDelayMs: 0,
      }),
    ).rejects.toMatchObject({
      name: "ChatProviderError",
      message: "Stream provider error: request_disconnected",
    });

    expect(toolExecutor).toHaveBeenCalledTimes(1);
    expect(onToolResult).not.toHaveBeenCalled();
  });
});