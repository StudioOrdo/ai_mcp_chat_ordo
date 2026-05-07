import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CONVERSATION_REFACTOR_CANONICAL_TABLES,
  CONVERSATION_REFACTOR_FOCUSED_TEST_SUITES,
  CONVERSATION_REFACTOR_PHASE_00_FOCUSED_TEST_SUITES,
  CONVERSATION_REFACTOR_PHASE_01_FOCUSED_TEST_SUITES,
  CONVERSATION_REFACTOR_PHASE_02_FOCUSED_TEST_SUITES,
  CONVERSATION_REFACTOR_PHASE_02A_FOCUSED_TEST_SUITES,
  CONVERSATION_REFACTOR_PHASE_02B_FOCUSED_TEST_SUITES,
  CONVERSATION_REFACTOR_PHASE_03_FOCUSED_TEST_SUITES,
  CONVERSATION_REFACTOR_PHASE_00_SURFACES,
  createConversationRefactorPhase00Evidence,
  writeConversationRefactorEvidenceArtifact,
} from "@/lib/evals/conversation-refactor-evidence";
import { getActiveJobStatuses } from "@/lib/jobs/job-read-model";
import { shouldStartBrowserRuntime, type BrowserRuntimeCandidate } from "@/lib/media/browser-runtime/job-snapshots";

type BrowserRuntimeTestStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf-8");
}

function createCandidate(status: BrowserRuntimeTestStatus | null): BrowserRuntimeCandidate {
  return {
    jobId: "browser:msg_1:generate_chart:1",
    messageId: "msg_1",
    toolName: "generate_chart",
    args: { code: "flowchart TD\nA-->B", title: "Greeting" },
    payload: { code: "flowchart TD\nA-->B", title: "Greeting" },
    resultIndex: 1,
    ...(status
      ? {
          snapshot: {
            type: "job_status",
            jobId: "browser:msg_1:generate_chart:1",
            toolName: "generate_chart",
            label: "Generate chart",
            status,
            sequence: 1,
            updatedAt: "2026-04-28T00:00:00.000Z",
          },
        }
      : {}),
  };
}

