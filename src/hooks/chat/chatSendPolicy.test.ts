import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@/core/entities/chat-message";

import {
  buildBackendHistory,
  prepareChatSend,
  shouldRefreshConversationAfterStream,
  validateChatSend,
} from "./chatSendPolicy";

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `${role}-${content}`,
    role,
    content,
    parts: [{ type: "text", text: content }],
    timestamp: new Date("2026-03-23T00:00:00.000Z"),
  };
}

describe("chatSendPolicy", () => {
  it("rejects empty sends and concurrent sends", () => {
    expect(validateChatSend("   ", 0, false)).toEqual({
      trimmedMessage: "",
      error: "Cannot send an empty message.",
    });

    expect(validateChatSend("Hello", 0, true)).toEqual({
      trimmedMessage: "Hello",
      error: "A message is already sending.",
    });
  });

  it("accepts text-only and attachment-only sends", () => {
    expect(validateChatSend("  Hello  ", 0, false)).toEqual({
      trimmedMessage: "Hello",
      error: null,
    });

    expect(validateChatSend("   ", 1, false)).toEqual({
      trimmedMessage: "",
      error: null,
    });
  });

  it("builds optimistic messages and backend history from the current transcript", () => {
    const prepared = prepareChatSend(
      [createMessage("assistant", "Welcome")],
      "Audit this workflow",
      [],
    );

    expect(prepared.assistantIndex).toBe(2);
    expect(prepared.optimisticMessages).toHaveLength(3);
    expect(prepared.optimisticMessages[1]).toMatchObject({
      role: "user",
      content: "Audit this workflow",
    });
    expect(prepared.optimisticMessages[2]).toMatchObject({
      role: "assistant",
      content: "",
    });
    expect(prepared.historyForBackend).toEqual([
      { role: "assistant", content: "Welcome" },
      { role: "user", content: "Audit this workflow" },
    ]);
    expect(prepared.mediaContinuityHandoff).toBeNull();
  });

  it("derives a media continuity handoff from reusable prior assets", () => {
    const prepared = prepareChatSend(
      [
        {
          id: "msg_assets",
          role: "assistant",
          content: "",
          timestamp: new Date("2026-04-20T06:40:00.000Z"),
          parts: [
            {
              type: "tool_result",
              name: "list_conversation_media_assets",
              result: {
                action: "list_conversation_media_assets",
                assets: [
                  {
                    assetId: "uf_chart_1",
                    assetKind: "chart",
                    label: "Growth Chart",
                    fileName: "growth-chart.mmd",
                  },
                  {
                    assetId: "uf_audio_1",
                    assetKind: "audio",
                    label: "Growth Narration",
                    fileName: "growth-narration.mp3",
                  },
                ],
              },
            },
          ],
        },
      ],
      "combine them into a short video",
      [],
    );

    expect(prepared.mediaContinuityHandoff).toEqual({
      assets: [
        expect.objectContaining({ assetId: "uf_chart_1", kind: "chart" }),
        expect.objectContaining({ assetId: "uf_audio_1", kind: "audio" }),
      ],
    });
  });

  it("serializes structured messages with blank content into backend-safe history", () => {
    const history = buildBackendHistory([
      {
        id: "assistant-job-status",
        role: "assistant",
        content: "",
        parts: [{
          type: "job_status",
          jobId: "job_123",
          toolName: "produce_blog_article",
          label: "Produce Blog Article",
          status: "running",
          progressLabel: "Reviewing article",
          summary: "Editorial QA is in progress.",
        }],
        timestamp: new Date("2026-03-23T00:00:00.000Z"),
      },
      {
        id: "user-attachment-only",
        role: "user",
        content: "",
        parts: [{
          type: "attachment",
          assetId: "asset_123",
          fileName: "brief.pdf",
          mimeType: "application/pdf",
          fileSize: 1024,
        }],
        timestamp: new Date("2026-03-23T00:00:00.000Z"),
      },
    ]);

    expect(history).toEqual([
      {
        role: "assistant",
        content: "Job running: Produce Blog Article - Reviewing article Editorial QA is in progress.",
      },
      {
        role: "user",
        content: "Attachment: brief.pdf",
      },
    ]);
  });

  it("drops persisted system summaries from backend history replay", () => {
    const history = buildBackendHistory([
      {
        id: "system-summary",
        role: "system",
        content: "Absolutely. Give me the parameters and I'll generate it.",
        parts: [
          {
            type: "summary",
            text: "Absolutely. Give me the parameters and I'll generate it.",
            coversUpToMessageId: "msg_covered",
          },
        ],
        timestamp: new Date("2026-03-23T00:00:00.000Z"),
      },
      createMessage("user", "continue"),
    ]);

    expect(history).toEqual([
      { role: "user", content: "continue" },
    ]);
  });

  it("refreshes only when the stream resolves to a different or newly created conversation", () => {
    expect(shouldRefreshConversationAfterStream(null, "conv_new")).toBe(true);
    expect(shouldRefreshConversationAfterStream("conv_current", null)).toBe(false);
    expect(shouldRefreshConversationAfterStream("conv_current", "conv_current", true)).toBe(false);
    expect(shouldRefreshConversationAfterStream("conv_current", "conv_current", false)).toBe(true);
    expect(shouldRefreshConversationAfterStream("conv_current", "conv_other")).toBe(true);
  });
});