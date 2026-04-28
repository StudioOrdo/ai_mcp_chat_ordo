import { describe, expect, it } from "vitest";
import { TOOL_BUNDLE_REGISTRY } from "@/lib/chat/tool-composition-root";

describe("TOOL_BUNDLE_REGISTRY", () => {
  it("has unique bundle ids", () => {
    const ids = TOOL_BUNDLE_REGISTRY.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is sorted alphabetically by id", () => {
    const ids = TOOL_BUNDLE_REGISTRY.map((b) => b.id);
    expect(ids).toEqual([...ids].sort());
  });

  it("has no duplicate tool names across bundles", () => {
    const allNames = TOOL_BUNDLE_REGISTRY.flatMap((b) => b.toolNames);
    const dupes = allNames.filter((n, i) => allNames.indexOf(n) !== i);
    expect(dupes).toEqual([]);
  });

  it("each bundle has unique toolNames", () => {
    for (const bundle of TOOL_BUNDLE_REGISTRY) {
      expect(new Set(bundle.toolNames).size).toBe(bundle.toolNames.length);
    }
  });

  it("each bundle has at least one tool", () => {
    for (const bundle of TOOL_BUNDLE_REGISTRY) {
      expect(bundle.toolNames.length).toBeGreaterThan(0);
    }
  });

  it("all bundle ids are non-empty strings", () => {
    for (const bundle of TOOL_BUNDLE_REGISTRY) {
      expect(bundle.id).toBeTruthy();
      expect(typeof bundle.id).toBe("string");
    }
  });

  it("all displayNames are non-empty strings", () => {
    for (const bundle of TOOL_BUNDLE_REGISTRY) {
      expect(bundle.displayName).toBeTruthy();
      expect(typeof bundle.displayName).toBe("string");
    }
  });
});
