import { describe, expect, it, vi } from "vitest";

import type { AssetCatalogEntry } from "@/core/entities/asset-catalog";
import { createListConversationMediaAssetsTool } from "./list-conversation-media-assets.tool";

function createAssetCatalogEntry(overrides: Partial<AssetCatalogEntry> = {}): AssetCatalogEntry {
  return {
    assetId: "uf_1",
    kind: "audio",
    ownerUserId: "usr_1",
    sourceType: "user_file",
    status: "ready",
    label: "voiceover.mp3",
    fileName: "voiceover.mp3",
    mimeType: "audio/mpeg",
    source: "generated",
    retentionClass: "conversation",
    createdAt: "2026-04-14T12:00:00.000Z",
    updatedAt: "2026-04-14T12:00:00.000Z",
    conversationId: "conv_1",
    producedByJobId: "job_audio_1",
    materializationKey: "generate_audio:key_1",
    toolName: "generate_audio",
    durationSeconds: 18,
    ...overrides,
  };
}

describe("createListConversationMediaAssetsTool", () => {
  it("returns reusable conversation media assets for the active signed-in user", async () => {
    const listReusableMediaAssets = vi.fn().mockResolvedValue([
      createAssetCatalogEntry({
        assetId: "uf_2",
        kind: "chart",
        label: "funnel.svg",
        fileName: "funnel.svg",
        mimeType: "image/svg+xml",
        durationSeconds: undefined,
        toolName: "generate_chart",
        derivativeOfAssetId: "chart_test_001",
        width: 1280,
        height: 720,
        producedByJobId: null,
        materializationKey: null,
        createdAt: "2026-04-14T12:05:00.000Z",
        updatedAt: "2026-04-14T12:05:00.000Z",
      }),
      createAssetCatalogEntry(),
    ]);
    const tool = createListConversationMediaAssetsTool({
      listReusableMediaAssets,
    } as never);

    const result = await tool.command.execute(
      { kinds: ["audio", "chart"] },
      { role: "AUTHENTICATED", userId: "usr_1", conversationId: "conv_1" },
    );

    expect(listReusableMediaAssets).toHaveBeenCalledWith({
      conversationId: "conv_1",
      userId: "usr_1",
      kinds: ["audio", "chart"],
      limit: undefined,
    });
    expect(result).toEqual({
      ok: true,
      action: "list_conversation_media_assets",
      conversationId: "conv_1",
      assets: [
        {
          assetId: "uf_2",
          assetKind: "chart",
          label: "funnel.svg",
          fileName: "funnel.svg",
          mimeType: "image/svg+xml",
          source: "generated",
          retentionClass: "conversation",
          createdAt: "2026-04-14T12:05:00.000Z",
          conversationId: "conv_1",
          producedByJobId: null,
          materializationKey: null,
          derivativeOfAssetId: "chart_test_001",
          toolName: "generate_chart",
          width: 1280,
          height: 720,
        },
        {
          assetId: "uf_1",
          assetKind: "audio",
          label: "voiceover.mp3",
          fileName: "voiceover.mp3",
          mimeType: "audio/mpeg",
          source: "generated",
          retentionClass: "conversation",
          createdAt: "2026-04-14T12:00:00.000Z",
          conversationId: "conv_1",
          producedByJobId: "job_audio_1",
          materializationKey: "generate_audio:key_1",
          toolName: "generate_audio",
          durationSeconds: 18,
        },
      ],
      summary: "Returned 2 reusable media assets for this conversation. Use the assetId values exactly as shown when referencing them in compose_media clips. Charts and graphs are valid direct governed inputs; if a derived image exists, preserve the original source via sourceAssetId.",
    });
  });

  it("rejects anonymous access", async () => {
    const tool = createListConversationMediaAssetsTool({
      listReusableMediaAssets: vi.fn(),
    } as never);

    await expect(
      tool.command.execute({}, { role: "ANONYMOUS", userId: "anonymous", conversationId: "conv_1" }),
    ).rejects.toThrow("Sign in is required to inspect reusable media assets.");
  });
});
