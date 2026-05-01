import type { WorkspaceAssetKind, WorkspaceAssetStatus } from "@/core/entities/conversation-workspace";
import type {
  MediaAssetRetentionClass,
  MediaAssetSource,
} from "@/core/entities/media-asset";

export type AssetCatalogEntryKind = WorkspaceAssetKind;
export type AssetCatalogSourceType = "user_file" | "blog_asset";

export interface AssetCatalogEntry {
  assetId: string;
  kind: AssetCatalogEntryKind;
  ownerUserId: string;
  sourceType: AssetCatalogSourceType;
  status: WorkspaceAssetStatus;
  label: string;
  fileName: string;
  mimeType: string;
  source: MediaAssetSource;
  retentionClass: MediaAssetRetentionClass;
  createdAt: string;
  updatedAt: string;
  conversationId: string | null;
  producedByJobId: string | null;
  materializationKey: string | null;
  toolName?: string;
  derivativeOfAssetId?: string | null;
  width?: number;
  height?: number;
  durationSeconds?: number;
}