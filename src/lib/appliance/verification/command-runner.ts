import { spawn } from "node:child_process";
import type { CommandResult } from "./lifecycle-types";

export function runCommand(
  command: string,
  args: string[],
  options: { env?: Record<string, string | undefined>; cwd?: string; timeoutMs?: number } = {},
): Promise<CommandResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    let timedOut = false;
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timeout = options.timeoutMs
      ? setTimeout(() => {
        timedOut = true;
        stderr += `Command timed out after ${options.timeoutMs}ms.`;
        child.kill("SIGTERM");
      }, options.timeoutMs)
      : null;
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      stderr += error instanceof Error ? error.message : String(error);
    });
    child.on("close", (status) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve({
        command,
        args,
        status: timedOut ? 124 : status,
        stdout,
        stderr,
        durationMs: Date.now() - started,
      });
    });
  });
}
