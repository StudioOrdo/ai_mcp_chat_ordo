import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarkdownProse } from "@/components/MarkdownProse";
import {
  loadPublicFeedItemBySlug,
  publicFeedHeroHref,
} from "@/lib/content/content-campaign-read-model";
import { getInstanceIdentity } from "@/lib/config/instance";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await loadPublicFeedItemBySlug(slug);
  if (!item) {
    return { title: "Feed Item | Studio Ordo" };
  }

  return {
    title: `${item.post.title} | Studio Ordo`,
    description: item.post.description,
  };
}

export default async function FeedItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const item = await loadPublicFeedItemBySlug(slug);
  if (!item) {
    notFound();
  }

  const identity = getInstanceIdentity();
  const heroHref = publicFeedHeroHref(item);
  const trackedCode = Array.isArray(query.tl) ? query.tl[0] : query.tl;
  const chatHref = trackedCode ? `/?tl=${encodeURIComponent(trackedCode)}` : "/";

  return (
    <main className="shell-page editorial-page-shell">
      <article className="site-container px-(--container-padding) py-[clamp(3rem,8vw,6rem)]">
        <header className="max-w-3xl">
          <p className="shell-section-heading mb-4 opacity-60">{identity.name} feed</p>
          <h1 className="journal-intro-title mb-6">{item.post.title}</h1>
          <p className="journal-intro-dek mb-6">{item.post.description}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={chatHref} className="shell-nav-guest-link shell-nav-guest-link-primary px-5">
              Start chat
            </Link>
            <Link href="/offers" className="shell-nav-guest-link shell-nav-guest-link-secondary px-5">
              View offers
            </Link>
          </div>
        </header>

        {heroHref ? (
          <figure className="my-(--space-7) overflow-hidden rounded-lg border border-foreground/10 bg-foreground/[0.03]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroHref}
              alt={item.heroAsset?.altText || item.post.title}
              className="aspect-[16/9] w-full object-cover"
            />
          </figure>
        ) : null}

        <MarkdownProse
          content={item.post.content}
          className="library-prose max-w-3xl"
          variant="default"
        />
      </article>
    </main>
  );
}
