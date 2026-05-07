import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OrdoDetailLayout } from "@/components/ordo-details/OrdoDetailLayout";
import { getSessionUser } from "@/lib/auth";
import { loadBusinessReferralDetail } from "@/lib/ordo-details/load-business-object-detail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Referral Detail",
  robots: { index: false, follow: false },
};

export default async function BusinessReferralDetailPage({
  params,
}: {
  params: Promise<{ referralCode: string }>;
}) {
  const user = await getSessionUser();
  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  const { referralCode } = await params;
  const detail = await loadBusinessReferralDetail(user, referralCode);
  if (!detail) {
    notFound();
  }

  return <OrdoDetailLayout detail={detail} />;
}
