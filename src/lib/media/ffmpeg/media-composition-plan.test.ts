import { describe, expect, it } from "vitest";
import type { MediaCompositionPlan } from "@/core/entities/media-composition";
import {
  canonicalizeMediaCompositionPlanWithRepairs,
  DEFAULT_MEDIA_COMPOSITION_RESOLUTION,
  isCanonicalMediaCompositionAssetId,
  normalizeMediaCompositionPlan,
  validateMediaCompositionAssetReferences,
  validateExecutablePlanConstraints,
  validatePlanConstraints,
} from "./media-composition-plan";
import { FAST_STILL_IMAGE_NARRATION_RESOLUTION } from "./media-composition-profile";

function makePlan(overrides: Partial<MediaCompositionPlan>): MediaCompositionPlan {
  return {
    id: "plan-default",
    conversationId: "conv-default",
    visualClips: [{ assetId: "visual-1", kind: "video" }],
    audioClips: [],
    profile: "auto",
    subtitlePolicy: "none",
    waveformPolicy: "none",
    outputFormat: "mp4",
    resolution: { width: 1080, height: 1920 },
    ...overrides,
  };
}

describe("media-composition-plan — normalization", () => {
  it("normalizes a valid plan with a sidecar subtitle policy", () => {
    const raw = {
      id: "plan-1",
      conversationId: "conv-1",
      visualClips: [{ assetId: "asset-1", kind: "video" }],
      audioClips: [],
      subtitlePolicy: "sidecar",
    };
    const parsed = normalizeMediaCompositionPlan(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.visualClips[0].assetId).toBe("asset-1");
    expect(parsed?.subtitlePolicy).toBe("sidecar");
    expect(parsed?.outputFormat).toBe("mp4"); // default
  });

  it("applies defaults for optional fields", () => {
    const raw = {
      id: "plan-defaults",
      conversationId: "conv-defaults",
      visualClips: [{ assetId: "image-1", kind: "image" }],
      audioClips: [{ assetId: "audio-1", kind: "audio" }],
    };
    const parsed = normalizeMediaCompositionPlan(raw);
    expect(parsed?.profile).toBe("auto");
    expect(parsed?.subtitlePolicy).toBe("none");
    expect(parsed?.waveformPolicy).toBe("none");
    expect(parsed?.outputFormat).toBe("mp4");
    expect(parsed?.resolution).toEqual(FAST_STILL_IMAGE_NARRATION_RESOLUTION);
  });

  it("uses the standard default resolution for non-narration plans", () => {
    const raw = {
      id: "plan-video-defaults",
      conversationId: "conv-video-defaults",
      visualClips: [{ assetId: "video-1", kind: "video" }],
      audioClips: [],
    };
    const parsed = normalizeMediaCompositionPlan(raw);
    expect(parsed?.resolution).toEqual(DEFAULT_MEDIA_COMPOSITION_RESOLUTION);
  });

  it("preserves an explicit resolution override", () => {
    const raw = {
      id: "plan-resolution",
      conversationId: "conv-resolution",
      visualClips: [{ assetId: "image-1", kind: "image" }],
      audioClips: [],
      resolution: { width: 1920, height: 1080 },
    };
    const parsed = normalizeMediaCompositionPlan(raw);
    expect(parsed?.resolution).toEqual({ width: 1920, height: 1080 });
  });

  it("fails to normalize a plan missing required fields", () => {
    const raw = { visualClips: [] };
    expect(normalizeMediaCompositionPlan(raw)).toBeNull();
  });

  it("fails to normalize a plan with an invalid subtitle policy", () => {
    const raw = {
      id: "plan-bad",
      conversationId: "conv-bad",
      visualClips: [{ assetId: "a1", kind: "video" }],
      audioClips: [],
      subtitlePolicy: "invalid_policy",
    };
    expect(normalizeMediaCompositionPlan(raw)).toBeNull();
  });

  it("caps visual clips at the schema maximum (5)", () => {
    const raw = {
      id: "plan-oversize",
      conversationId: "conv-1",
      visualClips: Array.from({ length: 6 }, (_, i) => ({ assetId: `a${i}`, kind: "video" })),
      audioClips: [],
    };
    expect(normalizeMediaCompositionPlan(raw)).toBeNull();
  });
});

