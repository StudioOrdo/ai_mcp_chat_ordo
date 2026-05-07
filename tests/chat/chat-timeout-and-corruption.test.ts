/**
 * QA tests for BUG-chat-stream-timeout-and-message-corruption.
 *
 * Bug 1: Timeout retry amplification — deterministic timeouts after a
 *         successful tool round should NOT be retried.
 * Bug 2A: Consecutive user message corruption — consecutive same-role
 *          messages must be merged before hitting Anthropic.
 *
 * Bug 2B (error placeholder persistence) is in a separate file because
 * it requires vi.mock on anthropic-stream which would break the real
 * import used by Bug 1 tests.
 */
import { describe, expect, it, vi } from "vitest";
import { normalizeAlternation, buildContextWindow } from "@/lib/chat/context-window";
import { runClaudeAgentLoopStream } from "@/lib/chat/anthropic-stream";
import type { Message } from "@/core/entities/conversation";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createStreamDouble(
  finalMessage: () => Promise<{
    stop_reason: string | null;
    content: Array<Record<string, unknown>>;
  }>,
  onText?: (emit: (text: string) => void) => void,
) {
  return {
    on(event: string, handler: (text: string) => void) {
      if (event === "text" && onText) onText(handler);
    },
    finalMessage,
  };
}

function makeMessage(overrides: Partial<Message> = {}, index = 0): Message {
  return {
    id: `msg_${index}`,
    conversationId: "conv_1",
    role: "user",
    content: `Message ${index}`,
    parts: [{ type: "text", text: `Message ${index}` }],
    createdAt: new Date(2024, 0, 1, 0, index).toISOString(),
    tokenEstimate: 4,
    ...overrides,
  };
}

/* ================================================================== */
/*  Bug 1 — Timeout Retry Amplification                               */
/* ================================================================== */

describe("Bug 1 — timeout retry amplification", () => {
  it("does NOT retry timeout after a successful tool round", async () => {
    let callCount = 0;
    const stream = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return createStreamDouble(async () => ({
          stop_reason: "tool_use",
          content: [
            { type: "text", text: "calculating" },
            {
              type: "tool_use",
              id: "t1",
              name: "calculator",
              input: { expression: "2+2" },
            },
          ],
        }));
      }
      throw new Error("Provider request timed out after 45000ms.");
    });

    await expect(
      runClaudeAgentLoopStream({
        messages: [{ role: "user", content: "what is 2+2?" }],
        callbacks: { onDelta: vi.fn(), onToolCall: vi.fn(), onToolResult: vi.fn() },
        systemPrompt: "sys",
        tools: [
          {
            name: "calculator",
            description: "calc",
            input_schema: { type: "object" as const, properties: {} },
          },
        ],
        toolExecutor: vi.fn().mockResolvedValue("4"),
        client: { messages: { stream } } as never,
        modelCandidates: ["model-a"],
        retryAttempts: 3,
        retryDelayMs: 0,
        timeoutMs: 45000,
      }),
    ).rejects.toThrow("Stream provider timed out after 45000ms (round 1).");

    // Only 2 API calls: round 1 success + round 2 timeout. No retries.
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it("DOES retry timeout on the first round (completedRounds = 0)", async () => {
    let callCount = 0;
    const stream = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        throw new Error("Provider request timed out after 45000ms.");
      }
      return createStreamDouble(
        async () => ({ stop_reason: "end_turn", content: [] }),
        (emit) => emit("recovered"),
      );
    });

    const result = await runClaudeAgentLoopStream({
      messages: [{ role: "user", content: "hello" }],
      callbacks: { onDelta: vi.fn() },
      systemPrompt: "sys",
      tools: [],
      toolExecutor: vi.fn(),
      client: { messages: { stream } } as never,
      modelCandidates: ["model-a"],
      retryAttempts: 3,
      retryDelayMs: 0,
      timeoutMs: 45000,
    });

    // Timeout on round 1 with completedRounds=0 IS retried as transient
    expect(stream).toHaveBeenCalledTimes(3);
    expect(result.assistantText).toBe("recovered");
  });

  it("exhausts all retry attempts on persistent first-round timeout", async () => {
    const stream = vi.fn().mockImplementation(() => {
      throw new Error("Provider request timed out after 45000ms.");
    });

    await expect(
      runClaudeAgentLoopStream({
        messages: [{ role: "user", content: "hello" }],
        callbacks: {},
        systemPrompt: "sys",
        tools: [],
        toolExecutor: vi.fn(),
        client: { messages: { stream } } as never,
        modelCandidates: ["model-a"],
        retryAttempts: 3,
        retryDelayMs: 0,
        timeoutMs: 45000,
      }),
    ).rejects.toThrow("timed out");

    expect(stream).toHaveBeenCalledTimes(3);
  });
});

