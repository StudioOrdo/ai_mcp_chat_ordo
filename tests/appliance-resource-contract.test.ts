import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

describe("appliance resource runtime contract", () => {
  it("bounds local compose runtime resources and log growth", () => {
    const compose = readWorkspaceFile("compose.yaml");

    expect(compose).toContain("pids_limit: ${ORDO_PIDS_LIMIT:-256}");
    expect(compose).toContain("mem_reservation: ${ORDO_MEMORY_RESERVATION:-512m}");
    expect(compose).toContain("mem_limit: ${ORDO_MEMORY_LIMIT:-2g}");
    expect(compose).toContain("cpus: ${ORDO_CPUS:-2.0}");
    expect(compose).toContain("driver: json-file");
    expect(compose).toContain("max-size: ${ORDO_LOG_MAX_SIZE:-10m}");
    expect(compose).toContain("max-file: ${ORDO_LOG_MAX_FILE:-5}");
    expect(compose).toContain("/tmp:rw,nosuid,nodev,size=${ORDO_TMP_SIZE:-512m}");
    expect(compose).toContain("/app/.runtime-logs:rw,noexec,nosuid,nodev,size=${ORDO_RUNTIME_LOG_TMPFS_SIZE:-64m}");
    expect(compose).toContain("/app/.next/cache:rw,noexec,nosuid,nodev,size=${ORDO_NEXT_CACHE_TMPFS_SIZE:-256m}");
    expect(compose).toContain("/api/health/live");
    expect(compose).not.toContain("deploy:\n");
  });

  it("keeps hosted compose on the same bounded runtime posture", () => {
    const hosted = readWorkspaceFile("compose.hosted.yaml");

    expect(hosted).toContain("pids_limit: ${ORDO_PIDS_LIMIT:-256}");
    expect(hosted).toContain("mem_limit: ${ORDO_MEMORY_LIMIT:-2g}");
    expect(hosted).toContain("cpus: ${ORDO_CPUS:-2.0}");
    expect(hosted).toContain("max-size: ${ORDO_LOG_MAX_SIZE:-10m}");
    expect(hosted).toContain("/api/health/live");
    expect(hosted).not.toContain("ports:");
    expect(hosted).not.toContain("deploy:\n");
  });

  it("centralizes resource defaults and env names", () => {
    const policy = readWorkspaceFile("src/lib/appliance/resources/appliance-resource-policy.ts");
    const env = readWorkspaceFile("src/lib/config/env-config.ts");

    for (const name of [
      "ORDO_DATA_FREE_WARN_BYTES",
      "ORDO_DATA_FREE_BLOCK_BYTES",
      "ORDO_TMP_SIZE",
      "ORDO_PIDS_LIMIT",
      "ORDO_MEMORY_LIMIT",
      "ORDO_LOG_MAX_SIZE",
      "ORDO_WORKER_MAX_RESTARTS",
    ]) {
      expect(policy).toContain(name.replace("ORDO_", "").toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()));
      expect(env).toContain(name);
    }
  });
});
