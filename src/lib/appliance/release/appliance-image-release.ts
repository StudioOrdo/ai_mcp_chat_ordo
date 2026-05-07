import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { runCommand } from "@/lib/appliance/verification/command-runner";
import type { CommandResult } from "@/lib/appliance/verification/lifecycle-types";
import { redactSecrets } from "@/lib/observability/secret-redaction";

export type ReleaseStatus = "passed" | "failed" | "environment_blocked" | "incomplete";
export type GateStatus = "passed" | "failed" | "skipped" | "environment_blocked";

export interface ApplianceImageReleaseGate {
  name: string;
  command: string;
  status: GateStatus;
  durationMs: number;
  summary: string;
  artifactPath?: string;
}

export interface ApplianceImageReleaseEvidence {
  phase: "05e-release-supply-chain-and-image-provenance";
  status: ReleaseStatus;
  generatedAt: string;
  git: {
    revision: string | null;
    branch: string | null;
    dirty: boolean;
  };
  toolchains: {
    node: string;
    npm: string | null;
    rustc: string | null;
    cargo: string | null;
    docker: string | null;
  };
  source: {
    packageLockSha256: string | null;
    cargoLockSha256: string | null;
    dockerfileSha256: string | null;
    rustToolchainSha256: string | null;
    composeSha256: string | null;
    hostedComposeSha256: string | null;
  };
  image: {
    tag: string;
    id: string | null;
    digest: string | null;
    baseImages: string[];
    sizeBytes: number | null;
    user: string | null;
    exposedPorts: string[];
    labels: Record<string, string>;
  };
  gates: ApplianceImageReleaseGate[];
  sbom: {
    tool: "syft" | "docker-sbom" | "docker-scout" | "unavailable";
    status: "generated" | "skipped" | "failed";
    artifactPath: string | null;
    summary: string;
  };
  vulnerabilityScan: {
    tool: "trivy" | "grype" | "docker-scout" | "unavailable";
    status: "passed" | "failed" | "skipped";
    artifactPath: string | null;
    critical: number | null;
    high: number | null;
    summary: string;
  };
  signing: {
    tool: "cosign" | "unavailable";
    status: "signed" | "skipped" | "failed";
    artifactPath: string | null;
    summary: string;
  };
  warnings: string[];
  blockers: string[];
}

export interface ApplianceImageReleaseOptions {
  allowMissingScanners?: boolean;
  fullTest?: boolean;
  keepImage?: boolean;
  sign?: boolean;
  skipSign?: boolean;
  tag?: string;
  outputDir?: string;
  now?: Date;
}

export interface ApplianceImageReleaseResult {
  evidence: ApplianceImageReleaseEvidence;
  evidencePaths: {
    jsonPath: string;
    markdownPath: string;
  };
}

const PHASE = "05e-release-supply-chain-and-image-provenance" as const;
const DEFAULT_OUTPUT_DIR = path.join(
  process.cwd(),
  "docs",
  "_refactor",
  "appliance-lifecycle-proof",
  "evidence",
);

const FOCUSED_IMAGE_TESTS = [
  "src/lib/appliance/native/native-command-contract.test.ts",
  "src/lib/appliance/native/native-result-reconciler.test.ts",
  "src/lib/appliance/native/native-binary-registry.test.ts",
  "tests/image-security-contract.test.ts",
  "tests/appliance-resource-contract.test.ts",
  "tests/hosted-network-contract.test.ts",
  "tests/image-runtime-bundle-contract.test.ts",
  "tests/docker-appliance-lifecycle.contract.test.ts",
  "tests/appliance-lifecycle-smoke.test.ts",
  "tests/release-manifest.test.ts",
];