describe("media-composition-plan — constraint validation", () => {
  it("rejects empty plans (no clips at all)", () => {
    const plan = makePlan({
      id: "p1", conversationId: "c1",
      visualClips: [], audioClips: [],
      subtitlePolicy: "none", waveformPolicy: "none", outputFormat: "mp4",
    });
    expect(validatePlanConstraints(plan)).toBe("Plan must contain at least one visual or audio clip.");
  });

  it("rejects burning subtitles into audio-only output", () => {
    const plan = makePlan({
      id: "p2", conversationId: "c1",
      visualClips: [],
      audioClips: [{ assetId: "a1", kind: "audio" }],
      subtitlePolicy: "burned", waveformPolicy: "none", outputFormat: "mp4",
    });
    expect(validatePlanConstraints(plan)).toBe("Cannot burn subtitles into audio-only output.");
  });

  it("passes a valid plan with one visual clip", () => {
    const plan = makePlan({
      id: "p3", conversationId: "c1",
      visualClips: [{ assetId: "v1", kind: "video" }],
      audioClips: [],
      subtitlePolicy: "none", waveformPolicy: "none", outputFormat: "mp4",
    });
    expect(validatePlanConstraints(plan)).toBeNull();
  });

  it("rejects explicit still image narration profiles with non-image-compatible visuals", () => {
    const plan = makePlan({
      id: "p3b", conversationId: "c1",
      profile: "still_image_narration_fast",
      visualClips: [{ assetId: "v1", kind: "video" }],
      audioClips: [{ assetId: "a1", kind: "audio" }],
      subtitlePolicy: "none", waveformPolicy: "none", outputFormat: "mp4",
      resolution: { width: 720, height: 1280 },
    });
    expect(validatePlanConstraints(plan)).toBe("The still_image_narration_fast profile requires exactly one image-compatible visual clip.");
  });

  it("passes a sidecar subtitle plan with visual content", () => {
    const plan = makePlan({
      id: "p4", conversationId: "c1",
      visualClips: [{ assetId: "v1", kind: "video" }],
      audioClips: [],
      subtitlePolicy: "sidecar", waveformPolicy: "none", outputFormat: "mp4",
    });
    expect(validatePlanConstraints(plan)).toBeNull();
  });

  it("rejects odd-numbered output dimensions that break h264 compatibility", () => {
    const plan = makePlan({
      id: "p5", conversationId: "c1",
      visualClips: [{ assetId: "v1", kind: "video" }],
      audioClips: [],
      subtitlePolicy: "none", waveformPolicy: "none", outputFormat: "mp4",
      resolution: { width: 1079, height: 1921 },
    });
    expect(validatePlanConstraints(plan)).toBe("Resolution width and height must be even numbers.");
  });

  it("allows chart and graph source assets before materialization", () => {
    const plan = makePlan({
      id: "p6", conversationId: "c1",
      visualClips: [{ assetId: "chart_1", kind: "chart" }],
      audioClips: [{ assetId: "audio_1", kind: "audio" }],
      subtitlePolicy: "none", waveformPolicy: "none", outputFormat: "mp4",
      resolution: { width: 1080, height: 1920 },
    });
    expect(validatePlanConstraints(plan)).toBeNull();
    expect(validateExecutablePlanConstraints(plan)).toBe("Visual clips must be image or video assets. Charts and graphs must be rendered to an image before video composition.");
  });

  it("rejects non-audio assets in the audio track list", () => {
    const plan = makePlan({
      id: "p7", conversationId: "c1",
      visualClips: [{ assetId: "image_1", kind: "image" }],
      audioClips: [{ assetId: "video_1", kind: "video" }],
      subtitlePolicy: "none", waveformPolicy: "none", outputFormat: "mp4",
      resolution: { width: 1080, height: 1920 },
    });
    expect(validatePlanConstraints(plan)).toBe("Audio clips must be audio assets.");
  });
});

