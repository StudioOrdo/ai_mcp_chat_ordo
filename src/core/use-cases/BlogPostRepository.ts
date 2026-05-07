import type {
  BlogPost,
  BlogPostAdminFilters,
  BlogPostDraftPatch,
  BlogPostEditorialMetadataPatch,
  BlogPostSeed,
  BlogPostStatus,
} from "@/core/entities/blog";

export interface BlogPostRepository {
  create(seed: BlogPostSeed): Promise<BlogPost>;
  findById(id: string): Promise<BlogPost | null>;
  findBySlug(slug: string): Promise<BlogPost | null>;
  listPublished(): Promise<BlogPost[]>;
  countPublished(): Promise<number>;
  listForAdmin(filters?: BlogPostAdminFilters): Promise<BlogPost[]>;
  countForAdmin(filters?: Omit<BlogPostAdminFilters, "limit">): Promise<number>;
  updateDraftContent(id: string, patch: BlogPostDraftPatch): Promise<BlogPost>;
  updateEditorialMetadata(id: string, patch: BlogPostEditorialMetadataPatch): Promise<BlogPost>;
  transitionWorkflow(id: string, nextStatus: BlogPostStatus, actorUserId: string): Promise<BlogPost>;
  publishById(id: string, publishedByUserId: string): Promise<BlogPost>;
  setHeroImageAsset(id: string, heroImageAssetId: string | null): Promise<BlogPost>;
}
