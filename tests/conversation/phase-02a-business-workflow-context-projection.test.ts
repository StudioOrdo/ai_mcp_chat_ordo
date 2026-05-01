import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CONVERSATION_REFACTOR_FOCUSED_TEST_SUITES } from "@/lib/evals/conversation-refactor-evidence";

const CORE_WORKFLOW_FILES = [
  "src/core/platform/business-workflow/BusinessWorkflowContextProjector.ts",
  "src/core/platform/business-workflow/BusinessWorkflowContextReader.ts",
] as const;

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("conversation refactor phase 02A business workflow context projection", () => {
  it("keeps core business workflow projection away from hooks, routes, UI, and SQLite", () => {
    for (const relativePath of CORE_WORKFLOW_FILES) {
      const fileSource = source(relativePath);
      expect(fileSource, relativePath).not.toMatch(/from ["']@\/components/);
      expect(fileSource, relativePath).not.toMatch(/from ["']@\/hooks/);
      expect(fileSource, relativePath).not.toMatch(/from ["']@\/app\/api/);
      expect(fileSource, relativePath).not.toMatch(/from ["']next\//);
      expect(fileSource, relativePath).not.toMatch(/from ["']react/);
      expect(fileSource, relativePath).not.toMatch(/better-sqlite3|getDb\(|MessagePart|tool_result|job_status|CurrentPageMemento|useRef/);
    }
  });

  it("documents the Phase 02A implementation and removal criteria", () => {
    const phaseDoc = source("docs/_refactor/conversation/phases/phase-02a-business-workflow-context-projection.md");

    expect(phaseDoc).toContain("Implementation Notes");
    expect(phaseDoc).toContain("RepositoryBackedBusinessWorkflowContextReader");
    expect(phaseDoc).toContain("Remove Before Phase 02A Is Complete");
    expect(phaseDoc).toContain("job` and `asset` contract gap");
  });

  it("includes Phase 02A deterministic suites in the focused QA bundle", () => {
    expect(CONVERSATION_REFACTOR_FOCUSED_TEST_SUITES).toEqual(expect.arrayContaining([
      "src/core/platform/business-workflow/BusinessWorkflowContextProjector.test.ts",
      "src/core/platform/business-workflow/BusinessWorkflowContextReader.test.ts",
      "tests/conversation/phase-02a-business-workflow-context-projection.test.ts",
    ]));
  });
});