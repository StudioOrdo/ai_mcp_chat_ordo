import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { expect, type Locator, type Page } from "@playwright/test";

import { backdateRegisterFormStart, finishRegisterNavigation } from "./public-form";

export const PNG_UPLOAD_FIXTURE_PATH = path.join(process.cwd(), "public", "ordo-avatar.png");

export type ManifestEntry = {
  key: string;
  label: string;
  kind: "image" | "audio" | "video";
  assetId: string;
  uri: string;
  mimeType?: string;
  note?: string;
};

export type BrowserDiagnosticSummary = {
  crossOriginIsolated: boolean;
  hasSharedArrayBuffer: boolean;
  userAgent: string;
  viewport: { width: number; height: number };
};

export type ConsoleRecord = {
  type: string;
  text: string;
  location?: string;
};

export type RequestFailureRecord = {
  url: string;
  method: string;
  errorText: string;
};

export type ResponseRecord = {
  url: string;
  method: string;
  status: number;
};

export type NavigationRecord = {
  url: string;
};

export type DebugObserverState = {
  consoleRecords: ConsoleRecord[];
  requestFailures: RequestFailureRecord[];
  responses: ResponseRecord[];
  navigations: NavigationRecord[];
  pageErrors: string[];
};

export type MediaInvocationEvidence = {
  conversationId: string | null;
  streamIds: string[];
  toolInvocationIds: string[];
  jobIds: string[];
  inputAssetIds: string[];
  derivativeAssetIds: string[];
  finalAssetIds: string[];
  runtimeRoutes: string[];
  transcriptEntryCountByInvocation: Record<string, number>;
  renderedCardCountByInvocation: Record<string, number>;
};

export function ensureDirectory(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function createRunDirectory(rootDir: string) {
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const runDir = path.join(rootDir, runId);
  ensureDirectory(runDir);
  return { runId, runDir };
}

export function writeJson(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pushUnique(values: string[], value: unknown) {
  if (typeof value === "string" && value.trim().length > 0 && !values.includes(value)) {
    values.push(value);
  }
}

function collectInvocationEvidenceFromValue(
  value: unknown,
  evidence: MediaInvocationEvidence,
) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectInvocationEvidenceFromValue(entry, evidence);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  pushUnique(evidence.streamIds, value.streamId);
  pushUnique(evidence.toolInvocationIds, value.toolInvocationId);
  pushUnique(evidence.jobIds, value.jobId);
  pushUnique(evidence.jobIds, value.browserRuntimeJobId);
  pushUnique(evidence.inputAssetIds, value.assetId);
  pushUnique(evidence.inputAssetIds, value.sourceAssetId);
  pushUnique(evidence.derivativeAssetIds, value.derivativeOfAssetId);
  pushUnique(evidence.finalAssetIds, value.primaryAssetId);
  pushUnique(evidence.runtimeRoutes, value.route);

  if (value.type === "tool_result" && typeof value.toolInvocationId === "string") {
    evidence.transcriptEntryCountByInvocation[value.toolInvocationId] =
      (evidence.transcriptEntryCountByInvocation[value.toolInvocationId] ?? 0) + 1;
  }

  for (const nested of Object.values(value)) {
    collectInvocationEvidenceFromValue(nested, evidence);
  }
}

export async function collectRenderedInvocationCardCounts(page: Page): Promise<Record<string, number>> {
  return await page.locator("[data-tool-invocation-id]").evaluateAll((elements) => {
    const counts: Record<string, number> = {};
    for (const element of elements) {
      const id = element.getAttribute("data-tool-invocation-id");
      if (!id) continue;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  }).catch(() => ({}));
}

export async function buildMediaInvocationEvidence(options: {
  page: Page;
  conversationId?: string | null;
  messages?: unknown[];
  manifest?: ManifestEntry[];
}): Promise<MediaInvocationEvidence> {
  const evidence: MediaInvocationEvidence = {
    conversationId: options.conversationId ?? null,
    streamIds: [],
    toolInvocationIds: [],
    jobIds: [],
    inputAssetIds: [],
    derivativeAssetIds: [],
    finalAssetIds: [],
    runtimeRoutes: [],
    transcriptEntryCountByInvocation: {},
    renderedCardCountByInvocation: await collectRenderedInvocationCardCounts(options.page),
  };

  collectInvocationEvidenceFromValue(options.messages ?? [], evidence);
  for (const entry of options.manifest ?? []) {
    pushUnique(evidence.finalAssetIds, entry.assetId);
  }

  return evidence;
}

export function runMediaCommand(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: "utf8" });

  if (result.error) {
    throw new Error(`${command} is required for media eval validation: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} failed during media eval.${details ? `\n${details}` : ""}`);
  }

  return result;
}

export function probeMediaFile(filePath: string) {
  const result = runMediaCommand("ffprobe", [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    filePath,
  ]);

  return JSON.parse(result.stdout) as {
    streams?: Array<Record<string, unknown>>;
    format?: Record<string, unknown>;
  };
}

