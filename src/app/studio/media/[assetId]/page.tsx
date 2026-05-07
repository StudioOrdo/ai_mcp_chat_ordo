import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OrdoDetailLayout } from "@/components/ordo-details/OrdoDetailLayout";
import { getSessionUser } from "@/lib/auth";
import { loadStudioMediaDetail } from "@/lib/ordo-details/load-studio-object-detail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Media Detail",
  robots: { index: false, follow: false },
};

export default async function StudioMediaDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const user = await getSessionUser();
  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  const { assetId } = await params;
  const detail = await loadStudioMediaDetail(user, assetId);
  if (!detail) {
    notFound();
  }

  return <OrdoDetailLayout detail={detail} />;
}
