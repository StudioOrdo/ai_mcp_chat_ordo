import type { BlogPost } from "@/core/entities/blog";
import type { BlogAsset } from "@/core/entities/blog-asset";
import type { BlogPostArtifact } from "@/core/entities/blog-artifact";
import type { Offer } from "@/core/entities/offer";
import type {
  TrackedLinkPerformanceSummary,
  TrackedLinkWithPerformance,
} from "@/core/entities/tracked-link";

export const CONTENT_PERFORMANCE_CAMPAIGN_ID = "content-performance";

export interface ContentPerformanceSummary extends TrackedLinkPerformanceSummary {
  links: number;
}

export interface ContentCampaignItem {
  post: BlogPost;
  heroAsset: BlogAsset | null;
  assets: readonly BlogAsset[];
  artifacts: readonly BlogPostArtifact[];
  trackedLinks: readonly TrackedLinkWithPerformance[];
  performance: ContentPerformanceSummary;
  publicHref: string | null;
  detailHref: string;
  isPublic: boolean;
}

export interface ContentCampaignReadModel {
  id: string;
  ownerUserId: string;
  title: string;
  summary: string;
  items: readonly ContentCampaignItem[];
  offers: readonly Offer[];
  trackedLinks: readonly TrackedLinkWithPerformance[];
  performance: ContentPerformanceSummary;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PublicFeedItem {
  post: BlogPost;
  heroAsset: BlogAsset | null;
  publicHref: string;
}
