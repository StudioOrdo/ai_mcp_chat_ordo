import { describe, expect, it, vi } from "vitest";

import type { BlogAssetRepository } from "@/core/use-cases/BlogAssetRepository";
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";
import type { UserFileRepository } from "@/core/use-cases/UserFileRepository";

import { RepositoryBackedAssetCatalogReader } from "./AssetCatalogReader";

describe("RepositoryBackedAssetCatalogReader", () => {
  it("lists direct and conversation-linked materialized assets for a conversation", async () => {
    const reader = new RepositoryBackedAssetCatalogReader({
      userFileRepository: {
        listByConversation: vi.fn().mockResolvedValue([
          {
            id: "file_1",
            userId: "usr_1",
            conversationId: "conv_1",
            status: "ready",
            contentHash: "hash_1",
            fileType: "image",
            fileName: "asset.png",
            mimeType: "image/png",
            fileSize: 1,
            metadata: { assetKind: "image" },
            createdAt: "2026-04-28T10:03:00.000Z",
          },
          {
            id: "file_other_user",
            userId: "usr_other",
            conversationId: "conv_1",
            status: "ready",
            contentHash: "hash_other",
            fileType: "audio",
            fileName: "other.mp3",
            mimeType: "audio/mpeg",
            fileSize: 1,
            metadata: { assetKind: "audio" },
            createdAt: "2026-04-28T10:02:00.000Z",
          },
        ]),
        findById: vi.fn().mockResolvedValue({
          id: "file_reused_1",
          userId: "usr_1",
          conversationId: "conv_source",
          status: "ready",
          contentHash: "hash_reused_1",
          fileType: "video",
          fileName: "reused.mp4",
          mimeType: "video/mp4",
          fileSize: 1,
          metadata: { assetKind: "video", source: "generated", toolName: "compose_media" },
          createdAt: "2026-04-28T09:00:00.000Z",
        }),
      } as unknown as UserFileRepository,
      materializationRepository: {
        listByConversation: vi.fn().mockResolvedValue([
          {
            id: "mat_reuse_conv_1",
            userId: "usr_1",
            conversationId: "conv_1",
            materializationKey: "compose_media:key_reused",
            toolName: "compose_media",
            pipelineVersion: "compose_media:v1",
            status: "ready",
            reusePolicy: "same_user",
            inputSourceRefs: [],
            outputRefs: [{ kind: "asset", id: "file_reused_1", userId: "usr_1", conversationId: "conv_source" }],
            evidenceRefs: [],
            producedByJobId: "job_reused_1",
            supersededByRecordId: null,
            createdAt: "2026-04-28T10:10:00.000Z",
            updatedAt: "2026-04-28T10:10:00.000Z",
          },
        ]),
        findLatestByOutputRef: vi.fn(async (_kind, id) => id === "file_1"
          ? {
              id: "mat_direct_1",
              userId: "usr_1",
              conversationId: "conv_1",
              materializationKey: "compose_media:key_direct",
              toolName: "compose_media",
              pipelineVersion: "compose_media:v1",
              status: "ready",
              reusePolicy: "same_user",
              inputSourceRefs: [],
              outputRefs: [{ kind: "asset", id: "file_1", userId: "usr_1", conversationId: "conv_1" }],
              evidenceRefs: [],
              producedByJobId: "job_direct_1",
              supersededByRecordId: null,
              createdAt: "2026-04-28T10:03:00.000Z",
              updatedAt: "2026-04-28T10:03:00.000Z",
            }
          : null),
      } as unknown as MaterializationRepository,
    });

    await expect(reader.listConversationAssets({
      conversationId: "conv_1",
      userId: "usr_1",
    })).resolves.toEqual([
      expect.objectContaining({
        assetId: "file_reused_1",
        kind: "video",
        ownerUserId: "usr_1",
        sourceType: "user_file",
        conversationId: "conv_1",
        producedByJobId: "job_reused_1",
        materializationKey: "compose_media:key_reused",
        updatedAt: "2026-04-28T10:10:00.000Z",
      }),
      expect.objectContaining({
        assetId: "file_1",
        kind: "image",
        ownerUserId: "usr_1",
        sourceType: "user_file",
        producedByJobId: "job_direct_1",
        materializationKey: "compose_media:key_direct",
        updatedAt: "2026-04-28T10:03:00.000Z",
      }),
    ]);
  });

  it("merges conversation assets with durable blog assets for reusable media discovery", async () => {
    const reader = new RepositoryBackedAssetCatalogReader({
      userFileRepository: {
        listByConversation: vi.fn().mockResolvedValue([
          {
            id: "file_1",
            userId: "usr_1",
            conversationId: "conv_1",
            status: "ready",
            contentHash: "hash_1",
            fileType: "image",
            fileName: "asset.png",
            mimeType: "image/png",
            fileSize: 1,
            metadata: { assetKind: "image" },
            createdAt: "2026-04-28T10:03:00.000Z",
          },
        ]),
        findById: vi.fn(),
      } as unknown as UserFileRepository,
      materializationRepository: {
        listByConversation: vi.fn().mockResolvedValue([]),
        findLatestByOutputRef: vi.fn().mockResolvedValue(null),
      } as unknown as MaterializationRepository,
      blogAssetRepository: {
        listByUser: vi.fn().mockResolvedValue([
          {
            id: "blogasset_1",
            postId: null,
            kind: "hero",
            storagePath: "/blog/hero.png",
            mimeType: "image/png",
            width: 1600,
            height: 900,
            altText: "Hero",
            sourcePrompt: null,
            provider: null,
            providerModel: null,
            visibility: "draft",
            selectionState: "selected",
            variationGroupId: null,
            createdByUserId: "usr_1",
            createdAt: "2026-04-28T10:04:00.000Z",
            updatedAt: "2026-04-28T10:04:00.000Z",
          },
        ]),
      } as unknown as BlogAssetRepository,
    });

    await expect(reader.listReusableMediaAssets({
      conversationId: "conv_1",
      userId: "usr_1",
      kinds: ["image"],
      limit: 10,
    })).resolves.toEqual([
      expect.objectContaining({
        assetId: "blogasset_1",
        kind: "image",
        ownerUserId: "usr_1",
        sourceType: "blog_asset",
        retentionClass: "durable",
        toolName: "generate_blog_image",
      }),
      expect.objectContaining({
        assetId: "file_1",
        kind: "image",
        retentionClass: "conversation",
      }),
    ]);
  });

  it("finds a catalog entry by governed asset id for the owning user", async () => {
    const reader = new RepositoryBackedAssetCatalogReader({
      userFileRepository: {
        findById: vi.fn().mockResolvedValue({
          id: "uf_1",
          userId: "usr_1",
          conversationId: "conv_1",
          status: "ready",
          contentHash: "hash_1",
          fileType: "audio",
          fileName: "voiceover.mp3",
          mimeType: "audio/mpeg",
          fileSize: 1,
          metadata: { assetKind: "audio", source: "generated", toolName: "generate_audio" },
          createdAt: "2026-04-28T10:03:00.000Z",
        }),
      } as unknown as UserFileRepository,
      materializationRepository: {
        findLatestByOutputRef: vi.fn().mockResolvedValue({
          id: "mat_audio_1",
          userId: "usr_1",
          conversationId: "conv_1",
          materializationKey: "generate_audio:key_1",
          toolName: "generate_audio",
          pipelineVersion: "generate_audio:v1",
          status: "ready",
          reusePolicy: "same_user",
          inputSourceRefs: [],
          outputRefs: [{ kind: "asset", id: "uf_1", userId: "usr_1", conversationId: "conv_1" }],
          evidenceRefs: [],
          producedByJobId: "job_audio_1",
          supersededByRecordId: null,
          createdAt: "2026-04-28T10:03:00.000Z",
          updatedAt: "2026-04-28T10:03:00.000Z",
        }),
      } as unknown as MaterializationRepository,
      blogAssetRepository: {
        findById: vi.fn(),
      } as unknown as BlogAssetRepository,
    });

    await expect(reader.findByAssetId({ assetId: "uf_1", userId: "usr_1" })).resolves.toEqual(
      expect.objectContaining({
        assetId: "uf_1",
        kind: "audio",
        ownerUserId: "usr_1",
        sourceType: "user_file",
        producedByJobId: "job_audio_1",
      }),
    );
  });
});
