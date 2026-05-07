import {
  getBlogAssetRepository,
  getBlogPostArtifactRepository,
  getBlogPostRepository,
  getOfferRepository,
  getTrackedLinkRepository,
} from "@/adapters/RepositoryFactory";
import {
  CONTENT_PERFORMANCE_CAMPAIGN_ID,
  type ContentCampaignItem,
  type ContentCampaignReadModel as ContentCampaignReadModelSnapshot,
  type ContentPerformanceSummary,
  type PublicFeedItem,
} from "@/core/entities/content-campaign";
import type { BlogPost } from "@/core/entities/blog";
import type { BlogAsset } from "@/core/entities/blog-asset";
import type { BlogPostRepository } from "@/core/use-cases/BlogPostRepository";
import type { BlogAssetRepository } from "@/core/use-cases/BlogAssetRepository";
import type { BlogPostArtifactRepository } from "@/core/use-cases/BlogPostArtifactRepository";
import type { OfferRepository } from "@/core/use-cases/OfferRepository";
import type { TrackedLinkRepository } from "@/core/use-cases/TrackedLinkRepository";
import type { TrackedLinkWithPerformance } from "@/core/entities/tracked-link";
import { getBlogAssetUrl } from "@/lib/blog/hero-images";
import { studioContentDetailHref } from "@/lib/ordo-details/ordo-detail-routes";

const CONTENT_SOURCE_LIMIT = 100;
const CONTENT_PUBLIC_LIMIT = 50;

export interface ContentCampaignReadModelDeps {
  posts?: BlogPostRepository;
  assets?: BlogAssetRepository;
  artifacts?: BlogPostArtifactRepository;
  offers?: OfferRepository;
  trackedLinks?: TrackedLinkRepository;
}

function emptyPerformance(): ContentPerformanceSummary {
  return {
    links: 0,
    visits: 0,
    chats: 0,
    signups: 0,
    offerViews: 0,
    offerChoices: 0,
    simulatedPurchases: 0,
    conversions: 0,
  };
}

export function combineContentPerformance(
  links: readonly TrackedLinkWithPerformance[],
): ContentPerformanceSummary {
  return links.reduce((summary, link) => ({
    links: summary.links + 1,
    visits: summary.visits + link.performance.visits,
    chats: summary.chats + link.performance.chats,
    signups: summary.signups + link.performance.signups,
    offerViews: summary.offerViews + link.performance.offerViews,
    offerChoices: summary.offerChoices + link.performance.offerChoices,
    simulatedPurchases: summary.simulatedPurchases + link.performance.simulatedPurchases,
    conversions: summary.conversions + link.performance.conversions,
  }), emptyPerformance());
}

function groupByPostId(assets: readonly BlogAsset[]): Map<string, BlogAsset[]> {
  const result = new Map<string, BlogAsset[]>();
  for (const asset of assets) {
    if (!asset.postId) {
      continue;
    }
    const existing = result.get(asset.postId) ?? [];
    existing.push(asset);
    result.set(asset.postId, existing);
  }
  return result;
}

function groupLinksByTarget(
  links: readonly TrackedLinkWithPerformance[],
): Map<string, TrackedLinkWithPerformance[]> {
  const result = new Map<string, TrackedLinkWithPerformance[]>();
  for (const link of links) {
    if (link.link.targetKind !== "content_item") {
      continue;
    }
    const existing = result.get(link.link.targetId) ?? [];
    existing.push(link);
    result.set(link.link.targetId, existing);
  }
  return result;
}

function isPublishedHero(post: BlogPost, asset: BlogAsset | null | undefined): asset is BlogAsset {
  return Boolean(
    asset
      && asset.id === post.heroImageAssetId
      && asset.postId === post.id
      && asset.kind === "hero"
      && asset.visibility === "published",
  );
}

function publicHrefForPost(post: BlogPost): string | null {
  return post.status === "published"
    ? `/feed/${encodeURIComponent(post.slug)}`
    : null;
}

