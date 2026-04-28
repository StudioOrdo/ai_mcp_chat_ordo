import { describe, expect, it } from "vitest";

import {
  buildMediaContinuityContextBlock,
  buildMediaContinuityHandoff,
  normalizeMediaContinuityHandoff,
} from "@/lib/chat/media-continuity-handoff";

describe("media-continuity-handoff", () => {
  it("derives reusable media references from prior transcript tool outputs", () => {
    const handoff = buildMediaContinuityHandoff([
      {
        id: "msg_media_assets",
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
                  assetId: "uf_visual_1",
                  assetKind: "chart",
                  label: "growth chart",
                  fileName: "growth-chart.mmd",
                  derivativeOfAssetId: "chart_test_001",
                },
                {
                  assetId: "uf_audio_1",
                  assetKind: "audio",
                  label: "growth narration",
                  fileName: "growth-narration.mp3",
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(handoff).toEqual({
      assets: [
        expect.objectContaining({
          assetId: "uf_visual_1",
          kind: "chart",
          aliases: expect.arrayContaining(["growth chart"]),
          derivativeOfAssetId: "chart_test_001",
        }),
        expect.objectContaining({
          assetId: "uf_audio_1",
          kind: "audio",
          aliases: expect.arrayContaining(["growth narration"]),
        }),
      ],
    });
  });

  it("normalizes and bounds inbound handoff payloads", () => {
    const handoff = normalizeMediaContinuityHandoff({
      assets: [
        {
          assetId: "uf_chart_1",
          kind: "chart",
          derivativeOfAssetId: "chart_test_001",
          aliases: ["Growth Chart", "Growth Chart", "  ", 42],
        },
        {
          assetId: "",
          kind: "audio",
          aliases: ["ignored"],
        },
      ],
    });

    expect(handoff).toEqual({
      assets: [
        {
          assetId: "uf_chart_1",
          kind: "chart",
          aliases: ["Growth Chart"],
          derivativeOfAssetId: "chart_test_001",
        },
      ],
    });
  });

  it("formats a server-owned context block that prefers reuse over regeneration", () => {
    const block = buildMediaContinuityContextBlock({
      assets: [
        {
          assetId: "uf_chart_1",
          kind: "chart",
          aliases: ["Growth Chart"],
          derivativeOfAssetId: "chart_test_001",
        },
        {
          assetId: "uf_audio_1",
          kind: "audio",
          aliases: ["Growth Narration"],
        },
      ],
    });

    expect(block).toContain("[Server media continuity handoff]");
    expect(block).toContain("prefer these assets instead of silently regenerating replacements");
    expect(block).toContain("chart: uf_chart_1");
    expect(block).toContain("audio: uf_audio_1");
    expect(block).toContain("derivativeOfAssetId=chart_test_001");
  });
});