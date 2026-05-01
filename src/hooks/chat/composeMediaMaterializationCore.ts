import type { Dispatch } from "react";

import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import {
  canonicalJobSnapshotToStatusPart,
  isCanonicalJobSnapshot,
} from "@/lib/jobs/job-read-model";
import type {
  MediaAssetKind,
  MediaAssetRetentionClass,
  MediaAssetSource,
} from "@/core/entities/media-asset";
import type { MediaCompositionPlan } from "@/core/entities/media-composition";
import type { ChatAction } from "./chatState";
import type { BrowserJobOrchestration } from "./useBrowserJobOrchestration";
import type { RuntimeSnapshots } from "./useRuntimeSnapshots";
import {
  type AssetResolutionIndex,
  type ResolvedChartRuntimePayload,
  type ResolvedGraphRuntimePayload,
} from "./useAssetResolutionIndex";
import {
  buildBrowserRuntimeJobStatusPart,
  type getBrowserRuntimeCandidates,
} from "@/lib/media/browser-runtime/job-snapshots";
import { FfmpegBrowserExecutor } from "@/lib/media/browser-runtime/ffmpeg-browser-executor";
import {
  getGraphTableTruncationDiagnostic,
  renderGraphToPngBlob,
} from "@/lib/media/browser-runtime/graph-image-derivation";
import {
  getMermaidNodeTruncationDiagnostic,
  renderMermaidChartToPngBlob,
} from "@/lib/media/browser-runtime/mermaid-image-derivation";
import {
  VideoPlaybackVerificationError,
  waitForPlayableVideoAsset,
} from "@/lib/media/browser-runtime/video-asset-readiness";
import {
  COMPOSE_MEDIA_COMPLETE_LABEL,
  COMPOSE_MEDIA_FAILURE_LABEL,
  COMPOSE_MEDIA_REROUTING_LABEL,
  getComposeMediaProgressLabel,
} from "@/lib/media/compose-media-progress";
import {
  evaluateComposeMediaAssetReadiness,
  type ComposeMediaAssetReadinessEntry,
  type ComposeMediaPreflightFailureCode,
} from "@/lib/media/compose-media-preflight";
import {
  canonicalizeMediaCompositionPlanWithRepairs,
  InvalidMediaCompositionPlanAssetReferenceError,
  normalizeMediaCompositionPlan,
  validateExecutablePlanConstraints,
  type AssetReferenceRepair,
} from "@/lib/media/ffmpeg/media-composition-plan";
import {
  ComposeMediaCorsError,
  ComposeMediaEmptyAssetError,
  ComposeMediaError,
  ComposeMediaForbiddenError,
  COMPOSE_MEDIA_INVALID_PLAN_FAILURE_CODE,
  ComposeMediaMalformedAssetError,
  ComposeMediaNetworkError,
  ComposeMediaNotFoundError,
  ComposeMediaPersistenceError,
  ComposeMediaRenderError,
  COMPOSE_MEDIA_SOURCE_REHYDRATION_FAILURE_CODE,
  ComposeMediaSourceRehydrationError,
  isComposeMediaInvalidPlanErrorCode,
} from "@/lib/media/compose-media-errors";
import {
  parseStoredChartSource,
  parseStoredGraphSource,
} from "@/lib/media/compose-media-source-rehydration";
import {
  burnCaptionIntoImageBlob,
  measureCaptionLineTruncation,
} from "@/lib/media/browser-runtime/browser-short-caption-burn";
import type { BrowserRuntimeTruncationDiagnostic } from "@/lib/media/browser-runtime/runtime-diagnostics";
import { sortTruncationDiagnostics } from "@/lib/media/browser-runtime/runtime-diagnostics";
import {
  canRerouteBrowserShortExplainerPlan,
  getBrowserShortExplainerBeatCaptions,
  isBrowserShortExplainerPlan,
} from "@/lib/media/ffmpeg/browser-short-explainer";

type BrowserRuntimeCandidate = ReturnType<typeof getBrowserRuntimeCandidates>[number];

type BrowserRuntimeStoredAsset = {
  assetId: string;
  mimeType: string;
  assetKind?: MediaAssetKind;
  source?: MediaAssetSource;
  retentionClass?: MediaAssetRetentionClass;
};

type StoredSourceFetchResult<TPayload> = {
  payload: TPayload | null;
  error: ComposeMediaError | null;
};

export type ComposeMediaPlanResolutionStage = "local_execution" | "recovery";

export type ComposeMediaPlanResolution = {
  plan: MediaCompositionPlan | null;
  error: string | null;
  failureCode: string | null;
  failureStage: ComposeMediaPlanResolutionStage | null;
  repairs: readonly AssetReferenceRepair[];
};

export class ComposeMediaDeferredEnqueueError extends Error {
  constructor(
    message: string,
    public readonly failureCode: string = "deferred_enqueue_failed",
  ) {
    super(message);
    this.name = "ComposeMediaDeferredEnqueueError";
  }
}

function toFileStem(value: string | undefined, fallback: string): string {
  const normalized = (value ?? fallback)
    .trim()
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || fallback;
}

function inferAssetKindFromMimeType(mimeType: string | null): MediaAssetKind | null {
  if (!mimeType) {
    return null;
  }

  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "text/vnd.mermaid") return "chart";
  if (mimeType === "application/vnd.studioordo.graph+json") return "graph";

  return null;
}

