import { describe, expect, it } from "vitest";

import type { MessagePart } from "@/core/entities/message-parts";

import { resolveMediaAssetDiscoveryGuard } from "./stream-execution";

describe("resolveMediaAssetDiscoveryGuard", () => {
  it("requires a same-turn media asset listing before compose_media", () => {
    expect(resolveMediaAssetDiscoveryGuard("compose_media", [])).toMatchObject({
      ok: false,
      action: "media_asset_discovery_required",
      error: expect.stringContaining("list_conversation_media_assets"),
    });
  });

  it("allows compose_media after list_conversation_media_assets succeeds in the same turn", () => {
    const assistantParts: MessagePart[] = [
      {
        type: "tool_result",
        name: "list_conversation_media_assets",
        result: {
          ok: true,
          action: "list_conversation_media_assets",
          assets: [{ assetId: "uf_audio_1" }],
        },
      },
    ];

    expect(resolveMediaAssetDiscoveryGuard("compose_media", assistantParts)).toBeNull();
  });
});