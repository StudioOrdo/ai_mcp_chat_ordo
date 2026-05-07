import type { Metadata } from "next";
import Link from "next/link";

import { publicFeedHeroHref, loadPublicFeedItems } from "@/lib/content/content-campaign-read-model";
import { getInstanceIdentity } from "@/lib/config/instance";

export const metadata: Metadata = {
  title: "Feed | Studio Ordo",
  description:
    "Public updates and published media from this Ordo instance.",
};

export default async function FeedPage() {
  const identity = getInstanceIdentity();
  const items = await loadPublicFeedItems();

  return (
    <main className="shell-page editorial-page-shell">
      <div className="site-container px-(--container-padding) py-[clamp(3rem,8vw,6rem)]">
        <section className="max-w-3xl">
          <p className="shell-section-heading mb-4 opacity-60">{identity.name} feed</p>
          <h1 className="journal-intro-title mb-6">Public feed</h1>
          <p className="journal-intro-dek mb-6">
            This is where public updates, audio, and short-form media will appear
            when the owner chooses to publish them.
          </p>
          {items.length > 0 ? (
            <div className="grid gap-(--space-4)" aria-label="Public feed items">
              {items.map((item) => {
                const heroHref = publicFeedHeroHref(item);
                return (
                  <article
                    key={item.post.id}
                    className="profile-feature-surface grid gap-(--space-3) overflow-hidden p-(--space-inset-default)"
                    data-public-feed-item={item.post.id}
                  >
                    {heroHref ? (
                      <Link
                        href={item.publicHref}
                        className="block overflow-hidden rounded-lg border border-foreground/10 bg-foreground/[0.03]"
                        aria-label={`Open ${item.post.title}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={heroHref}
                          alt={item.heroAsset?.altText || item.post.title}
                          className="aspect-[16/9] w-full object-cover"
                        />
                      </Link>
                    ) : null}
                    <p className="shell-section-heading opacity-60">
                      {item.post.section ?? "feed item"}
                    </p>
                    <h2 className="about-feature-title">
                      <Link href={item.publicHref}>{item.post.title}</Link>
                    </h2>
                    <p className="about-feature-body">{item.post.description}</p>
                    <Link href={item.publicHref} className="shell-nav-guest-link shell-nav-guest-link-primary w-fit px-5">
                      Read
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="profile-feature-surface grid gap-(--space-3) p-(--space-inset-default)">
              <p className="about-feature-title">No public feed items yet</p>
              <p className="about-feature-body">
                The system is ready, but this instance has not published public
                content. Start at the homepage chat or review the current offers.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/" className="shell-nav-guest-link shell-nav-guest-link-primary px-5">
                  Start chat
                </Link>
                <Link href="/offers" className="shell-nav-guest-link shell-nav-guest-link-secondary px-5">
                  View offers
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
