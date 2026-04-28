import { describe, expect, it } from "vitest";

import type { MediaCompositionPlan } from "@/core/entities/media-composition";

import {
  buildConcatListFile,
  buildExecutionArgs,
  EmptyPlanError,
  getAudioInputFileName,
  getVisualInputFileName,
} from "./ffmpeg-args";

describe("ffmpeg-args", () => {
  const basePlan: MediaCompositionPlan = {
    id: "plan-1",
    conversationId: "conv-1",
    visualClips: [],
    audioClips: [],
    subtitlePolicy: "none",
    outputFormat: "mp4",
  };

  it("builds image-only execution args with a bounded still duration", () => {
    const args = buildExecutionArgs({
      ...basePlan,
      visualClips: [{ assetId: "image-1", kind: "image", duration: 7 }],
    }, "output.mp4");

    expect(args).toEqual(expect.arrayContaining([
      "-loop",
      "1",
      "-t",
      "7",
      "-i",
      "in_v_0.png",
      "-movflags",
      "+faststart",
      "output.mp4",
    ]));
    expect(args).not.toContain("-shortest");
  });

  it("builds browser-short explainer args for multi-image narration", () => {
    const args = buildExecutionArgs({
      ...basePlan,
      mode: "browser_short_explainer",
      subtitlePolicy: "burned",
      visualClips: [
        { assetId: "image-1", kind: "image" },
        { assetId: "image-2", kind: "image" },
      ],
      audioClips: [{ assetId: "audio-1", kind: "audio", duration: 42 }],
      resolution: { width: 720, height: 1280 },
    }, "output.mp4");

    expect(args).toEqual(expect.arrayContaining([
      "-i",
      "in_v_0.png",
      "-i",
      "in_v_1.png",
      "-i",
      "in_a_0.mp3",
      "-filter_complex",
      expect.stringContaining("concat=n=2:v=1:a=0[video]"),
      "-map",
      "[video]",
      "-map",
      "[audio]",
      "-shortest",
      "output.mp4",
    ]));
  });

  it("builds concat args for multi-video plans without audio", () => {
    const args = buildExecutionArgs({
      ...basePlan,
      outputFormat: "webm",
      visualClips: [
        { assetId: "video-1", kind: "video" },
        { assetId: "video-2", kind: "video" },
      ],
    }, "output.webm");

    expect(args.slice(0, 5)).toEqual(["-f", "concat", "-safe", "0", "-i"]);
    expect(args).toContain("concat.txt");
    expect(args).toContain("libvpx-vp9");
    expect(args).toContain("output.webm");
  });

  it("builds video plus audio args with shortest and faststart", () => {
    const args = buildExecutionArgs({
      ...basePlan,
      visualClips: [{ assetId: "video-1", kind: "video" }],
      audioClips: [{ assetId: "audio-1", kind: "audio" }],
      resolution: { width: 1080, height: 1920 },
    }, "output.mp4");

    expect(args).toEqual(expect.arrayContaining([
      "-i",
      "in_v_0.mp4",
      "-i",
      "in_a_0.mp3",
      "-shortest",
      "-movflags",
      "+faststart",
      "output.mp4",
    ]));
  });

  it("builds audio-only args when the plan contains no visuals", () => {
    const args = buildExecutionArgs({
      ...basePlan,
      visualClips: [],
      audioClips: [{ assetId: "audio-1", kind: "audio" }],
    }, "output.mp3");

    expect(args).toEqual(["-i", "in_a_0.mp3", "-c:a", "libmp3lame", "output.mp3"]);
  });

  it("throws EmptyPlanError for plans with no executable clips", () => {
    expect(() => buildExecutionArgs(basePlan, "output.mp4")).toThrow(EmptyPlanError);
  });

  it("preserves helper naming for staged files and concat lists", () => {
    expect(getVisualInputFileName("image", 2)).toBe("in_v_2.png");
    expect(getVisualInputFileName("video", 3)).toBe("in_v_3.mp4");
    expect(getAudioInputFileName(1)).toBe("in_a_1.mp3");
    expect(buildConcatListFile(2)).toBe("file 'in_v_0.mp4'\nfile 'in_v_1.mp4'");
  });
});
