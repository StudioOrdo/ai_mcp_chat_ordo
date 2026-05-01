import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf-8");
}

describe("indexed search guardrails", () => {
  it("keeps product search paths off VectorStore.getAll full scans", () => {
    const productSearchFiles = [
      "src/core/search/HybridSearchEngine.ts",
      "src/core/search/SearchHandlerChain.ts",
      "src/core/search/ChangeDetector.ts",
      "src/core/use-cases/tools/search-my-conversations.tool.ts",
    ];

    for (const path of productSearchFiles) {
      expect(readSource(path), path).not.toMatch(/\.getAll\s*\(/);
    }
  });

  it("keeps app and MCP search chains off the legacy corpus scan fallback", () => {
    expect(readSource("src/lib/chat/search-pipeline.ts")).not.toContain("LegacyKeywordHandler");
    expect(readSource("mcp/operations-server.ts")).not.toContain("LegacyKeywordHandler");
  });
});
