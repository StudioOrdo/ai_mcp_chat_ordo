import { afterEach, describe, expect, it, vi } from "vitest";

import { getReadinessProbe } from "./probes";

describe("getReadinessProbe", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("checks the selected intelligence provider instead of Anthropic-only env", async () => {
    vi.stubEnv("AI_PROVIDER", "deepseek");
    vi.stubEnv("DEEPSEEK_API_KEY", "deepseek-key");
    vi.stubEnv("DEEPSEEK_MODEL", "deepseek-v4-pro");
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    expect(await getReadinessProbe()).toMatchObject({
      status: "ok",
      checks: {
        config: "ok",
        model: "ok",
      },
    });
  });
});
