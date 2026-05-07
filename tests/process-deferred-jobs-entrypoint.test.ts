import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("process-deferred-jobs entrypoint", () => {
  it("loads local env before starting the worker runtime", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/process-deferred-jobs.ts"),
      "utf-8",
    );

    expect(source).toContain('import { loadLocalEnv } from "./load-local-env"');
    expect(source).toMatch(/loadLocalEnv\(\);[\s\S]*async function main\(/);
    expect(source.indexOf("loadLocalEnv();")).toBeLessThan(
      source.indexOf("await runDeferredJobRuntime"),
    );
  });
});
