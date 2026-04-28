import type { JobProgressPhaseDefinition } from "@/lib/jobs/job-capability-types";
import type { MediaCompositionPlan } from "@/core/entities/media-composition";
import { resolveMediaCompositionProfile } from "@/lib/media/ffmpeg/media-composition-profile";

export const COMPOSE_MEDIA_PROGRESS_PHASES = [
  { key: "staging_assets", label: "Staging assets", baselinePercent: 5 },
  { key: "rendering_media", label: "Rendering media", baselinePercent: 20 },
  { key: "packaging_artifacts", label: "Packaging artifacts", baselinePercent: 85 },
  { key: "persisting", label: "Persisting output", baselinePercent: 95 },
  { key: "verifying_playback", label: "Verifying playback", baselinePercent: 98 },
] as const satisfies readonly JobProgressPhaseDefinition[];

export type ComposeMediaProgressPhaseKey = typeof COMPOSE_MEDIA_PROGRESS_PHASES[number]["key"];

export const COMPOSE_MEDIA_COMPLETE_LABEL = "Composition complete";
export const COMPOSE_MEDIA_REROUTING_LABEL = "Rerouting to server";
export const COMPOSE_MEDIA_FAILURE_LABEL = "Failed";
export const COMPOSE_MEDIA_ARTIFACT_LABEL = "Composed Video";

const COMPOSE_MEDIA_PHASES_BY_KEY = new Map(
  COMPOSE_MEDIA_PROGRESS_PHASES.map((phase) => [phase.key, phase] as const),
);

type ComposeMediaProgressContext = {
  plan?: Pick<MediaCompositionPlan, "profile" | "visualClips" | "audioClips">;
  progressPercent?: number | null;
};

function hasMediaClipArrays(
  plan: ComposeMediaProgressContext["plan"],
): plan is Pick<MediaCompositionPlan, "profile" | "visualClips" | "audioClips"> {
  return Array.isArray(plan?.visualClips) && Array.isArray(plan?.audioClips);
}

export function getComposeMediaProgressPhase(
  key: ComposeMediaProgressPhaseKey,
): (typeof COMPOSE_MEDIA_PROGRESS_PHASES)[number] {
  const phase = COMPOSE_MEDIA_PHASES_BY_KEY.get(key);
  if (!phase) {
    throw new Error(`Unknown compose_media progress phase: ${key}`);
  }

  return phase;
}

function getPlanDurationSeconds(plan: Pick<MediaCompositionPlan, "visualClips" | "audioClips">): number | null {
  const visualDuration = plan.visualClips.reduce((total, clip) => total + (clip.duration ?? 0), 0);
  const audioDuration = plan.audioClips.reduce((total, clip) => total + (clip.duration ?? 0), 0);
  const maxDuration = Math.max(visualDuration, audioDuration);
  return maxDuration > 0 ? maxDuration : null;
}

function estimateComposeWorkSeconds(plan: Pick<MediaCompositionPlan, "profile" | "visualClips" | "audioClips">): number {
  const resolvedProfile = resolveMediaCompositionProfile(plan);
  const sourceDuration = getPlanDurationSeconds(plan);
  const visualCount = plan.visualClips.length;
  const audioCount = plan.audioClips.length;

  if (resolvedProfile === "still_image_narration_fast") {
    const estimate = sourceDuration == null
      ? 12
      : Math.max(8, Math.min(45, Math.round(6 + sourceDuration * 0.15)));
    return estimate;
  }

  const estimate = sourceDuration == null
    ? 20 + visualCount * 4 + audioCount * 3
    : Math.max(15, Math.min(180, Math.round(10 + sourceDuration * 0.3 + visualCount * 4 + audioCount * 3)));
  return estimate;
}

function formatRemainingEta(seconds: number): string | null {
  if (seconds < 4) {
    return null;
  }

  if (seconds < 60) {
    return `about ${Math.round(seconds)}s left`;
  }

  const minutes = Math.ceil(seconds / 60);
  return `about ${minutes}m left`;
}

function getProfileAwarePhaseLabel(
  key: ComposeMediaProgressPhaseKey,
  plan: Pick<MediaCompositionPlan, "profile" | "visualClips" | "audioClips">,
): string {
  const resolvedProfile = resolveMediaCompositionProfile(plan);

  if (resolvedProfile === "still_image_narration_fast") {
    switch (key) {
      case "staging_assets":
        return "Preparing still image and narration";
      case "rendering_media":
        return "Encoding narration video";
      case "packaging_artifacts":
        return "Finalizing narration video";
      case "persisting":
        return "Saving composed video";
      case "verifying_playback":
        return "Checking playback";
    }
  }

  switch (key) {
    case "staging_assets":
      return "Preparing source videos";
    case "rendering_media":
      return "Combining video clips";
    case "packaging_artifacts":
      return "Finalizing master video";
    case "persisting":
      return "Saving composed video";
    case "verifying_playback":
      return "Checking playback";
  }
}

export function getComposeMediaProgressLabel(
  key: ComposeMediaProgressPhaseKey,
  context?: ComposeMediaProgressContext,
): string {
  const baseLabel = hasMediaClipArrays(context?.plan)
    ? getProfileAwarePhaseLabel(key, context.plan)
    : getComposeMediaProgressPhase(key).label;

  if (!hasMediaClipArrays(context?.plan) || context.progressPercent == null || key === "persisting" || key === "verifying_playback") {
    return baseLabel;
  }

  const estimatedWorkSeconds = estimateComposeWorkSeconds(context.plan);
  const remainingRatio = Math.max(0, 1 - Math.min(context.progressPercent, 100) / 100);
  const eta = formatRemainingEta(estimatedWorkSeconds * remainingRatio);
  return eta ? `${baseLabel} · ${eta}` : baseLabel;
}

export function getComposeMediaBaselinePercent(key: ComposeMediaProgressPhaseKey): number {
  return getComposeMediaProgressPhase(key).baselinePercent;
}
