import { describe, expect, it } from "vitest";

import type { Message } from "@/core/entities/conversation";
import { TranscriptStore, buildTranscriptFromMessages } from "./transcript-store";

function makeMessage(overrides: Partial<Message> = {}, index = 0): Message {
  return {
    id: `msg_${index}`,
    conversationId: "conv_1",
    role: "user",
    content: `Message ${index}`,
    parts: [{ type: "text", text: `Message ${index}` }],
    createdAt: new Date(2026, 3, 9, 12, index).toISOString(),
    tokenEstimate: 4,
    ...overrides,
  };
}

describe("TranscriptStore", () => {
  it("replays persisted messages into a transcript with explicit tool and compaction entries", () => {
    const messages: Message[] = [
      makeMessage({ role: "user", content: "Hello there" }, 0),
      makeMessage(
        {
          role: "assistant",
          content: "The result is ready.",
          parts: [
            { type: "text", text: "The result is ready." },
            { type: "tool_result", name: "calculator", result: 4, toolInvocationId: "toolu_calc_1" },
          ],
        },
        1,
      ),
      makeMessage(
        {
          role: "system",
          content: "Summary of the earlier discussion.",
          parts: [
            { type: "summary", text: "Summary of the earlier discussion.", coversUpToMessageId: "msg_0" },
            {
              type: "compaction_marker",
              kind: "summary",
              compactedCount: 1,
              coversUpToMessageId: "msg_0",
            },
          ],
        },
        2,
      ),
    ];

    const transcript = buildTranscriptFromMessages(messages);

    expect(transcript.map((entry) => entry.role)).toEqual([
      "user",
      "assistant",
      "tool_result",
      "system",
      "compaction_marker",
    ]);
    expect(transcript[2]).toMatchObject({
      role: "tool_result",
      sourceMessageId: "msg_1",
      toolInvocationId: "toolu_calc_1",
      contentSummary: "calculator: 4",
    });
    expect(transcript[4]).toMatchObject({
      role: "compaction_marker",
      sourceMessageId: "msg_2",
      compactionKind: "summary",
      compactedCount: 1,
      coversUpToMessageId: "msg_0",
    });
  });

  it("exports markdown without compaction marker lines", () => {
    const store = TranscriptStore.fromMessages([
      makeMessage({ role: "user", content: "Question" }, 0),
      makeMessage(
        {
          role: "system",
          content: "Meta summary",
          parts: [
            { type: "meta_summary", text: "Meta summary", coversUpToSummaryId: "summary_4", summariesCompacted: 4 },
            {
              type: "compaction_marker",
              kind: "meta_summary",
              compactedCount: 4,
              coversUpToSummaryId: "summary_4",
            },
          ],
        },
        1,
      ),
    ]);

    const markdown = store.exportAsMarkdown();

    expect(markdown).toContain("**[User]** Question");
    expect(markdown).toContain("**[System]** Meta summary");
    expect(markdown).not.toContain("Compaction Marker");
    expect(markdown).not.toContain("Conversation summaries compacted");
  });

  it("appends manual compaction markers with structured replay metadata", () => {
    const store = new TranscriptStore();
    store.appendCompactionMarker("msg_summary", "2026-04-09T12:00:00.000Z", {
      type: "compaction_marker",
      kind: "meta_summary",
      compactedCount: 3,
      coversUpToSummaryId: "summary_9",
    });

    expect(store.replay()).toEqual([
      expect.objectContaining({
        turnIndex: 0,
        role: "compaction_marker",
        sourceMessageId: "msg_summary",
        compactedCount: 3,
        compactionKind: "meta_summary",
        coversUpToSummaryId: "summary_9",
        inContextWindow: false,
      }),
    ]);
  });
});