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

  it("builds and supervises the Rust backup executor in the single-container path", () => {
    const dockerfile = readWorkspaceFile("Dockerfile");
    const startServer = readWorkspaceFile("scripts/start-server.mjs");

    expect(dockerfile).toContain("FROM rust:1-alpine AS rust-builder");
    expect(dockerfile).toContain("cargo build --release -p ordo-backup");
    expect(dockerfile).toContain("/app/target/release/ordo-backup ./bin/ordo-backup");
    expect(startServer).toContain("DISABLE_BACKUP_EXECUTOR");
    expect(startServer).toContain("ORDO_BACKUP_EXECUTOR_PATH");
    expect(startServer).toContain('"daemon"');
    expect(startServer).toContain("await waitForChildExit(backupExecutorProcess);");
  });

  it("routes default persistent storage through DATA_DIR", () => {
    const dataBoundary = readWorkspaceFile("src/lib/appliance/data-boundary.ts");
    const db = readWorkspaceFile("src/lib/db/index.ts");
    const blogAssetStorage = readWorkspaceFile("src/lib/blog/blog-asset-storage.ts");
    const userFiles = readWorkspaceFile("src/lib/user-files.ts");

    expect(dataBoundary).toContain("resolveApplianceDataDir");
    expect(dataBoundary).toContain("resolveApplianceSqlitePath");
    expect(dataBoundary).toContain("resolveApplianceBlogAssetRoot");
    expect(dataBoundary).toContain("resolveApplianceUserFileRoot");
    expect(db).toContain("resolveApplianceSqlitePath");
    expect(blogAssetStorage).toContain("resolveApplianceBlogAssetRoot");
    expect(userFiles).toContain("resolveApplianceDataDir");
    expect(userFiles).toContain("resolveApplianceUserFileRoot");
  });

  it("documents the supported docker run command", () => {
    const readme = readWorkspaceFile("README.md");

    expect(readme).toContain("docker run -p 80:3000 kaw393939/studioordo");
    expect(readme).toContain("linux/amd64");
    expect(readme).toContain("linux/arm64");
    expect(readme).toContain("/app/.data");
  });

  it("keeps compose as a one-service wrapper around the app image", () => {
    const compose = readWorkspaceFile("compose.yaml");
    const readme = readWorkspaceFile("README.md");

    expect(compose).toContain("services:");
    expect(compose).toContain("  app:");
    expect(compose).not.toContain("  media-worker:");
    expect(compose).not.toContain("  admin-web-search-mcp:");
    expect(compose).not.toContain("Dockerfile.media");
    expect(compose).not.toContain("MEDIA_WORKER_URL");
    expect(compose).not.toContain("depends_on:");
    expect(readme).toContain("The Compose stack uses the same single app image");
  });
});
