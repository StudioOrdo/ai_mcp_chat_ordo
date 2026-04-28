import { useEffect, useRef, useState } from "react";
import type { Dispatch } from "react";

import type { ChatMessage } from "@/core/entities/chat-message";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import type {
  MediaAssetKind,
  MediaAssetRetentionClass,
  MediaAssetSource,
} from "@/core/entities/media-asset";
import { resolveGenerateChartPayload } from "@/core/use-cases/tools/chart-payload";
import {
  resolveGenerateGraphPayload,
  type ResolvedGraphPayload,
} from "@/core/use-cases/tools/graph-payload";

import type { ChatAction } from "./chatState";
import {
  buildBrowserRuntimeJobStatusPart,
  getBrowserRuntimeCandidates,
} from "@/lib/media/browser-runtime/job-snapshots";
import { FfmpegBrowserExecutor } from "@/lib/media/browser-runtime/ffmpeg-browser-executor";
import { renderGraphToPngBlob } from "@/lib/media/browser-runtime/graph-image-derivation";
import { renderMermaidChartToPngBlob } from "@/lib/media/browser-runtime/mermaid-image-derivation";
import {
  VideoPlaybackVerificationError,
  waitForPlayableVideoAsset,
} from "@/lib/media/browser-runtime/video-asset-readiness";
import { extractJobStatusSnapshots } from "@/lib/jobs/job-status-snapshots";
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
import type { MediaCompositionPlan } from "@/core/entities/media-composition";
import {
  normalizeMediaCompositionPlan,
  validateExecutablePlanConstraints,
} from "@/lib/media/ffmpeg/media-composition-plan";
import { COMPOSE_MEDIA_INVALID_PLAN_FAILURE_CODE } from "@/lib/media/compose-media-errors";
import {
  planBrowserCapabilityRuntimeCycle,
} from "@/lib/media/browser-runtime/browser-capability-runtime";
import {
  readPersistedBrowserRuntimeEntries,
  removePersistedBrowserRuntimeEntry,
  upsertPersistedBrowserRuntimeEntry,
} from "@/lib/media/browser-runtime/browser-runtime-state";

type BrowserRuntimeStoredAsset = {
  assetId: string;
  mimeType: string;
  assetKind?: MediaAssetKind;
  source?: MediaAssetSource;
  retentionClass?: MediaAssetRetentionClass;
  toolInvocationId?: string;
  derivativeOfToolInvocationId?: string | null;
};

type BrowserRuntimeStoredPayloadFields = {
  assetId?: string;
  mimeType?: string;
  assetKind?: MediaAssetKind;
  assetSource?: MediaAssetSource;
  retentionClass?: MediaAssetRetentionClass;
  toolInvocationId?: string;
  derivativeOfToolInvocationId?: string | null;
};

type ResolvedChartRuntimePayload = ReturnType<typeof resolveGenerateChartPayload> & BrowserRuntimeStoredPayloadFields;
type ResolvedGraphRuntimePayload = ResolvedGraphPayload & BrowserRuntimeStoredPayloadFields;

interface UseBrowserCapabilityRuntimeOptions {
  conversationId: string | null;
  messages: ChatMessage[];
  dispatch: Dispatch<ChatAction>;
}

class ComposeMediaDeferredEnqueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComposeMediaDeferredEnqueueError";
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isResolvedGraphRuntimePayload(value: unknown): value is ResolvedGraphRuntimePayload {
  return isRecord(value)
    && isRecord(value.graph)
    && typeof value.graph.kind === "string";
}

function readStoredPayloadFields(value: unknown): BrowserRuntimeStoredPayloadFields {
  if (!isRecord(value)) {
    return {};
  }

  const assetSource = value.assetSource === "generated"
    || value.assetSource === "uploaded"
    || value.assetSource === "derived"
    ? value.assetSource
    : value.source === "generated" || value.source === "uploaded" || value.source === "derived"
      ? value.source
      : undefined;

  return {
    ...(typeof value.assetId === "string" && value.assetId.trim().length > 0
      ? { assetId: value.assetId }
      : {}),
    ...(typeof value.mimeType === "string" ? { mimeType: value.mimeType } : {}),
    ...(value.assetKind === "audio"
      || value.assetKind === "chart"
      || value.assetKind === "graph"
      || value.assetKind === "image"
      || value.assetKind === "video"
      || value.assetKind === "subtitle"
      || value.assetKind === "waveform"
      ? { assetKind: value.assetKind }
      : {}),
    ...(assetSource ? { assetSource } : {}),
    ...(value.retentionClass === "ephemeral"
      || value.retentionClass === "conversation"
      || value.retentionClass === "durable"
      ? { retentionClass: value.retentionClass }
      : {}),
    ...(typeof value.toolInvocationId === "string" ? { toolInvocationId: value.toolInvocationId } : {}),
    ...(value.derivativeOfToolInvocationId === null || typeof value.derivativeOfToolInvocationId === "string"
      ? { derivativeOfToolInvocationId: value.derivativeOfToolInvocationId }
      : {}),
  };
}