export function planApplianceImageReleaseCommands(options: Pick<ApplianceImageReleaseOptions, "fullTest"> = {}) {
  const testArgs = options.fullTest ? ["run", "test"] : ["test", "--", ...FOCUSED_IMAGE_TESTS];
  return [
    { name: "native runtime check", command: "npm", args: ["run", "native:check"] },
    { name: "environment validation", command: "npm", args: ["run", "validate:env"] },
    { name: "tracked secret scan", command: "npm", args: ["run", "scan:secrets"] },
    { name: "typecheck", command: "npm", args: ["run", "typecheck"] },
    { name: options.fullTest ? "full test suite" : "focused image contract tests", command: "npm", args: testArgs },
    { name: "rust formatting", command: "cargo", args: ["fmt", "--check"] },
    { name: "rust tests", command: "cargo", args: ["test", "-p", "ordo-backup"] },
    { name: "rust clippy", command: "cargo", args: ["clippy", "-p", "ordo-backup", "--", "-D", "warnings"] },
    { name: "release manifest generation", command: "node", args: ["scripts/generate-release-manifest.mjs"] },
    { name: "release manifest verification", command: "npm", args: ["run", "release:verify"] },
    { name: "local compose services", command: "docker", args: ["compose", "config", "--services"] },
    { name: "hosted compose services", command: "docker", args: ["compose", "-f", "compose.hosted.yaml", "config", "--services"] },
  ];
}

export function classifyDockerFailure(output: string): "environment_blocked" | "failed" {
  const normalized = output.toLowerCase();
  const environmentPatterns = [
    "cannot connect to the docker daemon",
    "is the docker daemon running",
    "docker desktop",
    "no space left on device",
    "failed to solve",
    "network is unreachable",
    "temporary failure in name resolution",
    "permission denied",
    "connection refused",
  ];
  return environmentPatterns.some((pattern) => normalized.includes(pattern)) ? "environment_blocked" : "failed";
}

export function renderApplianceImageReleaseMarkdown(evidence: ApplianceImageReleaseEvidence): string {
  const safe = redactReleaseEvidence(evidence);
  const gateLines = safe.gates
    .map((gate) => `- ${gate.status.toUpperCase()} ${gate.name}: ${gate.summary} (${gate.durationMs}ms)`)
    .join("\n");
  return `# Phase 05E Evidence - Release Supply Chain And Image Provenance

Captured: ${safe.generatedAt}

Status: ${safe.status}

## Source

- Git revision: ${safe.git.revision ?? "unavailable"}
- Git branch: ${safe.git.branch ?? "unavailable"}
- Dirty worktree: ${safe.git.dirty ? "yes" : "no"}
- package-lock sha256: ${safe.source.packageLockSha256 ?? "missing"}
- Cargo.lock sha256: ${safe.source.cargoLockSha256 ?? "missing"}
- Dockerfile sha256: ${safe.source.dockerfileSha256 ?? "missing"}

## Toolchains

- Node: ${safe.toolchains.node}
- npm: ${safe.toolchains.npm ?? "unavailable"}
- rustc: ${safe.toolchains.rustc ?? "unavailable"}
- cargo: ${safe.toolchains.cargo ?? "unavailable"}
- Docker: ${safe.toolchains.docker ?? "unavailable"}

## Image

- Tag: ${safe.image.tag}
- ID: ${safe.image.id ?? "unavailable"}
- Digest: ${safe.image.digest ?? "unavailable"}
- Size bytes: ${safe.image.sizeBytes ?? "unavailable"}
- User: ${safe.image.user ?? "unavailable"}
- Exposed ports: ${safe.image.exposedPorts.length > 0 ? safe.image.exposedPorts.join(", ") : "none"}
- Base images: ${safe.image.baseImages.join(", ")}

## Gates

${gateLines || "- none"}

## SBOM

- Tool: ${safe.sbom.tool}
- Status: ${safe.sbom.status}
- Artifact: ${safe.sbom.artifactPath ?? "none"}
- Summary: ${safe.sbom.summary}

## Vulnerability Scan

- Tool: ${safe.vulnerabilityScan.tool}
- Status: ${safe.vulnerabilityScan.status}
- Critical: ${safe.vulnerabilityScan.critical ?? "unknown"}
- High: ${safe.vulnerabilityScan.high ?? "unknown"}
- Artifact: ${safe.vulnerabilityScan.artifactPath ?? "none"}
- Summary: ${safe.vulnerabilityScan.summary}

## Signing

- Tool: ${safe.signing.tool}
- Status: ${safe.signing.status}
- Artifact: ${safe.signing.artifactPath ?? "none"}
- Summary: ${safe.signing.summary}

## Warnings

${safe.warnings.length > 0 ? safe.warnings.map((warning) => `- ${redactReleaseString(warning)}`).join("\n") : "- none"}

## Blockers

${safe.blockers.length > 0 ? safe.blockers.map((blocker) => `- ${redactReleaseString(blocker)}`).join("\n") : "- none"}
`;
}