function itemUpdatedAt(item: ContentCampaignItem): string {
  const candidates = [
    item.post.updatedAt,
    item.heroAsset?.updatedAt,
    ...item.trackedLinks.map((link) => link.link.updatedAt),
  ].filter((value): value is string => Boolean(value));

  return candidates.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? item.post.updatedAt;
}

export class ContentCampaignReadModel {
  private readonly posts: BlogPostRepository;
  private readonly assets: BlogAssetRepository;
  private readonly artifacts: BlogPostArtifactRepository;
  private readonly offers: OfferRepository;
  private readonly trackedLinks: TrackedLinkRepository;

  constructor(deps: ContentCampaignReadModelDeps = {}) {
    this.posts = deps.posts ?? getBlogPostRepository();
    this.assets = deps.assets ?? getBlogAssetRepository();
    this.artifacts = deps.artifacts ?? getBlogPostArtifactRepository();
    this.offers = deps.offers ?? getOfferRepository();
    this.trackedLinks = deps.trackedLinks ?? getTrackedLinkRepository();
  }

  async listPublicFeedItems(limit = CONTENT_PUBLIC_LIMIT): Promise<PublicFeedItem[]> {
    const posts = (await this.posts.listPublished()).slice(0, limit);
    const items = await Promise.all(posts.map(async (post) => {
      const heroAsset = post.heroImageAssetId
        ? await this.assets.findById(post.heroImageAssetId)
        : null;

      return {
        post,
        heroAsset: isPublishedHero(post, heroAsset) ? heroAsset : null,
        publicHref: `/feed/${encodeURIComponent(post.slug)}`,
      };
    }));

    return items;
  }

  async loadPublicFeedItemBySlug(slug: string): Promise<PublicFeedItem | null> {
    const post = await this.posts.findBySlug(slug);
    if (!post || post.status !== "published") {
      return null;
    }

    const heroAsset = post.heroImageAssetId
      ? await this.assets.findById(post.heroImageAssetId)
      : null;

    return {
      post,
      heroAsset: isPublishedHero(post, heroAsset) ? heroAsset : null,
      publicHref: `/feed/${encodeURIComponent(post.slug)}`,
    };
  }

  async listOwnerContentItems(ownerUserId: string, limit = CONTENT_SOURCE_LIMIT): Promise<ContentCampaignItem[]> {
    const [allPosts, ownerAssets, ownerLinks] = await Promise.all([
      this.posts.listForAdmin({ limit }),
      this.assets.listByUser(ownerUserId, { limit }),
      this.trackedLinks.listWithPerformanceByOwnerUserId(ownerUserId),
    ]);
    const ownerPosts = allPosts.filter((post) => post.createdByUserId === ownerUserId);
    const assetsByPost = groupByPostId(ownerAssets);
    const linksByPost = groupLinksByTarget(ownerLinks);

    const items = await Promise.all(ownerPosts.map(async (post) => {
      const postAssets = assetsByPost.get(post.id) ?? [];
      const heroAsset = post.heroImageAssetId
        ? postAssets.find((asset) => asset.id === post.heroImageAssetId) ?? await this.assets.findById(post.heroImageAssetId)
        : null;
      const postLinks = linksByPost.get(post.id) ?? [];
      const publicHref = publicHrefForPost(post);

      return {
        post,
        heroAsset: heroAsset?.createdByUserId === ownerUserId ? heroAsset : null,
        assets: postAssets,
        artifacts: await this.artifacts.listByPost(post.id),
        trackedLinks: postLinks,
        performance: combineContentPerformance(postLinks),
        publicHref,
        detailHref: studioContentDetailHref(post.id),
        isPublic: Boolean(publicHref),
      };
    }));

    return items.sort((left, right) => Date.parse(itemUpdatedAt(right)) - Date.parse(itemUpdatedAt(left)));
  }