/* ================================================================== */
/*  Bug 2A — Message Alternation Normalization                        */
/* ================================================================== */

describe("Bug 2A — message alternation normalization", () => {
  it("merges 5 consecutive user messages (the production scenario)", () => {
    const result = normalizeAlternation([
      { role: "user", content: "create a journal article about..." },
      { role: "user", content: "hey lets discuss this for making..." },
      { role: "user", content: "hello" },
      { role: "user", content: "what can you do?" },
      { role: "user", content: "what can you do" },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toContain("create a journal article");
    expect(result[0].content).toContain("what can you do");
  });

  it("preserves role alternation after merging a corrupt sequence", () => {
    const result = normalizeAlternation([
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
      { role: "user", content: "u3" },
      { role: "user", content: "u4" },
    ]);

    expect(result).toHaveLength(3);
    expect(result.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(result[2].content).toBe("u2\n\nu3\n\nu4");
  });

  it("does not modify an already-alternating sequence", () => {
    const msgs = [
      { role: "user" as const, content: "a" },
      { role: "assistant" as const, content: "b" },
      { role: "user" as const, content: "c" },
    ];
    const result = normalizeAlternation(msgs);
    expect(result).toEqual(msgs);
  });

  it("buildContextWindow applies normalization end-to-end", () => {
    // Simulate the production scenario: timeout left a dangling user msg,
    // then user sent more messages without receiving a reply.
    const messages: Message[] = [
      makeMessage({ role: "user", content: "Hello" }, 0),
      makeMessage({ role: "assistant", content: "Hi there!" }, 1),
      makeMessage({ role: "user", content: "big paste content..." }, 2),
      // No assistant response (timeout lost it)
      makeMessage({ role: "user", content: "hello" }, 3),
      makeMessage({ role: "user", content: "what can you do?" }, 4),
    ];

    const { contextMessages } = buildContextWindow(messages);

    // After normalization: user, assistant, user (merged 3 consecutive)
    expect(contextMessages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
    ]);
    expect(contextMessages[2].content).toContain("big paste content");
    expect(contextMessages[2].content).toContain("what can you do?");
  });

  it("context window trims oversized merged messages", () => {
    const bigContent = "x".repeat(50_000);
    const messages: Message[] = [
      makeMessage({ role: "user", content: bigContent }, 0),
      makeMessage({ role: "assistant", content: "reply" }, 1),
      makeMessage({ role: "user", content: bigContent }, 2),
      // No assistant — timeout
      makeMessage({ role: "user", content: "short follow-up" }, 3),
    ];

    const { contextMessages } = buildContextWindow(messages);

    // Trimming should cap total characters to 80K
    const totalChars = contextMessages.reduce((s, m) => s + m.content.length, 0);
    expect(totalChars).toBeLessThanOrEqual(80_000);
    // The most recent message should be preserved
    expect(contextMessages[contextMessages.length - 1].content).toContain(
      "short follow-up",
    );
  });
});

