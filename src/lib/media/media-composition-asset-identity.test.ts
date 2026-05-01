import { describe, expect, it } from "vitest";

import {
  buildMediaCompositionCanonicalizationOptionsFromAssetCatalogEntries,
  buildMediaCompositionCanonicalizationOptionsFromChatMessages,
} from "./media-composition-asset-identity";

describe("media-composition-asset-identity", () => {
  it("derives chart aliases from generate_chart tool call titles when the runtime payload is minimal", () => {
    const options = buildMediaCompositionCanonicalizationOptionsFromChatMessages([
      {
        id: "msg_chart_1",
        role: "assistant",
        content: "",
        timestamp: new Date("2026-04-17T09:00:00.000Z"),
        parts: [
          {
            type: "tool_call",
            name: "generate_chart",
            args: {
              code: "flowchart TD\nA-->B",
              title: "Signal Stack Chart",
            },
          },
          {
            type: "tool_result",
            name: "generate_chart",
            result: {
              assetId: "uf_chart_1",
            },
          },
        ],
      },
    ]);

    expect(options.assetCandidates).toEqual([
      expect.objectContaining({
        assetId: "uf_chart_1",
        kind: "chart",
        aliases: expect.arrayContaining(["Signal Stack Chart", "signal-stack-chart"]),
      }),
    ]);
  });

  it("derives graph aliases from generate_graph tool call titles when the runtime payload is minimal", () => {
    const options = buildMediaCompositionCanonicalizationOptionsFromChatMessages([
      {
        id: "msg_graph_1",
        role: "assistant",
        content: "",
        timestamp: new Date("2026-04-17T09:00:00.000Z"),
        parts: [
          {
            type: "tool_call",
            name: "generate_graph",
            args: {
              title: "Signal Stack Graph",
              caption: "Signal mix over time",
              graphType: "line",
              data: [{ step: 1, value: 2 }],
              xKey: "step",
              yKey: "value",
            },
          },
          {
            type: "tool_result",
            name: "generate_graph",
            result: {
              assetId: "uf_graph_1",
            },
          },
        ],
      },
    ]);

    expect(options.assetCandidates).toEqual([
      expect.objectContaining({
        assetId: "uf_graph_1",
        kind: "graph",
        aliases: expect.arrayContaining(["Signal Stack Graph", "signal-stack-graph"]),
      }),
    ]);
  });

  it("does not derive audio aliases from direct generate_audio transcript payloads", () => {
    const options = buildMediaCompositionCanonicalizationOptionsFromChatMessages([
      {
        id: "msg_audio_1",
        role: "assistant",
        content: "",
        timestamp: new Date("2026-04-17T09:00:00.000Z"),
        parts: [
          {
            type: "tool_call",
            name: "generate_audio",
            args: {
              text: "Narrate the signal stack summary.",
              title: "Signal Stack Narration",
            },
          },
          {
            type: "tool_result",
            name: "generate_audio",
            result: {
              action: "generate_audio",
              assetId: "uf_audio_1",
              assetKind: "audio",
              mimeType: "audio/mpeg",
              generationStatus: "cached_asset",
            },
          },
        ],
      },
    ]);

    expect(options.assetCandidates).toEqual([]);
  });

  it("builds canonical compose candidates directly from asset catalog entries", () => {
    const options = buildMediaCompositionCanonicalizationOptionsFromAssetCatalogEntries([
      {
        assetId: "uf_chart_1",
        kind: "chart",
        ownerUserId: "usr_owner",
        sourceType: "user_file",
        status: "ready",
        label: "Signal Stack Chart",
        fileName: "9f86d081884c7d659a2feaa0c55ad015.mmd",
        mimeType: "text/plain",
        source: "generated",
        retentionClass: "conversation",
        createdAt: "2026-04-17T09:00:01.000Z",
        updatedAt: "2026-04-17T09:00:01.000Z",
        conversationId: "conv_media_1",
        producedByJobId: "job_chart_1",
        materializationKey: "generate_chart:key_1",
        toolName: "generate_chart",
      },
    ]);

    expect(options.assetCandidates).toEqual([
      expect.objectContaining({
        assetId: "uf_chart_1",
        kind: "chart",
        aliases: expect.arrayContaining(["Signal Stack Chart", "signal-stack-chart"]),
      }),
    ]);
  });

  it("captures discovered governed assets from list_conversation_media_assets results", () => {
    const options = buildMediaCompositionCanonicalizationOptionsFromChatMessages([
      {
        id: "msg_asset_list_1",
        role: "assistant",
        content: "",
        timestamp: new Date("2026-04-20T06:40:00.000Z"),
        parts: [
          {
            type: "tool_result",
            name: "list_conversation_media_assets",
            result: {
              action: "list_conversation_media_assets",
              conversationId: "conv_media_1",
              assets: [
                {
                  assetId: "uf_94df24df-1431-423f-9626-2243738665fc",
                  assetKind: "image",
                  label: "img_hero_1200x1280",
                  fileName: "c6af588fddeb8168016e7af72715cf95.png",
                  mimeType: "image/png",
                  source: "uploaded",
                  retentionClass: "conversation",
                  createdAt: "2026-04-20T06:49:50.000Z",
                  conversationId: "conv_media_1",
                },
                {
                  assetId: "uf_9ed54139-0c32-4cb2-954c-469f22319bcb",
                  assetKind: "audio",
                  label: "audio_narration_63s",
                  fileName: "dcd359391b33b00de0268cd9d508dab6.mp3",
                  mimeType: "audio/mpeg",
                  source: "generated",
                  retentionClass: "conversation",
                  createdAt: "2026-04-20T06:49:40.000Z",
                  conversationId: "conv_media_1",
                },
              ],
              summary: "Returned 2 reusable media assets for this conversation.",
            },
          },
        ],
      },
    ]);

    expect(options.assetCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        assetId: "uf_94df24df-1431-423f-9626-2243738665fc",
        kind: "image",
        aliases: expect.arrayContaining(["img_hero_1200x1280"]),
      }),
      expect.objectContaining({
        assetId: "uf_9ed54139-0c32-4cb2-954c-469f22319bcb",
        kind: "audio",
        aliases: expect.arrayContaining(["audio_narration_63s"]),
      }),
    ]));
  });

  it("preserves lineage from list_conversation_media_assets results", () => {
    const options = buildMediaCompositionCanonicalizationOptionsFromChatMessages([
      {
        id: "msg_asset_lineage_1",
        role: "assistant",
        content: "",
        timestamp: new Date("2026-04-20T06:40:00.000Z"),
        parts: [
          {
            type: "tool_result",
            name: "list_conversation_media_assets",
            result: {
              action: "list_conversation_media_assets",
              conversationId: "conv_media_1",
              assets: [
                {
                  assetId: "uf_chart_png_1",
                  assetKind: "image",
                  label: "growth-chart.png",
                  fileName: "growth-chart.png",
                  mimeType: "image/png",
                  source: "derived",
                  retentionClass: "conversation",
                  createdAt: "2026-04-20T06:49:50.000Z",
                  conversationId: "conv_media_1",
                  derivativeOfAssetId: "chart_test_001",
                },
              ],
              summary: "Returned 1 reusable media asset for this conversation.",
            },
          },
        ],
      },
    ]);

    expect(options.assetCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        assetId: "uf_chart_png_1",
        kind: "image",
        derivativeOfAssetId: "chart_test_001",
      }),
    ]));
  });

  it("preserves overlapping aliases across different governed media kinds", () => {
    const options = buildMediaCompositionCanonicalizationOptionsFromChatMessages([
      {
        id: "msg_asset_list_overlap_1",
        role: "assistant",
        content: "",
        timestamp: new Date("2026-04-20T06:50:00.000Z"),
        parts: [
          {
            type: "tool_result",
            name: "list_conversation_media_assets",
            result: {
              action: "list_conversation_media_assets",
              conversationId: "conv_media_1",
              assets: [
                {
                  assetId: "uf_image_hero",
                  assetKind: "image",
                  label: "hero",
                  fileName: "hero.png",
                  mimeType: "image/png",
                  source: "uploaded",
                  retentionClass: "conversation",
                  createdAt: "2026-04-20T06:49:50.000Z",
                  conversationId: "conv_media_1",
                },
                {
                  assetId: "uf_audio_hero",
                  assetKind: "audio",
                  label: "hero",
                  fileName: "hero.mp3",
                  mimeType: "audio/mpeg",
                  source: "generated",
                  retentionClass: "conversation",
                  createdAt: "2026-04-20T06:49:40.000Z",
                  conversationId: "conv_media_1",
                },
              ],
              summary: "Returned 2 reusable media assets for this conversation.",
            },
          },
        ],
      },
    ]);

    expect(options.assetCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        assetId: "uf_image_hero",
        kind: "image",
        aliases: expect.arrayContaining(["hero", "hero.png"]),
      }),
      expect.objectContaining({
        assetId: "uf_audio_hero",
        kind: "audio",
        aliases: expect.arrayContaining(["hero", "hero.mp3"]),
      }),
    ]));
  });
});
