import { describe, expect, it } from "vitest";

import {
  getProviderBackedToolNames,
  getProviderCapabilityGate,
  getToolProviderCapabilityRequirement,
} from "./tool-provider-capability-policy";
import type { ProviderCapabilityAvailability } from "@/lib/ai/providers/provider-capability-availability";

function availability(
  overrides: Partial<ProviderCapabilityAvailability>,
): ProviderCapabilityAvailability {
  return {
    slot: "tts",
    provider: "openai",
    state: "available",
    reason: "provider_configured",
    model: "tts-1",
    requiredKeyConfigured: true,
    requiredKeySource: "env",
    ...overrides,
  };
}

describe("tool-provider-capability-policy", () => {
  it("maps provider-backed tools to their capability slots", () => {
    expect(getProviderBackedToolNames()).toEqual([
      "generate_audio",
      "generate_blog_image",
      "admin_web_search",
    ]);
    expect(getToolProviderCapabilityRequirement("generate_audio")).toMatchObject({
      slot: "tts",
      operation: "generate",
    });
    expect(getToolProviderCapabilityRequirement("generate_blog_image")).toMatchObject({
      slot: "image",
      operation: "generate",
    });
    expect(getToolProviderCapabilityRequirement("admin_web_search")).toMatchObject({
      slot: "web_search",
      operation: "search",
    });
  });

  it("does not map STT before a transcription runtime exists", () => {
    expect(getProviderBackedToolNames().some((toolName) => {
      return getToolProviderCapabilityRequirement(toolName)?.slot === "stt";
    })).toBe(false);
  });

  it("does not gate existing-asset and local media tools", () => {
    for (const toolName of [
      "select_journal_hero_image",
      "list_conversation_media_assets",
      "compose_media",
      "generate_blog_image_prompt",
      "generate_chart",
      "generate_graph",
    ]) {
      expect(getToolProviderCapabilityRequirement(toolName)).toBeNull();
    }
  });

  it("translates capability states into tool gates", () => {
    expect(getProviderCapabilityGate(availability({ state: "available" }))).toBeNull();
    expect(getProviderCapabilityGate(availability({ state: "disabled", reason: "provider_disabled" }))).toEqual({
      state: "provider_disabled",
      reason: "provider_capability_disabled",
    });
    expect(getProviderCapabilityGate(availability({
      state: "missing_key",
      reason: "missing_required_key",
    }))).toEqual({
      state: "missing_provider_key",
      reason: "missing_openai_key",
    });
  });
});
