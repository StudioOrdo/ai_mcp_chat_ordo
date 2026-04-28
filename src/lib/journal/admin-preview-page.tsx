import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { getBlogAssetRepository, getBlogPostRepository } from "@/adapters/RepositoryFactory";
import { MarkdownProse } from "@/components/MarkdownProse";
import { getBlogAssetUrl } from "@/lib/blog/hero-images";
import { normalizeBlogMarkdown } from "@/lib/blog/normalize-markdown";
import { getSessionUser } from "@/lib/auth";
import { getInstanceIdentity } from "@/lib/config/instance";
import { canAccessJournalWorkspace, requireJournalWorkspaceAccess } from "@/lib/journal/admin-journal";

async function loadPreviewHeroAsset(post: { id: string; heroImageAssetId: string | null }) {
  if (!post.heroImageAssetId) {
    return null;
  }

  const asset = await getBlogAssetRepository().findById(post.heroImageAssetId);

  if (!asset || asset.id !== post.heroImageAssetId || asset.postId !== post.id || asset.kind !== "hero") {
    return null;
  }

  return asset;
}

function getPreviewMetadataLabel(status: "draft" | "review" | "approved" | "published"): string {
  return status === "published" ? "Published Preview" : "Draft Preview";
}

export async function generateAdminJournalPreviewMetadata(slug: string): Promise<Metadata> {
  const identity = getInstanceIdentity();
  const user = await getSessionUser();
  const fallbackDescription = `Editorial draft preview for ${identity.name}.`;

  if (!canAccessJournalWorkspace(user.roles)) {
    return {
      title: `Draft Preview | ${identity.name}`,
      description: fallbackDescription,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const post = await getBlogPostRepository().findBySlug(slug);
  const previewLabel = post ? getPreviewMetadataLabel(post.status) : "Draft Preview";

  return {
    title: post ? `${post.title} | ${previewLabel} | ${identity.name}` : `Draft Preview | ${identity.name}`,
    description: post?.description ?? fallbackDescription,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export async function renderAdminJournalPreviewPage(slug: string) {
  await requireJournalWorkspaceAccess();

  const post = await getBlogPostRepository().findBySlug(slug);

  if (!post) {
    notFound();
  }

  const normalizedContent = normalizeBlogMarkdown(post.title, post.content);
  const heroAsset = await loadPreviewHeroAsset(post);
  const previewLabel = post.status === "published" ? "Published preview" : "Draft preview";

  return (
    <div className="shell-page editorial-page-shell">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-(--container-padding) py-12 sm:py-16">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-foreground/60">
            <span className="rounded-full border border-foreground/12 bg-foreground/4 px-3 py-1 font-medium">
              {previewLabel}
            </span>
            <span>{post.slug}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{post.title}</h1>
          {post.description && <p className="text-foreground/60">{post.description}</p>}
          {heroAsset ? (
            <div className="overflow-hidden rounded-2xl border border-foreground/8 bg-foreground/3">
              <Image
                src={getBlogAssetUrl(heroAsset.id)}
                alt={heroAsset.altText}
                width={heroAsset.width ?? 1200}
                height={heroAsset.height ?? 630}
                unoptimized
                className="h-auto w-full object-cover"
                sizes="(max-width: 768px) 100vw, 896px"
                priority
              />
            </div>
          ) : null}
        </header>

        <article>
          <MarkdownProse content={normalizedContent} className="library-prose max-w-none" />
        </article>
      </div>
    </div>
  );
}