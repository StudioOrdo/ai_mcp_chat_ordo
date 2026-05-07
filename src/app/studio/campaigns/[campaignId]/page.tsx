import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OrdoDetailLayout } from "@/components/ordo-details/OrdoDetailLayout";
import { getSessionUser } from "@/lib/auth";
import { loadStudioCampaignDetail } from "@/lib/ordo-details/load-studio-object-detail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Campaign Detail",
  robots: { index: false, follow: false },
};

export default async function StudioCampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const user = await getSessionUser();
  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  const { campaignId } = await params;
  const detail = await loadStudioCampaignDetail(user, campaignId);
  if (!detail) {
    notFound();
  }

  return <OrdoDetailLayout detail={detail} />;
}
