import type { AssetCatalogEntry, AssetCatalogEntryKind } from "@/core/entities/asset-catalog";
import type { MediaAssetKind } from "@/core/entities/media-asset";

export interface ListConversationAssetsInput {
  conversationId: string;
  userId: string;
}

export interface ListReusableMediaAssetsInput {
  conversationId: string;
  userId: string;
  kinds?: MediaAssetKind[];
  limit?: number;
}

export interface FindAssetCatalogEntryInput {
  assetId: string;
  userId: string;
}

export interface AssetCatalogReader {
  listConversationAssets(input: ListConversationAssetsInput): Promise<AssetCatalogEntry[]>;
  listReusableMediaAssets(input: ListReusableMediaAssetsInput): Promise<AssetCatalogEntry[]>;
  findByAssetId(input: FindAssetCatalogEntryInput): Promise<AssetCatalogEntry | null>;
}

export function filterAssetCatalogEntriesByKinds(
  entries: readonly AssetCatalogEntry[],
  kinds?: readonly AssetCatalogEntryKind[],
): AssetCatalogEntry[] {
  if (!kinds || kinds.length === 0) {
    return [...entries];
  }

  const allowedKinds = new Set(kinds);
  return entries.filter((entry) => allowedKinds.has(entry.kind));
}