import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createRuntimeIntegrityQaEvidence,
  createRuntimeInventory,
  RUNTIME_INTEGRITY_BROWSER_PROOF_SPECS,
  RUNTIME_INTEGRITY_FOCUSED_TEST_SUITES,
  RUNTIME_INTEGRITY_GOVERNED_DELIVERY_ROUTES,
  writeRuntimeIntegrityQaEvidenceArtifact,
} from "@/lib/evals/runtime-integrity-evidence";
import { createEliteOpsEvidence } from "@/lib/evals/elite-ops-evidence";
import type { EliteOpsEvidence } from "@/lib/evals/elite-ops-evidence";

const NOW = new Date("2026-04-08T12:00:00.000Z");
const INVENTORY = createRuntimeInventory(NOW);
const ELITE_OPS = createEliteOpsEvidence({
  inventoryMcpProcesses: INVENTORY.mcp.processes.map((process) => ({
    id: process.id,
    serverName: process.serverName,
    entrypoint: process.entrypoint,
    canonicalCommand: process.canonicalCommand,
    compatibilityAliases: [...process.compatibilityAliases],
    capabilityGroups: [...process.capabilityGroups],
  })),
  now: NOW,
});

describe("runtime integrity evidence", () => {
  it("builds a generated runtime inventory from live corpus, tool, and route sources", () => {
    const inventory = INVENTORY;

    expect(inventory.corpus.documentCount).toBe(11);
    expect(inventory.corpus.sectionCount).toBe(93);
    expect(inventory.tools.countsByRole.ADMIN).toBeGreaterThan(inventory.tools.countsByRole.ANONYMOUS);
    expect(inventory.tools.manifestsByRole.ANONYMOUS.map((entry) => entry.name)).toContain("navigate_to_page");
    expect(inventory.tools.manifestsByRole.ANONYMOUS.map((entry) => entry.name)).not.toContain("navigate");
    expect(inventory.navigation.routesByRole.ANONYMOUS.some((route) => route.href === "/library")).toBe(true);
    expect(inventory.navigation.routesByRole.AUTHENTICATED.some((route) => route.href === "/my/media")).toBe(true);
    expect(inventory.navigation.routesByRole.STAFF.some((route) => route.href === "/operations/media")).toBe(true);
    expect(inventory.mcp.processCount).toBe(4);
    expect(inventory.mcp.processes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "admin-web-search",
          serverName: "admin-web-search-mcp-server",
          entrypoint: "mcp/admin-web-search-server.ts",
          canonicalCommand: "npm run mcp:admin-web-search",
        }),
        expect.objectContaining({
          id: "calculator",
          serverName: "calculator-mcp-server",
          canonicalCommand: "npm run mcp:calculator",
        }),
        expect.objectContaining({
          id: "generate-audio",
          serverName: "generate-audio-mcp-server",
          entrypoint: "mcp/generate-audio-server.ts",
          canonicalCommand: "npm run mcp:generate-audio",
        }),
        expect.objectContaining({
          id: "operations",
          serverName: "operations-mcp-server",
          entrypoint: "mcp/operations-server.ts",
          canonicalCommand: "npm run mcp:operations",
          compatibilityAliases: [],
        }),
      ]),
    );
  });

  it("marks the QA evidence failed when any step failed", () => {
    const passingEliteOps: EliteOpsEvidence = {
      ...ELITE_OPS,
      status: "passed",
      blockingReasons: [],
      architectureDrift: {
        ...ELITE_OPS.architectureDrift,
        status: "passed",
        blockingReasons: [],
      },
      rbacMatrix: {
        ...ELITE_OPS.rbacMatrix,
        status: "passed",
        blockingReasons: [],
      },
      latencyBudgets: {
        ...ELITE_OPS.latencyBudgets,
        status: "passed",
        blockingReasons: [],
      },
      failureModes: {
        ...ELITE_OPS.failureModes,
        status: "passed",
        blockingReasons: [],
      },
    };

    const evidence = createRuntimeIntegrityQaEvidence({
      now: NOW,
      inventory: INVENTORY,
      eliteOps: passingEliteOps,
      steps: [
        { label: "integrity eval suites", command: "npm exec vitest run", status: "failed" },
      ],
    });

    expect(evidence.status).toBe("failed");
    expect(evidence.review.blockingReasons).toContain("QA step failed: integrity eval suites.");
    expect(evidence.eliteOps.status).toBe("passed");
  });

  it("writes the runtime integrity evidence artifact", () => {
    const releaseDir = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-integrity-"));
    const { artifactPath, evidence } = writeRuntimeIntegrityQaEvidenceArtifact({
      releaseDir,
      now: NOW,
      steps: [
        { label: "integrity eval suites", command: "npm exec vitest run", status: "passed" },
        { label: "production build", command: "npm run build", status: "passed" },
      ],
    });

    expect(fs.existsSync(artifactPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(artifactPath, "utf8"))).toEqual(evidence);
    expect(evidence.inventory.mcp.processCount).toBe(4);
    expect(evidence.coverage.focusedTestSuites).toEqual(expect.arrayContaining([
      "src/hooks/chat/useBrowserCapabilityRuntime.test.tsx",
      "src/app/api/chat/uploads/route.test.ts",
      "src/app/api/user-files/[id]/route.test.ts",
      "src/app/my/media/page.test.tsx",
      "src/app/operations/media/page.test.tsx",
    ]));
    expect(evidence.coverage.focusedTestSuites).toEqual(expect.arrayContaining([...RUNTIME_INTEGRITY_FOCUSED_TEST_SUITES]));
    expect(evidence.coverage.browserProofSpecs).toEqual([...RUNTIME_INTEGRITY_BROWSER_PROOF_SPECS]);
    expect(evidence.coverage.governedDeliveryRoutes).toEqual([...RUNTIME_INTEGRITY_GOVERNED_DELIVERY_ROUTES]);
    expect(evidence.coverage.notes).toEqual(expect.arrayContaining([
      expect.stringContaining("Phase 6 media hardening"),
      expect.stringContaining("Browser proof remains a distinct release input"),
    ]));
    const regeneratedEliteOps = createEliteOpsEvidence({
      inventoryMcpProcesses: evidence.inventory.mcp.processes.map((process) => ({
        id: process.id,
        serverName: process.serverName,
        entrypoint: process.entrypoint,
        canonicalCommand: process.canonicalCommand,
        compatibilityAliases: [...process.compatibilityAliases],
        capabilityGroups: [...process.capabilityGroups],
      })),
      now: NOW,
    });

    expect(evidence.eliteOps.status).toBe(regeneratedEliteOps.status);
    expect(evidence.eliteOps.architectureDrift.status).toBe(regeneratedEliteOps.architectureDrift.status);
    expect(evidence.eliteOps.rbacMatrix.summary).toEqual(regeneratedEliteOps.rbacMatrix.summary);
    expect(evidence.eliteOps.latencyBudgets.status).toBe(regeneratedEliteOps.latencyBudgets.status);
    expect(evidence.eliteOps.failureModes.probes.map((probe) => probe.id)).toEqual(
      regeneratedEliteOps.failureModes.probes.map((probe) => probe.id),
    );
  });
});