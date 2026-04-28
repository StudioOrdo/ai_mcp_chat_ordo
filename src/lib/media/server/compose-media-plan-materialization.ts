import fs from "node:fs";
import { Buffer } from "node:buffer";

import sharp from "sharp";

import type { MediaCompositionPlan } from "@/core/entities/media-composition";
import type { UserFile } from "@/core/entities/user-file";
import { GRAPH_SVG_HEIGHT, GRAPH_SVG_WIDTH, getGraphSvgMarkup } from "@/lib/graphs/graph-svg-markup";
import {
  parseStoredChartSource,
  parseStoredGraphSource,
} from "@/lib/media/compose-media-source-rehydration";
import { ComposeMediaSourceRehydrationError } from "@/lib/media/compose-media-errors";
import { projectUserFileToMediaAssetDescriptor } from "@/lib/media/media-asset-projection";
import { parseSvgDimensions } from "@/lib/svg-utilities";
import type { UserFileSystem } from "@/lib/user-files";

import { renderMermaidChartSvg } from "./compose-media-mermaid-renderer";

type StoredAssetRecord = Awaited<ReturnType<UserFileSystem["getById"]>>;

type MaterializedStoredAssets = Map<string, StoredAssetRecord>;

const MIN_RENDER_WIDTH = 1200;

function ensureSvgNamespace(svgMarkup: string): string {
  return svgMarkup.includes("xmlns=")
    ? svgMarkup
    : svgMarkup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
}

function getTargetWidth(plan: MediaCompositionPlan): number {
  return Math.max(plan.resolution?.width ?? 0, MIN_RENDER_WIDTH);
}

function getScaledDimensions(sourceWidth: number, sourceHeight: number, targetWidth: number): { width: number; height: number } {
  const safeWidth = sourceWidth > 0 ? sourceWidth : GRAPH_SVG_WIDTH;
  const safeHeight = sourceHeight > 0 ? sourceHeight : GRAPH_SVG_HEIGHT;
  const width = Math.max(targetWidth, safeWidth);
  const height = Math.max(Math.round(width * (safeHeight / safeWidth)), 1);
  return { width, height };
}

async function rasterizeSvgToPng(svgMarkup: string, targetWidth: number): Promise<{ png: Buffer; width: number; height: number }> {
  if (svgMarkup.trim().length === 0) {
    throw new Error("SVG markup is empty.");
  }

  const namespacedSvg = ensureSvgNamespace(svgMarkup);
  const sourceDimensions = parseSvgDimensions(namespacedSvg);
  const outputDimensions = getScaledDimensions(sourceDimensions.width, sourceDimensions.height, targetWidth);
  const png = await sharp(Buffer.from(namespacedSvg))
    .resize({
      width: outputDimensions.width,
      height: outputDimensions.height,
      fit: "fill",
      background: "white",
    })
    .flatten({ background: "white" })
    .png()
    .toBuffer();

  return {
    png,
    width: outputDimensions.width,
    height: outputDimensions.height,
  };
}

async function materializeChartAsset(params: {
  stored: NonNullable<StoredAssetRecord>;
  targetWidth: number;
}): Promise<{ png: Buffer; width: number; height: number }> {
  let source: string;

  try {
    source = fs.readFileSync(params.stored.diskPath, "utf8");
  } catch {
    throw new ComposeMediaSourceRehydrationError(
      `Governed chart source asset ${params.stored.file.id} could not be retrieved for server composition.`,
      undefined,
    );
  }

  const chart = parseStoredChartSource({
    assetId: params.stored.file.id,
    content: source,
    mimeType: params.stored.file.mimeType,
  });
  if (!chart) {
    throw new ComposeMediaSourceRehydrationError(
      `Governed chart source asset ${params.stored.file.id} could not be rehydrated for server composition.`,
    );
  }

  let svgMarkup: string;
  try {
    svgMarkup = await renderMermaidChartSvg(chart.code);
  } catch {
    throw new ComposeMediaSourceRehydrationError(
      `Governed chart source asset ${params.stored.file.id} could not be rendered for server composition.`,
    );
  }

  return await rasterizeSvgToPng(svgMarkup, params.targetWidth);
}

