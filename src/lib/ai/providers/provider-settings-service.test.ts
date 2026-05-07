import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SystemSettingsDataMapper } from "@/adapters/SystemSettingsDataMapper";
import * as RepositoryFactory from "@/adapters/RepositoryFactory";
import type { SystemSetting } from "@/core/ports/SystemSettingsRepository";

import {
  ProviderSettingsService,
  parseLegacyProviderSettingsInput,
  parseProviderSettingsUpdateInput,
  type ProviderSettingsUpdateInput,
} from "./provider-settings-service";
import type {
  IntelligenceProviderValidationInput,
  OpenAiProviderValidationInput,
  ProviderValidationResult,
} from "./provider-validation-service";

vi.mock("@/adapters/RepositoryFactory", async () => {
  const { createMockRepositoryFactory } = await import("@/__test-utils__");
  return {
    ...createMockRepositoryFactory({
      getSystemSettingsDataMapper: vi.fn(),
    }),
  };
});

describe("ProviderSettingsService", () => {
  let settings: Map<string, string>;
  let deleteMock: ReturnType<typeof vi.fn<(key: string) => Promise<void>>>;
  let validateIntelligenceProvider: ReturnType<
    typeof vi.fn<(input: IntelligenceProviderValidationInput) => Promise<ProviderValidationResult>>
  >;
  let validateOpenAiProvider: ReturnType<
    typeof vi.fn<(input: OpenAiProviderValidationInput) => Promise<ProviderValidationResult>>
  >;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    settings = new Map();
    deleteMock = vi.fn(async (key: string) => {
      settings.delete(key);
    });
    validateIntelligenceProvider = vi.fn(async (input: IntelligenceProviderValidationInput) => ({
      ok: true,
      provider: input.provider,
      model: input.model,
    }));
    validateOpenAiProvider = vi.fn(async () => ({
      ok: true,
      provider: "openai",
    }));
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
      setSync: vi.fn((key: string, valueJson: string) => {
        settings.set(key, JSON.parse(valueJson) as string);
      }),
      delete: deleteMock,
    } as Pick<SystemSettingsDataMapper, "getSync" | "setSync" | "delete"> as SystemSettingsDataMapper);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  function service(): ProviderSettingsService {
    return new ProviderSettingsService({
      validateIntelligenceProvider,
      validateOpenAiProvider,
    });
  }

  function input(overrides: Partial<ProviderSettingsUpdateInput> = {}): ProviderSettingsUpdateInput {
    return {
      intelligence: {
        provider: "anthropic",
        apiKey: "submitted-anthropic-key",
        model: "claude-sonnet-4-6",
        baseUrl: null,
      },
      openAiKey: null,
      capabilities: {
        image: { provider: "disabled", model: null },
        tts: { provider: "disabled", model: null },
        stt: { provider: "local_whisper", model: null },
        web_search: { provider: "disabled", model: null },
      },
      ...overrides,
    };
  }

  it("returns a redacted, source-aware settings DTO without raw secrets", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-secret-1234";
    settings.set("OPENAI_API_KEY", "sk-openai-secret-5678");

    const dto = service().getSettingsDto();
    const serialized = JSON.stringify(dto);

    expect(dto.intelligence.apiKey).toMatchObject({
      configured: true,
      last4: "1234",
      source: "env",
    });
    expect(dto.openAiKey).toMatchObject({
      configured: true,
      last4: "5678",
      source: "sqlite",
      locked: false,
    });
    expect(dto.intelligence.provider.locked).toBe(false);
    expect(dto.capabilities.tts.requiredKey).toMatchObject({
      configured: true,
      last4: "5678",
    });
    expect(serialized).not.toContain("sk-ant-secret");
    expect(serialized).not.toContain("sk-openai-secret");
  });

  it("validates and persists a DeepSeek-only install without OpenAI", async () => {
    const result = await service().applyInstallSettings(input({
      intelligence: {
        provider: "deepseek",
        apiKey: "submitted-deepseek-key",
        model: "deepseek-v4-pro",
        baseUrl: "https://api.deepseek.com/anthropic",
      },
    }));

    expect(result.ok).toBe(true);
    expect(validateIntelligenceProvider).toHaveBeenCalledWith({
      provider: "deepseek",
      apiKey: "submitted-deepseek-key",
      model: "deepseek-v4-pro",
      baseUrl: "https://api.deepseek.com/anthropic",
    });
    expect(validateOpenAiProvider).not.toHaveBeenCalled();
    expect(settings.get("AI_PROVIDER")).toBe("deepseek");
    expect(settings.get("DEEPSEEK_API_KEY")).toBe("submitted-deepseek-key");
    expect(settings.get("DEEPSEEK_MODEL")).toBe("deepseek-v4-pro");
  });

  it("rejects install payloads that omit the selected intelligence provider key", async () => {
    const result = await service().applyInstallSettings(input({
      intelligence: {
        provider: "deepseek",
        apiKey: null,
        model: "deepseek-v4-flash",
        baseUrl: null,
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error).toMatchObject({
      code: "missing_key",
      status: 400,
    });
    expect(validateIntelligenceProvider).not.toHaveBeenCalled();
  });

  it("allows model-only admin updates when the selected provider key already exists", async () => {
    settings.set("ANTHROPIC_API_KEY", "existing-anthropic-key");

    const result = await service().applySettings(input({
      intelligence: {
        provider: "anthropic",
        apiKey: null,
        model: "claude-opus-4-6",
        baseUrl: null,
      },
    }));

    expect(result.ok).toBe(true);
    expect(validateIntelligenceProvider).toHaveBeenCalledWith({
      provider: "anthropic",
      apiKey: "existing-anthropic-key",
      model: "claude-opus-4-6",
      baseUrl: null,
    });
    expect(settings.get("ANTHROPIC_API_KEY")).toBe("existing-anthropic-key");
    expect(settings.get("ANTHROPIC_MODEL")).toBe("claude-opus-4-6");
  });

  it("requires an OpenAI key when an OpenAI-backed capability is enabled", async () => {
    const result = await service().applySettings(input({
      capabilities: {
        image: { provider: "openai", model: "gpt-image-1" },
        tts: { provider: "disabled", model: null },
        stt: { provider: "local_whisper", model: null },
        web_search: { provider: "disabled", model: null },
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error).toMatchObject({
      code: "missing_key",
      message: "image uses OpenAI and requires an OpenAI API key.",
    });
    expect(validateIntelligenceProvider).not.toHaveBeenCalled();
  });

  it("validates OpenAI only when a submitted key or OpenAI capability requires it", async () => {
    const result = await service().applySettings(input({
      openAiKey: "submitted-openai-key",
      capabilities: {
        image: { provider: "openai", model: "gpt-image-1" },
        tts: { provider: "disabled", model: null },
        stt: { provider: "local_whisper", model: null },
        web_search: { provider: "disabled", model: null },
      },
    }));

    expect(result.ok).toBe(true);
    expect(validateOpenAiProvider).toHaveBeenCalledWith({
      apiKey: "submitted-openai-key",
    });
    expect(settings.get("OPENAI_API_KEY")).toBe("submitted-openai-key");
    expect(settings.get("IMAGE_PROVIDER")).toBe("openai");
    expect(settings.get("IMAGE_MODEL")).toBe("gpt-image-1");
  });

  it("deletes blank optional model and base URL overrides instead of writing empty values", async () => {
    settings.set("ANTHROPIC_BASE_URL", "https://previous.example");
    settings.set("IMAGE_MODEL", "gpt-image-1");

    const result = await service().applySettings(input({
      capabilities: {
        image: { provider: "disabled", model: null },
        tts: { provider: "disabled", model: null },
        stt: { provider: "local_whisper", model: null },
        web_search: { provider: "disabled", model: null },
      },
    }));

    expect(result.ok).toBe(true);
    expect(settings.has("ANTHROPIC_BASE_URL")).toBe(false);
    expect(settings.has("IMAGE_MODEL")).toBe(false);
    expect(deleteMock).toHaveBeenCalledWith("ANTHROPIC_BASE_URL");
    expect(deleteMock).toHaveBeenCalledWith("IMAGE_MODEL");
  });

  it("blocks runtime edits to env-controlled fields", async () => {
    process.env.ANTHROPIC_MODEL = "claude-haiku-4-5";

    const result = await service().applySettings(input({
      intelligence: {
        provider: "anthropic",
        apiKey: "submitted-anthropic-key",
        model: "claude-sonnet-4-6",
        baseUrl: null,
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error).toMatchObject({
      code: "env_locked",
      status: 409,
    });
    expect(validateIntelligenceProvider).not.toHaveBeenCalled();
  });

  it("parses full provider settings payloads with defaulted missing capabilities", () => {
    const parsed = parseProviderSettingsUpdateInput({
      intelligence: {
        provider: "deepseek",
        apiKey: "deepseek-key",
        model: "",
        baseUrl: "",
      },
      capabilities: {
        stt: { provider: "local_whisper", model: "" },
      },
    });

    expect(parsed).toMatchObject({
      intelligence: {
        provider: "deepseek",
        apiKey: "deepseek-key",
        model: "deepseek-v4-flash",
        baseUrl: null,
      },
      capabilities: {
        stt: { provider: "local_whisper", model: null },
      },
    });
    expect("ok" in parsed).toBe(false);
  });

  it("parses legacy Anthropic/OpenAI key payloads", () => {
    const parsed = parseLegacyProviderSettingsInput({
      anthropicKey: "legacy-anthropic-key",
      openAiKey: "legacy-openai-key",
    });

    expect(parsed).toMatchObject({
      intelligence: {
        provider: "anthropic",
        apiKey: "legacy-anthropic-key",
      },
      openAiKey: "legacy-openai-key",
    });
  });
});
