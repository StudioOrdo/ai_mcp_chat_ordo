import type { Dispatch, MutableRefObject } from "react";

import type { ChatMessage } from "@/core/entities/chat-message";
import type {
  MediaAssetKind,
  MediaAssetRetentionClass,
  MediaAssetSource,
} from "@/core/entities/media-asset";

import type { ChatAction } from "./chatState";
import type { BrowserJobOrchestration } from "./useBrowserJobOrchestration";
import type { RuntimeSnapshots } from "./useRuntimeSnapshots";
import type { ComposeMediaMaterialization } from "./useComposeMediaMaterialization";
import {
  isGenerateAudioPayload,
  readStoredPayloadFields,
  resolveChartRuntimePayload,
  resolveGraphRuntimePayload,
  type BrowserRuntimeStoredPayloadFields,
} from "./useAssetResolutionIndex";
import {
  buildBrowserRuntimeJobStatusPart,
  getBrowserRuntimeCandidates,
  withResolvedAudioAsset,
} from "@/lib/media/browser-runtime/job-snapshots";
import { planBrowserCapabilityRuntimeCycle } from "@/lib/media/browser-runtime/browser-capability-runtime";

type BrowserRuntimeStoredAsset = {
  assetId: string;
  mimeType: string;
  assetKind?: MediaAssetKind;
  source?: MediaAssetSource;
  retentionClass?: MediaAssetRetentionClass;
};

export interface RunBrowserCapabilityRuntimeCycleOptions {
  conversationId: string | null;
  messages: ChatMessage[];
  dispatch: Dispatch<ChatAction>;
  latestMessagesRef: MutableRefObject<ChatMessage[]>;
  orchestration: BrowserJobOrchestration;
  snapshots: RuntimeSnapshots;
  composeMediaMaterialization: ComposeMediaMaterialization;
  bumpRuntimeTick: () => void;
}

export const AUDIO_FETCH_TIMEOUT_MS = 60_000;
const AUDIO_FETCH_MAX_ATTEMPTS = 3;
const AUDIO_FETCH_BASE_BACKOFF_MS = 2_000;
const AUDIO_FETCH_MAX_RETRY_AFTER_MS = 30_000;

class AudioGenerationTimeoutError extends Error {
  readonly failureCode = "audio_generation_timeout";

  constructor(public readonly timeoutMs: number = AUDIO_FETCH_TIMEOUT_MS) {
    super(`Audio generation timed out after ${timeoutMs}ms.`);
    this.name = "AudioGenerationTimeoutError";
  }
}

class AudioGenerationRequestError extends Error {
  constructor(
    message: string,
    public readonly failureCode: string,
    public readonly retriable: boolean,
    public readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "AudioGenerationRequestError";
  }
}

function resolveAudioGenerationTimeoutError(error: unknown): AudioGenerationTimeoutError | null {
  if (error instanceof AudioGenerationTimeoutError) {
    return error;
  }

  if (
    error instanceof Error
    && error.name === "AudioGenerationTimeoutError"
    && /^Audio generation timed out after (\d+)ms\.$/.test(error.message)
  ) {
    const match = error.message.match(/^Audio generation timed out after (\d+)ms\.$/);
    return new AudioGenerationTimeoutError(match ? Number.parseInt(match[1], 10) : AUDIO_FETCH_TIMEOUT_MS);
  }

  return null;
}

function createAudioGenerationFetchSignal(signal: AbortSignal): {
  signal: AbortSignal;
  timeoutPromise: Promise<never>;
  didTimeout: () => boolean;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort(new AudioGenerationTimeoutError());
  }, AUDIO_FETCH_TIMEOUT_MS);

  const abortFromCaller = () => {
    if (!controller.signal.aborted) {
      controller.abort(signal.reason);
    }
  };

  if (signal.aborted) {
    abortFromCaller();
  } else {
    signal.addEventListener("abort", abortFromCaller, { once: true });
  }

  return {
    signal: controller.signal,
    timeoutPromise: new Promise((_, reject) => {
      const onAbort = () => {
        controller.signal.removeEventListener("abort", onAbort);
        reject(controller.signal.reason);
      };

      controller.signal.addEventListener("abort", onAbort, { once: true });
      if (controller.signal.aborted) {
        onAbort();
      }
    }),
    didTimeout: () => timedOut,
    cleanup: () => {
      globalThis.clearTimeout(timeoutId);
      signal.removeEventListener("abort", abortFromCaller);
    },
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, AUDIO_FETCH_MAX_RETRY_AFTER_MS);
  }

  const asDate = Date.parse(trimmed);
  if (Number.isNaN(asDate)) {
    return null;
  }

  return Math.min(Math.max(0, asDate - Date.now()), AUDIO_FETCH_MAX_RETRY_AFTER_MS);
}

