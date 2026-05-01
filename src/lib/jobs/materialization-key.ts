import type { MediaCompositionClip, MediaCompositionPlan } from "@/core/entities/media-composition";
import { stableStringify } from "@/lib/jobs/job-dedupe";

export const COMPOSE_MEDIA_MATERIALIZATION_PIPELINE_VERSION = "compose_media:v1";
export const GENERATE_AUDIO_MATERIALIZATION_PIPELINE_VERSION = "generate_audio:v1";

export interface GenerateAudioMaterializationInput {
  title: string;
  text: string;
  voice?: string | null;
  format?: string | null;
  durationTargetSeconds?: number | null;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeClip(clip: MediaCompositionClip): Record<string, unknown> {
  return {
    assetId: clip.sourceAssetId ?? clip.assetId,
    kind: clip.kind,
    startTime: clip.startTime ?? null,
    duration: clip.duration ?? null,
  };
}

export function buildComposeMediaMaterializationKey(plan: MediaCompositionPlan): string {
  return `compose_media:${stableStringify({
    pipelineVersion: COMPOSE_MEDIA_MATERIALIZATION_PIPELINE_VERSION,
    mode: plan.mode ?? null,
    profile: plan.profile ?? null,
    visualClips: plan.visualClips.map(normalizeClip),
    audioClips: plan.audioClips.map(normalizeClip),
    defaults: plan.defaults ?? null,
    overrides: plan.overrides ?? null,
    subtitlePolicy: plan.subtitlePolicy,
    waveformPolicy: plan.waveformPolicy,
    outputFormat: plan.outputFormat,
    resolution: plan.resolution ?? null,
  })}`;
}

export function buildGenerateAudioMaterializationKey(input: GenerateAudioMaterializationInput): string {
  return `generate_audio:${stableStringify({
    pipelineVersion: GENERATE_AUDIO_MATERIALIZATION_PIPELINE_VERSION,
    title: normalizeText(input.title),
    text: normalizeText(input.text),
    voice: input.voice?.trim() || "alloy",
    format: input.format?.trim() || "mp3",
    durationTargetSeconds: input.durationTargetSeconds ?? null,
  })}`;
}
