import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

function serviceNames(composeSource: string): string[] {
  const servicesBlock = composeSource.split(/^secrets:\n/m)[0] ?? composeSource;
  const matches = [...servicesBlock.matchAll(/^  ([a-zA-Z0-9_-]+):$/gm)];
  return matches.map((match) => match[1]);
}

function listValuesUnderKey(source: string, key: string): string[] {
  const match = source.match(new RegExp(`^    ${key}:\\n((?:      - .+\\n)+)`, "m"));
  if (!match) {
    return [];
  }

  return [...match[1].matchAll(/^\s*-\s+(.+)$/gm)].map((item) => item[1].trim());
}

const forbiddenRuntimeFields = [
  "privileged:",
  "network_mode: host",
  "pid: host",
  "ipc: host",
  "devices:",
  "extra_hosts:",
  "/var/run/docker.sock",
  "cap_add:",
  "depends_on:",
  "Dockerfile.media",
  "MEDIA_WORKER_URL",
  "  media-worker:",
  "  admin-web-search-mcp:",
];

describe("image security runtime contract", () => {
  it("keeps the Dockerfile on a non-root single-image appliance baseline", () => {
    const dockerfile = readWorkspaceFile("Dockerfile");

    expect(dockerfile).toContain("FROM node:${NODE_VERSION}-alpine AS runner");
    expect(dockerfile).toContain("RUN apk add --no-cache ffmpeg");
    expect(dockerfile).toContain("COPY --from=rust-builder --chown=nextjs:nodejs /app/target/release/ordo-backup ./bin/ordo-backup");
    expect(dockerfile).toContain('VOLUME ["/app/.data"]');
    expect(dockerfile).toContain("USER nextjs");
    expect(dockerfile).toContain("EXPOSE 3000");
    expect(dockerfile).not.toContain("USER root");
  });

  it("keeps local compose hardened while preserving direct localhost launch", () => {
    const compose = readWorkspaceFile("compose.yaml");

    expect(serviceNames(compose)).toEqual(["app"]);
    expect(compose).toContain("read_only: true");
    expect(compose).toContain("no-new-privileges:true");
    expect(compose).toContain("cap_drop:\n      - ALL");
    expect(compose).toContain("ports:\n      - \"3000:3000\"");
    expect(listValuesUnderKey(compose, "volumes")).toEqual([
      "./.data:/app/.data",
      "./config:/app/config:ro",
    ]);
    expect(listValuesUnderKey(compose, "tmpfs")).toEqual([
      "/tmp:rw,nosuid,nodev,size=${ORDO_TMP_SIZE:-512m}",
      "/app/.runtime-logs:rw,noexec,nosuid,nodev,size=${ORDO_RUNTIME_LOG_TMPFS_SIZE:-64m}",
      "/app/.next/cache:rw,noexec,nosuid,nodev,size=${ORDO_NEXT_CACHE_TMPFS_SIZE:-256m}",
    ]);

    for (const forbidden of forbiddenRuntimeFields) {
      expect(compose).not.toContain(forbidden);
    }
  });

  it("adds a hosted compose template for reverse-proxy launch without host port publication", () => {
    expect(existsSync(join(process.cwd(), "compose.hosted.yaml"))).toBe(true);
    const hosted = readWorkspaceFile("compose.hosted.yaml");

    expect(serviceNames(hosted)).toEqual(["app"]);
    expect(hosted).toContain("image: kaw393939/studioordo:latest");
    expect(hosted).toContain("read_only: true");
    expect(hosted).toContain("no-new-privileges:true");
    expect(hosted).toContain("cap_drop:\n      - ALL");
    expect(hosted).toContain("expose:\n      - \"3000\"");
    expect(hosted).not.toContain("ports:");
    expect(hosted).not.toContain("container_name:");
    expect(listValuesUnderKey(hosted, "volumes")).toEqual([
      "${ORDO_DATA_DIR:-./.data}:/app/.data",
      "${ORDO_CONFIG_DIR:-./config}:/app/config:ro",
    ]);
    expect(listValuesUnderKey(hosted, "tmpfs")).toEqual([
      "/tmp:rw,nosuid,nodev,size=${ORDO_TMP_SIZE:-512m}",
      "/app/.runtime-logs:rw,noexec,nosuid,nodev,size=${ORDO_RUNTIME_LOG_TMPFS_SIZE:-64m}",
      "/app/.next/cache:rw,noexec,nosuid,nodev,size=${ORDO_NEXT_CACHE_TMPFS_SIZE:-256m}",
    ]);
    expect(hosted).toContain("DATA_DIR: /app/.data");
    expect(hosted).toContain("STUDIO_ORDO_DB_PATH: /app/.data/local.db");
    expect(hosted).toContain("ANTHROPIC_API_KEY_FILE: ${ANTHROPIC_API_KEY_FILE:-/run/secrets/anthropic_api_key}");
    expect(hosted).toContain("OPENAI_API_KEY_FILE: ${OPENAI_API_KEY_FILE:-/run/secrets/openai_api_key}");
    expect(hosted).toContain("DEEPSEEK_API_KEY_FILE: ${DEEPSEEK_API_KEY_FILE:-/run/secrets/deepseek_api_key}");
    expect(hosted).toContain("ORDO_INSTALL_TOKEN_FILE: ${ORDO_INSTALL_TOKEN_FILE:-/run/secrets/ordo_install_token}");
    expect(hosted).toContain("secrets:\n      - anthropic_api_key");
    expect(hosted).toContain("ordo_install_token:\n    external: true");

    for (const forbidden of forbiddenRuntimeFields) {
      expect(hosted).not.toContain(forbidden);
    }
  });
});