function getAudioRetryBackoffMs(attempt: number): number {
  return AUDIO_FETCH_BASE_BACKOFF_MS * (2 ** Math.max(0, attempt - 1));
}

function createAbortError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }

  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function waitForAbortableDelay(delayMs: number, signal: AbortSignal): Promise<void> {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      globalThis.clearTimeout(timeoutId);
      signal.removeEventListener("abort", onAbort);
      reject(createAbortError(signal.reason));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function requestAudioGeneration(options: {
  title: string;
  text: string;
  conversationId: string | null;
  signal: AbortSignal;
}): Promise<string> {
  for (let attempt = 1; attempt <= AUDIO_FETCH_MAX_ATTEMPTS; attempt += 1) {
    const audioFetchSignal = createAudioGenerationFetchSignal(options.signal);

    try {
      const response = await Promise.race([
        fetch("/api/runtime/generate-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: options.title,
            text: options.text,
            conversationId: options.conversationId,
          }),
          signal: audioFetchSignal.signal,
        }),
        audioFetchSignal.timeoutPromise,
      ]);

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        const message = payload?.error || `Audio generation failed (${response.status}).`;
        const retryAfterMs = response.status === 429
          ? parseRetryAfterMs(response.headers.get("Retry-After"))
          : null;
        const requestError = new AudioGenerationRequestError(
          message,
          response.status === 429
            ? "audio_generation_rate_limited"
            : response.status >= 500
              ? "network_unreachable"
              : "audio_generation_rejected",
          response.status === 429 || response.status >= 500,
          retryAfterMs,
        );

        if (!requestError.retriable || attempt >= AUDIO_FETCH_MAX_ATTEMPTS) {
          throw requestError;
        }

        await waitForAbortableDelay(
          requestError.retryAfterMs ?? getAudioRetryBackoffMs(attempt),
          options.signal,
        );
        continue;
      }

      const payload = await response.json().catch(() => null) as { assetId?: string | null } | null;
      const assetId = typeof payload?.assetId === "string" ? payload.assetId : null;
      if (!assetId) {
        throw new AudioGenerationRequestError(
          "Audio generation completed without returning a stored asset id.",
          "audio_generation_failed",
          false,
        );
      }

      return assetId;
    } catch (error) {
      const timeoutError = audioFetchSignal.didTimeout()
        ? new AudioGenerationTimeoutError()
        : audioFetchSignal.signal.reason instanceof AudioGenerationTimeoutError
          ? audioFetchSignal.signal.reason
          : resolveAudioGenerationTimeoutError(error);

      if (timeoutError) {
        throw timeoutError;
      }

      if (isAbortError(error)) {
        throw error;
      }

      if (error instanceof AudioGenerationRequestError) {
        if (!error.retriable || attempt >= AUDIO_FETCH_MAX_ATTEMPTS) {
          throw error;
        }

        await waitForAbortableDelay(
          error.retryAfterMs ?? getAudioRetryBackoffMs(attempt),
          options.signal,
        );
        continue;
      }

      const networkError = new AudioGenerationRequestError(
        error instanceof Error ? error.message : "Audio generation failed.",
        "network_unreachable",
        true,
      );

      if (attempt >= AUDIO_FETCH_MAX_ATTEMPTS) {
        throw networkError;
      }

      await waitForAbortableDelay(getAudioRetryBackoffMs(attempt), options.signal);
    } finally {
      audioFetchSignal.cleanup();
    }
  }

  throw new AudioGenerationRequestError("Audio generation failed.", "audio_generation_failed", false);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isResolvedBrowserRuntimeCandidate(candidate: {
  toolName: string;
  payload: unknown;
}): boolean {
  if (candidate.toolName === "generate_audio") {
    return isGenerateAudioPayload(candidate.payload) && Boolean(candidate.payload.assetId);
  }

  if (candidate.toolName === "generate_chart" || candidate.toolName === "generate_graph") {
    return Boolean(readStoredPayloadFields(candidate.payload).assetId);
  }

  if (candidate.toolName === "compose_media") {
    return isRecord(candidate.payload) && typeof candidate.payload.primaryAssetId === "string";
  }

  return false;
}

