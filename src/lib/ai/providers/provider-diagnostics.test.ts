import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SystemSettingsDataMapper } from "@/adapters/SystemSettingsDataMapper";
import type { SystemSetting } from "@/core/ports/SystemSettingsRepository";
import * as RepositoryFactory from "@/adapters/RepositoryFactory";
import {
  getProviderDiagnosticsReport,
  getProviderDiagnosticsReportSync,
  summarizeProviderDiagnostics,
} from "./provider-diagnostics";

vi.mock("@/adapters/RepositoryFactory", async () => {
  const { createMockRepositoryFactory } = await import("@/__test-utils__");
  return {
    ...createMockRepositoryFactory({
      getSystemSettingsDataMapper: vi.fn(),
    }),
  };
});

describe("provider diagnostics", () => {
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
      get: vi.fn(async (key: string): Promise<SystemSetting | null> => {
        const value = settings.get(key);
        return value === undefined
          ? null
          : {
            key,
            valueJson: JSON.stringify(value),
            updatedAt: "2026-05-02T00:00:00.000Z",
          };
      }),
    } as Pick<SystemSettingsDataMapper, "get" | "getSync"> as SystemSettingsDataMapper);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("reports selected intelligence provider without exposing secrets", () => {
    process.env.AI_PROVIDER = "deepseek";
    process.env.DEEPSEEK_API_KEY = "deepseek-secret";
    process.env.DEEPSEEK_MODEL = "deepseek-v4-pro";

    const report = getProviderDiagnosticsReportSync();

    expect(report.intelligence).toMatchObject({
      provider: "deepseek",
      providerSource: "env",
      model: "deepseek-v4-pro",
      modelSource: "env",
      apiKeyConfigured: true,
      apiKeySource: "env",
      baseUrlConfigured: true,
      baseUrlSource: "default",
    });
    expect(JSON.stringify(report)).not.toContain("deepseek-secret");
  });

  it("reports capability slots and impacted provider-backed tools", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.IMAGE_PROVIDER = "openai";
    process.env.TTS_PROVIDER = "openai";
    process.env.WEB_SEARCH_PROVIDER = "openai";

    const report = getProviderDiagnosticsReportSync();

    expect(report.capabilities.find((capability) => capability.slot === "image")).toMatchObject({
      provider: "openai",
      state: "available",
      impactedTools: ["generate_blog_image"],
    });
    expect(report.capabilities.find((capability) => capability.slot === "tts")).toMatchObject({
      impactedTools: ["generate_audio"],
    });
    expect(report.capabilities.find((capability) => capability.slot === "web_search")).toMatchObject({
      impactedTools: ["admin_web_search"],
    });
    expect(report.capabilities.find((capability) => capability.slot === "stt")).toMatchObject({
      impactedTools: [],
    });
  });

  it("marks OpenAI-backed slots disabled when no OpenAI key exists", () => {
    delete process.env.OPENAI_API_KEY;

    const report = getProviderDiagnosticsReportSync();
    const summary = summarizeProviderDiagnostics(report);

    expect(report.capabilities.find((capability) => capability.slot === "image")).toMatchObject({
      provider: "disabled",
      state: "disabled",
      requiredKeyConfigured: null,
    });
    expect(report.toolSummary.byState.provider_disabled).toBeGreaterThanOrEqual(3);
    expect(summary.optionalCapabilitiesDisabled).toBeGreaterThanOrEqual(3);
    expect(summary.providerBackedToolsUnavailable).toBeGreaterThanOrEqual(3);
  });

  it("marks explicit OpenAI slots as missing-key when selected without key", () => {
    process.env.IMAGE_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;
    delete process.env.API__OPENAI_API_KEY;

    const report = getProviderDiagnosticsReportSync();

    expect(report.capabilities.find((capability) => capability.slot === "image")).toMatchObject({
      provider: "openai",
      state: "missing_key",
      requiredKeyConfigured: false,
      requiredKeySource: "missing",
    });
    expect(report.toolSummary.byState.missing_provider_key).toBeGreaterThanOrEqual(1);
  });

  it("keeps async and sync diagnostics shapes aligned", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.TTS_PROVIDER = "openai";

    const sync = getProviderDiagnosticsReportSync();
    const asyncReport = await getProviderDiagnosticsReport();

    expect(Object.keys(asyncReport).sort()).toEqual(Object.keys(sync).sort());
    expect(Object.keys(asyncReport.intelligence).sort()).toEqual(Object.keys(sync.intelligence).sort());
    expect(Object.keys(asyncReport.toolSummary).sort()).toEqual(Object.keys(sync.toolSummary).sort());
    expect(asyncReport.capabilities.map((capability) => Object.keys(capability).sort())).toEqual(
      sync.capabilities.map((capability) => Object.keys(capability).sort()),
    );
  });
});
