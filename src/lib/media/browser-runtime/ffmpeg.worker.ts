/// <reference lib="webworker" />

import { FFmpeg } from "@ffmpeg/ffmpeg";
import type { MediaCompositionPlan } from "@/core/entities/media-composition";
import { getComposeMediaProgressLabel } from "@/lib/media/compose-media-progress";
import { getMediaCompositionProfileSettings, resolveMediaCompositionProfile } from "@/lib/media/ffmpeg/media-composition-profile";
import { MAX_FFMPEG_ASSET_BYTES } from "./ffmpeg-worker-limits";

export class FfmpegAssetTooLargeError extends Error {
  constructor(url: string, bytes: number) {
    super(`Asset too large: ${url} (${bytes} bytes)`);
    this.name = "FfmpegAssetTooLargeError";
  }
}

export interface FfmpegWorkerMessage {
  type: "START_COMPOSITION";
  plan: MediaCompositionPlan;
  visualAssetUrls: Record<string, string>;
  audioAssetUrls: Record<string, string>;
}

export interface FfmpegWorkerResponse {
  type: "PROGRESS" | "SUCCESS" | "ERROR";
  progress?: number;
  label?: string;
  blob?: Blob;
  error?: string;
  failureCode?: string;
  logs?: {
    head: string[];
    tail: string[];
    totalLines: number;
    truncated: boolean;
  };
}

let ffmpeg: FFmpeg | null = null;
const MAX_LOG_LINES = 40;
const ffmpegLogHead: string[] = [];
const ffmpegLogTail: string[] = [];
let ffmpegLogTotalLines = 0;

function appendLogLine(message: string) {
  if (!message) {
    return;
  }

  ffmpegLogTotalLines += 1;
  if (ffmpegLogHead.length < MAX_LOG_LINES) {
    ffmpegLogHead.push(message);
  } else {
    ffmpegLogTail.push(message);
    if (ffmpegLogTail.length > MAX_LOG_LINES) {
      ffmpegLogTail.shift();
    }
  }
}

function resetLogs() {
  ffmpegLogHead.length = 0;
  ffmpegLogTail.length = 0;
  ffmpegLogTotalLines = 0;
}

function buildLogSnapshot() {
  return {
    head: [...ffmpegLogHead],
    tail: [...ffmpegLogTail],
    totalLines: ffmpegLogTotalLines,
    truncated: ffmpegLogTotalLines > MAX_LOG_LINES,
  };
}

async function fetchAssetBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declaredBytes = parseInt(contentLength, 10);
    if (declaredBytes > MAX_FFMPEG_ASSET_BYTES) {
      throw new FfmpegAssetTooLargeError(url, declaredBytes);
    }
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_FFMPEG_ASSET_BYTES) {
    throw new FfmpegAssetTooLargeError(url, buffer.byteLength);
  }
  return new Uint8Array(buffer);
}

async function safeDeleteFile(ff: FFmpeg, fileName: string): Promise<void> {
  try {
    await ff.deleteFile(fileName);
  } catch {
    // Best-effort cleanup only.
  }
}

function getVisualInputFileName(kind: MediaCompositionPlan["visualClips"][number]["kind"], index: number): string {
  if (kind === "image") {
    return `in_v_${index}.png`;
  }

  return `in_v_${index}.mp4`;
}

function getAudioInputFileName(index: number): string {
  return `in_a_${index}.mp3`;
}

function buildConcatListFile(visualClipCount: number): string {
  return Array.from({ length: visualClipCount }, (_, index) => `file 'in_v_${index}.mp4'`).join("\n");
}