describe("conversation refactor phase 00 baseline evidence", () => {
  it("records every required Phase 00 surface with coverage accounting", () => {
    const evidence = createConversationRefactorPhase00Evidence({
      now: new Date("2026-04-28T12:00:00.000Z"),
      steps: [{ label: "phase 00 baseline", command: "vitest run", status: "passed" }],
    });

    expect(evidence.status).toBe("passed");
    expect(evidence.bundleId).toBe("conversation-refactor-phase-00-02b-operator-transition-and-trust-distribution");
    expect(evidence.phase).toBe("00-02B");
    expect(evidence.coverage.surfaces.map((surface) => surface.id)).toEqual([
      "homepage-active-restore",
      "message-part-rendering",
      "browser-runtime-recovery",
      "job-ledger-and-sse",
      "asset-storage-and-lineage",
      "conversation-search-indexing",
      "prompt-runtime-provenance",
      "identity-migration",
    ]);
    expect(evidence.coverage.accounting.covered).toEqual([]);
    expect(evidence.coverage.accounting.partial).toEqual(expect.arrayContaining([
      "message-part-rendering",
      "job-ledger-and-sse",
      "asset-storage-and-lineage",
      "conversation-search-indexing",
      "prompt-runtime-provenance",
      "identity-migration",
    ]));
    expect(evidence.coverage.accounting.misleading).toEqual(["homepage-active-restore"]);
    expect(evidence.coverage.accounting.guarded).toEqual(["browser-runtime-recovery"]);
    expect(evidence.inventory.canonicalTablesInspected).toEqual([...CONVERSATION_REFACTOR_CANONICAL_TABLES]);
    expect(evidence.coverage.focusedTestSuites).toEqual([...CONVERSATION_REFACTOR_FOCUSED_TEST_SUITES]);
    expect(evidence.coverage.focusedTestSuites).toEqual(expect.arrayContaining([
      ...CONVERSATION_REFACTOR_PHASE_00_FOCUSED_TEST_SUITES,
      ...CONVERSATION_REFACTOR_PHASE_01_FOCUSED_TEST_SUITES,
      ...CONVERSATION_REFACTOR_PHASE_02_FOCUSED_TEST_SUITES,
      ...CONVERSATION_REFACTOR_PHASE_02A_FOCUSED_TEST_SUITES,
      ...CONVERSATION_REFACTOR_PHASE_02B_FOCUSED_TEST_SUITES,
      ...CONVERSATION_REFACTOR_PHASE_03_FOCUSED_TEST_SUITES,
    ]));
    expect(evidence.review.rejectedApproaches).toEqual(expect.arrayContaining([
      "Do not patch only useChatRestore to hide old tool parts.",
      "Do not treat embeddings as relationship memory.",
    ]));
  });

  it("writes the Phase 00 release evidence artifact", () => {
    const releaseDir = fs.mkdtempSync(path.join(os.tmpdir(), "conversation-refactor-"));
    const { artifactPath, evidence } = writeConversationRefactorEvidenceArtifact({
      releaseDir,
      now: new Date("2026-04-28T12:00:00.000Z"),
      steps: [{ label: "phase 00 baseline", command: "vitest run", status: "passed" }],
    });

    expect(fs.existsSync(artifactPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(artifactPath, "utf8"))).toEqual(evidence);
  });

  it("freezes the current transcript-centric homepage restore path", () => {
    const pageSource = readSource("src/app/page.tsx");
    const activeRouteSource = readSource("src/app/api/conversations/active/route.ts");
    const restoreHookSource = readSource("src/hooks/chat/useChatRestore.ts");

    expect(pageSource).toContain("showConversationSelector={showConversationSelector}");
    expect(pageSource).toContain("<ChatSurface mode=\"embedded\" showConversationSelector={showConversationSelector} />");
    expect(activeRouteSource).toContain("interactor.getActiveForUser(userId)");
    expect(activeRouteSource).toContain("conversation: result.conversation");
    expect(activeRouteSource).toContain("messages: result.messages");
    expect(activeRouteSource).not.toContain("WorkspaceSnapshot");
    expect(restoreHookSource).toContain("dispatch({ type: \"REPLACE_ALL\", messages: result.payload.messages })");
  });

  it("freezes active job and browser-runtime recovery boundaries", () => {
    expect(getActiveJobStatuses()).toEqual(["queued", "running"]);
    expect(shouldStartBrowserRuntime(createCandidate(null))).toBe(true);
    expect(shouldStartBrowserRuntime(createCandidate("queued"))).toBe(true);
    expect(shouldStartBrowserRuntime(createCandidate("running"))).toBe(true);
    expect(shouldStartBrowserRuntime(createCandidate("succeeded"))).toBe(false);
    expect(shouldStartBrowserRuntime(createCandidate("failed"))).toBe(false);
    expect(shouldStartBrowserRuntime(createCandidate("canceled"))).toBe(false);
  });

  it("maps each evidence surface to real files and durable tables", () => {
    for (const surface of CONVERSATION_REFACTOR_PHASE_00_SURFACES) {
      expect(surface.files.length).toBeGreaterThan(0);
      expect(surface.tables.length).toBeGreaterThan(0);
      expect(surface.nextProof).not.toEqual("");

      for (const filePath of surface.files) {
        expect(fs.existsSync(path.join(process.cwd(), filePath)), `${surface.id} file missing: ${filePath}`).toBe(true);
      }

      for (const table of surface.tables) {
        expect(CONVERSATION_REFACTOR_CANONICAL_TABLES).toContain(table as typeof CONVERSATION_REFACTOR_CANONICAL_TABLES[number]);
      }
    }
  });
});
