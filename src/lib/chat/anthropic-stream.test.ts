import { describe, expect, it, vi } from "vitest";

import { runClaudeAgentLoopStream } from "./anthropic-stream";

describe("runClaudeAgentLoopStream", () => {
  it("propagates Anthropic tool_use ids through callbacks, executor, and result metadata", async () => {
    const handlers: Record<string, (text: string) => void> = {};
    const stream = {
      on: vi.fn((event: string, handler: (text: string) => void) => {
        handlers[event] = handler;
        return stream;
      }),
      finalMessage: vi
        .fn()
        .mockResolvedValueOnce({
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              id: "toolu_audio_1",
              name: "generate_audio",
              input: { text: "cheese" },
            },
          ],
        })
        .mockResolvedValueOnce({
          stop_reason: "end_turn",
          content: [{ type: "text", text: "Done" }],
        }),
    };
    const client = {
      messages: {
        stream: vi.fn(() => stream),
      },
    };
    const callbacks = {
      onToolCall: vi.fn(),
      onToolResult: vi.fn(),
    };
    const toolExecutor = vi.fn().mockResolvedValue({ assetId: "uf_audio_1" });

    const result = await runClaudeAgentLoopStream({
      messages: [{ role: "user", content: "make audio" }],
      callbacks,
      maxToolRounds: 2,
      systemPrompt: "system",
      tools: [{ name: "generate_audio", description: "Generate audio", input_schema: { type: "object" } }],
      toolExecutor,
      client: client as never,
      modelCandidates: ["claude-test"],
      retryAttempts: 1,
    });

    expect(callbacks.onToolCall).toHaveBeenCalledWith(
      "generate_audio",
      { text: "cheese" },
      "toolu_audio_1",
    );
    expect(toolExecutor).toHaveBeenCalledWith(
      "generate_audio",
      { text: "cheese" },
      "toolu_audio_1",
    );
    expect(callbacks.onToolResult).toHaveBeenCalledWith(
      "generate_audio",
      { assetId: "uf_audio_1" },
      "toolu_audio_1",
    );
    expect(result.toolCalls).toEqual([
      { name: "generate_audio", args: { text: "cheese" }, toolInvocationId: "toolu_audio_1" },
    ]);
    expect(result.toolResults).toEqual([
      {
        name: "generate_audio",
        result: { assetId: "uf_audio_1" },
        isError: false,
        toolInvocationId: "toolu_audio_1",
      },
    ]);
  });

  it("reuses a prior tool result when Anthropic replays the same tool_use id", async () => {
    const repeatedToolUse = {
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "toolu_chart_1",
          name: "generate_chart",
          input: { title: "Pipeline" },
        },
      ],
    };
    const stream = {
      on: vi.fn(() => stream),
      finalMessage: vi
        .fn()
        .mockResolvedValueOnce(repeatedToolUse)
        .mockResolvedValueOnce(repeatedToolUse)
        .mockResolvedValueOnce({
          stop_reason: "end_turn",
          content: [{ type: "text", text: "Done" }],
        }),
    };
    const client = {
      messages: {
        stream: vi.fn(() => stream),
      },
    };
    const callbacks = {
      onToolCall: vi.fn(),
      onToolResult: vi.fn(),
    };
    const toolExecutor = vi.fn().mockResolvedValue({ assetId: "uf_chart_1" });

    const result = await runClaudeAgentLoopStream({
      messages: [{ role: "user", content: "make chart" }],
      callbacks,
      maxToolRounds: 3,
      systemPrompt: "system",
      tools: [{ name: "generate_chart", description: "Generate chart", input_schema: { type: "object" } }],
      toolExecutor,
      client: client as never,
      modelCandidates: ["claude-test"],
      retryAttempts: 1,
    });

    expect(toolExecutor).toHaveBeenCalledTimes(1);
    expect(callbacks.onToolCall).toHaveBeenCalledTimes(1);
    expect(callbacks.onToolResult).toHaveBeenCalledTimes(1);
    expect(result.toolCalls).toEqual([
      { name: "generate_chart", args: { title: "Pipeline" }, toolInvocationId: "toolu_chart_1" },
    ]);
    expect(result.toolResults).toEqual([
      {
        name: "generate_chart",
        result: { assetId: "uf_chart_1" },
        isError: false,
        toolInvocationId: "toolu_chart_1",
      },
    ]);
  });
});