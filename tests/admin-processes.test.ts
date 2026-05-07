import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDiagnosticsReport,
  getEnvValidationReport,
  getHealthSweepReport,
} from "@/lib/admin/processes";
import { resetMetrics } from "@/lib/observability/metrics";

describe("admin processes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetMetrics();
  });

  it("returns diagnostics with runtime metadata", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-haiku-4-5");
    vi.stubEnv("ORDO_RUNTIME_AUDIT_LOG_DIR", "/tmp/ordo-runtime-audit");

    const report = getDiagnosticsReport();
    expect(report.status).toBe("ok");
    expect(report.appName).toBeTruthy();
    expect(report.nodeVersion).toContain("v");
    expect(report).not.toHaveProperty("anthropicModel");
    expect(report).not.toHaveProperty("integrations");
    expect(report.providerDiagnostics.intelligence).toMatchObject({
      provider: "anthropic",
      model: "claude-haiku-4-5",
      apiKeyConfigured: true,
    });
    expect(report.intelligenceProvider).toMatchObject({
      provider: "anthropic",
      model: "claude-haiku-4-5",
      apiKeyConfigured: true,
    });
    expect(report.providerDiagnostics.capabilities.map((capability) => capability.slot).sort()).toEqual([
      "image",
      "stt",
      "tts",
      "web_search",
    ]);
    expect(report.providerDiagnostics.toolSummary).toEqual(expect.objectContaining({
      total: expect.any(Number),
      byState: expect.any(Object),
      protectedCount: expect.any(Number),
      staticLockedCount: expect.any(Number),
      providerGatedCount: expect.any(Number),
      warnings: expect.any(Number),
    }));
    expect(report.runtimeAudit).toEqual({
      directory: "/tmp/ordo-runtime-audit",
      files: {
        deferredJob: "/tmp/ordo-runtime-audit/deferred_job.jsonl",
        nativeProcess: "/tmp/ordo-runtime-audit/native_process.jsonl",
        remoteService: "/tmp/ordo-runtime-audit/remote_service.jsonl",
        mcpProcess: "/tmp/ordo-runtime-audit/mcp_process.jsonl",
      },
    });
  });

  it("returns health sweep ok when env is valid", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-haiku-4-5");

    const report = await getHealthSweepReport();
    expect(report.status).toBe("ok");
    expect(report.readiness.status).toBe("ok");
    expect(report.readiness.intelligence).toMatchObject({
      provider: "anthropic",
      apiKeyConfigured: true,
    });
    expect(report.readiness.optionalCapabilities?.length).toBe(4);
  });

  it("returns env validation error when key is missing", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("API__ANTHROPIC_API_KEY", "");

    const report = getEnvValidationReport();
    expect(report.status).toBe("error");
  });
});