async function materializeGraphAsset(params: {
  stored: NonNullable<StoredAssetRecord>;
  targetWidth: number;
}): Promise<{ png: Buffer; width: number; height: number }> {
  let source: string;

  try {
    source = fs.readFileSync(params.stored.diskPath, "utf8");
  } catch {
    throw new ComposeMediaSourceRehydrationError(
      `Governed graph source asset ${params.stored.file.id} could not be retrieved for server composition.`,
    );
  }

  const payload = parseStoredGraphSource({
    assetId: params.stored.file.id,
    content: source,
    mimeType: params.stored.file.mimeType,
  });
  if (!payload) {
    throw new ComposeMediaSourceRehydrationError(
      `Governed graph source asset ${params.stored.file.id} could not be rehydrated for server composition.`,
    );
  }
  const svgMarkup = await getGraphSvgMarkup(payload.graph);
  return await rasterizeSvgToPng(svgMarkup, params.targetWidth);
}

async function persistDerivedImage(params: {
  userFiles: UserFileSystem;
  originalFile: UserFile;
  userId: string;
  conversationId: string | null;
  toolInvocationId?: string;
  png: Buffer;
  width: number;
  height: number;
}): Promise<StoredAssetRecord> {
  const stored = await params.userFiles.storeBinary({
    userId: params.userId,
    conversationId: params.conversationId,
    fileType: "image",
    mimeType: "image/png",
    extension: "png",
    data: params.png,
    metadata: {
      assetKind: "image",
      source: "derived",
      retentionClass: params.conversationId ? "conversation" : "ephemeral",
      derivativeOfAssetId: params.originalFile.id,
      width: params.width,
      height: params.height,
      toolName: "compose_media",
      ...(params.toolInvocationId ? { toolInvocationId: params.toolInvocationId } : {}),
      ...(params.originalFile.metadata.toolInvocationId
        ? { derivativeOfToolInvocationId: params.originalFile.metadata.toolInvocationId }
        : {}),
    },
  });

  return params.userFiles.getById(stored.id);
}

export async function materializeServerComposePlan(params: {
  plan: MediaCompositionPlan;
  userId: string;
  conversationId: string | null;
  toolInvocationId?: string;
  userFiles: UserFileSystem;
  storedAssets: MaterializedStoredAssets;
}): Promise<{
  plan: MediaCompositionPlan;
  storedAssets: MaterializedStoredAssets;
}> {
  const targetWidth = getTargetWidth(params.plan);
  const derivedAssets = new Map<string, NonNullable<StoredAssetRecord>>();
  let changed = false;

  const visualClips = await Promise.all(params.plan.visualClips.map(async (clip) => {
    if (clip.kind !== "chart" && clip.kind !== "graph") {
      return clip;
    }

    if (derivedAssets.has(clip.assetId)) {
      const derived = derivedAssets.get(clip.assetId);
      return {
        ...clip,
        kind: "image" as const,
        assetId: derived?.file.id ?? clip.assetId,
        sourceAssetId: clip.sourceAssetId ?? clip.assetId,
      };
    }

    const stored = params.storedAssets.get(clip.assetId);
    if (!stored || stored.file.userId !== params.userId) {
      return clip;
    }

    const projected = projectUserFileToMediaAssetDescriptor(stored.file);
    if (projected?.kind !== clip.kind) {
      return clip;
    }

    const renderResult = clip.kind === "chart"
      ? await materializeChartAsset({ stored, targetWidth })
      : await materializeGraphAsset({ stored, targetWidth });
    const derived = await persistDerivedImage({
      userFiles: params.userFiles,
      originalFile: stored.file,
      userId: params.userId,
      conversationId: params.conversationId,
      toolInvocationId: params.toolInvocationId,
      png: renderResult.png,
      width: renderResult.width,
      height: renderResult.height,
    });

    if (!derived) {
      throw new Error(`Unable to persist derived image for ${clip.kind} asset ${clip.assetId}.`);
    }

    derivedAssets.set(clip.assetId, derived);
    params.storedAssets.set(derived.file.id, derived);
    changed = true;

    return {
      ...clip,
      kind: "image" as const,
      assetId: derived.file.id,
      sourceAssetId: clip.sourceAssetId ?? clip.assetId,
    };
  }));

  return {
    plan: changed ? { ...params.plan, visualClips } : params.plan,
    storedAssets: params.storedAssets,
  };
}