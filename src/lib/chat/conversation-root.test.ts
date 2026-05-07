import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("conversation-root provider composition", () => {
  it("creates summarization from the selected intelligence runtime", () => {
    const source = readFileSync("src/lib/chat/conversation-root.ts", "utf8");

    expect(source).toContain("createSelectedIntelligenceRuntime");
    expect(source).toContain("runtime.client");
    expect(source).toContain("runtime.provider");
    expect(source).toContain("runtime.model");
    expect(source).not.toMatch(new RegExp(["getAnthropicApi", "Key"].join("")));
    expect(source).not.toMatch(new RegExp(["getModel", "Fallbacks"].join("")));
  });
});
