#!/usr/bin/env tsx
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RELEASE_DIR = path.join(ROOT, "release");
const EVIDENCE_PATH = path.join(RELEASE_DIR, "phase-9-media-runtime-evidence.json");
const CURRENT_NODE_BIN_DIR = path.dirname(process.execPath);

const deterministicCommands = [
  {
    name: "phase-9-shared-materialization-tests",
    command: "npm",
    args: [
      "run",
      "test",
      "--",
      "src/lib/media/server/compose-media-plan-materialization.test.ts",
      "src/lib/media/server/compose-media-worker-runtime.test.ts",
      "src/lib/media/ffmpeg/media-composition-plan.test.ts",
    ],
  },
  {
    name: "phase-9-phase-7-deterministic-regression",
    command: "node_modules/.bin/tsx",
    args: ["scripts/run-sprint-7-qa.ts", "--tests-only"],
  },
  {
    name: "phase-9-build-verification",
    command: "node_modules/.bin/next",
    args: ["build"],
  },
];

const liveCommands = [
  {
    name: "phase-9-live-media-workflows",
    command: "node_modules/.bin/playwright",
    args: ["test", "tests/browser-ui/media-live-workflows.spec.ts"],
  },
  {
    name: "phase-9-live-compose-eval",
    command: "node_modules/.bin/playwright",
    args: ["test", "tests/browser-ui/media-compose-eval.spec.ts"],
  },
  {
    name: "phase-9-live-planner-eval",
    command: "node_modules/.bin/playwright",
    args: ["test", "tests/browser-ui/media-compose-planner-eval.spec.ts"],
  },
];

type CommandConfig = {
  name: string;
  command: string;
  args: string[];
};

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
  if (!value) {
    return undefined;
  }

  const lines = value.split("\n").slice(-80).join("\n").trim();
  return lines.length > 0 ? lines : undefined;
}

function appendTail(buffer: string, chunk: string): string {
  const combined = `${buffer}${chunk}`;
  const lines = combined.split("\n");
  return lines.slice(-80).join("\n");
}

async function runCommand(config: CommandConfig, enabled: boolean): Promise<CommandEvidence> {
  if (!enabled) {
    return {
      name: config.name,
      command: config.command,
      args: config.args,
      enabled,
      status: "skipped",
      exitCode: null,
    };
  }

  process.stdout.write(`\n==> START ${config.name}\n`);
  process.stdout.write(`    ${config.command} ${config.args.join(" ")}\n\n`);

  return await new Promise((resolve, reject) => {
    const child = spawn(config.command, config.args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PATH: `${CURRENT_NODE_BIN_DIR}:${process.env["PATH"] ?? ""}`,
      },
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (chunk: string) => {
      stdoutBuffer = appendTail(stdoutBuffer, chunk);
      process.stdout.write(chunk);
    });

    child.stderr?.on("data", (chunk: string) => {
      stderrBuffer = appendTail(stderrBuffer, chunk);
      process.stderr.write(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        name: config.name,
        command: config.command,
        args: config.args,
        enabled,
        status: code === 0 ? "passed" : "failed",
        exitCode: code,
        stdoutTail: tail(stdoutBuffer),
        stderrTail: tail(stderrBuffer),
      });
    });
  });
}

function printCommandSummary(command: CommandEvidence) {
  process.stdout.write(`${command.status.toUpperCase()} ${command.name}\n`);
  if (command.status === "failed" && command.stdoutTail) {
    process.stdout.write(`${command.stdoutTail}\n`);
  }
  if (command.status === "failed" && command.stderrTail) {
    process.stderr.write(`${command.stderrTail}\n`);
  }
}

async function main(): Promise<void> {
  const buildOnly = process.argv.includes("--build-only");
  const testsOnly = process.argv.includes("--tests-only");
  const includeLive = process.argv.includes("--live") || process.env.ORDO_PHASE_9_LIVE_MEDIA === "1";

  const commands: CommandEvidence[] = [];

  if (!buildOnly) {
    commands.push(await runCommand(deterministicCommands[0], true));
    commands.push(await runCommand(deterministicCommands[1], true));
  }

  if (!testsOnly) {
    commands.push(await runCommand(deterministicCommands[2], true));
  }

  for (const command of liveCommands) {
    commands.push(await runCommand(command, includeLive && !buildOnly));
  }

  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    phase: "phase-9-shared-media-materialization-and-live-runtime-proof",
    deterministicScenarios: [
      "structural plans allow chart and graph clips before materialization",
      "executable plans still reject raw chart and graph clips without promotion",
      "worker runtime promotes governed chart and graph clips into governed derived image assets before ffmpeg execution",
      "phase-7 deterministic media regressions remain green after the shared materialization fix",
    ],
    liveScenarioMatrix: [
      "real media workflows produce downloadable playable video artifacts",
      "planner-driven compose still yields an inspectable single-beat plan and playable output",
      "live compose flows remain green when live media credentials are enabled",
    ],
    passingRules: [
      "worker execution cannot fail on supported chart or graph inputs solely because promotion was browser-only",
      "derived compose assets preserve lineage metadata",
      "browser and worker lanes share executable-plan semantics",
      "live failures remain diagnosable from retained evidence",
    ],
    liveMediaEnabled: includeLive,
    commands,
  };

  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  fs.writeFileSync(EVIDENCE_PATH, JSON.stringify(evidence, null, 2));

  process.stdout.write(`Wrote ${path.relative(ROOT, EVIDENCE_PATH)}\n`);
  for (const command of commands) {
    printCommandSummary(command);
  }

  const failed = commands.filter((command) => command.status === "failed");
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});