export function measureAudioVolume(filePath: string): { maxVolume: string | null; meanVolume: string | null } {
  const result = runMediaCommand("ffmpeg", [
    "-hide_banner",
    "-i",
    filePath,
    "-map",
    "0:a:0",
    "-af",
    "volumedetect",
    "-f",
    "null",
    "-",
  ]);

  const output = `${result.stdout}\n${result.stderr}`;
  return {
    maxVolume: output.match(/max_volume:\s+([^\s]+)/)?.[1] ?? null,
    meanVolume: output.match(/mean_volume:\s+([^\s]+)/)?.[1] ?? null,
  };
}

export function isRelevantMediaApiUrl(url: string): boolean {
  return url.includes("/api/e2e/media/generated-image")
    || url.includes("/api/tts")
    || url.includes("/api/chat/uploads")
    || url.includes("/api/user-files/")
    || url.includes("/api/preferences")
    || url.includes("/api/chat/events")
    || url.includes("/api/chat/stream")
    || url.includes("/api/chat/jobs")
    || url.includes("/api/conversations/active");
}

export function attachDebugObservers(
  page: Page,
  predicate: (url: string) => boolean = isRelevantMediaApiUrl,
): DebugObserverState {
  const state: DebugObserverState = {
    consoleRecords: [],
    requestFailures: [],
    responses: [],
    navigations: [],
    pageErrors: [],
  };

  page.on("console", (message) => {
    if (message.type() === "log" || message.type() === "info") {
      return;
    }

    state.consoleRecords.push({
      type: message.type(),
      text: message.text(),
      location: message.location().url
        ? `${message.location().url}:${message.location().lineNumber ?? 0}`
        : undefined,
    });
  });

  page.on("pageerror", (error) => {
    state.pageErrors.push(error.message);
  });

  page.on("requestfailed", (request) => {
    if (!predicate(request.url())) {
      return;
    }

    state.requestFailures.push({
      url: request.url(),
      method: request.method(),
      errorText: request.failure()?.errorText ?? "unknown",
    });
  });

  page.on("response", (response) => {
    if (!predicate(response.url())) {
      return;
    }

    state.responses.push({
      url: response.url(),
      method: response.request().method(),
      status: response.status(),
    });
  });

  page.on("framenavigated", (frame) => {
    if (frame !== page.mainFrame()) {
      return;
    }

    state.navigations.push({ url: frame.url() });
  });

  return state;
}

export async function registerFreshUser(
  page: Page,
  options?: {
    displayName?: string;
    emailPrefix?: string;
    password?: string;
  },
) {
  const emailPrefix = options?.emailPrefix ?? "media-eval";
  const email = `${emailPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = options?.password ?? "MediaEval!Pass123";

  await backdateRegisterFormStart(page);
  await page.goto("/register");
  await page.getByLabel("Name").fill(options?.displayName ?? "Media Eval User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await finishRegisterNavigation(page);

  return { email, password };
}

export async function copyUploadFixture(runDir: string, fileName: string) {
  const uploadPath = path.join(runDir, fileName);
  fs.copyFileSync(PNG_UPLOAD_FIXTURE_PATH, uploadPath);
  return uploadPath;
}

export async function downloadAuthenticatedAsset(options: {
  page: Page;
  baseURL: string;
  uri: string;
  destinationPath: string;
}) {
  const cookies = await options.page.context().cookies();
  const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  const response = await fetch(new URL(options.uri, options.baseURL), {
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${options.uri} (${response.status}).`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(options.destinationPath, bytes);
}

export async function fetchAuthenticatedJson<T>(options: {
  page: Page;
  baseURL: string;
  uri: string;
}): Promise<T> {
  const cookies = await options.page.context().cookies();
  const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  const response = await fetch(new URL(options.uri, options.baseURL), {
    headers: {
      Accept: "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${options.uri} (${response.status}).`);
  }

  return await response.json() as T;
}

export async function collectBrowserDiagnostics(page: Page): Promise<BrowserDiagnosticSummary> {
  return await page.evaluate(() => ({
    crossOriginIsolated: self.crossOriginIsolated,
    hasSharedArrayBuffer: typeof SharedArrayBuffer === "function",
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  }));
}

export async function collectWorkflowStatuses(page: Page) {
  return await page.locator('[data-testid^="status-"]').evaluateAll((nodes) => nodes.map((node) => ({
    testId: node.getAttribute("data-testid"),
    text: node.textContent?.replace(/\s+/g, " ").trim() ?? "",
  })));
}

export async function readMediaLabManifest(page: Page): Promise<ManifestEntry[]> {
  const manifest = await page.evaluate(() => window.ordoMediaE2E?.getManifest() ?? []);
  return manifest as ManifestEntry[];
}

export async function assertVideoLocatorPlayable(locator: Locator) {
  await expect(locator).toBeVisible({ timeout: 60_000 });

  await locator.evaluate(async (video: HTMLVideoElement) => {
    video.muted = true;
    await video.play();
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Timed out waiting for playback progress.")), 15000);
      const onTimeUpdate = () => {
        if (video.currentTime > 0.1) {
          window.clearTimeout(timeout);
          video.removeEventListener("timeupdate", onTimeUpdate);
          resolve();
        }
      };
      video.addEventListener("timeupdate", onTimeUpdate);
    });
    video.pause();
  });

  return await locator.evaluate((video: HTMLVideoElement) => ({
    readyState: video.readyState,
    currentTime: video.currentTime,
    duration: video.duration,
  }));
}