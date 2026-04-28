import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const root = process.cwd();

describe("Spec 14: Composition Root Structure", () => {
  it("tool-composition-root.ts stays lean and under 130 lines", () => {
    const content = readFileSync(join(root, "src/lib/chat/tool-composition-root.ts"), "utf-8");
    const lineCount = content.split("\n").length;
    expect(lineCount).toBeLessThanOrEqual(130);
  });

  it("each bundle file exists under tool-bundles/", () => {
    const bundles = [
      "calculator-tools.ts",
      "theme-tools.ts",
      "corpus-tools.ts",
      "conversation-tools.ts",
      "admin-tools.ts",
      "blog-tools.ts",
      "profile-tools.ts",
      "job-tools.ts",
      "navigation-tools.ts",
      "affiliate-tools.ts",
    ];
    for (const bundle of bundles) {
      const path = join(root, "src/lib/chat/tool-bundles", bundle);
      expect(existsSync(path), `${bundle} should exist`).toBe(true);
    }
  });

  it("no bundle imports another bundle", () => {
    const bundleDir = join(root, "src/lib/chat/tool-bundles");
    const bundles = [
      "calculator-tools.ts",
      "theme-tools.ts",
      "corpus-tools.ts",
      "conversation-tools.ts",
      "admin-tools.ts",
      "blog-tools.ts",
      "profile-tools.ts",
      "job-tools.ts",
      "navigation-tools.ts",
      "affiliate-tools.ts",
    ];
    for (const bundle of bundles) {
      const content = readFileSync(join(bundleDir, bundle), "utf-8");
      expect(content).not.toMatch(/from\s+["']\.\/(?!bundle-registration)[^"']*-tools["']/);
      expect(content).not.toMatch(/from\s+["']\.\.\/tool-bundles\/[^"]*["']/);
    }
  });
});