function toStoredPayloadFields(stored: BrowserRuntimeStoredAsset): BrowserRuntimeStoredPayloadFields {
  return {
    assetId: stored.assetId,
    mimeType: stored.mimeType,
    ...(stored.assetKind ? { assetKind: stored.assetKind } : {}),
    ...(stored.source ? { assetSource: stored.source } : {}),
    ...(stored.retentionClass ? { retentionClass: stored.retentionClass } : {}),
  };
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

async function uploadBrowserRuntimeAsset(options: {
  file: File;
  conversationId: string | null;
  signal: AbortSignal;
}): Promise<BrowserRuntimeStoredAsset> {
  const formData = new FormData();
  formData.append("files", options.file);
  if (options.conversationId) {
    formData.append("conversationId", options.conversationId);
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
    }>;
  };
  const stored = payload.attachments?.[0];

  if (!stored?.assetId || !stored.mimeType) {
    throw new Error("Asset persistence completed without returning stored asset metadata.");
  }

  return stored;
}

async function persistBrowserRuntimePayload(options: {
  toolName: "generate_chart" | "generate_graph";
  payload: unknown;
  args: Record<string, unknown>;
  conversationId: string | null;
  signal: AbortSignal;
}) {
  if (options.toolName === "generate_chart") {
    const chart = resolveChartRuntimePayload(options.payload, options.args);
    if (chart.assetId) {
      return chart;
    }

    const stored = await uploadBrowserRuntimeAsset({
      file: new File(
        [chart.code],
        `${toFileStem(chart.downloadFileName || chart.title, "chart")}.mmd`,
        { type: "text/vnd.mermaid" },
      ),
      conversationId: options.conversationId,
      signal: options.signal,
    });

    return {
      ...chart,
      ...toStoredPayloadFields(stored),
    };
  }

  const graph = resolveGraphRuntimePayload(options.payload, options.args);
  if (graph.assetId) {
    return graph;
  }

  const stored = await uploadBrowserRuntimeAsset({
    file: new File(
      [JSON.stringify(graph, null, 2)],
      `${toFileStem(graph.downloadFileName || graph.title, "graph")}.json`,
      { type: "application/vnd.studioordo.graph+json" },
    ),
    conversationId: options.conversationId,
    signal: options.signal,
  });

  return {
    ...graph,
    ...toStoredPayloadFields(stored),
  };
}

