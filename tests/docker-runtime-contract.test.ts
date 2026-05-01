import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

describe("docker runtime contract", () => {
  it("publishes a multi-architecture image", () => {
    const workflow = readWorkspaceFile(".github/workflows/ci.yml");

    expect(workflow).toContain("docker/setup-qemu-action@v3");
    expect(workflow).toContain("docker/setup-buildx-action@v3");
    expect(workflow).toContain("platforms: linux/amd64,linux/arm64");
  });

  it("keeps the one-command container writable and durable", () => {
    const dockerfile = readWorkspaceFile("Dockerfile");

    expect(dockerfile).toContain("ENV DATA_DIR=/app/.data");
    expect(dockerfile).toContain("ENV STUDIO_ORDO_DB_PATH=/app/.data/local.db");
    expect(dockerfile).toContain("ENV STUDIO_ORDO_BLOG_ASSET_ROOT=/app/.data/blog-assets");
    expect(dockerfile).toContain('VOLUME ["/app/.data"]');
    expect(dockerfile).toContain("chown -R nextjs:nodejs /app/.data");
  });

  it("ships media runtime dependencies and starts media work in the single-container path", () => {
    const dockerfile = readWorkspaceFile("Dockerfile");
    const startServer = readWorkspaceFile("scripts/start-server.mjs");

    expect(dockerfile).toContain("apk add --no-cache ffmpeg");
    expect(startServer).toContain('process.env.MEDIA_WORKER_URL = `http://127.0.0.1:${mediaWorkerPort}`;');
    expect(startServer).toContain("DISABLE_MEDIA_WORKER");
    expect(startServer).toContain('scripts/media-worker-server.ts');
    expect(startServer).toContain("await waitForChildExit(mediaWorkerProcess);");
  });

  it("routes default persistent storage through DATA_DIR", () => {
    const db = readWorkspaceFile("src/lib/db/index.ts");
    const blogAssetStorage = readWorkspaceFile("src/lib/blog/blog-asset-storage.ts");

    expect(db).toContain("process.env.DATA_DIR");
    expect(db).toContain('path.join(dataDir, "local.db")');
    expect(blogAssetStorage).toContain("getDataRootPath");
    expect(blogAssetStorage).toContain('path.join(getDataRootPath(), "blog-assets")');
  });

  it("documents the supported docker run command", () => {
    const readme = readWorkspaceFile("README.md");

    expect(readme).toContain("docker run -p 80:3000 kaw393939/studioordo");
    expect(readme).toContain("linux/amd64");
    expect(readme).toContain("linux/arm64");
    expect(readme).toContain("/app/.data");
  });
});
