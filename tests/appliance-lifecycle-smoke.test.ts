import { describe, expect, it, vi } from "vitest";
import { renderEvidenceMarkdown, redactPathLabel, hashPrefix } from "@/lib/appliance/verification/lifecycle-evidence";
import type { LifecycleSmokeEvidence } from "@/lib/appliance/verification/lifecycle-types";

describe("appliance lifecycle smoke evidence", () => {
  it("redacts filesystem paths to labels and hash prefixes", () => {
    expect(redactPathLabel("/private/tmp/ordo-appliance-smoke-123/.data")).toBe(".data");
    expect(hashPrefix(`sha256:${"a".repeat(64)}`)).toBe("sha256:aaaaaaaaaaaaa");
  });

  it("renders redacted phase evidence without raw secret material", () => {
    const evidence: LifecycleSmokeEvidence = {
      phase: "05-docker-and-worker-verification-harness",
      mode: "local",
      status: "passed",
      startedAt: "2026-05-03T00:00:00.000Z",
      completedAt: "2026-05-03T00:00:01.000Z",
      durationMs: 1000,
      nodeVersion: "v22.22.2",
      rustVersion: "rustc 1.0.0",
      imageTag: null,
      gitRevision: "abc123",
      dataDirLabel: ".data",
      appPort: null,
      mediaPort: null,
      executorPath: "bin/ordo-backup",
      health: { status: "healthy", summary: { healthy: 1, degraded: 0, blocked: 0, disabled: 0, unknown: 0 }, warnings: [] },
      backup: {
        manualBackupId: "backup_manual",
        scheduledBackupId: "backup_scheduled",
        archiveSizeBytes: 10,
        archiveHashPrefix: "sha256:abc",
      },
      restore: { restorePlanId: "restore_1", restoredSeedFile: true },
      scheduler: { commandId: "syscmd_1", decision: "enqueue" },
      restart: { verified: true },
      steps: [{
        name: "prepare",
        status: "passed",
        startedAt: "2026-05-03T00:00:00.000Z",
        completedAt: "2026-05-03T00:00:01.000Z",
        durationMs: 1000,
        summary: "completed",
      }],
      warnings: [],
    };

    const markdown = renderEvidenceMarkdown(evidence);

    expect(markdown).toContain("Phase 05 Evidence");
    expect(markdown).toContain("Manual backup: backup_manual");
    expect(markdown).not.toContain("ANTHROPIC_API_KEY");
    expect(markdown).not.toContain("/Users/");
  });

  it("keeps the lifecycle smoke CLI explicit about supported modes", async () => {
    const script = await import("node:fs/promises").then((fs) => fs.readFile("scripts/run-appliance-lifecycle-smoke.ts", "utf-8"));

    expect(script).toContain('"local"');
    expect(script).toContain('"docker"');
    expect(script).toContain('"compose-single-image"');
    expect(script).toContain("APPLIANCE_SMOKE_MODE");
    vi.restoreAllMocks();
  });
});