export async function runApplianceImageRelease(
  options: ApplianceImageReleaseOptions = {},
): Promise<ApplianceImageReleaseResult> {
  const generatedAt = (options.now ?? new Date()).toISOString();
  const warnings: string[] = [];
  const blockers: string[] = [];
  const gates: ApplianceImageReleaseGate[] = [];
  const tag = options.tag ?? process.env.APPLIANCE_RELEASE_IMAGE_TAG ?? await defaultImageTag();
  const metadata = await collectReleaseMetadata(tag);
  let image: ApplianceImageReleaseEvidence["image"] = metadata.image;
  let status: ReleaseStatus = "passed";
  let builtImage = false;

  try {
    for (const planned of planApplianceImageReleaseCommands({ fullTest: options.fullTest })) {
      if (planned.command === "docker") {
        const dockerAvailable = await commandAvailable("docker");
        if (!dockerAvailable) {
          const gate = skippedGate(planned.name, commandLabel(planned.command, planned.args), "Docker is unavailable.", "environment_blocked");
          gates.push(gate);
          blockers.push("Docker is unavailable.");
          status = "environment_blocked";
          break;
        }
      }

      const gate = await runGate(planned.name, planned.command, planned.args);
      gates.push(gate);
      if (gate.status !== "passed") {
        blockers.push(`${planned.name} failed: ${gate.summary}`);
        status = planned.command === "docker"
          ? classifyDockerFailure(gate.summary)
          : "failed";
        break;
      }
    }

    if (status === "passed") {
      const build = await runGate("Docker image build", "docker", ["build", "--target", "runner", "-t", tag, "."]);
      gates.push(build);
      if (build.status !== "passed") {
        blockers.push(`Docker image build failed: ${build.summary}`);
        status = classifyDockerFailure(`${build.summary}\n${build.command}`);
      } else {
        builtImage = true;
      }
    }

    if (status === "passed") {
      const inspect = await inspectImage(tag);
      image = inspect.image;
      gates.push(inspect.gate);
      if (inspect.gate.status !== "passed") {
        blockers.push(`Docker image inspect failed: ${inspect.gate.summary}`);
        status = "failed";
      }
    }

    if (status === "passed") {
      const assertion = await assertRunnerImage(tag);
      gates.push(assertion);
      if (assertion.status !== "passed") {
        blockers.push(`Runner image assertion failed: ${assertion.summary}`);
        status = "failed";
      }
    }

    const sbom = builtImage
      ? await generateSbom(tag, options.outputDir ?? DEFAULT_OUTPUT_DIR, options.allowMissingScanners === true, warnings, blockers)
      : unavailableSbom("Image was not built.");
    const vulnerabilityScan = builtImage
      ? await runVulnerabilityScan(tag, options.outputDir ?? DEFAULT_OUTPUT_DIR, options.allowMissingScanners === true, warnings, blockers)
      : unavailableVulnerabilityScan("Image was not built.");
    const signing = builtImage
      ? await runSigning(tag, options, warnings, blockers)
      : unavailableSigning("Image was not built.");

    if (status === "passed") {
      if (sbom.status !== "generated" || vulnerabilityScan.status === "skipped") {
        status = options.allowMissingScanners ? "passed" : "incomplete";
      }
      if (vulnerabilityScan.status === "failed" || signing.status === "failed") {
        status = "failed";
      }
      if (blockers.length > 0 && status === "passed") {
        status = "failed";
      }
    }

    const evidence = buildEvidence({
      generatedAt,
      status,
      metadata,
      image,
      gates,
      sbom,
      vulnerabilityScan,
      signing,
      warnings,
      blockers,
    });
    const evidencePaths = await writeApplianceImageReleaseEvidence(evidence, options.outputDir);
    return { evidence, evidencePaths };
  } finally {
    if (builtImage && !options.keepImage) {
      await runCommand("docker", ["rmi", tag], { timeoutMs: 120_000 });
    }
  }
}

