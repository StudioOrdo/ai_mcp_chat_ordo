import { spawnSync } from "node:child_process";

export interface QaCommandStep {
  label: string;
  command: string;
  args: string[];
  enabled?: boolean;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  output?: "inherit" | "capture";
  shell?: boolean;
}

export interface QaCommandExecution {
  label: string;
  command: string;
  args: string[];
  enabled: boolean;
  status: "passed" | "failed" | "skipped";
  exitCode: number | null;
  stdout?: string;
  stderr?: string;
}

export function formatQaCommand(command: string, args: readonly string[]): string {
  return [command, ...args].join(" ");
}

export function hasHelpFlag(argv: readonly string[] = process.argv): boolean {
  return argv.includes("--help");
}

export function printUsage(lines: readonly string[]): void {
  process.stderr.write(`${lines.join("\n")}\n`);
}

export function tailCommandOutput(value: string | undefined, maxLines = 80): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.split("\n").slice(-maxLines).join("\n").trim() || undefined;
}

function normalizeCommandOutput(value: string | Uint8Array | undefined): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("utf8");
  }

  return undefined;
}

export function runQaCommandStep(step: QaCommandStep): QaCommandExecution {
  process.stdout.write(`\n==> ${step.label}\n`);

  if (step.enabled === false) {
    return {
      label: step.label,
      command: step.command,
      args: step.args,
      enabled: false,
      status: "skipped",
      exitCode: null,
    };
  }

  const captureOutput = step.output === "capture";
  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd ?? process.cwd(),
    env: step.env ?? process.env,
    shell: step.shell ?? process.platform === "win32",
    stdio: captureOutput ? ["ignore", "pipe", "pipe"] : "inherit",
    ...(captureOutput ? { encoding: "utf8" as const } : {}),
  });

  return {
    label: step.label,
    command: step.command,
    args: step.args,
    enabled: true,
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    stdout: captureOutput ? normalizeCommandOutput(result.stdout) : undefined,
    stderr: captureOutput ? normalizeCommandOutput(result.stderr) : undefined,
  };
}

export function runQaCommandSteps(
  steps: readonly QaCommandStep[],
  options: { stopOnFailure?: boolean } = {},
): QaCommandExecution[] {
  const results: QaCommandExecution[] = [];
  const stopOnFailure = options.stopOnFailure ?? true;

  for (const step of steps) {
    const result = runQaCommandStep(step);
    results.push(result);

    if (stopOnFailure && result.status === "failed") {
      break;
    }
  }

  return results;
}