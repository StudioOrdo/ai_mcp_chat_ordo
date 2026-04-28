import { useMemo } from "react";

import type { ChatMessage } from "@/core/entities/chat-message";
import type {
  MediaCompositionAssetIdentityCandidate,
} from "@/lib/media/ffmpeg/media-composition-plan";
import { buildMediaCompositionCanonicalizationOptionsFromChatMessages } from "@/lib/media/media-composition-asset-identity";
import { extractJobStatusSnapshots } from "@/lib/jobs/job-status-snapshots";
import { resolveGenerateChartPayload } from "@/core/use-cases/tools/chart-payload";
import {
  resolveGenerateGraphPayload,
  type ResolvedGraphPayload,
} from "@/core/use-cases/tools/graph-payload";
import type {
  MediaAssetKind,
  MediaAssetRetentionClass,
  MediaAssetSource,
} from "@/core/entities/media-asset";

export type BrowserRuntimeStoredPayloadFields = {
  assetId?: string;
  mimeType?: string;
  assetKind?: MediaAssetKind;
  assetSource?: MediaAssetSource;
  retentionClass?: MediaAssetRetentionClass;
  toolInvocationId?: string;
  derivativeOfToolInvocationId?: string | null;
};

export type ResolvedChartRuntimePayload = ReturnType<typeof resolveGenerateChartPayload> & BrowserRuntimeStoredPayloadFields;
export type ResolvedGraphRuntimePayload = ResolvedGraphPayload & BrowserRuntimeStoredPayloadFields;

export type GenerateAudioRuntimePayload = {
  action: "generate_audio";
  title: string;
  text: string;
  assetId: string | null;
  provider: string;
  generationStatus: "client_fetch_pending" | "cached_asset";
  estimatedDurationSeconds: number;
  estimatedGenerationSeconds: number;
  toolInvocationId?: string;
};

export interface AssetResolutionIndex {
  getChartPayloadByAssetId(assetId: string): ResolvedChartRuntimePayload | null;
  getGraphPayloadByAssetId(assetId: string): ResolvedGraphRuntimePayload | null;
  getAudioPayloadByAssetId(assetId: string): GenerateAudioRuntimePayload | null;
  listCandidates(): readonly MediaCompositionAssetIdentityCandidate[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isGenerateAudioPayload(value: unknown): value is GenerateAudioRuntimePayload {
  return typeof value === "object"
    && value !== null
    && (value as { action?: unknown }).action === "generate_audio"
    && typeof (value as { text?: unknown }).text === "string"
    && typeof (value as { title?: unknown }).title === "string";
}

function isResolvedGraphRuntimePayload(value: unknown): value is ResolvedGraphRuntimePayload {
  return isRecord(value)
    && isRecord(value.graph)
    && typeof value.graph.kind === "string";
}

export function readStoredPayloadFields(value: unknown): BrowserRuntimeStoredPayloadFields {
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

export function resolveChartRuntimePayload(
  payload: unknown,
  args: Record<string, unknown>,
): ResolvedChartRuntimePayload {
  const raw = isRecord(payload) ? payload : args;
  return {
    ...resolveGenerateChartPayload(raw),
    ...readStoredPayloadFields(raw),
  };
}

export function resolveGraphRuntimePayload(
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

function getSnapshotPayload(result: unknown): unknown {
  const snapshots = extractJobStatusSnapshots(result);
  const snapshot = snapshots.at(-1)?.part;
  return snapshot?.resultEnvelope?.payload ?? snapshot?.resultPayload ?? result;
}

export function buildAssetResolutionIndex(messages: readonly ChatMessage[]): AssetResolutionIndex {
  const charts = new Map<string, ResolvedChartRuntimePayload>();
  const graphs = new Map<string, ResolvedGraphRuntimePayload>();
  const audios = new Map<string, GenerateAudioRuntimePayload>();
  const candidates = buildMediaCompositionCanonicalizationOptionsFromChatMessages(messages).assetCandidates ?? [];

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (part.type !== "tool_result") {
        continue;
      }

      const payload = getSnapshotPayload(part.result);

      if (part.name === "generate_chart") {
        try {
          const chart = resolveChartRuntimePayload(payload, {});
          if (chart.assetId) {
            charts.set(chart.assetId, chart);
          }
        } catch {
          // Ignore malformed payloads.
        }
        continue;
      }

      if (part.name === "generate_graph") {
        try {
          const graph = resolveGraphRuntimePayload(payload, {});
          if (graph.assetId) {
            graphs.set(graph.assetId, graph);
          }
        } catch {
          // Ignore malformed payloads.
        }
        continue;
      }

      if (part.name === "generate_audio" && isGenerateAudioPayload(payload) && payload.assetId) {
        audios.set(payload.assetId, payload);
      }
    }
  }

  return {
    getChartPayloadByAssetId: (assetId) => charts.get(assetId) ?? null,
    getGraphPayloadByAssetId: (assetId) => graphs.get(assetId) ?? null,
    getAudioPayloadByAssetId: (assetId) => audios.get(assetId) ?? null,
    listCandidates: () => candidates,
  };
}

export function useAssetResolutionIndex(messages: readonly ChatMessage[]): AssetResolutionIndex {
  return useMemo(() => buildAssetResolutionIndex(messages), [messages]);
}