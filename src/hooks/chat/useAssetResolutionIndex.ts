import { useMemo } from "react";

import type { ChatMessage } from "@/core/entities/chat-message";
import type {
  MediaCompositionAssetIdentityCandidate,
} from "@/lib/media/ffmpeg/media-composition-plan";
import { buildMediaCompositionCanonicalizationOptionsFromChatMessages } from "@/lib/media/media-composition-asset-identity";
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

export interface AssetResolutionIndex {
  getChartPayloadByAssetId(assetId: string): ResolvedChartRuntimePayload | null;
  getGraphPayloadByAssetId(assetId: string): ResolvedGraphRuntimePayload | null;
  listCandidates(): readonly MediaCompositionAssetIdentityCandidate[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

export function buildAssetResolutionIndex(messages: readonly ChatMessage[]): AssetResolutionIndex {
  const charts = new Map<string, ResolvedChartRuntimePayload>();
  const graphs = new Map<string, ResolvedGraphRuntimePayload>();
  const candidates = buildMediaCompositionCanonicalizationOptionsFromChatMessages(messages).assetCandidates ?? [];

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (part.type !== "tool_result") {
        continue;
      }

      const payload = part.result;

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

      // Audio generation is canonical job state after the hard cutover. Direct
      // historical transcript payloads remain transcript facts, not product
      // composition inputs.
    }
  }

  return {
    getChartPayloadByAssetId: (assetId) => charts.get(assetId) ?? null,
    getGraphPayloadByAssetId: (assetId) => graphs.get(assetId) ?? null,
    listCandidates: () => candidates,
  };
}

export function useAssetResolutionIndex(messages: readonly ChatMessage[]): AssetResolutionIndex {
  return useMemo(() => buildAssetResolutionIndex(messages), [messages]);
}
