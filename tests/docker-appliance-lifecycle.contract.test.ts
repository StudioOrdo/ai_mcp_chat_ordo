import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

describe("single-image appliance lifecycle contract", () => {
  it("does not keep a separate media worker image in the supported Docker path", () => {
    expect(existsSync(join(process.cwd(), "Dockerfile.media"))).toBe(false);

    const compose = readWorkspaceFile("compose.yaml");
    expect(compose).not.toContain("Dockerfile.media");
    expect(compose).not.toContain("media-worker:");
    expect(compose).not.toContain("MEDIA_WORKER_URL");
    expect(compose).not.toContain("depends_on:");
  });

  it("packages all supervised runtime executors into the app image", () => {
    const dockerfile = readWorkspaceFile("Dockerfile");
    const startServer = readWorkspaceFile("scripts/start-server.mjs");

    expect(dockerfile).toContain("RUN apk add --no-cache ffmpeg");
    expect(dockerfile).toContain("cargo build --release -p ordo-backup");
    expect(dockerfile).toContain("./bin/ordo-backup");
    expect(startServer).toContain("spawnMediaWorker()");
    expect(startServer).toContain("spawnBackupExecutor()");
    expect(startServer).toContain("spawnBackupScheduler()");
  });
});
