import path from "node:path";

import {
  PHASE_11_TOOL_INVOCATION_DETERMINISTIC_SCENARIOS,
  PHASE_11_TOOL_INVOCATION_PASSING_RULES,
  writePhase11ToolInvocationEvidenceArtifact,
} from "../src/lib/evals/phase-11-tool-invocation-evidence";
import {
  formatQaCommand,
  hasHelpFlag,
  printUsage,
  runQaCommandSteps,
  tailCommandOutput,
  type QaCommandExecution,
  type QaCommandStep,
} from "./lib/qa-runner";

const ROOT = path.resolve(__dirname, "..");

const deterministicTestFiles = [
  "src/lib/chat/anthropic-stream.test.ts",
  "src/lib/media/media-asset-projection.test.ts",
  "src/lib/capabilities/external-target-adapters.test.ts",
  "src/lib/capabilities/mcp-process-runtime.test.ts",
  "src/core/capability-catalog/runtime-tool-binding.test.ts",
  "src/app/api/chat/uploads/route.test.ts",
  "src/app/api/runtime/generate-audio/route.test.ts",
  "src/lib/media/server/compose-media-plan-materialization.test.ts",
  "src/lib/media/server/compose-media-worker-runtime.test.ts",
  "src/lib/media/browser-runtime/ffmpeg-browser-executor.test.ts",
  "tests/chat/chat-stream-route.test.ts",
];

const liveMediaCommands = [
  {
    name: "media-live-workflows",
    command: "npm",
    args: ["run", "test:media-live"],
    enabled: process.env.ORDO_PHASE_11_LIVE_MEDIA === "1",
  },
  {
    name: "media-compose-eval",
    command: "npx",
    args: ["playwright", "test", "tests/browser-ui/media-compose-eval.spec.ts"],
    enabled: process.env.ORDO_PHASE_11_LIVE_MEDIA === "1",
  },
  {
    name: "media-compose-planner-eval",
    command: "npx",
    args: ["playwright", "test", "tests/browser-ui/media-compose-planner-eval.spec.ts"],
    enabled: process.env.ORDO_PHASE_11_LIVE_MEDIA === "1",
  },
];

type CommandEvidence = {
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
  status: "passed" | "failed" | "skipped";
  exitCode: number | null;
  stdoutTail?: string;
  stderrTail?: string;
};

function toCommandEvidence(result: QaCommandExecution): CommandEvidence {
  return {
    name: result.label,
    command: formatQaCommand(result.command, result.args),
    args: result.args,
    enabled: result.enabled,
    status: result.status,
    exitCode: result.exitCode,
    stdoutTail: tailCommandOutput(result.stdout),
    stderrTail: tailCommandOutput(result.stderr),
  };
}

async function main(): Promise<void> {
  if (hasHelpFlag()) {
    printUsage([
      "Usage: tsx scripts/run-phase-11-tool-invocation-qa.ts",
      "Runs deterministic Phase 11 tool-invocation/media-generation gates, optionally includes live media checks, and writes release/phase-11-tool-invocation-evidence.json.",
    ]);
    return;
  }

  const steps: QaCommandStep[] = [
    {
      label: "phase-11-deterministic-unit-integration",
      command: "npm",
      args: ["test", "--", ...deterministicTestFiles],
      cwd: ROOT,
      output: "capture",
    },
    ...liveMediaCommands.map((entry) => ({
      label: entry.name,
      command: entry.command,
      args: entry.args,
      enabled: entry.enabled,
      cwd: ROOT,
      output: "capture" as const,
    })),
  ];

  const commands = runQaCommandSteps(steps, { stopOnFailure: false }).map(toCommandEvidence);
  const { artifactPath } = writePhase11ToolInvocationEvidenceArtifact({
    releaseDir: path.join(ROOT, "release"),
    commands,
    deterministicScenarios: [...PHASE_11_TOOL_INVOCATION_DETERMINISTIC_SCENARIOS],
    passingRules: [...PHASE_11_TOOL_INVOCATION_PASSING_RULES],
    liveMediaEnabled: process.env.ORDO_PHASE_11_LIVE_MEDIA === "1",
  });

  const failed = commands.filter((command) => command.status === "failed");
  console.log(`Wrote ${path.relative(ROOT, artifactPath)}`);
  for (const command of commands) {
    console.log(`${command.status.toUpperCase()} ${command.name}`);
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  printUsage([
    "Usage: tsx scripts/run-phase-11-tool-invocation-qa.ts",
    "Runs deterministic Phase 11 tool-invocation/media-generation gates, optionally includes live media checks, and writes release/phase-11-tool-invocation-evidence.json.",
  ]);
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
