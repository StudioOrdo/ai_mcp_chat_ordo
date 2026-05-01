import { describe, expect, it } from "vitest";

import {
  dedupeAssetCatalogEntries,
  projectAssetCatalogEntryToConversationMediaAssetCandidate,
  projectBlogAssetToAssetCatalogEntry,
  projectUserFileToAssetCatalogEntry,
  sortAssetCatalogEntries,
} from "./AssetCatalogProjector";

describe("AssetCatalogProjector", () => {
  it("projects user files with materialization lineage into canonical catalog entries", () => {
    expect(projectUserFileToAssetCatalogEntry({
      id: "uf_1",
      userId: "usr_1",
      conversationId: "conv_1",
      status: "ready",
      contentHash: "hash_1",
      fileType: "chart",
      fileName: "funnel.svg",
      mimeType: "image/svg+xml",
      fileSize: 1,
      metadata: {
        assetKind: "chart",
        source: "generated",
        toolName: "generate_chart",
        derivativeOfAssetId: "chart_source_1",
        width: 1280,
        height: 720,
      },
      createdAt: "2026-04-28T10:03:00.000Z",
    }, {
      id: "mat_1",
      userId: "usr_1",
      conversationId: "conv_1",
      materializationKey: "generate_chart:key_1",
      toolName: "generate_chart",
      pipelineVersion: "generate_chart:v1",
      status: "ready",
      reusePolicy: "same_user",
      inputSourceRefs: [],
      outputRefs: [{ kind: "asset", id: "uf_1", userId: "usr_1", conversationId: "conv_1" }],
      evidenceRefs: [],
      producedByJobId: "job_1",
      supersededByRecordId: null,
      createdAt: "2026-04-28T10:03:00.000Z",
      updatedAt: "2026-04-28T10:04:00.000Z",
    })).toEqual(expect.objectContaining({
      assetId: "uf_1",
      ownerUserId: "usr_1",
      sourceType: "user_file",
      kind: "chart",
      producedByJobId: "job_1",
      materializationKey: "generate_chart:key_1",
      derivativeOfAssetId: "chart_source_1",
      width: 1280,
      height: 720,
    }));
  });

  it("projects durable blog assets and dedupes by newest entry", () => {
    const older = projectBlogAssetToAssetCatalogEntry({
      id: "blogasset_11111111-1111-1111-1111-111111111111",
      postId: null,
      kind: "hero",
      storagePath: "/tmp/hero-1.png",
      mimeType: "image/png",
      width: 1200,
      height: 630,
      altText: "Hero",
      sourcePrompt: null,
      provider: null,
      providerModel: null,
      visibility: "draft",
      selectionState: "selected",
      variationGroupId: null,
      createdByUserId: "usr_1",
      createdAt: "2026-04-28T10:03:00.000Z",
      updatedAt: "2026-04-28T10:03:00.000Z",
    });
    const newer = older && { ...older, updatedAt: "2026-04-28T10:05:00.000Z", label: "Hero updated" };

    expect(projectAssetCatalogEntryToConversationMediaAssetCandidate(newer!)).toEqual(expect.objectContaining({
      assetId: newer?.assetId,
      assetKind: "image",
      label: "Hero updated",
    }));
    expect(sortAssetCatalogEntries([older!, newer!])[0]).toEqual(newer);
    expect(dedupeAssetCatalogEntries([older!, newer!])).toEqual([newer]);
  });
});