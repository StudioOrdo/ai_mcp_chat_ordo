import { describe, expect, it, vi } from "vitest";

import type { UserFile } from "@/core/entities/user-file";
import { createListConversationMediaAssetsTool } from "./list-conversation-media-assets.tool";

function createUserFile(overrides: Partial<UserFile> = {}): UserFile {
  return {
    id: "uf_1",
    userId: "usr_1",
    conversationId: "conv_1",
    contentHash: "hash_1",
    fileType: "audio",
    fileName: "voiceover.mp3",
    mimeType: "audio/mpeg",
    fileSize: 1024,
    metadata: {
      assetKind: "audio",
      source: "generated",
      toolName: "generate_audio",
      durationSeconds: 18,
    },
    createdAt: "2026-04-14T12:00:00.000Z",
    ...overrides,
  };
}

describe("createListConversationMediaAssetsTool", () => {
  it("returns reusable conversation media assets for the active signed-in user", async () => {
    const listByConversation = vi.fn().mockResolvedValue([
      createUserFile(),
      createUserFile({
        id: "uf_2",
        fileType: "chart",
        fileName: "funnel.svg",
        mimeType: "image/svg+xml",
        metadata: {
          assetKind: "chart",
          source: "generated",
          toolName: "generate_chart",
          derivativeOfAssetId: "chart_test_001",
          width: 1280,
          height: 720,
        },
        createdAt: "2026-04-14T12:05:00.000Z",
      }),
      createUserFile({
        id: "uf_3",
        fileType: "document",
        fileName: "notes.txt",
        mimeType: "text/plain",
        metadata: {},
      }),
      createUserFile({
        id: "uf_4",
        userId: "usr_other",
        fileName: "other-user.mp3",
      }),
    ]);
    const tool = createListConversationMediaAssetsTool({
      listByConversation,
    } as never);

    const result = await tool.command.execute(
      { kinds: ["audio", "chart"] },
      { role: "AUTHENTICATED", userId: "usr_1", conversationId: "conv_1" },
    );

    expect(listByConversation).toHaveBeenCalledWith("conv_1");
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
          toolName: "generate_audio",
          durationSeconds: 18,
        },
      ],
      summary: "Returned 2 reusable media assets for this conversation. Use the assetId values exactly as shown when referencing them in compose_media clips. Charts and graphs are valid direct governed inputs; if a derived image exists, preserve the original source via sourceAssetId.",
    });
  });

  it("rejects anonymous access", async () => {
    const tool = createListConversationMediaAssetsTool({
      listByConversation: vi.fn(),
    } as never);

    await expect(
      tool.command.execute({}, { role: "ANONYMOUS", userId: "anonymous", conversationId: "conv_1" }),
    ).rejects.toThrow("Sign in is required to inspect reusable media assets.");
  });
});