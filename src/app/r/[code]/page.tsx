import Link from "next/link";

import { ReferralVisitActivator } from "@/components/referral/ReferralVisitActivator";
import { PublicStatusPage } from "@/components/public/PublicStatusPage";
import { getInstanceIdentity } from "@/lib/config/instance";
import { getActiveReferralSnapshot } from "@/lib/referrals/referral-resolver";

export const dynamic = "force-dynamic";

export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const identity = getInstanceIdentity();
  const { code } = await params;
  const referral = getActiveReferralSnapshot(code);

  if (!referral) {
    return (
      <PublicStatusPage
        brandName={identity.name}
        eyebrow="Referral unavailable"
        title="That referral link is not active"
        description="The shared link or QR code may be invalid, expired, or no longer enabled. You can still continue into Studio Ordo normally."
        primaryAction={{ href: "/", label: "Start a normal chat" }}
        secondaryAction={{ href: "/offers", label: "View offers" }}
      />
    );
  }

  return (
    <main className="public-entry-shell">
      <section className="profile-panel-surface public-entry-card public-entry-card-split" data-referral-landing="true">
        <div className="public-entry-aside">
          <ReferralVisitActivator code={referral.code} />
          <div className="public-entry-header">
            <p className="public-entry-kicker">Referred introduction</p>
            <h1 className="public-entry-title max-w-3xl" data-public-entry-title="true">
            {referral.name} invited you into {identity.name}
            </h1>
            <p className="public-entry-description">
              Start with the main chat surface. This validated link carries the introduction forward without forcing extra setup first.
            </p>
          </div>

          <div className="public-entry-actions">
            <Link
              href="/"
              className="btn-primary focus-ring inline-flex w-full items-center justify-center sm:w-auto"
              data-public-entry-primary-action="true"
            >
              Start chat
            </Link>
            <Link href="/offers" className="btn-secondary focus-ring w-full sm:w-auto">
              View offers
            </Link>
          </div>

          <p className="public-entry-support">
            Attribution can continue into chat, registration, and later account flows after the link is validated here.
          </p>
        </div>

        <div className="profile-feature-surface grid gap-(--space-4) p-(--space-inset-default) sm:p-(--space-inset-panel)" data-referral-summary="true">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-foreground/38">Referrer</p>
            <p className="mt-(--space-1) text-lg font-semibold text-foreground">{referral.name}</p>
            <p className="text-sm text-foreground/58">
              {referral.credential?.trim() ? referral.credential : "Studio Ordo affiliate"}
            </p>
          </div>
          <p className="text-sm leading-6 text-foreground/56">
            This landing page validates the referral before any attribution follows you into chat, registration, or later account flows.
          </p>
        </div>
      </section>
    </main>
  );
}
