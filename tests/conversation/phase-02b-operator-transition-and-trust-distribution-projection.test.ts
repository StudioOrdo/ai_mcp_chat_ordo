import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("conversation refactor phase 02B operator transition and trust distribution", () => {
  it("keeps Phase 02B core projection files away from routes, hooks, UI, transcript authority, and SQLite", () => {
    const files = [
      "src/core/platform/operator-transition/OperatorTransitionProjector.ts",
      "src/core/platform/operator-transition/OperatorTransitionReader.ts",
      "src/core/platform/operator-transition/TrustDistributionProjector.ts",
      "src/core/platform/operator-transition/TrustDistributionReader.ts",
    ] as const;

    for (const relativePath of files) {
      const fileSource = source(relativePath);
      expect(fileSource, relativePath).not.toMatch(/from ["']@\/app/);
      expect(fileSource, relativePath).not.toMatch(/from ["']@\/components/);
      expect(fileSource, relativePath).not.toMatch(/from ["']@\/hooks/);
      expect(fileSource, relativePath).not.toMatch(/from ["']next\//);
      expect(fileSource, relativePath).not.toMatch(/better-sqlite3|getDb\(|ChatMessage|MessagePart|tool_result|tool_call|job_status/);
    }
  });

  it("documents Phase 02B implementation and removal criteria", () => {
    const phaseDoc = source("docs/_refactor/conversation/phases/phase-02b-operator-transition-and-trust-distribution-projection.md");

    expect(phaseDoc).toContain("Remove Before Phase 02B Is Complete");
    expect(phaseDoc).toContain("Build");
    expect(phaseDoc).toContain("qa:conversation-refactor");
  });
});