function buildExecutionArgs(plan: MediaCompositionPlan, outputName: string): string[] {
  const args: string[] = [];
  const firstVisual = plan.visualClips[0];
  const firstAudio = plan.audioClips[0];
  const resolvedProfile = resolveMediaCompositionProfile(plan);
  const profileSettings = getMediaCompositionProfileSettings(resolvedProfile);

  const isConcatVideoSequence = plan.visualClips.length > 1
    && plan.visualClips.every((clip) => clip.kind === "video")
    && plan.audioClips.length === 0;

  if (isConcatVideoSequence) {
    args.push("-f", "concat", "-safe", "0", "-i", "concat.txt");

    if (plan.outputFormat === "mp4") {
      args.push(
        ...profileSettings.browserEncode.videoCodecArgs,
        "-r",
        String(profileSettings.browserEncode.outputFramerate),
      );

      if (plan.resolution) {
        args.push(
          "-vf",
          `scale=${plan.resolution.width}:${plan.resolution.height},fps=${profileSettings.browserEncode.outputFramerate}`,
        );
      }

      args.push(...profileSettings.browserEncode.audioCodecArgs, "-movflags", "+faststart");
    } else {
      args.push("-c:v", "libvpx-vp9", "-c:a", "libopus");
      if (plan.resolution) {
        args.push(
          "-vf",
          `scale=${plan.resolution.width}:${plan.resolution.height},fps=${profileSettings.browserEncode.outputFramerate}`,
        );
      }
    }

    args.push(outputName);
    return args;
  }

  if (firstVisual?.kind === "image") {
    args.push(
      "-loop",
      "1",
      "-framerate",
      String(profileSettings.browserEncode.imageInputFramerate),
      "-i",
      getVisualInputFileName(firstVisual.kind, 0),
    );

    if (firstAudio) {
      args.push("-i", getAudioInputFileName(0));
      args.push(
        ...profileSettings.browserEncode.videoCodecArgs,
        "-r",
        String(profileSettings.browserEncode.outputFramerate),
        "-vf",
        `scale=${plan.resolution?.width ?? 720}:${plan.resolution?.height ?? 1280},fps=${profileSettings.browserEncode.outputFramerate}`,
        ...profileSettings.browserEncode.audioCodecArgs,
        "-shortest",
        "-movflags",
        "+faststart",
      );
    } else {
      args.push(
        "-t",
        String(firstVisual.duration ?? 5),
        ...profileSettings.browserEncode.videoCodecArgs,
        "-r",
        String(profileSettings.browserEncode.outputFramerate),
        "-vf",
        `scale=${plan.resolution?.width ?? 720}:${plan.resolution?.height ?? 1280},fps=${profileSettings.browserEncode.outputFramerate}`,
        "-movflags",
        "+faststart",
      );
    }

    args.push(outputName);
    return args;
  }

  if (plan.visualClips.length > 0) {
    args.push("-i", getVisualInputFileName(plan.visualClips[0].kind, 0));
    if (firstAudio) {
      args.push("-i", getAudioInputFileName(0));
      args.push(
        ...profileSettings.browserEncode.videoCodecArgs,
        "-r",
        String(profileSettings.browserEncode.outputFramerate),
      );
      if (plan.resolution) {
        args.push(
          "-vf",
          `scale=${plan.resolution.width}:${plan.resolution.height},fps=${profileSettings.browserEncode.outputFramerate}`,
        );
      }
      args.push(...profileSettings.browserEncode.audioCodecArgs, "-shortest", "-movflags", "+faststart");
    } else {
      args.push(
        ...profileSettings.browserEncode.videoCodecArgs,
        "-r",
        String(profileSettings.browserEncode.outputFramerate),
      );
      if (plan.resolution) {
        args.push(
          "-vf",
          `scale=${plan.resolution.width}:${plan.resolution.height},fps=${profileSettings.browserEncode.outputFramerate}`,
        );
      }
      if (plan.outputFormat === "mp4") {
        args.push("-movflags", "+faststart");
      }
    }
    args.push(outputName);
    return args;
  }

  if (firstAudio) {
    args.push("-i", getAudioInputFileName(0), "-c:a", "libmp3lame", outputName);
    return args;
  }

  throw new Error("Media composition plan has no executable clips.");
}

async function getFfmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  ffmpeg = new FFmpeg();

  ffmpeg.on("log", ({ message }) => {
    appendLogLine(message);
  });

  ffmpeg.on("progress", ({ progress }) => {
    const currentPlan = (self as DedicatedWorkerGlobalScope & { __ordoComposePlan?: MediaCompositionPlan }).__ordoComposePlan;
    const progressPercent = Math.min(progress * 100, 99);
    postMessage({
      type: "PROGRESS",
      progress: progressPercent,
      label: getComposeMediaProgressLabel("rendering_media", {
        ...(currentPlan ? { plan: currentPlan } : {}),
        progressPercent,
      }),
    } as FfmpegWorkerResponse);
  });

  // Load core from self-hosted public dir (COEP-safe: same-origin, no CDN)
  const baseURL = self.location.origin;
  await ffmpeg.load({
    classWorkerURL: `${baseURL}/ffmpeg-core/ffmpeg-worker.js`,
    coreURL: `${baseURL}/ffmpeg-core/ffmpeg-core.js`,
    wasmURL: `${baseURL}/ffmpeg-core/ffmpeg-core.wasm`,
    workerURL: `${baseURL}/ffmpeg-core/ffmpeg-core.worker.js`,
  });

  return ffmpeg;
}

