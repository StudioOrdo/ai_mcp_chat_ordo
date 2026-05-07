/**
 * Sprint 21 — MCP Boundary Canonicalization Tests
 *
 * Validates:
 * 1. `mcp/` contains only declared transport entrypoints
 * 2. shared capability modules live under `src/lib/capabilities/shared/`
 * 3. no runtime `@mcp/*` imports remain in `src/` or `tests/`
 * 4. package scripts match the canonical MCP process contract
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { MCP_PROCESS_METADATA } from "./mcp-process-metadata";

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const MCP_DIR = path.join(PROJECT_ROOT, "mcp");
const SHARED_CAPABILITIES_DIR = path.join(PROJECT_ROOT, "src/lib/capabilities/shared");
const THIS_TEST_FILE = path.join(__dirname, "mcp-boundary-canonicalization.test.ts");

const EXPECTED_SHARED_MODULES = [
  "analytics-domain.ts",
  "analytics-tool.ts",
  "calculator-tool.ts",
  "embedding-tool.ts",
  "librarian-safety.ts",
  "librarian-tool.ts",
  "prompt-tool.ts",
  "web-search-tool.ts",
] as const;

function collectFiles(root: string): string[] {
  const collected: string[] = [];
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
        collected.push(fullPath);
      }
    }
  }

  return collected.sort();
}

describe("Sprint 21 — MCP boundary canonicalization", () => {
  it("mcp/ contains only declared transport entrypoints", () => {
    const files = fs.readdirSync(MCP_DIR)
      .filter((name) => name.endsWith(".ts"))
      .sort();
    const expected = MCP_PROCESS_METADATA
      .map((process) => path.basename(process.entrypoint))
      .sort();

    expect(files).toEqual(expected);
  });

  it("shared capability modules exist under src/lib/capabilities/shared/", () => {
    const files = fs.readdirSync(SHARED_CAPABILITIES_DIR)
      .filter((name) => name.endsWith(".ts"))
      .sort();

    for (const moduleName of EXPECTED_SHARED_MODULES) {
      expect(files).toContain(moduleName);
    }
  });

  it("package.json scripts match the MCP process metadata", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    for (const process of MCP_PROCESS_METADATA) {
      const scriptName = process.canonicalCommand.replace("npm run ", "");
      expect(packageJson.scripts?.[scriptName]).toContain(`tsx ${process.entrypoint}`);

      for (const alias of process.compatibilityAliases) {
        const aliasScript = alias.replace("npm run ", "");
        expect(packageJson.scripts?.[aliasScript]).toContain(`tsx ${process.entrypoint}`);
      }
    }
  });

  it("declared server names match the transport entrypoints", () => {
    for (const process of MCP_PROCESS_METADATA) {
      const source = fs.readFileSync(path.join(PROJECT_ROOT, process.entrypoint), "utf8");
      expect(source).toContain(`name: "${process.serverName}"`);
    }
  });

  it("live source and tests contain no @mcp alias imports", () => {
    const filesToScan = [
      ...collectFiles(path.join(PROJECT_ROOT, "src")),
      ...collectFiles(path.join(PROJECT_ROOT, "tests")),
    ];

    const offenders = filesToScan.filter((filePath) => {
      if (filePath === THIS_TEST_FILE) {
        return false;
      }

      const source = fs.readFileSync(filePath, "utf8");
      return source.includes("@mcp/");
    });

    expect(offenders).toEqual([]);
  });
});
