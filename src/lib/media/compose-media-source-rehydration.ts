import {
  resolveGenerateChartPayload,
  type ResolvedChartPayload,
} from "@/core/use-cases/tools/chart-payload";
import {
  resolveGenerateGraphPayload,
  type ResolvedGraphPayload,
} from "@/core/use-cases/tools/graph-payload";

export interface StoredChartSourcePayload extends ResolvedChartPayload {
  assetId: string;
  mimeType: string;
}

export interface StoredGraphSourcePayload extends ResolvedGraphPayload {
  assetId: string;
  mimeType: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isResolvedGraphPayload(value: unknown): value is ResolvedGraphPayload {
  return isRecord(value) && isRecord(value.graph) && typeof value.graph.kind === "string";
}

export function parseStoredChartSource(options: {
  assetId: string;
  content: string;
  mimeType?: string | null;
}): StoredChartSourcePayload | null {
  const code = options.content.trim();
  if (!code) {
    return null;
  }

  const chart = resolveGenerateChartPayload({ code });
  return {
    ...chart,
    assetId: options.assetId,
    mimeType: options.mimeType?.trim() || "text/vnd.mermaid",
  };
}

export function parseStoredGraphSource(options: {
  assetId: string;
  content: string;
  mimeType?: string | null;
}): StoredGraphSourcePayload | null {
  const raw = options.content.trim();
  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw) as unknown;
  const payload = isResolvedGraphPayload(parsed)
    ? parsed
    : isRecord(parsed)
      ? resolveGenerateGraphPayload(parsed)
      : null;

  if (!payload) {
    return null;
  }

  return {
    ...payload,
    assetId: options.assetId,
    mimeType: options.mimeType?.trim() || "application/vnd.studioordo.graph+json",
  };
}