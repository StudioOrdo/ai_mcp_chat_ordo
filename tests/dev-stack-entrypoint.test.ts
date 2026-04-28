import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("dev stack entrypoint", () => {
  it("guards against starting duplicate local dev worker stacks", () => {
    const source = readFileSync(join(process.cwd(), "scripts/dev.mjs"), "utf-8");

    expect(source).toContain("dev-stack.lock");
    expect(source).toContain("acquireDevStackLock();");
    expect(source).toContain("ORDO_ALLOW_MULTIPLE_DEV_STACKS");
    expect(source).toContain("worker_dev_${port}");
    expect(source).toContain("releaseDevStackLock();");
  });

  it("fails fast when the media worker is unavailable and waits for managed children to exit", () => {
    const source = readFileSync(join(process.cwd(), "scripts/dev.mjs"), "utf-8");

    expect(source).toContain("MEDIA_WORKER_PORT");
    expect(source).toContain("waitForHttpReady(`http://127.0.0.1:${MEDIA_WORKER_PORT}/health`");
    expect(source).toContain("Media worker port ${MEDIA_WORKER_PORT} is already in use");
    expect(source).toContain("waitForChildExit(mediaWorkerProcess)");
    expect(source).toContain("[dev] media worker failed readiness check");
  });
});