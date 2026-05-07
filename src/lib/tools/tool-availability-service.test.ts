import { describe, expect, it } from "vitest";

import { ToolAvailabilityService } from "./tool-availability-service";
import type {
  ProviderCapabilityAvailability,
  ProviderCapabilityAvailabilitySnapshot,
} from "@/lib/ai/providers/provider-capability-availability";

function capability(
  overrides: Partial<ProviderCapabilityAvailability>,
): ProviderCapabilityAvailability {
  return {
    slot: "tts",
    provider: "disabled",
    state: "disabled",
    reason: "provider_disabled",
    model: null,
    requiredKeyConfigured: null,
    requiredKeySource: null,
    ...overrides,
  };
}

function capabilitySnapshot(
  overrides: Partial<ProviderCapabilityAvailabilitySnapshot> = {},
): ProviderCapabilityAvailabilitySnapshot {
  return {
    image: capability({ slot: "image" }),
    tts: capability({ slot: "tts" }),
    stt: capability({ slot: "stt" }),
    web_search: capability({ slot: "web_search" }),
    ...overrides,
  };
}

const availableCapabilitySnapshot = capabilitySnapshot({
  image: capability({
    slot: "image",
    provider: "openai",
    state: "available",
    reason: "provider_configured",
    model: "gpt-image-1",
    requiredKeyConfigured: true,
    requiredKeySource: "env",
  }),
  tts: capability({
    slot: "tts",
    provider: "openai",
    state: "available",
    reason: "provider_configured",
    model: "tts-1",
    requiredKeyConfigured: true,
    requiredKeySource: "env",
  }),
  web_search: capability({
    slot: "web_search",
    provider: "openai",
    state: "available",
    reason: "provider_configured",
    model: "gpt-5",
    requiredKeyConfigured: true,
    requiredKeySource: "env",
  }),
});

describe("ToolAvailabilityService", () => {
  it("keeps protected recovery tools enabled even when static config tries to disable them", () => {
    const service = new ToolAvailabilityService();
    const manifest = service.getEffectiveManifest({
      staticConfig: { disabled: ["inspect_runtime_context"] },
      providerCapabilitySnapshot: availableCapabilitySnapshot,
    });

    const tool = manifest.tools.find((entry) => entry.name === "inspect_runtime_context");
    expect(tool?.state).toBe("enabled");
    expect(tool?.protected).toBe(true);
    expect(manifest.warnings.some((warning) => warning.code === "protected_tool_not_disabled")).toBe(true);
  });

  it("applies static disabled before admin enabled", () => {
    const service = new ToolAvailabilityService();
    const manifest = service.getEffectiveManifest({
      staticConfig: { disabled: ["calculator"] },
      adminOverrides: { enabled: ["calculator"] },
      providerCapabilitySnapshot: availableCapabilitySnapshot,
    });

    const tool = manifest.tools.find((entry) => entry.name === "calculator");
    expect(tool?.state).toBe("disabled_by_static_config");
    expect(tool?.reason).toBe("static_disabled");
    expect(tool?.staticLocked).toBe(true);
  });

  it("applies admin runtime disabled to toggleable tools", () => {
    const service = new ToolAvailabilityService();
    const manifest = service.getEffectiveManifest({
      adminOverrides: { disabled: ["calculator"] },
      providerCapabilitySnapshot: availableCapabilitySnapshot,
    });

    const tool = manifest.tools.find((entry) => entry.name === "calculator");
    expect(tool?.state).toBe("disabled_by_admin");
    expect(tool?.reason).toBe("admin_disabled");
  });

  it("marks OpenAI-backed optional tools unavailable when the OpenAI key is missing", () => {
    const service = new ToolAvailabilityService();
    const manifest = service.getEffectiveManifest({
      providerCapabilitySnapshot: capabilitySnapshot({
        image: capability({
          slot: "image",
          provider: "openai",
          state: "missing_key",
          reason: "missing_required_key",
          model: "gpt-image-1",
          requiredKeyConfigured: false,
          requiredKeySource: "missing",
        }),
        tts: capability({
          slot: "tts",
          provider: "openai",
          state: "missing_key",
          reason: "missing_required_key",
          model: "tts-1",
          requiredKeyConfigured: false,
          requiredKeySource: "missing",
        }),
        web_search: capability({
          slot: "web_search",
          provider: "openai",
          state: "missing_key",
          reason: "missing_required_key",
          model: "gpt-5",
          requiredKeyConfigured: false,
          requiredKeySource: "missing",
        }),
      }),
    });

    for (const toolName of ["generate_audio", "generate_blog_image", "admin_web_search"]) {
      const tool = manifest.tools.find((entry) => entry.name === toolName);
      expect(tool?.state).toBe("missing_provider_key");
      expect(tool?.reason).toBe("missing_openai_key");
    }
  });

  it("disables TTS, image, and web search tools when capability providers are disabled", () => {
    const service = new ToolAvailabilityService();
    const manifest = service.getEffectiveManifest({
      providerCapabilitySnapshot: capabilitySnapshot(),
    });

    expect(manifest.tools.find((entry) => entry.name === "generate_audio")).toMatchObject({
      state: "provider_disabled",
      reason: "provider_capability_disabled",
      providerCapabilitySlot: "tts",
      providerCapabilityState: "disabled",
      providerCapabilityProvider: "disabled",
    });
    expect(manifest.tools.find((entry) => entry.name === "generate_blog_image")).toMatchObject({
      state: "provider_disabled",
      reason: "provider_capability_disabled",
      providerCapabilitySlot: "image",
    });
    expect(manifest.tools.find((entry) => entry.name === "admin_web_search")).toMatchObject({
      state: "provider_disabled",
      reason: "provider_capability_disabled",
      providerCapabilitySlot: "web_search",
    });
  });

  it("admin enable intent cannot override provider-disabled effective state", () => {
    const service = new ToolAvailabilityService();
    const manifest = service.getEffectiveManifest({
      adminOverrides: { enabled: ["generate_audio"] },
      providerCapabilitySnapshot: capabilitySnapshot({
        tts: capability({ slot: "tts", state: "disabled", reason: "provider_disabled" }),
      }),
    });

    const tool = manifest.tools.find((entry) => entry.name === "generate_audio");
    expect(tool?.state).toBe("provider_disabled");
    expect(tool?.layer).toBe("provider_capability");
  });

  it("keeps non-provider asset and local media tools enabled when providers are disabled", () => {
    const service = new ToolAvailabilityService();
    const manifest = service.getEffectiveManifest({
      providerCapabilitySnapshot: capabilitySnapshot(),
    });

    for (const toolName of [
      "list_conversation_media_assets",
      "compose_media",
      "select_journal_hero_image",
    ]) {
      expect(manifest.tools.find((entry) => entry.name === toolName)?.state).toBe("enabled");
    }
  });

  it("reports role and request filtering without changing base availability", () => {
    const service = new ToolAvailabilityService();
    const manifest = service.getEffectiveManifest({
      providerCapabilitySnapshot: availableCapabilitySnapshot,
    });

    const filtered = service.getRoleFilteredManifest(manifest, {
      role: "ANONYMOUS",
      allowedToolNames: ["calculator"],
    });

    expect(filtered.find((tool) => tool.name === "calculator")?.roleState).toBe("enabled");
    expect(filtered.find((tool) => tool.name === "admin_search")?.roleState).toBe("role_denied");
    expect(filtered.find((tool) => tool.name === "search_corpus")?.roleState).toBe("request_filtered");
  });
});
