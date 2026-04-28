import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatStreamAdapter } from "./ChatStreamAdapter";

vi.mock("@/lib/observability/logger", () => ({
  logDegradation: vi.fn(),
}));

function createSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();

  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  }), {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
}

describe("ChatStreamAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts media continuity handoff payloads to the stream route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSseResponse([
      'data: {"done":true}\n\n',
    ]));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new ChatStreamAdapter();
    await adapter.fetchStream([{ role: "user", content: "combine them" }], {
      conversationId: "conv_media",
      currentPathname: "/",
      attachments: [],
      mediaContinuityHandoff: {
        assets: [
          { assetId: "uf_chart_1", kind: "chart", aliases: ["growth chart"] },
          { assetId: "uf_audio_1", kind: "audio", aliases: ["growth narration"] },
        ],
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat/stream",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: "combine them" }],
          conversationId: "conv_media",
          currentPathname: "/",
          currentPageSnapshot: undefined,
          attachments: [],
          taskOriginHandoff: undefined,
          mediaContinuityHandoff: {
            assets: [
              { assetId: "uf_chart_1", kind: "chart", aliases: ["growth chart"] },
              { assetId: "uf_audio_1", kind: "audio", aliases: ["growth narration"] },
            ],
          },
        }),
      }),
    );
  });

  it("parses the final buffered SSE event when the stream ends without a trailing newline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createSseResponse([
      'data: {"conversation_id":"conv_1"}\n\n',
      'data: {"delta":"8."}',
    ])));

    const adapter = new ChatStreamAdapter();
    const stream = await adapter.fetchStream([{ role: "user", content: "What is 4+4?" }], {
      conversationId: "conv_1",
      currentPathname: "/",
      attachments: [],
    });

    const events = [];
    for await (const event of stream.events()) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: "conversation_id", id: "conv_1" },
      { type: "text", delta: "8." },
      { type: "done" },
    ]);
  });
});