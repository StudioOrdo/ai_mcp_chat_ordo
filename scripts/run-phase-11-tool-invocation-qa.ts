import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const RELEASE_DIR = path.join(ROOT, "release");
const EVIDENCE_PATH = path.join(RELEASE_DIR, "phase-11-tool-invocation-evidence.json");

const deterministicTestFiles = [
  "src/lib/chat/anthropic-stream.test.ts",
  "src/lib/media/media-asset-projection.test.ts",
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

function tail(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.split("\n").slice(-80).join("\n").trim() || undefined;
}

function runCommand(name: string, command: string, args: string[], enabled = true): CommandEvidence {
  if (!enabled) {
    return { name, command, args, enabled, status: "skipped", exitCode: null };
  }

  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  return {
    name,
    command,
    args,
    enabled,
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  };
}

const commands: CommandEvidence[] = [
  runCommand("phase-11-deterministic-unit-integration", "npm", ["test", "--", ...deterministicTestFiles]),
  ...liveMediaCommands.map((entry) => runCommand(entry.name, entry.command, entry.args, entry.enabled)),
];

const deterministicScenarios = [
  "tool-invocation-id-preserved-through-stream",
  "duplicate-tool-result-same-invocation-suppressed",
  "same-payload-different-invocation-preserved",
  "media-chart-requires-rasterized-image-before-compose",
  "media-graph-requires-rasterized-image-before-compose",
  "media-compose-does-not-narrate-running-before-preflight",
  "media-compose-reuses-governed-assets-only",
];

const passingRules = [
  "no duplicate visible tool result for the same toolInvocationId",
  "no duplicate transcript tool result for the same toolInvocationId",
  "no duplicate browser-runtime candidate for the same toolInvocationId",
  "every media output used in composition is a governed asset of the correct kind",
  "every video eval proves playable video when live media gates are enabled",
  "every audio-required video eval proves audio presence when live media gates are enabled",
  "assistant copy never claims completed or running video before the runtime state supports it",
];

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  phase: "phase-11-tool-invocation-identity-and-media-generation-gates",
  deterministicScenarios,
  passingRules,
  liveMediaEnabled: process.env.ORDO_PHASE_11_LIVE_MEDIA === "1",
  commands,
};

fs.mkdirSync(RELEASE_DIR, { recursive: true });
fs.writeFileSync(EVIDENCE_PATH, JSON.stringify(evidence, null, 2));

const failed = commands.filter((command) => command.status === "failed");
console.log(`Wrote ${path.relative(ROOT, EVIDENCE_PATH)}`);
for (const command of commands) {
  console.log(`${command.status.toUpperCase()} ${command.name}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
