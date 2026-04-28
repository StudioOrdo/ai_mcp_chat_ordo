import { getUserFileDataMapper } from "@/adapters/RepositoryFactory";
import { resolveCanonicalMediaAssetId } from "@/lib/media/media-asset-id";
import { UserFileSystem } from "@/lib/user-files";
import { resolveGenerateGraphPayload, type GenerateGraphInput } from "@/core/use-cases/tools/graph-payload";
import type { MediaAssetRetentionClass, MediaAssetSource } from "@/core/entities/media-asset";

export const GRAPH_MIME_TYPE = "application/vnd.studioordo.graph+json" as const;

export interface GenerateStoredGraphInput extends GenerateGraphInput {
  userId: string;
  conversationId?: string | null;
  assetId?: string | null;
  toolInvocationId?: string;
}

export interface StoredGraphArtifact {
  assetId: string;
  payload: Record<string, unknown>;
  cacheHit: boolean;
}

export interface GenerateGraphRuntimePayload extends Record<string, unknown> {
  assetId: string | null;
  assetKind: "graph";
  mimeType: "application/vnd.studioordo.graph+json";
  assetSource: MediaAssetSource;
  retentionClass: MediaAssetRetentionClass;
  toolInvocationId?: string;
}

export function resolveCanonicalGeneratedGraphAssetId(value: string | null | undefined): string | null {
  return resolveCanonicalMediaAssetId(value);
}

export async function generateStoredGraphArtifact(
  input: GenerateStoredGraphInput,
): Promise<StoredGraphArtifact> {
  const payload = resolveGenerateGraphPayload(input);
  const repo = getUserFileDataMapper();
  const ufs = new UserFileSystem(repo);

  const jsonPayload = JSON.stringify(payload, null, 2);
  const cached = await ufs.lookup(input.userId, jsonPayload, "graph");
  if (cached) {
    return {
      assetId: cached.file.id,
      payload,
      cacheHit: true,
    };
  }

  const graphBuffer = Buffer.from(jsonPayload, "utf-8");
  const userFile = await ufs.store({
    id: input.assetId ?? undefined,
    userId: input.userId,
    conversationId: input.conversationId ?? null,
    input: jsonPayload,
    fileType: "graph",
    mimeType: GRAPH_MIME_TYPE,
    extension: "json",
    data: graphBuffer,
    metadata: {
      assetKind: "graph",
      source: "generated",
      retentionClass: input.conversationId ? "conversation" : "ephemeral",
      toolName: "generate_graph",
      ...(input.toolInvocationId ? { toolInvocationId: input.toolInvocationId } : {}),
    },
  });

  return {
    assetId: userFile.id,
    payload,
    cacheHit: false,
  };
}

export function buildGenerateGraphRuntimePayload(
  input: GenerateStoredGraphInput,
  resolved?: Pick<StoredGraphArtifact, "assetId" | "cacheHit" | "payload">,
): GenerateGraphRuntimePayload {
  const inputAssetId = resolveCanonicalGeneratedGraphAssetId(input.assetId);
  const assetId = inputAssetId ?? resolved?.assetId ?? null;

  let payload = resolved?.payload;
  if (!payload) {
    try {
      payload = resolveGenerateGraphPayload(input);
    } catch {
      payload = { ...input };
    }
  }

  return {
    ...payload,
    assetId,
    assetKind: "graph",
    mimeType: GRAPH_MIME_TYPE,
    assetSource: "generated",
    retentionClass: input.conversationId ? "conversation" : "ephemeral",
    ...(input.toolInvocationId ? { toolInvocationId: input.toolInvocationId } : {}),
  };
}
