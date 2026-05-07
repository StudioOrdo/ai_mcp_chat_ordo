import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SystemSetting } from "@/core/ports/SystemSettingsRepository";
import type { SystemSettingsDataMapper } from "@/adapters/SystemSettingsDataMapper";
import * as RepositoryFactory from "@/adapters/RepositoryFactory";

import { ProviderConfigService, resolveSelectedProviderWithWarnings } from "./provider-config-service";

vi.mock("@/adapters/RepositoryFactory", async () => {
  const { createMockRepositoryFactory } = await import("@/__test-utils__");
  return {
    ...createMockRepositoryFactory({
      getSystemSettingsDataMapper: vi.fn(),
    }),
  };
});

describe("ProviderConfigService", () => {
  let settings: Map<string, string>;
  const originalEnv = process.env;

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

  it("defaults selected intelligence provider to Anthropic", () => {
    const config = ProviderConfigService.resolveSelectedIntelligenceProviderConfig();
    expect(config.provider).toMatchObject({
      key: "AI_PROVIDER",
      value: "anthropic",
      source: "default",
    });
  });

  it("selects DeepSeek from env with provider-specific defaults", () => {
    process.env.AI_PROVIDER = "deepseek";
    process.env.DEEPSEEK_API_KEY = "deepseek-secret";

    const config = ProviderConfigService.resolveSelectedIntelligenceProviderConfig();

    expect(config.provider.value).toBe("deepseek");
    expect(config.apiKey).toMatchObject({
      key: "DEEPSEEK_API_KEY",
      value: "deepseek-secret",
      source: "env",
      configured: true,
    });
    expect(config.baseUrl.value).toBe("https://api.deepseek.com/anthropic");
    expect(config.model.value).toBe("deepseek-v4-flash");
    expect(config.modelCandidates).toEqual(["deepseek-v4-flash", "deepseek-v4-pro"]);
    expect(config.modelCandidates.some((model) => model.includes("claude"))).toBe(false);
  });

  it("resolves DeepSeek config directly without Claude fallback candidates", () => {
    settings.set("DEEPSEEK_API_KEY", "sqlite-deepseek-key");
    settings.set("DEEPSEEK_MODEL", "deepseek-v4-pro");

    const config = ProviderConfigService.resolveIntelligenceProviderConfig("deepseek");

    expect(config.provider).toMatchObject({
      key: "AI_PROVIDER",
      value: "deepseek",
      source: "default",
    });
    expect(config.apiKey).toMatchObject({
      key: "DEEPSEEK_API_KEY",
      value: "sqlite-deepseek-key",
      source: "sqlite",
    });
    expect(config.modelCandidates).toEqual(["deepseek-v4-pro", "deepseek-v4-flash"]);
    expect(config.modelCandidates.some((model) => model.includes("claude"))).toBe(false);
  });

  it("returns a warning and falls back when AI_PROVIDER is unknown", () => {
    process.env.AI_PROVIDER = "mystery";

    const result = resolveSelectedProviderWithWarnings();

    expect(result.provider.value).toBe("anthropic");
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "unknown_intelligence_provider",
        key: "AI_PROVIDER",
        value: "mystery",
      }),
    ]);
  });

  it("uses env values before SQLite values", () => {
    process.env.ANTHROPIC_API_KEY = "env-key";
    settings.set("ANTHROPIC_API_KEY", "sqlite-key");

    const config = ProviderConfigService.resolveAnthropicProviderConfig();

    expect(config.apiKey).toMatchObject({
      key: "ANTHROPIC_API_KEY",
      value: "env-key",
      source: "env",
    });
  });

  it("uses file secrets before SQLite values and reports file source", () => {
    const dir = mkdtempSync(join(tmpdir(), "ordo-provider-"));
    try {
      const file = join(dir, "anthropic");
      writeFileSync(file, "file-key\n");
      process.env.ANTHROPIC_API_KEY_FILE = file;
      settings.set("ANTHROPIC_API_KEY", "sqlite-key");

      const config = ProviderConfigService.resolveAnthropicProviderConfig();

      expect(config.apiKey).toMatchObject({
        key: "ANTHROPIC_API_KEY",
        value: "file-key",
        source: "file",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses env aliases before SQLite primary keys", () => {
    process.env.API__ANTHROPIC_API_KEY = "env-alias-key";
    settings.set("ANTHROPIC_API_KEY", "sqlite-primary-key");

    const config = ProviderConfigService.resolveAnthropicProviderConfig();

    expect(config.apiKey).toMatchObject({
      key: "API__ANTHROPIC_API_KEY",
      aliasOf: "ANTHROPIC_API_KEY",
      value: "env-alias-key",
      source: "env",
    });
  });

  it("uses SQLite when env values are absent", () => {
    process.env.ANTHROPIC_API_KEY = "";
    settings.set("ANTHROPIC_API_KEY", "sqlite-key");

    const config = ProviderConfigService.resolveAnthropicProviderConfig();

    expect(config.apiKey).toMatchObject({
      key: "ANTHROPIC_API_KEY",
      value: "sqlite-key",
      source: "sqlite",
    });
  });

  it("treats empty env and SQLite strings as absent", () => {
    process.env.ANTHROPIC_MODEL = " ";
    settings.set("ANTHROPIC_MODEL", " ");

    const config = ProviderConfigService.resolveAnthropicProviderConfig();

    expect(config.model).toMatchObject({
      key: "ANTHROPIC_MODEL",
      value: "claude-haiku-4-5",
      source: "default",
    });
  });

  it("resolves OpenAI capability key independently", () => {
    settings.set("OPENAI_API_KEY", "sqlite-openai");

    const key = ProviderConfigService.resolveOpenAiApiKey();

    expect(key).toMatchObject({
      key: "OPENAI_API_KEY",
      value: "sqlite-openai",
      source: "sqlite",
      configured: true,
    });
  });

  it("defaults absent OpenAI-backed capabilities to disabled when key is missing", () => {
    const tts = ProviderConfigService.resolveCapabilityProviderConfig("tts");

    expect(tts.provider).toMatchObject({
      key: "TTS_PROVIDER",
      value: "disabled",
      source: "default",
    });
    expect(tts.requiredKey).toBeNull();
  });

  it("defaults absent OpenAI-backed capabilities to openai when key is configured", () => {
    process.env.OPENAI_API_KEY = "openai-key";

    const tts = ProviderConfigService.resolveCapabilityProviderConfig("tts");

    expect(tts.provider).toMatchObject({
      key: "TTS_PROVIDER",
      value: "openai",
      source: "default",
    });
    expect(tts.requiredKey).toMatchObject({
      key: "OPENAI_API_KEY",
      configured: true,
    });
  });

  it("preserves explicit capability providers even when their key is missing", () => {
    process.env.TTS_PROVIDER = "openai";

    const tts = ProviderConfigService.resolveCapabilityProviderConfig("tts");

    expect(tts.provider).toMatchObject({
      key: "TTS_PROVIDER",
      value: "openai",
      source: "env",
    });
    expect(tts.requiredKey).toMatchObject({
      key: "OPENAI_API_KEY",
      value: null,
      source: "missing",
      configured: false,
    });
  });

  it("redacted snapshots do not include raw secret values", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-secret-1234";
    process.env.OPENAI_API_KEY = "sk-openai-secret-5678";

    const snapshot = ProviderConfigService.resolveRedactedProviderConfigSnapshot();
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.intelligence.apiKey).toMatchObject({
      configured: true,
      last4: "1234",
    });
    expect(snapshot.capabilities.tts.requiredKey).toMatchObject({
      configured: true,
      last4: "5678",
    });
    expect(serialized).not.toContain("sk-ant-secret");
    expect(serialized).not.toContain("sk-openai-secret");
  });
});
