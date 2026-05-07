import { describe, expect, it } from "vitest";
import {
  classifyDockerFailure,
  commandResultToGate,
  planApplianceImageReleaseCommands,
  renderApplianceImageReleaseMarkdown,
  type ApplianceImageReleaseEvidence,
} from "./appliance-image-release";

describe("appliance image release gate", () => {
  it("plans the focused image contract tests by default", () => {
    const commands = planApplianceImageReleaseCommands();
    const testCommand = commands.find((command) => command.name === "focused image contract tests");

    expect(testCommand?.command).toBe("npm");
    expect(testCommand?.args).toContain("tests/image-security-contract.test.ts");
    expect(testCommand?.args).toContain("tests/image-runtime-bundle-contract.test.ts");
    expect(testCommand?.args).not.toEqual(["run", "test"]);
  });

  it("plans the full test suite only when requested", () => {
    const commands = planApplianceImageReleaseCommands({ fullTest: true });
    expect(commands.find((command) => command.name === "full test suite")?.args).toEqual(["run", "test"]);
  });

  it("classifies Docker environment failures separately from product failures", () => {
    expect(classifyDockerFailure("Cannot connect to the Docker daemon")).toBe("environment_blocked");
    expect(classifyDockerFailure("no space left on device")).toBe("environment_blocked");
    expect(classifyDockerFailure("RUN npm run build failed")).toBe("failed");
  });

  it("renders evidence without raw secret-like values", () => {
    const markdown = renderApplianceImageReleaseMarkdown(sampleEvidence({
      warnings: ["authorization bearer abc123 should disappear"],
      blockers: ["ANTHROPIC_API_KEY=sk-ant-test should disappear"],
    }));

    expect(markdown).toContain("Status: passed");
    expect(markdown).toContain("Image");
    expect(markdown).not.toContain("sk-ant-test");
    expect(markdown).not.toContain("bearer abc123");
  });

  it("normalizes command results into gate records", () => {
    const gate = commandResultToGate("test gate", {
      command: "npm",
      args: ["run", "scan:secrets"],
      status: 1,
      stdout: "",
      stderr: "Potential secret ANTHROPIC_API_KEY=sk-ant-test",
      durationMs: 42,
    });

    expect(gate.status).toBe("failed");
    expect(gate.command).toBe("npm run scan:secrets");
    expect(gate.summary).not.toContain("sk-ant-test");
  });
});

function sampleEvidence(overrides: Partial<Pick<ApplianceImageReleaseEvidence, "warnings" | "blockers">> = {}): ApplianceImageReleaseEvidence {
  return {
    phase: "05e-release-supply-chain-and-image-provenance",
    status: "passed",
    generatedAt: "2026-05-03T00:00:00.000Z",
    git: { revision: "abc123", branch: "main", dirty: false },
    toolchains: { node: "v22.22.2", npm: "10.0.0", rustc: "rustc 1.81.0", cargo: "cargo 1.81.0", docker: "26.0.0" },
    source: {
      packageLockSha256: "a".repeat(64),
      cargoLockSha256: "b".repeat(64),
      dockerfileSha256: "c".repeat(64),
      rustToolchainSha256: "d".repeat(64),
      composeSha256: "e".repeat(64),
      hostedComposeSha256: "f".repeat(64),
    },
    image: {
      tag: "studioordo:test",
      id: "sha256:abc",
      digest: "repo@sha256:def",
      baseImages: ["node:${NODE_VERSION}-alpine AS runner"],
      sizeBytes: 123,
      user: "nextjs",
      exposedPorts: ["3000/tcp"],
      labels: {},
    },
    gates: [{ name: "gate", command: "true", status: "passed", durationMs: 1, summary: "ok" }],
    sbom: { tool: "unavailable", status: "skipped", artifactPath: null, summary: "skipped" },
    vulnerabilityScan: { tool: "unavailable", status: "skipped", artifactPath: null, critical: null, high: null, summary: "skipped" },
    signing: { tool: "unavailable", status: "skipped", artifactPath: null, summary: "skipped" },
    warnings: overrides.warnings ?? [],
    blockers: overrides.blockers ?? [],
  };
}