self.onmessage = async (event: MessageEvent<FfmpegWorkerMessage>) => {
  const { type, plan, visualAssetUrls, audioAssetUrls } = event.data;
  
  if (type !== "START_COMPOSITION") return;

  resetLogs();
  const stagedFiles: string[] = [];
  let ff: FFmpeg | null = null;

  try {
    (self as DedicatedWorkerGlobalScope & { __ordoComposePlan?: MediaCompositionPlan }).__ordoComposePlan = plan;

    postMessage({
      type: "PROGRESS",
      progress: 0,
      label: getComposeMediaProgressLabel("staging_assets", { plan, progressPercent: 0 }),
    } as FfmpegWorkerResponse);
    ff = await getFfmpeg();

    postMessage({
      type: "PROGRESS",
      progress: 10,
      label: getComposeMediaProgressLabel("staging_assets", { plan, progressPercent: 10 }),
    } as FfmpegWorkerResponse);

    // Write visual layers
    for (let i = 0; i < plan.visualClips.length; i++) {
      const clip = plan.visualClips[i];
      const data = await fetchAssetBytes(visualAssetUrls[clip.assetId]);
      const inputFileName = getVisualInputFileName(clip.kind, i);
      await ff.writeFile(inputFileName, data);
      stagedFiles.push(inputFileName);
    }

    // Write audio layers
    for (let i = 0; i < plan.audioClips.length; i++) {
      const clip = plan.audioClips[i];
      const data = await fetchAssetBytes(audioAssetUrls[clip.assetId]);
      const inputFileName = getAudioInputFileName(i);
      await ff.writeFile(inputFileName, data);
      stagedFiles.push(inputFileName);
    }

    const shouldConcatVideos = plan.visualClips.length > 1
      && plan.visualClips.every((clip) => clip.kind === "video")
      && plan.audioClips.length === 0;

    if (shouldConcatVideos) {
      await ff.writeFile("concat.txt", buildConcatListFile(plan.visualClips.length));
      stagedFiles.push("concat.txt");
    }

    postMessage({
      type: "PROGRESS",
      progress: 30,
      label: getComposeMediaProgressLabel("staging_assets", { plan, progressPercent: 30 }),
    } as FfmpegWorkerResponse);

    const outputName = plan.outputFormat === "mp4" ? "output.mp4" : "output.webm";
    const args = buildExecutionArgs(plan, outputName);

    postMessage({
      type: "PROGRESS",
      progress: 40,
      label: getComposeMediaProgressLabel("rendering_media", { plan, progressPercent: 40 }),
    } as FfmpegWorkerResponse);

    const exitCode = await ff.exec(args);
    if (exitCode !== 0) {
      throw new Error(`FFmpeg exited with code ${exitCode}.`);
    }

    postMessage({
      type: "PROGRESS",
      progress: 99,
      label: getComposeMediaProgressLabel("packaging_artifacts", { plan, progressPercent: 99 }),
    } as FfmpegWorkerResponse);
    
    const fileData = await ff.readFile(outputName);
    if (!(fileData instanceof Uint8Array) || fileData.byteLength === 0) {
      throw new Error(`FFmpeg produced an empty output artifact.`);
    }

    const blob = new Blob([fileData as BlobPart], { type: plan.outputFormat === "mp4" ? "video/mp4" : "video/webm" });

    // Cleanup memory
    for (const stagedFile of stagedFiles) {
      await safeDeleteFile(ff, stagedFile);
    }
    await safeDeleteFile(ff, outputName);

    postMessage({ type: "SUCCESS", blob, logs: buildLogSnapshot() } as FfmpegWorkerResponse);
  } catch (error) {
    // Cleanup any staged files on error
    if (ff) {
      for (const stagedFile of stagedFiles) {
        await safeDeleteFile(ff, stagedFile);
      }
    }
    // Reset FFmpeg instance so the next run gets a fresh one
    ffmpeg = null;

    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);
    const failureCode = error instanceof FfmpegAssetTooLargeError ? "asset_too_large" : undefined;
    postMessage({
      type: "ERROR",
      error: errorMessage,
      logs: buildLogSnapshot(),
      ...(failureCode !== undefined ? { failureCode } : {}),
    } as FfmpegWorkerResponse);
  } finally {
    delete (self as DedicatedWorkerGlobalScope & { __ordoComposePlan?: MediaCompositionPlan }).__ordoComposePlan;
  }
};

export const __ffmpegWorkerTestables = {
  fetchAssetBytes,
};
