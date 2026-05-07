import { afterEach, describe, expect, it, vi } from "vitest";
import { getLivenessProbe, getReadinessProbe } from "@/lib/health/probes";

describe("health probes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns liveness ok", () => {
    const result = getLivenessProbe();
    expect(result.status).toBe("ok");
  });

  it("returns readiness ok when env is present", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-haiku-4-5");

    const result = await getReadinessProbe();
    expect(result.status).toBe("ok");
    expect(result.intelligence).toMatchObject({
      provider: "anthropic",
      model: "claude-haiku-4-5",
      apiKeyConfigured: true,
    });
    expect(result.optionalCapabilities?.length).toBe(4);
  });

  it("uses the selected provider for readiness", async () => {
    vi.stubEnv("AI_PROVIDER", "deepseek");
    vi.stubEnv("DEEPSEEK_API_KEY", "deepseek-key");
    vi.stubEnv("DEEPSEEK_MODEL", "deepseek-v4-pro");
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    const result = await getReadinessProbe();
    expect(result.status).toBe("ok");
    expect(result.intelligence).toMatchObject({
      provider: "deepseek",
      model: "deepseek-v4-pro",
      apiKeyConfigured: true,
    });
  });

  it("returns readiness error when key is missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("API__ANTHROPIC_API_KEY", "");

    const result = await getReadinessProbe();
    expect(result.status).toBe("error");
  });

  it("reports optional capability degradation without failing readiness", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-haiku-4-5");
    vi.stubEnv("IMAGE_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("API__OPENAI_API_KEY", "");

    const result = await getReadinessProbe();

    expect(result.status).toBe("ok");
    expect(result.details).toContain("optional capability providers are degraded");
    expect(result.optionalCapabilities?.find((capability) => capability.slot === "image")).toMatchObject({
      provider: "openai",
      state: "missing_key",
      impactedTools: ["generate_blog_image"],
    });
    expect(result.warnings).toContain("image capability is missing_key.");
  });

  it("returns readiness error when hosted public origin is missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-haiku-4-5");
    vi.stubEnv("ORDO_HOSTED_MODE", "reverse_proxy");
    vi.stubEnv("ORDO_PUBLIC_ORIGIN", "");

    const result = await getReadinessProbe();

    expect(result.status).toBe("error");
    expect(result.appliance?.components.find((component) => component.component === "network")).toMatchObject({
      status: "blocked",
    });
  });
});
