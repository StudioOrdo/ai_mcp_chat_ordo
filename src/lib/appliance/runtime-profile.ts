import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getApplianceDataBoundary, type ApplianceDataBoundaryInput } from "./data-boundary";

export type ApplianceRuntimeProfileId =
  | "single_image"
  | "compose_app"
  | "local_dev"
  | "test"
  | "unknown";

export type ApplianceRuntimeProcessRole = "app" | "media_worker" | "unknown";

export type MediaWorkerMode =
  | "supervised_child"
  | "compose_service"
  | "external_url"
  | "disabled"
  | "local_dev";

export type DeferredWorkerMode =
  | "supervised_child"
  | "local_dev"
  | "disabled"
  | "unavailable";

export interface ApplianceRuntimeProfileInput extends ApplianceDataBoundaryInput {
  argv?: string[];
  fileExists?: (filePath: string) => boolean;
  readTextFile?: (filePath: string) => string | null;
}

export interface ApplianceRuntimeProfile {
  profileId: ApplianceRuntimeProfileId;
  processRole: ApplianceRuntimeProcessRole;
  nodeEnv: "development" | "production" | "test";
  isDocker: boolean;
  isCompose: boolean;
  dataDir: string;
  sqlitePath: string;
  sqliteInsideDataDir: boolean;
  mediaWorker: {
    mode: MediaWorkerMode;
    url: string | null;
    port: number | null;
    disabled: boolean;
  };
  deferredWorker: {
    mode: DeferredWorkerMode;
    disabled: boolean;
    workerId: string | null;
  };
  warnings: string[];
}

function trimEnv(env: Record<string, string | undefined>, key: string): string | null {
  const value = env[key]?.trim();
  return value && value.length > 0 ? value : null;
}

function normalizeNodeEnv(value: string | undefined): ApplianceRuntimeProfile["nodeEnv"] {
  if (value === "development" || value === "production" || value === "test") {
    return value;
  }
  return "production";
}

function parsePort(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseUrl(value: string | null, warnings: string[]): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    warnings.push("MEDIA_WORKER_URL is not a valid URL.");
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function isComposeMediaWorkerHost(hostname: string): boolean {
  return hostname === "media-worker";
}

function detectDocker(input: Required<Pick<ApplianceRuntimeProfileInput, "fileExists" | "readTextFile">>): boolean {
  try {
    if (input.fileExists("/.dockerenv")) {
      return true;
    }
  } catch {
    // Fall through to cgroup detection; one inaccessible sentinel is not decisive.
  }

  try {
    const cgroup = input.readTextFile("/proc/1/cgroup");
    return cgroup !== null && /\b(docker|containerd|kubepods)\b/i.test(cgroup);
  } catch {
    return false;
  }
}

function detectProcessRole(
  env: Record<string, string | undefined>,
  argv: string[],
): ApplianceRuntimeProcessRole {
  const explicitRole = trimEnv(env, "ORDO_RUNTIME_PROCESS_ROLE");
  if (explicitRole === "app" || explicitRole === "media_worker") {
    return explicitRole;
  }

  if (argv.some((arg) => arg.includes("scripts/media-worker-server.ts"))) {
    return "media_worker";
  }

  return "app";
}

export function getApplianceRuntimeProfile(
  input: ApplianceRuntimeProfileInput = {},
): ApplianceRuntimeProfile {
  const env = input.env ?? process.env;
  const cwd = input.cwd ?? process.cwd();
  const argv = input.argv ?? process.argv;
  const warnings: string[] = [];
  const boundary = getApplianceDataBoundary({ env, cwd });
  const nodeEnv = normalizeNodeEnv(env.NODE_ENV);
  const mediaWorkerUrlValue = trimEnv(env, "MEDIA_WORKER_URL");
  const mediaWorkerUrl = parseUrl(mediaWorkerUrlValue, warnings);
  const mediaWorkerHost = mediaWorkerUrl?.hostname ?? null;
  const hasComposeMarker = Boolean(trimEnv(env, "COMPOSE_PROJECT_NAME"))
    || mediaWorkerHost === "media-worker";
  const mediaWorkerDisabled = env.DISABLE_MEDIA_WORKER === "1";
  const deferredWorkerDisabled = env.DISABLE_DEFERRED_JOB_WORKER === "1";
  const explicitMediaMode = trimEnv(env, "ORDO_MEDIA_WORKER_MODE");
  const fileExists = input.fileExists ?? existsSync;
  const readTextFile = input.readTextFile ?? ((filePath: string) => {
    try {
      return readFileSync(filePath, "utf-8");
    } catch {
      return null;
    }
  });
  const isDocker = detectDocker({ fileExists, readTextFile });
  const isCompose = hasComposeMarker;
  const processRole = detectProcessRole(env, argv);
  const mediaWorkerPort = parsePort(trimEnv(env, "MEDIA_WORKER_PORT"))
    ?? parsePort(mediaWorkerUrl?.port ?? null)
    ?? 3101;

  let mediaWorkerMode: MediaWorkerMode;
  if (mediaWorkerDisabled) {
    mediaWorkerMode = "disabled";
  } else if (nodeEnv === "development") {
    mediaWorkerMode = "local_dev";
  } else if (explicitMediaMode === "supervised_child") {
    mediaWorkerMode = "supervised_child";
  } else if (mediaWorkerUrl && isComposeMediaWorkerHost(mediaWorkerUrl.hostname)) {
    mediaWorkerMode = "compose_service";
  } else if (mediaWorkerUrl && !isLoopbackHost(mediaWorkerUrl.hostname)) {
    mediaWorkerMode = "external_url";
  } else {
    mediaWorkerMode = "supervised_child";
  }

  let deferredWorkerMode: DeferredWorkerMode;
  if (deferredWorkerDisabled) {
    deferredWorkerMode = "disabled";
  } else if (nodeEnv === "development") {
    deferredWorkerMode = "local_dev";
  } else if (nodeEnv === "production" || nodeEnv === "test") {
    deferredWorkerMode = "supervised_child";
  } else {
    deferredWorkerMode = "unavailable";
  }

  let profileId: ApplianceRuntimeProfileId;
  if (nodeEnv === "test") {
    profileId = "test";
  } else if (nodeEnv === "development") {
    profileId = "local_dev";
  } else if (hasComposeMarker) {
    profileId = "compose_app";
  } else if (nodeEnv === "production") {
    profileId = "single_image";
  } else {
    profileId = "unknown";
  }

  return {
    profileId,
    processRole,
    nodeEnv,
    isDocker,
    isCompose,
    dataDir: boundary.dataDir,
    sqlitePath: boundary.sqlitePath,
    sqliteInsideDataDir: boundary.sqliteInsideDataDir,
    mediaWorker: {
      mode: mediaWorkerMode,
      url: mediaWorkerDisabled ? null : mediaWorkerUrlValue,
      port: mediaWorkerDisabled ? null : mediaWorkerPort,
      disabled: mediaWorkerDisabled,
    },
    deferredWorker: {
      mode: deferredWorkerMode,
      disabled: deferredWorkerDisabled,
      workerId: trimEnv(env, "DEFERRED_JOB_WORKER_ID"),
    },
    warnings: [...boundary.warnings, ...warnings],
  };
}

export function getApplianceRuntimeProfileSummary(): string {
  const profile = getApplianceRuntimeProfile();
  return [
    `profile=${profile.profileId}`,
    `role=${profile.processRole}`,
    `data=${path.basename(profile.dataDir)}`,
    `media=${profile.mediaWorker.mode}`,
    `deferred=${profile.deferredWorker.mode}`,
  ].join(" ");
}
