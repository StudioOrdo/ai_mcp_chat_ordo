import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { getOfferService } from "@/lib/offers/offer-service";
import { formatOfferPrice } from "@/lib/offers/offer-format";
import { getTrackedLinkService } from "@/lib/tracked-links/tracked-link-service";
import {
  resolveValidatedTrackedLinkVisit,
  TRACKED_LINK_VISIT_COOKIE_NAME,
} from "@/lib/tracked-links/tracked-link-visit";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const offer = await getOfferService().findPublicOfferBySlug(slug);

  return {
    title: offer ? `${offer.title} | Studio Ordo` : "Offer not found",
    description: offer?.summary ?? "Studio Ordo offer",
  };
}

export default async function PublicOfferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const offer = await getOfferService().findPublicOfferBySlug(slug);
  if (!offer) {
    notFound();
  }
  const search = searchParams ? await searchParams : {};
  const trackedCode = firstSearchValue(search.tl);
  const trackedVisit = resolveValidatedTrackedLinkVisit(
    (await cookies()).get(TRACKED_LINK_VISIT_COOKIE_NAME)?.value,
  );

  if (trackedCode) {
    await getTrackedLinkService().recordOfferViewedByCode({
      code: trackedCode,
      offerId: offer.id,
      anonymousVisitId: trackedVisit?.code === trackedCode ? trackedVisit.visitId : null,
    });
  }
  const offerQuery = new URLSearchParams({ offer: offer.slug });
  if (trackedCode) {
    offerQuery.set("tl", trackedCode);
  }

  return (
    <main className="shell-page editorial-page-shell">
      <div className="site-container px-(--container-padding) py-[clamp(3rem,8vw,6rem)]">
        <article className="profile-feature-surface max-w-3xl p-(--space-inset-panel)">
          <p className="shell-section-heading mb-4 opacity-60">Public offer</p>
          <h1 className="journal-intro-title mb-6">{offer.title}</h1>
          <p className="journal-intro-dek">{offer.summary}</p>
          <dl className="mt-8 grid gap-(--space-3) sm:grid-cols-3">
            <OfferDetailMetric label="For" value={offer.audience} />
            <OfferDetailMetric label="Price" value={formatOfferPrice(offer)} />
            <OfferDetailMetric label="Billing" value={offer.billingKind} />
          </dl>
          <section className="mt-8 grid gap-(--space-4)">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Promise</h2>
              <p className="mt-(--space-1) text-sm leading-6 text-foreground/68">{offer.promise}</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">What happens</h2>
              <p className="mt-(--space-1) whitespace-pre-wrap text-sm leading-6 text-foreground/68">
                {offer.description}
              </p>
            </div>
          </section>
          <div className="mt-8 flex flex-wrap gap-(--space-2)">
            <Link href={`/?${offerQuery.toString()}`} className="shell-nav-guest-link shell-nav-guest-link-primary px-5">
              {offer.ctaLabel}
            </Link>
            <Link href="/offers" className="shell-nav-guest-link shell-nav-guest-link-secondary px-5">
              All offers
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}

function firstSearchValue(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  const trimmed = candidate?.trim();
  return trimmed ? trimmed.slice(0, 48) : null;
}

function OfferDetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-background/80 p-(--space-3)">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/42">
        {label}
      </dt>
      <dd className="mt-(--space-1) text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}
