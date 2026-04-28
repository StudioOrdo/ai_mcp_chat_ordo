import { afterEach, describe, expect, it, vi } from "vitest";
import { looksLikeMath } from "@/lib/chat/math-classifier";
import { buildSystemPrompt } from "@/lib/chat/policy";
import { getModelFallbacks } from "@/lib/config/env";

describe("chat policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("detects arithmetic expression syntax", () => {
    expect(looksLikeMath("what is 4 * 11?")).toBe(true);
  });

  it("detects math keywords", () => {
    expect(looksLikeMath("please calculate the product of 8 and 2")).toBe(true);
  });

  it("does not classify regular text as math", () => {
    expect(looksLikeMath("hello there")).toBe(false);
  });

  it("includes the shared tool-usage framing in system prompt", async () => {
    const prompt = await buildSystemPrompt("AUTHENTICATED");
    expect(prompt).toContain("Offload detail to tools to SHOW rather than describe");
  });

  it("returns a deduped fallback list when API model override is set", () => {
    vi.stubEnv("API__ANTHROPIC_MODEL", "claude-sonnet-4-6");

    expect(getModelFallbacks()).toEqual(["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-6"]);
  });

  it("returns fallback list when model not configured", () => {
    vi.stubEnv("ANTHROPIC_MODEL", "");
    vi.stubEnv("API__ANTHROPIC_MODEL", "");

    expect(getModelFallbacks()).toEqual(["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-6"]);
  });
});