describe("media-composition-plan — asset reference validation", () => {
  it("accepts canonical governed asset IDs", () => {
    expect(isCanonicalMediaCompositionAssetId("uf_123")).toBe(true);
    expect(isCanonicalMediaCompositionAssetId("asset_video_1")).toBe(true);
    // blogasset_ IDs must have a full UUID suffix (generated by randomUUID())
    expect(isCanonicalMediaCompositionAssetId("blogasset_60aa5741-7a1e-4f2e-b8c3-0123456789ab")).toBe(true);
  });

  it("rejects truncated blogasset_ IDs (LLM hallucination guard)", () => {
    // These are the kinds of truncated IDs the LLM produces from memory
    expect(isCanonicalMediaCompositionAssetId("blogasset_60aa5741")).toBe(false);
    expect(isCanonicalMediaCompositionAssetId("blogasset_abc-123")).toBe(false);
    expect(isCanonicalMediaCompositionAssetId("blogasset_short")).toBe(false);
  });

  it("rejects prompt-like or malformed asset IDs", () => {
    expect(isCanonicalMediaCompositionAssetId("generate:a nice cheese board")).toBe(false);
    expect(isCanonicalMediaCompositionAssetId("job_123")).toBe(false);
    expect(isCanonicalMediaCompositionAssetId("")).toBe(false);
  });

  it("returns a descriptive error for invalid visual clip asset references", () => {
    const error = validateMediaCompositionAssetReferences(makePlan({
      visualClips: [{ assetId: "generate:a beautiful cheese plate", kind: "image" }],
    }));

    expect(error).toMatch(/Invalid visual clip assetId at index 0/);
  });

  it("returns a descriptive error for invalid audio clip asset references", () => {
    const error = validateMediaCompositionAssetReferences(makePlan({
      visualClips: [{ assetId: "asset_image_1", kind: "image" }],
      audioClips: [{ assetId: "audio-raw", kind: "audio" }],
    }));

    expect(error).toMatch(/Invalid audio clip assetId at index 0/);
  });
});

describe("media-composition-plan — canonicalization repairs", () => {
  it("repairs aliases only to candidates compatible with the clip kind", () => {
    const { plan, repairs } = canonicalizeMediaCompositionPlanWithRepairs(makePlan({
      visualClips: [{ assetId: "hero", kind: "image" }],
      audioClips: [{ assetId: "hero", kind: "audio" }],
    }), {
      assetCandidates: [
        { assetId: "uf_image_hero", kind: "image", aliases: ["hero"] },
        { assetId: "uf_audio_hero", kind: "audio", aliases: ["hero"] },
      ],
    });

    expect(plan.visualClips[0].assetId).toBe("uf_image_hero");
    expect(plan.audioClips[0].assetId).toBe("uf_audio_hero");
    expect(repairs).toEqual([
      { reference: "hero", resolvedAssetId: "uf_image_hero", strategy: "candidate_alias" },
      { reference: "hero", resolvedAssetId: "uf_audio_hero", strategy: "candidate_alias" },
    ]);
  });

  it("does not rewrite an alias binding to a candidate with the wrong clip kind", () => {
    const { plan, repairs } = canonicalizeMediaCompositionPlanWithRepairs(makePlan({
      visualClips: [{ assetId: "narration", kind: "image" }],
      audioClips: [],
    }), {
      assetCandidates: [
        { assetId: "uf_audio_1", kind: "audio", aliases: ["narration"] },
      ],
      aliasBindings: {
        narration: "uf_audio_1",
      },
    });

    expect(plan.visualClips[0].assetId).toBe("narration");
    expect(repairs).toEqual([]);
  });
});
