import { describe, it, expect } from "vitest";
import {
  updateMessageAtIndex,
  appendPart,
  appendTextDelta,
  isGenerationStatusMessagePart,
  upsertGenerationStatusMessage,
  setFailedSendMetadata,
} from "@/core/services/ConversationMessages";
import type { ChatMessage } from "@/core/entities/chat-message";
import type { GenerationStatusMessagePart } from "@/core/entities/message-parts";

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "msg_1",
    role: "assistant",
    content: "",
    timestamp: new Date("2026-01-01T00:00:00Z"),
    parts: [],
    ...overrides,
  };
}

describe("updateMessageAtIndex", () => {
  it("updates the message at the given index", () => {
    const messages = [makeMessage({ id: "a" }), makeMessage({ id: "b" })];
    const result = updateMessageAtIndex(messages, 1, (m) => ({ ...m, content: "updated" }));
    expect(result[1].content).toBe("updated");
    expect(result[0].id).toBe("a");
  });

  it("returns original array when index is out of bounds", () => {
    const messages = [makeMessage()];
    expect(updateMessageAtIndex(messages, 5, (m) => m)).toBe(messages);
  });

  it("does not mutate the input array", () => {
    const messages = [makeMessage()];
    const original = [...messages];
    updateMessageAtIndex(messages, 0, (m) => ({ ...m, content: "changed" }));
    expect(messages).toEqual(original);
  });
});

describe("appendPart", () => {
  it("adds a part to the message", () => {
    const msg = makeMessage({ parts: [] });
    const result = appendPart(msg, { type: "text", text: "hello" });
    expect(result.parts).toHaveLength(1);
    expect(result.parts![0]).toEqual({ type: "text", text: "hello" });
  });

  it("handles undefined parts gracefully", () => {
    const msg = makeMessage({ parts: undefined });
    const result = appendPart(msg, { type: "text", text: "hello" });
    expect(result.parts).toHaveLength(1);
  });
});

describe("appendTextDelta", () => {
  it("appends text to existing text part", () => {
    const msg = makeMessage({
      content: "Hello",
      parts: [{ type: "text", text: "Hello" }],
    });
    const result = appendTextDelta(msg, " world");
    expect(result.content).toBe("Hello world");
    expect(result.parts).toHaveLength(1);
    expect(result.parts![0]).toEqual({ type: "text", text: "Hello world" });
  });

  it("creates new text part when last part is not text", () => {
    const msg = makeMessage({
      content: "",
      parts: [{ type: "tool_call", name: "foo", args: {} }],
    });
    const result = appendTextDelta(msg, "hello");
    expect(result.parts).toHaveLength(2);
    expect(result.parts![1]).toEqual({ type: "text", text: "hello" });
  });

  it("creates text part when parts is empty", () => {
    const msg = makeMessage({ content: "", parts: [] });
    const result = appendTextDelta(msg, "start");
    expect(result.content).toBe("start");
    expect(result.parts).toHaveLength(1);
  });

  it("does not mutate the input message", () => {
    const msg = makeMessage({ content: "x", parts: [{ type: "text", text: "x" }] });
    const originalContent = msg.content;
    appendTextDelta(msg, "y");
    expect(msg.content).toBe(originalContent);
  });
});

describe("isGenerationStatusMessagePart", () => {
  it("returns true for generation_status parts", () => {
    expect(
      isGenerationStatusMessagePart({
        type: "generation_status",
        status: "stopped",
        actor: "user",
        reason: "test",
        partialContentRetained: false,
      }),
    ).toBe(true);
  });

  it("returns false for other parts", () => {
    expect(isGenerationStatusMessagePart({ type: "text", text: "x" })).toBe(false);
  });
});

describe("upsertGenerationStatusMessage", () => {
  it("adds generation status to a message", () => {
    const messages = [makeMessage({ content: "hello" })];
    const result = upsertGenerationStatusMessage(messages, 0, {
      status: "stopped",
      actor: "user",
      reason: "User stopped",
    });
    const genPart = result[0].parts!.find((p) => p.type === "generation_status");
    expect(genPart).toBeDefined();
    expect((genPart as GenerationStatusMessagePart).status).toBe("stopped");
    expect((genPart as GenerationStatusMessagePart).partialContentRetained).toBe(true); // has retained content
  });

  it("replaces existing generation status", () => {
    const messages = [
      makeMessage({
        parts: [
          {
            type: "generation_status",
            status: "stopped",
            actor: "user",
            reason: "old",
            partialContentRetained: false,
          },
        ],
      }),
    ];
    const result = upsertGenerationStatusMessage(messages, 0, {
      status: "interrupted",
      actor: "system",
      reason: "new",
    });
    const genParts = result[0].parts!.filter((p) => p.type === "generation_status");
    expect(genParts).toHaveLength(1);
    expect((genParts[0] as GenerationStatusMessagePart).status).toBe("interrupted");
  });
});

describe("setFailedSendMetadata", () => {
  it("sets failed send metadata on the message", () => {
    const messages = [makeMessage()];
    const result = setFailedSendMetadata(messages, 0, {
      retryKey: "retry_1",
      failedUserMessageId: "user_1",
    });
    expect(result[0].metadata?.failedSend?.retryKey).toBe("retry_1");
  });
});
