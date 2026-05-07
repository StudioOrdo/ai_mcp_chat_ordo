#!/usr/bin/env tsx
import { loadLocalEnv } from "./load-local-env";

loadLocalEnv();

function readFlag(name: string): string | undefined {
  const prefix = `${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) {
    return direct.slice(prefix.length);
  }

  const index = process.argv.findIndex((arg) => arg === name);
  if (index >= 0) {
    return process.argv[index + 1];
  }

  return undefined;
}

function readRepeatedFlag(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg === name) {
      const value = process.argv[index + 1];
      if (value) values.push(value);
    } else if (arg.startsWith(`${name}=`)) {
      values.push(arg.slice(name.length + 1));
    }
  }

  return values.flatMap((value) => value.split(",").map((entry) => entry.trim()).filter(Boolean));
}

function printUsage(): void {
  process.stderr.write([
    "Usage: EVAL_LIVE_ENABLED=true npm run eval:live-tools -- [--tool <name>] [--limit <n>] [--artifact-dir <dir>] [--json] [--no-artifacts]",
    "Examples:",
    "  EVAL_LIVE_ENABLED=true npm run eval:live-tools -- --tool calculator",
    "  EVAL_LIVE_ENABLED=true npm run eval:live-tools -- --tool calculator --tool inspect_runtime_context --json",
    "  EVAL_LIVE_ENABLED=true npm run eval:live-tools -- --artifact-dir .runtime-logs/eval-artifacts/tool-coverage",
    "",
    "The eval uses the Anthropic key from ANTHROPIC_API_KEY or API__ANTHROPIC_API_KEY loaded from the environment/.env files.",
    "Tool execution is dry-run by default: inputs are schema-validated and no appliance mutation is performed.",
  ].join("\n") + "\n");
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  if (process.env.EVAL_LIVE_ENABLED !== "true") {
    process.stderr.write("Refusing to run live model evals without EVAL_LIVE_ENABLED=true.\n");
    process.exitCode = 1;
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.API__ANTHROPIC_API_KEY;
  if (!apiKey) {
    process.stderr.write("Live tool coverage evals require ANTHROPIC_API_KEY or API__ANTHROPIC_API_KEY.\n");
    process.exitCode = 1;
    return;
  }

  const jsonOnly = process.argv.includes("--json");
  if (jsonOnly) {
    (process.env as Record<string, string | undefined>)["NODE_ENV"] = "test";
  }
  const tools = readRepeatedFlag("--tool");
  const limitFlag = readFlag("--limit");
  const limit = limitFlag ? Number.parseInt(limitFlag, 10) : null;
  const artifactDir = readFlag("--artifact-dir");
  const shouldWriteArtifacts = !process.argv.includes("--no-artifacts")
    && (!jsonOnly || Boolean(artifactDir) || process.argv.includes("--write-artifacts"));
  const { runLiveToolCoverageEval } = await import("../src/lib/evals/tool-coverage");

  const report = await runLiveToolCoverageEval({
    apiKey,
    includeTools: tools.length > 0 ? tools : undefined,
    limit: limit && Number.isFinite(limit) && limit > 0 ? limit : undefined,
  });

  let artifacts: { directory: string; files: string[] } | null = null;
  if (shouldWriteArtifacts) {
    const { writeToolCoverageEvalArtifacts } = await import("../src/lib/evals/eval-artifacts");
    artifacts = await writeToolCoverageEvalArtifacts(report, {
      rootDir: artifactDir,
    });
  }

  if (jsonOnly) {
    process.stdout.write(`${JSON.stringify({ ...report, artifacts }, null, 2)}\n`);
  } else {
    process.stdout.write(`Live tool coverage: ${report.passed}/${report.total} passed.\n`);
    if (artifacts) {
      process.stdout.write(`Artifacts: ${artifacts.directory}\n`);
    }
    for (const result of report.results) {
      process.stdout.write(`${result.passed ? "PASS" : "FAIL"} ${result.case.toolName} (${result.case.role})\n`);
      if (!result.passed) {
        for (const checkpoint of result.checkpoints.filter((checkpoint) => !checkpoint.passed)) {
          process.stdout.write(`  - ${checkpoint.id}: ${checkpoint.details}\n`);
        }
      }
    }
  }

  if (report.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
