import { afterEach, describe, expect, it, vi } from "vitest";

import { getDiagnosticsReport } from "./processes";

describe("getDiagnosticsReport", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports selected intelligence provider metadata instead of anthropicModel", () => {
    vi.stubEnv("AI_PROVIDER", "deepseek");
    vi.stubEnv("DEEPSEEK_API_KEY", "deepseek-key");
    vi.stubEnv("DEEPSEEK_MODEL", "deepseek-v4-pro");
    vi.stubEnv("ORDO_RUNTIME_AUDIT_LOG_DIR", "/tmp/ordo-runtime-audit");

    const report = getDiagnosticsReport();

    expect(report).not.toHaveProperty("anthropicModel");
    expect(report).not.toHaveProperty("integrations");
    expect(report.providerDiagnostics.intelligence).toMatchObject({
      provider: "deepseek",
      model: "deepseek-v4-pro",
      apiKeyConfigured: true,
    });
    expect(report.intelligenceProvider).toMatchObject({
      provider: "deepseek",
      model: "deepseek-v4-pro",
      apiKeyConfigured: true,
    });
  });
});
