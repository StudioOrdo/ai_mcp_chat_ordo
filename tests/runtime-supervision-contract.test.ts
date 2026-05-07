import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

describe("runtime supervision contracts", () => {
  it("gracefully shuts down the media worker on process signals", () => {
    const source = readWorkspaceFile("scripts/media-worker-server.ts");

    expect(source).toContain('process.on("SIGTERM", () => shutdown("SIGTERM"));');
    expect(source).toContain('process.on("SIGINT", () => shutdown("SIGINT"));');
    expect(source).toContain("server.close((error) => {");
    expect(source).toContain("[media-worker] stopped cleanly");
  });

  it("waits for the production deferred worker to exit during shutdown", () => {
    const source = readWorkspaceFile("scripts/start-server.mjs");

    expect(source).toContain('from "./worker-restart-policy.mjs"');
    expect(source).toContain("getWorkerRestartPolicyFromEnv(process.env)");
    expect(source).toContain("async function waitForChildExit");
    expect(source).toContain("await waitForChildExit(workerProcess);");
    expect(source).toContain('child.kill("SIGKILL")');
  });

  it("keeps docker compose on the single-image appliance path", () => {
    const source = readWorkspaceFile("compose.yaml");

    expect(source).not.toContain("depends_on:");
    expect(source).not.toContain("media-worker:");
    expect(source).not.toContain("Dockerfile.media");
    expect(source).not.toContain("MEDIA_WORKER_URL");
    expect(source).toContain("stop_grace_period: 15s");
  });
});
