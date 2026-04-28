import type { MediaCompositionPlan } from "@/core/entities/media-composition";
import {
  getBrowserShortExplainerBeatDurations,
  isBrowserShortExplainerPlan,
} from "@/lib/media/ffmpeg/browser-short-explainer";
import {
  getMediaCompositionProfileSettings,
  resolveMediaCompositionProfile,
} from "@/lib/media/ffmpeg/media-composition-profile";

export class EmptyPlanError extends Error {
  constructor() {
    super("Media composition plan has no executable clips.");
    this.name = "EmptyPlanError";
  }
}

export function getVisualInputFileName(
  kind: MediaCompositionPlan["visualClips"][number]["kind"],
  index: number,
): string {
  return kind === "image" ? `in_v_${index}.png` : `in_v_${index}.mp4`;
}

export function getAudioInputFileName(index: number): string {
  return `in_a_${index}.mp3`;
}

export function buildConcatListFile(visualClipCount: number): string {
  return Array.from({ length: visualClipCount }, (_, index) => `file 'in_v_${index}.mp4'`).join("\n");
}

function buildBrowserShortExplainerArgs(plan: MediaCompositionPlan, outputName: string): readonly string[] {
  const resolvedProfile = resolveMediaCompositionProfile(plan);
  const profileSettings = getMediaCompositionProfileSettings(resolvedProfile);
  const beatDurations = getBrowserShortExplainerBeatDurations(plan);
  const width = plan.resolution?.width ?? 720;
  const height = plan.resolution?.height ?? 1280;
  const args: string[] = [];

  if (plan.visualClips.some((clip) => clip.kind !== "image")) {
    throw new Error("browser_short_explainer requires image-based visual beats after materialization.");
  }

  if (plan.audioClips.length > 1) {
    throw new Error("browser_short_explainer supports at most one narration track.");
  }

  plan.visualClips.forEach((_clip, index) => {
    args.push(
      "-loop",
      "1",
      "-t",
      String(beatDurations[index] ?? beatDurations[beatDurations.length - 1] ?? 5),
      "-framerate",
      String(profileSettings.browserEncode.imageInputFramerate),
      "-i",
      getVisualInputFileName("image", index),
    );
  });

  if (plan.audioClips[0]) {
    args.push("-i", getAudioInputFileName(0));
  }

  const filterParts = plan.visualClips.map((_, index) => (
    `[${index}:v]scale=${width}:${height},fps=${profileSettings.browserEncode.outputFramerate},format=yuv420p,setsar=1[v${index}]`
  ));
  const concatInputs = plan.visualClips.map((_, index) => `[v${index}]`).join("");
  filterParts.push(`${concatInputs}concat=n=${plan.visualClips.length}:v=1:a=0[video]`);
  if (plan.audioClips[0]) {
    filterParts.push(`[${plan.visualClips.length}:a]aresample=44100[audio]`);
  }

  args.push("-filter_complex", filterParts.join(";"), "-map", "[video]");

  if (plan.audioClips[0]) {
    args.push("-map", "[audio]");
  }

  args.push(...profileSettings.browserEncode.videoCodecArgs, "-r", String(profileSettings.browserEncode.outputFramerate));

  if (plan.audioClips[0]) {
    args.push(...profileSettings.browserEncode.audioCodecArgs, "-shortest");
  }

  if (plan.outputFormat === "mp4") {
    args.push("-movflags", "+faststart");
  }

  args.push(outputName);
  return args;
}

export function buildExecutionArgs(plan: MediaCompositionPlan, outputName: string): readonly string[] {
  const args: string[] = [];
  const firstVisual = plan.visualClips[0];
  const firstAudio = plan.audioClips[0];
  const resolvedProfile = resolveMediaCompositionProfile(plan);
  const profileSettings = getMediaCompositionProfileSettings(resolvedProfile);

  if (isBrowserShortExplainerPlan(plan)) {
    return buildBrowserShortExplainerArgs(plan, outputName);
  }

  const isConcatVideoSequence = plan.visualClips.length > 1
    && plan.visualClips.every((clip) => clip.kind === "video")
    && plan.audioClips.length === 0;

  if (isConcatVideoSequence) {
    args.push("-f", "concat", "-safe", "0", "-i", "concat.txt");
    if (plan.outputFormat === "mp4") {
      args.push(...profileSettings.browserEncode.videoCodecArgs, "-r", String(profileSettings.browserEncode.outputFramerate));
      if (plan.resolution) {
        args.push("-vf", `scale=${plan.resolution.width}:${plan.resolution.height},fps=${profileSettings.browserEncode.outputFramerate}`);
      }
      args.push(...profileSettings.browserEncode.audioCodecArgs, "-movflags", "+faststart");
    } else {
      args.push("-c:v", "libvpx-vp9", "-c:a", "libopus");
      if (plan.resolution) {
        args.push("-vf", `scale=${plan.resolution.width}:${plan.resolution.height},fps=${profileSettings.browserEncode.outputFramerate}`);
      }
    }
    args.push(outputName);
    return args;
  }

  if (firstVisual?.kind === "image") {
    args.push("-loop", "1", "-framerate", String(profileSettings.browserEncode.imageInputFramerate), "-i", getVisualInputFileName(firstVisual.kind, 0));
    if (firstAudio) {
      args.push(
        "-i",
        getAudioInputFileName(0),
        ...profileSettings.browserEncode.videoCodecArgs,
        "-r",
        String(profileSettings.browserEncode.outputFramerate),
        "-vf",
        `scale=${plan.resolution?.width ?? 720}:${plan.resolution?.height ?? 1280},fps=${profileSettings.browserEncode.outputFramerate}`,
        ...profileSettings.browserEncode.audioCodecArgs,
        "-shortest",
        "-movflags",
        "+faststart",
      );
    } else {
      args.push(
        "-t",
        String(firstVisual.duration ?? 5),
        ...profileSettings.browserEncode.videoCodecArgs,
        "-r",
        String(profileSettings.browserEncode.outputFramerate),
        "-vf",
        `scale=${plan.resolution?.width ?? 720}:${plan.resolution?.height ?? 1280},fps=${profileSettings.browserEncode.outputFramerate}`,
        "-movflags",
        "+faststart",
      );
    }
    args.push(outputName);
    return args;
  }

  if (plan.visualClips.length > 0) {
    args.push("-i", getVisualInputFileName(plan.visualClips[0].kind, 0));
    args.push(...profileSettings.browserEncode.videoCodecArgs, "-r", String(profileSettings.browserEncode.outputFramerate));
    if (plan.resolution) {
      args.push("-vf", `scale=${plan.resolution.width}:${plan.resolution.height},fps=${profileSettings.browserEncode.outputFramerate}`);
    }
    if (firstAudio) {
      args.push("-i", getAudioInputFileName(0), ...profileSettings.browserEncode.audioCodecArgs, "-shortest", "-movflags", "+faststart");
    } else if (plan.outputFormat === "mp4") {
      args.push("-movflags", "+faststart");
    }
    args.push(outputName);
    return args;
  }

  if (firstAudio) {
    args.push("-i", getAudioInputFileName(0), "-c:a", "libmp3lame", outputName);
    return args;
  }

  throw new EmptyPlanError();
}
