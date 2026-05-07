import type {
  ProviderCapabilityAvailability,
  ProviderCapabilityAvailabilitySnapshot,
} from "@/lib/ai/providers/provider-capability-availability";
import {
  ProviderCapabilityUnavailableError,
  getProviderCapabilityAvailabilitySnapshot,
} from "@/lib/ai/providers/provider-capability-availability";
import type {
  CapabilityProviderId,
  CapabilitySlotId,
} from "@/lib/ai/providers/types";
import type {
  ToolAvailabilityReason,
  ToolAvailabilityState,
} from "./tool-policy-types";

export type ProviderBackedToolName =
  | "generate_audio"
  | "generate_blog_image"
  | "admin_web_search";

export type ToolProviderCapabilityOperation =
  | "generate"
  | "search"
  | "transcribe";

export interface ToolProviderCapabilityRequirement {
  toolName: ProviderBackedToolName;
  slot: CapabilitySlotId;
  operation: ToolProviderCapabilityOperation;
}

export interface ToolProviderCapabilityGate {
  state: Extract<ToolAvailabilityState, "missing_provider_key" | "provider_disabled">;
  reason: Extract<ToolAvailabilityReason, "missing_openai_key" | "provider_capability_disabled">;
}

export const TOOL_PROVIDER_CAPABILITY_REQUIREMENTS = Object.freeze({
  generate_audio: {
    toolName: "generate_audio",
    slot: "tts",
    operation: "generate",
  },
  generate_blog_image: {
    toolName: "generate_blog_image",
    slot: "image",
    operation: "generate",
  },
  admin_web_search: {
    toolName: "admin_web_search",
    slot: "web_search",
    operation: "search",
  },
} satisfies Record<ProviderBackedToolName, ToolProviderCapabilityRequirement>);

const providerBackedToolNames = Object.freeze(
  Object.keys(TOOL_PROVIDER_CAPABILITY_REQUIREMENTS) as ProviderBackedToolName[],
);

export function getProviderBackedToolNames(): readonly ProviderBackedToolName[] {
  return providerBackedToolNames;
}

export function isProviderBackedToolName(toolName: string): toolName is ProviderBackedToolName {
  return Object.prototype.hasOwnProperty.call(TOOL_PROVIDER_CAPABILITY_REQUIREMENTS, toolName);
}

export function getToolProviderCapabilityRequirement(
  toolName: string,
): ToolProviderCapabilityRequirement | null {
  return isProviderBackedToolName(toolName)
    ? TOOL_PROVIDER_CAPABILITY_REQUIREMENTS[toolName]
    : null;
}

export function getToolProviderCapabilityAvailability(
  toolName: string,
  snapshot: ProviderCapabilityAvailabilitySnapshot = getProviderCapabilityAvailabilitySnapshot(),
): ProviderCapabilityAvailability | null {
  const requirement = getToolProviderCapabilityRequirement(toolName);
  return requirement ? snapshot[requirement.slot] : null;
}

export function getProviderCapabilityGate(
  availability: ProviderCapabilityAvailability | null,
): ToolProviderCapabilityGate | null {
  if (!availability || availability.state === "available") {
    return null;
  }

  if (availability.state === "missing_key") {
    return {
      state: "missing_provider_key",
      reason: availability.provider === "openai"
        ? "missing_openai_key"
        : "provider_capability_disabled",
    };
  }

  return {
    state: "provider_disabled",
    reason: "provider_capability_disabled",
  };
}

export function assertProviderBackedToolAvailable(
  toolName: string,
  snapshot: ProviderCapabilityAvailabilitySnapshot = getProviderCapabilityAvailabilitySnapshot(),
): void {
  const availability = getToolProviderCapabilityAvailability(toolName, snapshot);
  const gate = getProviderCapabilityGate(availability);
  if (availability && gate) {
    throw new ProviderCapabilityUnavailableError(availability);
  }
}

export function getProviderCapabilityUiLabel(
  slot: CapabilitySlotId | null,
  provider: CapabilityProviderId | null,
  state: string | null,
): string | null {
  if (!slot || !provider || !state) {
    return null;
  }

  if (state === "missing_key") {
    return `${slot}: missing ${provider === "openai" ? "OpenAI" : provider} key`;
  }

  return `${slot}: ${state}`;
}