async function collectReleaseMetadata(tag: string): Promise<{
  git: ApplianceImageReleaseEvidence["git"];
  toolchains: ApplianceImageReleaseEvidence["toolchains"];
  source: ApplianceImageReleaseEvidence["source"];
  image: ApplianceImageReleaseEvidence["image"];
}> {
  const [revision, branch, dirty, npm, rustc, cargo, docker] = await Promise.all([
    readCommandLine("git", ["rev-parse", "--short", "HEAD"]),
    readCommandLine("git", ["rev-parse", "--abbrev-ref", "HEAD"]),
    isWorktreeDirty(),
    readCommandLine("npm", ["--version"]),
    readCommandLine("rustc", ["--version"]),
    readCommandLine("cargo", ["--version"]),
    readCommandLine("docker", ["version", "--format", "{{.Server.Version}}"]),
  ]);
  return {
    git: {
      revision,
      branch,
      dirty,
    },
    toolchains: {
      node: process.version,
      npm,
      rustc,
      cargo,
      docker,
    },
    source: {
      packageLockSha256: hashFile("package-lock.json"),
      cargoLockSha256: hashFile("Cargo.lock"),
      dockerfileSha256: hashFile("Dockerfile"),
      rustToolchainSha256: hashFile("rust-toolchain.toml"),
      composeSha256: hashFile("compose.yaml"),
      hostedComposeSha256: hashFile("compose.hosted.yaml"),
    },
    image: {
      tag,
      id: null,
      digest: null,
      baseImages: readBaseImages(),
      sizeBytes: null,
      user: null,
      exposedPorts: [],
      labels: {},
    },
  };
}

function buildEvidence(input: {
  generatedAt: string;
  status: ReleaseStatus;
  metadata: Awaited<ReturnType<typeof collectReleaseMetadata>>;
  image: ApplianceImageReleaseEvidence["image"];
  gates: ApplianceImageReleaseGate[];
  sbom: ApplianceImageReleaseEvidence["sbom"];
  vulnerabilityScan: ApplianceImageReleaseEvidence["vulnerabilityScan"];
  signing: ApplianceImageReleaseEvidence["signing"];
  warnings: string[];
  blockers: string[];
}): ApplianceImageReleaseEvidence {
  const lockfileBlockers: string[] = [];
  if (!input.metadata.source.packageLockSha256) {
    lockfileBlockers.push("package-lock.json is missing.");
  }
  if (!input.metadata.source.cargoLockSha256) {
    lockfileBlockers.push("Cargo.lock is missing.");
  }
  return {
    phase: PHASE,
    status: lockfileBlockers.length > 0 && input.status === "passed" ? "failed" : input.status,
    generatedAt: input.generatedAt,
    git: input.metadata.git,
    toolchains: input.metadata.toolchains,
    source: input.metadata.source,
    image: input.image,
    gates: input.gates,
    sbom: input.sbom,
    vulnerabilityScan: input.vulnerabilityScan,
    signing: input.signing,
    warnings: [...input.warnings],
    blockers: [...input.blockers, ...lockfileBlockers],
  };
}

export async function writeApplianceImageReleaseEvidence(
  evidence: ApplianceImageReleaseEvidence,
  outputDir = DEFAULT_OUTPUT_DIR,
): Promise<{ jsonPath: string; markdownPath: string }> {
  await mkdir(outputDir, { recursive: true });
  const stamp = evidence.generatedAt.slice(0, 10);
  const base = `05e-release-supply-chain-and-image-provenance-${stamp}`;
  const jsonPath = path.join(outputDir, `${base}.json`);
  const markdownPath = path.join(outputDir, `${base}.md`);
  await writeFile(jsonPath, `${JSON.stringify(redactReleaseEvidence(evidence), null, 2)}\n`, "utf-8");
  await writeFile(markdownPath, renderApplianceImageReleaseMarkdown(evidence), "utf-8");
  return { jsonPath, markdownPath };
}

