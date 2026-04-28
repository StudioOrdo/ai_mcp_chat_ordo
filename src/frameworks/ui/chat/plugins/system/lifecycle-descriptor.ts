import type { CapabilityPresentationDescriptor } from "@/core/entities/capability-presentation";
import type { CapabilityResultEnvelope } from "@/core/entities/capability-result";
import {
  LIFECYCLE_EVENT_TOOL_NAME,
  type LifecycleEnvelope,
  type LifecyclePayload,
  type LifecycleVariant,
} from "@/core/entities/lifecycle";

export const LIFECYCLE_EVENT_DESCRIPTOR: CapabilityPresentationDescriptor = {
  toolName: LIFECYCLE_EVENT_TOOL_NAME,
  family: "system",
  label: "Lifecycle Event",
  cardKind: "lifecycle",
  executionMode: "inline",
  progressMode: "none",
  historyMode: "payload_snapshot",
  defaultSurface: "conversation",
  artifactKinds: [],
  supportsRetry: "none",
};

const VARIANT_LABELS: Record<LifecycleVariant, string> = {
  installed: "Install complete",
  onboarded: "Onboarding complete",
  role_changed: "Role updated",
  tier_upgraded: "Tier upgraded",
  capability_unlocked: "New capability unlocked",
};

const VARIANT_SUBTITLES: Record<LifecycleVariant, string> = {
  installed: "Workspace provisioned and ready.",
  onboarded: "Account setup finished.",
  role_changed: "Access changed. New surfaces may now be available.",
  tier_upgraded: "Tier changed. Premium content and surfaces are now available.",
  capability_unlocked: "A new capability is available in this workspace.",
};

export function getLifecycleVariantLabel(variant: LifecycleVariant): string {
  return VARIANT_LABELS[variant];
}

export function getLifecycleVariantSubtitle(variant: LifecycleVariant): string {
  return VARIANT_SUBTITLES[variant];
}

export function createLifecycleEnvelope(payload: LifecyclePayload): LifecycleEnvelope {
  return {
    schemaVersion: 1,
    toolName: LIFECYCLE_EVENT_TOOL_NAME,
    family: "system",
    cardKind: "lifecycle",
    executionMode: "inline",
    inputSnapshot: {},
    summary: {
      title: VARIANT_LABELS[payload.variant],
      subtitle: VARIANT_SUBTITLES[payload.variant],
      statusLine: payload.detail ?? undefined,
    },
    payload,
  };
}

export function isLifecycleResultEnvelope(
  envelope: CapabilityResultEnvelope | null | undefined,
): envelope is LifecycleEnvelope {
  return Boolean(envelope && envelope.cardKind === "lifecycle" && envelope.family === "system");
}
