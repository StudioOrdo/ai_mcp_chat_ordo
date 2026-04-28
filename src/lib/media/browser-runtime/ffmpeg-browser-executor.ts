import type { MediaCompositionPlan } from "@/core/entities/media-composition";
import type { CapabilityResultEnvelope } from "@/core/entities/capability-result";
import type { AssetReferenceRepair } from "@/lib/media/ffmpeg/media-composition-plan";
import type { BrowserRuntimeTruncationDiagnostic } from "./runtime-diagnostics";
import { probeFfmpegWasmCapability } from "./ffmpeg-capability-probe";
import type { FfmpegWorkerMessage, FfmpegWorkerResponse } from "./ffmpeg.worker";
import {
  COMPOSE_MEDIA_ARTIFACT_LABEL,
  COMPOSE_MEDIA_COMPLETE_LABEL,
  getComposeMediaProgressLabel,
} from "@/lib/media/compose-media-progress";
import { getMediaCompositionProfileSettings, resolveMediaCompositionProfile } from "@/lib/media/ffmpeg/media-composition-profile";

export type BrowserExecutorStatus = "succeeded" | "failed" | "fallback_required";

export interface BrowserMediaExecutorResult {
  status: BrowserExecutorStatus;
  envelope?: CapabilityResultEnvelope;
  failureCode?: string;
}

export interface BrowserMediaExecutorContext {
  conversationId: string | null;
  userId: string;
  toolInvocationId?: string;
  repairs?: readonly AssetReferenceRepair[];
  truncations?: readonly BrowserRuntimeTruncationDiagnostic[];
}

/**
 * Resolves public-facing URLs for each asset ID so the worker can fetch them.
 * Visual and audio clips reference stored user-file asset IDs → served via /api/user-files/:id.
 */
function buildAssetUrlMaps(plan: MediaCompositionPlan): {
  visualAssetUrls: Record<string, string>;
  audioAssetUrls: Record<string, string>;
} {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const visualAssetUrls: Record<string, string> = {};
  for (const clip of plan.visualClips) {
    visualAssetUrls[clip.assetId] = `${origin}/api/user-files/${clip.assetId}`;
  }
  const audioAssetUrls: Record<string, string> = {};
  for (const clip of plan.audioClips) {
    audioAssetUrls[clip.assetId] = `${origin}/api/user-files/${clip.assetId}`;
  }
  return { visualAssetUrls, audioAssetUrls };
}

/**
 * Uploads the raw MP4 Blob produced by the worker to /api/chat/uploads so it
 * becomes a governed user-file with a stable assetId.
 */