async function runGate(name: string, command: string, args: string[], timeoutMs = 900_000): Promise<ApplianceImageReleaseGate> {
  const result = await runCommand(command, args, { timeoutMs });
  return commandResultToGate(name, result);
}

export function commandResultToGate(name: string, result: CommandResult): ApplianceImageReleaseGate {
  const summary = summarizeCommandResult(result);
  return {
    name,
    command: commandLabel(result.command, result.args),
    status: result.status === 0 ? "passed" : "failed",
    durationMs: result.durationMs,
    summary,
  };
}

function skippedGate(name: string, command: string, summary: string, status: GateStatus = "skipped"): ApplianceImageReleaseGate {
  return {
    name,
    command,
    status,
    durationMs: 0,
    summary,
  };
}

function commandLabel(command: string, args: string[]) {
  return [command, ...args].join(" ");
}

function summarizeCommandResult(result: CommandResult): string {
  const raw = result.status === 0
    ? result.stdout.trim() || "completed"
    : result.stderr.trim() || result.stdout.trim() || `exited with status ${result.status}`;
  return sanitizeSummary(raw);
}

function sanitizeSummary(value: string) {
  const redacted = redactReleaseString(value);
  return redacted
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-8)
    .join(" ")
    .slice(0, 1200);
}

function redactReleaseEvidence(evidence: ApplianceImageReleaseEvidence): ApplianceImageReleaseEvidence {
  return redactSecrets(evidence).value;
}