function isResolvedBrowserRuntimeCandidate(candidate: {
  toolName: string;
  payload: unknown;
}): boolean {
  if (candidate.toolName === "compose_media") {
    return isRecord(candidate.payload) && typeof candidate.payload.primaryAssetId === "string";
  }

  return false;
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

function resolveChartRuntimePayload(
  payload: unknown,
  args: Record<string, unknown>,
): ResolvedChartRuntimePayload {
  const raw = isRecord(payload) ? payload : args;
  return {
    ...resolveGenerateChartPayload(raw),
    ...readStoredPayloadFields(raw),
  };
}

function resolveGraphRuntimePayload(
  payload: unknown,
  args: Record<string, unknown>,
): ResolvedGraphRuntimePayload {
  const raw = isRecord(payload) ? payload : args;
  const graph = isResolvedGraphRuntimePayload(payload)
    ? payload
    : resolveGenerateGraphPayload(args);

  return {
    ...graph,
    ...readStoredPayloadFields(raw),
  };
}

function findGraphPayloadByAssetId(messages: ChatMessage[], assetId: string): ResolvedGraphRuntimePayload | null {
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (part.type !== "tool_result" || part.name !== "generate_graph") {
        continue;
      }

      const snapshots = extractJobStatusSnapshots(part.result);
      const snapshot = snapshots.at(-1)?.part;
      const payload = snapshot?.resultEnvelope?.payload ?? snapshot?.resultPayload ?? part.result;

      try {
        const graph = resolveGraphRuntimePayload(payload, {});
        if (graph.assetId === assetId) {
          return graph;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

function findChartPayloadByAssetId(
  messages: ChatMessage[],
  assetId: string,
): ResolvedChartRuntimePayload | null {
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (part.type !== "tool_result" || part.name !== "generate_chart") {
        continue;
      }

      const snapshots = extractJobStatusSnapshots(part.result);
      const snapshot = snapshots.at(-1)?.part;
      const payload = snapshot?.resultEnvelope?.payload ?? snapshot?.resultPayload ?? part.result;

      try {
        const chart = resolveChartRuntimePayload(payload, {});
        if (chart.assetId === assetId) {
          return chart;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

async function materializeChartClip(options: {
  clip: MediaCompositionPlan["visualClips"][number];
  messages: ChatMessage[];
  conversationId: string | null;
  toolInvocationId?: string;
  signal: AbortSignal;
}): Promise<MediaCompositionPlan["visualClips"][number]> {
  const chart = findChartPayloadByAssetId(options.messages, options.clip.assetId);
  if (!chart) {
    throw new Error(
      `Unable to render chart asset ${options.clip.assetId} for video composition because the Mermaid source is not available in the current conversation.`,
    );
  }

  const pngBlob = await renderMermaidChartToPngBlob(chart.code);
  const fileName = `${toFileStem(chart.downloadFileName || chart.title, "chart")}.png`;
  const stored = await uploadBrowserRuntimeAsset({
    file: new File([pngBlob], fileName, { type: "image/png" }),
    conversationId: options.conversationId,
    derivativeOfAssetId: options.clip.sourceAssetId ?? options.clip.assetId,
    toolInvocationId: options.toolInvocationId,
    derivativeOfToolInvocationId: chart.toolInvocationId,
    signal: options.signal,
  });

  return {
    ...options.clip,
    assetId: stored.assetId,
    kind: "image",
    sourceAssetId: options.clip.sourceAssetId ?? options.clip.assetId,
  };
}

async function materializeGraphClip(options: {
  clip: MediaCompositionPlan["visualClips"][number];
  messages: ChatMessage[];
  conversationId: string | null;
  toolInvocationId?: string;
  signal: AbortSignal;
}): Promise<MediaCompositionPlan["visualClips"][number]> {
  const graph = findGraphPayloadByAssetId(options.messages, options.clip.assetId);
  if (!graph) {
    throw new Error(
      `Unable to render graph asset ${options.clip.assetId} for video composition because the graph payload is not available in the current conversation.`,
    );
  }

  const pngBlob = await renderGraphToPngBlob(graph);
  const fileName = `${toFileStem(graph.downloadFileName || graph.title || graph.caption, "graph")}.png`;
  const stored = await uploadBrowserRuntimeAsset({
    file: new File([pngBlob], fileName, { type: "image/png" }),
    conversationId: options.conversationId,
    derivativeOfAssetId: options.clip.sourceAssetId ?? options.clip.assetId,
    toolInvocationId: options.toolInvocationId,
    derivativeOfToolInvocationId: graph.toolInvocationId,
    signal: options.signal,
  });

  return {
    ...options.clip,
    assetId: stored.assetId,
    kind: "image",
    sourceAssetId: options.clip.sourceAssetId ?? options.clip.assetId,
  };
}

async function materializeComposeMediaPlan(options: {
  plan: MediaCompositionPlan;
  messages: ChatMessage[];
  conversationId: string | null;
  toolInvocationId?: string;
  signal: AbortSignal;
}): Promise<MediaCompositionPlan> {
  const visualClips = await Promise.all(
    options.plan.visualClips.map(async (clip) => {
      if (clip.kind === "chart") {
        return materializeChartClip({
          clip,
          messages: options.messages,
          conversationId: options.conversationId,
          toolInvocationId: options.toolInvocationId,
          signal: options.signal,
        });
      }

      if (clip.kind === "graph") {
        return materializeGraphClip({
          clip,
          messages: options.messages,
          conversationId: options.conversationId,
          toolInvocationId: options.toolInvocationId,
          signal: options.signal,
        });
      }

      return clip;
    }),
  );

  return {
    ...options.plan,
    visualClips,
  };
}

async function uploadBrowserRuntimeAsset(options: {
  file: File;
  conversationId: string | null;
  derivativeOfAssetId?: string;
  toolInvocationId?: string;
  derivativeOfToolInvocationId?: string;
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
  if (options.toolInvocationId) {
    formData.append("toolInvocationId", options.toolInvocationId);
  }
  if (options.derivativeOfToolInvocationId) {
    formData.append("derivativeOfToolInvocationId", options.derivativeOfToolInvocationId);
  }

  const response = await fetch("/api/chat/uploads", {
    method: "POST",
    body: formData,
    signal: options.signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || `Asset persistence failed (${response.status})`);
  }

  const payload = await response.json() as {
    attachments?: Array<{
      assetId: string;
      mimeType: string;
      assetKind?: MediaAssetKind;
      source?: MediaAssetSource;
      retentionClass?: MediaAssetRetentionClass;
      toolInvocationId?: string;
      derivativeOfToolInvocationId?: string | null;
    }>;
  };
  const stored = payload.attachments?.[0];

  if (!stored?.assetId || !stored.mimeType) {
    throw new Error("Asset persistence completed without returning stored asset metadata.");
  }

  return stored;
}

function inferAssetKindFromMimeType(mimeType: string | null): MediaAssetKind | null {
  if (!mimeType) {
    return null;
  }

  if (mimeType.startsWith("audio/")) {
    return "audio";
  }

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType.startsWith("video/")) {
    return "video";
  }

  if (mimeType === "text/vnd.mermaid") {
    return "chart";
  }

  if (mimeType === "application/vnd.studioordo.graph+json") {
    return "graph";
  }

  return null;
}

async function fetchBrowserRuntimeAssetReadiness(options: {
  assetId: string;
  signal: AbortSignal;
}): Promise<ComposeMediaAssetReadinessEntry> {
  const response = await fetch(`/api/user-files/${encodeURIComponent(options.assetId)}`, {
    method: "HEAD",
    signal: options.signal,
  });

  if (response.status === 404) {
    return {
      assetId: options.assetId,
      status: "not_found",
    };
  }

  if (response.status === 403) {
    return {
      assetId: options.assetId,
      status: "forbidden",
    };
  }

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
    || assetKindHeader === "waveform"
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

async function resolveBrowserComposeMediaPreflightFailure(options: {
  plan: MediaCompositionPlan;
  signal: AbortSignal;
}): Promise<ReturnType<typeof evaluateComposeMediaAssetReadiness>> {
  const assetIds = [...new Set([
    ...options.plan.visualClips.map((clip) => clip.assetId),
    ...options.plan.audioClips.map((clip) => clip.assetId),
  ])];

  const assetsById = new Map<string, ComposeMediaAssetReadinessEntry>(
    await Promise.all(assetIds.map(async (assetId) => ([
      assetId,
      await fetchBrowserRuntimeAssetReadiness({ assetId, signal: options.signal }),
    ] as const))),
  );

  return evaluateComposeMediaAssetReadiness({
    plan: options.plan,
    assetsById,
  });
}



function isJobStatusMessagePart(value: unknown): value is JobStatusMessagePart {
  return isRecord(value)
    && value.type === "job_status"
    && typeof value.jobId === "string"
    && typeof value.toolName === "string"
    && typeof value.label === "string"
    && typeof value.status === "string";
}

async function enqueueDeferredComposeMediaJob(options: {
  conversationId: string | null;
  plan: MediaCompositionPlan;
  signal: AbortSignal;
}): Promise<JobStatusMessagePart> {
  if (!options.conversationId) {
    throw new ComposeMediaDeferredEnqueueError("Conversation context is required for deferred media recovery.");
  }

  const response = await fetch("/api/chat/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      toolName: "compose_media",
      conversationId: options.conversationId,
      plan: options.plan,
    }),
    signal: options.signal,
  });

  const payload = await response.json().catch(() => null) as {
    error?: string;
    job?: { part?: unknown };
  } | null;

  if (!response.ok) {
    throw new ComposeMediaDeferredEnqueueError(
      payload?.error || `Deferred media recovery failed (${response.status}).`,
    );
  }

  const part = payload?.job?.part;
  if (!isJobStatusMessagePart(part)) {
    throw new ComposeMediaDeferredEnqueueError(
      "Deferred media recovery completed without returning a canonical job snapshot.",
    );
  }

  return part;
}

function resolveComposeMediaPlanFromCandidate(candidate: {
  payload: unknown;
  args: Record<string, unknown>;
}): MediaCompositionPlan | null {
  const argsPlan = candidate.args.plan;
  return normalizeMediaCompositionPlan(argsPlan) ?? normalizeMediaCompositionPlan(candidate.payload);
}

export function useBrowserCapabilityRuntime({
  conversationId,
  messages,
  dispatch,
}: UseBrowserCapabilityRuntimeOptions): void {
  const activeRuntimeControllers = useRef(new Map<string, AbortController>());
  const completedRuntimeJobs = useRef(new Set<string>());
  const [runtimeTick, setRuntimeTick] = useState(0);

  const bumpRuntimeTick = () => {
    setRuntimeTick((value) => value + 1);
  };

  useEffect(() => {
    const controllers = activeRuntimeControllers.current;

    return () => {
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
    };
  }, []);

  useEffect(() => {
    const controllers = activeRuntimeControllers.current;
    const candidates = getBrowserRuntimeCandidates(messages).filter((candidate) => {
      if (candidate.toolName === "compose_media" && !isRecord(candidate.payload)) {
        return false;
      }

      if (
        candidate.snapshot?.status === "succeeded"
        || candidate.snapshot?.status === "failed"
        || candidate.snapshot?.status === "canceled"
      ) {
        completedRuntimeJobs.current.delete(candidate.jobId);
        return true;
      }

      return !completedRuntimeJobs.current.has(candidate.jobId);
    });
    const resolvedCandidates = candidates.filter(isResolvedBrowserRuntimeCandidate);
    const pendingCandidates = candidates.filter((candidate) => !isResolvedBrowserRuntimeCandidate(candidate));
    const persistedEntries = readPersistedBrowserRuntimeEntries();
    const runtimePlan = planBrowserCapabilityRuntimeCycle({
      candidates: pendingCandidates,
      activeJobIds: new Set(controllers.keys()),
      persistedEntries,
    });

    const dispatchSnapshot = (
      messageId: string,
      resultIndex: number,
      part: ReturnType<typeof buildBrowserRuntimeJobStatusPart>,
    ) => {
      dispatch({
        type: "REWRITE_TOOL_RESULT_AS_BROWSER_JOB",
        messageId,
        resultIndex,
        part,
      });
    };

    const enqueueComposeMediaRecovery = async (options: {
      candidate: typeof runtimePlan.reconcile[number]["candidate"] | typeof runtimePlan.overflow[number]["candidate"];
      plan: MediaCompositionPlan;
      failureCode: string;
      initialSequence: number;
      initialFailureStage: "recovery" | "local_execution";
      initialError: string;
    }) => {
      dispatchSnapshot(
        options.candidate.messageId,
        options.candidate.resultIndex,
        buildBrowserRuntimeJobStatusPart({
          candidate: options.candidate,
          payload: options.plan,
          status: "failed",
          browserExecutionStatus: "fallback_required",
          sequence: options.initialSequence,
          progressPercent: 0,
          progressLabel: COMPOSE_MEDIA_REROUTING_LABEL,
          error: options.initialError,
          failureCode: options.failureCode,
          failureStage: options.initialFailureStage,
          conversationId,
        }),
      );

      try {
        const deferredPart = await enqueueDeferredComposeMediaJob({
          conversationId,
          plan: options.plan,
          signal: new AbortController().signal,
        });

        dispatch({
          type: "REWRITE_TOOL_RESULT_AS_BROWSER_JOB",
          messageId: options.candidate.messageId,
          resultIndex: options.candidate.resultIndex,
          part: deferredPart,
        });
      } catch (error) {
        dispatchSnapshot(
          options.candidate.messageId,
          options.candidate.resultIndex,
          buildBrowserRuntimeJobStatusPart({
            candidate: options.candidate,
            payload: options.plan,
            status: "failed",
            browserExecutionStatus: "failed",
            sequence: options.initialSequence + 1,
            progressPercent: 0,
            progressLabel: COMPOSE_MEDIA_FAILURE_LABEL,
            error: error instanceof Error ? error.message : String(error),
            failureCode: "deferred_enqueue_failed",
            failureStage: "deferred_enqueue",
            conversationId,
          }),
        );
      }
    };

    for (const candidate of resolvedCandidates) {
      if (candidate.snapshot?.status === "succeeded") {
        removePersistedBrowserRuntimeEntry(candidate.jobId);
        completedRuntimeJobs.current.add(candidate.jobId);
        continue;
      }

      dispatchSnapshot(
        candidate.messageId,
        candidate.resultIndex,
        buildBrowserRuntimeJobStatusPart({
          candidate,
          payload: candidate.payload,
          status: "succeeded",
          sequence: candidate.snapshot?.sequence ?? 1,
          conversationId,
        }),
      );
      removePersistedBrowserRuntimeEntry(candidate.jobId);
      completedRuntimeJobs.current.add(candidate.jobId);
    }

    for (const jobId of runtimePlan.cleanupJobIds) {
      removePersistedBrowserRuntimeEntry(jobId);
    }

    for (const decision of runtimePlan.reconcile) {
      const recoveredPlan = decision.candidate.toolName === "compose_media"
        && decision.runtimeStatus === "fallback_required"
        ? resolveComposeMediaPlanFromCandidate(decision.candidate)
        : null;

      if (recoveredPlan) {
        completedRuntimeJobs.current.add(decision.candidate.jobId);
        void enqueueComposeMediaRecovery({
          candidate: decision.candidate,
          plan: recoveredPlan,
          failureCode: decision.runtimeStatus,
          initialSequence: (decision.candidate.snapshot?.sequence ?? 0) + 1,
          initialFailureStage: "recovery",
          initialError: decision.reason,
        });
        continue;
      }

      completedRuntimeJobs.current.add(decision.candidate.jobId);
      dispatchSnapshot(
        decision.candidate.messageId,
        decision.candidate.resultIndex,
        buildBrowserRuntimeJobStatusPart({
          candidate: decision.candidate,
          payload: decision.candidate.payload,
          status: "failed",
          browserExecutionStatus: decision.runtimeStatus,
          sequence: (decision.candidate.snapshot?.sequence ?? 0) + 1,
          progressPercent: 0,
          progressLabel:
            decision.runtimeStatus === "fallback_required"
              ? COMPOSE_MEDIA_REROUTING_LABEL
              : "Local execution interrupted",
          error: decision.reason,
          failureCode: decision.runtimeStatus,
          failureStage: "recovery",
          conversationId,
        }),
      );
    }

    for (const candidate of runtimePlan.queue) {
      upsertPersistedBrowserRuntimeEntry({
        jobId: candidate.jobId,
        toolName: candidate.toolName,
        conversationId,
        status: "queued",
        updatedAt: new Date().toISOString(),
      });

      if (candidate.snapshot?.status === "queued") {
        continue;
      }

      dispatchSnapshot(
        candidate.messageId,
        candidate.resultIndex,
        buildBrowserRuntimeJobStatusPart({
          candidate,
          payload: candidate.payload,
          status: "queued",
          sequence: (candidate.snapshot?.sequence ?? 0) + 1,
          progressPercent: 0,
          progressLabel: "Queued for local execution",
          conversationId,
        }),
      );
    }

    for (const decision of runtimePlan.overflow) {
      removePersistedBrowserRuntimeEntry(decision.candidate.jobId);
      const overflowPlan = decision.candidate.toolName === "compose_media"
        && decision.runtimeStatus === "fallback_required"
        ? resolveComposeMediaPlanFromCandidate(decision.candidate)
        : null;

      if (overflowPlan) {
        completedRuntimeJobs.current.add(decision.candidate.jobId);
        void enqueueComposeMediaRecovery({
          candidate: decision.candidate,
          plan: overflowPlan,
          failureCode: decision.runtimeStatus,
          initialSequence: (decision.candidate.snapshot?.sequence ?? 0) + 1,
          initialFailureStage: "local_execution",
          initialError: decision.reason,
        });
        continue;
      }

      completedRuntimeJobs.current.add(decision.candidate.jobId);
      dispatchSnapshot(
        decision.candidate.messageId,
        decision.candidate.resultIndex,
        buildBrowserRuntimeJobStatusPart({
          candidate: decision.candidate,
          payload: decision.candidate.payload,
          status: "failed",
          browserExecutionStatus: decision.runtimeStatus,
          sequence: (decision.candidate.snapshot?.sequence ?? 0) + 1,
          progressPercent: 0,
          progressLabel:
            decision.runtimeStatus === "fallback_required"
              ? COMPOSE_MEDIA_REROUTING_LABEL
              : "Local execution capacity full",
          error: decision.reason,
          failureCode: decision.runtimeStatus,
          failureStage: "local_execution",
          conversationId,
        }),
      );
    }

    for (const candidate of runtimePlan.start) {
      upsertPersistedBrowserRuntimeEntry({
        jobId: candidate.jobId,
        toolName: candidate.toolName,
        conversationId,
        status: "running",
        updatedAt: new Date().toISOString(),
      });

      if (candidate.toolName === "compose_media") {
        if (controllers.has(candidate.jobId) || candidate.snapshot?.status === "succeeded") {
          continue;
        }

        const initialPlan = resolveComposeMediaPlanFromCandidate(candidate);
        if (!initialPlan) {
          completedRuntimeJobs.current.add(candidate.jobId);
          dispatchSnapshot(
            candidate.messageId,
            candidate.resultIndex,
            buildBrowserRuntimeJobStatusPart({
              candidate,
              payload: candidate.payload,
              status: "failed",
              browserExecutionStatus: "failed",
              sequence: (candidate.snapshot?.sequence ?? 0) + 1,
              progressPercent: 0,
              progressLabel: COMPOSE_MEDIA_FAILURE_LABEL,
              error: "Compose media plan is missing or invalid.",
              failureCode: COMPOSE_MEDIA_INVALID_PLAN_FAILURE_CODE,
              failureStage: "composition_preflight",
              conversationId,
            }),
          );
          continue;
        }

        const controller = new AbortController();
        controllers.set(candidate.jobId, controller);

        dispatchSnapshot(
          candidate.messageId,
          candidate.resultIndex,
          buildBrowserRuntimeJobStatusPart({
            candidate,
            payload: initialPlan,
            status: "running",
            sequence: 1,
            progressPercent: 5,
            progressLabel: getComposeMediaProgressLabel("staging_assets", {
              plan: initialPlan,
              progressPercent: 5,
            }),
            conversationId,
          }),
        );

        const executor = new FfmpegBrowserExecutor();

        void (async () => {
          let plan: MediaCompositionPlan;

          try {
            plan = await materializeComposeMediaPlan({
              plan: initialPlan,
              messages,
              conversationId,
              toolInvocationId: candidate.toolInvocationId,
              signal: controller.signal,
            });
          } catch (error) {
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
                error: error instanceof Error ? error.message : String(error),
                failureCode: "asset_materialization_failed",
                failureStage: "composition_preflight",
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

          let preflightFailure: Awaited<ReturnType<typeof resolveBrowserComposeMediaPreflightFailure>>;

          try {
            preflightFailure = await resolveBrowserComposeMediaPreflightFailure({
              plan,
              signal: controller.signal,
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
              progressLabel: getComposeMediaProgressLabel("staging_assets", {
                plan,
                progressPercent: 10,
              }),
              conversationId,
            }),
          );

          const result = await executor.execute(
            plan,
            { conversationId, userId: "browser", toolInvocationId: candidate.toolInvocationId },
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
            if (!resolved) {
              return;
            }

            const { result, plan } = resolved;

            if (result.status === "succeeded" && result.envelope) {
              const envelope = result.envelope;
              const videoArtifact = envelope.artifacts?.find((artifact) => artifact.kind === "video");
              const envelopePayload = (envelope.payload ?? null) as { primaryAssetId?: unknown } | null;
              const primaryAssetId = typeof envelopePayload?.primaryAssetId === "string"
                ? envelopePayload.primaryAssetId
                : null;
              const playbackUri = videoArtifact?.uri ?? (primaryAssetId ? `/api/user-files/${primaryAssetId}` : null);

              if (!playbackUri) {
                dispatchSnapshot(
                  candidate.messageId,
                  candidate.resultIndex,
                  buildBrowserRuntimeJobStatusPart({
                    candidate,
                    payload: envelope.payload,
                    status: "succeeded",
                    sequence: 4,
                    progressPercent: 100,
                    progressLabel: COMPOSE_MEDIA_COMPLETE_LABEL,
                    conversationId,
                  }),
                );
                completedRuntimeJobs.current.add(candidate.jobId);
                return;
              }

              dispatchSnapshot(
                candidate.messageId,
                candidate.resultIndex,
                buildBrowserRuntimeJobStatusPart({
                  candidate,
                  payload: envelope.payload,
                  status: "running",
                  sequence: 3,
                  progressPercent: 98,
                  progressLabel: getComposeMediaProgressLabel("verifying_playback", {
                    plan,
                    progressPercent: 98,
                  }),
                  conversationId,
                }),
              );

              return waitForPlayableVideoAsset({
                uri: playbackUri,
                signal: controller.signal,
              }).catch((error) => {
                if (error instanceof VideoPlaybackVerificationError) {
                  return;
                }

                throw error;
              }).then(() => {
                dispatchSnapshot(
                  candidate.messageId,
                  candidate.resultIndex,
                  buildBrowserRuntimeJobStatusPart({
                    candidate,
                    payload: envelope.payload,
                    status: "succeeded",
                    sequence: 4,
                    progressPercent: 100,
                    progressLabel: COMPOSE_MEDIA_COMPLETE_LABEL,
                    conversationId,
                  }),
                );
                  completedRuntimeJobs.current.add(candidate.jobId);
              });
            } else if (result.status === "fallback_required") {
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
                const deferredPart = await enqueueDeferredComposeMediaJob({
                  conversationId,
                  plan,
                  signal: controller.signal,
                });

                dispatch({
                  type: "REWRITE_TOOL_RESULT_AS_BROWSER_JOB",
                  messageId: candidate.messageId,
                  resultIndex: candidate.resultIndex,
                  part: deferredPart,
                });
              } catch (error) {
                completedRuntimeJobs.current.add(candidate.jobId);
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
                    failureCode: "deferred_enqueue_failed",
                    failureStage: "deferred_enqueue",
                    conversationId,
                  }),
                );
                return;
              }

              completedRuntimeJobs.current.add(candidate.jobId);
            } else {
              completedRuntimeJobs.current.add(candidate.jobId);
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
            }
          })
          .catch((err) => {
            const runtimeFailure = resolveComposeMediaRuntimeFailure(err);
            completedRuntimeJobs.current.add(candidate.jobId);
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
            controllers.delete(candidate.jobId);
            removePersistedBrowserRuntimeEntry(candidate.jobId);
            bumpRuntimeTick();
          });

        continue;
      }
    }
  }, [conversationId, dispatch, messages, runtimeTick]);
}
