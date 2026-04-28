import type { MediaCompositionOverrides, MediaCompositionPlan } from "@/core/entities/media-composition";

export const BROWSER_SHORT_EXPLAINER_DEFAULT_DURATION_SECONDS = 45;
export const BROWSER_SHORT_EXPLAINER_MIN_DURATION_SECONDS = 30;
export const BROWSER_SHORT_EXPLAINER_MAX_DURATION_SECONDS = 60;
export const BROWSER_SHORT_EXPLAINER_MIN_VISUAL_BEATS = 1;
export const BROWSER_SHORT_EXPLAINER_MAX_VISUAL_BEATS = 5;

function normalizeCaptionText(value: string | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
}

function splitNarrationCaptionSegments(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const sentenceLikeSegments = normalized
    .split(/(?<=[.!?])\s+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (sentenceLikeSegments.length >= 3) {
    return sentenceLikeSegments;
  }

  const words = normalized.split(" ").filter((word) => word.length > 0);
  if (words.length <= 12) {
    return [normalized];
  }

  const targetSegmentCount = Math.min(3, Math.max(2, Math.ceil(words.length / 14)));
  const segmentSize = Math.ceil(words.length / targetSegmentCount);
  const segments: string[] = [];

  for (let index = 0; index < words.length; index += segmentSize) {
    const segment = words.slice(index, index + segmentSize).join(" ").trim();
    if (segment.length > 0) {
      segments.push(segment);
    }
  }

  return segments;
}

export function isBrowserShortExplainerPlan(
  plan: Pick<MediaCompositionPlan, "mode">,
): boolean {
  return plan.mode === "browser_short_explainer";
}

export function hasBrowserShortExplainerCaptionText(
  plan: Pick<MediaCompositionPlan, "mode" | "subtitlePolicy" | "overrides">,
): boolean {
  if (!isBrowserShortExplainerPlan(plan) || plan.subtitlePolicy !== "burned") {
    return true;
  }

  return Boolean(
    normalizeCaptionText(plan.overrides?.hookText)
      || normalizeCaptionText(plan.overrides?.title)
      || normalizeCaptionText(plan.overrides?.closingText),
  );
}

export function deriveBrowserShortExplainerNarrationOverrides(options: {
  existingOverrides?: MediaCompositionOverrides;
  narrationTitle?: string;
  narrationText: string;
}): MediaCompositionOverrides | null {
  const narrationSegments = splitNarrationCaptionSegments(options.narrationText);
  const title = normalizeCaptionText(options.existingOverrides?.title) ?? normalizeCaptionText(options.narrationTitle);
  const hookText = normalizeCaptionText(options.existingOverrides?.hookText)
    ?? normalizeCaptionText(narrationSegments[0])
    ?? title;
  const closingText = normalizeCaptionText(options.existingOverrides?.closingText)
    ?? normalizeCaptionText(narrationSegments.at(-1))
    ?? hookText
    ?? title;

  if (!title && !hookText && !closingText) {
    return null;
  }

  return {
    ...options.existingOverrides,
    ...(title ? { title } : {}),
    ...(hookText ? { hookText } : {}),
    ...(closingText ? { closingText } : {}),
  };
}

export function getBrowserShortExplainerTargetDurationSeconds(
  plan: Pick<MediaCompositionPlan, "mode" | "defaults" | "audioClips">,
): number {
  if (!isBrowserShortExplainerPlan(plan)) {
    return BROWSER_SHORT_EXPLAINER_DEFAULT_DURATION_SECONDS;
  }

  const configuredDuration = plan.defaults?.durationTargetSeconds
    ?? plan.audioClips[0]?.duration
    ?? BROWSER_SHORT_EXPLAINER_DEFAULT_DURATION_SECONDS;

  return Math.max(
    BROWSER_SHORT_EXPLAINER_MIN_DURATION_SECONDS,
    Math.min(BROWSER_SHORT_EXPLAINER_MAX_DURATION_SECONDS, Math.round(configuredDuration)),
  );
}

export function getBrowserShortExplainerBeatDurations(
  plan: Pick<MediaCompositionPlan, "mode" | "defaults" | "audioClips" | "visualClips">,
): number[] {
  const beatCount = Math.max(plan.visualClips.length, 1);
  const totalDurationSeconds = getBrowserShortExplainerTargetDurationSeconds(plan);
  const baseDuration = Number((totalDurationSeconds / beatCount).toFixed(2));
  const durations = Array.from({ length: beatCount }, () => baseDuration);
  const assignedDuration = durations.slice(0, -1).reduce((sum, value) => sum + value, 0);
  durations[beatCount - 1] = Number((totalDurationSeconds - assignedDuration).toFixed(2));
  return durations;
}

export function getBrowserShortExplainerBeatCaptions(
  plan: Pick<MediaCompositionPlan, "mode" | "subtitlePolicy" | "visualClips" | "overrides">,
): Array<string | null> {
  const beatCount = plan.visualClips.length;
  if (!isBrowserShortExplainerPlan(plan) || plan.subtitlePolicy !== "burned") {
    return Array.from({ length: beatCount }, () => null);
  }

  const hookText = normalizeCaptionText(plan.overrides?.hookText);
  const title = normalizeCaptionText(plan.overrides?.title);
  const closingText = normalizeCaptionText(plan.overrides?.closingText);
  const openingCaption = hookText ?? title ?? closingText;
  const middleCaption = title ?? hookText ?? closingText;
  const closingCaption = closingText ?? title ?? hookText;

  return Array.from({ length: beatCount }, (_, index) => {
    if (index === 0) {
      return openingCaption;
    }

    if (index === beatCount - 1) {
      return closingCaption;
    }

    return middleCaption;
  });
}

export function canRerouteBrowserShortExplainerPlan(
  _plan: Pick<MediaCompositionPlan, "mode" | "subtitlePolicy">,
): boolean {
  return true;
}