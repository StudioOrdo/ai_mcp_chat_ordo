import { describe, expect, it } from "vitest";

import {
  CAPABILITY_PROVIDER_CATALOG,
  DEFAULT_DEEPSEEK_BASE_URL,
  DEFAULT_DEEPSEEK_MODEL,
  DEEPSEEK_MODEL_CANDIDATES,
  INTELLIGENCE_PROVIDER_CATALOG,
} from "./provider-catalog";

describe("provider catalog", () => {
  it("contains Anthropic and DeepSeek intelligence providers", () => {
    expect(INTELLIGENCE_PROVIDER_CATALOG.anthropic.id).toBe("anthropic");
    expect(INTELLIGENCE_PROVIDER_CATALOG.deepseek.id).toBe("deepseek");
  });

  it("keeps Anthropic and DeepSeek model candidates separated", () => {
    expect(INTELLIGENCE_PROVIDER_CATALOG.anthropic.modelCandidates).toEqual([
      "claude-haiku-4-5",
      "claude-sonnet-4-6",
      "claude-opus-4-6",
    ]);
    expect(DEEPSEEK_MODEL_CANDIDATES).toEqual([
      "deepseek-v4-flash",
      "deepseek-v4-pro",
    ]);
    expect(DEEPSEEK_MODEL_CANDIDATES.some((model) => model.includes("claude"))).toBe(false);
  });

  it("uses current DeepSeek Anthropic-compatible defaults", () => {
    expect(DEFAULT_DEEPSEEK_BASE_URL).toBe("https://api.deepseek.com/anthropic");
    expect(DEFAULT_DEEPSEEK_MODEL).toBe("deepseek-v4-flash");
    expect(INTELLIGENCE_PROVIDER_CATALOG.deepseek.modelCandidates).toEqual([
      "deepseek-v4-flash",
      "deepseek-v4-pro",
    ]);
  });

  it("contains all initial capability provider slots", () => {
    expect(Object.keys(CAPABILITY_PROVIDER_CATALOG).sort()).toEqual([
      "image",
      "stt",
      "tts",
      "web_search",
    ]);
    expect(CAPABILITY_PROVIDER_CATALOG.image.defaultModel).toBe("gpt-image-1");
    expect(CAPABILITY_PROVIDER_CATALOG.tts.defaultModel).toBe("tts-1");
    expect(CAPABILITY_PROVIDER_CATALOG.web_search.defaultModel).toBe("gpt-5");
  });
});
