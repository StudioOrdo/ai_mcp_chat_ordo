import { getUserFileDataMapper } from "@/adapters/RepositoryFactory";
import { resolveCanonicalMediaAssetId } from "@/lib/media/media-asset-id";
import { UserFileSystem } from "@/lib/user-files";
import { resolveGenerateChartPayload, type GenerateChartInput } from "@/core/use-cases/tools/chart-payload";
import type { MediaAssetRetentionClass, MediaAssetSource } from "@/core/entities/media-asset";

export const CHART_MIME_TYPE = "text/vnd.mermaid" as const;

export interface GenerateStoredChartInput extends GenerateChartInput {
  userId: string;
  conversationId?: string | null;
  assetId?: string | null;
  toolInvocationId?: string;
}

export interface StoredChartArtifact {
  assetId: string;
  code: string;
  title?: string;
  caption?: string;
  downloadFileName?: string;
  cacheHit: boolean;
}

export interface GenerateChartRuntimePayload {
  code: string;
  title?: string;
  caption?: string;
  downloadFileName?: string;
  assetId: string | null;
  assetKind: "chart";
  mimeType: "text/vnd.mermaid";
  assetSource: MediaAssetSource;
  retentionClass: MediaAssetRetentionClass;
  toolInvocationId?: string;
}

export function resolveCanonicalGeneratedChartAssetId(value: string | null | undefined): string | null {
  return resolveCanonicalMediaAssetId(value);
}

export async function generateStoredChartArtifact(
  input: GenerateStoredChartInput,
): Promise<StoredChartArtifact> {
  const payload = resolveGenerateChartPayload(input);
  const repo = getUserFileDataMapper();
  const ufs = new UserFileSystem(repo);

  const cached = await ufs.lookup(input.userId, payload.code, "chart");
  if (cached) {
    return {
      assetId: cached.file.id,
      code: payload.code,
      title: payload.title,
      caption: payload.caption,
      downloadFileName: payload.downloadFileName,
      cacheHit: true,
    };
  }

  const chartBuffer = Buffer.from(payload.code, "utf-8");
  const userFile = await ufs.store({
    id: input.assetId ?? undefined,
    userId: input.userId,
    conversationId: input.conversationId ?? null,
    input: payload.code,
    fileType: "chart",
    mimeType: CHART_MIME_TYPE,
    extension: "mmd",
    data: chartBuffer,
    metadata: {
      assetKind: "chart",
      source: "generated",
      retentionClass: input.conversationId ? "conversation" : "ephemeral",
      toolName: "generate_chart",
      ...(input.toolInvocationId ? { toolInvocationId: input.toolInvocationId } : {}),
    },
  });

  return {
    assetId: userFile.id,
    code: payload.code,
    title: payload.title,
    caption: payload.caption,
    downloadFileName: payload.downloadFileName,
    cacheHit: false,
  };
}

export function buildGenerateChartRuntimePayload(
  input: GenerateStoredChartInput,
  resolved?: Pick<StoredChartArtifact, "assetId" | "cacheHit" | "code" | "title" | "caption" | "downloadFileName">,
): GenerateChartRuntimePayload {
  const inputAssetId = resolveCanonicalGeneratedChartAssetId(input.assetId);
  const assetId = inputAssetId ?? resolved?.assetId ?? null;
  
  let payloadCode = resolved?.code;
  let payloadTitle = resolved?.title;
  let payloadCaption = resolved?.caption;
  let payloadDownloadFileName = resolved?.downloadFileName;
  
  if (!payloadCode) {
    try {
      const parsed = resolveGenerateChartPayload(input);
      payloadCode = parsed.code;
      payloadTitle = parsed.title;
      payloadCaption = parsed.caption;
      payloadDownloadFileName = parsed.downloadFileName;
    } catch {
      payloadCode = input.code ?? "";
      payloadTitle = input.title;
      payloadCaption = input.caption;
      payloadDownloadFileName = input.downloadFileName;
    }
  }

  return {
    code: payloadCode,
    title: payloadTitle,
    caption: payloadCaption,
    downloadFileName: payloadDownloadFileName,
    assetId,
    assetKind: "chart",
    mimeType: CHART_MIME_TYPE,
    assetSource: "generated",
    retentionClass: input.conversationId ? "conversation" : "ephemeral",
    ...(input.toolInvocationId ? { toolInvocationId: input.toolInvocationId } : {}),
  };
}
