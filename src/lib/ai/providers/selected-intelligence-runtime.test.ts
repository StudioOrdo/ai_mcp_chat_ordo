import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SystemSettingsDataMapper } from "@/adapters/SystemSettingsDataMapper";
import type { SystemSetting } from "@/core/ports/SystemSettingsRepository";
import * as RepositoryFactory from "@/adapters/RepositoryFactory";

const { anthropicConstructorMock } = vi.hoisted(() => ({
  anthropicConstructorMock: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: anthropicConstructorMock,
}));

vi.mock("@/adapters/RepositoryFactory", async () => {
  const { createMockRepositoryFactory } = await import("@/__test-utils__");
  return {
    ...createMockRepositoryFactory({
      getSystemSettingsDataMapper: vi.fn(),
    }),
  };
});

import {
  createSelectedIntelligenceRuntime,
  SelectedIntelligenceRuntimeConfigurationError,
} from "./selected-intelligence-runtime";

describe("createSelectedIntelligenceRuntime", () => {
  let settings: Map<string, string>;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    settings = new Map();
    anthropicConstructorMock.mockImplementation(function AnthropicMock(options) {
      return { options };
    });
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

  it("creates an Anthropic-compatible DeepSeek runtime without Claude model fallbacks", () => {
    settings.set("AI_PROVIDER", "deepseek");
    settings.set("DEEPSEEK_API_KEY", "deepseek-key");
    settings.set("DEEPSEEK_MODEL", "deepseek-v4-pro");

    const runtime = createSelectedIntelligenceRuntime();

    expect(runtime.provider).toBe("deepseek");
    expect(runtime.model).toBe("deepseek-v4-pro");
    expect(runtime.baseUrl).toBe("https://api.deepseek.com/anthropic");
    expect(runtime.policy).toMatchObject({
      provider: "deepseek",
      modelCandidates: ["deepseek-v4-pro", "deepseek-v4-flash"],
    });
    expect(runtime.policy.modelCandidates.some((model) => model.includes("claude"))).toBe(false);
    expect(anthropicConstructorMock).toHaveBeenCalledWith({
      apiKey: "deepseek-key",
      baseURL: "https://api.deepseek.com/anthropic",
    });
  });

  it("fails before SDK construction when the selected provider key is missing", () => {
    settings.set("AI_PROVIDER", "deepseek");

    expect(() => createSelectedIntelligenceRuntime()).toThrow(
      SelectedIntelligenceRuntimeConfigurationError,
    );
    expect(anthropicConstructorMock).not.toHaveBeenCalled();
  });
});
