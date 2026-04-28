import { describe, expect, it } from "vitest";

import type { MediaCompositionPlan } from "@/core/entities/media-composition";

import { evaluateComposeMediaAssetReadiness } from "./compose-media-preflight";

function createPlan(): MediaCompositionPlan {
  return {
    id: "plan_1",
    conversationId: "conv_1",
    visualClips: [{ assetId: "asset_image_1", kind: "image" }],
    audioClips: [{ assetId: "asset_audio_1", kind: "audio" }],
    profile: "auto",
    subtitlePolicy: "none",
    waveformPolicy: "none",
    outputFormat: "mp4",
    resolution: { width: 1280, height: 720 },
  };
}

describe("compose-media preflight", () => {
  it("accepts governed assets that match clip kinds in the active conversation", () => {
    const failure = evaluateComposeMediaAssetReadiness({
      plan: createPlan(),
      assetsById: new Map([
        ["asset_image_1", { assetId: "asset_image_1", status: "ready", assetKind: "image", conversationId: "conv_1" }],
        ["asset_audio_1", { assetId: "asset_audio_1", status: "ready", assetKind: "audio", conversationId: "conv_1" }],
      ]),
    });

    expect(failure).toBeNull();
  });

  it("rejects missing governed assets", () => {
    const failure = evaluateComposeMediaAssetReadiness({
      plan: createPlan(),
      assetsById: new Map([
        ["asset_audio_1", { assetId: "asset_audio_1", status: "ready", assetKind: "audio", conversationId: "conv_1" }],
      ]),
    });

    expect(failure).toMatchObject({
      code: "asset_not_found",
      assetId: "asset_image_1",
      clipKind: "image",
    });
  });

  it("rejects inaccessible assets", () => {
    const failure = evaluateComposeMediaAssetReadiness({
      plan: createPlan(),
      assetsById: new Map([
        ["asset_image_1", { assetId: "asset_image_1", status: "forbidden", assetKind: "image", conversationId: "conv_1" }],
        ["asset_audio_1", { assetId: "asset_audio_1", status: "ready", assetKind: "audio", conversationId: "conv_1" }],
      ]),
    });

    expect(failure).toMatchObject({
      code: "asset_forbidden",
      assetId: "asset_image_1",
    });
  });

  it("rejects pending assets with a specific pending failure code to allow retry", () => {
    const failure = evaluateComposeMediaAssetReadiness({
      plan: createPlan(),
      assetsById: new Map([
        ["asset_image_1", { assetId: "asset_image_1", status: "ready", assetKind: "image", conversationId: "conv_1" }],
        ["asset_audio_1", { assetId: "asset_audio_1", status: "pending", assetKind: "audio", conversationId: "conv_1" }],
      ]),
    });

    expect(failure).toMatchObject({
      code: "asset_pending",
      assetId: "asset_audio_1",
    });
  });

  it("rejects stored asset kind mismatches", () => {
    const failure = evaluateComposeMediaAssetReadiness({
      plan: createPlan(),
      assetsById: new Map([
        ["asset_image_1", { assetId: "asset_image_1", status: "ready", assetKind: "video", conversationId: "conv_1" }],
        ["asset_audio_1", { assetId: "asset_audio_1", status: "ready", assetKind: "audio", conversationId: "conv_1" }],
      ]),
    });

    expect(failure).toMatchObject({
      code: "asset_kind_mismatch",
      assetId: "asset_image_1",
      clipKind: "image",
    });
  });

  it("rejects assets from another conversation when they are attached", () => {
    const failure = evaluateComposeMediaAssetReadiness({
      plan: createPlan(),
      assetsById: new Map([
        ["asset_image_1", { assetId: "asset_image_1", status: "ready", assetKind: "image", conversationId: "conv_other" }],
        ["asset_audio_1", { assetId: "asset_audio_1", status: "ready", assetKind: "audio", conversationId: "conv_1" }],
      ]),
    });

    expect(failure).toMatchObject({
      code: "asset_conversation_mismatch",
      assetId: "asset_image_1",
    });
  });

  it("accepts direct source-lineage matches when a clip requires an explicit selected asset", () => {
    const plan = {
      ...createPlan(),
      audioClips: [{ assetId: "asset_audio_1", kind: "audio" as const, sourceAssetId: "asset_audio_1" }],
    };

    const failure = evaluateComposeMediaAssetReadiness({
      plan,
      assetsById: new Map([
        ["asset_image_1", { assetId: "asset_image_1", status: "ready", assetKind: "image", conversationId: "conv_1" }],
        ["asset_audio_1", { assetId: "asset_audio_1", status: "ready", assetKind: "audio", conversationId: "conv_1" }],
      ]),
    });

    expect(failure).toBeNull();
  });

  it("accepts derivative source-lineage matches for materialized assets", () => {
    const plan = {
      ...createPlan(),
      visualClips: [{ assetId: "asset_image_derived_1", kind: "image" as const, sourceAssetId: "asset_chart_1" }],
    };

    const failure = evaluateComposeMediaAssetReadiness({
      plan,
      assetsById: new Map([
        ["asset_image_derived_1", {
          assetId: "asset_image_derived_1",
          status: "ready",
          assetKind: "image",
          conversationId: "conv_1",
          derivativeOfAssetId: "asset_chart_1",
        }],
        ["asset_audio_1", { assetId: "asset_audio_1", status: "ready", assetKind: "audio", conversationId: "conv_1" }],
      ]),
    });

    expect(failure).toBeNull();
  });

  it("rejects lineage mismatches when the chosen governed asset does not match the required source", () => {
    const plan = {
      ...createPlan(),
      audioClips: [{ assetId: "asset_audio_older_1", kind: "audio" as const, sourceAssetId: "asset_audio_fresh_1" }],
    };

    const failure = evaluateComposeMediaAssetReadiness({
      plan,
      assetsById: new Map([
        ["asset_image_1", { assetId: "asset_image_1", status: "ready", assetKind: "image", conversationId: "conv_1" }],
        ["asset_audio_older_1", {
          assetId: "asset_audio_older_1",
          status: "ready",
          assetKind: "audio",
          conversationId: "conv_1",
          derivativeOfAssetId: null,
        }],
      ]),
    });

    expect(failure).toMatchObject({
      code: "asset_lineage_mismatch",
      assetId: "asset_audio_older_1",
    });
  });
});