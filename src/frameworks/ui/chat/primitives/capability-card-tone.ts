import type {
  CapabilityCardKind,
  CapabilityFamily,
  CapabilityPresentationDescriptor,
} from "@/core/entities/capability-presentation";
import type { JobStatus } from "@/core/entities/job";

export type CapabilityTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "editorial"
  | "media";

export type CapabilityCardState = JobStatus | "idle";

type DescriptorLike = Pick<CapabilityPresentationDescriptor, "family" | "cardKind">;

export interface ResolveCapabilityToneInput {
  tone?: CapabilityTone | null;
  descriptor?: DescriptorLike | null;
  family?: CapabilityFamily | null;
  cardKind?: CapabilityCardKind | null;
  state?: CapabilityCardState | null;
}

const FAMILY_TONE_MAP: Record<CapabilityFamily, CapabilityTone | null> = {
  artifact: "accent",
  editorial: "editorial",
  journal: "accent",
  media: "media",
  profile: "accent",
  search: "accent",
  system: "neutral",
  theme: "accent",
};

const CARD_KIND_TONE_MAP: Record<CapabilityCardKind, CapabilityTone | null> = {
  artifact_viewer: "accent",
  editorial_workflow: "editorial",
  fallback: "neutral",
  journal_workflow: "accent",
  lifecycle: "neutral",
  media_render: "media",
  profile_summary: "accent",
  search_result: "accent",
  theme_inspection: "accent",
};

const STATE_TONE_MAP: Record<CapabilityCardState, CapabilityTone> = {
  canceled: "warning",
  dead_letter: "danger",
  failed: "danger",
  idle: "neutral",
  queued: "neutral",
  running: "accent",
  succeeded: "success",
};

export function resolveCapabilityTone(input: ResolveCapabilityToneInput = {}): CapabilityTone {
  if (input.tone) {
    return input.tone;
  }

  const descriptor = input.descriptor;
  const family = input.family ?? descriptor?.family;
  if (family) {
    const mappedFamilyTone = FAMILY_TONE_MAP[family];
    if (mappedFamilyTone) {
      return mappedFamilyTone;
    }
  }

  const cardKind = input.cardKind ?? descriptor?.cardKind;
  if (cardKind) {
    const mappedCardTone = CARD_KIND_TONE_MAP[cardKind];
    if (mappedCardTone) {
      return mappedCardTone;
    }
  }

  if (input.state) {
    return STATE_TONE_MAP[input.state];
  }

  return "neutral";
}
