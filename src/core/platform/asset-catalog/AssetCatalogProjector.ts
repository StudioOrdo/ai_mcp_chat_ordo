import type { BlogAsset } from "@/core/entities/blog-asset";
import type { AssetCatalogEntry } from "@/core/entities/asset-catalog";
import type { WorkspaceAssetRef } from "@/core/entities/conversation-workspace";
import type { MaterializationRecord } from "@/core/entities/materialization";
import type { UserFile } from "@/core/entities/user-file";
import type { ConversationMediaAssetCandidate } from "@/lib/media/media-asset-projection";
import {
  projectUserFileToConversationMediaAssetCandidate,
  resolveUserFileRetentionClass,
  resolveUserFileSource,
} from "@/lib/media/media-asset-projection";

function compareAssetCatalogEntries(left: AssetCatalogEntry, right: AssetCatalogEntry): number {
  return right.updatedAt.localeCompare(left.updatedAt);
}

export function sortAssetCatalogEntries(entries: readonly AssetCatalogEntry[]): AssetCatalogEntry[] {
  return [...entries].sort(compareAssetCatalogEntries);
}

export function dedupeAssetCatalogEntries(entries: readonly AssetCatalogEntry[]): AssetCatalogEntry[] {
  const deduped = new Map<string, AssetCatalogEntry>();

  for (const entry of sortAssetCatalogEntries(entries)) {
    if (!deduped.has(entry.assetId)) {
      deduped.set(entry.assetId, entry);
    }
  }

  return [...deduped.values()];
}

export function projectBlogAssetToAssetCatalogEntry(blogAsset: BlogAsset): AssetCatalogEntry | null {
  if (!blogAsset.mimeType.startsWith("image/")) {
    return null;
  }

  return {
    assetId: blogAsset.id,
    kind: "image",
    ownerUserId: blogAsset.createdByUserId,
    sourceType: "blog_asset",
    status: "ready",
    label: blogAsset.altText || blogAsset.id,
    fileName: blogAsset.id,
    mimeType: blogAsset.mimeType,
    source: "generated",
    retentionClass: "durable",
    createdAt: blogAsset.createdAt,
    updatedAt: blogAsset.updatedAt,
    conversationId: null,
    producedByJobId: null,
    materializationKey: null,
    toolName: "generate_blog_image",
    ...(typeof blogAsset.width === "number" ? { width: blogAsset.width } : {}),
    ...(typeof blogAsset.height === "number" ? { height: blogAsset.height } : {}),
  };
}

export function projectUserFileToAssetCatalogEntry(
  file: UserFile,
  materialization: MaterializationRecord | null | undefined,
): AssetCatalogEntry | null {
  const candidate = projectUserFileToConversationMediaAssetCandidate(file);
  const kind = candidate?.assetKind ?? (file.fileType === "document" ? "document" : null);

  if (!kind) {
    return null;
  }

  return {
    assetId: file.id,
    kind,
    ownerUserId: file.userId,
    sourceType: "user_file",
    status: file.status,
    label: candidate?.label ?? file.fileName,
    fileName: file.fileName,
    mimeType: file.mimeType,
    source: candidate?.source ?? resolveUserFileSource(file),
    retentionClass: candidate?.retentionClass ?? resolveUserFileRetentionClass(file),
    createdAt: file.createdAt,
    updatedAt: materialization?.updatedAt ?? file.createdAt,
    conversationId: materialization?.conversationId ?? file.conversationId,
    producedByJobId: materialization?.producedByJobId ?? null,
    materializationKey: materialization?.materializationKey ?? null,
    ...(candidate?.toolName ? { toolName: candidate.toolName } : {}),
    ...(candidate?.derivativeOfAssetId !== undefined
      ? { derivativeOfAssetId: candidate.derivativeOfAssetId }
      : {}),
    ...(typeof candidate?.width === "number" ? { width: candidate.width } : {}),
    ...(typeof candidate?.height === "number" ? { height: candidate.height } : {}),
    ...(typeof candidate?.durationSeconds === "number"
      ? { durationSeconds: candidate.durationSeconds }
      : {}),
  };
}

export function projectAssetCatalogEntryToConversationMediaAssetCandidate(
  entry: AssetCatalogEntry,
): ConversationMediaAssetCandidate | null {
  if (entry.kind === "document") {
    return null;
  }

  return {
    assetId: entry.assetId,
    assetKind: entry.kind,
    label: entry.label,
    fileName: entry.fileName,
    mimeType: entry.mimeType,
    source: entry.source,
    retentionClass: entry.retentionClass,
    createdAt: entry.createdAt,
    conversationId: entry.conversationId,
    producedByJobId: entry.producedByJobId,
    materializationKey: entry.materializationKey,
    ...(entry.derivativeOfAssetId !== undefined
      ? { derivativeOfAssetId: entry.derivativeOfAssetId }
      : {}),
    ...(entry.toolName ? { toolName: entry.toolName } : {}),
    ...(typeof entry.width === "number" ? { width: entry.width } : {}),
    ...(typeof entry.height === "number" ? { height: entry.height } : {}),
    ...(typeof entry.durationSeconds === "number"
      ? { durationSeconds: entry.durationSeconds }
      : {}),
  };
}

export function projectAssetCatalogEntryToWorkspaceAssetRef(entry: AssetCatalogEntry): WorkspaceAssetRef {
  return {
    assetId: entry.assetId,
    kind: entry.kind,
    status: entry.status,
    producedByJobId: entry.producedByJobId,
    materializationKey: entry.materializationKey,
    updatedAt: entry.updatedAt,
  };
}
