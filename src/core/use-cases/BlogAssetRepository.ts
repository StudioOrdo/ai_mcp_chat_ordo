import type {
  BlogAsset,
  BlogAssetSeed,
  BlogAssetSelectionState,
  BlogAssetVisibility,
} from "@/core/entities/blog-asset";

export interface BlogAssetRepository {
  create(seed: BlogAssetSeed): Promise<BlogAsset>;
  findById(id: string): Promise<BlogAsset | null>;
  listByPost(postId: string): Promise<BlogAsset[]>;
  listByUser(userId: string, options?: { limit?: number; kinds?: string[] }): Promise<BlogAsset[]>;
  listHeroCandidates(postId: string): Promise<BlogAsset[]>;
  attachToPost(id: string, postId: string): Promise<BlogAsset>;
  detachFromPost(id: string): Promise<BlogAsset>;
  setVisibility(id: string, visibility: BlogAssetVisibility): Promise<BlogAsset>;
  setSelectionState(id: string, selectionState: BlogAssetSelectionState): Promise<BlogAsset>;
}