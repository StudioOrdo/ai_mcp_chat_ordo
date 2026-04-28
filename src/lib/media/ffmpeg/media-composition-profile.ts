import type { MediaCompositionPlan } from "@/core/entities/media-composition";

export const MEDIA_COMPOSITION_PROFILE_IDS = [
  "auto",
  "still_image_narration_fast",
  "multi_video_standard",
] as const;

export type ResolvedMediaCompositionProfile = Exclude<(typeof MEDIA_COMPOSITION_PROFILE_IDS)[number], "auto">;

export const DEFAULT_MEDIA_COMPOSITION_PROFILE = "auto" as const;

export const STANDARD_MEDIA_COMPOSITION_RESOLUTION = {
  width: 1080,
  height: 1920,
} as const;

export const FAST_STILL_IMAGE_NARRATION_RESOLUTION = {
  width: 720,
  height: 1280,
} as const;

export interface MediaCompositionProfileSettings {
  label: string;
  defaultResolution: { width: number; height: number };
  browserLimits: {
    maxVisualClipsForBrowser: number;
    maxAudioClipsForBrowser: number;
    maxTotalDurationSecondsForBrowser: number;
  };
  browserEncode: {
    imageInputFramerate: number;
    outputFramerate: number;
    videoCodecArgs: string[];
    audioCodecArgs: string[];
  };
  serverEncode: {
    imageInputFramerate: number;
    outputFramerate: number;
    videoCodecArgs: string[];
    audioCodecArgs: string[];
  };
}

export const MEDIA_COMPOSITION_PROFILES: Record<ResolvedMediaCompositionProfile, MediaCompositionProfileSettings> = {
  still_image_narration_fast: {
    label: "Still Image Narration",
    defaultResolution: FAST_STILL_IMAGE_NARRATION_RESOLUTION,
    browserLimits: {
      maxVisualClipsForBrowser: 1,
      maxAudioClipsForBrowser: 1,
      maxTotalDurationSecondsForBrowser: 180,
    },
    browserEncode: {
      imageInputFramerate: 1,
      outputFramerate: 12,
      videoCodecArgs: ["-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage", "-pix_fmt", "yuv420p"],
      audioCodecArgs: ["-c:a", "aac", "-b:a", "96k"],
    },
    serverEncode: {
      imageInputFramerate: 1,
      outputFramerate: 12,
      videoCodecArgs: ["-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage", "-crf", "28", "-pix_fmt", "yuv420p"],
      audioCodecArgs: ["-c:a", "aac", "-b:a", "96k"],
    },
  },
  multi_video_standard: {
    label: "Multi Video Standard",
    defaultResolution: STANDARD_MEDIA_COMPOSITION_RESOLUTION,
    browserLimits: {
      maxVisualClipsForBrowser: 3,
      maxAudioClipsForBrowser: 0,
      maxTotalDurationSecondsForBrowser: 120,
    },
    browserEncode: {
      imageInputFramerate: 1,
      outputFramerate: 24,
      videoCodecArgs: ["-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p"],
      audioCodecArgs: ["-c:a", "aac", "-b:a", "128k"],
    },
    serverEncode: {
      imageInputFramerate: 1,
      outputFramerate: 24,
      videoCodecArgs: ["-c:v", "libx264", "-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p"],
      audioCodecArgs: ["-c:a", "aac", "-b:a", "128k"],
    },
  },
};

export function isStillImageNarrationPlan(plan: Pick<MediaCompositionPlan, "visualClips" | "audioClips">): boolean {
  const visualClips = Array.isArray(plan.visualClips) ? plan.visualClips : [];
  const audioClips = Array.isArray(plan.audioClips) ? plan.audioClips : [];

  return visualClips.length === 1
    && visualClips.every((clip) => clip.kind === "image")
    && audioClips.length <= 1
    && audioClips.every((clip) => clip.kind === "audio");
}

export function resolveMediaCompositionProfile(plan: Pick<MediaCompositionPlan, "profile" | "visualClips" | "audioClips">): ResolvedMediaCompositionProfile {
  if (plan.profile && plan.profile !== "auto") {
    return plan.profile;
  }

  return isStillImageNarrationPlan(plan)
    ? "still_image_narration_fast"
    : "multi_video_standard";
}

export function getMediaCompositionProfileSettings(
  plan: Pick<MediaCompositionPlan, "profile" | "visualClips" | "audioClips"> | ResolvedMediaCompositionProfile,
): MediaCompositionProfileSettings {
  const profile = typeof plan === "string" ? plan : resolveMediaCompositionProfile(plan);
  return MEDIA_COMPOSITION_PROFILES[profile];
}

export function getDefaultResolutionForPlan(plan: Pick<MediaCompositionPlan, "profile" | "visualClips" | "audioClips">): {
  width: number;
  height: number;
} {
  return getMediaCompositionProfileSettings(plan).defaultResolution;
}