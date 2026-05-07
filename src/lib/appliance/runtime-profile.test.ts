import path from "node:path";
import { describe, expect, it } from "vitest";
import { getApplianceRuntimeProfile } from "./runtime-profile";

const cwd = path.resolve("/tmp/ordo-runtime");

describe("appliance runtime profile", () => {
  it("reports production single-image runtime", () => {
    const profile = getApplianceRuntimeProfile({
      env: { NODE_ENV: "production", DATA_DIR: "/app/.data" },
      cwd,
      fileExists: () => true,
      readTextFile: () => null,
    });

    expect(profile.profileId).toBe("single_image");
    expect(profile.processRole).toBe("app");
    expect(profile.dataDir).toBe("/app/.data");
    expect(profile.mediaWorker.mode).toBe("supervised_child");
    expect(profile.deferredWorker.mode).toBe("supervised_child");
    expect(profile.isDocker).toBe(true);
  });

  it("reports compose app runtime from the media-worker service URL", () => {
    const profile = getApplianceRuntimeProfile({
      env: {
        NODE_ENV: "production",
        MEDIA_WORKER_URL: "http://media-worker:3101",
      },
      cwd,
      fileExists: () => false,
      readTextFile: () => null,
    });

    expect(profile.profileId).toBe("compose_app");
    expect(profile.isCompose).toBe(true);
    expect(profile.mediaWorker.mode).toBe("compose_service");
    expect(profile.mediaWorker.url).toBe("http://media-worker:3101");
  });

  it("reports local dev runtime", () => {
    const profile = getApplianceRuntimeProfile({
      env: { NODE_ENV: "development" },
      cwd,
      fileExists: () => false,
      readTextFile: () => null,
    });

    expect(profile.profileId).toBe("local_dev");
    expect(profile.mediaWorker.mode).toBe("local_dev");
    expect(profile.deferredWorker.mode).toBe("local_dev");
  });

  it("reports test runtime without Docker assumptions", () => {
    const profile = getApplianceRuntimeProfile({
      env: { NODE_ENV: "test" },
      cwd,
      fileExists: () => false,
      readTextFile: () => null,
    });

    expect(profile.profileId).toBe("test");
    expect(profile.isDocker).toBe(false);
  });

  it("detects media worker process role from argv", () => {
    const profile = getApplianceRuntimeProfile({
      env: { NODE_ENV: "production" },
      argv: ["node", "tsx", "scripts/media-worker-server.ts"],
      cwd,
      fileExists: () => false,
      readTextFile: () => null,
    });

    expect(profile.processRole).toBe("media_worker");
  });

  it("reports disabled workers", () => {
    const profile = getApplianceRuntimeProfile({
      env: {
        NODE_ENV: "production",
        DISABLE_MEDIA_WORKER: "1",
        DISABLE_DEFERRED_JOB_WORKER: "1",
      },
      cwd,
      fileExists: () => false,
      readTextFile: () => null,
    });

    expect(profile.mediaWorker).toMatchObject({
      mode: "disabled",
      disabled: true,
      url: null,
      port: null,
    });
    expect(profile.deferredWorker).toMatchObject({
      mode: "disabled",
      disabled: true,
    });
  });

  it("reports external media worker URLs without changing the app profile", () => {
    const profile = getApplianceRuntimeProfile({
      env: {
        NODE_ENV: "production",
        MEDIA_WORKER_URL: "https://media.example.com",
      },
      cwd,
      fileExists: () => false,
      readTextFile: () => null,
    });

    expect(profile.profileId).toBe("single_image");
    expect(profile.mediaWorker.mode).toBe("external_url");
  });

  it("reports production loopback media URL as supervised child, not compose", () => {
    const profile = getApplianceRuntimeProfile({
      env: {
        NODE_ENV: "production",
        MEDIA_WORKER_URL: "http://127.0.0.1:3101",
      },
      cwd,
      fileExists: () => false,
      readTextFile: () => null,
    });

    expect(profile.profileId).toBe("single_image");
    expect(profile.isCompose).toBe(false);
    expect(profile.mediaWorker.mode).toBe("supervised_child");
  });

  it("detects compose marker from COMPOSE_PROJECT_NAME", () => {
    const profile = getApplianceRuntimeProfile({
      env: {
        NODE_ENV: "production",
        COMPOSE_PROJECT_NAME: "ordo",
      },
      cwd,
      fileExists: () => false,
      readTextFile: () => null,
    });

    expect(profile.profileId).toBe("compose_app");
    expect(profile.isCompose).toBe(true);
  });

  it("does not throw when Docker sentinel files are unavailable", () => {
    const profile = getApplianceRuntimeProfile({
      env: { NODE_ENV: "production" },
      cwd,
      fileExists: () => {
        throw new Error("no access");
      },
      readTextFile: () => {
        throw new Error("no access");
      },
    });

    expect(profile.isDocker).toBe(false);
  });

  it("falls back to cgroup Docker detection when dockerenv cannot be inspected", () => {
    const profile = getApplianceRuntimeProfile({
      env: { NODE_ENV: "production" },
      cwd,
      fileExists: () => {
        throw new Error("no access");
      },
      readTextFile: () => "0::/docker/abcdef",
    });

    expect(profile.isDocker).toBe(true);
  });

  it("records invalid media worker URL as a warning", () => {
    const profile = getApplianceRuntimeProfile({
      env: {
        NODE_ENV: "production",
        MEDIA_WORKER_URL: "not a url",
      },
      cwd,
      fileExists: () => false,
      readTextFile: () => null,
    });

    expect(profile.warnings).toContain("MEDIA_WORKER_URL is not a valid URL.");
  });
});