  async loadOwnerContentItem(
    ownerUserId: string,
    contentId: string,
  ): Promise<ContentCampaignItem | null> {
    const post = await this.posts.findById(contentId);
    if (!post || post.createdByUserId !== ownerUserId) {
      return null;
    }

    const [assets, artifacts, links] = await Promise.all([
      this.assets.listByPost(post.id),
      this.artifacts.listByPost(post.id),
      this.trackedLinks.listWithPerformanceByOwnerUserId(ownerUserId),
    ]);
    const postLinks = links.filter((link) => link.link.targetKind === "content_item" && link.link.targetId === post.id);
    const heroAsset = post.heroImageAssetId
      ? assets.find((asset) => asset.id === post.heroImageAssetId) ?? await this.assets.findById(post.heroImageAssetId)
      : null;

    return {
      post,
      heroAsset: heroAsset?.createdByUserId === ownerUserId ? heroAsset : null,
      assets,
      artifacts,
      trackedLinks: postLinks,
      performance: combineContentPerformance(postLinks),
      publicHref: publicHrefForPost(post),
      detailHref: studioContentDetailHref(post.id),
      isPublic: post.status === "published",
    };
  }

  async loadOwnerCampaign(
    ownerUserId: string,
    campaignId = CONTENT_PERFORMANCE_CAMPAIGN_ID,
  ): Promise<ContentCampaignReadModelSnapshot | null> {
    if (campaignId !== CONTENT_PERFORMANCE_CAMPAIGN_ID) {
      return null;
    }

    const [items, offers, links] = await Promise.all([
      this.listOwnerContentItems(ownerUserId),
      this.offers.listByOwnerUserId(ownerUserId),
      this.trackedLinks.listWithPerformanceByOwnerUserId(ownerUserId),
    ]);
    const publicOffers = offers.filter((offer) => offer.status === "published" && offer.visibility === "public");
    const campaignLinks = links.filter((link) => (
      link.link.targetKind === "content_item"
        || link.link.targetKind === "offer"
        || link.link.targetKind === "url"
    ));
    const campaignPerformance = combineContentPerformance(campaignLinks);
    const updatedAt = [
      ...items.map(itemUpdatedAt),
      ...publicOffers.map((offer) => offer.updatedAt),
      ...campaignLinks.map((link) => link.link.updatedAt),
    ].sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
    const createdAt = [
      ...items.map((item) => item.post.createdAt),
      ...publicOffers.map((offer) => offer.createdAt),
    ].sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null;

    return {
      id: campaignId,
      ownerUserId,
      title: "Content performance loop",
      summary: "Published content, public offers, and tracked links grouped into one owner-readable results loop.",
      items,
      offers: publicOffers,
      trackedLinks: campaignLinks,
      performance: campaignPerformance,
      createdAt,
      updatedAt,
    };
  }
}

export function createContentCampaignReadModel(
  deps: ContentCampaignReadModelDeps = {},
): ContentCampaignReadModel {
  return new ContentCampaignReadModel(deps);
}

export async function loadPublicFeedItems(limit?: number): Promise<PublicFeedItem[]> {
  return createContentCampaignReadModel().listPublicFeedItems(limit);
}

export async function loadPublicFeedItemBySlug(slug: string): Promise<PublicFeedItem | null> {
  return createContentCampaignReadModel().loadPublicFeedItemBySlug(slug);
}

export async function loadOwnerContentItems(ownerUserId: string): Promise<ContentCampaignItem[]> {
  return createContentCampaignReadModel().listOwnerContentItems(ownerUserId);
}

export async function loadOwnerContentItem(
  ownerUserId: string,
  contentId: string,
): Promise<ContentCampaignItem | null> {
  return createContentCampaignReadModel().loadOwnerContentItem(ownerUserId, contentId);
}

export async function loadOwnerContentCampaign(
  ownerUserId: string,
  campaignId?: string,
): Promise<ContentCampaignReadModelSnapshot | null> {
  return createContentCampaignReadModel().loadOwnerCampaign(ownerUserId, campaignId);
}

export function publicFeedHeroHref(item: PublicFeedItem | ContentCampaignItem): string | null {
  return item.heroAsset ? getBlogAssetUrl(item.heroAsset.id) : null;
}