async function uploadResultBlob(
  blob: Blob,
  plan: MediaCompositionPlan,
  context: BrowserMediaExecutorContext,
  signal: AbortSignal,
): Promise<string> {
  if (blob.size === 0) {
    throw new Error("Browser FFmpeg returned an empty media artifact.");
  }

  const filename = `composition-${plan.id}.${plan.outputFormat}`;
  const file = new File([blob], filename, { type: blob.type });

  const formData = new FormData();
  formData.append("files", file);
  if (context.conversationId) {
    formData.append("conversationId", context.conversationId);
  }
  if (context.toolInvocationId) {
    formData.append("toolInvocationId", context.toolInvocationId);
  }

  const response = await fetch("/api/chat/uploads", {
    method: "POST",
    body: formData,
    signal,
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(json?.error ?? `Upload failed (${response.status})`);
  }

  const json = await response.json() as {
    attachments?: Array<{ assetId: string; mimeType: string }>;
  };
  const assetId = json.attachments?.[0]?.assetId;
  if (!assetId) {
    throw new Error("Upload succeeded but returned no assetId");
  }
  return assetId;
}

/**
 * FfmpegBrowserExecutor — the real browser-side WASM executor.
 *
 * Spawns ffmpeg.worker.ts in a dedicated Web Worker, sends the composition
 * plan, collects progress events, and on success uploads the MP4 blob to the
 * governed asset store.  Returns a canonical CapabilityResultEnvelope.
 *
 * Contract: must NEVER execute on the main thread — only orchestrates.
 */
export class FfmpegBrowserExecutor {
  async execute(
    plan: MediaCompositionPlan,
    context: BrowserMediaExecutorContext,
    onProgress?: (progress: number, label: string) => void,
    signal?: AbortSignal,
  ): Promise<BrowserMediaExecutorResult> {
    // 1. Probe capability before spinning up a worker
    const probe = probeFfmpegWasmCapability();
    if (!probe.isAvailable) {
      return {
        status: "fallback_required",
        failureCode: probe.reason ?? "wasm_unavailable",
      };
    }

    const abortController = new AbortController();
    const combinedSignal = signal ?? abortController.signal;

    return new Promise<BrowserMediaExecutorResult>((resolve) => {
      // Dynamic import path resolved by the bundler. Next.js treats new Worker(new URL(...))
      // as a Web Worker entry point and bundles it separately.
      const worker = new Worker(
        new URL("./ffmpeg.worker.ts", import.meta.url),
        { type: "module" },
      );

      const abort = () => {
        worker.terminate();
        resolve({ status: "fallback_required", failureCode: "aborted" });
      };

      if (combinedSignal.aborted) {
        abort();
        return;
      }
      combinedSignal.addEventListener("abort", abort, { once: true });

      worker.onmessage = async (event: MessageEvent<FfmpegWorkerResponse>) => {
        const msg = event.data;

        if (msg.type === "PROGRESS") {
          onProgress?.(msg.progress ?? 0, msg.label ?? "Processing");
          return;
        }

        if (msg.type === "ERROR") {
          combinedSignal.removeEventListener("abort", abort);
          worker.terminate();
          resolve({ status: "failed", failureCode: msg.error ?? "worker_error" });
          return;
        }

        if (msg.type === "SUCCESS" && msg.blob) {
          combinedSignal.removeEventListener("abort", abort);
          worker.terminate();

          try {
            onProgress?.(99, getComposeMediaProgressLabel("persisting", { plan, progressPercent: 99 }));
            const assetId = await uploadResultBlob(msg.blob, plan, context, combinedSignal);
            onProgress?.(100, COMPOSE_MEDIA_COMPLETE_LABEL);
            const resolvedProfile = resolveMediaCompositionProfile(plan);
            const profileSettings = getMediaCompositionProfileSettings(resolvedProfile);

            const envelope: CapabilityResultEnvelope = {
              schemaVersion: 1,
              toolName: "compose_media",
              family: "artifact",
              cardKind: "artifact_viewer",
              executionMode: "hybrid",
              inputSnapshot: {
                planId: plan.id,
                visualClips: plan.visualClips.length,
                audioClips: plan.audioClips.length,
                profile: resolvedProfile,
                subtitlePolicy: plan.subtitlePolicy,
                outputFormat: plan.outputFormat,
                resolution: plan.resolution ?? null,
              },
              summary: {
                title: "Media Composition",
                subtitle: `${plan.outputFormat.toUpperCase()} · Browser WASM · ${profileSettings.label} · ${plan.resolution?.width ?? 0}x${plan.resolution?.height ?? 0}`,
                statusLine: "succeeded",
              },
              replaySnapshot: {
                route: "browser_wasm",
                planId: plan.id,
                profile: resolvedProfile,
                outputFormat: plan.outputFormat,
                resolution: plan.resolution ?? null,
              },
              progress: { percent: 100, label: COMPOSE_MEDIA_COMPLETE_LABEL },
              artifacts: [
                {
                  kind: "video",
                  label: COMPOSE_MEDIA_ARTIFACT_LABEL,
                  mimeType: `video/${plan.outputFormat}`,
                  assetId,
                  uri: `/api/user-files/${assetId}`,
                  width: plan.resolution?.width,
                  height: plan.resolution?.height,
                  retentionClass: context.conversationId ? "conversation" : "ephemeral",
                  source: "generated",
                  ...(context.toolInvocationId ? { toolInvocationId: context.toolInvocationId } : {}),
                },
              ],
              payload: {
                route: "browser_wasm",
                planId: plan.id,
                profile: resolvedProfile,
                primaryAssetId: assetId,
                outputFormat: plan.outputFormat,
                resolution: plan.resolution ?? null,
                ...(context.toolInvocationId ? { toolInvocationId: context.toolInvocationId } : {}),
              },
            };

            resolve({ status: "succeeded", envelope });
          } catch (uploadErr) {
            resolve({
              status: "failed",
              failureCode: uploadErr instanceof Error ? uploadErr.message : "upload_failed",
            });
          }
          return;
        }
      };

      worker.onerror = (err) => {
        combinedSignal.removeEventListener("abort", abort);
        worker.terminate();
        resolve({ status: "failed", failureCode: err.message ?? "worker_init_error" });
      };

      // 2. Kick off the composition
      const { visualAssetUrls, audioAssetUrls } = buildAssetUrlMaps(plan);
      const message: FfmpegWorkerMessage = {
        type: "START_COMPOSITION",
        plan,
        visualAssetUrls,
        audioAssetUrls,
      };
      worker.postMessage(message);
    });
  }
}
