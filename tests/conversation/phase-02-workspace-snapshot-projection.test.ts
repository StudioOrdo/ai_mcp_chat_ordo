import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CONVERSATION_REFACTOR_FOCUSED_TEST_SUITES } from "@/lib/evals/conversation-refactor-evidence";

const CORE_WORKSPACE_FILES = [
  "src/core/platform/conversation-workspace/WorkspaceSnapshotProjector.ts",
  "src/core/platform/conversation-workspace/WorkspaceSnapshotReader.ts",
] as const;

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("conversation refactor phase 02 workspace snapshot projection", () => {
  it("keeps core workspace projection away from hooks, routes, UI, and SQLite", () => {
    for (const relativePath of CORE_WORKSPACE_FILES) {
      const fileSource = source(relativePath);
      expect(fileSource, relativePath).not.toMatch(/from ["']@\/components/);
      expect(fileSource, relativePath).not.toMatch(/from ["']@\/hooks/);
      expect(fileSource, relativePath).not.toMatch(/from ["']@\/app\/api/);
      expect(fileSource, relativePath).not.toMatch(/from ["']next\//);
      expect(fileSource, relativePath).not.toMatch(/from ["']react/);
      expect(fileSource, relativePath).not.toMatch(/better-sqlite3|getDb\(|MessagePart|tool_result|job_status|ChatMessage|useRef/);
    }
  });

  it("documents the Phase 02 implementation and removal criteria", () => {
    const phaseDoc = source("docs/_refactor/conversation/phases/phase-02-workspace-snapshot-projection.md");

    expect(phaseDoc).toContain("Implementation Notes");
    expect(phaseDoc).toContain("RepositoryBackedWorkspaceSnapshotReader");
    expect(phaseDoc).toContain("getWorkspaceSnapshotReader()");
    expect(phaseDoc).toContain("Remove Before Phase 02 Is Complete");
  });

  it("includes Phase 02 deterministic suites in the focused QA bundle", () => {
    expect(CONVERSATION_REFACTOR_FOCUSED_TEST_SUITES).toEqual(expect.arrayContaining([
      "src/core/platform/conversation-workspace/WorkspaceSnapshotProjector.test.ts",
      "src/core/platform/conversation-workspace/WorkspaceSnapshotReader.test.ts",
      "tests/conversation/phase-02-workspace-snapshot-projection.test.ts",
    ]));
  });
});