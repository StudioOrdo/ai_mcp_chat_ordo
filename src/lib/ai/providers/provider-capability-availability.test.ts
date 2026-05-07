import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SystemSetting } from "@/core/ports/SystemSettingsRepository";
import type { SystemSettingsDataMapper } from "@/adapters/SystemSettingsDataMapper";
import * as RepositoryFactory from "@/adapters/RepositoryFactory";
import { ProviderCapabilityAvailabilityService } from "./provider-capability-availability";

vi.mock("@/adapters/RepositoryFactory", async () => {
  const { createMockRepositoryFactory } = await import("@/__test-utils__");
  return {
    ...createMockRepositoryFactory({
      getSystemSettingsDataMapper: vi.fn(),
    }),
  };
});

describe("ProviderCapabilityAvailabilityService", () => {
  const originalEnv = process.env;
  let settings: Map<string, string>;

  beforeEach(() => {
    process.env = { ...originalEnv };
    settings = new Map();
    vi.mocked(RepositoryFactory.getSystemSettingsDataMapper).mockReturnValue({
      getSync: vi.fn((key: string): SystemSetting | null => {
        const value = settings.get(key);
        return value === undefined
          ? null
          : {
            key,
            valueJson: JSON.stringify(value),
            updatedAt: "2026-05-02T00:00:00.000Z",
          };
      }),
    } as Pick<SystemSettingsDataMapper, "getSync"> as SystemSettingsDataMapper);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("reports disabled provider capability state", () => {
    process.env.TTS_PROVIDER = "disabled";

    const availability = new ProviderCapabilityAvailabilityService()
      .getCapabilityAvailability("tts");

    expect(availability).toMatchObject({
      slot: "tts",
      provider: "disabled",
      state: "disabled",
      reason: "provider_disabled",
      requiredKeyConfigured: null,
    });
  });

  it("reports OpenAI capability as available when the key is configured", () => {
    process.env.IMAGE_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";

    const availability = new ProviderCapabilityAvailabilityService()
      .getCapabilityAvailability("image");

    expect(availability).toMatchObject({
      slot: "image",
      provider: "openai",
      state: "available",
      reason: "provider_configured",
      model: "gpt-image-1",
      requiredKeyConfigured: true,
      requiredKeySource: "env",
    });
  });

  it("reports OpenAI capability as missing-key when explicitly selected without a key", () => {
    process.env.WEB_SEARCH_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;
    settings.delete("OPENAI_API_KEY");

    const availability = new ProviderCapabilityAvailabilityService()
      .getCapabilityAvailability("web_search");

    expect(availability).toMatchObject({
      slot: "web_search",
      provider: "openai",
      state: "missing_key",
      reason: "missing_required_key",
      requiredKeyConfigured: false,
      requiredKeySource: "missing",
    });
  });

  it("reports local whisper as config-available without a key", () => {
    process.env.STT_PROVIDER = "local_whisper";

    const availability = new ProviderCapabilityAvailabilityService()
      .getCapabilityAvailability("stt");

    expect(availability).toMatchObject({
      slot: "stt",
      provider: "local_whisper",
      state: "available",
      reason: "provider_configured",
      requiredKeyConfigured: null,
      requiredKeySource: null,
    });
  });
});
