import fs from "node:fs";
import path from "node:path";

export const PHASE_11_TOOL_INVOCATION_PHASE = "phase-11-tool-invocation-identity-and-media-generation-gates" as const;
export const PHASE_11_TOOL_INVOCATION_DETERMINISTIC_STEP = "phase-11-deterministic-unit-integration" as const;

export interface Phase11ToolInvocationCommandEvidence {
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
  status: "passed" | "failed" | "skipped";
  exitCode: number | null;
  stdoutTail?: string;
  stderrTail?: string;
}

export interface Phase11ToolInvocationQaEvidence {
  schemaVersion: 1;
  generatedAt: string;
  phase: typeof PHASE_11_TOOL_INVOCATION_PHASE;
  deterministicScenarios: string[];
  passingRules: string[];
  liveMediaEnabled: boolean;
  commands: Phase11ToolInvocationCommandEvidence[];
}

export interface WritePhase11ToolInvocationEvidenceOptions {
  releaseDir?: string;
  commands: Phase11ToolInvocationCommandEvidence[];
  deterministicScenarios?: string[];
  passingRules?: string[];
  liveMediaEnabled?: boolean;
  now?: Date;
}

export const PHASE_11_TOOL_INVOCATION_DETERMINISTIC_SCENARIOS = [
  "tool-invocation-id-preserved-through-stream",
  "duplicate-tool-result-same-invocation-suppressed",
  "same-payload-different-invocation-preserved",
  "media-chart-requires-rasterized-image-before-compose",
  "media-graph-requires-rasterized-image-before-compose",
  "media-compose-does-not-narrate-running-before-preflight",
  "media-compose-reuses-governed-assets-only",
  "execution-target-audit-context-preserves-tool-invocation-id",
] as const;

export const PHASE_11_TOOL_INVOCATION_PASSING_RULES = [
  "no duplicate visible tool result for the same toolInvocationId",
  "no duplicate transcript tool result for the same toolInvocationId",
  "no duplicate browser-runtime candidate for the same toolInvocationId",
  "every media output used in composition is a governed asset of the correct kind",
  "every video eval proves playable video when live media gates are enabled",
  "every audio-required video eval proves audio presence when live media gates are enabled",
  "assistant copy never claims completed or running video before the runtime state supports it",
  "execution target audit metadata carries the originating toolInvocationId when bridged execution context is present",
] as const;

function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function createPhase11ToolInvocationEvidence(
  options: WritePhase11ToolInvocationEvidenceOptions,
): Phase11ToolInvocationQaEvidence {
  return {
    schemaVersion: 1,
    generatedAt: (options.now ?? new Date()).toISOString(),
    phase: PHASE_11_TOOL_INVOCATION_PHASE,
    deterministicScenarios: [
      ...(options.deterministicScenarios ?? PHASE_11_TOOL_INVOCATION_DETERMINISTIC_SCENARIOS),
    ],
    passingRules: [
      ...(options.passingRules ?? PHASE_11_TOOL_INVOCATION_PASSING_RULES),
    ],
    liveMediaEnabled: options.liveMediaEnabled ?? false,
    commands: options.commands.map((command) => ({
      ...command,
      args: [...command.args],
    })),
  };
}

export function validatePhase11ToolInvocationEvidence(
  evidence: Phase11ToolInvocationQaEvidence,
): string[] {
  const errors: string[] = [];
  const deterministicStep = evidence.commands.find(
    (command) => command.name === PHASE_11_TOOL_INVOCATION_DETERMINISTIC_STEP,
  );

  if (!deterministicStep) {
    errors.push("Phase 11 tool invocation QA is missing the deterministic gate step.");
  } else if (deterministicStep.status !== "passed") {
    errors.push("Phase 11 tool invocation QA deterministic gate failed.");
  }

  if (evidence.commands.some((command) => command.status === "failed")) {
    errors.push("Phase 11 tool invocation QA contains failed commands.");
  }

  return errors;
}

export function readPhase11ToolInvocationEvidenceFromFile(
  filePath: string,
): Phase11ToolInvocationQaEvidence | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Phase11ToolInvocationQaEvidence;
}

export function writePhase11ToolInvocationEvidenceArtifact(
  options: WritePhase11ToolInvocationEvidenceOptions,
): { artifactPath: string; evidence: Phase11ToolInvocationQaEvidence } {
  const releaseDir = options.releaseDir ?? path.join(process.cwd(), "release");
  const artifactPath = path.join(releaseDir, "phase-11-tool-invocation-evidence.json");
  const evidence = createPhase11ToolInvocationEvidence(options);

  fs.mkdirSync(releaseDir, { recursive: true });
  fs.writeFileSync(artifactPath, serializeJson(evidence), "utf8");

  return {
    artifactPath,
    evidence,
  };
}