function resolveComposeMediaRuntimeFailure(error: unknown): {
  error: string;
  failureCode: string;
  failureStage: "local_execution" | "playback_verification";
} {
  if (error instanceof VideoPlaybackVerificationError) {
    return {
      error: error.message,
      failureCode: error.code,
      failureStage: "playback_verification",
    };
  }

  return {
    error: error instanceof Error ? error.message : String(error),
    failureCode: "runtime_exception",
    failureStage: "local_execution",
  };
}

async function uploadBrowserRuntimeAsset(options: {
  file: File;
  conversationId: string | null;
  derivativeOfAssetId?: string;
  signal: AbortSignal;
}): Promise<BrowserRuntimeStoredAsset> {
  const formData = new FormData();
  formData.append("files", options.file);
  if (options.conversationId) {
    formData.append("conversationId", options.conversationId);
  }
  if (options.derivativeOfAssetId) {
    formData.append("derivativeOfAssetId", options.derivativeOfAssetId);
  }

  const response = await fetch("/api/chat/uploads", {
    method: "POST",
    body: formData,
    signal: options.signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new ComposeMediaPersistenceError(
      payload?.error || `Asset persistence failed (${response.status}).`,
      options.derivativeOfAssetId,
    );
  }

  const payload = await response.json() as {
    attachments?: Array<{
      assetId: string;
      mimeType: string;
      assetKind?: MediaAssetKind;
      source?: MediaAssetSource;
      retentionClass?: MediaAssetRetentionClass;
    }>;
  };
  const stored = payload.attachments?.[0];

  if (!stored?.assetId || !stored.mimeType) {
    throw new ComposeMediaPersistenceError(
      "Asset persistence completed without returning stored asset metadata.",
      options.derivativeOfAssetId,
    );
  }

  return stored;
}

function createStoredAssetFetchError(assetId: string, response: Response, assetLabel: string): ComposeMediaError {
  if (response.type === "opaque" || response.status === 0) {
    return new ComposeMediaCorsError(
      `Governed ${assetLabel} source asset ${assetId} could not be retrieved for video composition because the browser blocked the response.`,
      assetId,
    );
  }

  if (response.status === 404) {
    return new ComposeMediaNotFoundError(
      `Governed ${assetLabel} source asset ${assetId} could not be found for video composition.`,
      assetId,
    );
  }

  if (response.status === 403) {
    return new ComposeMediaForbiddenError(
      `Governed ${assetLabel} source asset ${assetId} is not accessible for video composition.`,
      assetId,
    );
  }

  return new ComposeMediaSourceRehydrationError(
    `Governed ${assetLabel} source asset ${assetId} could not be retrieved for video composition (${response.status}).`,
    COMPOSE_MEDIA_SOURCE_REHYDRATION_FAILURE_CODE,
    assetId,
  );
}

function createStoredAssetNetworkError(assetId: string, assetLabel: string, cause: unknown): ComposeMediaError {
  if (cause instanceof ComposeMediaError) {
    return cause;
  }

  if (cause instanceof TypeError) {
    return new ComposeMediaNetworkError(
      `Governed ${assetLabel} source asset ${assetId} could not be retrieved for video composition because the network request failed.`,
      assetId,
      { cause },
    );
  }

  return new ComposeMediaSourceRehydrationError(
    `Governed ${assetLabel} source asset ${assetId} could not be retrieved for video composition.`,
    COMPOSE_MEDIA_SOURCE_REHYDRATION_FAILURE_CODE,
    assetId,
    { cause },
  );
}

async function renderChartPngBlob(chartCode: string, assetId: string): Promise<Blob> {
  try {
    return await renderMermaidChartToPngBlob(chartCode);
  } catch (error) {
    throw new ComposeMediaRenderError(
      `Governed chart source asset ${assetId} could not be rendered for video composition.`,
      assetId,
      { cause: error },
    );
  }
}

async function renderGraphPngBlob(graph: ResolvedGraphRuntimePayload, assetId: string): Promise<Blob> {
  try {
    return await renderGraphToPngBlob(graph);
  } catch (error) {
    throw new ComposeMediaRenderError(
      `Governed graph source asset ${assetId} could not be rendered for video composition.`,
      assetId,
      { cause: error },
    );
  }
}

async function burnCaptionedImageBlob(options: {
  imageBlob: Blob;
  caption: string;
  resolution?: { width: number; height: number } | null;
  assetId: string;
}): Promise<Blob> {
  try {
    return await burnCaptionIntoImageBlob({
      imageBlob: options.imageBlob,
      caption: options.caption,
      resolution: options.resolution,
    });
  } catch (error) {
    throw new ComposeMediaRenderError(
      `Governed image asset ${options.assetId} could not be captioned for video composition.`,
      options.assetId,
      { cause: error },
    );
  }
}

async function fetchStoredChartPayloadByAssetId(options: {
  assetId: string;
  signal: AbortSignal;
}): Promise<StoredSourceFetchResult<ResolvedChartRuntimePayload>> {
  try {
    const response = await fetch(`/api/user-files/${encodeURIComponent(options.assetId)}`, {
      method: "GET",
      signal: options.signal,
    });

    if (!response.ok) {
      return {
        payload: null,
        error: createStoredAssetFetchError(options.assetId, response, "chart"),
      };
    }

    const code = await response.text();
    if (!code.trim()) {
      return {
        payload: null,
        error: new ComposeMediaEmptyAssetError(
          `Governed chart source asset ${options.assetId} was empty during video composition.`,
          options.assetId,
        ),
      };
    }
    const payload = parseStoredChartSource({
      assetId: options.assetId,
      content: code,
      mimeType: response.headers.get("Content-Type"),
    });

    if (!payload) {
      return {
        payload: null,
        error: new ComposeMediaSourceRehydrationError(
          `Governed chart source asset ${options.assetId} could not be rehydrated for video composition.`,
          COMPOSE_MEDIA_SOURCE_REHYDRATION_FAILURE_CODE,
          options.assetId,
        ),
      };
    }

    return { payload, error: null };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    return {
      payload: null,
      error: createStoredAssetNetworkError(options.assetId, "chart", error),
    };
  }
}

async function fetchStoredGraphPayloadByAssetId(options: {
  assetId: string;
  signal: AbortSignal;
}): Promise<StoredSourceFetchResult<ResolvedGraphRuntimePayload>> {
  try {
    const response = await fetch(`/api/user-files/${encodeURIComponent(options.assetId)}`, {
      method: "GET",
      signal: options.signal,
    });

    if (!response.ok) {
      return {
        payload: null,
        error: createStoredAssetFetchError(options.assetId, response, "graph"),
      };
    }

    const raw = await response.text();
    if (!raw.trim()) {
      return {
        payload: null,
        error: new ComposeMediaEmptyAssetError(
          `Governed graph source asset ${options.assetId} was empty during video composition.`,
          options.assetId,
        ),
      };
    }

    let payload: ResolvedGraphRuntimePayload | null = null;
    try {
      payload = parseStoredGraphSource({
        assetId: options.assetId,
        content: raw,
        mimeType: response.headers.get("Content-Type"),
      });
    } catch (error) {
      return {
        payload: null,
        error: new ComposeMediaMalformedAssetError(
          `Governed graph source asset ${options.assetId} contained malformed graph JSON for video composition.`,
          options.assetId,
          { cause: error },
        ),
      };
    }

    if (!payload) {
      return {
        payload: null,
        error: new ComposeMediaMalformedAssetError(
          `Governed graph source asset ${options.assetId} could not be rehydrated into a valid graph payload for video composition.`,
          options.assetId,
        ),
      };
    }

    return { payload, error: null };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    return {
      payload: null,
      error: createStoredAssetNetworkError(options.assetId, "graph", error),
    };
  }
}

async function fetchStoredImageBlobByAssetId(options: {
  assetId: string;
  signal: AbortSignal;
}): Promise<Blob> {
  try {
    const response = await fetch(`/api/user-files/${encodeURIComponent(options.assetId)}`, {
      method: "GET",
      signal: options.signal,
    });

    if (!response.ok) {
      throw createStoredAssetFetchError(options.assetId, response, "image");
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new ComposeMediaEmptyAssetError(
        `Governed image asset ${options.assetId} was empty during video composition.`,
        options.assetId,
      );
    }

    return blob;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    throw createStoredAssetNetworkError(options.assetId, "image", error);
  }
}

async function fetchBrowserRuntimeAssetReadiness(options: {
  assetId: string;
  signal: AbortSignal;
}): Promise<ComposeMediaAssetReadinessEntry> {
  const response = await fetch(`/api/user-files/${encodeURIComponent(options.assetId)}`, {
    method: "HEAD",
    signal: options.signal,
  });

  if (response.status === 404) return { assetId: options.assetId, status: "not_found" };
  if (response.status === 403) return { assetId: options.assetId, status: "forbidden" };
  if (!response.ok) {
    throw new Error(`Asset readiness check failed for ${options.assetId} (${response.status}).`);
  }

  const assetKindHeader = response.headers.get("X-Asset-Kind");
  const assetKind = assetKindHeader === "audio"
    || assetKindHeader === "chart"
    || assetKindHeader === "graph"
    || assetKindHeader === "image"
    || assetKindHeader === "subtitle"
    || assetKindHeader === "video"
    ? assetKindHeader
    : inferAssetKindFromMimeType(response.headers.get("Content-Type"));

  return {
    assetId: options.assetId,
    status: "ready",
    assetKind,
    conversationId: response.headers.get("X-Conversation-Id"),
    derivativeOfAssetId: response.headers.get("X-Derivative-Of-Asset-Id"),
  };
}

export interface UseComposeMediaMaterializationOptions {
  conversationId: string | null;
  assetResolutionIndex: AssetResolutionIndex;
}

export interface StartComposeMediaRuntimeOptions {
  candidate: BrowserRuntimeCandidate;
  dispatch: Dispatch<ChatAction>;
  dispatchSnapshot: (messageId: string, resultIndex: number, part: ReturnType<typeof buildBrowserRuntimeJobStatusPart>) => void;
  orchestration: BrowserJobOrchestration;
  snapshots: RuntimeSnapshots;
  bumpRuntimeTick: () => void;
}

export interface EnqueueComposeMediaRecoveryOptions {
  candidate: BrowserRuntimeCandidate;
  plan: MediaCompositionPlan;
  failureCode: string;
  initialSequence: number;
  initialFailureStage: "recovery" | "local_execution";
  initialError: string;
  dispatch: Dispatch<ChatAction>;
  dispatchSnapshot: (messageId: string, resultIndex: number, part: ReturnType<typeof buildBrowserRuntimeJobStatusPart>) => void;
}

export interface ComposeMediaMaterialization {
  resolvePlanFromCandidate: (
    candidate: Pick<BrowserRuntimeCandidate, "payload" | "args">,
    failureStage: ComposeMediaPlanResolutionStage,
  ) => ComposeMediaPlanResolution;
  materializePlan: (plan: MediaCompositionPlan, signal: AbortSignal) => Promise<MediaCompositionPlan>;
  enqueueDeferredJob: (plan: MediaCompositionPlan, signal: AbortSignal) => Promise<JobStatusMessagePart>;
  enqueueRecovery: (options: EnqueueComposeMediaRecoveryOptions) => Promise<void>;
  startRuntime: (options: StartComposeMediaRuntimeOptions) => void;
}

export function createComposeMediaMaterialization(
  options: UseComposeMediaMaterializationOptions,
): ComposeMediaMaterialization {
  const { assetResolutionIndex, conversationId } = options;
  const planTruncations = new Map<string, BrowserRuntimeTruncationDiagnostic[]>();

  const recordTruncation = (
    diagnostics: BrowserRuntimeTruncationDiagnostic[],
    diagnostic: BrowserRuntimeTruncationDiagnostic | null,
  ) => {
    if (!diagnostic) {
      return;
    }

    if (diagnostics.some((candidate) => (
      candidate.surface === diagnostic.surface
      && candidate.original === diagnostic.original
      && candidate.rendered === diagnostic.rendered
    ))) {
      return;
    }

    diagnostics.push(diagnostic);
  };

  const resolveStoredChartPayloadForComposition = async (clip: MediaCompositionPlan["visualClips"][number], signal: AbortSignal) => {
    const stored = await fetchStoredChartPayloadByAssetId({ assetId: clip.assetId, signal });
    if (stored.payload) return stored.payload;
    throw stored.error ?? new ComposeMediaSourceRehydrationError(
      `Governed chart source asset ${clip.assetId} could not be rehydrated for video composition.`,
    );
  };

  const resolveStoredGraphPayloadForComposition = async (clip: MediaCompositionPlan["visualClips"][number], signal: AbortSignal) => {
    const stored = await fetchStoredGraphPayloadByAssetId({ assetId: clip.assetId, signal });
    if (stored.payload) return stored.payload;
    throw stored.error ?? new ComposeMediaSourceRehydrationError(
      `Governed graph source asset ${clip.assetId} could not be rehydrated for video composition.`,
    );
  };

  const materializeChartClip = async (
    clip: MediaCompositionPlan["visualClips"][number],
    signal: AbortSignal,
    diagnostics: BrowserRuntimeTruncationDiagnostic[],
  ) => {
    const chart = await resolveStoredChartPayloadForComposition(clip, signal);
    recordTruncation(diagnostics, getMermaidNodeTruncationDiagnostic(chart.code));
    const pngBlob = await renderChartPngBlob(chart.code, clip.assetId);
    const stored = await uploadBrowserRuntimeAsset({
      file: new File([pngBlob], `${toFileStem(chart.downloadFileName || chart.title, "chart")}.png`, { type: "image/png" }),
      conversationId,
      derivativeOfAssetId: clip.sourceAssetId ?? clip.assetId,
      signal,
    });

    return {
      ...clip,
      assetId: stored.assetId,
      kind: "image" as const,
      sourceAssetId: clip.sourceAssetId ?? clip.assetId,
    };
  };

  const materializeGraphClip = async (
    clip: MediaCompositionPlan["visualClips"][number],
    signal: AbortSignal,
    diagnostics: BrowserRuntimeTruncationDiagnostic[],
  ) => {
    const graph = await resolveStoredGraphPayloadForComposition(clip, signal);
    recordTruncation(diagnostics, getGraphTableTruncationDiagnostic(graph));
    const pngBlob = await renderGraphPngBlob(graph, clip.assetId);
    const stored = await uploadBrowserRuntimeAsset({
      file: new File([pngBlob], `${toFileStem(graph.downloadFileName || graph.title || graph.caption, "graph")}.png`, { type: "image/png" }),
      conversationId,
      derivativeOfAssetId: clip.sourceAssetId ?? clip.assetId,
      signal,
    });

    return {
      ...clip,
      assetId: stored.assetId,
      kind: "image" as const,
      sourceAssetId: clip.sourceAssetId ?? clip.assetId,
    };
  };

  const materializeBrowserShortExplainerClip = async (
    clip: MediaCompositionPlan["visualClips"][number],
    plan: MediaCompositionPlan,
    beatIndex: number,
    signal: AbortSignal,
    diagnostics: BrowserRuntimeTruncationDiagnostic[],
  ) => {
    const captions = getBrowserShortExplainerBeatCaptions(plan);
    const caption = captions[beatIndex] ?? null;
    const derivativeOfAssetId = clip.sourceAssetId ?? clip.assetId;
    let imageBlob: Blob;
    let fileStem: string;

    if (clip.kind === "chart") {
      const chart = await resolveStoredChartPayloadForComposition(clip, signal);
      recordTruncation(diagnostics, getMermaidNodeTruncationDiagnostic(chart.code));
      imageBlob = await renderChartPngBlob(chart.code, clip.assetId);
      fileStem = toFileStem(chart.downloadFileName || chart.title, "chart");
    } else if (clip.kind === "graph") {
      const graph = await resolveStoredGraphPayloadForComposition(clip, signal);
      recordTruncation(diagnostics, getGraphTableTruncationDiagnostic(graph));
      imageBlob = await renderGraphPngBlob(graph, clip.assetId);
      fileStem = toFileStem(graph.downloadFileName || graph.title || graph.caption, "graph");
    } else if (clip.kind === "image") {
      imageBlob = await fetchStoredImageBlobByAssetId({ assetId: clip.assetId, signal });
      fileStem = toFileStem(clip.assetId, "image");
    } else {
      throw new ComposeMediaRenderError(
        "browser_short_explainer currently supports image, chart, and graph visual beats only.",
        clip.assetId,
      );
    }

    const outputBlob = caption
      ? await burnCaptionedImageBlob({
          imageBlob,
          caption,
          resolution: plan.resolution ?? null,
          assetId: clip.assetId,
        })
      : imageBlob;

    if (caption) {
      recordTruncation(diagnostics, measureCaptionLineTruncation({
        caption,
        resolution: plan.resolution ?? null,
      }));
    }

    const stored = await uploadBrowserRuntimeAsset({
      file: new File([outputBlob], `${fileStem}-${beatIndex + 1}.png`, { type: "image/png" }),
      conversationId,
      derivativeOfAssetId,
      signal,
    });

    return {
      ...clip,
      assetId: stored.assetId,
      kind: "image" as const,
      sourceAssetId: derivativeOfAssetId,
    };
  };

  const materializePlan = async (plan: MediaCompositionPlan, signal: AbortSignal) => {
    const diagnostics: BrowserRuntimeTruncationDiagnostic[] = [];
    if (isBrowserShortExplainerPlan(plan)) {
      const materialized = {
        ...plan,
        visualClips: await Promise.all(
          plan.visualClips.map((clip, beatIndex) => materializeBrowserShortExplainerClip(clip, plan, beatIndex, signal, diagnostics)),
        ),
      };
      if (diagnostics.length > 0) {
        planTruncations.set(materialized.id, sortTruncationDiagnostics(diagnostics));
      } else {
        planTruncations.delete(materialized.id);
      }
      return materialized;
    }

    const materialized = {
      ...plan,
      visualClips: await Promise.all(
        plan.visualClips.map((clip) => {
          if (clip.kind === "chart") return materializeChartClip(clip, signal, diagnostics);
          if (clip.kind === "graph") return materializeGraphClip(clip, signal, diagnostics);
          return Promise.resolve(clip);
        }),
      ),
    };
    if (diagnostics.length > 0) {
      planTruncations.set(materialized.id, sortTruncationDiagnostics(diagnostics));
    } else {
      planTruncations.delete(materialized.id);
    }
    return materialized;
  };

  const resolvePreflightFailure = async (plan: MediaCompositionPlan, signal: AbortSignal) => {
    const assetIds = [...new Set([
      ...plan.visualClips.map((clip) => clip.assetId),
      ...plan.audioClips.map((clip) => clip.assetId),
    ])];

    const assetsById = new Map<string, ComposeMediaAssetReadinessEntry>(
      await Promise.all(assetIds.map(async (assetId) => ([
        assetId,
        await fetchBrowserRuntimeAssetReadiness({ assetId, signal }),
      ] as const))),
    );

    return evaluateComposeMediaAssetReadiness({ plan, assetsById });
  };

  const resolvePlanFromCandidate = (
    candidate: Pick<BrowserRuntimeCandidate, "payload" | "args">,
    failureStage: ComposeMediaPlanResolutionStage,
  ): ComposeMediaPlanResolution => {
    const plan = normalizeMediaCompositionPlan(candidate.args.plan, conversationId ?? undefined)
      ?? normalizeMediaCompositionPlan(candidate.payload, conversationId ?? undefined);
    if (!plan) {
      return {
        plan: null,
        error: "Compose media plan is missing or invalid.",
        failureCode: COMPOSE_MEDIA_INVALID_PLAN_FAILURE_CODE,
        failureStage,
        repairs: [],
      };
    }

    try {
      const canonicalization = canonicalizeMediaCompositionPlanWithRepairs(plan, {
        assetCandidates: assetResolutionIndex.listCandidates(),
      });

      return {
        plan: canonicalization.plan,
        error: null,
        failureCode: null,
        failureStage: null,
        repairs: canonicalization.repairs,
      };
    } catch (error) {
      if (error instanceof InvalidMediaCompositionPlanAssetReferenceError) {
        return {
          plan: null,
          error: error.message,
          failureCode: COMPOSE_MEDIA_INVALID_PLAN_FAILURE_CODE,
          failureStage,
          repairs: [],
        };
      }

      throw error;
    }
  };

  const enqueueDeferredJob = async (plan: MediaCompositionPlan, signal: AbortSignal) => {
    if (!conversationId) {
      throw new ComposeMediaDeferredEnqueueError("Conversation context is required for deferred media recovery.");
    }

    const response = await fetch("/api/chat/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolName: "compose_media", conversationId, plan }),
      signal,
    });

    const payload = await response.json().catch(() => null) as {
      error?: string;
      errorCode?: string;
      job?: unknown;
    } | null;

    if (!response.ok) {
      throw new ComposeMediaDeferredEnqueueError(
        payload?.error || `Deferred media recovery failed (${response.status}).`,
        isComposeMediaInvalidPlanErrorCode(payload?.errorCode)
          ? COMPOSE_MEDIA_INVALID_PLAN_FAILURE_CODE
          : "deferred_enqueue_failed",
      );
    }

    if (!isCanonicalJobSnapshot(payload?.job)) {
      throw new ComposeMediaDeferredEnqueueError(
        "Deferred media recovery completed without returning a canonical job snapshot.",
      );
    }

    return canonicalJobSnapshotToStatusPart(payload.job);
  };

  const enqueueRecovery = async ({
    candidate,
    plan,
    failureCode,
    initialSequence,
    initialFailureStage,
    initialError,
    dispatch,
    dispatchSnapshot,
  }: EnqueueComposeMediaRecoveryOptions) => {
    if (!canRerouteBrowserShortExplainerPlan(plan)) {
      dispatchSnapshot(
        candidate.messageId,
        candidate.resultIndex,
        buildBrowserRuntimeJobStatusPart({
          candidate,
          payload: plan,
          status: "failed",
          browserExecutionStatus: "failed",
          sequence: initialSequence,
          progressPercent: 0,
          progressLabel: COMPOSE_MEDIA_FAILURE_LABEL,
          error: "browser_short_explainer with burned captions currently requires local browser execution and cannot reroute to the server.",
          failureCode: "browser_short_requires_browser_execution",
          failureStage: initialFailureStage,
          conversationId,
        }),
      );
      return;
    }

    dispatchSnapshot(
      candidate.messageId,
      candidate.resultIndex,
      buildBrowserRuntimeJobStatusPart({
        candidate,
        payload: plan,
        status: "failed",
        browserExecutionStatus: "fallback_required",
        sequence: initialSequence,
        progressPercent: 0,
        progressLabel: COMPOSE_MEDIA_REROUTING_LABEL,
        error: initialError,
        failureCode,
        failureStage: initialFailureStage,
        conversationId,
      }),
    );

    try {
      const deferredPart = await enqueueDeferredJob(plan, new AbortController().signal);
      dispatch({
        type: "REWRITE_TOOL_RESULT_AS_BROWSER_JOB",
        messageId: candidate.messageId,
        resultIndex: candidate.resultIndex,
        part: deferredPart,
      });
    } catch (error) {
      dispatchSnapshot(
        candidate.messageId,
        candidate.resultIndex,
        buildBrowserRuntimeJobStatusPart({
          candidate,
          payload: plan,
          status: "failed",
          browserExecutionStatus: "failed",
          sequence: initialSequence + 1,
          progressPercent: 0,
          progressLabel: COMPOSE_MEDIA_FAILURE_LABEL,
          error: error instanceof Error ? error.message : String(error),
          failureCode: error instanceof ComposeMediaDeferredEnqueueError ? error.failureCode : "deferred_enqueue_failed",
          failureStage: "deferred_enqueue",
          conversationId,
        }),
      );
    }
  };

  const startRuntime = ({
    candidate,
    dispatch,
    dispatchSnapshot,
    orchestration,
    snapshots,
    bumpRuntimeTick,
  }: StartComposeMediaRuntimeOptions) => {
    if (orchestration.hasController(candidate.jobId) || candidate.snapshot?.status === "succeeded") {
      return;
    }

    const startupPlanResolution = resolvePlanFromCandidate(candidate, "local_execution");
    if (!startupPlanResolution.plan) {
      dispatchSnapshot(
        candidate.messageId,
        candidate.resultIndex,
        buildBrowserRuntimeJobStatusPart({
          candidate,
          payload: candidate.payload,
          status: "failed",
          browserExecutionStatus: "failed",
          sequence: 1,
          progressPercent: 0,
          progressLabel: COMPOSE_MEDIA_FAILURE_LABEL,
          error: startupPlanResolution.error ?? "Compose media plan is missing or invalid.",
          failureCode: startupPlanResolution.failureCode ?? COMPOSE_MEDIA_INVALID_PLAN_FAILURE_CODE,
          failureStage: startupPlanResolution.failureStage ?? "local_execution",
          conversationId,
        }),
      );
      orchestration.markCompleted(candidate.jobId);
      snapshots.remove(candidate.jobId);
      return;
    }

    const startupPlan = startupPlanResolution.plan;
    const controller = new AbortController();
    orchestration.register(candidate.jobId, controller);

    dispatchSnapshot(
      candidate.messageId,
      candidate.resultIndex,
      buildBrowserRuntimeJobStatusPart({
        candidate,
        payload: startupPlan,
        status: "running",
        sequence: 1,
        progressPercent: 5,
        progressLabel: getComposeMediaProgressLabel("staging_assets", { plan: startupPlan, progressPercent: 5 }),
        conversationId,
      }),
    );

    const executor = new FfmpegBrowserExecutor();

    void (async () => {
      let plan: MediaCompositionPlan;

      try {
        plan = await materializePlan(startupPlan, controller.signal);
      } catch (error) {
        const invalidPlan = error instanceof InvalidMediaCompositionPlanAssetReferenceError
          ? { error: error.message, failureCode: COMPOSE_MEDIA_INVALID_PLAN_FAILURE_CODE, failureStage: "local_execution" as const }
          : null;
        const composeMediaFailure = error instanceof ComposeMediaError
          ? { error: error.message, failureCode: error.failureCode, failureStage: error.failureStage }
          : null;
        dispatchSnapshot(
          candidate.messageId,
          candidate.resultIndex,
          buildBrowserRuntimeJobStatusPart({
            candidate,
            payload: candidate.payload,
            status: "failed",
            browserExecutionStatus: "failed",
            sequence: 2,
            progressPercent: 0,
            progressLabel: COMPOSE_MEDIA_FAILURE_LABEL,
            error: invalidPlan?.error ?? composeMediaFailure?.error ?? (error instanceof Error ? error.message : String(error)),
            failureCode: invalidPlan?.failureCode ?? composeMediaFailure?.failureCode ?? "asset_materialization_failed",
            failureStage: invalidPlan?.failureStage ?? composeMediaFailure?.failureStage ?? "composition_preflight",
            conversationId,
          }),
        );
        return null;
      }

      const constraintError = validateExecutablePlanConstraints(plan);
      if (constraintError) {
        dispatchSnapshot(
          candidate.messageId,
          candidate.resultIndex,
          buildBrowserRuntimeJobStatusPart({
            candidate,
            payload: plan,
            status: "failed",
            browserExecutionStatus: "failed",
            sequence: 2,
            progressPercent: 0,
            progressLabel: COMPOSE_MEDIA_FAILURE_LABEL,
            error: constraintError,
            failureCode: "constraint_validation_failed",
            failureStage: "composition_preflight",
            conversationId,
          }),
        );
        return null;
      }

      let preflightFailure: Awaited<ReturnType<typeof resolvePreflightFailure>>;
      try {
        preflightFailure = await resolvePreflightFailure(plan, controller.signal);
      } catch (error) {
        dispatchSnapshot(
          candidate.messageId,
          candidate.resultIndex,
          buildBrowserRuntimeJobStatusPart({
            candidate,
            payload: plan,
            status: "failed",
            browserExecutionStatus: "failed",
            sequence: 2,
            progressPercent: 0,
            progressLabel: COMPOSE_MEDIA_FAILURE_LABEL,
            error: error instanceof Error ? error.message : String(error),
            failureCode: "asset_readiness_check_failed",
            failureStage: "composition_preflight",
            conversationId,
          }),
        );
        return null;
      }

      if (preflightFailure) {
        dispatchSnapshot(
          candidate.messageId,
          candidate.resultIndex,
          buildBrowserRuntimeJobStatusPart({
            candidate,
            payload: plan,
            status: "failed",
            browserExecutionStatus: "failed",
            sequence: 2,
            progressPercent: 0,
            progressLabel: COMPOSE_MEDIA_FAILURE_LABEL,
            error: preflightFailure.message,
            failureCode: preflightFailure.code as ComposeMediaPreflightFailureCode,
            failureStage: "composition_preflight",
            conversationId,
          }),
        );
        return null;
      }

      dispatchSnapshot(
        candidate.messageId,
        candidate.resultIndex,
        buildBrowserRuntimeJobStatusPart({
          candidate,
          payload: plan,
          status: "running",
          sequence: 2,
          progressPercent: 10,
          progressLabel: getComposeMediaProgressLabel("staging_assets", { plan, progressPercent: 10 }),
          conversationId,
        }),
      );

      const result = await executor.execute(
        plan,
        {
          conversationId,
          userId: "browser",
          repairs: startupPlanResolution.repairs,
          truncations: planTruncations.get(plan.id) ?? undefined,
        },
        (progress, label) => {
          dispatchSnapshot(
            candidate.messageId,
            candidate.resultIndex,
            buildBrowserRuntimeJobStatusPart({
              candidate,
              payload: plan,
              status: "running",
              sequence: 2,
              progressPercent: progress,
              progressLabel: label,
              conversationId,
            }),
          );
        },
        controller.signal,
      );

      return { result, plan };
    })()
      .then(async (resolved) => {
        if (!resolved) return;

        const { result, plan } = resolved;
        if (result.status === "succeeded" && result.envelope) {
          const envelopePayload = (result.envelope.payload ?? null) as { primaryAssetId?: unknown } | null;
          const primaryAssetId = typeof envelopePayload?.primaryAssetId === "string"
            ? envelopePayload.primaryAssetId
            : null;
          const videoArtifact = result.envelope.artifacts?.find((artifact) => artifact.kind === "video");
          const playbackUri = videoArtifact?.uri ?? (primaryAssetId ? `/api/user-files/${primaryAssetId}` : null);

          if (!playbackUri) {
            dispatchSnapshot(
              candidate.messageId,
              candidate.resultIndex,
              buildBrowserRuntimeJobStatusPart({
                candidate,
                payload: result.envelope.payload,
                status: "succeeded",
                sequence: 4,
                progressPercent: 100,
                progressLabel: COMPOSE_MEDIA_COMPLETE_LABEL,
                conversationId,
              }),
            );
            orchestration.markCompleted(candidate.jobId);
            return;
          }

          dispatchSnapshot(
            candidate.messageId,
            candidate.resultIndex,
            buildBrowserRuntimeJobStatusPart({
              candidate,
              payload: result.envelope.payload,
              status: "running",
              sequence: 3,
              progressPercent: 98,
              progressLabel: getComposeMediaProgressLabel("verifying_playback", { plan, progressPercent: 98 }),
              conversationId,
            }),
          );

          await waitForPlayableVideoAsset({ uri: playbackUri, signal: controller.signal });
          dispatchSnapshot(
            candidate.messageId,
            candidate.resultIndex,
            buildBrowserRuntimeJobStatusPart({
              candidate,
              payload: result.envelope.payload,
              status: "succeeded",
              sequence: 4,
              progressPercent: 100,
              progressLabel: COMPOSE_MEDIA_COMPLETE_LABEL,
              conversationId,
            }),
          );
          orchestration.markCompleted(candidate.jobId);
          return;
        }

        if (result.status === "fallback_required") {
          if (!canRerouteBrowserShortExplainerPlan(plan)) {
            orchestration.markCompleted(candidate.jobId);
            dispatchSnapshot(
              candidate.messageId,
              candidate.resultIndex,
              buildBrowserRuntimeJobStatusPart({
                candidate,
                payload: plan,
                status: "failed",
                browserExecutionStatus: "failed",
                sequence: 4,
                progressPercent: 0,
                progressLabel: COMPOSE_MEDIA_FAILURE_LABEL,
                error: "browser_short_explainer with burned captions currently requires local browser execution and cannot reroute to the server.",
                failureCode: "browser_short_requires_browser_execution",
                failureStage: "local_execution",
                conversationId,
              }),
            );
            return;
          }

          dispatchSnapshot(
            candidate.messageId,
            candidate.resultIndex,
            buildBrowserRuntimeJobStatusPart({
              candidate,
              payload: plan,
              status: "failed",
              browserExecutionStatus: "fallback_required",
              sequence: 4,
              progressPercent: 0,
              progressLabel: COMPOSE_MEDIA_REROUTING_LABEL,
              error: result.failureCode ?? "fallback_required",
              failureCode: result.failureCode ?? "fallback_required",
              failureStage: "local_execution",
              conversationId,
            }),
          );

          try {
            const deferredPart = await enqueueDeferredJob(plan, controller.signal);
            dispatch({
              type: "REWRITE_TOOL_RESULT_AS_BROWSER_JOB",
              messageId: candidate.messageId,
              resultIndex: candidate.resultIndex,
              part: deferredPart,
            });
          } catch (error) {
            orchestration.markCompleted(candidate.jobId);
            dispatchSnapshot(
              candidate.messageId,
              candidate.resultIndex,
              buildBrowserRuntimeJobStatusPart({
                candidate,
                payload: plan,
                status: "failed",
                browserExecutionStatus: "failed",
                sequence: 5,
                progressPercent: 0,
                progressLabel: COMPOSE_MEDIA_FAILURE_LABEL,
                error: error instanceof Error ? error.message : String(error),
                failureCode: error instanceof ComposeMediaDeferredEnqueueError ? error.failureCode : "deferred_enqueue_failed",
                failureStage: "deferred_enqueue",
                conversationId,
              }),
            );
            return;
          }

          orchestration.markCompleted(candidate.jobId);
          return;
        }

        orchestration.markCompleted(candidate.jobId);
        dispatchSnapshot(
          candidate.messageId,
          candidate.resultIndex,
          buildBrowserRuntimeJobStatusPart({
            candidate,
            payload: plan,
            status: "failed",
            browserExecutionStatus: "failed",
            sequence: 4,
            progressPercent: 0,
            progressLabel: COMPOSE_MEDIA_FAILURE_LABEL,
            error: result.failureCode ?? "unknown",
            failureCode: result.failureCode ?? "unknown",
            failureStage: "local_execution",
            conversationId,
          }),
        );
      })
      .catch((error) => {
        const runtimeFailure = resolveComposeMediaRuntimeFailure(error);
        orchestration.markCompleted(candidate.jobId);
        dispatchSnapshot(
          candidate.messageId,
          candidate.resultIndex,
          buildBrowserRuntimeJobStatusPart({
            candidate,
            payload: candidate.payload,
            status: "failed",
            browserExecutionStatus: "failed",
            sequence: 3,
            progressPercent: 0,
            progressLabel: COMPOSE_MEDIA_FAILURE_LABEL,
            error: runtimeFailure.error,
            failureCode: runtimeFailure.failureCode,
            failureStage: runtimeFailure.failureStage,
            conversationId,
          }),
        );
      })
      .finally(() => {
        planTruncations.delete(startupPlan.id);
        orchestration.unregister(candidate.jobId);
        snapshots.remove(candidate.jobId);
        bumpRuntimeTick();
      });
  };

  return {
    resolvePlanFromCandidate,
    materializePlan,
    enqueueDeferredJob,
    enqueueRecovery,
    startRuntime,
  };
}