function redactReleaseString(value: string): string {
  const recursivelyRedacted = redactSecrets(value).value;
  return recursivelyRedacted
    .replace(/\/Users\/[^\s"'`)]+/g, "[path]")
    .replace(/\/private\/[^\s"'`)]+/g, "[path]")
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/sk-proj-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/(ANTHROPIC_API_KEY|OPENAI_API_KEY|DEEPSEEK_API_KEY|ORDO_INSTALL_TOKEN)\s*=\s*\S+/g, "$1=[redacted]");
}

function hashFile(relativePath: string): string | null {
  const filePath = path.join(process.cwd(), relativePath);
  if (!existsSync(filePath)) {
    return null;
  }
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function readBaseImages(): string[] {
  const dockerfile = readFileSync(path.join(process.cwd(), "Dockerfile"), "utf-8");
  return dockerfile
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("FROM "))
    .map((line) => line.replace(/^FROM\s+/, ""));
}

async function defaultImageTag() {
  const revision = await readCommandLine("git", ["rev-parse", "--short", "HEAD"]);
  const suffix = revision ?? new Date().toISOString().slice(0, 10);
  return `studioordo:05e-${suffix}`;
}

async function readCommandLine(command: string, args: string[]): Promise<string | null> {
  const result = await runCommand(command, args, { timeoutMs: 30_000 });
  return result.status === 0 ? result.stdout.trim() || null : null;
}

async function isWorktreeDirty(): Promise<boolean> {
  const result = await runCommand("git", ["status", "--porcelain"], { timeoutMs: 30_000 });
  return result.status === 0 && result.stdout.trim().length > 0;
}

async function commandAvailable(command: string, args: string[] = ["--version"]): Promise<boolean> {
  const result = await runCommand(command, args, { timeoutMs: 30_000 });
  return result.status === 0;
}

async function inspectImage(tag: string): Promise<{ image: ApplianceImageReleaseEvidence["image"]; gate: ApplianceImageReleaseGate }> {
  const result = await runCommand("docker", ["image", "inspect", tag], { timeoutMs: 60_000 });
  const gate = commandResultToGate("Docker image inspect", result);
  if (result.status !== 0) {
    return {
      image: {
        tag,
        id: null,
        digest: null,
        baseImages: readBaseImages(),
        sizeBytes: null,
        user: null,
        exposedPorts: [],
        labels: {},
      },
      gate,
    };
  }
  const parsed = JSON.parse(result.stdout) as Array<{
    Id?: string;
    RepoDigests?: string[];
    Size?: number;
    Config?: {
      User?: string;
      ExposedPorts?: Record<string, unknown>;
      Labels?: Record<string, string>;
    };
  }>;
  const first = parsed[0] ?? {};
  gate.summary = "image metadata captured";
  return {
    image: {
      tag,
      id: first.Id ?? null,
      digest: first.RepoDigests?.[0] ?? null,
      baseImages: readBaseImages(),
      sizeBytes: typeof first.Size === "number" ? first.Size : null,
      user: first.Config?.User ?? null,
      exposedPorts: Object.keys(first.Config?.ExposedPorts ?? {}),
      labels: first.Config?.Labels ?? {},
    },
    gate,
  };
}

async function assertRunnerImage(tag: string): Promise<ApplianceImageReleaseGate> {
  const script = [
    "set -eu",
    "test -x /app/bin/ordo-backup",
    "test -d /app/docs/_corpus",
    "test -f /app/release/manifest.json",
    "test ! -e /app/docs/_refactor",
    "test ! -e /app/docs/_review",
    "env | grep -E '^(ANTHROPIC_API_KEY|OPENAI_API_KEY|DEEPSEEK_API_KEY|ORDO_INSTALL_TOKEN)=' && exit 1 || true",
    "echo runner-image-ok",
  ].join("; ");
  const result = await runCommand("docker", ["run", "--rm", "--entrypoint", "sh", tag, "-lc", script], {
    timeoutMs: 120_000,
  });
  return commandResultToGate("runner image content assertion", result);
}

async function generateSbom(
  tag: string,
  outputDir: string,
  allowMissingScanners: boolean,
  warnings: string[],
  blockers: string[],
): Promise<ApplianceImageReleaseEvidence["sbom"]> {
  await mkdir(outputDir, { recursive: true });
  const syftAvailable = await commandAvailable("syft");
  if (syftAvailable) {
    const artifactPath = path.join(outputDir, "05e-sbom.syft.json");
    const result = await runCommand("syft", [tag, "-o", `json=${artifactPath}`], { timeoutMs: 300_000 });
    if (result.status === 0) {
      return { tool: "syft", status: "generated", artifactPath, summary: "SBOM generated with syft." };
    }
    blockers.push(`SBOM generation failed: ${summarizeCommandResult(result)}`);
    return { tool: "syft", status: "failed", artifactPath, summary: summarizeCommandResult(result) };
  }
  const summary = "No supported SBOM tool was available.";
  if (allowMissingScanners) {
    warnings.push(summary);
  } else {
    blockers.push(summary);
  }
  return { tool: "unavailable", status: "skipped", artifactPath: null, summary };
}

async function runVulnerabilityScan(
  tag: string,
  outputDir: string,
  allowMissingScanners: boolean,
  warnings: string[],
  blockers: string[],
): Promise<ApplianceImageReleaseEvidence["vulnerabilityScan"]> {
  await mkdir(outputDir, { recursive: true });
  if (await commandAvailable("trivy")) {
    return runTrivyScan(tag, outputDir, blockers);
  }
  if (await commandAvailable("grype")) {
    return runGrypeScan(tag, outputDir, blockers);
  }
  const summary = "No supported vulnerability scanner was available.";
  if (allowMissingScanners) {
    warnings.push(summary);
  } else {
    blockers.push(summary);
  }
  return { tool: "unavailable", status: "skipped", artifactPath: null, critical: null, high: null, summary };
}

async function runTrivyScan(
  tag: string,
  outputDir: string,
  blockers: string[],
): Promise<ApplianceImageReleaseEvidence["vulnerabilityScan"]> {
  const artifactPath = path.join(outputDir, "05e-vulnerability-scan.trivy.json");
  const result = await runCommand("trivy", ["image", "--format", "json", "--output", artifactPath, tag], {
    timeoutMs: 600_000,
  });
  if (result.status !== 0) {
    const summary = summarizeCommandResult(result);
    blockers.push(`Trivy scan failed: ${summary}`);
    return { tool: "trivy", status: "failed", artifactPath, critical: null, high: null, summary };
  }
  const counts = countTrivyVulnerabilities(artifactPath);
  const summary = `critical=${counts.critical} high=${counts.high}`;
  if (counts.critical > 0 || counts.high > 0) {
    blockers.push(`Vulnerability scan found ${summary}.`);
    return { tool: "trivy", status: "failed", artifactPath, critical: counts.critical, high: counts.high, summary };
  }
  return { tool: "trivy", status: "passed", artifactPath, critical: 0, high: 0, summary };
}

async function runGrypeScan(
  tag: string,
  outputDir: string,
  blockers: string[],
): Promise<ApplianceImageReleaseEvidence["vulnerabilityScan"]> {
  const artifactPath = path.join(outputDir, "05e-vulnerability-scan.grype.json");
  const result = await runCommand("grype", [tag, "-o", "json", "--file", artifactPath], {
    timeoutMs: 600_000,
  });
  if (result.status !== 0) {
    const summary = summarizeCommandResult(result);
    blockers.push(`Grype scan failed: ${summary}`);
    return { tool: "grype", status: "failed", artifactPath, critical: null, high: null, summary };
  }
  const counts = countGrypeVulnerabilities(artifactPath);
  const summary = `critical=${counts.critical} high=${counts.high}`;
  if (counts.critical > 0 || counts.high > 0) {
    blockers.push(`Vulnerability scan found ${summary}.`);
    return { tool: "grype", status: "failed", artifactPath, critical: counts.critical, high: counts.high, summary };
  }
  return { tool: "grype", status: "passed", artifactPath, critical: 0, high: 0, summary };
}

function countTrivyVulnerabilities(artifactPath: string) {
  const parsed = JSON.parse(readFileSync(artifactPath, "utf-8")) as {
    Results?: Array<{ Vulnerabilities?: Array<{ Severity?: string }> }>;
  };
  return countSeverities(parsed.Results?.flatMap((result) => result.Vulnerabilities ?? []) ?? []);
}

function countGrypeVulnerabilities(artifactPath: string) {
  const parsed = JSON.parse(readFileSync(artifactPath, "utf-8")) as {
    matches?: Array<{ vulnerability?: { severity?: string } }>;
  };
  return countSeverities((parsed.matches ?? []).map((match) => ({ Severity: match.vulnerability?.severity })));
}

function countSeverities(values: Array<{ Severity?: string }>) {
  let critical = 0;
  let high = 0;
  for (const value of values) {
    const severity = value.Severity?.toLowerCase();
    if (severity === "critical") {
      critical += 1;
    }
    if (severity === "high") {
      high += 1;
    }
  }
  return { critical, high };
}

async function runSigning(
  tag: string,
  options: ApplianceImageReleaseOptions,
  warnings: string[],
  blockers: string[],
): Promise<ApplianceImageReleaseEvidence["signing"]> {
  if (!options.sign || options.skipSign) {
    return { tool: "unavailable", status: "skipped", artifactPath: null, summary: "Signing skipped." };
  }
  if (!await commandAvailable("cosign")) {
    const summary = "Cosign was requested but is unavailable.";
    blockers.push(summary);
    return { tool: "unavailable", status: "failed", artifactPath: null, summary };
  }
  warnings.push(`Cosign is available, but automatic signing is not wired for local tag ${tag}.`);
  return { tool: "cosign", status: "skipped", artifactPath: null, summary: "Cosign available; signing deferred to registry digest workflow." };
}

function unavailableSbom(summary: string): ApplianceImageReleaseEvidence["sbom"] {
  return { tool: "unavailable", status: "skipped", artifactPath: null, summary };
}

function unavailableVulnerabilityScan(summary: string): ApplianceImageReleaseEvidence["vulnerabilityScan"] {
  return { tool: "unavailable", status: "skipped", artifactPath: null, critical: null, high: null, summary };
}

function unavailableSigning(summary: string): ApplianceImageReleaseEvidence["signing"] {
  return { tool: "unavailable", status: "skipped", artifactPath: null, summary };
}
