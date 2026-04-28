import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function listFiles(relativeDir: string): string[] {
  const absoluteDir = join(process.cwd(), relativeDir);
  const entries = readdirSync(absoluteDir);

  return entries.flatMap((entry) => {
    const relativePath = `${relativeDir}/${entry}`;
    const absolutePath = join(process.cwd(), relativePath);

    if (statSync(absolutePath).isDirectory()) {
      return listFiles(relativePath);
    }

    return relativePath;
  });
}

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

function countMatches(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

describe("TD-C3 hardening audit", () => {
  it("F5: tests do not replace process.env wholesale", () => {
    const offenders = listFiles("tests")
      .filter((path) => path.endsWith(".test.ts") || path.endsWith(".test.tsx"))
      .filter((path) => /process\.env\s*=/.test(readSource(path)));

    expect(offenders).toEqual([]);
  });

  it("F6: accepted bare-catch inventory in src stays explicit", () => {
    const files = listFiles("src")
      .filter((path) => path.endsWith(".ts") || path.endsWith(".tsx"));

    const inventory = files
      .map((path) => ({
        path,
        count: countMatches(readSource(path), /catch\s*\{/g),
      }))
      .filter((entry) => entry.count > 0)
      .map((entry) => `${entry.path}:${entry.count}`)
      .sort();

    expect(inventory.length).toBeGreaterThan(30);
    expect(inventory).toEqual([...inventory].sort());
    expect(new Set(inventory).size).toBe(inventory.length);
    expect(inventory.some((entry) => entry.startsWith("src/adapters/FileSystemCorpusRepository.ts:"))).toBe(true);
    expect(inventory).toContain("src/lib/capabilities/shared/librarian-safety.ts:1");
    expect(inventory).toContain("src/lib/theme/theme-state.ts:3");
  });
});