import { runCommand } from "./command-runner";
import type { CommandResult } from "./lifecycle-types";

export class DockerLifecycleAdapter {
  async isAvailable(): Promise<boolean> {
    const result = await runCommand("docker", ["version", "--format", "{{.Server.Version}}"], { timeoutMs: 10_000 });
    return result.status === 0;
  }

  async buildImage(tag: string): Promise<CommandResult> {
    return runCommand("docker", ["build", "-t", tag, "."], {
      timeoutMs: Number(process.env.APPLIANCE_DOCKER_BUILD_TIMEOUT_MS ?? 600_000),
    });
  }

  async inspectSingleImageComposeContract(): Promise<CommandResult> {
    return runCommand("docker", ["compose", "config", "--services"], { timeoutMs: 10_000 });
  }
}
