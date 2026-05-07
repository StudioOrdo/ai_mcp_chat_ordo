import { describe, expect, it, vi } from "vitest";

import { createMessageWithModelFallback } from "@/lib/chat/anthropic-client";
import { runClaudeAgentLoopStream } from "@/lib/chat/anthropic-stream";

function createStreamDouble(
  finalMessage: () => Promise<{
    stop_reason: string | null;
    content: Array<Record<string, unknown>>;
  }>,
  onText?: (emit: (text: string) => void) => void,
) {
  return {
    on(event: string, handler: (text: string) => void) {
      if (event === "text" && onText) {
        onText(handler);
      }
    },
    finalMessage,
  };
}

describe("chat provider parity", () => {
  it("falls back to the next model in both direct-turn and stream paths", async () => {
    const directCreate = vi
      .fn()
      .mockRejectedValueOnce(new Error('404 {"type":"error","error":{"type":"not_found_error","message":"model:"}}'))
      .mockResolvedValueOnce({ content: [{ type: "text", text: "ok" }] });

    const stream = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('404 {"type":"error","error":{"type":"not_found_error","message":"model:"}}');
      })
      .mockImplementationOnce(() => createStreamDouble(
        async () => ({ stop_reason: "end_turn", content: [] }),
        (emit) => emit("ok"),
      ));

    const [directResponse, streamResponse] = await Promise.all([
      createMessageWithModelFallback({
        client: { messages: { create: directCreate } } as never,
        messages: [{ role: "user", content: "hello" }] as never,
        toolChoice: { type: "auto" },
        options: { retryAttempts: 1, retryDelayMs: 0 },
        systemPrompt: "system",
        tools: [],
      }),
      runClaudeAgentLoopStream({
        messages: [{ role: "user", content: "hello" }],
        callbacks: {},
        systemPrompt: "system",
        tools: [],
        toolExecutor: vi.fn(),
        client: { messages: { stream } } as never,
        modelCandidates: ["missing-model", "fallback-model"],
        retryAttempts: 1,
        retryDelayMs: 0,
      }),
    ]);

    expect(directResponse.content[0].type).toBe("text");
    expect(streamResponse.assistantText).toBe("ok");
    expect(directCreate).toHaveBeenCalledTimes(2);
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it("retries transient upstream failures with the same attempt budget in both paths", async () => {
    const directCreate = vi
      .fn()
      .mockRejectedValueOnce(new Error("503 temporarily unavailable"))
      .mockResolvedValueOnce({ content: [{ type: "text", text: "ok" }] });

    const stream = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("503 temporarily unavailable");
      })
      .mockImplementationOnce(() => createStreamDouble(
        async () => ({ stop_reason: "end_turn", content: [] }),
        (emit) => emit("ok"),
      ));

    const [directResponse, streamResponse] = await Promise.all([
      createMessageWithModelFallback({
        client: { messages: { create: directCreate } } as never,
        messages: [{ role: "user", content: "hello" }] as never,
        toolChoice: { type: "auto" },
        options: { retryAttempts: 2, retryDelayMs: 0, timeoutMs: 500 },
        systemPrompt: "system",
        tools: [],
      }),
      runClaudeAgentLoopStream({
        messages: [{ role: "user", content: "hello" }],
        callbacks: {},
        systemPrompt: "system",
        tools: [],
        toolExecutor: vi.fn(),
        client: { messages: { stream } } as never,
        modelCandidates: ["stable-model"],
        retryAttempts: 2,
        retryDelayMs: 0,
      }),
    ]);

    expect(directResponse.content[0].type).toBe("text");
    expect(streamResponse.assistantText).toBe("ok");
    expect(directCreate).toHaveBeenCalledTimes(2);
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it("keeps the intentional first-round timeout difference between stream and direct-turn", async () => {
    const directCreate = vi.fn().mockImplementation(
      () => new Promise((resolve) => {
        setTimeout(() => resolve({ content: [{ type: "text", text: "late" }] }), 50);
      }),
    );

    let streamCallCount = 0;
    const stream = vi.fn().mockImplementation(() => {
      streamCallCount += 1;
      if (streamCallCount <= 2) {
        throw new Error("Provider request timed out after 45000ms.");
      }

      return createStreamDouble(
        async () => ({ stop_reason: "end_turn", content: [] }),
        (emit) => emit("recovered"),
      );
    });

    await expect(
      createMessageWithModelFallback({
        client: { messages: { create: directCreate } } as never,
        messages: [{ role: "user", content: "hello" }] as never,
        toolChoice: { type: "auto" },
        options: { retryAttempts: 3, retryDelayMs: 0, timeoutMs: 1 },
        systemPrompt: "system",
        tools: [],
      }),
    ).rejects.toThrow("Intelligence provider error: Provider request timed out.");

    const streamResponse = await runClaudeAgentLoopStream({
      messages: [{ role: "user", content: "hello" }],
      callbacks: {},
      systemPrompt: "system",
      tools: [],
      toolExecutor: vi.fn(),
      client: { messages: { stream } } as never,
      modelCandidates: ["stable-model"],
      retryAttempts: 3,
      retryDelayMs: 0,
      timeoutMs: 45_000,
    });

    expect(directCreate).toHaveBeenCalledTimes(1);
    expect(stream).toHaveBeenCalledTimes(3);
    expect(streamResponse.assistantText).toBe("recovered");
  });
});