export function runBrowserCapabilityRuntimeCycle({
  conversationId,
  messages,
  dispatch,
  latestMessagesRef,
  orchestration,
  snapshots,
  composeMediaMaterialization,
  bumpRuntimeTick,
}: RunBrowserCapabilityRuntimeCycleOptions): void {
  const candidates = getBrowserRuntimeCandidates(messages).filter((candidate) => {
    if (
      candidate.snapshot?.status === "succeeded"
      || candidate.snapshot?.status === "failed"
      || candidate.snapshot?.status === "canceled"
    ) {
      orchestration.clearCompleted(candidate.jobId);
      return true;
    }

    return !orchestration.isCompleted(candidate.jobId);
  });
  const resolvedCandidates = candidates.filter(isResolvedBrowserRuntimeCandidate);
  const pendingCandidates = candidates.filter((candidate) => !isResolvedBrowserRuntimeCandidate(candidate));
  const runtimePlan = planBrowserCapabilityRuntimeCycle({
    candidates: pendingCandidates,
    activeJobIds: orchestration.getActiveJobIds(),
    persistedEntries: snapshots.list(),
  });

  const dispatchSnapshot = (
    messageId: string,
    resultIndex: number,
    part: ReturnType<typeof buildBrowserRuntimeJobStatusPart>,
  ) => {
    const currentTarget = getBrowserRuntimeCandidates(latestMessagesRef.current)
      .find((candidate) => candidate.jobId === part.jobId);

    dispatch({
      type: "REWRITE_TOOL_RESULT_AS_BROWSER_JOB",
      messageId: currentTarget?.messageId ?? messageId,
      resultIndex: currentTarget?.resultIndex ?? resultIndex,
      part,
    });
  };

  for (const candidate of resolvedCandidates) {
    if (candidate.snapshot?.status === "succeeded") {
      snapshots.remove(candidate.jobId);
      orchestration.markCompleted(candidate.jobId);
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
    snapshots.remove(candidate.jobId);
    orchestration.markCompleted(candidate.jobId);
  }

  for (const jobId of runtimePlan.cleanupJobIds) {
    snapshots.remove(jobId);
  }

  for (const decision of runtimePlan.reconcile) {
    const recoveredPlan = decision.candidate.toolName === "compose_media"
      && decision.runtimeStatus === "fallback_required"
      ? composeMediaMaterialization.resolvePlanFromCandidate(decision.candidate, "recovery")
      : null;

    if (recoveredPlan?.plan) {
      orchestration.markCompleted(decision.candidate.jobId);
      void composeMediaMaterialization.enqueueRecovery({
        candidate: decision.candidate,
        plan: recoveredPlan.plan,
        failureCode: decision.runtimeStatus,
        initialSequence: (decision.candidate.snapshot?.sequence ?? 0) + 1,
        initialFailureStage: "recovery",
        initialError: decision.reason,
        dispatch,
        dispatchSnapshot,
      });
      continue;
    }

    if (recoveredPlan?.error) {
      orchestration.markCompleted(decision.candidate.jobId);
      dispatchSnapshot(
        decision.candidate.messageId,
        decision.candidate.resultIndex,
        buildBrowserRuntimeJobStatusPart({
          candidate: decision.candidate,
          payload: decision.candidate.payload,
          status: "failed",
          browserExecutionStatus: "failed",
          sequence: (decision.candidate.snapshot?.sequence ?? 0) + 1,
          progressPercent: 0,
          progressLabel: "Composition failed",
          error: recoveredPlan.error,
          failureCode: recoveredPlan.failureCode,
          failureStage: recoveredPlan.failureStage,
          conversationId,
        }),
      );
      continue;
    }

    orchestration.markCompleted(decision.candidate.jobId);
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
            ? "Rerouting to server"
            : "Local execution interrupted",
        error: decision.reason,
        failureCode: decision.runtimeStatus,
        failureStage: "recovery",
        conversationId,
      }),
    );
  }

  for (const candidate of runtimePlan.queue) {
    snapshots.persist({
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
    snapshots.remove(decision.candidate.jobId);
    const overflowPlan = decision.candidate.toolName === "compose_media"
      && decision.runtimeStatus === "fallback_required"
      ? composeMediaMaterialization.resolvePlanFromCandidate(decision.candidate, "local_execution")
      : null;

    if (overflowPlan?.plan) {
      orchestration.markCompleted(decision.candidate.jobId);
      void composeMediaMaterialization.enqueueRecovery({
        candidate: decision.candidate,
        plan: overflowPlan.plan,
        failureCode: decision.runtimeStatus,
        initialSequence: (decision.candidate.snapshot?.sequence ?? 0) + 1,
        initialFailureStage: "local_execution",
        initialError: decision.reason,
        dispatch,
        dispatchSnapshot,
      });
      continue;
    }

    if (overflowPlan?.error) {
      orchestration.markCompleted(decision.candidate.jobId);
      dispatchSnapshot(
        decision.candidate.messageId,
        decision.candidate.resultIndex,
        buildBrowserRuntimeJobStatusPart({
          candidate: decision.candidate,
          payload: decision.candidate.payload,
          status: "failed",
          browserExecutionStatus: "failed",
          sequence: (decision.candidate.snapshot?.sequence ?? 0) + 1,
          progressPercent: 0,
          progressLabel: "Composition failed",
          error: overflowPlan.error,
          failureCode: overflowPlan.failureCode,
          failureStage: overflowPlan.failureStage,
          conversationId,
        }),
      );
      continue;
    }

    orchestration.markCompleted(decision.candidate.jobId);
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
            ? "Rerouting to server"
            : "Local execution capacity full",
        error: decision.reason,
        failureCode: decision.runtimeStatus,
        failureStage: "local_execution",
        conversationId,
      }),
    );
  }

  for (const candidate of runtimePlan.start) {
    snapshots.persist({
      jobId: candidate.jobId,
      toolName: candidate.toolName,
      conversationId,
      status: "running",
      updatedAt: new Date().toISOString(),
    });

    if (candidate.toolName === "compose_media") {
      composeMediaMaterialization.startRuntime({
        candidate,
        dispatch,
        dispatchSnapshot,
        orchestration,
        snapshots,
        bumpRuntimeTick,
      });
      continue;
    }

    if (candidate.toolName === "generate_chart" || candidate.toolName === "generate_graph") {
      const initialSequence = candidate.snapshot?.sequence ?? 1;
      dispatchSnapshot(
        candidate.messageId,
        candidate.resultIndex,
        buildBrowserRuntimeJobStatusPart({
          candidate,
          payload: candidate.payload,
          status: "succeeded",
          sequence: initialSequence,
          conversationId,
        }),
      );

      if (readStoredPayloadFields(candidate.payload).assetId || orchestration.hasController(candidate.jobId)) {
        continue;
      }

      const controller = new AbortController();
      orchestration.register(candidate.jobId, controller);

      void persistBrowserRuntimePayload({
        toolName: candidate.toolName,
        payload: candidate.payload,
        args: candidate.args,
        conversationId,
        signal: controller.signal,
      })
        .then((storedPayload) => {
          orchestration.markCompleted(candidate.jobId);
          dispatchSnapshot(
            candidate.messageId,
            candidate.resultIndex,
            buildBrowserRuntimeJobStatusPart({
              candidate,
              payload: storedPayload,
              status: "succeeded",
              sequence: initialSequence + 1,
              progressPercent: 100,
              progressLabel: candidate.toolName === "generate_chart" ? "Chart stored" : "Graph stored",
              conversationId,
            }),
          );
        })
        .catch(() => {
          // Keep the payload-backed snapshot visible even if asset persistence fails.
        })
        .finally(() => {
          orchestration.unregister(candidate.jobId);
          snapshots.remove(candidate.jobId);
          bumpRuntimeTick();
        });
      continue;
    }

    if (!isGenerateAudioPayload(candidate.payload)) {
      continue;
    }

    if (candidate.payload.assetId) {
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
      orchestration.markCompleted(candidate.jobId);
      snapshots.remove(candidate.jobId);
      continue;
    }

    if (orchestration.hasController(candidate.jobId)) {
      continue;
    }

    const controller = new AbortController();
    orchestration.register(candidate.jobId, controller);

    dispatchSnapshot(
      candidate.messageId,
      candidate.resultIndex,
      buildBrowserRuntimeJobStatusPart({
        candidate,
        payload: candidate.payload,
        status: "running",
        sequence: 1,
        progressPercent: 15,
        progressLabel: "Generating audio",
        conversationId,
      }),
    );

    void requestAudioGeneration({
      title: candidate.payload.title,
      text: candidate.payload.text,
      conversationId,
      signal: controller.signal,
    })
      .then((assetId) => {
        dispatchSnapshot(
          candidate.messageId,
          candidate.resultIndex,
          buildBrowserRuntimeJobStatusPart({
            candidate,
            payload: withResolvedAudioAsset(candidate.payload as Parameters<typeof withResolvedAudioAsset>[0], { assetId, conversationId }),
            status: "succeeded",
            sequence: 2,
            progressPercent: 100,
            progressLabel: "Audio ready",
            conversationId,
          }),
        );
        orchestration.markCompleted(candidate.jobId);
      })
      .catch((error) => {
        const timeoutError = resolveAudioGenerationTimeoutError(error);

        if (controller.signal.aborted && !timeoutError) {
          return;
        }

        orchestration.markCompleted(candidate.jobId);
        dispatchSnapshot(
          candidate.messageId,
          candidate.resultIndex,
          buildBrowserRuntimeJobStatusPart({
            candidate,
            payload: candidate.payload,
            status: "failed",
            browserExecutionStatus: "failed",
            sequence: 2,
            error: timeoutError?.message ?? (error instanceof Error ? error.message : "Audio generation failed."),
            failureCode: timeoutError?.failureCode ?? (error instanceof AudioGenerationRequestError ? error.failureCode : "audio_generation_failed"),
            failureStage: "asset_generation",
            conversationId,
          }),
        );
      })
      .finally(() => {
        orchestration.unregister(candidate.jobId);
        snapshots.remove(candidate.jobId);
        bumpRuntimeTick();
      });
  }
}
