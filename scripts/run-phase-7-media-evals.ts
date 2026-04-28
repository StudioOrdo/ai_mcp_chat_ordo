#!/usr/bin/env tsx
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RELEASE_DIR = path.join(ROOT, "release");
const EVIDENCE_PATH = path.join(RELEASE_DIR, "phase-7-media-eval-evidence.json");
const CURRENT_NODE_BIN_DIR = path.dirname(process.execPath);

const deterministicCommands = [
  {
    name: "phase-7-deterministic-preflight",
    command: "node_modules/.bin/tsx",
    args: ["scripts/run-sprint-7-qa.ts", "--tests-only"],
  },
  {
    name: "phase-7-build-verification",
    command: "node_modules/.bin/next",
    args: ["build"],
  },
];

const liveCommands = [
  {
    name: "phase-7-live-media-workflows",
    command: "node_modules/.bin/playwright",
    args: ["test", "tests/browser-ui/media-live-workflows.spec.ts"],
  },
  {
    name: "phase-7-media-compose-eval",
    command: "node_modules/.bin/playwright",
    args: ["test", "tests/browser-ui/media-compose-eval.spec.ts"],
  },
  {
    name: "phase-7-media-compose-planner-eval",
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
  const includeLive = process.argv.includes("--live") || process.env.ORDO_PHASE_7_LIVE_MEDIA === "1";

  const commands: CommandEvidence[] = [];

  if (!buildOnly) {
    commands.push(await runCommand(deterministicCommands[0], true));
  }

  if (!testsOnly) {
    commands.push(await runCommand(deterministicCommands[1], true));
  }

  for (const command of liveCommands) {
    commands.push(await runCommand(command, includeLive && !buildOnly));
  }

  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    phase: "phase-7-media-evals-and-video-proof",
    deterministicScenarios: [
      "kind-aware alias repair prevents cross-kind clip corruption",
      "governed media discovery preserves overlapping aliases across kinds",
      "conversation asset listing supports kind-narrowed reuse",
      "preflight classifies pending, kind-mismatch, conversation-mismatch, and lineage-mismatch failures",
      "browser-runtime snapshots preserve rerun recovery signals",
    ],
    liveScenarioMatrix: [
      "generated image plus narration to playable audible video",
      "uploaded image plus narration to playable audible video",
      "uploaded clip concat to playable audible video",
      "planner-driven attached image plus narration flow",
      "chart and graph workflow harness outputs with inspectable media artifacts",
    ],
    passingRules: [
      "composition alias repair cannot rewrite a clip across incompatible kinds",
      "governed composition inputs remain conversation-safe and lineage-safe before execution",
      "critical recovery paths preserve truthful rerun metadata",
      "successful video scenarios prove playable browser output and downloadable stream validation",
      "audio-required scenarios prove non-silent audio",
      "live failures remain inspectable through retained evidence bundles",
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